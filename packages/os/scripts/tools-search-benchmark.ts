import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { runToolSearch } from './tools-search';

export type BenchmarkSource = 'gold' | 'historical' | 'synthetic';

export type BenchmarkCase = {
  id: string;
  query: string;
  source: BenchmarkSource;
  timestamp?: string;
  expected?: string[];
  weakExpected?: string[];
  shouldAbstain?: boolean;
  domain?: string;
  invarianceGroup?: string;
  contrastGroup?: string;
  clusterId?: string;
  baselineRecommended?: string;
  baselineMatches?: string[];
  baselinePayloadBytes?: number;
  baselineReturned?: number;
  baselineCandidates?: number;
};

export type TraceRow = {
  id: string;
  ts: string;
  traceId: string;
  mcpTraceId: string | null;
  source: string;
  tool: string;
  taskSession: string | null;
  branch: string | null;
  ok: boolean;
  inputJson: string | null;
  resultJson: string | null;
};

export type WeakLabel = {
  selectedTool?: string;
  selectedToolOk?: boolean;
  repeatedSearch?: boolean;
  delayMs: number;
};

export type SearchResult = {
  recommended?: string;
  confidence?: string;
  retrievalMode?: string;
  matches?: Array<{ name?: string; capabilities?: { readOnly?: boolean; mutating?: boolean } }>;
  diagnostics?: Record<string, unknown>;
};

type SearchFn = (query: string) => Promise<SearchResult>;

type SqlTraceRow = {
  id: string | number;
  ts: string;
  trace_id: string;
  mcp_trace_id: string | null;
  source: string;
  tool: string;
  task_session: string | null;
  branch: string | null;
  ok: boolean | number;
  input_json: string | null;
  result_json: string | null;
};

type CaseEvaluation = {
  item: BenchmarkCase;
  result: SearchResult;
  returned: string[];
  payloadBytes: number;
  candidateCount: number;
  rankedCandidateCount: number;
  top1Correct?: boolean;
  recallAt3Correct?: boolean;
  reciprocalRank?: number;
  abstentionCorrect?: boolean;
  weakTop1Correct?: boolean;
  weakRecallAt3Correct?: boolean;
};

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultGoldPath = path.join(packageRoot, 'benchmarks', 'tools-search-gold.json');
const defaultTraceDb = path.join(os.homedir(), '.consuelo', 'node', 'db', 'traces.db');
const CLUSTER_THRESHOLD = 0.64;
const WEAK_LABEL_WINDOW_MS = 120_000;

const CLUSTER_STOP = new Set([
  'a', 'an', 'the', 'for', 'to', 'of', 'and', 'or', 'with', 'in', 'on', 'at', 'from',
  'please', 'can', 'could', 'would', 'you', 'me', 'my', 'our', 'show', 'get', 'give', 'tell',
]);

function normalizedTokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0 && !CLUSTER_STOP.has(token));
}

function stableHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export function clusterBenchmarkCases(cases: BenchmarkCase[]): BenchmarkCase[] {
  const representatives: Array<{ clusterId: string; tokens: Set<string> }> = [];
  return cases.map((item) => {
    const tokens = new Set(normalizedTokens(item.query));
    let best: { clusterId: string; score: number } | undefined;
    for (const rep of representatives) {
      const score = jaccard(tokens, rep.tokens);
      if (score >= CLUSTER_THRESHOLD && (!best || score > best.score)) best = { clusterId: rep.clusterId, score };
    }
    if (best) return { ...item, clusterId: best.clusterId };
    const signature = [...tokens].sort().join(' ') || item.query.trim().toLowerCase();
    const clusterId = `q_${stableHash(signature).slice(0, 12)}`;
    representatives.push({ clusterId, tokens });
    return { ...item, clusterId };
  });
}

function bucketFor(value: string, modulus: number): number {
  return Number.parseInt(stableHash(value).slice(0, 8), 16) % modulus;
}

export function splitBenchmarkCases(cases: BenchmarkCase[]): {
  tuning: BenchmarkCase[];
  validation: BenchmarkCase[];
  timeHoldout: BenchmarkCase[];
} {
  const clustered = cases.every((item) => item.clusterId) ? cases : clusterBenchmarkCases(cases);
  const timestamped = clustered.filter((item) => item.timestamp).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  const holdoutSeedCount = timestamped.length > 0 ? Math.max(1, Math.ceil(timestamped.length * 0.2)) : 0;
  const newest = timestamped.slice(Math.max(0, timestamped.length - holdoutSeedCount));
  const timeClusters = new Set(newest.map((item) => item.clusterId));
  const timeHoldout = clustered.filter((item) => timeClusters.has(item.clusterId));
  const remaining = clustered.filter((item) => !timeClusters.has(item.clusterId));
  const uniqueClusters = [...new Set(remaining.map((item) => item.clusterId))].sort();
  const validationClusters = new Set(uniqueClusters.filter((clusterId) => bucketFor(String(clusterId), 5) === 0));
  if (validationClusters.size === 0 && uniqueClusters.length > 1) validationClusters.add(uniqueClusters[uniqueClusters.length - 1]);
  return {
    tuning: remaining.filter((item) => !validationClusters.has(item.clusterId)),
    validation: remaining.filter((item) => validationClusters.has(item.clusterId)),
    timeHoldout,
  };
}

function relatedTrace(search: TraceRow, candidate: TraceRow): boolean {
  if (search.mcpTraceId && candidate.mcpTraceId === search.mcpTraceId) return true;
  if (search.taskSession && candidate.taskSession === search.taskSession && candidate.source === search.source) return true;
  return false;
}

export function deriveWeakLabels(rows: TraceRow[]): Map<string, WeakLabel> {
  const ordered = [...rows].sort((a, b) => a.ts.localeCompare(b.ts));
  const labels = new Map<string, WeakLabel>();
  for (let index = 0; index < ordered.length; index += 1) {
    const search = ordered[index];
    if (search.tool !== 'tools.search') continue;
    if (!search.mcpTraceId && !search.taskSession) continue;
    const started = Date.parse(search.ts);
    for (let cursor = index + 1; cursor < ordered.length; cursor += 1) {
      const candidate = ordered[cursor];
      const delayMs = Date.parse(candidate.ts) - started;
      if (!Number.isFinite(delayMs) || delayMs > WEAK_LABEL_WINDOW_MS) break;
      if (!relatedTrace(search, candidate)) continue;
      if (candidate.tool === 'tools.search') {
        labels.set(search.traceId, { repeatedSearch: true, delayMs });
        break;
      }
      labels.set(search.traceId, { selectedTool: candidate.tool, selectedToolOk: candidate.ok, delayMs });
      break;
    }
  }
  return labels;
}

function parseJson(value: string | null): unknown {
  if (!value) return undefined;
  try { return JSON.parse(value); } catch { return undefined; }
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function unwrapResult(value: unknown): Record<string, unknown> | undefined {
  const object = asObject(value);
  if (!object) return undefined;
  const data = asObject(object.data);
  return data && ('matches' in data || 'recommended' in data || 'query' in data) ? data : object;
}

function queryFromTrace(row: TraceRow): string | undefined {
  const input = asObject(parseJson(row.inputJson));
  const query = input?.query;
  return typeof query === 'string' && query.trim() ? query.trim() : undefined;
}

function stringNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asObject(item)?.name).filter((name): name is string => typeof name === 'string');
}

export function historicalCasesFromTraceRows(rows: TraceRow[], limit = 1000): BenchmarkCase[] {
  const weak = deriveWeakLabels(rows);
  return rows
    .filter((row) => row.tool === 'tools.search')
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .slice(-Math.max(1, limit))
    .flatMap((row) => {
      const query = queryFromTrace(row);
      if (!query) return [];
      const result = unwrapResult(parseJson(row.resultJson));
      const baselineRecommended = typeof result?.recommended === 'string' ? result.recommended : undefined;
      const baselineMatches = stringNames(result?.matches);
      const oldBytes = row.resultJson ? Buffer.byteLength(row.resultJson) : undefined;
      const totalMatches = typeof result?.totalMatches === 'number' ? result.totalMatches : undefined;
      const label = weak.get(row.traceId);
      const conservativeWeakSelection = label?.selectedTool
        && label.selectedToolOk === true
        && label.delayMs <= 30_000
        && baselineMatches.slice(0, 3).includes(label.selectedTool)
        ? label.selectedTool
        : undefined;
      return [{
        id: `trace:${row.traceId}`,
        query,
        source: 'historical' as const,
        timestamp: row.ts,
        ...(conservativeWeakSelection ? { weakExpected: [conservativeWeakSelection] } : {}),
        baselineRecommended,
        baselineMatches,
        baselinePayloadBytes: oldBytes,
        baselineReturned: baselineMatches.length,
        baselineCandidates: totalMatches,
      }];
    });
}

export async function loadTraceRows(dbPath = defaultTraceDb, since?: string): Promise<TraceRow[]> {
  if (!fs.existsSync(dbPath)) return [];
  const { Database } = await import('bun:sqlite');
  const db = new Database(dbPath, { readonly: true });
  try {
    const sql = since
      ? `SELECT id, ts, trace_id, mcp_trace_id, source, tool, task_session, branch, ok, input_json, result_json FROM tool_traces WHERE ts >= ? ORDER BY ts ASC`
      : `SELECT id, ts, trace_id, mcp_trace_id, source, tool, task_session, branch, ok, input_json, result_json FROM tool_traces ORDER BY ts ASC`;
    const raw = (since ? db.query(sql).all(since) : db.query(sql).all()) as SqlTraceRow[];
    return raw.map((row) => ({
      id: String(row.id),
      ts: String(row.ts),
      traceId: String(row.trace_id),
      mcpTraceId: row.mcp_trace_id == null ? null : String(row.mcp_trace_id),
      source: String(row.source),
      tool: String(row.tool),
      taskSession: row.task_session == null ? null : String(row.task_session),
      branch: row.branch == null ? null : String(row.branch),
      ok: Boolean(row.ok),
      inputJson: row.input_json == null ? null : String(row.input_json),
      resultJson: row.result_json == null ? null : String(row.result_json),
    }));
  } finally {
    db.close();
  }
}

export function loadGoldCases(goldPath = defaultGoldPath): BenchmarkCase[] {
  if (!fs.existsSync(goldPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(goldPath, 'utf8')) as { cases?: BenchmarkCase[] } | BenchmarkCase[];
  const cases = Array.isArray(parsed) ? parsed : parsed.cases || [];
  return cases.map((item, index) => ({ ...item, id: item.id || `gold:${index}`, source: item.source || 'gold' }));
}

function metricRatio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function expectedRank(expected: string[], returned: string[]): number {
  for (let index = 0; index < returned.length; index += 1) if (expected.includes(returned[index])) return index + 1;
  return 0;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function evaluateGroup(rows: CaseEvaluation[]): { count: number; top1Accuracy: number; recallAt3: number; mrr: number } {
  const labeled = rows.filter((row) => row.item.expected && row.item.expected.length > 0);
  return {
    count: labeled.length,
    top1Accuracy: metricRatio(labeled.filter((row) => row.top1Correct).length, labeled.length),
    recallAt3: metricRatio(labeled.filter((row) => row.recallAt3Correct).length, labeled.length),
    mrr: average(labeled.map((row) => row.reciprocalRank || 0)),
  };
}

export async function evaluateBenchmarkCases(cases: BenchmarkCase[], search: SearchFn) {
  const evaluations: CaseEvaluation[] = [];
  for (const item of cases) {
    let result: SearchResult;
    try {
      result = await search(item.query);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`tools.search benchmark failed for ${item.id}: ${message}`);
    }
    const returned = (result.matches || []).map((match) => match.name).filter((name): name is string => typeof name === 'string');
    const payloadBytes = Number(result.diagnostics?.compactPayloadBytes) || Buffer.byteLength(JSON.stringify(result));
    const candidateCount = Number(result.diagnostics?.candidatesBeforeRanking) || 0;
    const rankedCandidateCount = Number(result.diagnostics?.candidatesRanked) || 0;
    const expected = item.expected || [];
    const rank = expected.length ? expectedRank(expected, returned) : 0;
    const weak = item.weakExpected || [];
    const weakRank = weak.length ? expectedRank(weak, returned) : 0;
    evaluations.push({
      item,
      result,
      returned,
      payloadBytes,
      candidateCount,
      rankedCandidateCount,
      ...(expected.length ? {
        top1Correct: Boolean(result.recommended && expected.includes(result.recommended)),
        recallAt3Correct: rank > 0 && rank <= 3,
        reciprocalRank: rank > 0 ? 1 / rank : 0,
      } : {}),
      ...(item.shouldAbstain !== undefined ? { abstentionCorrect: item.shouldAbstain ? !result.recommended : Boolean(result.recommended) } : {}),
      ...(weak.length ? {
        weakTop1Correct: Boolean(result.recommended && weak.includes(result.recommended)),
        weakRecallAt3Correct: weakRank > 0 && weakRank <= 3,
      } : {}),
    });
  }

  const quality = evaluateGroup(evaluations);
  const abstentions = evaluations.filter((row) => row.item.shouldAbstain !== undefined);
  const weakRows = evaluations.filter((row) => row.item.weakExpected?.length);
  const domains = [...new Set(evaluations.map((row) => row.item.domain).filter((value): value is string => Boolean(value)))].sort();
  const byDomain: Record<string, ReturnType<typeof evaluateGroup>> = {};
  for (const domain of domains) byDomain[domain] = evaluateGroup(evaluations.filter((row) => row.item.domain === domain));
  const macroDomainTop1 = average(Object.values(byDomain).filter((value) => value.count > 0).map((value) => value.top1Accuracy));

  const invarianceGroups = [...new Set(evaluations.map((row) => row.item.invarianceGroup).filter((value): value is string => Boolean(value)))];
  const invarianceScores = invarianceGroups.map((group) => {
    const recommendations = evaluations.filter((row) => row.item.invarianceGroup === group).map((row) => row.result.recommended || '<abstain>');
    return new Set(recommendations).size <= 1 ? 1 : 0;
  });
  const contrastGroups = [...new Set(evaluations.map((row) => row.item.contrastGroup).filter((value): value is string => Boolean(value)))];
  const contrastScores = contrastGroups.map((group) => {
    const members = evaluations.filter((row) => row.item.contrastGroup === group && row.item.expected?.length);
    return members.length > 0 && members.every((row) => row.top1Correct) ? 1 : 0;
  });

  const oldPayload = evaluations.map((row) => row.item.baselinePayloadBytes).filter((value): value is number => typeof value === 'number');
  const oldReturned = evaluations.map((row) => row.item.baselineReturned).filter((value): value is number => typeof value === 'number');
  const oldCandidates = evaluations.map((row) => row.item.baselineCandidates).filter((value): value is number => typeof value === 'number');
  const pairedRecommended = evaluations.filter((row) => row.item.baselineRecommended);
  const improvedPayloadPct = oldPayload.length
    ? 1 - (average(evaluations.filter((row) => typeof row.item.baselinePayloadBytes === 'number').map((row) => row.payloadBytes)) / average(oldPayload))
    : 0;

  return {
    counts: {
      total: evaluations.length,
      goldLabeled: quality.count,
      weakLabeled: weakRows.length,
      abstentionLabeled: abstentions.length,
      domains: domains.length,
    },
    quality: {
      ...quality,
      abstentionAccuracy: metricRatio(abstentions.filter((row) => row.abstentionCorrect).length, abstentions.length),
      macroDomainTop1,
      invarianceConsistency: average(invarianceScores),
      contrastAccuracy: average(contrastScores),
    },
    weakQuality: {
      count: weakRows.length,
      top1Accuracy: metricRatio(weakRows.filter((row) => row.weakTop1Correct).length, weakRows.length),
      recallAt3: metricRatio(weakRows.filter((row) => row.weakRecallAt3Correct).length, weakRows.length),
    },
    efficiency: {
      averageCandidatePool: average(evaluations.map((row) => row.candidateCount)),
      averageCandidates: average(evaluations.map((row) => row.rankedCandidateCount || row.candidateCount)),
      averageReturned: average(evaluations.map((row) => row.returned.length)),
      averagePayloadBytes: average(evaluations.map((row) => row.payloadBytes)),
      semanticFallbackRate: metricRatio(evaluations.filter((row) => row.result.retrievalMode === 'semantic-fallback').length, evaluations.length),
      abstainRate: metricRatio(evaluations.filter((row) => !row.result.recommended).length, evaluations.length),
    },
    baselineComparison: {
      pairedCount: oldPayload.length,
      averageOldPayloadBytes: average(oldPayload),
      averageOldReturned: average(oldReturned),
      averageOldCandidates: average(oldCandidates),
      payloadReduction: improvedPayloadPct,
      recommendationChangedRate: metricRatio(pairedRecommended.filter((row) => row.item.baselineRecommended !== row.result.recommended).length, pairedRecommended.length),
    },
    byDomain,
    cases: evaluations.map((row) => ({
      id: row.item.id,
      query: row.item.query,
      source: row.item.source,
      domain: row.item.domain,
      clusterId: row.item.clusterId,
      expected: row.item.expected,
      weakExpected: row.item.weakExpected,
      recommended: row.result.recommended,
      returned: row.returned,
      confidence: row.result.confidence,
      retrievalMode: row.result.retrievalMode,
      top1Correct: row.top1Correct,
      recallAt3Correct: row.recallAt3Correct,
      weakTop1Correct: row.weakTop1Correct,
      payloadBytes: row.payloadBytes,
      candidatePool: row.candidateCount,
      candidates: row.rankedCandidateCount || row.candidateCount,
      baselineRecommended: row.item.baselineRecommended,
      baselinePayloadBytes: row.item.baselinePayloadBytes,
    })),
  };
}

function parseArgs(argv: string[]): { dbPath: string; goldPath: string; since?: string; limit: number; mode: 'all' | 'gold' | 'traces'; embeddings: boolean } {
  let dbPath = defaultTraceDb;
  let goldPath = defaultGoldPath;
  let since: string | undefined;
  let limit = 1000;
  let mode: 'all' | 'gold' | 'traces' = 'all';
  let embeddings = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--db') { dbPath = argv[++index] || dbPath; continue; }
    if (arg === '--gold') { goldPath = argv[++index] || goldPath; continue; }
    if (arg === '--since') { since = argv[++index] || undefined; continue; }
    if (arg === '--limit') { limit = Math.max(1, Number.parseInt(argv[++index] || '1000', 10) || 1000); continue; }
    if (arg === '--gold-only') { mode = 'gold'; continue; }
    if (arg === '--traces-only') { mode = 'traces'; continue; }
    if (arg === '--embeddings') { embeddings = true; continue; }
  }
  return { dbPath, goldPath, since, limit, mode, embeddings };
}

async function main(): Promise<void> {
  const args = parseArgs(Bun.argv.slice(2));
  const gold = args.mode === 'traces' ? [] : loadGoldCases(args.goldPath);
  const rows = args.mode === 'gold' ? [] : await loadTraceRows(args.dbPath, args.since);
  const historical = args.mode === 'gold' ? [] : historicalCasesFromTraceRows(rows, args.limit);
  const clustered = clusterBenchmarkCases([...gold, ...historical]);
  const split = splitBenchmarkCases(clustered);
  const report = await evaluateBenchmarkCases(clustered, async (query) => {
    return await runToolSearch({ query, limit: 3, includeEmbeddings: args.embeddings, includeDocs: false, detail: 'full' }) as SearchResult;
  });
  const output = {
    corpus: {
      total: clustered.length,
      gold: gold.length,
      historical: historical.length,
      clusters: new Set(clustered.map((item) => item.clusterId)).size,
      splits: { tuning: split.tuning.length, validation: split.validation.length, timeHoldout: split.timeHoldout.length },
      traceDb: fs.existsSync(args.dbPath) ? args.dbPath : null,
      goldPath: fs.existsSync(args.goldPath) ? args.goldPath : null,
    },
    report,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (import.meta.main) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exit(1);
  });
}
