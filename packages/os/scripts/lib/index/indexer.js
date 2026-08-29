const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { chunkFile, contentHash } = require('./chunker');
const { embedTexts } = require('./embedder');
const { getEmbeddingConfig, PROVIDER_LOCAL } = require('./embedding-config');
const { buildGraph } = require('./graph-builder');
const { createStore, sha256 } = require('./store');
const { getCurrentBranch, runGitMaybe } = require('../git');
const { resolveGitRoot } = require('../paths');
const { findTaskMeta } = require('../task-meta');
const { buildLexicalSearchTerms } = require('../search/retrieval-policy');

const INDEXABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md']);
const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  '.agents',
  '.claude',
  '.opencode',
  'dist',
  'build',
  '.next',
  'out',
  '.cache',
  'generated',
  'generated-metadata',
  'coverage',
  'vendor',
  'worktrees',
  '.worktrees',
  '__pycache__',
  '.task',
]);
const EXCLUDE_FILE_NAMES = new Set(['package-lock.json', 'yarn.lock']);
const MAX_QUERY_HYDRATION_CHUNKS = 64;
const MAX_CHANGED_HYDRATION_CHUNKS = 32;
const MAX_GATEWAY_EMBEDDING_BATCH_SIZE = 32;

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function isIndexablePath(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  const parts = normalized.split('/');

  if (parts.some((part) => EXCLUDE_DIRS.has(part))) return false;
  if (EXCLUDE_FILE_NAMES.has(path.basename(normalized))) return false;
  if (normalized.endsWith('.min.js') || normalized.endsWith('.map')) return false;

  return INDEXABLE_EXTENSIONS.has(path.extname(normalized));
}

function getRemoteUrl(repoRoot) {
  return runGitMaybe(['config', '--get', 'remote.origin.url'], { cwd: repoRoot }) || repoRoot;
}

function getBlobShaByPath(repoRoot) {
  const output = runGitLarge(repoRoot, ['ls-files', '-s']) || '';
  const map = new Map();

  for (const line of output.split('\n')) {
    const match = line.match(/^\d+\s+([a-f0-9]+)\s+\d+\t(.+)$/);
    if (match) map.set(match[2], match[1]);
  }

  return map;
}

function discoverTrackedFiles(repoRoot) {
  const output = runGitLarge(repoRoot, ['ls-files', '-z']) || '';
  return output.split('\0').filter(Boolean).filter(isIndexablePath).sort();
}

function runGitLarge(repoRoot, args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

function parseStatusOutput(output) {
  if (!output) return [];
  const entries = output.split('\0').filter(Boolean);
  const changes = [];

  for (const entry of entries) {
    const status = entry.slice(0, 2).trim();
    let filePath = entry.slice(3);

    if ((status.startsWith('R') || status.startsWith('C')) && filePath.includes('\0')) {
      filePath = filePath.split('\0').pop();
    }

    if (isIndexablePath(filePath)) {
      changes.push({ path: filePath, status: status || 'modified' });
    }
  }

  return changes;
}

function getChangedFiles(repoRoot, taskMeta) {
  const changed = new Map();
  const statusOutput = runGitMaybe([
    '-c',
    'core.quotePath=false',
    'status',
    '--porcelain',
    '-z',
    '-uall',
    '--',
    '.',
    ':!node_modules',
  ], { cwd: repoRoot }) || '';

  for (const change of parseStatusOutput(statusOutput)) {
    changed.set(change.path, change);
  }

  const baseBranch = taskMeta?.data?.baseBranch || taskMeta?.data?.stream || null;
  if (baseBranch && runGitMaybe(['rev-parse', '--verify', baseBranch], { cwd: repoRoot })) {
    const diffOutput = runGitMaybe(['diff', '--name-only', `${baseBranch}...HEAD`], { cwd: repoRoot }) || '';
    for (const filePath of diffOutput.split('\n').filter(Boolean).filter(isIndexablePath)) {
      if (!changed.has(filePath)) {
        changed.set(filePath, { path: filePath, status: 'modified' });
      }
    }
  }

  return Array.from(changed.values()).sort((left, right) => left.path.localeCompare(right.path));
}

function readFileContent(repoRoot, filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
}

async function indexChunkEmbeddings(store, chunks, options) {
  const batchSize = getEmbeddingBatchSize();
  let embeddedCount = 0;
  let skippedCount = 0;
  let processedCount = 0;

  if (chunks.length > 0 && !options.json) {
    writeStderr(`indexing: embedding ${chunks.length} query-relevant/changed chunks...`);
  }

  for (let index = 0; index < chunks.length; index += batchSize) {
    const batch = chunks.slice(index, index + batchSize);
    const uncached = [];

    for (const chunk of batch) {
      const cached = store.getCachedEmbedding(chunk.contentHash);
      if (cached) {
        store.insertChunkEmbedding(chunk.id, cached);
        embeddedCount += 1;
      } else {
        uncached.push(chunk);
      }
    }

    if (uncached.length > 0) {
      try {
        const vectors = await embedTexts(uncached.map((chunk) => chunk.content), { kind: 'document' });
        for (let vectorIndex = 0; vectorIndex < uncached.length; vectorIndex += 1) {
          const chunk = uncached[vectorIndex];
          const vector = vectors[vectorIndex];
          if (!vector) throw new Error('embedding provider returned an incomplete batch');
          store.setCachedEmbedding(chunk.contentHash, vector);
          store.insertChunkEmbedding(chunk.id, vector);
          embeddedCount += 1;
        }
      } catch (error /* unknown */) {
        skippedCount += uncached.length;
        const remainingAfterBatch = Math.max(0, chunks.length - (index + batch.length));
        const message = error instanceof Error ? error.message : String(error);
        if (!options.json) {
          writeStderr(`warning: semantic hydration paused after provider failure: ${message}`);
        }
        return {
          embeddedCount,
          skippedCount,
          deferredCount: uncached.length + remainingAfterBatch,
          failure: message,
        };
      }
    }

    processedCount += batch.length;
    if (processedCount % 100 < batchSize && !options.json) {
      writeStderr(`indexing: ${processedCount}/${options.totalChunks} chunks processed (${embeddedCount} embedded, ${skippedCount} skipped)...`);
    }
  }

  return { embeddedCount, skippedCount, deferredCount: 0, failure: null };
}

function getEmbeddingBatchSize() {
  const config = getEmbeddingConfig();
  return config.provider === PROVIDER_LOCAL
    ? getEmbeddingConcurrency()
    : MAX_GATEWAY_EMBEDDING_BATCH_SIZE;
}

function getEmbeddingConcurrency() {
  const parsed = Number.parseInt(process.env.WORKSPACE_EMBEDDING_CONTEXTS || '2', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;

  return Math.min(parsed, 2);
}

async function indexFiles(repoRoot, store, files, blobShaByPath, options) {
  const fileContents = new Map();
  const chunksByFile = new Map();
  const changedChunks = [];
  let indexedFiles = 0;
  let skippedFiles = 0;

  for (const filePath of files) {
    const absolutePath = path.join(repoRoot, filePath);
    if (!fs.existsSync(absolutePath)) {
      store.deleteFile(filePath);
      continue;
    }

    try {
      const content = readFileContent(repoRoot, filePath);
      const hash = contentHash(content);
      const existing = store.getFile(filePath);

      if (!options.force && existing?.content_hash === hash) {
        fileContents.set(filePath, content);
        chunksByFile.set(filePath, store.getChunksForFiles([filePath]));
        continue;
      }

      const chunks = chunkFile(filePath, content);
      store.upsertFile({
        path: filePath,
        blobSha: blobShaByPath.get(filePath) || null,
        contentHash: hash,
        indexedAt: new Date().toISOString(),
        sizeBytes: Buffer.byteLength(content),
      });

      const storedChunks = store.replaceChunks(filePath, chunks);
      fileContents.set(filePath, content);
      chunksByFile.set(filePath, storedChunks);
      changedChunks.push(...storedChunks);
      indexedFiles += 1;
    } catch {
      skippedFiles += 1;
      if (!options.json) {
        writeStderr(`warning: indexing skipped ${filePath}`);
      }
    }
  }

  return { changedChunks, chunksByFile, fileContents, indexedFiles, skippedFiles };
}

function collectAllIndexedContents(repoRoot, filePaths) {
  const fileContents = new Map();

  for (const filePath of filePaths) {
    const absolutePath = path.join(repoRoot, filePath);
    if (fs.existsSync(absolutePath)) {
      try {
        fileContents.set(filePath, readFileContent(repoRoot, filePath));
      } catch {
        continue;
      }
    }
  }

  return fileContents;
}

function toHydrationChunk(row) {
  return {
    id: Number(row.id ?? row.chunkId),
    filePath: row.filePath ?? row.file_path,
    seq: Number(row.seq ?? 0),
    startLine: Number(row.startLine ?? row.start_line ?? 1),
    endLine: Number(row.endLine ?? row.end_line ?? row.startLine ?? row.start_line ?? 1),
    type: row.type ?? row.chunkType ?? row.chunk_type,
    name: row.name ?? null,
    content: row.content,
    contentHash: row.contentHash ?? row.content_hash ?? contentHash(row.content),
  };
}

function selectHydrationChunks(store, indexingResult, options = {}) {
  const selected = new Map();
  const add = (row) => {
    const chunk = toHydrationChunk(row);
    if (!Number.isFinite(chunk.id) || store.hasChunkEmbedding(chunk.id)) return;
    selected.set(chunk.id, chunk);
  };

  if (options.query && typeof store.searchChunksByText === 'function') {
    const terms = buildLexicalSearchTerms(options.query);
    for (const row of store.searchChunksByText(terms, MAX_QUERY_HYDRATION_CHUNKS)) add(row);
  }

  const hydrateAll = Boolean(options.hydrateAll || options.reindex);
  const changedLimit = hydrateAll ? indexingResult.changedChunks.length : MAX_CHANGED_HYDRATION_CHUNKS;
  for (const chunk of indexingResult.changedChunks.slice(0, changedLimit)) add(chunk);

  if (hydrateAll) {
    for (const chunk of store.getChunksWithoutEmbeddings()) add(chunk);
  }

  return Array.from(selected.values());
}

async function ensureIndex(options = {}) {
  const repoRoot = resolveGitRoot(options.cwd || process.cwd());
  const remoteUrl = getRemoteUrl(repoRoot);
  const store = createStore(repoRoot, remoteUrl);
  const branch = getCurrentBranch(repoRoot);
  const taskMeta = findTaskMeta(repoRoot, { currentBranch: branch });
  const worktreeId = taskMeta?.data?.taskBranch || null;
  const trackedFiles = discoverTrackedFiles(repoRoot);
  const hasFullIndex = Boolean(store.getMeta('last_full_index'));
  const full = options.reindex || !hasFullIndex;
  if (full) {
    const trackedPathSet = new Set(trackedFiles);
    for (const file of store.getFiles()) {
      if (!trackedPathSet.has(file.path)) {
        store.deleteFile(file.path);
      }
    }
  }
  const changedFiles = full ? trackedFiles.map((filePath) => ({ path: filePath, status: 'modified' })) : getChangedFiles(repoRoot, taskMeta);
  const changedPathSet = new Set(changedFiles.map((change) => change.path));
  const filesToIndex = full ? trackedFiles : trackedFiles.filter((filePath) => changedPathSet.has(filePath));
  const blobShaByPath = getBlobShaByPath(repoRoot);

  for (const change of changedFiles) {
    const absolutePath = path.join(repoRoot, change.path);
    const deleted = change.status === 'D' || !fs.existsSync(absolutePath);
    if (deleted) {
      store.deleteFile(change.path);
      store.setOverlay(worktreeId, { filePath: change.path, status: 'deleted' });
      continue;
    }

    if (worktreeId) {
      const content = readFileContent(repoRoot, change.path);
      store.setOverlay(worktreeId, {
        filePath: change.path,
        status: change.status === 'A' || !blobShaByPath.has(change.path) ? 'added' : 'modified',
        contentHash: sha256(content),
      });
    }
  }

  const indexingResult = await indexFiles(repoRoot, store, filesToIndex, blobShaByPath, {
    force: options.reindex || full,
    json: options.json,
  });

  const chunksToEmbed = selectHydrationChunks(store, indexingResult, {
    hydrateAll: options.hydrateAll,
    query: options.query,
    reindex: options.reindex,
  });
  const totalChunks = chunksToEmbed.length;
  const embeddingResult = await indexChunkEmbeddings(store, chunksToEmbed, {
    json: options.json,
    totalChunks,
  });

  if (full || indexingResult.indexedFiles > 0) {
    const allFiles = discoverTrackedFiles(repoRoot);
    const allContents = collectAllIndexedContents(repoRoot, allFiles);
    const allChunksByFile = new Map();
    for (const filePath of allFiles) {
      allChunksByFile.set(filePath, store.getChunksForFiles([filePath]));
    }
    store.replaceGraphEdges(buildGraph(repoRoot, allFiles, allContents, allChunksByFile));
  }

  if (full) {
    store.setMeta('last_full_index', new Date().toISOString());
  }

  store.setMeta('repo_root', repoRoot);
  store.setMeta('remote_url', remoteUrl);
  store.setMeta('tree_sitter_version', '0.25');
  store.setMeta('embedding_model', 'Qwen3-Embedding-4B');

  return {
    repoRoot,
    remoteUrl,
    store,
    branch,
    taskMeta,
    worktreeId,
    full,
    changedFiles,
    filesIndexed: indexingResult.indexedFiles,
    filesSkipped: indexingResult.skippedFiles,
    chunksEmbedded: embeddingResult.embeddedCount,
    chunksSkipped: embeddingResult.skippedCount,
    chunksDeferred: embeddingResult.deferredCount,
    embeddingFailure: embeddingResult.failure,
    stats: store.getStats(),
  };
}

module.exports = {
  ensureIndex,
  selectHydrationChunks,
  getChangedFiles,
  getRemoteUrl,
  isIndexablePath,
};
