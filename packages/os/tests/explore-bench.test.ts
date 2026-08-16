import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  evaluateBenchmark,
  evaluateVoiShadowBenchmark,
  validateBenchmarkCases,
} = require('../scripts/lib/explore-bench.js') as {
  evaluateBenchmark: (
    cases: BenchmarkCase[],
    rankings: Map<string, Array<{ path: string }>>,
    options?: { kValues?: number[] },
  ) => BenchmarkReport;
  evaluateVoiShadowBenchmark: (
    cases: BenchmarkCase[],
    decisions: Map<string, { control_action?: { path?: string | null }; research_candidate?: { path?: string | null } | null }>,
  ) => {
    caseCount: number;
    evaluatedCaseCount: number;
    agreementRate: number;
    controlMeanRelevance: number;
    challengerMeanRelevance: number;
    controlRequiredHitRate: number;
    challengerRequiredHitRate: number;
    caseResults: Array<{
      id: string;
      agreement: boolean;
      controlRelevance: number;
      challengerRelevance: number;
      relevanceDelta: number;
      controlRequiredHit: boolean;
      challengerRequiredHit: boolean;
      requiredHitDelta: number;
    }>;
  };
  validateBenchmarkCases: (cases: BenchmarkCase[]) => {
    caseCount: number;
    labeledCaseCount: number;
    unlabeledCaseCount: number;
  };
};

type BenchmarkLabel = {
  path: string;
  relevance: number;
  role?: string;
  required?: boolean;
};

type BenchmarkCase = {
  id: string;
  query: string;
  labels: BenchmarkLabel[];
};

type BenchmarkReport = {
  caseCount: number;
  evaluatedCaseCount: number;
  metrics: {
    recallAtK: Record<string, number>;
    requiredRecallAtK: Record<string, number>;
    mrr: number;
    ndcgAtK: Record<string, number>;
  };
};

const cases: BenchmarkCase[] = [
  {
    id: 'auth-owner',
    query: 'find auth owner and caller',
    labels: [
      { path: 'src/auth.ts', relevance: 3, role: 'owner', required: true },
      { path: 'src/routes.ts', relevance: 2, role: 'caller', required: true },
      { path: 'src/auth.test.ts', relevance: 1, role: 'test', required: false },
    ],
  },
  {
    id: 'unlabeled',
    query: 'needs curation',
    labels: [],
  },
];

describe('OS ExploreBench retrieval metrics', () => {
  it('validates cases and rejects duplicate ids or invalid relevance', () => {
    expect(validateBenchmarkCases(cases)).toEqual({
      caseCount: 2,
      labeledCaseCount: 1,
      unlabeledCaseCount: 1,
    });

    expect(() => validateBenchmarkCases([cases[0], { ...cases[0] }])).toThrow(/duplicate/i);
    expect(() => validateBenchmarkCases([{
      id: 'bad',
      query: 'bad',
      labels: [{ path: 'a.ts', relevance: 4 }],
    }])).toThrow(/relevance/i);
  });

  it('computes Recall@k, required-node recall, MRR, and nDCG from curated labels', () => {
    const report = evaluateBenchmark(cases, new Map([
      ['auth-owner', [
        { path: 'src/auth.test.ts' },
        { path: 'src/auth.ts' },
        { path: 'src/unrelated.ts' },
        { path: 'src/routes.ts' },
      ]],
    ]), { kValues: [1, 3, 5] });

    expect(report.caseCount).toBe(2);
    expect(report.evaluatedCaseCount).toBe(1);
    expect(report.metrics.recallAtK['1']).toBeCloseTo(1 / 3, 12);
    expect(report.metrics.recallAtK['3']).toBeCloseTo(2 / 3, 12);
    expect(report.metrics.recallAtK['5']).toBe(1);
    expect(report.metrics.requiredRecallAtK).toEqual({ '1': 0, '3': 0.5, '5': 1 });
    expect(report.metrics.mrr).toBe(1);
    expect(report.metrics.ndcgAtK['1']).toBeCloseTo(1 / 7, 12);
    expect(report.metrics.ndcgAtK['5']).toBeLessThanOrEqual(1);
  });

  it('keeps the benchmark CLI syntactically executable', () => {
    const packageRoot = fileURLToPath(new URL('..', import.meta.url));
    const result = spawnSync('bun', ['run', 'explore:benchmark', '--', '--help'], {
      cwd: packageRoot,
      encoding: 'utf8',
      env: process.env,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('usage: bun run explore:benchmark');
  });

  it('scores E5 shadow actions against curated labels without inventing counterfactual outcomes', () => {
    const report = evaluateVoiShadowBenchmark(cases, new Map([
      ['auth-owner', {
        status: 'evaluable_shadow',
        challenger_configuration_id: 'test-e5-config-v1',
        control_action: { path: 'src/auth.test.ts' },
        research_candidate: { path: 'src/routes.ts' },
        shadow_recommendation: { path: 'src/auth.ts' },
      }],
    ]));

    expect(report.evaluatedCaseCount).toBe(1);
    expect(report.agreementRate).toBe(0);
    expect(report.controlMeanRelevance).toBe(1);
    expect(report.challengerMeanRelevance).toBe(3);
    expect(report.controlRequiredHitRate).toBe(0);
    expect(report.challengerRequiredHitRate).toBe(1);
    expect(report.caseResults).toEqual([{
      id: 'auth-owner',
      challengerConfigurationId: 'test-e5-config-v1',
      challengerStatus: 'evaluable_shadow',
      challengerUsedFallback: false,
      agreement: false,
      controlRelevance: 1,
      challengerRelevance: 3,
      relevanceDelta: 2,
      controlRequiredHit: false,
      challengerRequiredHit: true,
      requiredHitDelta: 1,
    }]);
  });
  it('scores the E5 policy action, falling back to E4 on abstention and excluding non-evaluable studies', () => {
    const abstained = evaluateVoiShadowBenchmark([cases[0]], new Map([
      ['auth-owner', {
        status: 'evaluable_shadow',
        challenger_configuration_id: 'test-e5-config-v1',
        control_action: { path: 'src/auth.test.ts' },
        research_candidate: { path: 'src/auth.ts' },
        shadow_recommendation: null,
      }],
    ]));
    expect(abstained.evaluatedCaseCount).toBe(1);
    expect(abstained.caseResults[0]).toMatchObject({
      challengerConfigurationId: 'test-e5-config-v1',
      challengerStatus: 'evaluable_shadow',
      challengerUsedFallback: true,
      agreement: true,
      controlRelevance: 1,
      challengerRelevance: 1,
      relevanceDelta: 0,
    });

    const provisional = evaluateVoiShadowBenchmark([cases[0]], new Map([
      ['auth-owner', {
        status: 'provisional_evidence',
        challenger_configuration_id: 'test-e5-config-v1',
        control_action: { path: 'src/auth.test.ts' },
        research_candidate: { path: 'src/auth.ts' },
        shadow_recommendation: { path: 'src/auth.ts' },
      }],
    ]));
    expect(provisional.evaluatedCaseCount).toBe(0);
    expect(provisional.caseResults).toEqual([]);
  });

});
