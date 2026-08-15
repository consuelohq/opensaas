import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  evaluateBenchmark,
  validateBenchmarkCases,
} = require('../scripts/lib/explore-bench.js') as {
  evaluateBenchmark: (
    cases: BenchmarkCase[],
    rankings: Map<string, Array<{ path: string }>>,
    options?: { kValues?: number[] },
  ) => BenchmarkReport;
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
});
