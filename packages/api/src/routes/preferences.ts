import * as Sentry from '@sentry/node';
import { errorHandler } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { RouteDefinition } from './index.js';
import { getSharedPool } from '../shared/db.js';

type Pool = {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
};

const getPool = getSharedPool;

const SQL_GET =
  'SELECT preferences FROM user_settings WHERE user_id = $1 AND workspace_id = $2';

const SQL_UPSERT =
  'INSERT INTO user_settings (user_id, workspace_id, preferences) VALUES ($1, $2, $3) ON CONFLICT (user_id, workspace_id) DO UPDATE SET preferences = $3, updated_at = NOW() RETURNING preferences';

/** /v1/settings/preferences routes */
export const preferencesRoutes = (): RouteDefinition[] => {
  };

  return [
    // GET /v1/settings/preferences — fetch user preferences
    {
      method: 'GET',
      path: '/v1/settings/preferences',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const db = await getPool();
        const { rows } = await db.query(SQL_GET, [
          auth.userId,
          auth.workspaceId,
        ]);

        if (rows.length === 0) {
          res.status(200).json({});
          return;
        }

        res.status(200).json(rows[0].preferences);
      }),
    },

    // PUT /v1/settings/preferences — upsert user preferences
    {
      method: 'PUT',
      path: '/v1/settings/preferences',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const body = req.body;
        if (!body || typeof body !== 'object') {
          Sentry.captureMessage(
            'Preferences update with invalid body',
            'warning',
          );
          res.status(400).json({
            error: { code: 'BAD_REQUEST', message: 'Request body required' },
          });
          return;
        }

        const db = await getPool();
        const { rows } = await db.query(SQL_UPSERT, [
          auth.userId,
          auth.workspaceId,
          JSON.stringify(body),
        ]);

        res.status(200).json(rows[0].preferences);
      }),
    },
  ];
};
