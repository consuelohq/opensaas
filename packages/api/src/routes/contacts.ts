import { Contacts } from '@consuelo/contacts';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';

interface CreateContactBody {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  tags?: string[];
}

interface ImportBody {
  content: string;
}

type Pool = { query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> };

const SQL_INSERT_NOTE =
  'INSERT INTO contact_notes (contact_id, content, call_id, created_by, workspace_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, contact_id, content, call_id, created_by, created_at';

const SQL_INSERT_FOLLOW_UP =
  'INSERT INTO contact_follow_ups (contact_id, scheduled_at, note, call_id, created_by, workspace_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, contact_id, scheduled_at, note, call_id, status, created_by, created_at';

/** /v1/contacts routes wired to @consuelo/contacts */
export const contactRoutes = (): RouteDefinition[] => {
  const contacts = new Contacts();
  let pool: Pool | null = null;

  const getPool = async (): Promise<Pool> => {
    try {
      if (!pool) {
        const { default: pg } = await import('pg');
        pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      }
      return pool;
    } catch (err: unknown) {
      pool = null;
      throw err;
    }
  };

  return [
    {
      method: 'GET',
      path: '/v1/contacts',
      handler: errorHandler(async (req, res) => {
        const userId = req.auth?.userId ?? '';
        const list = await contacts.list(userId);
        res.status(200).json({ contacts: list });
      }),
    },
    {
      method: 'POST',
      path: '/v1/contacts',
      handler: errorHandler(async (req, res) => {
        const body = req.body as CreateContactBody | undefined;
        if (!body?.name) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "name" field' } });
          return;
        }

        const contact = await contacts.create({
          name: body.name,
          phone: body.phone ?? '',
          email: body.email,
          company: body.company,
          tags: body.tags,
          userId: req.auth?.userId,
        });
        res.status(201).json({ contact });
      }),
    },
    {
      method: 'GET',
      path: '/v1/contacts/search',
      handler: errorHandler(async (req, res) => {
        const q = req.query?.q;
        if (!q || !String(q).trim()) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: '"q" parameter is required' } });
          return;
        }
        const query = String(q).trim();
        const userId = req.auth?.userId;
        const results = await contacts.search(query, userId);
        res.status(200).json({ contacts: results });
      }),
    },
    {
      method: 'POST',
      path: '/v1/contacts/import',
      handler: errorHandler(async (req, res) => {
        const body = req.body as ImportBody | undefined;
        if (!body?.content) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "content" field' } });
          return;
        }

        const groqApiKey = process.env.GROQ_API_KEY ?? '';
        const created = await contacts.importDocument(body.content, groqApiKey, req.auth?.userId);
        res.status(200).json({ imported: created.length, contacts: created });
      }),
    },
    {
      method: 'GET',
      path: '/v1/contacts/:id',
      handler: errorHandler(async (req, res) => {
        const id = req.params?.id;
        if (!id) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing contact ID' } });
          return;
        }

        const contact = await contacts.get(id);
        if (!contact) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found' } });
          return;
        }
        res.status(200).json({ contact });
      }),
    },
    {
      method: 'PUT',
      path: '/v1/contacts/:id',
      handler: errorHandler(async (req, res) => {
        const id = req.params?.id;
        if (!id) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing contact ID' } });
          return;
        }

        const body = req.body as Partial<CreateContactBody> | undefined;
        const contact = await contacts.update(id, body ?? {});
        if (!contact) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found' } });
          return;
        }
        res.status(200).json({ contact });
      }),
    },
    {
      method: 'DELETE',
      path: '/v1/contacts/:id',
      handler: errorHandler(async (req, res) => {
        const id = req.params?.id;
        if (!id) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing contact ID' } });
          return;
        }

        const deleted = await contacts.delete(id);
        if (!deleted) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found' } });
          return;
        }
        res.status(200).json({ deleted: true });
      }),
    },
    {
      method: 'POST',
      path: '/v1/contacts/:id/notes',
      handler: errorHandler(async (req, res) => {
        const contactId = req.params?.id;
        if (!contactId) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing contact ID' } });
          return;
        }

        const contact = await contacts.get(contactId);
        if (!contact) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found' } });
          return;
        }

        const body = req.body as { content?: string; callId?: string } | undefined;
        if (!body?.content) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "content" field' } });
          return;
        }

        const db = await getPool();
        const { rows } = await db.query(SQL_INSERT_NOTE, [
          contactId, body.content, body.callId ?? null, req.auth?.userId ?? '', req.auth?.workspaceId ?? '',
        ]);
        res.status(201).json(rows[0]);
      }),
    },
    {
      method: 'POST',
      path: '/v1/contacts/:id/follow-ups',
      handler: errorHandler(async (req, res) => {
        const contactId = req.params?.id;
        if (!contactId) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing contact ID' } });
          return;
        }

        const contact = await contacts.get(contactId);
        if (!contact) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found' } });
          return;
        }

        const body = req.body as { scheduledAt?: string; note?: string; callId?: string } | undefined;
        if (!body?.scheduledAt) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "scheduledAt" field' } });
          return;
        }

        const db = await getPool();
        const { rows } = await db.query(SQL_INSERT_FOLLOW_UP, [
          contactId, body.scheduledAt, body.note ?? null, body.callId ?? null, req.auth?.userId ?? '', req.auth?.workspaceId ?? '',
        ]);
        res.status(201).json(rows[0]);
      }),
    },
  ];
};
