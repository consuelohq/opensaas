import * as Sentry from '@sentry/node';
import * as crypto from 'node:crypto';

export interface GHLOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface GHLTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  locationId: string;
}

export interface GHLConnectionStatus {
  connected: boolean;
  locationId?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  syncEnabled?: boolean;
}

type Pool = {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
};

const GHL_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';
const GHL_AUTH_BASE = 'https://marketplace.gohighlevel.com/oauth/chooselocation';

// derive encryption key from APP_SECRET
const deriveKey = (): Buffer => {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error('APP_SECRET required for token encryption');
  return crypto.createHash('sha256').update(`ghl-tokens:${secret}`).digest();
};

const encrypt = (plaintext: string): string => {
  const key = deriveKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

const decrypt = (ciphertext: string): string => {
  const key = deriveKey();
  const [ivHex, encHex] = ciphertext.split(':');
  if (!ivHex || !encHex) throw new Error('invalid encrypted token format');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
};

export class GHLAuthService {
  private static readonly SQL_UPSERT =
    'INSERT INTO ghl_connections (workspace_id, location_id, access_token_encrypted, refresh_token_encrypted, expires_at, scopes)' +
    ' VALUES ($1, $2, $3, $4, $5, $6)' +
    ' ON CONFLICT (workspace_id) DO UPDATE SET' +
    ' access_token_encrypted = $3, refresh_token_encrypted = $4,' +
    ' expires_at = $5, location_id = $2';

  private config: GHLOAuthConfig;
  private db: Pool;

  constructor(config: GHLOAuthConfig, db: Pool) {
    this.config = config;
    this.db = db;
  }

  getAuthUrl(state: string): { url: string; codeVerifier: string } {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return { url: `${GHL_AUTH_BASE}?${params}`, codeVerifier };
  }

  async handleCallback(code: string, codeVerifier: string): Promise<GHLTokens> {
    try {
      const response = await fetch(GHL_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'authorization_code',
          code,
          code_verifier: codeVerifier,
          redirect_uri: this.config.redirectUri,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        Sentry.captureMessage(`GHL OAuth token exchange failed: ${response.status}`, { extra: { body: text } });
        throw new Error(`GHL OAuth failed: ${response.status}`);
      }

      const data = await response.json() as Record<string, unknown>;
      return {
        accessToken: data.access_token as string,
        refreshToken: data.refresh_token as string,
        expiresAt: new Date(Date.now() + (data.expires_in as number) * 1000),
        locationId: data.locationId as string,
      };
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async getValidToken(workspaceId: string): Promise<string> {
    try {
      const { rows } = await this.db.query(
        'SELECT access_token_encrypted, refresh_token_encrypted, expires_at, location_id FROM ghl_connections WHERE workspace_id = $1',
        [workspaceId],
      );

      if (!rows[0]) throw new Error('GHL not connected');

      const { access_token_encrypted, refresh_token_encrypted, expires_at, location_id } = rows[0] as {
        access_token_encrypted: string;
        refresh_token_encrypted: string;
        expires_at: string;
        location_id: string;
      };

      // return current token if still valid (with 60s buffer)
      if (new Date(expires_at) > new Date(Date.now() + 60_000)) {
        return decrypt(access_token_encrypted);
      }

      // refresh the token
      const refreshToken = decrypt(refresh_token_encrypted);
      const response = await fetch(GHL_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        Sentry.captureMessage(`GHL token refresh failed: ${response.status}`);
        throw new Error(`GHL token refresh failed: ${response.status}`);
      }

      const data = await response.json() as Record<string, unknown>;
      const tokens: GHLTokens = {
        accessToken: data.access_token as string,
        refreshToken: data.refresh_token as string,
        expiresAt: new Date(Date.now() + (data.expires_in as number) * 1000),
        locationId: location_id,
      };

      await this.storeTokens(workspaceId, tokens);
      return tokens.accessToken;
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async storeTokens(workspaceId: string, tokens: GHLTokens): Promise<void> {
    try {
      await this.db.query(
        GHLAuthService.SQL_UPSERT,
        [
          workspaceId,
          tokens.locationId,
          encrypt(tokens.accessToken),
          encrypt(tokens.refreshToken),
          tokens.expiresAt,
          this.config.scopes,
        ],
      );
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    try {
      await this.db.query('DELETE FROM ghl_connections WHERE workspace_id = $1', [workspaceId]);
      await this.db.query('DELETE FROM ghl_sync_mappings WHERE workspace_id = $1', [workspaceId]);
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async getStatus(workspaceId: string): Promise<GHLConnectionStatus> {
    try {
      const { rows } = await this.db.query(
        'SELECT location_id, connected_at, last_sync_at, sync_enabled FROM ghl_connections WHERE workspace_id = $1',
        [workspaceId],
      );

      if (!rows[0]) return { connected: false };

      const row = rows[0] as {
        location_id: string;
        connected_at: string;
        last_sync_at: string | null;
        sync_enabled: boolean;
      };

      return {
        connected: true,
        locationId: row.location_id,
        connectedAt: row.connected_at,
        lastSyncAt: row.last_sync_at ?? undefined,
        syncEnabled: row.sync_enabled,
      };
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }
}
