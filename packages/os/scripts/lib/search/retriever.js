const { execFileSync } = require('child_process');

const { embedText } = require('../index/embedder');
const { scoreCandidate, getReason } = require('./ranker');

function distanceToSimilarity(distance) {
  const parsed = Number(distance);
  if (!Number.isFinite(parsed)) return 0;
  const normalizedDistance = Math.max(0, parsed);
  const cosine = Math.max(-1, Math.min(1, 1 - ((normalizedDistance * normalizedDistance) / 2)));
  return (cosine + 1) / 2;
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

    if (!existing) {
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
        reasonSimilarity: similarity,
      });
      continue;
    }

    existing.embeddingSimilarity = Math.max(existing.embeddingSimilarity, similarity);
    if (shouldReplaceBestChunk(row, similarity, existing)) {
      existing.bestChunkName = row.name;
      existing.bestChunkType = row.chunkType;
      existing.preview = toPreview(row.content);
      existing.startLine = row.startLine;
      existing.endLine = row.endLine;
      existing.reasonSimilarity = similarity;
    }
  }

  return candidates;
}

function getChunkTypePriority(chunkType) {
  switch (chunkType) {
    case 'class':
    case 'method':
    case 'function':
      return 4;
    case 'type':
    case 'export':
      return 3;
    case 'import':
      return 2;
    case 'block':
      return 1;
    default:
      return 0;
  }
}

function shouldReplaceBestChunk(row, similarity, existing) {
  const currentReasonSimilarity = existing.reasonSimilarity ?? existing.embeddingSimilarity;
  if (Math.abs(similarity - currentReasonSimilarity) <= 0.05) {
    const rowPriority = getChunkTypePriority(row.chunkType);
    const existingPriority = getChunkTypePriority(existing.bestChunkType);
    if (rowPriority !== existingPriority) return rowPriority > existingPriority;
    return similarity > currentReasonSimilarity;
  }

  return similarity > currentReasonSimilarity;
}

function expandGraph(store, candidates, depth, limit) {
  const queue = Array.from(candidates.keys()).map((filePath) => ({ filePath, depth: 0 }));
  const seen = new Set(candidates.keys());
  let addedCount = 0;

  while (queue.length > 0) {
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
      if (addedCount >= limit) break;

      seen.add(connection.path);
      addedCount += 1;
      candidates.set(connection.path, {
        path: connection.path,
        embeddingSimilarity: Math.max(0, (currentCandidate?.embeddingSimilarity || 0) * 0.85),
        bestChunkName: connection.symbol || null,
        bestChunkType: null,
        preview: '',
        startLine: 1,
        endLine: 1,
        graphConnections: [current.filePath],
        includedBy: connection.edgeType,
      });
      queue.push({ filePath: connection.path, depth: current.depth + 1 });
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

function attachCandidateMetadata(store, candidates) {
  const paths = Array.from(candidates.keys());
  if (paths.length === 0) return;

  const pathSet = new Set(paths);
  const edgesByPath = new Map(paths.map((filePath) => [filePath, []]));
  const fileSizes = store.getFileSizesForPaths(paths);
  const chunkStatsByPath = new Map(store.getChunkStatsForFiles(paths).map((row) => [row.file_path, {
    hasClassOrFunction: Number(row.implementation_chunks || 0) > 0,
    implementationNames: row.implementation_names || '',
    totalChunks: Number(row.total_chunks || 0),
    typeExportChunks: Number(row.type_export_chunks || 0),
  }]));

  for (const edge of store.getEdgesForFiles(paths)) {
    const normalizedEdge = {
      sourcePath: edge.source_path,
      symbol: edge.symbol || null,
      targetPath: edge.target_path,
      type: edge.edge_type,
    };

    if (pathSet.has(edge.source_path)) {
      edgesByPath.get(edge.source_path).push(normalizedEdge);
    }

    if (pathSet.has(edge.target_path)) {
      edgesByPath.get(edge.target_path).push(normalizedEdge);
    }
  }

  for (const candidate of candidates.values()) {
    const stats = chunkStatsByPath.get(candidate.path) || {
      hasClassOrFunction: false,
      implementationNames: '',
      totalChunks: 0,
      typeExportChunks: 0,
    };
    candidate.edges = edgesByPath.get(candidate.path) || [];
    candidate.edgeCount = candidate.edges.length;
    candidate.graphConnectionCount = candidate.graphConnections?.length || candidate.edgeCount;
    candidate.hasClassOrFunction = stats.hasClassOrFunction;
    candidate.implementationNames = stats.implementationNames;
    candidate.fileSize = fileSizes.get(candidate.path) || 0;
    candidate.totalChunks = stats.totalChunks;
    candidate.typeExportChunkRatio = stats.totalChunks === 0 ? 0 : stats.typeExportChunks / stats.totalChunks;
  }
}

function tokenizeQuery(query) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

function pathMatchesQuery(filePath, queryTokens) {
  const normalizedPath = filePath.toLowerCase();
  return queryTokens.length === 0 || queryTokens.some((token) => normalizedPath.includes(token));
}

function getClusterConnectedPaths(scoredCandidates, query) {
  const queryTokens = tokenizeQuery(query);
  const topPaths = new Set(scoredCandidates
    .slice()
    .sort((left, right) => right.score - left.score)
    .slice(0, 10)
    .map((candidate) => candidate.path));
  const connectedPaths = new Set();

  for (const candidate of scoredCandidates) {
    if (!topPaths.has(candidate.path)) continue;

    for (const edge of candidate.edges || []) {
      if (
        topPaths.has(edge.sourcePath)
        && topPaths.has(edge.targetPath)
        && edge.sourcePath !== edge.targetPath
        && pathMatchesQuery(edge.sourcePath, queryTokens)
        && pathMatchesQuery(edge.targetPath, queryTokens)
      ) {
        connectedPaths.add(edge.sourcePath);
        connectedPaths.add(edge.targetPath);
      }
    }
  }

  return connectedPaths;
}

function scoreCandidates(candidates, context) {
  const initiallyScored = candidates.map((candidate) => {
    const scored = scoreCandidate(candidate, context);
    return {
      ...candidate,
      rankingScore: scored.rankingScore,
      score: scored.score,
      scoreParts: scored.parts,
    };
  });
  const clusterConnectedPaths = getClusterConnectedPaths(initiallyScored, context.query);

  return candidates.map((candidate) => {
    candidate.connectedToOtherTopResults = clusterConnectedPaths.has(candidate.path);
    const scored = scoreCandidate(candidate, context);
    return {
      ...candidate,
      rankingScore: scored.rankingScore,
      score: scored.score,
      scoreParts: scored.parts,
    };
  });
}

async function retrieve(store, repoRoot, query, options = {}) {
  const budget = options.budget || 10;
  const depth = options.depth ?? 2;
  let rows;
  try {
    const queryVector = await embedText(query, { kind: 'query' });
    rows = store.searchChunks(queryVector, budget * 3);
  } catch (error /* unknown */) {
    const details = error instanceof Error ? error.stack || error.message : String(error);
    throw new Error(`retrieval failed: ${details}`, { cause: error });
  }
  const candidates = mergeSearchRows(rows);
  const graphCandidateLimit = budget * 2;
  expandGraph(store, candidates, depth, graphCandidateLimit);
  hydrateGraphCandidates(store, candidates);
  attachCandidateMetadata(store, candidates);

  const edgeCounts = store.getEdgeCounts();
  const graphQualityScores = store.getGraphQualityScores();
  const recencyByPath = buildRecencyLookup(repoRoot);
  const changedPaths = new Set((options.changedFiles || []).map((change) => change.path || change));
  const recentPaths = new Set(recencyByPath.keys());
  const deletedOverlayPaths = store.getDeletedOverlayPaths(options.worktreeId);

  let ranked = Array.from(candidates.values())
    .filter((candidate) => !deletedOverlayPaths.has(candidate.path));

  if (options.changedOnly) {
    ranked = ranked.filter((candidate) => changedPaths.has(candidate.path));
  }

  ranked = scoreCandidates(ranked, {
      changedPaths,
      edgeCounts,
      graphQualityScores,
      query,
      recentPaths,
      recencyByPath,
    })
    .map((candidate) => {
    const { reasonSimilarity, ...outputCandidate } = candidate;

    return {
      ...outputCandidate,
      changedInBranch: changedPaths.has(candidate.path),
      lastModified: recencyByPath.get(candidate.path) || null,
      score: candidate.score,
      scoreParts: candidate.scoreParts,
      reason: getReason(candidate),
    };
  }).sort((left, right) => (right.rankingScore || right.score) - (left.rankingScore || left.score)).slice(0, budget);

  return ranked;
}

module.exports = {
  buildRecencyLookup,
  retrieve,
};
