import type {
  IntegrationStore,
  IntegrationConnection,
  ConnectRequest,
  OAuthCallbackRequest,
  EncryptFn,
  DecryptFn,
  OAuthConfig,
  IntegrationDefinition,
} from './types.js';
import { INTEGRATION_REGISTRY } from './registry.js';

export type IntegrationServiceOptions = {
  store: IntegrationStore;
  encrypt: EncryptFn;
  decrypt: DecryptFn;
  oauthCallbackBaseUrl: string;
};

const HEALTH_CHECK_TIMEOUT_MS = 10_000;

export class IntegrationConnectionService {
  private store: IntegrationStore;
  private encrypt: EncryptFn;
  private decrypt: DecryptFn;
  private oauthCallbackBaseUrl: string;

  constructor(options: IntegrationServiceOptions) {
    this.store = options.store;
    this.encrypt = options.encrypt;
    this.decrypt = options.decrypt;
    this.oauthCallbackBaseUrl = options.oauthCallbackBaseUrl.replace(/\/$/, '');
  }

  async list(workspaceId: string, userId: string): Promise<IntegrationConnection[]> {
    try {
      return await this.store.findByUser(workspaceId, userId);
    } catch (err: unknown) {
      // Sentry.captureException — handled by consuming app
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(`Failed to list integrations: ${message}`, { cause: err });
    }
  }

  async listAvailable(
    workspaceId: string,
    userId: string,
  ): Promise<(IntegrationDefinition & { connectionStatus: IntegrationConnection['status'] | null })[]> {
    try {
      const connections = await this.store.findByUser(workspaceId, userId);
      const statusMap = new Map(connections.map((conn) => [conn.integrationId, conn.status]));

      return [...INTEGRATION_REGISTRY.values()].map((definition) => ({
        ...definition,
        connectionStatus: statusMap.get(definition.id) ?? null,
      }));
    } catch (err: unknown) {
      // Sentry.captureException — handled by consuming app
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(`Failed to list available integrations: ${message}`, { cause: err });
    }
  }

  async connect(
    workspaceId: string,
    userId: string,
    request: ConnectRequest,
  ): Promise<{ connection?: IntegrationConnection; redirectUrl?: string }> {
    try {
      const definition = INTEGRATION_REGISTRY.get(request.integrationId);
      if (!definition) {
        throw new Error(`Unknown integration: ${request.integrationId}`);
      }

      const existing = await this.store.findByIntegration(workspaceId, userId, request.integrationId);
      if (existing) {
        throw new Error(`Integration ${request.integrationId} already connected`);
      }

      if (definition.authMethod === 'oauth2') {
        const oauthConfig = definition.authConfig as OAuthConfig;
        const state = await this.encrypt(JSON.stringify({ workspaceId, userId, integrationId: request.integrationId }));
        const params = new URLSearchParams({
          response_type: 'code',
          redirect_uri: `${this.oauthCallbackBaseUrl}/v1/agent/integrations/oauth/callback`,
          scope: oauthConfig.scopes.join(' '),
          state,
        });

        if (request.credentials?.clientId) {
          params.set('client_id', request.credentials.clientId);
        }

        // PKCE: generate code_verifier + SHA-256 code_challenge
        if (oauthConfig.pkce) {
          const verifierBytes = new Uint8Array(32);
          crypto.getRandomValues(verifierBytes);
          const codeVerifier = Buffer.from(verifierBytes).toString('base64url');
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
          const codeChallenge = Buffer.from(digest).toString('base64url');
          params.set('code_challenge_method', 'S256');
          params.set('code_challenge', codeChallenge);

          const connection = await this.store.create({
            workspaceId,
            userId,
            integrationId: request.integrationId,
            status: 'pending',
            lastHealthCheck: null,
            healthError: null,
            metadata: { oauthState: state, codeVerifier },
          });

          return { connection, redirectUrl: `${oauthConfig.authUrl}?${params.toString()}` };
        }

        const connection = await this.store.create({
          workspaceId,
          userId,
          integrationId: request.integrationId,
          status: 'pending',
          lastHealthCheck: null,
          healthError: null,
          metadata: { oauthState: state },
        });

        return { connection, redirectUrl: `${oauthConfig.authUrl}?${params.toString()}` };
      }

      if (!request.credentials) {
        throw new Error('Credentials required for API key integrations');
      }

      const encrypted = await this.encrypt(JSON.stringify(request.credentials));
      const connection = await this.store.create({
        workspaceId,
        userId,
        integrationId: request.integrationId,
        status: 'connected',
        lastHealthCheck: null,
        healthError: null,
        metadata: { encryptedCredentials: encrypted },
      });

      return { connection };
    } catch (err: unknown) {
      // Sentry.captureException — handled by consuming app
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(`Failed to connect integration ${request.integrationId}: ${message}`, { cause: err });
    }
  }

  async handleOAuthCallback(
    request: OAuthCallbackRequest,
  ): Promise<IntegrationConnection> {
    try {
      const statePayload = JSON.parse(await this.decrypt(request.state)) as {
        workspaceId: string;
        userId: string;
        integrationId: string;
      };

      const definition = INTEGRATION_REGISTRY.get(statePayload.integrationId);
      if (!definition || definition.authMethod !== 'oauth2') {
        throw new Error(`Invalid OAuth integration: ${statePayload.integrationId}`);
      }

      const existing = await this.store.findByIntegration(
        statePayload.workspaceId,
        statePayload.userId,
        statePayload.integrationId,
      );
      if (!existing) {
        throw new Error('No pending connection found for OAuth callback');
      }

      const oauthConfig = definition.authConfig as OAuthConfig;

      const tokenParams: Record<string, string> = {
        grant_type: 'authorization_code',
        code: request.code,
        redirect_uri: `${this.oauthCallbackBaseUrl}/v1/agent/integrations/oauth/callback`,
      };

      if (existing.metadata?.clientId) {
        tokenParams.client_id = String(existing.metadata.clientId);
      }
      if (existing.metadata?.clientSecret) {
        tokenParams.client_secret = String(existing.metadata.clientSecret);
      }

      if (oauthConfig.pkce && existing.metadata?.codeVerifier) {
        tokenParams.code_verifier = String(existing.metadata.codeVerifier);
      }

      const tokenResponse = await fetch(oauthConfig.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenParams),
        signal: AbortSignal.timeout(10_000),
      });

      if (!tokenResponse.ok) {
        const text = await tokenResponse.text().catch(() => 'unknown error');
        // Sentry.captureMessage — handled by consuming app
        throw new Error(`OAuth token exchange failed: ${text}`);
      }

      const tokens = (await tokenResponse.json()) as Record<string, unknown>;
      const encrypted = await this.encrypt(JSON.stringify(tokens));

      return await this.store.update(existing.id, {
        status: 'connected',
        metadata: { encryptedCredentials: encrypted },
      });
    } catch (err: unknown) {
      // Sentry.captureException — handled by consuming app
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(`OAuth callback failed: ${message}`, { cause: err });
    }
  }

  async disconnect(id: string): Promise<void> {
    try {
      const conn = await this.store.findById(id);
      if (!conn) {
        throw new Error(`Connection not found: ${id}`);
      }
      await this.store.delete(id);
    } catch (err: unknown) {
      // Sentry.captureException — handled by consuming app
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(`Failed to disconnect integration ${id}: ${message}`, { cause: err });
    }
  }

  async healthCheck(id: string): Promise<IntegrationConnection> {
    try {
      const conn = await this.store.findById(id);
      if (!conn) {
        throw new Error(`Connection not found: ${id}`);
      }

      const definition = INTEGRATION_REGISTRY.get(conn.integrationId);
      if (!definition) {
        throw new Error(`Unknown integration: ${conn.integrationId}`);
      }

      const credentialsJson = conn.metadata?.encryptedCredentials;
      if (typeof credentialsJson !== 'string') {
        return await this.store.update(id, {
          status: 'error',
          lastHealthCheck: new Date(),
          healthError: 'No credentials stored',
        });
      }

      const credentials = JSON.parse(await this.decrypt(credentialsJson)) as Record<string, string>;
      const healthResult = await this.checkIntegrationHealth(definition, credentials);

      return await this.store.update(id, {
        status: healthResult.ok ? 'connected' : 'error',
        lastHealthCheck: new Date(),
        healthError: healthResult.ok ? null : healthResult.error,
      });
    } catch (err: unknown) {
      // Sentry.captureException — handled by consuming app
      try {
        const message = err instanceof Error ? err.message : 'unknown error';
        return await this.store.update(id, {
          status: 'error',
          lastHealthCheck: new Date(),
          healthError: message,
        });
      } catch (_updateErr: unknown) {
        throw err;
      }
    }
  }

  private async checkIntegrationHealth(
    definition: IntegrationDefinition,
    credentials: Record<string, string>,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const checks: Record<string, () => Promise<Response>> = {
        stripe: () =>
          fetch('https://api.stripe.com/v1/balance', {
            headers: { Authorization: `Bearer ${credentials.apiKey}` },
            signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
          }),
        'google-maps': () =>
          fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway&key=${credentials.apiKey}`,
            { signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS) },
          ),
        hubspot: () =>
          fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
            headers: { Authorization: `Bearer ${credentials.access_token}` },
            signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
          }),
        slack: () =>
          fetch('https://slack.com/api/auth.test', {
            headers: { Authorization: `Bearer ${credentials.access_token}` },
            signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
          }),
        twilio: () =>
          fetch(`https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}.json`, {
            headers: {
              Authorization: `Basic ${btoa(`${credentials.accountSid}:${credentials.authToken}`)}`,
            },
            signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
          }),
        apollo: () =>
          fetch('https://api.apollo.io/v1/auth/health', {
            headers: { 'x-api-key': credentials.apiKey },
            signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
          }),
        clearbit: () =>
          fetch('https://company.clearbit.com/v2/companies/find?domain=clearbit.com', {
            headers: { Authorization: `Bearer ${credentials.apiKey}` },
            signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
          }),
        gohighlevel: () =>
          fetch('https://services.leadconnectorhq.com/locations/me', {
            headers: { Authorization: `Bearer ${credentials.access_token}`, Version: '2021-07-28' },
            signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
          }),
      };

      const checkFn = checks[definition.id];
      if (!checkFn) {
        return { ok: true };
      }

      const response = await checkFn();
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        // Sentry.captureMessage — handled by consuming app
        return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
      }

      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'health check failed';
      return { ok: false, error: message };
    }
  }
}
