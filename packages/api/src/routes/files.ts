import { StorageService } from '../services/storage.js';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';
import type { Pool } from 'pg';

// Allowed MIME types (from Python's allowed_file())
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'text/csv',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/gif',
  'audio/mpeg',
  'audio/wav',
  'video/mp4',
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB (from Python's MAX_FILE_SIZE)

const VALID_ENTITY_TYPES = new Set(['contact', 'call', 'company', 'deal']);

interface CreateFileBody {
  name: string;
  mimeType: string;
  size: number;
  storageKey: string;
  folder?: string;
  tags?: string[];
}

// -- SQL constants (parameterized, never template literals) ------------------

const SQL_CREATE_FILE =
  'INSERT INTO files (workspace_id, name, mime_type, size, storage_key, folder, tags, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *';

const SQL_LIST_FILES =
  'SELECT * FROM files WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3';

const SQL_LIST_FILES_BY_TYPE =
  'SELECT * FROM files WHERE workspace_id = $1 AND mime_type LIKE $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4';

const SQL_SEARCH_FILES =
  'SELECT * FROM files WHERE workspace_id = $1 AND name ILIKE $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4';

const SQL_GET_FILE =
  'SELECT * FROM files WHERE id = $1 AND workspace_id = $2';

const SQL_DELETE_FILE =
  'DELETE FROM files WHERE id = $1 AND workspace_id = $2 RETURNING storage_key';

const SQL_ATTACH_FILE =
  'INSERT INTO file_attachments (file_id, entity_type, entity_id) SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM files WHERE id = $1 AND workspace_id = $4) ON CONFLICT (file_id, entity_type, entity_id) DO NOTHING RETURNING *';

const SQL_DETACH_FILE =
  'DELETE FROM file_attachments WHERE id = $1 AND file_id IN (SELECT id FROM files WHERE workspace_id = $2) RETURNING id';

const SQL_LIST_ATTACHMENTS =
  'SELECT f.id, f.name, f.mime_type, f.size, f.storage_key, f.folder, f.tags, f.created_at, f.updated_at, fa.id AS attachment_id, fa.created_at AS attached_at FROM files f JOIN file_attachments fa ON f.id = fa.file_id WHERE fa.entity_type = $1 AND fa.entity_id = $2 AND f.workspace_id = $3 ORDER BY fa.created_at DESC';

/** /v1/files routes — file storage with presigned S3 URLs + attachments */
export const fileRoutes = (): RouteDefinition[] => {
  const storage = new StorageService();
  let pool: Pool | null = null;

  const getPool = async (): Promise<Pool> => {
    try {
      if (!pool) {
        const { default: pg } = await import('pg');
        pool = new pg.Pool({ connectionString: process.env.FILES_DATABASE_URL ?? process.env.DATABASE_URL });
      }
      return pool;
    } catch (err: unknown) {
      pool = null;
      throw err;
    }
  };

  return [
    // literal routes before param routes (ROUTE_ORDER rule)
    {
      method: 'POST',
      path: '/v1/files/upload-url',
      handler: errorHandler(async (req, res) => {
        const body = req.body as { name?: string; mimeType?: string; size?: number; folder?: string } | undefined;
        if (!body?.name || !body?.mimeType) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "name" or "mimeType"' } });
          return;
        }

        if (!ALLOWED_TYPES.has(body.mimeType)) {
          res.status(400).json({ error: { code: 'INVALID_FILE_TYPE', message: 'Unsupported file type' } });
          return;
        }

        if (body.size && body.size > MAX_FILE_SIZE) {
          res.status(400).json({ error: { code: 'FILE_TOO_LARGE', message: 'File exceeds 100MB limit' } });
          return;
        }

        const workspaceId = req.auth?.workspaceId;
        if (!workspaceId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing workspace context' } });
          return;
        }

        const sanitized = body.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const prefix = body.folder ? `${workspaceId}/${body.folder}` : workspaceId;
        const storageKey = `${prefix}/${Date.now()}__${sanitized}`;

        try {
          const uploadUrl = await storage.getUploadUrl(storageKey, body.mimeType);
          res.status(200).json({ uploadUrl, storageKey });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to generate upload URL';
          res.status(500).json({ error: { code: 'STORAGE_ERROR', message } });
        }
      }),
    },
    {
      method: 'POST',
      path: '/v1/files',
      handler: errorHandler(async (req, res) => {
        const body = req.body as CreateFileBody | undefined;
        if (!body?.name || !body?.mimeType || !body?.size || !body?.storageKey) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing required fields: name, mimeType, size, storageKey' } });
          return;
        }

        const workspaceId = req.auth?.workspaceId;
        const userId = req.auth?.userId;
        if (!workspaceId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing workspace context' } });
          return;
        }

        try {
          const db = await getPool();
          const result = await db.query(SQL_CREATE_FILE, [
            workspaceId, body.name, body.mimeType, body.size,
            body.storageKey, body.folder ?? null, body.tags ?? null, userId ?? null,
          ]);
          res.status(201).json({ file: result.rows[0] });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to create file record';
          res.status(500).json({ error: { code: 'DB_ERROR', message } });
        }
      }),
    },
    {
      method: 'GET',
      path: '/v1/files',
      handler: errorHandler(async (req, res) => {
        const workspaceId = req.auth?.workspaceId;
        if (!workspaceId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing workspace context' } });
          return;
        }

        const limit = Math.min(Number(req.query?.limit) || 50, 250);
        const offset = Number(req.query?.offset) || 0;
        const search = req.query?.search;
        const type = req.query?.type;

        try {
          const db = await getPool();
          let result;
          if (search) {
            const searchPattern = '%' + search + '%';
            result = await db.query(SQL_SEARCH_FILES, [workspaceId, searchPattern, limit, offset]);
          } else if (type) {
            const typePattern = type + '%';
            result = await db.query(SQL_LIST_FILES_BY_TYPE, [workspaceId, typePattern, limit, offset]);
          } else {
            result = await db.query(SQL_LIST_FILES, [workspaceId, limit, offset]);
          }
          res.status(200).json({ files: result.rows });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to list files';
          res.status(500).json({ error: { code: 'DB_ERROR', message } });
        }
      }),
    },
    {
      method: 'GET',
      path: '/v1/files/by-entity/:entityType/:entityId',
      handler: errorHandler(async (req, res) => {
        const workspaceId = req.auth?.workspaceId;
        if (!workspaceId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing workspace context' } });
          return;
        }

        const entityType = req.params?.entityType;
        const entityId = req.params?.entityId;
        if (!entityType || !entityId || !VALID_ENTITY_TYPES.has(entityType)) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Invalid entity type or missing entity ID' } });
          return;
        }

        try {
          const db = await getPool();
          const result = await db.query(SQL_LIST_ATTACHMENTS, [entityType, entityId, workspaceId]);
          res.status(200).json({ files: result.rows });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to list attachments';
          res.status(500).json({ error: { code: 'DB_ERROR', message } });
        }
      }),
    },
    {
      method: 'GET',
      path: '/v1/files/:id',
      handler: errorHandler(async (req, res) => {
        const fileId = req.params?.id;
        if (!fileId) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing file ID' } });
          return;
        }

        const workspaceId = req.auth?.workspaceId;
        if (!workspaceId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing workspace context' } });
          return;
        }

        try {
          const db = await getPool();
          const result = await db.query(SQL_GET_FILE, [fileId, workspaceId]);
          if (result.rows.length === 0) {
            res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found' } });
            return;
          }
          const file = result.rows[0];
          const downloadUrl = await storage.getDownloadUrl(file.storage_key);
          res.status(200).json({ file: { ...file, downloadUrl } });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to get file';
          res.status(500).json({ error: { code: 'DB_ERROR', message } });
        }
      }),
    },
    {
      method: 'POST',
      path: '/v1/files/:id/attach',
      handler: errorHandler(async (req, res) => {
        const workspaceId = req.auth?.workspaceId;
        if (!workspaceId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing workspace context' } });
          return;
        }

        const fileId = req.params?.id;
        const body = req.body as { entityType?: string; entityId?: string } | undefined;
        if (!fileId || !body?.entityType || !body?.entityId) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing fileId, entityType, or entityId' } });
          return;
        }

        if (!VALID_ENTITY_TYPES.has(body.entityType)) {
          res.status(400).json({ error: { code: 'INVALID_ENTITY_TYPE', message: 'entityType must be contact, call, company, or deal' } });
          return;
        }

        try {
          const db = await getPool();
          // subquery ensures file belongs to workspace before inserting
          const result = await db.query(SQL_ATTACH_FILE, [fileId, body.entityType, body.entityId, workspaceId]);
          if (result.rows.length === 0) {
            // either file doesn't exist in this workspace, or already attached (ON CONFLICT DO NOTHING)
            res.status(200).json({ success: true, created: false });
            return;
          }
          res.status(201).json({ success: true, created: true, attachment: result.rows[0] });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to attach file';
          res.status(500).json({ error: { code: 'DB_ERROR', message } });
        }
      }),
    },
    {
      method: 'DELETE',
      path: '/v1/files/:id/attach/:attachmentId',
      handler: errorHandler(async (req, res) => {
        const workspaceId = req.auth?.workspaceId;
        if (!workspaceId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing workspace context' } });
          return;
        }

        const attachmentId = req.params?.attachmentId;
        if (!attachmentId) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing attachment ID' } });
          return;
        }

        try {
          const db = await getPool();
          // workspace scoped via subquery on files table
          await db.query(SQL_DETACH_FILE, [attachmentId, workspaceId]);
          res.status(200).json({ success: true });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to detach file';
          res.status(500).json({ error: { code: 'DB_ERROR', message } });
        }
      }),
    },
    {
      method: 'DELETE',
      path: '/v1/files/:id',
      handler: errorHandler(async (req, res) => {
        const fileId = req.params?.id;
        if (!fileId) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing file ID' } });
          return;
        }

        const workspaceId = req.auth?.workspaceId;
        if (!workspaceId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing workspace context' } });
          return;
        }

        try {
          const db = await getPool();
          const result = await db.query(SQL_DELETE_FILE, [fileId, workspaceId]);
          if (result.rows.length > 0) {
            // fire-and-forget S3 cleanup — don't block the response
            storage.deleteObject(result.rows[0].storage_key).catch(() => {});
          }
          res.status(200).json({ success: true });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to delete file';
          res.status(500).json({ error: { code: 'DB_ERROR', message } });
        }
      }),
    },
  ];
};
