const path = require('path');

function normalize(value, max) {
  if (!value || value <= 0) return 0;
  return Math.min(1, value / max);
}

function getRecencyScore(timestamp) {
  if (!timestamp) return 0.2;

  const ageMs = Date.now() - (timestamp * 1000);
  const dayMs = 24 * 60 * 60 * 1000;

  if (ageMs <= dayMs) return 1;
  if (ageMs <= 7 * dayMs) return 0.8;
  if (ageMs <= 30 * dayMs) return 0.5;
  return 0.2;
}

function tokenizeQuery(query) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

function getNameMatchScore(query, filePath) {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return 0;

  const normalizedPath = filePath.toLowerCase();
  return tokens.some((token) => normalizedPath.includes(token)) ? 1 : 0;
}

function getImplementationBonus(query, candidate, graphQuality) {
  if (!candidate.hasClassOrFunction && !graphQuality?.hasImplementationChunks) return 0;
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return 0;

  const symbolText = (candidate.implementationNames || graphQuality?.implementationNames || '').toLowerCase();
  return tokens.some((token) => symbolText.includes(token)) ? 0.05 : 0;
}

function scoreCandidate(candidate, context) {
  const graphQuality = context.graphQualityScores?.get(candidate.path) || null;
  const edgeWeights = {
    calls: 1.2,
    called_by: 1.2,
    imports: 1,
    imported_by: 1,
    sibling: 0.3,
    tests: 1.5,
    tested_by: 1.5,
  };
  const weightedEdges = Array.isArray(candidate.edges)
    ? candidate.edges.reduce((sum, edge) => sum + (edgeWeights[edge.type] || 0.5), 0)
    : graphQuality?.weightedEdges ?? context.edgeCounts.get(candidate.path) ?? candidate.edgeCount ?? 0;
  const graphCentrality = normalize(weightedEdges, 30);
  const recency = getRecencyScore(context.recencyByPath.get(candidate.path));
  const inCurrentDiff = context.changedPaths.has(candidate.path);
  const changeRelevance = inCurrentDiff ? 1 : context.recentPaths.has(candidate.path) ? 0.5 : 0;
  const nameMatch = getNameMatchScore(context.query, candidate.path);
  const nameMatchesQuery = nameMatch > 0;
  const embeddingSimilarity = Math.max(0, Math.min(1, candidate.embeddingSimilarity || 0));
  const typeExportRatio = candidate.typeExportChunkRatio ?? (graphQuality?.typeHeavy ? 1 : 0);
  const isTypeHeavy = typeExportRatio > 0.7;
  const hasImplementation = Boolean(candidate.hasClassOrFunction || graphQuality?.hasImplementationChunks);
  const implementationBonus = getImplementationBonus(context.query, candidate, graphQuality);
  let boost = 1;

  if (graphCentrality > 0.1) boost *= 1 + (0.15 * graphCentrality);
  if (recency > 0.5) boost *= 1.10;
  if (inCurrentDiff) boost *= 1.20;
  if (nameMatchesQuery) boost *= 1.10;
  if (hasImplementation) boost *= 1.10;
  if (isTypeHeavy) boost *= 0.85;
  if (candidate.connectedToOtherTopResults) boost *= 1.15;
  boost += implementationBonus;
  const rawScore = embeddingSimilarity * boost;
  const score = Math.max(0, Math.min(1, rawScore));

  return {
    rankingScore: rawScore,
    score,
    parts: {
      boost,
      embeddingSimilarity,
      changeRelevance,
      connectedToOtherTopResults: Boolean(candidate.connectedToOtherTopResults),
      graphCentrality,
      hasImplementation,
      implementationBonus,
      isTypeHeavy,
      recency,
      nameMatch,
      rawScore,
      weightedEdges,
    },
  };
}

function getReason(candidate) {
  if (candidate.bestChunkName) {
    return `semantic match: ${candidate.bestChunkType || 'chunk'} ${candidate.bestChunkName}`;
  }

  if (candidate.bestChunkType) {
    return `semantic match: ${candidate.bestChunkType} chunk`;
  }

  return `graph match: ${path.basename(candidate.path)}`;
}

module.exports = {
  getNameMatchScore,
  getReason,
  scoreCandidate,
};
