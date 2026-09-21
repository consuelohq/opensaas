'use strict';

const DEFAULT_RRF_K = 60;
const DEFAULT_MMR_LAMBDA = 0.95;
const DEFAULT_CHANNEL_WEIGHTS = Object.freeze({
  semantic: 1.4,
  lexical: 1.5,
  exact: 1.7,
  scope: 1.15,
  structural: 0.35,
  graph: 0.35,
});

const QUERY_STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'code', 'consuelo', 'does', 'file', 'files',
  'for', 'from', 'has', 'have', 'how', 'implemented', 'implementation', 'into', 'its',
  'locate', 'make', 'not', 'package', 'packages', 'run', 'that', 'the', 'this', 'tool',
  'use', 'using', 'was', 'were', 'what', 'when', 'where', 'which', 'with', 'work',
]);

const PHRASE_STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'consuelo', 'does', 'for', 'from',
  'has', 'have', 'how', 'implemented', 'implementation', 'in', 'into', 'is', 'its',
  'of', 'on', 'the', 'this', 'to', 'use', 'using', 'was', 'were', 'what', 'when',
  'where', 'which', 'with', 'work',
]);

function clamp(value, min = 0, max = 1) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizePathScope(value) {
  return String(value || '')
    .trim()
    .replace(/^[`'\"]+|[`'\".,;:!?]+$/g, '')
    .replace(/^\.\//, '')
    .replace(/\\/g, '/');
}

function splitCompoundToken(token) {
  return String(token || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function tokenize(value) {
  return String(value || '')
    .split(/\s+/)
    .flatMap(splitCompoundToken)
    .filter((token) => token.length >= 3 && !QUERY_STOPWORDS.has(token));
}

function unique(values) {
  return Array.from(new Set(values));
}

function extractExplicitScope(query) {
  const raw = String(query || '');
  const exactPaths = [];
  const pathPrefixes = [];
  const symbols = [];

  const pathPattern = /\b(?:in|within|inside|under|from)\s+[`'\"]?((?:packages|apps|src|scripts|tests)\/[A-Za-z0-9._/-]+)[`'\"]?/gi;
  let match;
  while ((match = pathPattern.exec(raw)) !== null) {
    const candidate = normalizePathScope(match[1]);
    if (!candidate) continue;
    if (/\.[A-Za-z0-9]+$/.test(candidate)) {
      exactPaths.push(candidate.toLowerCase());
    } else {
      pathPrefixes.push(`${candidate.replace(/\/+$/, '')}/`.toLowerCase());
    }
  }

  const symbolPattern = /\b(?:symbol|function|class|method|type)\s+[`'\"]?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)[`'\"]?/gi;
  while ((match = symbolPattern.exec(raw)) !== null) {
    symbols.push(String(match[1]).toLowerCase());
  }

  return {
    exactPaths: unique(exactPaths).sort(),
    pathPrefixes: unique(pathPrefixes).sort(),
    symbols: unique(symbols).sort(),
  };
}

function candidatePath(candidate) {
  return normalizePathScope(candidate?.path || candidate?.filePath || candidate?.file_path || '').toLowerCase();
}

function candidateSymbolText(candidate) {
  return [
    candidate?.bestChunkName,
    candidate?.bestChunk?.name,
    candidate?.bestChunk?.symbolPath,
    candidate?.name,
    candidate?.symbol,
    candidate?.symbolPath,
    candidate?.symbol_path,
    candidate?.implementationNames,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matchesPathScope(candidate, scope) {
  const filePath = candidatePath(candidate);
  if (scope.exactPaths.length > 0 && !scope.exactPaths.includes(filePath)) return false;
  if (scope.pathPrefixes.length > 0 && !scope.pathPrefixes.some((prefix) => filePath.startsWith(prefix))) return false;
  return true;
}

function candidateMatchesSeedScope(candidate, scope) {
  if (!matchesPathScope(candidate, scope)) return false;
  if (scope.symbols.length === 0) return true;
  const symbolText = candidateSymbolText(candidate);
  return scope.symbols.some((symbol) => symbolText.includes(symbol));
}

function candidateMatchesOutputScope(candidate, scope) {
  return matchesPathScope(candidate, scope);
}

function itemId(item) {
  if (typeof item === 'string') return item;
  return String(item?.id || item?.path || '');
}

function reciprocalRankFusion(channels, options = {}) {
  const k = Number.isFinite(options.k) && options.k >= 0 ? options.k : DEFAULT_RRF_K;
  const byId = new Map();

  for (const channel of channels || []) {
    const name = String(channel?.name || '').trim();
    if (!name) continue;
    const weight = Number.isFinite(channel?.weight) && channel.weight > 0 ? channel.weight : 1;
    const seen = new Set();
    const items = Array.isArray(channel?.items) ? channel.items : [];

    for (let index = 0; index < items.length; index += 1) {
      const id = itemId(items[index]);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const rank = index + 1;
      const contribution = weight / (k + rank);
      const entry = byId.get(id) || { id, score: 0, ranks: {} };
      entry.score += contribution;
      entry.ranks[name] = rank;
      byId.set(id, entry);
    }
  }

  return Array.from(byId.values()).sort((left, right) => {
    const scoreDelta = right.score - left.score;
    if (Math.abs(scoreDelta) > Number.EPSILON) return scoreDelta;
    return left.id.localeCompare(right.id);
  });
}

function tokenSet(value) {
  return new Set(tokenize(value));
}

function jaccard(leftTokens, rightTokens) {
  const left = leftTokens instanceof Set ? leftTokens : new Set(leftTokens);
  const right = rightTokens instanceof Set ? rightTokens : new Set(rightTokens);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

function inferDependencyRole(candidate) {
  if (candidate?.role) return String(candidate.role);
  const filePath = String(candidate?.path || '').toLowerCase();
  const chunkType = String(candidate?.bestChunkType || '').toLowerCase();
  const includedBy = String(candidate?.includedBy || '').toLowerCase();

  if (/\.(test|spec)\.[jt]sx?$/.test(filePath) || filePath.includes('/__tests__/') || filePath.includes('/tests/')) {
    return 'test';
  }
  if (includedBy === 'tests' || includedBy === 'tested_by') return 'test';
  if (filePath.endsWith('package.json') || /manifest|config|schema/.test(filePath)) return 'configuration';
  if (/\/generated\//.test(filePath) || /\/(dist|build)\//.test(filePath)) return 'generated';
  if (chunkType === 'type' || chunkType === 'export' || chunkType === 'import') return 'interface';
  if (chunkType === 'class' || chunkType === 'method' || chunkType === 'function' || candidate?.hasClassOrFunction) {
    return 'implementation';
  }
  return 'support';
}

function dependencySimilarity(left, right) {
  const pathSimilarity = jaccard(tokenSet(left?.path), tokenSet(right?.path));
  const symbolSimilarity = jaccard(
    tokenSet(left?.symbol || left?.bestChunkName || left?.bestChunk?.symbolPath),
    tokenSet(right?.symbol || right?.bestChunkName || right?.bestChunk?.symbolPath),
  );
  const baseSimilarity = Math.max(pathSimilarity, symbolSimilarity);
  const sameRole = inferDependencyRole(left) === inferDependencyRole(right);
  return clamp(baseSimilarity * (sameRole ? 1 : 0.35));
}

function maximalMarginalRelevance(items, options = {}) {
  const budget = Math.max(0, Math.min(items.length, Number(options.budget ?? items.length)));
  const lambda = Number.isFinite(options.lambda)
    ? clamp(options.lambda)
    : DEFAULT_MMR_LAMBDA;
  const relevance = options.relevance || ((item) => Number(item?.relevance || 0));
  const similarity = options.similarity || dependencySimilarity;
  const remaining = items.slice();
  const selected = [];

  while (selected.length < budget && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let index = 0; index < remaining.length; index += 1) {
      const item = remaining[index];
      const maxSimilarity = selected.length === 0
        ? 0
        : Math.max(...selected.map((chosen) => similarity(item, chosen)));
      const mmrScore = (lambda * relevance(item)) - ((1 - lambda) * maxSimilarity);
      if (mmrScore > bestScore + Number.EPSILON) {
        bestIndex = index;
        bestScore = mmrScore;
        continue;
      }
      if (Math.abs(mmrScore - bestScore) <= Number.EPSILON) {
        const currentId = itemId(item);
        const bestId = itemId(remaining[bestIndex]);
        if (currentId.localeCompare(bestId) < 0) bestIndex = index;
      }
    }

    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected;
}

function queryTokens(query) {
  return unique(tokenize(query));
}

function morphologyRoot(token) {
  if (token === 'metadata') return 'meta';
  if (token === 'expansion') return 'expand';
  if (token === 'generated') return 'generate';
  if (token === 'initialized' || token === 'initialize') return 'init';
  if (token.endsWith('ing') && token.length >= 7) return token.slice(0, -3);
  if (token.endsWith('ed') && token.length >= 7) return token.slice(0, -2);
  if (token.endsWith('al') && token.length >= 7) return token.slice(0, -2);
  if (token.endsWith('ies') && token.length >= 7) return `${token.slice(0, -3)}y`;
  if (token.endsWith('s') && token.length >= 6 && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function buildLexicalSearchTerms(query) {
  const raw = String(query || '');
  const lowered = raw.toLowerCase();
  const baseTokens = queryTokens(raw);
  const roots = unique(baseTokens.map(morphologyRoot).filter((token) => token.length >= 3));
  const phraseTokens = lowered
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !PHRASE_STOPWORDS.has(token));
  const phraseRoots = phraseTokens.map(morphologyRoot);
  const compounds = [];

  for (let index = 0; index < phraseTokens.length - 1; index += 1) {
    compounds.push(`${phraseTokens[index]}-${phraseTokens[index + 1]}`);
    const rooted = `${phraseRoots[index]}-${phraseRoots[index + 1]}`;
    if (rooted !== compounds.at(-1)) compounds.push(rooted);
  }

  const explicitCompounds = (lowered.match(/\b[a-z][\w-]*[.-][a-z][\w.-]*\b/g) || [])
    .flatMap((value) => [value.replace(/\./g, '-'), value]);

  return unique([
    ...explicitCompounds,
    ...compounds,
    ...roots,
    ...baseTokens,
  ])
    .filter((term) => term.length >= 3 && term !== 'consuelo')
    .slice(0, 24);
}

function candidateSearchText(candidate) {
  return [
    candidate?.path,
    candidate?.bestChunkName,
    candidate?.bestChunk?.symbolPath,
    candidate?.preview,
    candidate?.implementationNames,
  ].filter(Boolean).join(' ').toLowerCase();
}

function lexicalCoverage(candidate, query) {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return 0;
  const text = candidateSearchText(candidate);
  let matched = 0;
  for (const token of tokens) {
    if (text.includes(token)) matched += 1;
  }
  return matched / tokens.length;
}

function exactEvidence(candidate, query) {
  const lowered = String(query || '').toLowerCase();
  const text = candidateSearchText(candidate);
  const quoted = Array.from(lowered.matchAll(/["'`]([^"'`]+)["'`]/g)).map((match) => match[1]);
  const issueIds = lowered.match(/\b[a-z][a-z0-9]+-\d+\b/g) || [];
  const dotted = lowered.match(/\b[a-z][\w-]+\.[a-z][\w.-]+\b/g) || [];
  const symbols = extractExplicitScope(query).symbols;
  const pathText = candidatePath(candidate);
  const pathCompounds = buildLexicalSearchTerms(query)
    .filter((term) => term.includes('-') || term.includes('.'));
  if (pathCompounds.some((term) => pathText.includes(term))) return 1;

  const anchors = unique([...quoted, ...issueIds, ...dotted, ...symbols]).filter((value) => value.length >= 3);
  if (anchors.length === 0) return 0;
  return anchors.filter((anchor) => text.includes(anchor)).length / anchors.length;
}

function scopeEvidence(candidate, query) {
  const filePath = candidatePath(candidate);
  const lowered = String(query || '').toLowerCase();
  if (/\bconsuelo\s+os\b/.test(lowered) && filePath.startsWith('packages/os/')) return 1;
  const scope = extractExplicitScope(query);
  if ((scope.exactPaths.length > 0 || scope.pathPrefixes.length > 0) && matchesPathScope(candidate, scope)) return 1;
  return 0;
}

function structuralEvidence(candidate) {
  switch (candidate?.bestChunkType) {
    case 'class':
    case 'method':
    case 'function':
      return 1;
    case 'type':
    case 'export':
      return 0.7;
    case 'test':
      return 0.65;
    case 'block':
      return 0.3;
    case 'import':
      return 0.2;
    default:
      return candidate?.hasClassOrFunction ? 0.5 : 0.2;
  }
}

function channelRanking(candidates, score, options = {}) {
  const minimum = Number(options.minimum || 0);
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Math.floor(options.limit) : candidates.length;
  return candidates
    .map((candidate) => ({ candidate, value: Number(score(candidate) || 0) }))
    .filter((entry) => Number.isFinite(entry.value) && entry.value > minimum)
    .sort((left, right) => {
      const delta = right.value - left.value;
      if (Math.abs(delta) > Number.EPSILON) return delta;
      return String(left.candidate.path).localeCompare(String(right.candidate.path));
    })
    .slice(0, limit)
    .map((entry) => entry.candidate.path);
}

function rankCandidatesWithFusion(candidates, options = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const query = String(options.query || '');
  const budget = Math.max(0, Math.min(candidates.length, Number(options.budget ?? candidates.length)));
  const channelLimit = Math.max(budget * 4, 20);
  const lexicalScore = (candidate) => Math.max(
    Number(candidate?.lexicalSupport || 0),
    lexicalCoverage(candidate, query),
  );
  const querySupported = (candidate) => lexicalScore(candidate) > 0 || exactEvidence(candidate, query) > 0;
  const weights = { ...DEFAULT_CHANNEL_WEIGHTS, ...(options.channelWeights || {}) };

  const channels = [
    {
      name: 'semantic',
      weight: weights.semantic,
      items: channelRanking(candidates, (candidate) => Number(candidate?.semanticSimilarity || 0), { limit: channelLimit }),
    },
    {
      name: 'lexical',
      weight: weights.lexical,
      items: channelRanking(candidates, lexicalScore, { limit: channelLimit }),
    },
    {
      name: 'exact',
      weight: weights.exact,
      items: channelRanking(candidates, (candidate) => exactEvidence(candidate, query), { limit: channelLimit }),
    },
    {
      name: 'scope',
      weight: weights.scope,
      items: channelRanking(candidates, (candidate) => {
        const scope = scopeEvidence(candidate, query);
        if (scope === 0 || !querySupported(candidate)) return 0;
        return scope * (1 + lexicalCoverage(candidate, query) + Math.min(1, Number(candidate?.lexicalSupport || 0) / 20));
      }, { limit: channelLimit }),
    },
    {
      name: 'structural',
      weight: weights.structural,
      items: channelRanking(candidates, (candidate) => (
        querySupported(candidate) ? structuralEvidence(candidate) * Math.max(lexicalCoverage(candidate, query), 0.25) : 0
      ), { limit: channelLimit }),
    },
    {
      name: 'graph',
      weight: weights.graph,
      items: channelRanking(candidates, (candidate) => {
        if (!querySupported(candidate)) return 0;
        const graph = Number(candidate?.scoreParts?.graphCentrality ?? candidate?.graphCentrality ?? 0);
        const connections = Number(candidate?.graphConnectionCount || 0);
        return Math.max(graph, Math.min(1, connections / 20)) * Math.max(lexicalCoverage(candidate, query), 0.25);
      }, { limit: channelLimit }),
    },
  ];

  const fused = reciprocalRankFusion(channels, { k: options.rrfK ?? DEFAULT_RRF_K });
  const candidateByPath = new Map(candidates.map((candidate) => [candidate.path, candidate]));
  const maxFusion = fused[0]?.score || 1;
  const decorated = fused.map((entry) => {
    const candidate = candidateByPath.get(entry.id);
    return {
      ...candidate,
      dependencyRole: inferDependencyRole(candidate),
      fusionChannels: Object.keys(entry.ranks),
      fusionRanks: entry.ranks,
      fusionScore: entry.score,
      fusionRelevance: maxFusion > 0 ? entry.score / maxFusion : 0,
    };
  });

  return maximalMarginalRelevance(decorated, {
    budget,
    lambda: options.mmrLambda ?? DEFAULT_MMR_LAMBDA,
    relevance: (candidate) => candidate.fusionRelevance,
    similarity: dependencySimilarity,
  });
}

module.exports = {
  DEFAULT_CHANNEL_WEIGHTS,
  DEFAULT_MMR_LAMBDA,
  DEFAULT_RRF_K,
  buildLexicalSearchTerms,
  candidateMatchesOutputScope,
  candidateMatchesSeedScope,
  dependencySimilarity,
  exactEvidence,
  extractExplicitScope,
  inferDependencyRole,
  lexicalCoverage,
  maximalMarginalRelevance,
  rankCandidatesWithFusion,
  reciprocalRankFusion,
  scopeEvidence,
  tokenizeQuery: queryTokens,
};
