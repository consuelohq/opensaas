import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const {
  buildExploreBenchReport,
  dedupeEvidenceEvents,
  evaluateBenchmark,
  measurePayloadFields,
  projectCompactExplorePayload,
  renderExploreBenchMarkdown,
  summarizeDistribution,
  summarizeToolAdoption,
  validateBenchmarkCases,
} = require('../scripts/lib/explore-bench.js');

describe('ExploreBench evidence and payload analysis', () => {
  it('deduplicates evidence events by stable id before tool adoption counts', () => {
    const events = [
      { id: 'a', action: 'explore' },
      { id: 'a', action: 'explore' },
      { id: 'b', source: 'decide-next', action: 'inspect next evidence' },
      { id: 'c', source: 'confidence-score', action: 'score confidence' },
      { id: 'd', source: 'exploit', action: 'exploit packages/a.ts' },
      { id: null, action: 'explore' },
    ];

    const deduped = dedupeEvidenceEvents(events);
    const adoption = summarizeToolAdoption(deduped);

    expect(deduped).toHaveLength(5);
    expect(adoption).toEqual({
      total: 5,
      explore: 2,
      decideNext: 1,
      confidenceScore: 1,
      exploit: 1,
    });
  });

  it('summarizes distributions with explicit interpolation-free nearest-rank quantiles', () => {
    expect(summarizeDistribution([1, 2, 3, 4, 100])).toEqual({
      count: 5,
      min: 1,
      max: 100,
      mean: 22,
      median: 3,
      p90: 100,
      p95: 100,
    });
    expect(summarizeDistribution([])).toEqual({
      count: 0,
      min: null,
      max: null,
      mean: null,
      median: null,
      p90: null,
      p95: null,
    });
  });

  it('attributes serialized payload bytes by top-level result field', () => {
    const results = [
      {
        path: 'packages/a.ts',
        preview: 'abc',
        target: { path: 'packages/a.ts', preview: 'abc' },
        score_parts: { lexicalScore: 0.5 },
      },
      {
        path: 'packages/b.ts',
        preview: 'xyz',
        target: { path: 'packages/b.ts', preview: 'xyz' },
        score_parts: { lexicalScore: 0.75 },
      },
    ];

    const measured = measurePayloadFields(results);

    expect(measured.resultCount).toBe(2);
    expect(measured.totalValueBytes).toBeGreaterThan(0);
    expect(measured.fields[0].bytes).toBeGreaterThanOrEqual(measured.fields.at(-1).bytes);
    expect(measured.fields.map((entry) => entry.field)).toContain('target');
    expect(measured.fields.map((entry) => entry.field)).toContain('score_parts');
    expect(measured.fields.reduce((sum, entry) => sum + entry.bytes, 0)).toBe(measured.totalValueBytes);
  });

  it('projects a compact packet without mutating the original Explore payload', () => {
    const payload = {
      query: 'auth routing',
      budget: 2,
      results: [
        {
          path: 'packages/auth.ts',
          score: 0.9,
          belief_prior: 0.7,
          symbol: 'authorize',
          chunk_type: 'function',
          evidence_state: 'read',
          information_value: 0.4,
          reason: 'hybrid match',
          preview: 'function authorize()',
          lines: { start: 10, end: 20 },
          graph_connections: ['packages/routes.ts', 'packages/auth.test.ts', 'packages/types.ts'],
          typed_edges: [{ path: 'packages/routes.ts', type: 'imported_by' }],
          target: { path: 'packages/auth.ts', preview: 'function authorize()' },
          score_parts: { rawScore: 0.9 },
        },
      ],
      source_routes: [],
      index_stats: { total_files: 100 },
    };
    const before = JSON.stringify(payload);

    const projected = projectCompactExplorePayload(payload, { maxConnections: 2 });

    expect(JSON.stringify(payload)).toBe(before);
    expect(projected.payload.results[0]).toEqual({
      path: 'packages/auth.ts',
      symbol: 'authorize',
      chunk_type: 'function',
      lines: { start: 10, end: 20 },
      score: 0.9,
      belief_prior: 0.7,
      evidence_state: 'read',
      information_value: 0.4,
      reason: 'hybrid match',
      preview: 'function authorize()',
      connections: ['packages/routes.ts', 'packages/auth.test.ts'],
    });
    expect(projected.compactBytes).toBeLessThan(projected.originalBytes);
    expect(projected.byteReductionFraction).toBeGreaterThan(0);
  });
});

describe('ExploreBench retrieval metrics and report contract', () => {
  const benchmarkCases = [
    {
      id: 'case-a',
      query: 'find auth routing',
      labels: [
        { path: 'packages/auth.ts', relevance: 3, role: 'owner', required: true },
        { path: 'packages/routes.ts', relevance: 2, role: 'caller', required: true },
        { path: 'packages/auth.test.ts', relevance: 1, role: 'test', required: false },
      ],
    },
    {
      id: 'case-unlabeled',
      query: 'needs curation',
      labels: [],
    },
  ];

  it('validates benchmark labels and rejects duplicate ids or invalid relevance', () => {
    expect(validateBenchmarkCases(benchmarkCases)).toEqual({
      caseCount: 2,
      labeledCaseCount: 1,
      unlabeledCaseCount: 1,
    });

    expect(() => validateBenchmarkCases([
      benchmarkCases[0],
      { ...benchmarkCases[0] },
    ])).toThrow(/duplicate benchmark case id/i);

    expect(() => validateBenchmarkCases([{
      id: 'bad',
      query: 'bad',
      labels: [{ path: 'a.ts', relevance: 4 }],
    }])).toThrow(/relevance/i);
  });

  it('computes Recall@k, required-node recall, MRR, and nDCG from curated labels only', () => {
    const report = evaluateBenchmark(benchmarkCases, new Map([
      ['case-a', [
        { path: 'packages/auth.test.ts' },
        { path: 'packages/auth.ts' },
        { path: 'packages/unrelated.ts' },
        { path: 'packages/routes.ts' },
      ]],
      ['case-unlabeled', [{ path: 'whatever.ts' }]],
    ]), { kValues: [1, 3, 5] });

    expect(report.caseCount).toBe(2);
    expect(report.evaluatedCaseCount).toBe(1);
    expect(report.unlabeledCaseCount).toBe(1);
    expect(report.metrics.recallAtK['1']).toBeCloseTo(1 / 3, 12);
    expect(report.metrics.recallAtK['3']).toBeCloseTo(2 / 3, 12);
    expect(report.metrics.recallAtK['5']).toBe(1);
    expect(report.metrics.requiredRecallAtK).toEqual({ '1': 0, '3': 1 / 2, '5': 1 });
    expect(report.metrics.mrr).toBe(1);
    expect(report.metrics.ndcgAtK['1']).toBeCloseTo(1 / 7, 12);
    expect(report.metrics.ndcgAtK['3']).toBeGreaterThan(report.metrics.ndcgAtK['1']);
    expect(report.metrics.ndcgAtK['5']).toBeLessThanOrEqual(1);
  });

  it('builds a sanitized aggregate report without embedding raw trace payloads', () => {
    const traceRows = [
      {
        tool: 'explore',
        inputTokens: 10,
        outputTokens: 9000,
        durationMs: 1000,
        payload: { query: 'secret raw query', results: [{ path: 'a.ts', score_parts: { raw: 1 } }] },
      },
      {
        tool: 'explore',
        inputTokens: 10,
        outputTokens: 3000,
        durationMs: 500,
        payload: { query: 'another raw query', results: [{ path: 'b.ts', score_parts: { raw: 2 } }] },
      },
    ];

    const report = buildExploreBenchReport({
      traceRows,
      evidenceEvents: [
        { id: 'a', action: 'explore' },
        { id: 'b', action: 'exploit' },
      ],
      benchmarkCases,
      rankingsByCaseId: new Map([['case-a', [{ path: 'packages/auth.ts' }]]]),
      generatedAt: '2026-08-15T00:00:00.000Z',
    });
    const serialized = JSON.stringify(report);

    expect(report.schemaVersion).toBe(1);
    expect(report.traceSummary.outputTokens).toMatchObject({ count: 2, median: 3000, max: 9000 });
    expect(report.toolAdoption).toMatchObject({ explore: 1, exploit: 1 });
    expect(report.payloadSummary.compactProjection.sampleCount).toBe(2);
    expect(report.payloadSummary.compactProjection.projectedOutputTokens.count).toBe(2);
    expect(report.payloadSummary.compactProjection.projectedOutputTokens.max).toBeGreaterThan(0);
    const markdown = renderExploreBenchMarkdown(report, { title: 'ExploreBench E0' });
    expect(markdown).toContain('# ExploreBench E0');
    expect(markdown).toContain('Recall@');
    expect(markdown).not.toContain('secret raw query');
    expect(serialized).not.toContain('secret raw query');
    expect(serialized).not.toContain('another raw query');
  });

  it('delegates the legacy Workspace ExploreBench CLI to the canonical OS benchmark', () => {
    const result = spawnSync('bun', ['packages/workspace/scripts/explore-bench.js', '--help'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: process.env,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('usage: bun run explore:benchmark');
  });

  it('preserves the canonical benchmark root cause through the legacy CLI surface', () => {
    const result = spawnSync('bun', [
      'packages/workspace/scripts/explore-bench.js',
      '--definitely-invalid',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: process.env,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('unknown flag: --definitely-invalid');
  });
});
