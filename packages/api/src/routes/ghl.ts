import * as Sentry from '@sentry/node';
import * as crypto from 'node:crypto';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';
import { GHLAuthService, type GHLOAuthConfig } from '../services/ghl-auth.js';
import { GHLWebhookHandler, verifyWebhookSignature, type GHLWebhookPayload, type GHLSyncServiceInterface } from '../services/ghl-webhook.js';

type Pool = {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
};

// in-memory PKCE verifier store (keyed by state param)
// in production, use redis with short TTL — DEV-779
const pendingVerifiers = new Map<string, { codeVerifier: string; workspaceId: string; createdAt: number }>();

// clean up stale verifiers older than 10 minutes
const cleanStaleVerifiers = (): void => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, val] of pendingVerifiers) {
    if (val.createdAt < cutoff) pendingVerifiers.delete(key);
  }
};

const loadConfig = (): GHLOAuthConfig => ({
  clientId: process.env.GHL_CLIENT_ID ?? '',
  clientSecret: process.env.GHL_CLIENT_SECRET ?? '',
  redirectUri: process.env.GHL_REDIRECT_URI ?? '',
  scopes: (process.env.GHL_SCOPES ?? 'contacts.readonly contacts.write opportunities.readonly').split(' '),
});

/** /v1/integrations/ghl routes — OAuth + connection management */
export const ghlRoutes = (): RouteDefinition[] => {
  let pool: Pool | null = null;
  let authService: GHLAuthService | null = null;
  let webhookHandler: GHLWebhookHandler | null = null;

  const getPool = async (): Promise<Pool> => {
    try {
      if (pool === null) {
        const { default: pg } = await import('pg');
        pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      }
      return pool;
    } catch (err: unknown) {
      pool = null;
      throw err;
    }
  };

  const getAuthService = async (): Promise<GHLAuthService> => {
    try {
      if (authService === null) {
        const db = await getPool();
        authService = new GHLAuthService(loadConfig(), db);
      }
      return authService;
    } catch (err: unknown) {
      authService = null;
      throw err;
    }
  };

  const requireAuth = (
    req: Parameters<RouteDefinition['handler']>[0],
    res: Parameters<RouteDefinition['handler']>[1],
  ): { userId: string; workspaceId: string } | null => {
    const userId = req.auth?.userId;
    const workspaceId = req.auth?.workspaceId;
    if (userId === undefined || workspaceId === undefined) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'authentication required' } });
      return null;
    }
    return { userId, workspaceId };
  };

  // stub sync service — replaced by real implementation in DEV-782
  const stubSyncService: GHLSyncServiceInterface = {
    findMapping: async () => null,
    createTwentyPerson: async () => ({ id: '' }),
    updateTwentyPerson: async () => { /* noop */ },
    createSyncMapping: async () => { /* noop */ },
    updateSyncMapping: async () => { /* noop */ },
    mapGhlContactToTwenty: () => ({}),
    handleOpportunitySync: async () => { /* noop */ },
  };

  const getWebhookHandler = async (): Promise<GHLWebhookHandler> => {
    try {
      if (webhookHandler === null) {
        const db = await getPool();
        webhookHandler = new GHLWebhookHandler(stubSyncService, db);
      }
      return webhookHandler;
    } catch (err: unknown) {
      webhookHandler = null;
      throw err;
    }
  };

  return [
    // GET /v1/integrations/ghl/auth — start OAuth flow
    {
      method: 'GET',
      path: '/v1/integrations/ghl/auth',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const config = loadConfig();
        if (!config.clientId || !config.clientSecret) {
          res.status(503).json({ error: { code: 'GHL_NOT_CONFIGURED', message: 'GHL integration not configured' } });
          return;
        }

        const service = await getAuthService();
        const state = crypto.randomBytes(16).toString('hex');
        const { url, codeVerifier } = service.getAuthUrl(state);

        cleanStaleVerifiers();
        pendingVerifiers.set(state, { codeVerifier, workspaceId: auth.workspaceId, createdAt: Date.now() });

        res.status(200).json({ url, state });
      }),
    },

    // GET /v1/integrations/ghl/callback — handle OAuth callback
    {
      method: 'GET',
      path: '/v1/integrations/ghl/callback',
      handler: errorHandler(async (req, res) => {
        const code = req.query?.code;
        const state = req.query?.state;
        const error = req.query?.error;

        if (error) {
          res.status(400).json({ error: { code: 'GHL_AUTH_DENIED', message: `GHL authorization denied: ${error}` } });
          return;
        }

        if (!code || !state) {
          res.status(400).json({ error: { code: 'INVALID_CALLBACK', message: 'missing code or state parameter' } });
          return;
        }

        const pending = pendingVerifiers.get(state);
        if (!pending) {
          res.status(400).json({ error: { code: 'INVALID_STATE', message: 'invalid or expired state parameter' } });
          return;
        }

        pendingVerifiers.delete(state);

        const service = await getAuthService();
        const tokens = await service.handleCallback(code, pending.codeVerifier);
        await service.storeTokens(pending.workspaceId, tokens);

        res.status(200).json({ connected: true, locationId: tokens.locationId });
      }),
    },

    // GET /v1/integrations/ghl/status — connection status
    {
      method: 'GET',
      path: '/v1/integrations/ghl/status',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const service = await getAuthService();
        const status = await service.getStatus(auth.workspaceId);
        res.status(200).json(status);
      }),
    },

    // DELETE /v1/integrations/ghl/connection — disconnect
    {
      method: 'DELETE',
      path: '/v1/integrations/ghl/connection',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const service = await getAuthService();
        await service.disconnect(auth.workspaceId);
        Sentry.captureMessage('GHL disconnected', { extra: { workspaceId: auth.workspaceId } });
        res.status(200).json({ disconnected: true });
      }),
    },

    // POST /v1/webhooks/ghl — receive GHL webhook events
    {
      method: 'POST',
      path: '/v1/webhooks/ghl',
      handler: errorHandler(async (req, res) => {
        const webhookSecret = process.env.GHL_WEBHOOK_SECRET;
        if (webhookSecret) {
          const signature = req.headers['x-ghl-signature'];
          const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
          if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
            res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'webhook signature verification failed' } });
            return;
          }
        }

        const payload = req.body as GHLWebhookPayload;
        if (!payload.type || !payload.locationId) {
          res.status(400).json({ error: { code: 'INVALID_PAYLOAD', message: 'missing type or locationId' } });
          return;
        }

        const handler = await getWebhookHandler();
        await handler.handleWebhook(payload);
        res.status(200).json({ received: true });
      }),
    },
  ];
};
