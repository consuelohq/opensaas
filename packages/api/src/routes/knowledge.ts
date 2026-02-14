// DEV-748: Knowledge base routes — collections, indexing, search, stats
// 7 routes for RAG-powered AI coaching context

import { KnowledgeService, KnowledgeError } from '../services/knowledge.js';
import { StorageService } from '../services/storage.js';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';

/** /v1/knowledge + /v1/files/:id/index routes */
export const knowledgeRoutes = (): RouteDefinition[] => {
  const knowledge = new KnowledgeService();
  const storage = new StorageService();

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

        await knowledge.deleteCollection(collectionId);
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

        // fetch file record to get storage key + name + mime type
        // TODO(DEV-744): replace with DB lookup when files table is wired
        // for now, accept content + sourceName in the request body as a workaround
        const bodyWithContent = body as typeof body & { content?: string; sourceName?: string };
        if (!bodyWithContent?.content) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Missing "content" — direct file fetch not yet implemented (DEV-744). Pass extracted text in request body.',
            },
          });
          return;
        }

        try {
          const result = await knowledge.indexFile(fileId, body.collectionId, bodyWithContent.content, {
            strategy: body.strategy,
            metadata: body.metadata,
            sourceName: bodyWithContent.sourceName,
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

        await knowledge.deindexFile(fileId);
        res.status(204).json({});
      }),
    },
  ];
};
