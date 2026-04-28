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

function scoreCandidate(candidate, context) {
  const graphCentrality = normalize(context.edgeCounts.get(candidate.path) || 0, 20);
  const recency = getRecencyScore(context.recencyByPath.get(candidate.path));
  const changeRelevance = context.changedPaths.has(candidate.path)
    ? 1
    : context.recentPaths.has(candidate.path)
      ? 0.5
      : 0;
  const nameMatch = getNameMatchScore(context.query, candidate.path);
  const embeddingSimilarity = Math.max(0, Math.min(1, candidate.embeddingSimilarity || 0));

  return {
    score: Math.max(0, Math.min(1,
      (0.55 * embeddingSimilarity)
      + (0.20 * graphCentrality)
      + (0.10 * recency)
      + (0.10 * changeRelevance)
      + (0.05 * nameMatch),
    )),
    parts: {
      embeddingSimilarity,
      graphCentrality,
      recency,
      changeRelevance,
      nameMatch,
    },
  };
}

function getReason(candidate) {
  if (candidate.bestChunkName) {
    return `semantic match: ${candidate.bestChunkName}`;
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
