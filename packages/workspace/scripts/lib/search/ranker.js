const path = require('path');

const STOPWORDS = new Set([
  'about', 'after', 'again', 'already', 'also', 'and', 'app', 'are', 'because', 'been',
  'before', 'being', 'between', 'but', 'can', 'check', 'does', 'for', 'from', 'had',
  'has', 'have', 'how', 'into', 'its', 'let', 'like', 'make', 'more', 'not', 'now',
  'our', 'out', 'over', 'run', 'see', 'should', 'that', 'the', 'then', 'there',
  'this', 'tool', 'use', 'using', 'was', 'were', 'what', 'when', 'where', 'whether',
  'which', 'with', 'work', 'works', 'would', 'you', 'your'
]);

function clamp(value, min = 0, max = 1) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalize(value, max) {
  if (!value || value <= 0) return 0;
  return Math.min(1, value / max);
}

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function splitCompoundToken(token) {
  return String(token || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function tokenizeQuery(query) {
  const baseTokens = normalizeText(query)
    .split(/[^a-z0-9]+/)
    .flatMap(splitCompoundToken)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
  return Array.from(new Set(baseTokens));
}

function getQuotedPhrases(query) {
  const phrases = [];
  const pattern = /"([^"]+)"|'([^']+)'|`([^`]+)`/g;
  let match;
  while ((match = pattern.exec(String(query || ''))) !== null) {
    const phrase = normalizeText(match[1] || match[2] || match[3]).trim();
    if (phrase.length >= 3) phrases.push(phrase);
  }
  return phrases;
}

function getQuerySignals(query) {
  const raw = String(query || '');
  const tokens = tokenizeQuery(raw);
  const lowered = normalizeText(raw);
  const issueIds = Array.from(new Set((raw.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) || []).map((token) => token.toLowerCase())));
  const dottedNames = Array.from(new Set((raw.match(/\b[a-zA-Z][\w-]+\.[a-zA-Z][\w.-]+\b/g) || [])
    .map((token) => token.toLowerCase())
    .filter((token) => !/\.(js|jsx|ts|tsx|json|md|mdx|css|scss|yml|yaml)$/.test(token))));
  const pathLike = Array.from(new Set((raw.match(/(?:^|\s)(?:[\w.-]+\/){1,}[\w./-]+/g) || []).map((token) => token.trim().toLowerCase())));
  const dashedNames = Array.from(new Set((raw.match(/\b[a-zA-Z0-9]+-[a-zA-Z0-9][\w-]*\b/g) || []).map((token) => token.toLowerCase())));
  const quotedPhrases = getQuotedPhrases(raw);
  const capitalizedTerms = Array.from(new Set((raw.match(/\b[A-Z][a-zA-Z0-9]{2,}\b/g) || [])
    .map((token) => token.toLowerCase())
    .filter((token) => !STOPWORDS.has(token))));
  const hardAnchors = Array.from(new Set([...issueIds, ...dottedNames, ...quotedPhrases]));
  const softAnchors = Array.from(new Set([...hardAnchors, ...pathLike, ...dashedNames, ...capitalizedTerms]));
  return { hardAnchors, hasHardAnchors: hardAnchors.length > 0, issueIds, lowered, softAnchors, tokens };
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

function getNameMatchScore(query, filePath) {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return 0;
  const normalizedPath = normalizeText(filePath);
  return tokens.some((token) => normalizedPath.includes(token)) ? 1 : 0;
}

function tokenMatchRatio(tokens, text) {
  if (!tokens.length) return 0;
  const matched = tokens.filter((token) => text.includes(token)).length;
  return matched / tokens.length;
}

function anchorMatchRatio(anchors, text) {
  if (!anchors.length) return 0;
  const matched = anchors.filter((anchor) => text.includes(anchor)).length;
  return matched / anchors.length;
}

function getLexicalScores(query, candidate) {
  const signals = typeof query === 'string' ? getQuerySignals(query) : query;
  const pathText = normalizeText(candidate.path);
  const symbolText = normalizeText([candidate.bestChunkName, candidate.bestChunk?.symbolPath].filter(Boolean).join(' '));
  const previewText = normalizeText([candidate.preview, candidate.bestChunk?.preview].filter(Boolean).join(' '));
  const implementationText = normalizeText(candidate.implementationNames || '');
  const allText = normalizeText([pathText, symbolText, previewText, implementationText].join(' '));
  const pathRatio = tokenMatchRatio(signals.tokens, pathText);
  const symbolRatio = tokenMatchRatio(signals.tokens, symbolText);
  const previewRatio = tokenMatchRatio(signals.tokens, previewText);
  const implementationRatio = tokenMatchRatio(signals.tokens, implementationText);
  const tokenCoverage = tokenMatchRatio(signals.tokens, allText);
  const hardAnchorCoverage = anchorMatchRatio(signals.hardAnchors, allText);
  const softAnchorCoverage = anchorMatchRatio(signals.softAnchors, allText);
  const lexicalScore = clamp((pathRatio * 0.35) + (symbolRatio * 0.25) + (previewRatio * 0.25) + (implementationRatio * 0.15));
  return { hardAnchorCoverage, lexicalScore, softAnchorCoverage, tokenCoverage };
}

function getImplementationBonus(queryOrSignals, candidate, graphQuality) {
  if (!candidate.hasClassOrFunction && !graphQuality?.hasImplementationChunks) return 0;
  const signals = typeof queryOrSignals === 'string' ? getQuerySignals(queryOrSignals) : queryOrSignals;
  if (signals.tokens.length === 0) return 0;
  const symbolText = normalizeText(candidate.implementationNames || graphQuality?.implementationNames || '');
  return signals.tokens.some((token) => symbolText.includes(token)) ? 0.05 : 0;
}

function isGeneratedOrNoisyCandidate(candidate, querySignals) {
  const filePath = normalizeText(candidate.path);
  const query = querySignals.lowered;
  const explicitlyDesignQuery = query.includes('open design') || query.includes('open-design') || query.includes('electron') || query.includes('desktop') || query.includes('consuelo design');
  if (filePath.includes('postman_collection.json')) return true;
  if (filePath.endsWith('/docs.json')) return true;
  if (filePath.endsWith('/launch-docs-source.json')) return true;
  if (filePath.includes('/src/i18n/content.')) return true;
  if (filePath.includes('/upstream/open-design/') && !explicitlyDesignQuery) return true;
  if ((candidate.fileSize || 0) > 150000 && !querySignals.softAnchors.some((anchor) => filePath.includes(anchor))) return true;
  return false;
}

function structuralScore(candidate, graphQuality) {
  switch (candidate.bestChunkType) {
    case 'class':
    case 'method':
    case 'function':
      return 1;
    case 'test':
      return 0.85;
    case 'type':
    case 'export':
      return 0.7;
    case 'block':
      return 0.35;
    case 'import':
      return 0.2;
    default:
      return graphQuality?.hasImplementationChunks ? 0.5 : 0.25;
  }
}

function scoreCandidate(candidate, context) {
  const graphQuality = context.graphQualityScores?.get(candidate.path) || null;
  const edgeWeights = { calls: 1.2, called_by: 1.2, imports: 1, imported_by: 1, sibling: 0.3, tests: 1.5, tested_by: 1.5 };
  const weightedEdges = Array.isArray(candidate.edges)
    ? candidate.edges.reduce((sum, edge) => sum + (edgeWeights[edge.type] || 0.5), 0)
    : graphQuality?.weightedEdges ?? context.edgeCounts.get(candidate.path) ?? candidate.edgeCount ?? 0;
  const graphCentrality = normalize(weightedEdges, 30);
  const recency = getRecencyScore(context.recencyByPath.get(candidate.path));
  const inCurrentDiff = context.changedPaths.has(candidate.path);
  const changeRelevance = inCurrentDiff ? 1 : context.recentPaths.has(candidate.path) ? 0.5 : 0;
  const querySignals = context.querySignals || getQuerySignals(context.query);
  const nameMatch = getNameMatchScore(context.query, candidate.path);
  const embeddingSimilarity = clamp(candidate.embeddingSimilarity || 0);
  const typeExportRatio = candidate.typeExportChunkRatio ?? (graphQuality?.typeHeavy ? 1 : 0);
  const isTypeHeavy = typeExportRatio > 0.7;
  const hasImplementation = Boolean(candidate.hasClassOrFunction || graphQuality?.hasImplementationChunks);
  const implementationBonus = getImplementationBonus(querySignals, candidate, graphQuality);
  const lexical = getLexicalScores(querySignals, candidate);
  const anchorCoverage = querySignals.hasHardAnchors ? lexical.hardAnchorCoverage : lexical.softAnchorCoverage;
  const graphRelevance = lexical.tokenCoverage > 0 || anchorCoverage > 0 ? graphCentrality : graphCentrality * 0.2;
  const structure = structuralScore(candidate, graphQuality);
  const noisy = isGeneratedOrNoisyCandidate(candidate, querySignals);
  let rankingScore = (embeddingSimilarity * 0.50) + (lexical.lexicalScore * 0.25) + (lexical.tokenCoverage * 0.10) + (anchorCoverage * 0.20) + (graphRelevance * 0.06) + (structure * 0.05);
  if (recency > 0.5 && (lexical.tokenCoverage > 0 || anchorCoverage > 0)) rankingScore += 0.03;
  if (inCurrentDiff) rankingScore += 0.08;
  if (hasImplementation && (lexical.tokenCoverage > 0 || anchorCoverage > 0)) rankingScore += 0.04;
  if (candidate.connectedToOtherTopResults && (lexical.tokenCoverage > 0 || anchorCoverage > 0)) rankingScore += 0.04;
  rankingScore += implementationBonus;
  if (isTypeHeavy && lexical.lexicalScore < 0.25) rankingScore *= 0.9;
  if (noisy && lexical.tokenCoverage === 0 && anchorCoverage === 0) rankingScore *= 0.45;
  else if (noisy && lexical.lexicalScore < 0.35) rankingScore *= 0.75;
  if (candidate.bestChunkType === 'import' && lexical.lexicalScore < 0.25) rankingScore *= 0.75;
  let capReason = null;
  if (querySignals.issueIds.length > 0 && lexical.hardAnchorCoverage === 0) {
    rankingScore = Math.min(rankingScore, 0.38);
    capReason = 'issue-anchor-missing';
  } else if (querySignals.hasHardAnchors && lexical.hardAnchorCoverage === 0 && lexical.lexicalScore < 0.2) {
    rankingScore = Math.min(rankingScore, 0.42);
    capReason = 'hard-anchor-missing';
  } else if (lexical.tokenCoverage === 0 && anchorCoverage === 0 && noisy) {
    rankingScore = Math.min(rankingScore, 0.45);
    capReason = 'semantic-only-noisy';
  } else if (lexical.tokenCoverage === 0 && anchorCoverage === 0) {
    rankingScore = Math.min(rankingScore, 0.68);
    capReason = 'semantic-only';
  }
  const score = clamp(rankingScore);
  return {
    rankingScore,
    score,
    parts: {
      anchorCoverage,
      boost: 1,
      capReason,
      changeRelevance,
      connectedToOtherTopResults: Boolean(candidate.connectedToOtherTopResults),
      embeddingSimilarity,
      graphCentrality,
      graphRelevance,
      hardAnchorCoverage: lexical.hardAnchorCoverage,
      hasHardAnchors: querySignals.hasHardAnchors,
      hasImplementation,
      implementationBonus,
      isGeneratedOrNoisy: noisy,
      isTypeHeavy,
      lexicalScore: lexical.lexicalScore,
      nameMatch,
      rawScore: rankingScore,
      recency,
      semanticOnly: lexical.tokenCoverage === 0 && anchorCoverage === 0,
      softAnchorCoverage: lexical.softAnchorCoverage,
      structuralScore: structure,
      tokenCoverage: lexical.tokenCoverage,
      weightedEdges,
    },
  };
}

function getReason(candidate) {
  const parts = candidate.scoreParts || {};
  if (parts.capReason) return `semantic match (${parts.capReason}): ${candidate.bestChunkType || 'chunk'} ${candidate.bestChunkName || path.basename(candidate.path)}`;
  if (parts.lexicalScore > 0 || parts.anchorCoverage > 0) return `hybrid match: ${candidate.bestChunkType || 'chunk'} ${candidate.bestChunkName || path.basename(candidate.path)}`;
  if (candidate.bestChunkName) return `semantic match: ${candidate.bestChunkType || 'chunk'} ${candidate.bestChunkName}`;
  if (candidate.bestChunkType) return `semantic match: ${candidate.bestChunkType} chunk`;
  return `graph match: ${path.basename(candidate.path)}`;
}

module.exports = { getLexicalScores, getNameMatchScore, getQuerySignals, getReason, scoreCandidate, tokenizeQuery };
