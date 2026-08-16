import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import { ExploreInput } from '../scripts/lib/facade/schemas';
import { toolHandlers } from '../tools/decision-engine/handler';

const require = createRequire(import.meta.url);
const { formatExploreOutput } = require('../scripts/lib/search/explore-output.js') as {
  formatExploreOutput: (payload: RichExplorePayload, detail?: 'compact' | 'full') => unknown;
};

type RichExploreResult = {
  path: string;
  score: number;
  retrieval_support: number;
  calibration_status: string;
  symbol: string;
  chunk_type: string;
  file_outline: string;
  typed_edges: Array<{ path: string; type: string; symbol: string | null }>;
  is_implementation: boolean;
  file_size: number;
  chunk_count: number;
  last_modified: number;
  has_test: boolean;
  package: string;
  changed_in_branch: boolean;
  evidence_state: string | null;
  reason: string;
  preview: string;
  graph_connections: string[];
  graph_connection_count: number;
  lines: { start: number; end: number };
  score_parts: Record<string, unknown>;
};

type RichExplorePayload = {
  query: string;
  budget: number;
  results: RichExploreResult[];
  policy: {
    policy_version: number;
    readiness: string;
    edit_ready: boolean;
    uncertainty: { reasons: string[] };
    next_action: { type: string; path: string | null };
    dependency_map: { primary: { root_path: string }; alternative_count: number };
  };
  voi_challenger: {
    voi_version: number;
    status: string;
    promotion_eligible: boolean;
    control_action: { type: string; path: string | null };
    research_candidate: {
      type: string;
      path: string;
      expected_proxy_gain: number;
      costs: { total_tokens: number; latency_ms: number; action_risk: number };
      break_even: { utility_per_token_if_latency_free: number; utility_per_ms_if_tokens_free: number };
    };
    recommended_replacement: null;
    shadow_recommendation?: null;
    agreement: boolean;
    net_voi: null;
    limitations: string[];
  };
  index_stats: {
    total_files: number;
    total_chunks: number;
    last_indexed: string;
    last_full_index: string;
    cache_root: string;
    files_indexed: number;
    chunks_embedded: number;
  };
};

function richPayload(): RichExplorePayload {
  const edgeTypes = ['tests', 'called_by', 'imports', 'imported_by', 'sibling', 'calls'];
  const results = Array.from({ length: 6 }, (_, index): RichExploreResult => {
    const path = `packages/os/scripts/example-${index}.ts`;
    const graphConnections = edgeTypes.map((type, edgeIndex) =>
      `packages/os/${type}/connected-${index}-${edgeIndex}.ts`);
    return {
      path,
      score: 0.92 - (index * 0.04),
      retrieval_support: index === 0 ? 0.8636 : 0.325,
      calibration_status: 'provisional',
      symbol: `exampleSymbol${index}`,
      chunk_type: index % 2 === 0 ? 'function' : 'class',
      file_outline: Array.from({ length: 12 }, (_, outlineIndex) => `Symbol${index}_${outlineIndex}`).join(' '),
      typed_edges: graphConnections.map((connectionPath, edgeIndex) => ({
        path: connectionPath,
        type: edgeTypes[edgeIndex],
        symbol: `edgeSymbol${index}_${edgeIndex}`,
      })),
      is_implementation: true,
      file_size: 24_000 + index,
      chunk_count: 24,
      last_modified: 1_786_000_000 + index,
      has_test: true,
      package: 'os',
      changed_in_branch: index === 0,
      evidence_state: index === 0 ? 'read' : null,
      reason: `hybrid match: ${index % 2 === 0 ? 'function' : 'class'} exampleSymbol${index}`,
      preview: `export function exampleSymbol${index}() { ${'return dependencyAwareValue; '.repeat(18)} }`,
      graph_connections: graphConnections,
      graph_connection_count: graphConnections.length,
      lines: { start: 10 + index, end: 40 + index },
      score_parts: {
        anchorCoverage: 0.8,
        embeddingSimilarity: 0.94,
        graphCentrality: 0.72,
        graphRelevance: 0.68,
        lexicalScore: 0.77,
        rawScore: 0.92 - (index * 0.04),
        structuralScore: 1,
        tokenCoverage: 0.75,
        weightedEdges: 12.4,
      },
    };
  });

  return {
    query: 'where is the explore decision engine wired to its tests and callers',
    budget: 6,
    results,
    policy: {
      policy_version: 1,
      readiness: 'gathering',
      edit_ready: false,
      uncertainty: { reasons: ['read the top hypothesis root'] },
      next_action: { type: 'read', path: 'packages/os/scripts/example-0.ts' },
      dependency_map: {
        primary: { root_path: 'packages/os/scripts/example-0.ts' },
        alternative_count: 2,
      },
    },
    voi_challenger: {
      voi_version: 1,
      status: 'provisional_evidence',
      promotion_eligible: false,
      control_action: { type: 'read', path: 'packages/os/scripts/example-0.ts' },
      research_candidate: {
        type: 'read',
        path: 'packages/os/scripts/example-0.ts',
        expected_proxy_gain: 0.4,
        costs: { total_tokens: 2031, latency_ms: 537, action_risk: 0 },
        break_even: { utility_per_token_if_latency_free: 0.000197, utility_per_ms_if_tokens_free: 0.000745 },
      },
      recommended_replacement: null,
      agreement: true,
      net_voi: null,
      limitations: ['research only', 'not causal'],
    },
    index_stats: {
      total_files: 15_710,
      total_chunks: 80_769,
      last_indexed: '2026-08-15T07:00:00.554Z',
      last_full_index: '2026-05-28T22:34:26.578Z',
      cache_root: '/Users/example/.cache/workspace-index/example',
      files_indexed: 3,
      chunks_embedded: 17,
    },
  };
}

describe('Explore compact response contract', () => {
  it('keeps result order and actionable dependency context while dropping diagnostic bulk', () => {
    const rich = richPayload();
    const before = structuredClone(rich);
    const compact = formatExploreOutput(rich, 'compact') as {
      detail: string;
      query: string;
      budget: number;
      results: Array<Record<string, unknown> & {
        path: string;
        connections: Array<{ path: string; type: string }>;
        connection_count: number;
        preview: string;
      }>;
    };

    expect(compact.detail).toBe('compact');
    expect(compact.query).toBe(rich.query);
    expect(compact.budget).toBe(rich.budget);
    expect((compact as { policy?: unknown }).policy).toEqual(rich.policy);
    expect((compact as { voi_challenger?: unknown }).voi_challenger).toEqual({
      voi_version: 1,
      status: 'provisional_evidence',
      promotion_eligible: false,
      control_action: { type: 'read', path: 'packages/os/scripts/example-0.ts' },
      research_candidate: { type: 'read', path: 'packages/os/scripts/example-0.ts', expected_proxy_gain: 0.4 },
      recommended_replacement: null,
      shadow_recommendation: null,
      agreement: true,
      net_voi: null,
    });
    expect(compact.results.map((result) => result.path)).toEqual(rich.results.map((result) => result.path));

    const first = compact.results[0];
    expect(first).toMatchObject({
      path: rich.results[0].path,
      score: rich.results[0].score,
      symbol: rich.results[0].symbol,
      chunk_type: rich.results[0].chunk_type,
      lines: rich.results[0].lines,
      reason: rich.results[0].reason,
      evidence_state: rich.results[0].evidence_state,
      retrieval_support: rich.results[0].retrieval_support,
      calibration_status: 'provisional',
      has_test: true,
      changed_in_branch: true,
      is_implementation: true,
      connection_count: 6,
    });
    expect(first.connections).toHaveLength(3);
    expect(first.connections).toEqual(rich.results[0].typed_edges.slice(0, 3).map(({ path, type }) => ({ path, type })));
    expect(first.preview.length).toBeLessThanOrEqual(240);

    for (const diagnosticField of ['typed_edges', 'score_parts', 'file_outline', 'file_size', 'chunk_count', 'last_modified', 'graph_connections', 'package']) {
      expect(first).not.toHaveProperty(diagnosticField);
    }
    expect(rich).toEqual(before);
  });

  it('preserves the exact rich object for explicit full detail', () => {
    const rich = richPayload();
    expect(formatExploreOutput(rich, 'full')).toBe(rich);
  });

  it('cuts a representative rich payload by at least half without dropping ranked results', () => {
    const rich = richPayload();
    const compact = formatExploreOutput(rich, 'compact');
    const fullBytes = Buffer.byteLength(JSON.stringify(rich));
    const compactBytes = Buffer.byteLength(JSON.stringify(compact));

    expect((compact as { results: unknown[] }).results).toHaveLength(rich.results.length);
    expect(compactBytes / fullBytes).toBeLessThanOrEqual(0.5);
  });
});

describe('Explore typed facade detail contract', () => {
  it('accepts only compact or full detail modes', () => {
    expect(ExploreInput.safeParse({ query: 'workspace facade', detail: 'compact' }).success).toBe(true);
    expect(ExploreInput.safeParse({ query: 'workspace facade', detail: 'full' }).success).toBe(true);
    expect(ExploreInput.safeParse({ query: 'workspace facade', detail: 'debug' }).success).toBe(false);
  });

  it('forwards detail to the Explore CLI', () => {
    const exploreHandler = toolHandlers.find((handler) => handler.name === 'explore');
    expect(exploreHandler?.command.arguments).toContainEqual({
      source: 'detail',
      flag: '--detail',
      kind: 'value',
    });
  });
});
