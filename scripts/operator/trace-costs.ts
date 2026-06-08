#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const intFormatter = new Intl.NumberFormat('en-US');

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type TraceRow = Record<string, unknown> & {
  id?: string;
  ts?: string;
  trace_id?: string;
  source?: string;
  tool?: string;
  task_session?: string | null;
  branch?: string | null;
  worktree?: string | null;
  status?: string;
  ok?: number;
  code?: string | null;
  exit_code?: number | null;
  duration_ms?: number | null;
  input_json?: string | null;
  resolved_input_json?: string | null;
  result_json?: string | null;
  stderr?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
};

type ModelPrice = {
  input_per_1m?: number;
  cached_input_per_1m?: number;
  output_per_1m?: number;
  alias_of?: string;
  source?: string;
};

type FixedToolCost = {
  cost_per_1k_calls?: number;
  cost_per_call?: number;
  note?: string;
};

type PricingRegistry = {
  schema_version: number;
  currency: string;
  default_model: string;
  models: Record<string, ModelPrice>;
  tool_defaults?: Record<string, string>;
  fixed_tool_costs?: Record<string, FixedToolCost>;
  cache_policy?: {
    mode?: string;
    min_cacheable_input_tokens?: number;
    heuristic_cached_ratio?: number;
    max_retention_hours?: number;
  };
};

type PricedRow = {
  id: string;
  ts: string;
  tsMs: number;
  traceId: string;
  tool: string;
  branch: string;
  taskSession: string;
  worktree: string;
  status: string;
  code: string;
  ok: boolean;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedTokens: boolean;
  actualCachedInputTokens: number | null;
  chargedCachedInputTokens: number;
  uncachedInputTokens: number;
  model: string;
  resolvedModel: string;
  modelSource: string;
  category: string;
  tokenCostUsd: number;
  fixedCostUsd: number;
  costUsd: number;
  priced: boolean;
  pricingReason: string;
  reasonPreview: string;
  inputText: string;
};

type Agg = {
  key: string;
  calls: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  actualCachedRows: number;
  estimatedRows: number;
  pricedRows: number;
  unpricedRows: number;
  costUsd: number;
  tokenCostUsd: number;
  fixedCostUsd: number;
  failedCostUsd: number;
  lastSeenMs: number;
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultTraceDb = join(
  homedir(),
  'Library/Application Support/OpenWorkspace/traces/e8425497c3ee20bf0a28e9da/traces.db',
);
const defaultPricingPath = join(scriptDir, 'trace-pricing-registry.json');

const args = parseArgs(Bun.argv.slice(2));
const traceDb = stringArg('db') || process.env.TRACE_DB || defaultTraceDb;
const pricingPath = stringArg('pricing') || process.env.TRACE_PRICING_REGISTRY || defaultPricingPath;
const limit = numberArg('limit') ?? 20;
const sinceText = stringArg('since') || '24h';
const group = stringArg('group') || '';
const outputJson = booleanArg('json') || booleanArg('raw-json');
const forcedModel = stringArg('model') || '';
const cacheMode = stringArg('cache-mode') || process.env.TRACE_COST_CACHE_MODE || '';
const cacheRatioOverride = numberArg('cache-ratio');

if (booleanArg('help')) {
  printHelp();
  process.exit(0);
}

if (!existsSync(traceDb)) {
  console.error(`trace db not found: ${traceDb}`);
  process.exit(1);
}
if (!existsSync(pricingPath)) {
  console.error(`pricing registry not found: ${pricingPath}`);
  process.exit(1);
}

const registry = await readPricingRegistry(pricingPath);
const effectiveCacheMode = cacheMode || registry.cache_policy?.mode || 'actual_then_zero';
const minCacheableInputTokens = registry.cache_policy?.min_cacheable_input_tokens ?? 1024;
const windowSpecs = [
  { key: 'past_hour', label: 'past_hour', ms: 60 * 60 * 1000 },
  { key: 'past_day', label: 'past_day', ms: 24 * 60 * 60 * 1000 },
  { key: 'past_week', label: 'past_week', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: 'past_month', label: 'past_month', ms: 30 * 24 * 60 * 60 * 1000 },
];
const sinceMs = parseSinceToMs(sinceText);
const queryLookbackMs = sinceMs;
const nowMs = Date.now();

const rawRows = sqlJson(buildTraceSql(queryLookbackMs)) as TraceRow[];
const pricedRows = rawRows
  .map((row) => priceRow(row, registry))
  .filter((row): row is PricedRow => row !== null);
const analysisRows = sinceMs === null ? pricedRows : pricedRows.filter((row) => nowMs - row.tsMs <= sinceMs);

const report = buildReport(analysisRows, pricedRows, registry);

if (outputJson) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

printReport(report);

function parseArgs(argv: string[]): Map<string, string | boolean> {
  const parsed = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const trimmed = arg.slice(2);
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex >= 0) {
      parsed.set(trimmed.slice(0, eqIndex), trimmed.slice(eqIndex + 1));
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      parsed.set(trimmed, next);
      index += 1;
    } else {
      parsed.set(trimmed, true);
    }
  }
  return parsed;
}

function stringArg(name: string): string | null {
  const value = args.get(name);
  if (value === undefined || value === true) return null;
  return String(value);
}

function booleanArg(name: string): boolean {
  return args.get(name) === true || args.get(name) === 'true';
}

function numberArg(name: string): number | null {
  const raw = stringArg(name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

async function readPricingRegistry(path: string): Promise<PricingRegistry> {
  const parsed = JSON.parse(await Bun.file(path).text()) as PricingRegistry;
  if (!parsed.models || !parsed.default_model) {
    throw new Error(`invalid pricing registry: ${path}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Workspace trace cost analytics\n\nUsage:\n  bun run trace:costs -- [options]\n\nOptions:\n  --since 24h|7d|30d|all       Breakdown window; default 24h\n  --db PATH                     Trace sqlite database path\n  --pricing PATH                Pricing registry JSON path\n  --model MODEL                 Force all rows to a model in the registry\n  --cache-mode MODE             actual_then_zero or heuristic\n  --cache-ratio 0.5             Heuristic cached input ratio when --cache-mode=heuristic\n  --group tool|branch|session   Print all tables, but highlight the intended grouping in JSON metadata\n  --limit N                     Rows per ranking table; default 20\n  --json                        Emit dashboard-ready JSON\n`);
}

function parseSinceToMs(raw: string): number | null {
  const text = raw.trim().toLowerCase();
  if (text === 'all') return null;
  const match = text.match(/^(\d+(?:\.\d+)?)(m|h|d|w)$/);
  if (!match) return 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  if (unit === 'm') return value * 60 * 1000;
  if (unit === 'h') return value * 60 * 60 * 1000;
  if (unit === 'd') return value * 24 * 60 * 60 * 1000;
  return value * 7 * 24 * 60 * 60 * 1000;
}

function sqlLookbackModifier(ms: number | null): string {
  if (ms === null) return '';
  const seconds = Math.ceil(ms / 1000);
  return `WHERE ts >= datetime('now', '-${seconds} seconds')`;
}

function buildTraceSql(ms: number | null): string {
  return `
SELECT
  id,
  ts,
  trace_id,
  source,
  tool,
  task_session,
  branch,
  worktree,
  status,
  ok,
  code,
  exit_code,
  duration_ms,
  input_tokens,
  output_tokens,
  total_tokens,
  (length(coalesce(input_json, '')) + length(coalesce(resolved_input_json, ''))) AS input_chars,
  (length(coalesce(result_json, '')) + length(coalesce(stderr, ''))) AS output_chars,
  substr(coalesce(input_json, '') || char(10) || coalesce(resolved_input_json, ''), 1, 4096) AS input_text_prefix,
  substr(coalesce(stderr, ''), 1, 240) AS stderr,
  NULL AS input_model,
  NULL AS resolved_model,
  NULL AS result_model,
  NULL AS cached_tokens_json
FROM tool_traces
${sqlLookbackModifier(ms)}
ORDER BY ts DESC;
`;
}

function sqlJson(sql: string): unknown[] {
  const result = spawnSync('sqlite3', ['-json', traceDb, sql], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
  const text = result.stdout.trim();
  return text ? (JSON.parse(text) as unknown[]) : [];
}

function parseTraceDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw);
  if (!text) return null;
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function priceRow(row: TraceRow, pricing: PricingRegistry): PricedRow | null {
  const tsDate = parseTraceDate(row.ts);
  if (!tsDate) return null;

  const tool = String(row.tool || 'unknown');
  const branch = String(row.branch || '(no branch)');
  const taskSession = String(row.task_session || '(no task session)');
  const worktree = String(row.worktree || '');
  const inputText = String(row.input_text_prefix || [row.input_json, row.resolved_input_json].filter(Boolean).join('\n'));
  const inputChars = toNonNegativeNumber(row.input_chars) ?? inputText.length;
  const outputChars = toNonNegativeNumber(row.output_chars) ?? String(row.stderr || '').length;
  const recordedInput = toNonNegativeNumber(row.input_tokens);
  const recordedOutput = toNonNegativeNumber(row.output_tokens);
  const recordedTotal = toNonNegativeNumber(row.total_tokens);
  const estimatedInput = Math.round(inputChars / 4);
  const estimatedOutput = Math.round(outputChars / 4);
  const inputTokens = recordedInput ?? estimatedInput;
  const outputTokens = recordedOutput ?? estimatedOutput;
  const totalTokens = recordedTotal ?? inputTokens + outputTokens;
  const estimatedTokens = recordedTotal === null || recordedInput === null || recordedOutput === null;
  const actualCached = extractCachedTokens(row);
  const chargedCached = computeChargedCachedTokens(inputTokens, actualCached);
  const uncachedInput = Math.max(0, inputTokens - chargedCached);
  const modelResolution = resolveModel(row, tool, pricing);
  const modelPrice = resolveModelPrice(modelResolution.resolvedModel, pricing);
  const fixedToolCost = resolveFixedToolCost(tool, pricing);
  const fixedCost = fixedToolCost?.cost_per_call ?? ((fixedToolCost?.cost_per_1k_calls ?? 0) / 1000);

  let tokenCost = 0;
  let priced = false;
  let pricingReason = 'priced';
  if (modelPrice && modelPrice.input_per_1m !== undefined && modelPrice.output_per_1m !== undefined) {
    const cachedRate = modelPrice.cached_input_per_1m ?? modelPrice.input_per_1m;
    tokenCost =
      (uncachedInput / 1_000_000) * modelPrice.input_per_1m +
      (chargedCached / 1_000_000) * cachedRate +
      (outputTokens / 1_000_000) * modelPrice.output_per_1m;
    priced = true;
  } else {
    pricingReason = `missing pricing for model ${modelResolution.resolvedModel}`;
  }

  const ok = Boolean(row.ok) && String(row.status || '').toLowerCase() === 'ok' && String(row.code || 'OK') === 'OK';
  return {
    id: String(row.id || ''),
    ts: String(row.ts || ''),
    tsMs: tsDate.getTime(),
    traceId: String(row.trace_id || ''),
    tool,
    branch,
    taskSession,
    worktree,
    status: String(row.status || ''),
    code: String(row.code || 'OK'),
    ok,
    durationMs: toNonNegativeNumber(row.duration_ms) ?? 0,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedTokens,
    actualCachedInputTokens: actualCached,
    chargedCachedInputTokens: chargedCached,
    uncachedInputTokens: uncachedInput,
    model: modelResolution.model,
    resolvedModel: modelResolution.resolvedModel,
    modelSource: modelResolution.source,
    category: categorize(row, tool, branch),
    tokenCostUsd: tokenCost,
    fixedCostUsd: fixedCost,
    costUsd: tokenCost + fixedCost,
    priced,
    pricingReason,
    reasonPreview: compact(String(row.stderr || '')).slice(0, 180),
    inputText,
  };
}

function toNonNegativeNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function computeChargedCachedTokens(inputTokens: number, actualCached: number | null): number {
  if (actualCached !== null) return Math.min(inputTokens, actualCached);
  if (effectiveCacheMode !== 'heuristic') return 0;
  if (inputTokens < minCacheableInputTokens) return 0;
  const registryRatio = registry.cache_policy?.heuristic_cached_ratio;
  const ratio = cacheRatioOverride ?? (registryRatio && registryRatio > 0 ? registryRatio : 0.5);
  return Math.min(inputTokens, Math.max(0, Math.round(inputTokens * ratio)));
}

function extractCachedTokens(row: TraceRow): number | null {
  const direct = toNonNegativeNumber(row.cached_tokens_json);
  if (direct !== null) return direct;
  const jsons = [row.input_json, row.resolved_input_json, row.result_json];
  const found: number[] = [];
  for (const raw of jsons) {
    const parsed = safeJson(raw);
    if (parsed !== null) collectCachedTokenValues(parsed, found);
  }
  if (!found.length) return null;
  return Math.max(...found.map((value) => Math.round(value)));
}

function safeJson(raw: unknown): JsonValue | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as JsonValue;
  } catch {
    return null;
  }
}

function collectCachedTokenValues(value: JsonValue, out: number[]) {
  if (Array.isArray(value)) {
    for (const child of value) collectCachedTokenValues(child, out);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (typeof child === 'number' && normalized.includes('cached') && normalized.includes('token')) {
      out.push(child);
    }
    collectCachedTokenValues(child, out);
  }
}

function resolveModel(row: TraceRow, tool: string, pricing: PricingRegistry): { model: string; resolvedModel: string; source: string } {
  const forced = forcedModel.trim();
  if (forced) return { model: forced, resolvedModel: resolveAlias(forced, pricing), source: 'forced' };

  const fromJson = findModelInJson(row);
  if (fromJson) return { model: fromJson, resolvedModel: resolveAlias(fromJson, pricing), source: 'trace_json' };

  const toolDefault = matchToolDefault(tool, pricing.tool_defaults || {});
  if (toolDefault) return { model: toolDefault, resolvedModel: resolveAlias(toolDefault, pricing), source: 'tool_default' };

  return { model: pricing.default_model, resolvedModel: resolveAlias(pricing.default_model, pricing), source: 'default_model' };
}

function findModelInJson(row: TraceRow): string | null {
  for (const raw of [row.input_json, row.resolved_input_json, row.result_json]) {
    const parsed = safeJson(raw);
    if (parsed === null) continue;
    const model = findModelValue(parsed);
    if (model) return model;
  }
  const direct = [row.input_model, row.resolved_model, row.result_model].find((value) => typeof value === 'string' && value);
  if (direct) return String(direct);
  const joined = [row.input_text_prefix, row.stderr].filter(Boolean).join(' ');
  const match = joined.match(/\b(?:gpt[-_.][a-zA-Z0-9_.-]+|codex[-_.][0-9][a-zA-Z0-9_.-]*|o[0-9][a-zA-Z0-9_.-]*)\b/);
  return match?.[0] || null;
}

function findModelValue(value: JsonValue): string | null {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findModelValue(child);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if ((normalized === 'model' || normalized === 'modelname' || normalized === 'modelid') && typeof child === 'string') {
      return child;
    }
    const found = findModelValue(child);
    if (found) return found;
  }
  return null;
}

function matchToolDefault(tool: string, defaults: Record<string, string>): string | null {
  let winner: { key: string; value: string } | null = null;
  for (const [key, value] of Object.entries(defaults)) {
    if (key === '*') continue;
    if (tool === key || tool.startsWith(`${key}.`) || tool.startsWith(key)) {
      if (!winner || key.length > winner.key.length) winner = { key, value };
    }
  }
  return winner?.value || defaults['*'] || null;
}

function resolveAlias(model: string, pricing: PricingRegistry): string {
  const seen = new Set<string>();
  let current = model;
  while (pricing.models[current]?.alias_of && !seen.has(current)) {
    seen.add(current);
    current = String(pricing.models[current].alias_of);
  }
  return current;
}

function resolveModelPrice(model: string, pricing: PricingRegistry): ModelPrice | null {
  return pricing.models[resolveAlias(model, pricing)] || null;
}

function resolveFixedToolCost(tool: string, pricing: PricingRegistry): FixedToolCost | null {
  const costs = pricing.fixed_tool_costs || {};
  let winner: { key: string; value: FixedToolCost } | null = null;
  for (const [key, value] of Object.entries(costs)) {
    if (tool === key || tool.startsWith(`${key}.`) || tool.startsWith(key)) {
      if (!winner || key.length > winner.key.length) winner = { key, value };
    }
  }
  return winner?.value || null;
}

function categorize(row: TraceRow, tool: string, branch: string): string {
  const haystack = `${branch} ${tool} ${row.worktree || ''}`.toLowerCase();
  if (haystack.includes('diff-cockpit')) return 'diff-cockpit';
  if (haystack.includes('workspace-agent') || haystack.includes('workspace-agents')) return 'workspace-agents';
  if (haystack.includes('os-skills')) return 'os-skills';
  if (haystack.includes('/os/') || haystack.includes('task/os/')) return 'os';
  if (haystack.includes('docs')) return 'docs';
  if (haystack.includes('design') || tool.includes('consueloDesign')) return 'design';
  if (tool.includes('github') || tool.includes('pr') || haystack.includes('pull')) return 'github-pr';
  if (branch === '(no branch)') return 'no-branch';
  return 'other';
}

function buildReport(rows: PricedRow[], allRows: PricedRow[], pricing: PricingRegistry) {
  const windows = windowSpecs.map((window) => {
    const windowRows = allRows.filter((row) => nowMs - row.tsMs <= window.ms);
    return summarizeAgg(window.label, aggregate(windowRows, window.label));
  });

  const topTools = summarizeGroups(rows, (row) => row.tool).slice(0, limit);
  const topBranches = summarizeGroups(rows, (row) => row.branch).slice(0, limit);
  const topSessions = summarizeGroups(rows, (row) => row.taskSession).slice(0, limit);
  const modelCosts = summarizeGroups(rows, (row) => row.model).slice(0, limit);
  const categoryCosts = summarizeGroups(rows, (row) => row.category).slice(0, limit);
  const failedCosts = summarizeGroups(rows.filter((row) => !row.ok), (row) => row.code).slice(0, limit);
  const expensiveTraces = rows
    .slice()
    .sort((a, b) => b.costUsd - a.costUsd || b.totalTokens - a.totalTokens)
    .slice(0, limit)
    .map(traceSummary);
  const failedExpensiveTraces = rows
    .filter((row) => !row.ok)
    .sort((a, b) => b.costUsd - a.costUsd || b.totalTokens - a.totalTokens)
    .slice(0, limit)
    .map(traceSummary);
  const cacheOpportunity = buildCacheOpportunity(rows).slice(0, limit);
  const repeatedPrefixCandidates = buildRepeatedPrefixCandidates(rows).slice(0, limit);
  const coverage = buildCoverage(rows, pricing);

  return {
    generated_at: new Date().toISOString(),
    trace_db: traceDb,
    pricing_registry: pricingPath,
    currency: pricing.currency || 'USD',
    since: sinceText,
    group: group || null,
    cache_mode: effectiveCacheMode,
    min_cacheable_input_tokens: minCacheableInputTokens,
    windows,
    top_tools: topTools,
    top_branches: topBranches,
    top_sessions: topSessions,
    model_costs: modelCosts,
    category_costs: categoryCosts,
    expensive_traces: expensiveTraces,
    failed_expensive_traces: failedExpensiveTraces,
    failed_costs: failedCosts,
    cache_opportunity: cacheOpportunity,
    repeated_prefix_candidates: repeatedPrefixCandidates,
    coverage,
  };
}

function buildCoverage(rows: PricedRow[], pricing: PricingRegistry) {
  const sources = countBy(rows, (row) => row.modelSource);
  const actualCachedRows = rows.filter((row) => row.actualCachedInputTokens !== null).length;
  const estimatedTokenRows = rows.filter((row) => row.estimatedTokens).length;
  const unpricedRows = rows.filter((row) => !row.priced).length;
  const defaultModelRows = rows.filter((row) => row.modelSource === 'default_model').length;
  const toolDefaultRows = rows.filter((row) => row.modelSource === 'tool_default').length;
  return {
    rows: rows.length,
    priced_rows: rows.length - unpricedRows,
    unpriced_rows: unpricedRows,
    estimated_token_rows: estimatedTokenRows,
    tracked_token_rows: rows.length - estimatedTokenRows,
    actual_cached_token_rows: actualCachedRows,
    default_model_rows: defaultModelRows,
    tool_default_rows: toolDefaultRows,
    model_source_counts: sources,
    default_model: pricing.default_model,
    available_models: Object.keys(pricing.models).sort(),
  };
}

function buildCacheOpportunity(rows: PricedRow[]) {
  return summarizeGroups(rows.filter((row) => row.inputTokens >= minCacheableInputTokens), (row) => row.tool)
    .map((summary) => {
      const inputCostRate = resolveModelPrice((rows.find((row) => row.tool === summary.group)?.resolvedModel) || registry.default_model, registry)?.input_per_1m ?? 0;
      const cachedCostRate = resolveModelPrice((rows.find((row) => row.tool === summary.group)?.resolvedModel) || registry.default_model, registry)?.cached_input_per_1m ?? inputCostRate;
      const spreadPerToken = Math.max(0, inputCostRate - cachedCostRate) / 1_000_000;
      return {
        group: summary.group,
        eligible_calls: summary.calls,
        eligible_input_tokens: summary.input_tokens,
        current_input_cost_usd: roundMoney((summary.input_tokens / 1_000_000) * inputCostRate),
        savings_if_25pct_cached_usd: roundMoney(summary.input_tokens * 0.25 * spreadPerToken),
        savings_if_50pct_cached_usd: roundMoney(summary.input_tokens * 0.5 * spreadPerToken),
        savings_if_75pct_cached_usd: roundMoney(summary.input_tokens * 0.75 * spreadPerToken),
      };
    })
    .sort((a, b) => b.savings_if_50pct_cached_usd - a.savings_if_50pct_cached_usd);
}

function buildRepeatedPrefixCandidates(rows: PricedRow[]) {
  const groups = new Map<string, { prefix: string; calls: number; inputTokens: number; tools: Set<string>; branches: Set<string>; lastSeenMs: number }>();
  for (const row of rows) {
    if (row.inputTokens < minCacheableInputTokens) continue;
    const text = compact(row.inputText).slice(0, 4096);
    if (text.length < 256) continue;
    const prefix = createHash('sha1').update(text).digest('hex').slice(0, 12);
    const current = groups.get(prefix) || { prefix, calls: 0, inputTokens: 0, tools: new Set(), branches: new Set(), lastSeenMs: 0 };
    current.calls += 1;
    current.inputTokens += row.inputTokens;
    current.tools.add(row.tool);
    current.branches.add(row.branch);
    current.lastSeenMs = Math.max(current.lastSeenMs, row.tsMs);
    groups.set(prefix, current);
  }
  return [...groups.values()]
    .filter((item) => item.calls >= 2)
    .sort((a, b) => b.inputTokens - a.inputTokens)
    .map((item) => ({
      prefix_hash: item.prefix,
      calls: item.calls,
      input_tokens: item.inputTokens,
      tools: [...item.tools].slice(0, 6).join(','),
      branches: [...item.branches].slice(0, 4).join(','),
      last_seen: new Date(item.lastSeenMs).toISOString(),
    }));
}

function summarizeGroups(rows: PricedRow[], keyFn: (row: PricedRow) => string) {
  return [...groupAgg(rows, keyFn).values()]
    .sort((a, b) => b.costUsd - a.costUsd || b.totalTokens - a.totalTokens || b.calls - a.calls)
    .map((agg) => summarizeAgg(agg.key, agg));
}

function groupAgg(rows: PricedRow[], keyFn: (row: PricedRow) => string): Map<string, Agg> {
  const map = new Map<string, Agg>();
  for (const row of rows) {
    const key = keyFn(row) || '(unknown)';
    const agg = map.get(key) || emptyAgg(key);
    addToAgg(agg, row);
    map.set(key, agg);
  }
  return map;
}

function aggregate(rows: PricedRow[], key: string): Agg {
  const agg = emptyAgg(key);
  for (const row of rows) addToAgg(agg, row);
  return agg;
}

function emptyAgg(key: string): Agg {
  return {
    key,
    calls: 0,
    errors: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedInputTokens: 0,
    actualCachedRows: 0,
    estimatedRows: 0,
    pricedRows: 0,
    unpricedRows: 0,
    costUsd: 0,
    tokenCostUsd: 0,
    fixedCostUsd: 0,
    failedCostUsd: 0,
    lastSeenMs: 0,
  };
}

function addToAgg(agg: Agg, row: PricedRow) {
  agg.calls += 1;
  agg.errors += row.ok ? 0 : 1;
  agg.inputTokens += row.inputTokens;
  agg.outputTokens += row.outputTokens;
  agg.totalTokens += row.totalTokens;
  agg.cachedInputTokens += row.chargedCachedInputTokens;
  agg.actualCachedRows += row.actualCachedInputTokens === null ? 0 : 1;
  agg.estimatedRows += row.estimatedTokens ? 1 : 0;
  agg.pricedRows += row.priced ? 1 : 0;
  agg.unpricedRows += row.priced ? 0 : 1;
  agg.costUsd += row.costUsd;
  agg.tokenCostUsd += row.tokenCostUsd;
  agg.fixedCostUsd += row.fixedCostUsd;
  agg.failedCostUsd += row.ok ? 0 : row.costUsd;
  agg.lastSeenMs = Math.max(agg.lastSeenMs, row.tsMs);
}

function summarizeAgg(groupName: string, agg: Agg) {
  return {
    group: groupName,
    calls: agg.calls,
    errors: agg.errors,
    input_tokens: agg.inputTokens,
    cached_input_tokens: agg.cachedInputTokens,
    output_tokens: agg.outputTokens,
    total_tokens: agg.totalTokens,
    estimated_rows: agg.estimatedRows,
    priced_rows: agg.pricedRows,
    unpriced_rows: agg.unpricedRows,
    cost_usd: roundMoney(agg.costUsd),
    token_cost_usd: roundMoney(agg.tokenCostUsd),
    fixed_cost_usd: roundMoney(agg.fixedCostUsd),
    failed_cost_usd: roundMoney(agg.failedCostUsd),
    avg_cost_per_call_usd: roundMoney(agg.calls ? agg.costUsd / agg.calls : 0),
    avg_cost_per_1k_calls_usd: roundMoney(agg.calls ? (agg.costUsd / agg.calls) * 1000 : 0),
    cost_per_1m_tokens_usd: roundMoney(agg.totalTokens ? (agg.costUsd / agg.totalTokens) * 1_000_000 : 0),
    error_rate: agg.calls ? roundRatio(agg.errors / agg.calls) : 0,
    cost_share: 0,
    last_seen: agg.lastSeenMs ? new Date(agg.lastSeenMs).toISOString() : null,
  };
}

function traceSummary(row: PricedRow) {
  return {
    ts: row.ts,
    trace_id: row.traceId,
    tool: row.tool,
    branch: row.branch,
    task_session: row.taskSession,
    model: row.model,
    code: row.code,
    ok: row.ok,
    input_tokens: row.inputTokens,
    cached_input_tokens: row.chargedCachedInputTokens,
    output_tokens: row.outputTokens,
    total_tokens: row.totalTokens,
    cost_usd: roundMoney(row.costUsd),
    duration_ms: row.durationMs,
    category: row.category,
    reason_preview: row.reasonPreview,
  };
}

function countBy(rows: PricedRow[], keyFn: (row: PricedRow) => string) {
  const out: Record<string, number> = {};
  for (const row of rows) out[keyFn(row)] = (out[keyFn(row)] || 0) + 1;
  return out;
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function roundMoney(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function roundRatio(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function printReport(report: ReturnType<typeof buildReport>) {
  console.log('Workspace trace cost analytics');
  console.log('==============================');
  console.log(`trace_db: ${report.trace_db}`);
  console.log(`pricing_registry: ${report.pricing_registry}`);
  console.log(`since: ${report.since}`);
  console.log(`cache_mode: ${report.cache_mode}`);
  console.log('cost note: actual spend uses recorded tokens and actual cached-token fields when present. Missing cached-token fields default to zero unless --cache-mode=heuristic is used.');

  printTable('Cost overview by window', report.windows, [
    'group', 'calls', 'input_tokens', 'cached_input_tokens', 'output_tokens', 'total_tokens', 'cost_usd', 'avg_cost_per_call_usd', 'failed_cost_usd', 'unpriced_rows',
  ]);
  printTable('Top tools by cost', withCostShare(report.top_tools), [
    'group', 'calls', 'cost_usd', 'cost_share', 'input_tokens', 'output_tokens', 'avg_cost_per_call_usd', 'errors', 'failed_cost_usd',
  ]);
  printTable('Top branches by cost', withCostShare(report.top_branches), [
    'group', 'calls', 'cost_usd', 'cost_share', 'total_tokens', 'errors', 'avg_cost_per_call_usd', 'last_seen',
  ]);
  printTable('Top sessions by cost', withCostShare(report.top_sessions), [
    'group', 'calls', 'cost_usd', 'total_tokens', 'errors', 'last_seen',
  ]);
  printTable('Model usage and model cost', withCostShare(report.model_costs), [
    'group', 'calls', 'cost_usd', 'input_tokens', 'cached_input_tokens', 'output_tokens', 'estimated_rows', 'unpriced_rows',
  ]);
  printTable('Prompt/task category cost', withCostShare(report.category_costs), [
    'group', 'calls', 'cost_usd', 'cost_share', 'total_tokens', 'errors', 'failed_cost_usd',
  ]);
  printTable('Expensive traces to inspect next', report.expensive_traces, [
    'ts', 'trace_id', 'tool', 'branch', 'model', 'cost_usd', 'total_tokens', 'code', 'reason_preview',
  ]);
  printTable('Failed-cost ledger', withCostShare(report.failed_costs), [
    'group', 'calls', 'cost_usd', 'total_tokens', 'avg_cost_per_call_usd', 'last_seen',
  ]);
  printTable('Failed expensive traces', report.failed_expensive_traces, [
    'ts', 'trace_id', 'tool', 'branch', 'cost_usd', 'total_tokens', 'code', 'reason_preview',
  ]);
  printTable('Cache opportunity by tool', report.cache_opportunity, [
    'group', 'eligible_calls', 'eligible_input_tokens', 'current_input_cost_usd', 'savings_if_25pct_cached_usd', 'savings_if_50pct_cached_usd', 'savings_if_75pct_cached_usd',
  ]);
  printTable('Repeated cache-prefix candidates', report.repeated_prefix_candidates, [
    'prefix_hash', 'calls', 'input_tokens', 'tools', 'branches', 'last_seen',
  ]);
  printObject('Pricing coverage', report.coverage);
}

function withCostShare<T extends { cost_usd?: number }>(rows: T[]): T[] {
  const total = rows.reduce((sum, row) => sum + Number(row.cost_usd || 0), 0);
  return rows.map((row) => ({ ...row, cost_share: total ? roundRatio(Number(row.cost_usd || 0) / total) : 0 }));
}

function printObject(title: string, value: Record<string, unknown>) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
  for (const [key, raw] of Object.entries(value)) {
    const text = typeof raw === 'object' && raw !== null ? JSON.stringify(raw) : String(raw);
    console.log(`${key.padEnd(28)} ${text}`);
  }
}

function printTable(title: string, rows: Record<string, unknown>[], columns: string[]) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
  if (!rows.length) {
    console.log('(none)');
    return;
  }

  const widths = columns.map((column) => {
    const max = Math.max(column.length, ...rows.map((row) => formatCell(row[column], column).length));
    if (column === 'group' || column === 'branch' || column === 'reason_preview') return Math.min(max, 72);
    if (column === 'trace_id' || column === 'prefix_hash') return Math.min(max, 18);
    if (column === 'ts' || column === 'last_seen') return Math.min(max, 22);
    return Math.min(max, 20);
  });

  console.log(columns.map((column, index) => column.padEnd(widths[index])).join('  '));
  console.log(columns.map((_, index) => '-'.repeat(widths[index])).join('  '));
  for (const row of rows) {
    console.log(
      columns
        .map((column, index) => {
          const cell = formatCell(row[column], column);
          const width = widths[index];
          return (cell.length > width ? `${cell.slice(0, Math.max(0, width - 1))}...` : cell).padEnd(width);
        })
        .join('  '),
    );
  }
}

function formatCell(raw: unknown, column: string): string {
  if (raw === null || raw === undefined) return '';
  if (column.endsWith('_usd') || column === 'cost_usd') return formatUsd(Number(raw));
  if (column.includes('tokens')) return formatInteger(Number(raw));
  if (column === 'calls' || column === 'errors' || column.endsWith('_rows') || column === 'eligible_calls') return formatInteger(Number(raw));
  if (column.endsWith('_rate') || column.endsWith('_share')) return `${(Number(raw) * 100).toFixed(1)}%`;
  if (column === 'last_seen') return formatRelative(raw);
  return String(raw);
}

function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return intFormatter.format(Math.round(value));
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0.00';
  if (Math.abs(value) < 0.01 && value !== 0) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

function formatRelative(raw: unknown): string {
  const date = parseTraceDate(raw);
  if (!date) return String(raw ?? '');
  const diffSeconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 48) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}
