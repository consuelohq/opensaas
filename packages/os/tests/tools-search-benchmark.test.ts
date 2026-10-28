import { describe, expect, it } from 'vitest';

import {
  clusterBenchmarkCases,
  deriveWeakLabels,
  evaluateBenchmarkCases,
  historicalCasesFromTraceRows,
  loadGoldCases,
  splitBenchmarkCases,
  type BenchmarkCase,
  type SearchResult,
  type TraceRow,
} from '../scripts/tools-search-benchmark';
import { runToolSearch } from '../scripts/tools-search';

describe('tools.search benchmark corpus mechanics', () => {
  it('keeps near-duplicate paraphrases in the same cluster', () => {
    const cases: BenchmarkCase[] = [
      { id: 'a', query: 'show vercel deployment logs', source: 'gold', expected: ['deployment.logs'] },
      { id: 'b', query: 'can you show me the vercel deployment logs please', source: 'gold', expected: ['deployment.logs'] },
      { id: 'c', query: 'list local files', source: 'gold', expected: ['fs.list'] },
    ];
    const clustered = clusterBenchmarkCases(cases);
    expect(clustered.find((item) => item.id === 'a')?.clusterId).toBe(clustered.find((item) => item.id === 'b')?.clusterId);
    expect(clustered.find((item) => item.id === 'a')?.clusterId).not.toBe(clustered.find((item) => item.id === 'c')?.clusterId);
  });

  it('does not leak a cluster across tuning and holdout splits', () => {
    const cases: BenchmarkCase[] = Array.from({ length: 30 }, (_, index) => ({
      id: String(index),
      query: index % 2 === 0 ? `show vercel logs ${Math.floor(index / 2)}` : `list local files ${Math.floor(index / 2)}`,
      source: 'historical' as const,
      timestamp: new Date(2026, 7, 1, 0, index).toISOString(),
    }));
    const split = splitBenchmarkCases(clusterBenchmarkCases(cases));
    const tuning = new Set(split.tuning.map((item) => item.clusterId));
    const validation = new Set(split.validation.map((item) => item.clusterId));
    expect([...tuning].some((id) => validation.has(id))).toBe(false);
    expect(split.timeHoldout.every((item) => !split.tuning.some((other) => other.id === item.id))).toBe(true);
  });

  it('derives weak labels only from strongly related downstream traces', () => {
    const rows: TraceRow[] = [
      { id: '1', ts: '2026-08-11T10:00:00Z', traceId: 's1', mcpTraceId: 'm1', source: 'mcp', tool: 'tools.search', taskSession: null, branch: null, ok: true, inputJson: JSON.stringify({ query: 'git diff' }), resultJson: '{}' },
      { id: '2', ts: '2026-08-11T10:00:01Z', traceId: 'x1', mcpTraceId: 'm1', source: 'mcp', tool: 'git.diff', taskSession: null, branch: null, ok: true, inputJson: '{}', resultJson: '{}' },
      { id: '3', ts: '2026-08-11T10:01:00Z', traceId: 's2', mcpTraceId: null, source: 'mcp', tool: 'tools.search', taskSession: null, branch: null, ok: true, inputJson: JSON.stringify({ query: 'ambiguous' }), resultJson: '{}' },
      { id: '4', ts: '2026-08-11T10:01:01Z', traceId: 'x2', mcpTraceId: null, source: 'other', tool: 'fs.read', taskSession: null, branch: null, ok: true, inputJson: '{}', resultJson: '{}' },
    ];
    const labels = deriveWeakLabels(rows);
    expect(labels.get('s1')?.selectedTool).toBe('git.diff');
    expect(labels.has('s2')).toBe(false);
  });
  it('only promotes downstream usage to a historical weak label when the tool was actually returned and succeeded', () => {
    const searchResult = JSON.stringify({ matches: [{ name: 'git.diff' }, { name: 'git.status' }] });
    const rows: TraceRow[] = [
      { id: '1', ts: '2026-08-11T10:00:00Z', traceId: 's1', mcpTraceId: 'm1', source: 'mcp', tool: 'tools.search', taskSession: null, branch: null, ok: true, inputJson: JSON.stringify({ query: 'git diff' }), resultJson: searchResult },
      { id: '2', ts: '2026-08-11T10:00:01Z', traceId: 'x1', mcpTraceId: 'm1', source: 'mcp', tool: 'git.diff', taskSession: null, branch: null, ok: true, inputJson: '{}', resultJson: '{}' },
      { id: '3', ts: '2026-08-11T10:01:00Z', traceId: 's2', mcpTraceId: 'm2', source: 'mcp', tool: 'tools.search', taskSession: null, branch: null, ok: true, inputJson: JSON.stringify({ query: 'git diff again' }), resultJson: searchResult },
      { id: '4', ts: '2026-08-11T10:01:01Z', traceId: 'x2', mcpTraceId: 'm2', source: 'mcp', tool: 'code.call', taskSession: null, branch: null, ok: true, inputJson: '{}', resultJson: '{}' },
    ];
    const cases = historicalCasesFromTraceRows(rows);
    expect(cases.find((item) => item.id === 'trace:s1')?.weakExpected).toEqual(['git.diff']);
    expect(cases.find((item) => item.id === 'trace:s2')?.weakExpected).toBeUndefined();
  });

});

describe('tools.search benchmark metrics', () => {
  it('reports top-1, recall@3, macro-domain accuracy, abstention, and payload metrics', async () => {
    const cases: BenchmarkCase[] = [
      { id: '1', query: 'vercel logs', source: 'gold', expected: ['deployment.logs'], domain: 'deployment' },
      { id: '2', query: 'list local files', source: 'gold', expected: ['fs.list'], domain: 'filesystem' },
      { id: '3', query: 'do the thing', source: 'gold', expected: [], shouldAbstain: true, domain: 'ambiguous' },
    ];
    const fakeSearch = async (query: string) => query === 'vercel logs'
      ? { recommended: 'deployment.logs', confidence: 'high', retrievalMode: 'deterministic', matches: [{ name: 'deployment.logs' }], diagnostics: { candidatesBeforeRanking: 4 } }
      : query === 'list local files'
        ? { recommended: 'fs.read', confidence: 'medium', retrievalMode: 'deterministic', matches: [{ name: 'fs.read' }, { name: 'fs.list' }], diagnostics: { candidatesBeforeRanking: 6 } }
        : { confidence: 'low', retrievalMode: 'abstain', matches: [], diagnostics: { candidatesBeforeRanking: 0 } };
    const report = await evaluateBenchmarkCases(cases, fakeSearch);
    expect(report.quality.top1Accuracy).toBeCloseTo(0.5);
    expect(report.quality.recallAt3).toBe(1);
    expect(report.quality.abstentionAccuracy).toBe(1);
    expect(report.efficiency.averageCandidates).toBeCloseTo(10 / 3);
    expect(report.efficiency.averageReturned).toBe(1);
    expect(report.efficiency.averagePayloadBytes).toBeGreaterThan(0);
    expect(report.byDomain.deployment.top1Accuracy).toBe(1);
    expect(report.byDomain.filesystem.top1Accuracy).toBe(0);
  });
});


describe('tools.search benchmark acceptance gates', () => {
  it('meets broad gold-corpus quality and efficiency gates', async () => {
    const cases = clusterBenchmarkCases(loadGoldCases());
    const report = await evaluateBenchmarkCases(cases, async (query) => await runToolSearch({
      query,
      limit: 3,
      includeEmbeddings: false,
      includeDocs: false,
      detail: 'full',
    }) as SearchResult);

    expect(report.counts.goldLabeled).toBeGreaterThanOrEqual(80);
    expect(report.counts.domains).toBeGreaterThanOrEqual(15);
    expect(report.quality.top1Accuracy).toBeGreaterThanOrEqual(0.95);
    expect(report.quality.recallAt3).toBeGreaterThanOrEqual(0.99);
    expect(report.quality.macroDomainTop1).toBeGreaterThanOrEqual(0.9);
    expect(report.quality.abstentionAccuracy).toBe(1);
    expect(report.quality.invarianceConsistency).toBe(1);
    expect(report.efficiency.averageCandidates).toBeLessThanOrEqual(8);
    expect(report.efficiency.averageReturned).toBeLessThanOrEqual(3);
    expect(report.efficiency.averagePayloadBytes).toBeLessThan(3000);
    expect(Math.max(...report.cases.map((item) => item.payloadBytes))).toBeLessThan(3000);
    expect(Math.max(...report.cases.map((item) => item.candidates))).toBeLessThanOrEqual(8);
  });
});
