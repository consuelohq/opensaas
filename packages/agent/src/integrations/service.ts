import type {
  IntegrationStore,
  IntegrationConnection,
  ConnectRequest,
  OAuthCallbackRequest,
  EncryptFn,
  DecryptFn,
  OAuthConfig,
} from './types.js';
import type { IntegrationDefinition } from './types.js';
import { INTEGRATION_REGISTRY } from './registry.js';

export type IntegrationServiceOptions = {
  store: IntegrationStore;
  encrypt: EncryptFn;
  decrypt: DecryptFn;
  oauthCallbackBaseUrl: string;
};

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

  // list user's connected integrations
  async list(workspaceId: string, userId: string): Promise<IntegrationConnection[]> {
    try {
      return await this.store.findByUser(workspaceId, userId);
    } catch (err: unknown) {
      // Sentry.captureException(err) — handled by consuming app
      throw err;
    }
  }

  // list all available integrations with connection status overlaid
  async listAvailable(
    workspaceId: string,
    userId: string,
  ): Promise<(IntegrationDefinition & { connectionStatus: IntegrationConnection['status'] | null })[]> {
    try {
      const connections = await this.store.findByUser(workspaceId, userId);
      const statusMap = new Map(connections.map((conn) => [conn.integrationId, conn.status]));

      return [...INTEGRATION_REGISTRY.values()].map((def) => ({
        ...def,
        connectionStatus: statusMap.get(def.id) ?? null,
      }));
    } catch (err: unknown) {
      // Sentry.captureException(err) — handled by consuming app
      throw err;
    }
  }

  // connect an integration — api_key stores creds, oauth returns redirect url
  async connect(
    workspaceId: string,
    userId: string,
    request: ConnectRequest,
  ): Promise<{ connection?: IntegrationConnection; redirectUrl?: string }> {
    try {
      const def = INTEGRATION_REGISTRY.get(request.integrationId);
      if (!def) {
        throw new Error(`Unknown integration: ${request.integrationId}`);
      }

      // check for existing connection
      const existing = await this.store.findByIntegration(workspaceId, userId, request.integrationId);
      if (existing) {
        throw new Error(`Integration ${request.integrationId} already connected`);
      }

      // oauth flow — return redirect url
      if (def.authMethod === 'oauth2') {
        const oauthConfig = def.authConfig as OAuthConfig;
        const state = await this.encrypt(JSON.stringify({ workspaceId, userId, integrationId: request.integrationId }));
        const params = new URLSearchParams({
          response_type: 'code',
          redirect_uri: `${this.oauthCallbackBaseUrl}/v1/agent/integrations/oauth/callback`,
          scope: oauthConfig.scopes.join(' '),
          state,
        });

        // client_id comes from env — consuming app must set it in credentials
        if (request.credentials?.clientId) {
          params.set('client_id', request.credentials.clientId);
        }

        if (oauthConfig.pkce) {
          // PKCE challenge would be generated here — consuming app handles code_verifier storage
          params.set('code_challenge_method', 'S256');
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

      // api_key / bearer / basic — encrypt and store credentials
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
      // Sentry.captureException(err) — handled by consuming app
      throw err;
    }
  }

  // handle oauth callback — exchange code for tokens
  async handleOAuthCallback(
    request: OAuthCallbackRequest,
  ): Promise<IntegrationConnection> {
    try {
      const statePayload = JSON.parse(await this.decrypt(request.state)) as {
        workspaceId: string;
        userId: string;
        integrationId: string;
      };

      const def = INTEGRATION_REGISTRY.get(statePayload.integrationId);
      if (!def || def.authMethod !== 'oauth2') {
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

      const oauthConfig = def.authConfig as OAuthConfig;

      // exchange code for tokens
      const tokenResponse = await fetch(oauthConfig.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: request.code,
          redirect_uri: `${this.oauthCallbackBaseUrl}/v1/agent/integrations/oauth/callback`,
        }),
      });

      if (!tokenResponse.ok) {
        const text = await tokenResponse.text().catch(() => 'unknown error');
        throw new Error(`OAuth token exchange failed: ${text}`);
      }

      const tokens = (await tokenResponse.json()) as Record<string, unknown>;
      const encrypted = await this.encrypt(JSON.stringify(tokens));

      return await this.store.update(existing.id, {
        status: 'connected',
        metadata: { encryptedCredentials: encrypted },
      });
    } catch (err: unknown) {
      // Sentry.captureException(err) — handled by consuming app
      throw err;
    }
  }

  // disconnect — delete credentials
  async disconnect(id: string): Promise<void> {
    try {
      const conn = await this.store.findById(id);
      if (!conn) {
        throw new Error(`Connection not found: ${id}`);
      }
      await this.store.delete(id);
    } catch (err: unknown) {
      // Sentry.captureException(err) — handled by consuming app
      throw err;
    }
  }

  // run health check on a connection
  async healthCheck(id: string): Promise<IntegrationConnection> {
    try {
      const conn = await this.store.findById(id);
      if (!conn) {
        throw new Error(`Connection not found: ${id}`);
      }

      const def = INTEGRATION_REGISTRY.get(conn.integrationId);
      if (!def) {
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

      const healthResult = await this.checkIntegrationHealth(def, credentials);

      return await this.store.update(id, {
        status: healthResult.ok ? 'connected' : 'error',
        lastHealthCheck: new Date(),
        healthError: healthResult.ok ? null : healthResult.error,
      });
    } catch (err: unknown) {
      // Sentry.captureException(err) — handled by consuming app
      // still update the connection status on unexpected errors
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

  // lightweight health check per integration type
  private async checkIntegrationHealth(
    def: IntegrationDefinition,
    credentials: Record<string, string>,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const checks: Record<string, () => Promise<Response>> = {
        stripe: () =>
          fetch('https://api.stripe.com/v1/balance', {
            headers: { Authorization: `Bearer ${credentials.apiKey}` },
          }),
        'google-maps': () =>
          fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway&key=${credentials.apiKey}`,
          ),
        hubspot: () =>
          fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
            headers: { Authorization: `Bearer ${credentials.access_token}` },
          }),
        slack: () =>
          fetch('https://slack.com/api/auth.test', {
            headers: { Authorization: `Bearer ${credentials.access_token}` },
          }),
        twilio: () =>
          fetch(`https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}.json`, {
            headers: {
              Authorization: `Basic ${btoa(`${credentials.accountSid}:${credentials.authToken}`)}`,
            },
          }),
        apollo: () =>
          fetch('https://api.apollo.io/v1/auth/health', {
            headers: { 'x-api-key': credentials.apiKey },
          }),
        clearbit: () =>
          fetch('https://company.clearbit.com/v2/companies/find?domain=clearbit.com', {
            headers: { Authorization: `Bearer ${credentials.apiKey}` },
          }),
        gohighlevel: () =>
          fetch('https://services.leadconnectorhq.com/locations/me', {
            headers: { Authorization: `Bearer ${credentials.access_token}`, Version: '2021-07-28' },
          }),
      };

      const checkFn = checks[def.id];
      if (!checkFn) {
        return { ok: true }; // no health check defined — assume ok
      }

      const response = await checkFn();
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        // Sentry.captureMessage(`Health check failed for ${def.id}`) — handled by consuming app
        return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
      }

      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'health check failed';
      return { ok: false, error: message };
    }
  }
}
