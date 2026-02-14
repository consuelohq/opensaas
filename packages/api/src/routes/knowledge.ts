// DEV-748: Knowledge base routes — collections, indexing, search, stats
// 7 routes for RAG-powered AI coaching context

import { KnowledgeService, KnowledgeError } from '../services/knowledge.js';
import { StorageService } from '../services/storage.js';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';
import type { Pool } from 'pg';

const SQL_GET_FILE =
  'SELECT id, name, mime_type, storage_key FROM files WHERE id = $1 AND workspace_id = $2';

/** /v1/knowledge + /v1/files/:id/index routes */
export const knowledgeRoutes = (): RouteDefinition[] => {
  const knowledge = new KnowledgeService();
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
    // -- Collection CRUD (literal routes first) --------------------------------

    {
      method: 'POST',
      path: '/v1/knowledge/collections',
      handler: errorHandler(async (req, res) => {
        const workspaceId = req.auth?.workspaceId;
        if (!workspaceId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing workspace context' } });
          return;
        }

        const body = req.body as { name?: string; description?: string } | undefined;
        if (!body?.name) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "name"' } });
          return;
        }

        try {
          const collection = await knowledge.createCollection(workspaceId, body.name, body.description);
          res.status(201).json(collection);
        } catch (err: unknown) {
          if (err instanceof KnowledgeError && err.code === 'DUPLICATE_COLLECTION') {
            res.status(409).json({ error: { code: err.code, message: err.message } });
            return;
          }
          throw err;
        }
      }),
    },
    {
      method: 'GET',
      path: '/v1/knowledge/collections',
      handler: errorHandler(async (req, res) => {
        const workspaceId = req.auth?.workspaceId;
        if (!workspaceId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing workspace context' } });
          return;
        }

        const collections = await knowledge.listCollections(workspaceId);
        res.status(200).json({ collections });
      }),
    },
    {
      method: 'GET',
      path: '/v1/knowledge/search',
      handler: errorHandler(async (req, res) => {
        const workspaceId = req.auth?.workspaceId;
        if (!workspaceId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing workspace context' } });
          return;
        }

        const query = req.query?.q;
        if (!query) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing query parameter "q"' } });
          return;
        }

        // parse optional metadata filter from JSON query param
        let metadataFilter: Record<string, string> | undefined;
        if (req.query?.metadata) {
          try {
            metadataFilter = JSON.parse(req.query.metadata) as Record<string, string>;
          } catch (_err: unknown) {
            res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Invalid "metadata" JSON' } });
            return;
          }
        }

        const results = await knowledge.search(query, {
          workspaceId,
          collectionId: req.query?.collection,
          limit: req.query?.limit ? parseInt(req.query.limit, 10) : undefined,
          minSimilarity: req.query?.min_similarity ? parseFloat(req.query.min_similarity) : undefined,
          metadataFilter,
        });

        res.status(200).json({ results, count: results.length });
      }),
    },
    {
      method: 'GET',
      path: '/v1/knowledge/stats',
      handler: errorHandler(async (req, res) => {
        const workspaceId = req.auth?.workspaceId;
        if (!workspaceId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing workspace context' } });
          return;
        }

        const stats = await knowledge.getStats(workspaceId);
        res.status(200).json({ stats });
      }),
    },
    // param route after literals
    {
      method: 'DELETE',
      path: '/v1/knowledge/collections/:id',
      handler: errorHandler(async (req, res) => {
        const workspaceId = req.auth?.workspaceId;
        if (!workspaceId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing workspace context' } });
          return;
        }

        const collectionId = req.params?.id;
        if (!collectionId) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing collection ID' } });
          return;
        }

        await knowledge.deleteCollection(collectionId, workspaceId);
        res.status(204).json({});
      }),
    },

    // -- File indexing (under /v1/files/:id/index) -----------------------------
    // these are separate path segments from /v1/files/:id so no route conflict

    {
      method: 'POST',
      path: '/v1/files/:id/index',
      handler: errorHandler(async (req, res) => {
        const workspaceId = req.auth?.workspaceId;
        if (!workspaceId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing workspace context' } });
          return;
        }

        const fileId = req.params?.id;
        if (!fileId) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing file ID' } });
          return;
        }

        const body = req.body as {
          collectionId?: string;
          metadata?: Record<string, string>;
          strategy?: Partial<{ maxTokens: number; overlap: number; preserveTables: boolean }>;
        } | undefined;

        if (!body?.collectionId) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "collectionId"' } });
          return;
        }

        // fetch file record to get storage key + mime type
        const db = await getPool();
        const fileResult = await db.query(SQL_GET_FILE, [fileId, workspaceId]);
        const file = fileResult.rows[0] as { id: string; name: string; mime_type: string; storage_key: string } | undefined;
        if (!file) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found' } });
          return;
        }

        // allow content override in body (for testing), otherwise fetch from S3
        const bodyExt = body as typeof body & { content?: string };
        let content: string;
        if (bodyExt?.content) {
          content = bodyExt.content;
        } else {
          const buffer = await storage.getObject(file.storage_key);
          const extraction = await knowledge.extractText(buffer, file.mime_type);
          content = extraction.text;
        }

        try {
          const result = await knowledge.indexFile(fileId, body.collectionId, content, {
            strategy: body.strategy,
            metadata: body.metadata,
            sourceName: file.name,
          });
          res.status(200).json({ indexed: true, chunkCount: result.chunkCount });
        } catch (err: unknown) {
          if (err instanceof KnowledgeError) {
            res.status(400).json({ error: { code: err.code, message: err.message } });
            return;
          }
          throw err;
        }
      }),
    },
    {
      method: 'DELETE',
      path: '/v1/files/:id/index',
      handler: errorHandler(async (req, res) => {
        const workspaceId = req.auth?.workspaceId;
        if (!workspaceId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing workspace context' } });
          return;
        }

        const fileId = req.params?.id;
        if (!fileId) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing file ID' } });
          return;
        }

        await knowledge.deindexFile(fileId, workspaceId);
        res.status(204).json({});
      }),
    },
  ];
};
