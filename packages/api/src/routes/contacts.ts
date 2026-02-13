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

/** /v1/contacts routes wired to @consuelo/contacts */
export function contactRoutes(): RouteDefinition[] {
  const contacts = new Contacts();

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
  ];
}
