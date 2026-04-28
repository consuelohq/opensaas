const { execFileSync } = require('child_process');

const { embedText } = require('../index/embedder');
const { scoreCandidate, getReason } = require('./ranker');

function distanceToSimilarity(distance) {
  const parsed = Number(distance);
  if (!Number.isFinite(parsed)) return 0;
  return 1 / (1 + Math.max(0, parsed));
}

function buildRecencyLookup(repoRoot) {
  const recencyByPath = new Map();

  try {
    const output = execFileSync('git', [
      'log',
      '--format=%H %ct',
      '--name-only',
      '--since=30 days ago',
    ], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

    let timestamp = null;
    for (const line of output.split('\n')) {
      const commitMatch = line.match(/^[a-f0-9]+\s+(\d+)$/);
      if (commitMatch) {
        timestamp = Number(commitMatch[1]);
        continue;
      }

      const filePath = line.trim();
      if (filePath && timestamp && !recencyByPath.has(filePath)) {
        recencyByPath.set(filePath, timestamp);
      }
    }
  } catch {
    return recencyByPath;
  }

  return recencyByPath;
}

function toPreview(content) {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
    .slice(0, 240);
}

function mergeSearchRows(rows) {
  const candidates = new Map();

  for (const row of rows) {
    const similarity = distanceToSimilarity(row.distance);
    const existing = candidates.get(row.filePath);

    if (!existing || similarity > existing.embeddingSimilarity) {
      candidates.set(row.filePath, {
        path: row.filePath,
        embeddingSimilarity: similarity,
        bestChunkName: row.name,
        bestChunkType: row.chunkType,
        preview: toPreview(row.content),
        startLine: row.startLine,
        endLine: row.endLine,
        graphConnections: [],
        includedBy: 'semantic',
      });
    }
  }

  return candidates;
}

function expandGraph(store, candidates, depth, limit) {
  const queue = Array.from(candidates.keys()).map((filePath) => ({ filePath, depth: 0 }));
  const seen = new Set(candidates.keys());

  while (queue.length > 0 && seen.size < limit) {
    const current = queue.shift();
    if (!current || current.depth >= depth) continue;

    const connections = Array.from(new Map(
      store.getConnectedPaths(current.filePath).map((connection) => [connection.path, connection]),
    ).values());
    const currentCandidate = candidates.get(current.filePath);
    if (currentCandidate) {
      currentCandidate.graphConnections = connections.slice(0, 8).map((connection) => connection.path);
    }

    for (const connection of connections) {
      if (seen.has(connection.path)) continue;

      seen.add(connection.path);
      candidates.set(connection.path, {
        path: connection.path,
        embeddingSimilarity: Math.max(0, (currentCandidate?.embeddingSimilarity || 0) * 0.85),
        bestChunkName: connection.symbol || null,
        bestChunkType: connection.edgeType,
        preview: '',
        startLine: 1,
        endLine: 1,
        graphConnections: [current.filePath],
        includedBy: connection.edgeType,
      });
      queue.push({ filePath: connection.path, depth: current.depth + 1 });

      if (seen.size >= limit) break;
    }
  }
}

function hydrateGraphCandidates(store, candidates) {
  const graphOnlyPaths = Array.from(candidates.values())
    .filter((candidate) => !candidate.preview)
    .map((candidate) => candidate.path);

  const chunks = store.getChunksForFiles(graphOnlyPaths);
  for (const chunk of chunks) {
    const candidate = candidates.get(chunk.file_path);
    if (!candidate || candidate.preview) continue;

    candidate.preview = toPreview(chunk.content);
    candidate.startLine = chunk.start_line;
    candidate.endLine = chunk.end_line;
    candidate.bestChunkName = candidate.bestChunkName || chunk.name;
    candidate.bestChunkType = candidate.bestChunkType || chunk.chunk_type;
  }
}

async function retrieve(store, repoRoot, query, options = {}) {
  const budget = options.budget || 10;
  const depth = options.depth ?? 2;
  let rows;
  try {
    const queryVector = await embedText(query, { kind: 'query' });
    rows = store.searchChunks(queryVector, budget * 3);
  } catch {
    throw new Error('retrieval failed');
  }
  const candidates = mergeSearchRows(rows);
  const graphCandidateLimit = budget * 2;
  expandGraph(store, candidates, depth, graphCandidateLimit);
  hydrateGraphCandidates(store, candidates);

  const edgeCounts = store.getEdgeCounts();
  const recencyByPath = buildRecencyLookup(repoRoot);
  const changedPaths = new Set((options.changedFiles || []).map((change) => change.path || change));
  const recentPaths = new Set(recencyByPath.keys());
  const deletedOverlayPaths = store.getDeletedOverlayPaths(options.worktreeId);

  let ranked = Array.from(candidates.values())
    .filter((candidate) => !deletedOverlayPaths.has(candidate.path));

  if (options.changedOnly) {
    ranked = ranked.filter((candidate) => changedPaths.has(candidate.path));
  }

  ranked = ranked.map((candidate) => {
    const scored = scoreCandidate(candidate, {
      changedPaths,
      edgeCounts,
      query,
      recentPaths,
      recencyByPath,
    });

    return {
      ...candidate,
      score: scored.score,
      scoreParts: scored.parts,
      reason: getReason(candidate),
    };
  }).sort((left, right) => right.score - left.score).slice(0, budget);

  return ranked;
}

module.exports = {
  buildRecencyLookup,
  retrieve,
};
