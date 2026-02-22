import * as Sentry from '@sentry/node';
import * as crypto from 'node:crypto';
import { errorHandler } from '../../middleware/error-handler.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import type { RouteDefinition } from '../index.js';
import { getSharedPool } from '../../shared/db.js';
import {
  GHLAuthService,
  type GHLOAuthConfig,
} from '../../services/ghl-auth.js';
import { GHLClient } from '../../services/ghl-client.js';
import {
  GHLPipelineSync,
  type PipelineMappingInput,
} from '../../services/ghl-pipeline.js';
import { createLogger } from '@consuelo/logger';
const logger = createLogger('api:audit');

type Pool = {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
};

const getPool = getSharedPool;

// in-memory PKCE verifier store (keyed by state param)
// in production, use redis with short TTL — DEV-779
const pendingVerifiers = new Map<
  string,
  { codeVerifier: string; workspaceId: string; createdAt: number }
>();

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
  scopes: (
    process.env.GHL_SCOPES ??
    'contacts.readonly contacts.write opportunities.readonly'
  ).split(' '),
});

/** /v1/integrations/ghl routes — OAuth + connection management */
export const ghlIntegrationRoutes = (): RouteDefinition[] => {
  let authService: GHLAuthService | null = null;

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
          res.status(503).json({
            error: {
              code: 'GHL_NOT_CONFIGURED',
              message: 'GHL integration not configured',
            },
          });
          return;
        }

        const service = await getAuthService();
        const state = crypto.randomBytes(16).toString('hex');
        const { url, codeVerifier } = service.getAuthUrl(state);

        cleanStaleVerifiers();
        pendingVerifiers.set(state, {
          codeVerifier,
          workspaceId: auth.workspaceId,
          createdAt: Date.now(),
        });

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
          res.status(400).json({
            error: {
              code: 'GHL_AUTH_DENIED',
              message: `GHL authorization denied: ${error}`,
            },
          });
          return;
        }

        if (!code || !state) {
          res.status(400).json({
            error: {
              code: 'INVALID_CALLBACK',
              message: 'Missing code or state parameter',
            },
          });
          return;
        }

        const pending = pendingVerifiers.get(state);
        if (!pending) {
          res.status(400).json({
            error: {
              code: 'INVALID_STATE',
              message: 'Invalid or expired state parameter',
            },
          });
          return;
        }

        pendingVerifiers.delete(state);

        const service = await getAuthService();
        const tokens = await service.handleCallback(code, pending.codeVerifier);
        await service.storeTokens(pending.workspaceId, tokens);

        res
          .status(200)
          .json({ connected: true, locationId: tokens.locationId });
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
        Sentry.captureMessage('GHL disconnected', {
          extra: { workspaceId: auth.workspaceId },
        });
        res.status(200).json({ disconnected: true });
        logger.info('ghl.disconnected', {
          action: 'ghl.disconnected',
          userId: auth.userId ?? 'anonymous',
          outcome: 'success',
        });
      }),
    },

    // GET /v1/integrations/ghl/pipelines — list GHL pipelines with stages and mappings
    {
      method: 'GET',
      path: '/v1/integrations/ghl/pipelines',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const service = await getAuthService();
        const status = await service.getStatus(auth.workspaceId);
        if (!status.connected || !status.locationId) {
          res.status(400).json({
            error: {
              code: 'GHL_NOT_CONNECTED',
              message: 'GHL integration not connected',
            },
          });
          return;
        }

        const client = new GHLClient(
          () => service.getValidToken(auth.workspaceId),
          status.locationId,
        );
        const db = await getPool();
        const pipelineSync = new GHLPipelineSync(client, db);
        const pipelines = await pipelineSync.getPipelines(auth.workspaceId);
        const mappings = await pipelineSync.getMappings(auth.workspaceId);

        res.status(200).json({ pipelines, mappings });
      }),
    },

    // PUT /v1/integrations/ghl/pipelines/mappings — update stage mappings
    {
      method: 'PUT',
      path: '/v1/integrations/ghl/pipelines/mappings',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const { mappings } = req.body as { mappings: PipelineMappingInput[] };
        if (!Array.isArray(mappings)) {
          res.status(400).json({
            error: {
              code: 'INVALID_PAYLOAD',
              message: 'mappings must be an array',
            },
          });
          return;
        }

        // Validate each mapping has required fields
        for (const mapping of mappings) {
          if (
            !mapping.ghlPipelineId ||
            !mapping.ghlStageId ||
            !mapping.twentyPipelineId ||
            !mapping.twentyStageId
          ) {
            res.status(400).json({
              error: {
                code: 'INVALID_PAYLOAD',
                message:
                  'each mapping must have ghlPipelineId, ghlStageId, twentyPipelineId, and twentyStageId',
              },
            });
            return;
          }
        }

        const service = await getAuthService();
        const status = await service.getStatus(auth.workspaceId);
        if (!status.connected || !status.locationId) {
          res.status(400).json({
            error: {
              code: 'GHL_NOT_CONNECTED',
              message: 'GHL integration not connected',
            },
          });
          return;
        }

        const client = new GHLClient(
          () => service.getValidToken(auth.workspaceId),
          status.locationId,
        );
        const db = await getPool();
        const pipelineSync = new GHLPipelineSync(client, db);
        await pipelineSync.updateMappings(auth.workspaceId, mappings);

        res.status(200).json({ updated: true, count: mappings.length });
        logger.info('ghl.mappings_updated', {
          action: 'mappings.updated',
          userId: auth.userId ?? 'anonymous',
          outcome: 'success',
        });
      }),
    },

    // POST /v1/integrations/ghl/pipelines/sync — sync opportunities with conflict detection
    {
      method: 'POST',
      path: '/v1/integrations/ghl/pipelines/sync',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const { checkConflicts } = req.body as { checkConflicts?: boolean };

        const service = await getAuthService();
        const status = await service.getStatus(auth.workspaceId);
        if (!status.connected || !status.locationId) {
          res.status(400).json({
            error: {
              code: 'GHL_NOT_CONNECTED',
              message: 'GHL integration not connected',
            },
          });
          return;
        }

        const client = new GHLClient(
          () => service.getValidToken(auth.workspaceId),
          status.locationId,
        );
        const db = await getPool();
        const pipelineSync = new GHLPipelineSync(client, db);

        // Check for conflicts if requested
        let conflicts = null;
        if (checkConflicts) {
          conflicts = await pipelineSync.detectConflicts(auth.workspaceId);
        }

        // Sync opportunities
        const result = await pipelineSync.syncOpportunities(auth.workspaceId);

        res.status(200).json({
          ...result,
          conflicts,
        });
        logger.info('ghl.pipelines_synced', {
          action: 'pipelines.synced',
          userId: auth.userId ?? 'anonymous',
          outcome: 'success',
        });
      }),
    },
  ];
};
