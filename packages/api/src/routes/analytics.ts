// eslint-disable-next-line @nx/enforce-module-boundaries
import { Coach, type Message } from '@consuelo/coaching';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';

type Pool = {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

const SQL_METRICS_SUMMARY =
  'SELECT COUNT(*) AS total_calls, COUNT(*) FILTER (WHERE outcome = $2) AS answered_calls, COALESCE(AVG(duration_seconds), 0) AS avg_duration, COUNT(*) FILTER (WHERE start_time >= CURRENT_DATE) AS calls_today, COUNT(*) FILTER (WHERE start_time >= date_trunc($3, CURRENT_DATE)) AS calls_this_week FROM calls WHERE workspace_id = $1 AND start_time >= $4';

const SQL_OUTCOME_DIST =
  'SELECT outcome, COUNT(*) AS count FROM calls WHERE workspace_id = $1 AND start_time >= $2 AND outcome IS NOT NULL GROUP BY outcome';

const SQL_DAILY_COUNTS =
  'SELECT start_time::date AS date, COUNT(*) AS count FROM calls WHERE workspace_id = $1 AND start_time >= $2 GROUP BY start_time::date ORDER BY date';

const SQL_TOP_CONTACTS =
  'SELECT c.contact_id AS id, ct.name, COUNT(*) AS call_count FROM calls c LEFT JOIN contacts ct ON c.contact_id = ct.id WHERE c.workspace_id = $1 AND c.start_time >= $2 AND c.contact_id IS NOT NULL GROUP BY c.contact_id, ct.name ORDER BY call_count DESC LIMIT 10';

const SQL_TRANSCRIPT_BY_SID =
  'SELECT transcript FROM calls WHERE call_sid = $1 AND workspace_id = $2';

const getPeriodStart = (period: string): string => {
  const now = new Date();
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
  // default: week
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.getFullYear(), now.getMonth(), diff).toISOString();
};

/** /v1/analytics routes */
export const analyticsRoutes = (): RouteDefinition[] => {
  const coach = new Coach({ apiKey: process.env.GROQ_API_KEY ?? '' });
  let pool: Pool | null = null;

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

  const requireAuth = (req: Parameters<RouteDefinition['handler']>[0], res: Parameters<RouteDefinition['handler']>[1]): { userId: string; workspaceId: string } | null => {
    const userId = req.auth?.userId;
    const workspaceId = req.auth?.workspaceId;
    if (userId === undefined || workspaceId === undefined) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return null;
    }
    return { userId, workspaceId };
  };

  return [
    // literal routes first
    {
      method: 'GET',
      path: '/v1/analytics/metrics',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const period = req.query?.period ?? 'week';
        const periodStart = getPeriodStart(period);
        const db = await getPool();

        const summary = await db.query(SQL_METRICS_SUMMARY, [
          auth.workspaceId, 'connected', 'week', periodStart,
        ]);
        const outcomes = await db.query(SQL_OUTCOME_DIST, [auth.workspaceId, periodStart]);
        const daily = await db.query(SQL_DAILY_COUNTS, [auth.workspaceId, periodStart]);
        const top = await db.query(SQL_TOP_CONTACTS, [auth.workspaceId, periodStart]);

        const row = summary.rows[0] ?? {};
        const totalCalls = Number(row.total_calls ?? 0);
        const answeredCalls = Number(row.answered_calls ?? 0);

        const outcomeDistribution: Record<string, number> = {};
        for (const r of outcomes.rows) {
          outcomeDistribution[r.outcome as string] = Number(r.count);
        }

        res.status(200).json({
          metrics: {
            totalCalls,
            answeredCalls,
            answerRate: totalCalls > 0 ? answeredCalls / totalCalls : 0,
            avgDuration: Number(row.avg_duration ?? 0),
            callsToday: Number(row.calls_today ?? 0),
            callsThisWeek: Number(row.calls_this_week ?? 0),
            outcomeDistribution,
            dailyCounts: daily.rows.map((r) => ({ date: String(r.date), count: Number(r.count) })),
            topContacts: top.rows.map((r) => ({ id: String(r.id), name: String(r.name ?? ''), callCount: Number(r.call_count) })),
          },
        });
      }),
    },
    {
      method: 'GET',
      path: '/v1/analytics/transcript/:callSid',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const db = await getPool();
        const { rows } = await db.query(SQL_TRANSCRIPT_BY_SID, [req.params?.callSid, auth.workspaceId]);
        if (rows.length === 0) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Call not found' } });
          return;
        }

        const transcript = rows[0].transcript as unknown[] | null;
        if (!transcript) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No transcript available' } });
          return;
        }

        res.status(200).json({ entries: transcript });
      }),
    },
    {
      method: 'POST',
      path: '/v1/analytics/analyze',
      handler: errorHandler(async (req, res) => {
        const body = req.body as { callSid?: string; messages?: Message[] } | undefined;
        if (!body?.messages?.length) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "messages" array' } });
          return;
        }

        try {
          const result = await coach.analyzeCall(body.messages, {
            callSid: body.callSid,
            userId: req.auth?.userId,
          });
          res.status(200).json(result);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          res.status(500).json({ error: { code: 'ANALYSIS_FAILED', message } });
        }
      }),
    },
  ];
};
