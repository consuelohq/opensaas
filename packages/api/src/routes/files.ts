import { StorageService } from '../services/storage.js';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';

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

interface CreateFileBody {
  name: string;
  mimeType: string;
  size: number;
  storageKey: string;
  folder?: string;
  tags?: string[];
}

/** /v1/files routes — file storage with presigned S3 URLs */
export const fileRoutes = (): RouteDefinition[] => {
  const storage = new StorageService();

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
          res.status(400).json({ error: { code: 'INVALID_FILE_TYPE', message: `Unsupported file type: ${body.mimeType}` } });
          return;
        }

        if (body.size && body.size > MAX_FILE_SIZE) {
          res.status(400).json({ error: { code: 'FILE_TOO_LARGE', message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` } });
          return;
        }

        const workspaceId = req.auth?.workspaceId;
        if (!workspaceId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing workspace context' } });
          return;
        }

        // unique key: {workspaceId}/{folder?}/{timestamp}__{sanitized_name}
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

        // TODO(DEV-744): insert into files table via postgres query
        // for now return the file record shape so the API contract is established
        res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'File record creation requires database connection (DEV-744)' } });
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

        // TODO(DEV-744): query files table with workspace filter, pagination, folder/tag filters
        res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'File listing requires database connection (DEV-744)' } });
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

        // TODO(DEV-744): fetch file record from DB, generate download URL
        res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'File retrieval requires database connection (DEV-744)' } });
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

        // TODO(DEV-744): fetch file record, delete from S3 via storage.deleteObject(key), delete from DB
        res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'File deletion requires database connection (DEV-744)' } });
      }),
    },
  ];
}
