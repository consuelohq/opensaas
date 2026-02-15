import * as Sentry from '@sentry/node';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';

type Pool = {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
};

const VALID_ROLES = ['owner', 'admin', 'member'] as const;

const SQL_GET =
  'SELECT id, name, slug, branding, billing_config, created_at, updated_at FROM workspace_settings WHERE workspace_id = $1';

const SQL_UPSERT =
  'INSERT INTO workspace_settings (workspace_id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (workspace_id) DO UPDATE SET name = COALESCE($2, workspace_settings.name), slug = COALESCE($3, workspace_settings.slug), updated_at = NOW() RETURNING *';

const SQL_BRANDING =
  'INSERT INTO workspace_settings (workspace_id, branding) VALUES ($1, $2) ON CONFLICT (workspace_id) DO UPDATE SET branding = $2, updated_at = NOW() RETURNING branding';

// B4: LEFT JOIN so pending invites (no user_id yet) still appear; COALESCE falls back to wm.email
const SQL_MEMBERS =
  'SELECT wm.id, wm.user_id, COALESCE(u.email, wm.email) AS email, u.first_name, u.last_name, wm.role, wm.status, wm.created_at, wm.last_active_at FROM workspace_members wm LEFT JOIN users u ON u.id = wm.user_id WHERE wm.workspace_id = $1 ORDER BY wm.created_at';

const SQL_INVITE =
  'INSERT INTO workspace_members (workspace_id, email, role, status) VALUES ($1, $2, $3, $4) RETURNING *';

const SQL_UPDATE_ROLE =
  'UPDATE workspace_members SET role = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING *';

const SQL_REMOVE_MEMBER =
  'DELETE FROM workspace_members WHERE id = $1 AND workspace_id = $2 AND role != $3 RETURNING id';

// B1: RBAC — look up caller's role for authorization checks
const SQL_CALLER_ROLE =
  'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2';

const SQL_MEMBER_ROLE =
  'SELECT role FROM workspace_members WHERE id = $1 AND workspace_id = $2';

export const workspaceRoutes = (): RouteDefinition[] => {
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

  const requireAuth = (
    req: Parameters<RouteDefinition['handler']>[0],
    res: Parameters<RouteDefinition['handler']>[1],
  ): { userId: string; workspaceId: string } | null => {
    const userId = req.auth?.userId;
    const workspaceId = req.auth?.workspaceId;
    if (userId === undefined || workspaceId === undefined) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return null;
    }
    return { userId, workspaceId };
  };

  // B1: returns caller's role if it's in the allowed list, or null (with 403 sent)
  const requireRole = async (
    db: Pool,
    auth: { userId: string; workspaceId: string },
    res: Parameters<RouteDefinition['handler']>[1],
    allowed: readonly string[],
  ): Promise<string | null> => {
    const { rows } = await db.query(SQL_CALLER_ROLE, [auth.workspaceId, auth.userId]);
    if (rows.length === 0) {
      Sentry.captureMessage('Non-member attempted workspace action', 'warning');
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not a workspace member' } });
      return null;
    }
    const role = rows[0].role as string;
    if (!allowed.includes(role)) {
      Sentry.captureMessage('Insufficient role for workspace action', 'warning');
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
      return null;
    }
    return role;
  };

  return [
    // GET /v1/workspaces/current
    {
      method: 'GET',
      path: '/v1/workspaces/current',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const db = await getPool();
        const { rows } = await db.query(SQL_GET, [auth.workspaceId]);

        if (rows.length === 0) {
          res.status(200).json({ id: auth.workspaceId, name: '', slug: '', branding: {}, team: [], billing: {}, limits: {} });
          return;
        }

        const ws = rows[0];
        const { rows: members } = await db.query(SQL_MEMBERS, [auth.workspaceId]);
        const team = members.map((m) => ({
          id: m.id,
          email: m.email,
          name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim(),
          avatarUrl: null,
          role: m.role,
          status: m.status,
          invitedAt: m.created_at,
          lastActiveAt: m.last_active_at,
        }));

        res.status(200).json({
          id: auth.workspaceId,
          name: ws.name,
          slug: ws.slug,
          branding: ws.branding ?? {},
          team,
          billing: ws.billing_config ?? {},
          limits: {},
        });
      }),
    },

    // PATCH /v1/workspaces/:id — owner/admin only
    {
      method: 'PATCH',
      path: '/v1/workspaces/:id',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const db = await getPool();
        if (!(await requireRole(db, auth, res, ['owner', 'admin']))) return;

        const { name, slug } = req.body as { name?: string; slug?: string };
        const { rows } = await db.query(SQL_UPSERT, [
          auth.workspaceId,
          name ?? null,
          slug ?? null,
        ]);

        res.status(200).json(rows[0]);
      }),
    },

    // PUT /v1/workspaces/:id/branding — owner/admin only
    {
      method: 'PUT',
      path: '/v1/workspaces/:id/branding',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const db = await getPool();
        if (!(await requireRole(db, auth, res, ['owner', 'admin']))) return;

        const { rows } = await db.query(SQL_BRANDING, [
          auth.workspaceId,
          JSON.stringify(req.body),
        ]);

        res.status(200).json(rows[0].branding);
      }),
    },

    // POST /v1/workspaces/branding/upload — logo/favicon upload
    {
      method: 'POST',
      path: '/v1/workspaces/branding/upload',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        // STUB: file upload requires multipart handling — DEV-758
        res.status(501).json({
          error: { code: 'NOT_IMPLEMENTED', message: 'File upload not yet implemented' },
        });
      }),
    },

    // POST /v1/workspaces/:id/invites — owner/admin only
    {
      method: 'POST',
      path: '/v1/workspaces/:id/invites',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const db = await getPool();
        if (!(await requireRole(db, auth, res, ['owner', 'admin']))) return;

        const { email, role } = req.body as { email: string; role?: string };
        if (!email) {
          Sentry.captureMessage('Invite missing email', 'warning');
          res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Email is required' } });
          return;
        }

        // B2: validate role if provided
        const targetRole = role ?? 'member';
        if (!VALID_ROLES.includes(targetRole as typeof VALID_ROLES[number])) {
          Sentry.captureMessage(`Invalid invite role: ${targetRole}`, 'warning');
          res.status(400).json({ error: { code: 'BAD_REQUEST', message: `Role must be one of: ${VALID_ROLES.join(', ')}` } });
          return;
        }

        const { rows } = await db.query(SQL_INVITE, [
          auth.workspaceId,
          email,
          targetRole,
          'pending',
        ]);

        res.status(201).json(rows[0]);
      }),
    },

    // PATCH /v1/workspaces/:id/members/:memberId — owner only
    {
      method: 'PATCH',
      path: '/v1/workspaces/:id/members/:memberId',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const db = await getPool();
        // B1: only owner can change roles
        if (!(await requireRole(db, auth, res, ['owner']))) return;

        const { role } = req.body as { role: string };

        // B2: validate role value
        if (!role || !VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
          Sentry.captureMessage(`Invalid role change: ${role}`, 'warning');
          res.status(400).json({ error: { code: 'BAD_REQUEST', message: `Role must be one of: ${VALID_ROLES.join(', ')}` } });
          return;
        }

        const { rows } = await db.query(SQL_UPDATE_ROLE, [
          role,
          req.params?.memberId,
          auth.workspaceId,
        ]);

        if (rows.length === 0) {
          Sentry.captureMessage('Role change target not found', 'warning');
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Member not found' } });
          return;
        }

        res.status(200).json(rows[0]);
      }),
    },

    // DELETE /v1/workspaces/:id/members/:memberId — owner/admin only
    {
      method: 'DELETE',
      path: '/v1/workspaces/:id/members/:memberId',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        const db = await getPool();
        const callerRole = await requireRole(db, auth, res, ['owner', 'admin']);
        if (!callerRole) return;

        // admin can only remove members, not other admins or owners
        if (callerRole === 'admin') {
          const { rows: target } = await db.query(SQL_MEMBER_ROLE, [req.params?.memberId, auth.workspaceId]);
          if (target.length > 0 && target[0].role !== 'member') {
            Sentry.captureMessage('Admin attempted to remove non-member role', 'warning');
            res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admins can only remove members' } });
            return;
          }
        }

        const { rows } = await db.query(SQL_REMOVE_MEMBER, [
          req.params?.memberId,
          auth.workspaceId,
          'owner',
        ]);

        if (rows.length === 0) {
          Sentry.captureMessage('Member removal target not found', 'warning');
          res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Member not found or is owner' },
          });
          return;
        }

        res.status(204).send('');
      }),
    },

    // POST /v1/workspaces/:id/billing/portal
    {
      method: 'POST',
      path: '/v1/workspaces/:id/billing/portal',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (!auth) return;

        // STUB: stripe portal session creation — DEV-758
        res.status(501).json({
          error: { code: 'NOT_IMPLEMENTED', message: 'Stripe billing portal not yet implemented' },
        });
      }),
    },
  ];
};
