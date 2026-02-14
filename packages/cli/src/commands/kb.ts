import type { Command } from 'commander';
import { apiGet, apiPost, apiDelete, handleApiError } from '../api-client.js';
import { log, error, json, isJson } from '../output.js';
import { captureError } from '../sentry.js';

interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  fileId: string;
  fileName: string;
  collection: string;
  metadata?: Record<string, string>;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
  chunkCount: number;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

interface KBStats {
  totalCollections: number;
  totalChunks: number;
  totalFiles: number;
  collections: Array<{ name: string; chunks: number; files: number; lastIndexed?: string }>;
}

export const registerKb = (program: Command): void => {
  const kb = program
    .command('kb')
    .description('knowledge base operations');

  kb.command('search <query>').description('semantic search across knowledge base')
    .option('--collection <name>', 'search within a specific collection')
    .option('--limit <n>', 'max results', '5')
    .option('--threshold <n>', 'minimum similarity score (0-1)', '0.5')
    .action(kbSearch);

  const collections = kb.command('collections').description('manage collections');

  collections.command('list').description('list all collections').action(kbCollectionsList);

  collections.command('create').description('create a new collection')
    .requiredOption('--name <name>', 'collection name')
    .option('--description <desc>', 'collection description')
    .action(kbCollectionsCreate);

  collections.command('delete <id>').description('delete a collection and all its chunks')
    .action(kbCollectionsDelete);

  kb.command('index <file-id>').description('index a file into the knowledge base')
    .requiredOption('--collection <name>', 'target collection')
    .option('--chunk-size <n>', 'words per chunk', '500')
    .option('--chunk-overlap <n>', 'overlap words between chunks', '50')
    .action(kbIndex);

  kb.command('deindex <file-id>').description('remove a file from the knowledge base')
    .action(kbDeindex);

  kb.command('stats').description('knowledge base statistics').action(kbStats);
};

const kbSearch = async (query: string, opts: { collection?: string; limit: string; threshold: string }): Promise<void> => {
  try {
    const body: Record<string, unknown> = { query, limit: parseInt(opts.limit, 10), threshold: parseFloat(opts.threshold) };
    if (opts.collection) body.collection = opts.collection;

    const res = await apiPost<{ results: SearchResult[] }>('/v1/knowledge/search', body);
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const { results } = res.data;
    if (!results.length) { log('no results found'); return; }

    for (const r of results) {
      const truncated = r.content.length > 200 ? `${r.content.slice(0, 200)}...` : r.content;
      log(`[${r.similarity.toFixed(2)}] ${r.collection} / ${r.fileName}`);
      log(`  "${truncated}"\n`);
    }
    log(`${results.length} result${results.length === 1 ? '' : 's'} (threshold: ${opts.threshold})`);
  } catch (err: unknown) {
    captureError(err, { command: 'kb search' });
    error(err instanceof Error ? err.message : 'search failed');
    process.exit(1);
  }
};

const kbCollectionsList = async (): Promise<void> => {
  try {
    const res = await apiGet<{ collections: Collection[] }>('/v1/knowledge/collections');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const { collections } = res.data;
    if (!collections.length) { log('no collections'); return; }

    log('name              | files | chunks | last indexed');
    log('------------------|-------|--------|------------------');
    let totalChunks = 0;
    for (const c of collections) {
      const name = c.name.padEnd(17).slice(0, 17);
      totalChunks += c.chunkCount;
      log(`${name} | ${String(c.fileCount).padEnd(5)} | ${String(c.chunkCount).padEnd(6)} | ${c.updatedAt}`);
    }
    log(`\n${collections.length} collection${collections.length === 1 ? '' : 's'}, ${totalChunks} total chunks`);
  } catch (err: unknown) {
    captureError(err, { command: 'kb collections list' });
    error(err instanceof Error ? err.message : 'failed to list collections');
    process.exit(1);
  }
};

const kbCollectionsCreate = async (opts: { name: string; description?: string }): Promise<void> => {
  try {
    const body: Record<string, unknown> = { name: opts.name };
    if (opts.description) body.description = opts.description;

    const res = await apiPost<{ collection: Collection }>('/v1/knowledge/collections', body);
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    log(`created collection: ${res.data.collection.name}`);
  } catch (err: unknown) {
    captureError(err, { command: 'kb collections create' });
    error(err instanceof Error ? err.message : 'failed to create collection');
    process.exit(1);
  }
};

const kbCollectionsDelete = async (id: string): Promise<void> => {
  try {
    const res = await apiDelete<{ deleted: boolean }>(`/v1/knowledge/collections/${id}`);
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    log('collection deleted');
  } catch (err: unknown) {
    captureError(err, { command: 'kb collections delete' });
    error(err instanceof Error ? err.message : 'failed to delete collection');
    process.exit(1);
  }
};

const kbIndex = async (fileId: string, opts: { collection: string; chunkSize: string; chunkOverlap: string }): Promise<void> => {
  try {
    const res = await apiPost<{ indexed: boolean; chunks: number }>(`/v1/files/${fileId}/index`, {
      collection: opts.collection,
      chunkSize: parseInt(opts.chunkSize, 10),
      chunkOverlap: parseInt(opts.chunkOverlap, 10),
    });
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    log(`indexed → ${opts.collection} (${res.data.chunks} chunks)`);
  } catch (err: unknown) {
    captureError(err, { command: 'kb index' });
    error(err instanceof Error ? err.message : 'indexing failed');
    process.exit(1);
  }
};

const kbDeindex = async (fileId: string): Promise<void> => {
  try {
    const res = await apiDelete<{ deindexed: boolean }>(`/v1/files/${fileId}/index`);
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    log('file deindexed');
  } catch (err: unknown) {
    captureError(err, { command: 'kb deindex' });
    error(err instanceof Error ? err.message : 'deindexing failed');
    process.exit(1);
  }
};

const kbStats = async (): Promise<void> => {
  try {
    const res = await apiGet<{ stats: KBStats }>('/v1/knowledge/stats');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const s = res.data.stats;
    log('knowledge base:');
    log(`  collections:  ${s.totalCollections}`);
    log(`  files:        ${s.totalFiles}`);
    log(`  chunks:       ${s.totalChunks}`);
    if (s.collections.length) {
      log('');
      for (const c of s.collections) {
        const last = c.lastIndexed ? ` (last: ${c.lastIndexed.slice(0, 10)})` : '';
        log(`  ${c.name}:  ${c.files} files, ${c.chunks} chunks${last}`);
      }
    }
  } catch (err: unknown) {
    captureError(err, { command: 'kb stats' });
    error(err instanceof Error ? err.message : 'failed to get stats');
    process.exit(1);
  }
};
