import { errorHandler } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { RouteDefinition } from './index.js';
import { getSharedPool } from '../shared/db.js';
import { selectNextQueueItem } from '../services/queue-selection.js';
type Logger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
};

let logger: Logger | null = null;

const getLogger = async (): Promise<Logger> => {
  try {
    if (!logger) {
      const { createLogger } = await import('@consuelo/logger');
      logger = createLogger('api:audit');
    }
    return logger;
  } catch (err: unknown) {
    logger = null;
    const message = err instanceof Error ? err.message : 'unknown error';
    throw new Error(`[getLogger] failed: ${message}`);
  }
};

const getPool = getSharedPool;

interface CreateQueueBody {
  name: string;
  sourceType?: string;
  sourceId?: string;
  category?: string;
  contactIds: string[];
  settings?: Record<string, unknown>;
}

interface SkipBody {
  reason?: string;
}

interface AssignBody {
  userId: string;
}

// SQL constants
const SQL_INSERT_QUEUE =
  'INSERT INTO call_queues (workspace_id, user_id, name, source_type, source_id, category, settings, total_contacts) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *';

const SQL_GET_QUEUE =
  'SELECT * FROM call_queues WHERE id = $1 AND workspace_id = $2';

const SQL_LIST_QUEUES =
  'SELECT * FROM call_queues WHERE workspace_id = $1 ORDER BY created_at DESC';

const SQL_UPDATE_QUEUE_STATUS =
  'UPDATE call_queues SET status = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING *';

const SQL_UPDATE_QUEUE_STARTED =
  'UPDATE call_queues SET status = $1, started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING *';

const SQL_UPDATE_QUEUE_ASSIGN =
  'UPDATE call_queues SET user_id = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING *';

const SQL_RESTART_ITEMS =
  'UPDATE queue_items SET status = $1, attempts = 0, call_outcome = NULL, skip_reason = NULL WHERE queue_id = $2';

const SQL_INSERT_ITEMS =
  'INSERT INTO queue_items (queue_id, contact_id, position) VALUES ';

const SQL_GET_ITEMS =
  'SELECT * FROM queue_items WHERE queue_id = $1 ORDER BY position ASC';

const SQL_EXISTING_CALLING =
  'SELECT * FROM queue_items WHERE queue_id = $1 AND status = $2 LIMIT 1';

const SQL_UPDATE_ITEM_SKIP =
  'UPDATE queue_items SET status = $1, skip_reason = $2 WHERE id = $3 RETURNING *';

const SQL_UPDATE_ITEM_CALLING =
  'UPDATE queue_items SET status = $1, attempts = attempts + 1, last_attempt_at = NOW() WHERE id = $2 RETURNING *';

const SQL_QUEUE_STATS =
  'SELECT status, call_outcome, call_duration_seconds FROM queue_items WHERE queue_id = $1';

const SQL_INCREMENT_SKIPPED =
  'UPDATE call_queues SET skipped_contacts = skipped_contacts + 1, updated_at = NOW() WHERE id = $1';

const SQL_CONTACT_CALLS =
  'SELECT id, call_outcome, call_duration_seconds, created_at FROM queue_items WHERE contact_id = $1 ORDER BY created_at DESC LIMIT 20';

/** /v1/queues routes + /v1/contacts/:id/dialer */
export const queueRoutes = (): RouteDefinition[] => {
  return [
    // 1. POST /v1/queues — create queue
    {
      method: 'POST',
      path: '/v1/queues',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const body = req.body as CreateQueueBody | undefined;
        if (
          !body?.name ||
          !Array.isArray(body.contactIds) ||
          body.contactIds.length === 0
        ) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message: 'name and contactIds[] required',
            },
          });
          return;
        }

        const db = await getPool();
        const { rows } = await db.query(SQL_INSERT_QUEUE, [
          auth.workspaceId,
          auth.userId,
          body.name,
          body.sourceType ?? 'manual',
          body.sourceId ?? null,
          body.category ?? 'all',
          JSON.stringify(body.settings ?? {}),
          body.contactIds.length,
        ]);

        const queue = rows[0];
        const queueId = queue.id as string;

        // batch insert items
        const values: unknown[] = [];
        const placeholders: string[] = [];
        for (let i = 0; i < body.contactIds.length; i++) {
          const offset = i * 3;
          placeholders.push(`(${offset + 1}, ${offset + 2}, ${offset + 3})`);
          values.push(queueId, body.contactIds[i], i + 1);
        }
        await db.query(SQL_INSERT_ITEMS + placeholders.join(', '), values);

        res.status(201).json(queue);
        (await getLogger()).info('queue.created', {
          action: 'queue.created',
          userId: auth.userId ?? 'anonymous',
          outcome: 'success',
        });
      }),
    },

    // 2. GET /v1/queues — list all queues (MUST be before :id route)
    {
      method: 'GET',
      path: '/v1/queues',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const db = await getPool();
        const { rows } = await db.query(SQL_LIST_QUEUES, [auth.workspaceId]);
        res.status(200).json(rows);
      }),
    },

    // 3. GET /v1/queues/:id — get queue with items
    {
      method: 'GET',
      path: '/v1/queues/:id',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const db = await getPool();
        const { rows } = await db.query(SQL_GET_QUEUE, [
          req.params?.id,
          auth.workspaceId,
        ]);
        if (rows.length === 0) {
          res
            .status(404)
            .json({ error: { code: 'NOT_FOUND', message: 'Queue not found' } });
          return;
        }

        const items = await db.query(SQL_GET_ITEMS, [req.params?.id]);
        res.status(200).json({ ...rows[0], items: items.rows });
      }),
    },

    // 3. POST /v1/queues/:id/start
    {
      method: 'POST',
      path: '/v1/queues/:id/start',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const pool = await getPool();
        const client = await pool.connect();
        let currentItem = null;
        
        try {
          await client.query('BEGIN');
          
          const { rows } = await client.query(SQL_UPDATE_QUEUE_STARTED, [
            'active',
            req.params?.id,
            auth.workspaceId,
          ]);
          if (rows.length === 0) {
            await client.query('ROLLBACK');
            res
              .status(404)
              .json({ error: { code: 'NOT_FOUND', message: 'Queue not found' } });
            return;
          }

          // Check for existing calling item first
          const existing = await client.query(SQL_EXISTING_CALLING, [
            req.params?.id,
            'calling',
          ]);
          
          if (existing.rows.length > 0) {
            currentItem = existing.rows[0];
          } else {
            const next = await selectNextQueueItem(client, req.params?.id ?? '');
            if (next !== null) {
              const callingResult = await client.query(SQL_UPDATE_ITEM_CALLING, [
                'calling',
                next.id,
              ]);
              currentItem = callingResult.rows[0] ?? next;
            }
          }

          await client.query('COMMIT');
          res.status(200).json({ ...rows[0], currentItem });
          (await getLogger()).info('queue.started', {
            action: 'queue.started',
            userId: auth.userId ?? 'anonymous',
            outcome: 'success',
          });
        } catch (err: unknown) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      }),
    },

    // 4. POST /v1/queues/:id/pause
    {
      method: 'POST',
      path: '/v1/queues/:id/pause',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const db = await getPool();
        const { rows } = await db.query(SQL_UPDATE_QUEUE_STATUS, [
          'paused',
          req.params?.id,
          auth.workspaceId,
        ]);
        if (rows.length === 0) {
          res
            .status(404)
            .json({ error: { code: 'NOT_FOUND', message: 'Queue not found' } });
          return;
        }

        res.status(200).json(rows[0]);
      }),
    },

    // 5. POST /v1/queues/:id/resume
    {
      method: 'POST',
      path: '/v1/queues/:id/resume',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const pool = await getPool();
        const client = await pool.connect();
        let currentItem = null;
        
        try {
          await client.query('BEGIN');
          
          const { rows } = await client.query(SQL_UPDATE_QUEUE_STARTED, [
            'active',
            req.params?.id,
            auth.workspaceId,
          ]);
          if (rows.length === 0) {
            await client.query('ROLLBACK');
            res
              .status(404)
              .json({ error: { code: 'NOT_FOUND', message: 'Queue not found' } });
            return;
          }

          // Check for existing calling item first
          const existing = await client.query(SQL_EXISTING_CALLING, [
            req.params?.id,
            'calling',
          ]);
          
          if (existing.rows.length > 0) {
            currentItem = existing.rows[0];
          } else {
            const next = await selectNextQueueItem(client, req.params?.id ?? '');
            if (next !== null) {
              const callingResult = await client.query(SQL_UPDATE_ITEM_CALLING, [
                'calling',
                next.id,
              ]);
              currentItem = callingResult.rows[0] ?? next;
            }
          }

          await client.query('COMMIT');
          res.status(200).json({ ...rows[0], currentItem });
          (await getLogger()).info('queue.resumed', {
            action: 'queue.resumed',
            userId: auth.userId ?? 'anonymous',
            outcome: 'success',
          });
        } catch (err: unknown) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      }),
    },

    // 6. POST /v1/queues/:id/skip
    {
      method: 'POST',
      path: '/v1/queues/:id/skip',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const pool = await getPool();
        const client = await pool.connect();

        try {
          await client.query('BEGIN');

          const check = await client.query(SQL_GET_QUEUE, [
            req.params?.id,
            auth.workspaceId,
          ]);
          if (check.rows.length === 0) {
            await client.query('ROLLBACK');
            res
              .status(404)
              .json({ error: { code: 'NOT_FOUND', message: 'Queue not found' } });
            return;
          }

          const body = req.body as SkipBody | undefined;
          const current = await client.query(
            'SELECT * FROM queue_items WHERE queue_id = $1 AND status = $2 LIMIT 1 FOR UPDATE SKIP LOCKED',
            [req.params?.id, 'calling'],
          );

          if (current.rows.length > 0) {
            await client.query(SQL_UPDATE_ITEM_SKIP, [
              'skipped',
              body?.reason ?? null,
              current.rows[0].id,
            ]);
            await client.query(SQL_INCREMENT_SKIPPED, [req.params?.id]);
          }

          const next = await selectNextQueueItem(client, req.params?.id ?? '');
          let nextItem: Record<string, unknown> | null = null;
          if (next !== null) {
            const callingResult = await client.query(SQL_UPDATE_ITEM_CALLING, [
              'calling',
              next.id,
            ]);
            nextItem = (callingResult.rows[0] ?? next) as Record<
              string,
              unknown
            >;
          }

          await client.query('COMMIT');
          res.status(200).json({ skipped: true, nextItem });
        } catch (err: unknown) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
        (await getLogger()).info('queue.skipped', {
          action: 'queue.skipped',
          userId: auth.userId ?? 'anonymous',
          outcome: 'success',
        });
      }),
    },

    // 7. POST /v1/queues/:id/next
    {
      method: 'POST',
      path: '/v1/queues/:id/next',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const pool = await getPool();
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const check = await client.query(SQL_GET_QUEUE, [
            req.params?.id,
            auth.workspaceId,
          ]);
          if (check.rows.length === 0) {
            await client.query('ROLLBACK');
            res
              .status(404)
              .json({ error: { code: 'NOT_FOUND', message: 'Queue not found' } });
            return;
          }

          const completedResult = await client.query(
            'UPDATE queue_items SET status = $1 WHERE queue_id = $2 AND status = $3 RETURNING id',
            ['completed', req.params?.id, 'calling'],
          );
          if (completedResult.rows.length > 0) {
            await client.query(
              'UPDATE call_queues SET completed_contacts = completed_contacts + 1, updated_at = NOW() WHERE id = $1',
              [req.params?.id],
            );
          }

          const next = await selectNextQueueItem(client, req.params?.id ?? '');
          if (next !== null) {
            const callingResult = await client.query(SQL_UPDATE_ITEM_CALLING, [
              'calling',
              next.id,
            ]);
            await client.query('COMMIT');
            res.status(200).json({ nextItem: callingResult.rows[0] ?? next });
          } else {
            await client.query(SQL_UPDATE_QUEUE_STATUS, [
              'completed',
              req.params?.id,
              auth.workspaceId,
            ]);
            await client.query('COMMIT');
            res.status(200).json({ nextItem: null, queueCompleted: true });
          }
        } catch (err: unknown) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
        (await getLogger()).info('queue.next', {
          action: 'queue.next',
          userId: auth.userId ?? 'anonymous',
          outcome: 'success',
        });
      }),
    },

    // 8. POST /v1/queues/:id/restart
    {
      method: 'POST',
      path: '/v1/queues/:id/restart',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const db = await getPool();
        const { rows } = await db.query(SQL_GET_QUEUE, [
          req.params?.id,
          auth.workspaceId,
        ]);
        if (rows.length === 0) {
          res
            .status(404)
            .json({ error: { code: 'NOT_FOUND', message: 'Queue not found' } });
          return;
        }

        await db.query(SQL_RESTART_ITEMS, ['pending', req.params?.id]);
        await db.query(
          'UPDATE call_queues SET status = $1, completed_contacts = 0, skipped_contacts = 0, started_at = NULL, completed_at = NULL, updated_at = NOW() WHERE id = $2',
          ['idle', req.params?.id],
        );

        res.status(200).json({ restarted: true });
        (await getLogger()).info('queue.restarted', {
          action: 'queue.restarted',
          userId: auth.userId ?? 'anonymous',
          outcome: 'success',
        });
      }),
    },

    // 9. POST /v1/queues/:id/assign
    {
      method: 'POST',
      path: '/v1/queues/:id/assign',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const body = req.body as AssignBody | undefined;
        if (!body?.userId) {
          res.status(400).json({
            error: { code: 'INVALID_REQUEST', message: 'userId required' },
          });
          return;
        }

        const db = await getPool();
        const { rows } = await db.query(SQL_UPDATE_QUEUE_ASSIGN, [
          body.userId,
          req.params?.id,
          auth.workspaceId,
        ]);
        if (rows.length === 0) {
          res
            .status(404)
            .json({ error: { code: 'NOT_FOUND', message: 'Queue not found' } });
          return;
        }

        res.status(200).json(rows[0]);
      }),
    },

    // 10. GET /v1/queues/:id/analytics
    {
      method: 'GET',
      path: '/v1/queues/:id/analytics',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const db = await getPool();
        const check = await db.query(SQL_GET_QUEUE, [
          req.params?.id,
          auth.workspaceId,
        ]);
        if (check.rows.length === 0) {
          res
            .status(404)
            .json({ error: { code: 'NOT_FOUND', message: 'Queue not found' } });
          return;
        }

        const { rows } = await db.query(SQL_QUEUE_STATS, [req.params?.id]);

        let totalCalls = 0;
        let answeredCount = 0;
        let totalDuration = 0;
        const outcomeBreakdown: Record<string, number> = {};

        for (const row of rows) {
          if (row.status === 'completed' || row.status === 'skipped') {
            totalCalls++;
          }
          const outcome = row.call_outcome as string | null;
          if (outcome !== null) {
            outcomeBreakdown[outcome] = (outcomeBreakdown[outcome] ?? 0) + 1;
            if (outcome === 'connected') answeredCount++;
          }
          const dur = row.call_duration_seconds as number | null;
          if (dur !== null) totalDuration += dur;
        }

        const queue = check.rows[0];
        const startedAt = queue.started_at as string | null;
        let callsPerHour = 0;
        if (startedAt !== null && totalCalls > 0) {
          const hoursElapsed =
            (Date.now() - new Date(startedAt).getTime()) / 3_600_000;
          callsPerHour =
            hoursElapsed > 0
              ? Math.round(totalCalls / hoursElapsed)
              : totalCalls;
        }

        res.status(200).json({
          totalCalls,
          answeredCount,
          answerRatePercentage:
            totalCalls > 0 ? Math.round((answeredCount / totalCalls) * 100) : 0,
          avgCallDurationSeconds:
            totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
          callsPerHour,
          outcomeBreakdown,
        });
      }),
    },

    // 11. GET /v1/queues/:id/export
    {
      method: 'GET',
      path: '/v1/queues/:id/export',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const db = await getPool();
        const check = await db.query(SQL_GET_QUEUE, [
          req.params?.id,
          auth.workspaceId,
        ]);
        if (check.rows.length === 0) {
          res
            .status(404)
            .json({ error: { code: 'NOT_FOUND', message: 'Queue not found' } });
          return;
        }

        const { rows } = await db.query(SQL_GET_ITEMS, [req.params?.id]);

        const header =
          'position,contact_id,status,outcome,duration_seconds,skip_reason,attempted_at';
        const lines = rows.map((r) => {
          const fields = [
            r.position,
            r.contact_id,
            r.status,
            r.call_outcome ?? '',
            r.call_duration_seconds ?? '',
            r.skip_reason ?? '',
            r.last_attempt_at ?? '',
          ];
          return fields
            .map((f) =>
              String(f).includes(',') ? `"${String(f)}"` : String(f),
            )
            .join(',');
        });

        res.type('text/csv').send([header, ...lines].join('\n'));
      }),
    },

    // 12. GET /v1/contacts/:id/dialer — contact with dialer-specific fields
    {
      method: 'GET',
      path: '/v1/contacts/:id/dialer',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const db = await getPool();
        const contactId = req.params?.id;

        const calls = await db.query(SQL_CONTACT_CALLS, [contactId]);

        const totalCalls = calls.rows.length;
        let lastOutcome: string | null = null;
        let lastCalledAt: string | null = null;
        if (totalCalls > 0) {
          lastOutcome = calls.rows[0].call_outcome as string | null;
          lastCalledAt = calls.rows[0].created_at as string | null;
        }

        res.status(200).json({
          contactId,
          totalCalls,
          lastOutcome,
          lastCalledAt,
          callHistory: calls.rows,
        });
      }),
    },
  ];
};
