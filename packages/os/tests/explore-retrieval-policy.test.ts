import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildLexicalSearchTerms,
  candidateMatchesOutputScope,
  candidateMatchesSeedScope,
  dependencySimilarity,
  extractExplicitScope,
  maximalMarginalRelevance,
  rankCandidatesWithFusion,
  reciprocalRankFusion,
} = require('../scripts/lib/search/retrieval-policy.js') as {
  buildLexicalSearchTerms: (query: string) => string[];
  candidateMatchesOutputScope: (candidate: Candidate, scope: ExplicitScope) => boolean;
  candidateMatchesSeedScope: (candidate: Candidate, scope: ExplicitScope) => boolean;
  dependencySimilarity: (left: Candidate, right: Candidate) => number;
  extractExplicitScope: (query: string) => ExplicitScope;
  maximalMarginalRelevance: <T>(items: T[], options: {
    budget: number;
    lambda: number;
    relevance: (item: T) => number;
    similarity: (left: T, right: T) => number;
  }) => T[];
  rankCandidatesWithFusion: (candidates: Candidate[], options?: { budget?: number }) => Candidate[];
  reciprocalRankFusion: (
    channels: Array<{ name: string; items: string[]; weight?: number }>,
    options?: { k?: number },
  ) => Array<{ id: string; score: number; ranks: Record<string, number> }>;
};

type ExplicitScope = {
  exactPaths: string[];
  pathPrefixes: string[];
  symbols: string[];
};

type Candidate = {
  id?: string;
  path: string;
  role?: string;
  symbol?: string;
  bestChunkName?: string | null;
  bestChunkType?: string | null;
  preview?: string;
  implementationNames?: string;
  semanticSimilarity?: number;
  lexicalSupport?: number;
  hasClassOrFunction?: boolean;
  graphConnectionCount?: number;
  includedBy?: string;
  scoreParts?: Record<string, unknown>;
  [key: string]: unknown;
};

describe('OS Explore E2 explicit retrieval scopes', () => {
  it('treats an explicit package/path phrase as a hard path prefix', () => {
    const scope = extractExplicitScope('Within packages/os/scripts/lib/search, where is Explore ranking implemented');

    expect(scope.pathPrefixes).toEqual(['packages/os/scripts/lib/search/']);
    expect(candidateMatchesSeedScope({ path: 'packages/os/scripts/lib/search/ranker.js' }, scope)).toBe(true);
    expect(candidateMatchesOutputScope({ path: 'packages/twenty-server/src/auth.ts' }, scope)).toBe(false);
  });

  it('does not turn an incidental path mention into a hard scope', () => {
    const scope = extractExplicitScope('changed file packages/dialer/src/dialer.ts selects dialer specs');

    expect(scope.pathPrefixes).toEqual([]);
    expect(scope.exactPaths).toEqual([]);
  });

  it('uses an explicit symbol as a seed constraint without hiding dependency outputs', () => {
    const scope = extractExplicitScope('where is function executeCodeCall implemented and what calls it');
    const owner = { path: 'packages/os/scripts/lib/code-call/runtime.ts', bestChunkName: 'executeCodeCall' };
    const dependency = { path: 'packages/os/scripts/code-call.ts', bestChunkName: 'main' };

    expect(scope.symbols).toEqual(['executecodecall']);
    expect(candidateMatchesSeedScope(owner, scope)).toBe(true);
    expect(candidateMatchesSeedScope(dependency, scope)).toBe(false);
    expect(candidateMatchesOutputScope(dependency, scope)).toBe(true);
  });
});

describe('OS Explore E2 reciprocal rank fusion', () => {
  it('fuses independent channel ranks without comparing raw score scales', () => {
    const fused = reciprocalRankFusion([
      { name: 'semantic', items: ['a', 'b', 'c'] },
      { name: 'lexical', items: ['b', 'a', 'd'] },
      { name: 'graph', items: ['d', 'b'] },
    ], { k: 60 });

    expect(fused.map((entry) => entry.id)).toEqual(['b', 'a', 'd', 'c']);
    expect(fused[0].ranks).toEqual({ semantic: 2, lexical: 1, graph: 2 });
    expect(fused[0].score).toBeCloseTo((1 / 62) + (1 / 61) + (1 / 62), 12);
  });

  it('is deterministic for ties and tolerant of empty channels', () => {
    const fused = reciprocalRankFusion([
      { name: 'semantic', items: ['z', 'a'] },
      { name: 'lexical', items: ['a', 'z'] },
      { name: 'graph', items: [] },
    ], { k: 60 });

    expect(fused[0].score).toBeCloseTo(fused[1].score, 12);
    expect(fused.map((entry) => entry.id)).toEqual(['a', 'z']);
  });
});

describe('OS Explore E2 lexical query construction', () => {
  it('prefers discriminative path phrases and roots over product boilerplate', () => {
    const terms = buildLexicalSearchTerms('how does Consuelo OS task start create an isolated task worktree');

    expect(terms).toContain('task-start');
    expect(terms).toContain('task');
    expect(terms).not.toContain('consuelo');
  });

  it('normalizes dotted and metadata lifecycle phrases to repository path forms', () => {
    expect(buildLexicalSearchTerms('how does code.call execute runtime metadata')).toEqual(expect.arrayContaining([
      'code-call',
      'runtime',
      'meta',
    ]));
    expect(buildLexicalSearchTerms('stream sync handles task metadata conflicts')).toEqual(expect.arrayContaining([
      'stream-sync',
      'task-meta',
    ]));
  });

  it('adds morphology roots that match implementation filenames and symbols', () => {
    expect(buildLexicalSearchTerms('Explore retrieval ranking and selected runtime')).toEqual(expect.arrayContaining([
      'retriev',
      'rank',
      'select',
    ]));
  });
});

describe('OS Explore E2 dependency diversity', () => {
  it('penalizes near-duplicate same-role files more than complementary roles', () => {
    const owner = { path: 'src/auth/auth-service.ts', role: 'implementation', symbol: 'AuthService' };
    const duplicate = { path: 'src/auth/auth-service-helper.ts', role: 'implementation', symbol: 'AuthServiceHelper' };
    const test = { path: 'src/auth/auth-service.test.ts', role: 'test', symbol: 'AuthService' };

    expect(dependencySimilarity(owner, duplicate)).toBeGreaterThan(dependencySimilarity(owner, test));
  });

  it('uses MMR to keep a complementary role ahead of a redundant near-duplicate when relevance is close', () => {
    const items = [
      { id: 'owner', path: 'src/auth/auth-service.ts', role: 'implementation', symbol: 'AuthService', relevance: 1 },
      { id: 'duplicate', path: 'src/auth/auth-service-helper.ts', role: 'implementation', symbol: 'AuthServiceHelper', relevance: 0.96 },
      { id: 'test', path: 'src/auth/auth-service.test.ts', role: 'test', symbol: 'AuthService', relevance: 0.92 },
    ];

    const reranked = maximalMarginalRelevance(items, {
      budget: 3,
      lambda: 0.82,
      relevance: (item) => item.relevance,
      similarity: dependencySimilarity,
    });

    expect(reranked.map((item) => item.id)).toEqual(['owner', 'test', 'duplicate']);
  });
});

describe('OS Explore E2 missing-channel ranking', () => {
  it('ranks a strong lexical implementation even when the semantic channel is absent', () => {
    const candidates: Candidate[] = [
      {
        path: 'packages/os/scripts/lib/search/retriever.js',
        bestChunkName: 'retrieve',
        bestChunkType: 'function',
        preview: 'retrieve semantic lexical graph candidates and rank results',
        implementationNames: 'retrieve expandGraph scoreCandidates',
        lexicalSupport: 9,
        semanticSimilarity: 0,
        hasClassOrFunction: true,
        graphConnectionCount: 2,
        scoreParts: { graphCentrality: 0.2 },
      },
      {
        path: 'packages/twenty-server/src/engine/api/graphql/services/scalars-explorer.service.ts',
        bestChunkName: 'ScalarsExplorerService',
        bestChunkType: 'class',
        preview: 'graphql scalar explorer service',
        implementationNames: 'ScalarsExplorerService',
        lexicalSupport: 1,
        semanticSimilarity: 0,
        hasClassOrFunction: true,
        graphConnectionCount: 12,
        scoreParts: { graphCentrality: 0.8 },
      },
    ];

    const ranked = rankCandidatesWithFusion(candidates, {
      budget: 2,
      query: 'where is Consuelo OS Explore retrieval ranking and graph expansion implemented',
    } as { budget: number });

    expect(ranked.map((candidate) => candidate.path)).toEqual([
      'packages/os/scripts/lib/search/retriever.js',
      'packages/twenty-server/src/engine/api/graphql/services/scalars-explorer.service.ts',
    ]);
  });
});
