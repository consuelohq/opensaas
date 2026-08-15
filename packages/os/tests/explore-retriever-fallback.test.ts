import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

type LexicalRow = {
  chunkId: number;
  filePath: string;
  startLine: number;
  endLine: number;
  chunkType: string;
  name: string | null;
  content: string;
  lexicalSupport: number;
};

function fakeStore(rows: LexicalRow[]) {
  return {
    searchChunks: () => [],
    searchChunksByText: () => rows,
    getFiles: () => rows.map((row) => ({ path: row.filePath })),
    getConnectedPaths: () => [],
    getChunksForFiles: () => [],
    getFileSizesForPaths: (paths: string[]) => new Map(paths.map((filePath) => [filePath, 1000])),
    getChunkStatsForFiles: (paths: string[]) => paths.map((filePath) => ({
      file_path: filePath,
      total_chunks: 1,
      type_export_chunks: 0,
      implementation_chunks: 1,
      implementation_names: rows.find((row) => row.filePath === filePath)?.name || '',
    })),
    getEdgesForFiles: () => [],
    getEdgeCounts: () => new Map(),
    getGraphQualityScores: () => new Map(),
    getDeletedOverlayPaths: () => new Set(),
  };
}

async function withFailingSemanticEmbedding<T>(run: (retrieve: Function) => Promise<T>): Promise<T> {
  const embedderPath = require.resolve('../scripts/lib/index/embedder.js');
  const retrieverPath = require.resolve('../scripts/lib/search/retriever.js');
  const embedder = require(embedderPath) as { embedText: (...args: unknown[]) => Promise<unknown> };
  const originalEmbedText = embedder.embedText;

  embedder.embedText = async () => {
    throw new Error('semantic provider unavailable');
  };
  delete require.cache[retrieverPath];

  try {
    const { retrieve } = require(retrieverPath) as { retrieve: Function };
    return await run(retrieve);
  } finally {
    embedder.embedText = originalEmbedText;
    delete require.cache[retrieverPath];
  }
}

describe('OS Explore E2 lexical fallback integration', () => {
  it('returns lexical results when semantic embedding is unavailable', async () => {
    const store = fakeStore([
      {
        chunkId: 1,
        filePath: 'packages/os/scripts/lib/search/retriever.js',
        startLine: 1,
        endLine: 30,
        chunkType: 'function',
        name: 'retrieve',
        content: 'retrieve lexical semantic graph ranking candidates',
        lexicalSupport: 9,
      },
      {
        chunkId: 2,
        filePath: 'packages/twenty-server/src/engine/api/graphql/services/scalars-explorer.service.ts',
        startLine: 1,
        endLine: 20,
        chunkType: 'class',
        name: 'ScalarsExplorerService',
        content: 'graphql scalar explorer service',
        lexicalSupport: 1,
      },
    ]);

    const results = await withFailingSemanticEmbedding((retrieve) => retrieve(
      store,
      process.cwd(),
      'where is Consuelo OS Explore retrieval ranking and graph expansion implemented',
      { budget: 2, depth: 0, changedFiles: [], worktreeId: null },
    ));

    expect(results.map((result: { path: string }) => result.path)).toEqual([
      'packages/os/scripts/lib/search/retriever.js',
      'packages/twenty-server/src/engine/api/graphql/services/scalars-explorer.service.ts',
    ]);
    expect(results[0].retrievalTypes).toContain('lexical');
    expect(results[0].scoreParts.retrievalFusion.channels).toContain('lexical');
  });

  it('hard-filters an explicit path scope before returning lexical results', async () => {
    const store = fakeStore([
      {
        chunkId: 1,
        filePath: 'packages/os/scripts/lib/search/ranker.js',
        startLine: 1,
        endLine: 30,
        chunkType: 'function',
        name: 'scoreCandidate',
        content: 'rank Explore candidates',
        lexicalSupport: 4,
      },
      {
        chunkId: 2,
        filePath: 'packages/twenty-server/src/search/ranker.ts',
        startLine: 1,
        endLine: 20,
        chunkType: 'function',
        name: 'rank',
        content: 'rank search candidates',
        lexicalSupport: 10,
      },
    ]);

    const results = await withFailingSemanticEmbedding((retrieve) => retrieve(
      store,
      process.cwd(),
      'Within packages/os/scripts/lib/search, where is Explore ranking implemented',
      { budget: 5, depth: 0, changedFiles: [], worktreeId: null },
    ));

    expect(results.map((result: { path: string }) => result.path)).toEqual([
      'packages/os/scripts/lib/search/ranker.js',
    ]);
  });
});
