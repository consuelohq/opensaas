const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { Database } = require('bun:sqlite');
const sqliteVec = require('sqlite-vec');

const { getEmbeddingConfig, getEmbeddingConfigId } = require('./embedding-config');

const EMBEDDING_CONFIG = getEmbeddingConfig();
const VECTOR_DIMENSIONS = EMBEDDING_CONFIG.dimensions;
const EMBEDDING_MODEL = getEmbeddingConfigId(EMBEDDING_CONFIG);

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stripRemoteCredentials(remoteUrl) {
  if (!remoteUrl) return remoteUrl;
  try {
    const parsed = new URL(remoteUrl);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return remoteUrl.replace(/^(https?:\/\/)[^/@]+@/i, '$1');
  }
}

function getRepoIdentifier(repoRoot, remoteUrl) {
  return stripRemoteCredentials(remoteUrl) || repoRoot;
}

function getRepoHash(repoRoot, remoteUrl) {
  return sha256(getRepoIdentifier(repoRoot, remoteUrl)).slice(0, 24);
}

const SEMANTIC_INDEX_DB_NAME = 'semantic-index.db';
const SEMANTIC_INDEX_REGISTRY_PREFIX = 'semantic_index';
const SEMANTIC_INDEX_SCHEMA_VERSION = 1;

function expandHome(value) {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

function getConsueloHome() {
  return path.resolve(expandHome(process.env.CONSUELO_HOME || '~/.consuelo/os'));
}

function getSemanticIndexOverride() {
  const explicitPath = process.env.CONSUELO_SEMANTIC_INDEX_DB;
  if (!explicitPath) return null;
  return path.resolve(expandHome(explicitPath));
}

function getSemanticIndexAssetName(repoRoot, remoteUrl) {
  return `${SEMANTIC_INDEX_REGISTRY_PREFIX}:${getRepoHash(repoRoot, remoteUrl)}`;
}

function getCacheRoot(repoRoot, remoteUrl) {
  const explicitPath = getSemanticIndexOverride();
  if (explicitPath) return path.dirname(explicitPath);
  return path.join(getConsueloHome(), 'cache', 'semantic-index', getRepoHash(repoRoot, remoteUrl));
}

function getSemanticIndexDbPath(repoRoot, remoteUrl) {
  return getSemanticIndexOverride() || path.join(getCacheRoot(repoRoot, remoteUrl), SEMANTIC_INDEX_DB_NAME);
}

function registerSemanticIndex(dbPath, cacheRoot, repoRoot, remoteUrl) {
  const consueloHome = getConsueloHome();
  fs.mkdirSync(consueloHome, { recursive: true });

  const registryDbPath = path.join(consueloHome, 'consuelo.db');
  const registryDb = new Database(registryDbPath, { create: true });
  const now = new Date().toISOString();

  try {
    registryDb.exec(`
      CREATE TABLE IF NOT EXISTS runtime_assets (
        name TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        driver TEXT NOT NULL,
        path TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        rebuildable INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );
    `);

    registryDb.query([
      'INSERT INTO runtime_assets(name, kind, driver, path, schema_version, rebuildable, updated_at, metadata_json)',
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      'ON CONFLICT(name) DO UPDATE SET',
      '  kind = excluded.kind,',
      '  driver = excluded.driver,',
      '  path = excluded.path,',
      '  schema_version = excluded.schema_version,',
      '  rebuildable = excluded.rebuildable,',
      '  updated_at = excluded.updated_at,',
      '  metadata_json = excluded.metadata_json',
    ].join('\n')).run(
      getSemanticIndexAssetName(repoRoot, remoteUrl),
      SEMANTIC_INDEX_REGISTRY_PREFIX,
      'sqlite',
      dbPath,
      SEMANTIC_INDEX_SCHEMA_VERSION,
      1,
      now,
      JSON.stringify({
        cacheRoot,
        envOverride: Boolean(getSemanticIndexOverride()),
        registryDbPath,
        repoHash: getRepoHash(repoRoot, remoteUrl),
        repoIdentifier: getRepoIdentifier(repoRoot, remoteUrl),
        repoRoot,
      }),
    );
  } finally {
    registryDb.close();
  }
}

function vectorToBuffer(vector) {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

function bufferToVector(buffer) {
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Float32Array.BYTES_PER_ELEMENT);
}

function createStore(repoRoot, remoteUrl) {
  const cacheRoot = getCacheRoot(repoRoot, remoteUrl);
  fs.mkdirSync(cacheRoot, { recursive: true });

  const dbPath = getSemanticIndexDbPath(repoRoot, remoteUrl);
  registerSemanticIndex(dbPath, cacheRoot, repoRoot, remoteUrl);

  const db = new Database(dbPath, { create: true });

  try {
    sqliteVec.load(db);
  } catch (error /* unknown */) {
    const details = error instanceof Error ? error.stack || error.message : String(error);
    throw new Error([
      'sqlite-vec could not be loaded.',
      'On macOS, run commands through the workspace scripts so DYLD_LIBRARY_PATH includes Homebrew SQLite.',
      `Original error: ${details}`,
    ].join(' '), { cause: error });
  }

  db.exec('PRAGMA busy_timeout = 10000;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      blob_sha TEXT,
      content_hash TEXT NOT NULL,
      indexed_at TEXT NOT NULL,
      size_bytes INTEGER
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
      seq INTEGER NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      chunk_type TEXT NOT NULL,
      name TEXT,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      UNIQUE(file_path, seq)
    );

    CREATE TABLE IF NOT EXISTS chunk_embeddings (
      chunk_id INTEGER PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
      model TEXT NOT NULL DEFAULT '${EMBEDDING_MODEL}',
      embedded_at TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS chunk_vectors USING vec0(
      chunk_id INTEGER PRIMARY KEY,
      embedding float[${VECTOR_DIMENSIONS}]
    );

    CREATE TABLE IF NOT EXISTS graph_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_path TEXT NOT NULL,
      target_path TEXT NOT NULL,
      edge_type TEXT NOT NULL,
      symbol TEXT,
      UNIQUE(source_path, target_path, edge_type, symbol)
    );

    CREATE TABLE IF NOT EXISTS overlays (
      worktree_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT NOT NULL,
      content_hash TEXT,
      PRIMARY KEY(worktree_id, file_path)
    );

    CREATE TABLE IF NOT EXISTS embedding_cache (
      content_hash TEXT PRIMARY KEY,
      model TEXT NOT NULL DEFAULT '${EMBEDDING_MODEL}',
      embedding BLOB NOT NULL,
      embedded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evidence_events (
      id TEXT PRIMARY KEY,
      occurred_at TEXT NOT NULL,
      type TEXT NOT NULL,
      source TEXT,
      question TEXT,
      action TEXT,
      file_path TEXT,
      status TEXT,
      confidence_delta REAL,
      worktree_id TEXT,
      details_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hypotheses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      confidence REAL NOT NULL,
      worktree_id TEXT,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hypothesis_updates (
      id TEXT PRIMARY KEY,
      hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
      evidence_event_id TEXT REFERENCES evidence_events(id) ON DELETE SET NULL,
      previous_confidence REAL,
      next_confidence REAL NOT NULL,
      reason TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS index_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  function setMeta(key, value) {
    db.query([
      'INSERT INTO index_meta(key, value)',
      'VALUES (?, ?)',
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ].join('\n')).run(key, String(value));
  }

  function getMeta(key) {
    const row = db.query('SELECT value FROM index_meta WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  function deleteFile(filePath) {
    db.query('DELETE FROM chunk_vectors WHERE chunk_id IN (SELECT id FROM chunks WHERE file_path = ?)').run(filePath);
    db.query('DELETE FROM files WHERE path = ?').run(filePath);
    db.query('DELETE FROM graph_edges WHERE source_path = ? OR target_path = ?').run(filePath, filePath);
  }

  function upsertFile(file) {
    db.query([
      'INSERT INTO files(path, blob_sha, content_hash, indexed_at, size_bytes)',
      'VALUES (?, ?, ?, ?, ?)',
      'ON CONFLICT(path) DO UPDATE SET',
      '  blob_sha = excluded.blob_sha,',
      '  content_hash = excluded.content_hash,',
      '  indexed_at = excluded.indexed_at,',
      '  size_bytes = excluded.size_bytes',
    ].join('\n')).run(file.path, file.blobSha || null, file.contentHash, file.indexedAt, file.sizeBytes || 0);
  }

  function replaceChunks(filePath, chunks) {
    db.query('DELETE FROM chunk_vectors WHERE chunk_id IN (SELECT id FROM chunks WHERE file_path = ?)').run(filePath);
    db.query('DELETE FROM chunks WHERE file_path = ?').run(filePath);

    const insert = db.query([
      'INSERT INTO chunks(file_path, seq, start_line, end_line, chunk_type, name, content, content_hash)',
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      'RETURNING id',
    ].join('\n'));

    return chunks.map((chunk, index) => {
      const row = insert.get(
        filePath,
        index,
        chunk.startLine,
        chunk.endLine,
        chunk.type,
        chunk.name || null,
        chunk.content,
        chunk.contentHash,
      );

      return { ...chunk, id: Number(row.id), filePath, seq: index };
    });
  }

  function insertChunkEmbedding(chunkId, vector) {
    db.query('DELETE FROM chunk_vectors WHERE chunk_id = ?').run(chunkId);
    db.query('INSERT INTO chunk_vectors(chunk_id, embedding) VALUES (?, ?)').run(chunkId, vector);
    db.query([
      'INSERT INTO chunk_embeddings(chunk_id, model, embedded_at)',
      'VALUES (?, ?, ?)',
      'ON CONFLICT(chunk_id) DO UPDATE SET model = excluded.model, embedded_at = excluded.embedded_at',
    ].join('\n')).run(chunkId, EMBEDDING_MODEL, new Date().toISOString());
  }

  function getCachedEmbedding(contentHash) {
    const row = db.query('SELECT embedding FROM embedding_cache WHERE content_hash = ? AND model = ?').get(contentHash, EMBEDDING_MODEL);
    return row ? bufferToVector(row.embedding) : null;
  }

  function setCachedEmbedding(contentHash, vector) {
    db.query([
      'INSERT INTO embedding_cache(content_hash, model, embedding, embedded_at)',
      'VALUES (?, ?, ?, ?)',
      'ON CONFLICT(content_hash) DO UPDATE SET',
      '  model = excluded.model,',
      '  embedding = excluded.embedding,',
      '  embedded_at = excluded.embedded_at',
    ].join('\n')).run(contentHash, EMBEDDING_MODEL, vectorToBuffer(vector), new Date().toISOString());
  }

  function replaceGraphEdges(edges) {
    const removeAll = db.query('DELETE FROM graph_edges');
    const insert = db.query([
      'INSERT OR IGNORE INTO graph_edges(source_path, target_path, edge_type, symbol)',
      'VALUES (?, ?, ?, ?)',
    ].join('\n'));

    const transaction = db.transaction((items) => {
      removeAll.run();
      for (const edge of items) {
        insert.run(edge.sourcePath, edge.targetPath, edge.edgeType, edge.symbol || null);
      }
    });

    transaction(edges);
  }

  function setOverlay(worktreeId, overlay) {
    if (!worktreeId) return;

    db.query([
      'INSERT INTO overlays(worktree_id, file_path, status, content_hash)',
      'VALUES (?, ?, ?, ?)',
      'ON CONFLICT(worktree_id, file_path) DO UPDATE SET',
      '  status = excluded.status,',
      '  content_hash = excluded.content_hash',
    ].join('\n')).run(worktreeId, overlay.filePath, overlay.status, overlay.contentHash || null);
  }

  function searchChunks(vector, limit) {
    return db.query([
      'SELECT',
      '  chunk_vectors.chunk_id AS chunkId,',
      '  chunk_vectors.distance AS distance,',
      '  chunks.file_path AS filePath,',
      '  chunks.start_line AS startLine,',
      '  chunks.end_line AS endLine,',
      '  chunks.chunk_type AS chunkType,',
      '  chunks.name AS name,',
      '  chunks.content AS content',
      'FROM chunk_vectors',
      'JOIN chunks ON chunks.id = chunk_vectors.chunk_id',
      'WHERE embedding MATCH ? AND k = ?',
      'ORDER BY distance',
    ].join('\n')).all(vector, limit);
  }

  function getFile(pathName) {
    return db.query('SELECT * FROM files WHERE path = ?').get(pathName);
  }

  function getFiles() {
    return db.query('SELECT * FROM files ORDER BY path').all();
  }

  function getFileSizesForPaths(paths) {
    if (paths.length === 0) return new Map();
    const placeholders = paths.map(() => '?').join(',');
    const rows = db.query(
      `SELECT path, size_bytes FROM files WHERE path IN (${placeholders})`,
    ).all(...paths);
    return new Map(rows.map((row) => [row.path, Number(row.size_bytes || 0)]));
  }

  function getChunksForFiles(paths) {
    if (paths.length === 0) return [];
    const placeholders = paths.map(() => '?').join(',');
    return db.query([
      'SELECT * FROM chunks WHERE file_path IN (',
      placeholders,
      ') ORDER BY file_path, seq',
    ].join('')).all(...paths);
  }

  function getChunkStatsForFiles(paths) {
    if (paths.length === 0) return [];
    const placeholders = paths.map(() => '?').join(',');
    return db.query([
      'SELECT',
      '  file_path,',
      '  COUNT(*) AS total_chunks,',
      "  SUM(CASE WHEN chunk_type IN ('type', 'export') THEN 1 ELSE 0 END) AS type_export_chunks,",
      "  SUM(CASE WHEN chunk_type IN ('class', 'function', 'method') THEN 1 ELSE 0 END) AS implementation_chunks,",
      "  GROUP_CONCAT(CASE WHEN chunk_type IN ('class', 'function', 'method') THEN name ELSE NULL END, ' ') AS implementation_names",
      'FROM chunks',
      'WHERE file_path IN (',
      placeholders,
      ')',
      'GROUP BY file_path',
    ].join('\n')).all(...paths);
  }

  function getAllChunks() {
    return db.query('SELECT * FROM chunks ORDER BY file_path, seq').all();
  }

  function getChunksWithoutEmbeddings() {
    return db.query([
      'SELECT chunks.* FROM chunks',
      'LEFT JOIN chunk_embeddings ON chunk_embeddings.chunk_id = chunks.id',
      'WHERE chunk_embeddings.chunk_id IS NULL',
      'ORDER BY chunks.file_path, chunks.seq',
    ].join('\n')).all();
  }

  function hasChunkEmbedding(chunkId) {
    const row = db.query('SELECT chunk_id FROM chunk_embeddings WHERE chunk_id = ?').get(chunkId);
    return Boolean(row);
  }

  function getEdgesForFiles(paths) {
    if (paths.length === 0) return [];
    const placeholders = paths.map(() => '?').join(',');
    return db.query([
      'SELECT * FROM graph_edges',
      'WHERE source_path IN (',
      placeholders,
      ') OR target_path IN (',
      placeholders,
      ')',
      'ORDER BY source_path, target_path, edge_type',
    ].join(' ')).all(...paths, ...paths);
  }

  function getConnectedPaths(filePath) {
    return db.query([
      'SELECT target_path AS path, edge_type AS edgeType, symbol FROM graph_edges WHERE source_path = ?',
      'UNION ALL',
      'SELECT source_path AS path, edge_type AS edgeType, symbol FROM graph_edges WHERE target_path = ?',
    ].join('\n')).all(filePath, filePath);
  }

  function getEdgeCounts() {
    const rows = db.query([
      'SELECT path, COUNT(*) AS count FROM (',
      '  SELECT source_path AS path FROM graph_edges',
      '  UNION ALL',
      '  SELECT target_path AS path FROM graph_edges',
      ')',
      'GROUP BY path',
    ].join('\n')).all();

    return new Map(rows.map((row) => [row.path, Number(row.count)]));
  }

  function getGraphQualityScores() {
    const edgeRows = db.query('SELECT source_path, target_path, edge_type FROM graph_edges').all();
    const chunkRows = db.query([
      'SELECT',
      '  file_path,',
      '  COUNT(*) AS total_chunks,',
      "  SUM(CASE WHEN chunk_type IN ('type', 'export') THEN 1 ELSE 0 END) AS type_export_chunks,",
      "  SUM(CASE WHEN chunk_type IN ('class', 'function', 'method') THEN 1 ELSE 0 END) AS implementation_chunks,",
      "  GROUP_CONCAT(CASE WHEN chunk_type IN ('class', 'function', 'method') THEN name ELSE NULL END, ' ') AS implementation_names",
      'FROM chunks',
      'GROUP BY file_path',
    ].join('\n')).all();
    const chunkStats = new Map(chunkRows.map((row) => [row.file_path, {
      implementationChunks: Number(row.implementation_chunks || 0),
      implementationNames: row.implementation_names || '',
      totalChunks: Number(row.total_chunks || 0),
      typeExportChunks: Number(row.type_export_chunks || 0),
    }]));
    const edgeWeights = {
      calls: 1.2,
      called_by: 1.2,
      imports: 1,
      imported_by: 1,
      sibling: 0.3,
      tests: 1.5,
      tested_by: 1.5,
    };
    const weightedEdges = new Map();

    for (const edge of edgeRows) {
      const weight = edgeWeights[edge.edge_type] || 0.5;
      weightedEdges.set(edge.source_path, (weightedEdges.get(edge.source_path) || 0) + weight);
      weightedEdges.set(edge.target_path, (weightedEdges.get(edge.target_path) || 0) + weight);
    }

    const graphQualityScores = new Map();
    for (const [filePath, weightedEdgeScore] of weightedEdges.entries()) {
      const stats = chunkStats.get(filePath);
      const typeHeavy = stats?.totalChunks > 0 && (stats.typeExportChunks / stats.totalChunks) > 0.7;
      const typePenalty = typeHeavy ? 0.5 : 1;
      graphQualityScores.set(filePath, {
        hasImplementationChunks: Boolean(stats?.implementationChunks),
        implementationNames: stats?.implementationNames || '',
        typeHeavy,
        weightedEdges: weightedEdgeScore,
        weightedScore: weightedEdgeScore * typePenalty,
      });
    }

    return graphQualityScores;
  }

  function getDeletedOverlayPaths(worktreeId) {
    if (!worktreeId) return new Set();
    const rows = db.query('SELECT file_path FROM overlays WHERE worktree_id = ? AND status = ?').all(worktreeId, 'deleted');
    return new Set(rows.map((row) => row.file_path));
  }

  function insertEvidenceEvent(event) {
    db.query([
      'INSERT OR IGNORE INTO evidence_events(',
      '  id,',
      '  occurred_at,',
      '  type,',
      '  source,',
      '  question,',
      '  action,',
      '  file_path,',
      '  status,',
      '  confidence_delta,',
      '  worktree_id,',
      '  details_json',
      ')',
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ].join('\n')).run(
      event.id,
      event.occurred_at,
      event.type,
      event.source || null,
      event.question || null,
      event.action || null,
      event.file_path || null,
      event.status || null,
      typeof event.confidence_delta === 'number' ? event.confidence_delta : null,
      event.worktree_id || null,
      JSON.stringify(event.details || {}),
    );
  }

  function getEvidenceEvents(worktreeId = null) {
    const rows = worktreeId
      ? db.query('SELECT * FROM evidence_events WHERE worktree_id = ? ORDER BY occurred_at, id').all(worktreeId)
      : db.query('SELECT * FROM evidence_events ORDER BY occurred_at, id').all();

    return rows.map((row) => ({
      id: row.id,
      occurred_at: row.occurred_at,
      type: row.type,
      source: row.source,
      question: row.question,
      action: row.action,
      file_path: row.file_path,
      status: row.status,
      confidence_delta: row.confidence_delta,
      worktree_id: row.worktree_id,
      details: row.details_json ? JSON.parse(row.details_json) : {},
    }));
  }

  function getStats() {
    const fileRow = db.query('SELECT COUNT(*) AS count FROM files').get();
    const chunkRow = db.query('SELECT COUNT(*) AS count FROM chunks').get();
    const indexedRow = db.query('SELECT MAX(indexed_at) AS lastIndexed FROM files').get();

    return {
      cacheRoot,
      databasePath: dbPath,
      totalFiles: Number(fileRow.count || 0),
      totalChunks: Number(chunkRow.count || 0),
      lastIndexed: indexedRow.lastIndexed || null,
      lastFullIndex: getMeta('last_full_index'),
    };
  }

  return {
    cacheRoot,
    db,
    dbPath,
    deleteFile,
    getCachedEmbedding,
    getConnectedPaths,
    getDeletedOverlayPaths,
    getEdgeCounts,
    getEdgesForFiles,
    getEvidenceEvents,
    getAllChunks,
    getFile,
    getFiles,
    getFileSizesForPaths,
    getChunksForFiles,
    getChunksWithoutEmbeddings,
    getChunkStatsForFiles,
    getGraphQualityScores,
    getMeta,
    getStats,
    hasChunkEmbedding,
    insertEvidenceEvent,
    insertChunkEmbedding,
    replaceChunks,
    replaceGraphEdges,
    searchChunks,
    setCachedEmbedding,
    setMeta,
    setOverlay,
    upsertFile,
  };
}

module.exports = {
  EMBEDDING_MODEL,
  VECTOR_DIMENSIONS,
  createStore,
  getCacheRoot,
  getConsueloHome,
  getRepoHash,
  getRepoIdentifier,
  getSemanticIndexAssetName,
  getSemanticIndexDbPath,
  registerSemanticIndex,
  normalizePath,
  sha256,
};
