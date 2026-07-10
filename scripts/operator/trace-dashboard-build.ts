#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Row = Record<string, unknown>;

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
};

type PricedRow = {
  id: string;
  ts: string;
  tsMs: number;
  hour: number;
  dayIndex: number;
  day: string;
  tool: string;
  branch: string;
  taskSession: string;
  worktree: string;
  ok: boolean;
  status: string;
  code: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedTokens: boolean;
  model: string;
  resolvedModel: string;
  category: string;
  costUsd: number;
  tokenCostUsd: number;
  fixedCostUsd: number;
  priced: boolean;
  message: string;
  inputPreview: string;
};

type Agg = {
  key: string;
  calls: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  failedCostUsd: number;
  durationMs: number;
  lastSeenMs: number;
};

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const orderedDayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../..');
const defaultTraceDb = join(
  homedir(),
  'Library/Application Support/OpenWorkspace/traces/e8425497c3ee20bf0a28e9da/traces.db',
);
const defaultPricingPath = join(scriptDir, 'trace-pricing-registry.json');
const defaultOut = 'tmp/trace-burn-dashboard/payload.json';
const args = parseArgs(Bun.argv.slice(2));

if (hasFlag('help')) {
  printHelp();
  process.exit(0);
}

const sinceText = stringArg('since') || '7d';
const sinceMs = parseSinceToMs(sinceText) ?? 7 * 24 * 60 * 60 * 1000;
const traceDb = stringArg('db') || process.env.TRACE_DB || defaultTraceDb;
const pricingPath = stringArg('pricing') || process.env.TRACE_PRICING_REGISTRY || defaultPricingPath;
const outPath = stringArg('out') || defaultOut;
const limit = numberArg('limit') ?? 12;
const forcedModel = stringArg('model') || '';
const emitFixture = hasFlag('fixture');
const stdoutOnly = hasFlag('stdout') || hasFlag('json');
const pretty = !hasFlag('compact');
const nowMs = numberArg('now-ms') ?? Date.now();

const registry = await loadPricingRegistry(pricingPath);
const pricingRegistryText = await Bun.file(pricingPath).text();
const rows = emitFixture ? buildFixtureRows(nowMs) : loadRows(traceDb, sinceMs);
const pricedRows = rows.map(priceRow).filter((row): row is PricedRow => row !== null);
const payload = buildPayload(pricedRows, registry, pricingRegistryText);
const encoded = JSON.stringify(payload, null, pretty ? 2 : 0);

if (stdoutOnly) {
  console.log(encoded);
} else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${encoded}\n`);
  console.log(`wrote ${outPath}`);
}

function printHelp() {
  console.log(`Trace Burn Intelligence payload builder\n\nUsage:\n  bun run trace:dashboard -- [options]\n\nOptions:\n  --since 24h|7d|30d       Trace rows used for dashboard cache; default 7d\n  --db PATH                Trace sqlite database path\n  --pricing PATH           Pricing registry JSON path\n  --out PATH               Output JSON path; default tmp/trace-burn-dashboard/payload.json\n  --stdout | --json        Print JSON to stdout instead of writing a file\n  --fixture                Emit deterministic synthetic data for UI wiring\n  --compact                Emit minified JSON\n  --limit N                Ranking/live-feed row limit; default 12\n`);
}

function parseArgs(argv: string[]) {
  const parsed = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const text = arg.slice(2);
    const eq = text.indexOf('=');
    if (eq >= 0) {
      parsed.set(text.slice(0, eq), text.slice(eq + 1));
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      parsed.set(text, next);
      i += 1;
    } else {
      parsed.set(text, true);
    }
  }
  return parsed;
}

function stringArg(name: string): string | null {
  const value = args.get(name);
  if (value === undefined || value === true) return null;
  return String(value);
}

function numberArg(name: string): number | null {
  const raw = stringArg(name);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasFlag(name: string): boolean {
  return args.get(name) === true || args.get(name) === 'true';
}

function parseSinceToMs(raw: string): number | null {
  const text = raw.trim().toLowerCase();
  if (text === 'all') return null;
  const match = text.match(/^(\d+(?:\.\d+)?)(m|h|d|w)$/);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2];
  if (unit === 'm') return value * 60 * 1000;
  if (unit === 'h') return value * 60 * 60 * 1000;
  if (unit === 'd') return value * 24 * 60 * 60 * 1000;
  return value * 7 * 24 * 60 * 60 * 1000;
}

async function loadPricingRegistry(path: string): Promise<PricingRegistry> {
  if (!existsSync(path)) throw new Error(`pricing registry not found: ${path}`);
  const parsed = JSON.parse(await Bun.file(path).text()) as PricingRegistry;
  if (!parsed.default_model || !parsed.models) throw new Error(`invalid pricing registry: ${path}`);
  return parsed;
}

function loadRows(dbPath: string, lookbackMs: number): Row[] {
  if (!existsSync(dbPath)) throw new Error(`trace db not found: ${dbPath}`);
  const seconds = Math.ceil(lookbackMs / 1000);
  const sql = `
SELECT
  id,
  ts,
  trace_id,
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
  substr(coalesce(input_json, '') || char(10) || coalesce(resolved_input_json, ''), 1, 2048) AS input_text_prefix,
  substr(coalesce(stderr, ''), 1, 280) AS stderr
FROM tool_traces
WHERE ts >= datetime('now', '-${seconds} seconds')
ORDER BY ts DESC;
`;
  const result = spawnSync('sqlite3', ['-json', dbPath, sql], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `sqlite exited ${result.status}`);
  const text = result.stdout.trim();
  return text ? (JSON.parse(text) as Row[]) : [];
}

function priceRow(row: Row): PricedRow | null {
  const ts = parseDate(row.ts);
  if (!ts) return null;
  const tool = String(row.tool || 'unknown');
  const branch = String(row.branch || '(no branch)');
  const taskSession = String(row.task_session || '(no task session)');
  const inputPreview = String(row.input_text_prefix || '');
  const stderr = String(row.stderr || '');
  const inputChars = toNumber(row.input_chars) ?? inputPreview.length;
  const outputChars = toNumber(row.output_chars) ?? stderr.length;
  const inputTokens = toNumber(row.input_tokens) ?? Math.round(inputChars / 4);
  const outputTokens = toNumber(row.output_tokens) ?? Math.round(outputChars / 4);
  const totalTokens = toNumber(row.total_tokens) ?? inputTokens + outputTokens;
  const estimatedTokens = row.input_tokens === null || row.output_tokens === null || row.total_tokens === null;
  const model = forcedModel || resolveToolModel(tool);
  const resolvedModel = resolveModelAlias(model);
  const modelPrice = registry.models[resolvedModel];
  const fixed = fixedToolCost(tool);
  let tokenCostUsd = 0;
  let priced = false;
  if (modelPrice?.input_per_1m !== undefined && modelPrice?.output_per_1m !== undefined) {
    tokenCostUsd = (inputTokens / 1_000_000) * modelPrice.input_per_1m + (outputTokens / 1_000_000) * modelPrice.output_per_1m;
    priced = true;
  }
  const ok = Boolean(row.ok) && String(row.status || '').toLowerCase() === 'ok' && String(row.code || 'OK') === 'OK';
  const date = new Date(ts.getTime());
  return {
    id: String(row.id || ''),
    ts: String(row.ts || ''),
    tsMs: ts.getTime(),
    hour: date.getHours(),
    dayIndex: date.getDay(),
    day: dayNames[date.getDay()],
    tool,
    branch,
    taskSession,
    worktree: String(row.worktree || ''),
    ok,
    status: String(row.status || ''),
    code: String(row.code || (ok ? 'OK' : 'ERROR')),
    durationMs: toNumber(row.duration_ms) ?? 0,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedTokens,
    model,
    resolvedModel,
    category: categorize(tool, branch, inputPreview),
    tokenCostUsd,
    fixedCostUsd: fixed,
    costUsd: tokenCostUsd + fixed,
    priced,
    message: compact(stderr || String(row.code || '') || 'command completed').slice(0, 180),
    inputPreview: compact(inputPreview).slice(0, 220),
  };
}

function parseDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw);
  const date = new Date(text.includes('T') ? text : text.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function resolveToolModel(tool: string): string {
  const defaults = registry.tool_defaults || {};
  if (defaults[tool]) return defaults[tool];
  const prefix = Object.keys(defaults)
    .filter((key) => key !== '*' && tool.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return (prefix && defaults[prefix]) || defaults['*'] || registry.default_model;
}

function resolveModelAlias(model: string): string {
  let current = model;
  const seen = new Set<string>();
  while (registry.models[current]?.alias_of && !seen.has(current)) {
    seen.add(current);
    current = registry.models[current].alias_of as string;
  }
  return current;
}

function fixedToolCost(tool: string): number {
  const fixed = registry.fixed_tool_costs || {};
  const match = fixed[tool] || Object.entries(fixed).find(([key]) => key !== '*' && tool.startsWith(key))?.[1] || fixed['*'];
  if (!match) return 0;
  return match.cost_per_call ?? ((match.cost_per_1k_calls ?? 0) / 1000);
}

function categorize(tool: string, branch: string, input: string): string {
  const text = `${tool} ${branch} ${input}`.toLowerCase();
  if (text.includes('trace-cost') || text.includes('trace-analytics') || text.includes('trace-errors') || text.includes('trace-watch') || text.includes('trace:')) return 'analytics_scripts';
  if (text.includes('pr') || text.includes('review')) return 'review';
  if (text.includes('github')) return 'github';
  if (text.includes('fs.read') || text.includes('mac.read')) return 'source_read';
  if (text.includes('design') || text.includes('publish')) return 'design_publish';
  if (text.includes('verify') || text.includes('test')) return 'verification';
  if (text.includes('task.call') || text.includes('task.exec')) return 'task_execution';
  return 'other';
}

function buildPayload(rows: PricedRow[], pricing: PricingRegistry, pricingText: string) {
  const heatmap = buildHeatmap(rows);
  const all = aggregate('all', rows);
  const analytics = aggregate('analytics_scripts', rows.filter((row) => row.category === 'analytics_scripts'));
  const pricingHash = createHash('sha256').update(pricingText).digest('hex').slice(0, 12);
  const unpricedRows = rows.filter((row) => !row.priced).length;
  const latestTs = rows.reduce((max, row) => Math.max(max, row.tsMs), 0);
  const healthStatus = !existsSync(traceDb) || rows.length === 0 || unpricedRows > 0 ? 'degraded' : 'healthy';
  return {
    schema_version: 1,
    generated_at: new Date(nowMs).toISOString(),
    range: { label: sinceText, lookback_ms: sinceMs },
    trace_db: emitFixture ? 'fixture' : traceDb,
    currency: pricing.currency || 'USD',
    pricing: {
      registry_path: emitFixture ? 'scripts/operator/trace-pricing-registry.json' : pricingPath,
      registry_hash: pricingHash,
      default_model: pricing.default_model,
      available_models: Object.keys(pricing.models).sort(),
      unpriced_rows: unpricedRows,
    },
    workspace_health: {
      status: healthStatus,
      trace_db: existsSync(traceDb) || emitFixture ? 'live' : 'missing',
      pricing_registry: existsSync(pricingPath) ? 'loaded' : 'missing',
      tracked_rows: rows.length,
      coverage: rows.length ? `latest ${formatRelative(latestTs)}` : 'no rows in range',
      cost_map: unpricedRows ? `${unpricedRows} unpriced rows` : 'loaded',
      sources: {
        status_script: existsSync(join(repoRoot, 'packages/workspace/scripts/status.js')) ? 'available' : 'missing',
        health_check_script: existsSync(join(repoRoot, 'scripts/health-check.sh')) ? 'available' : 'missing',
        trace_costs_script: existsSync(join(repoRoot, 'scripts/operator/trace-costs.ts')) ? 'available' : 'missing',
      },
    },
    kpis: {
      calls: all.calls,
      errors: all.errors,
      error_rate: ratio(all.errors, all.calls),
      input_tokens: all.inputTokens,
      output_tokens: all.outputTokens,
      total_tokens: all.totalTokens,
      total_cost_usd: money(all.costUsd),
      failed_cost_usd: money(all.failedCostUsd),
      avg_cost_per_call_usd: money(all.calls ? all.costUsd / all.calls : 0),
      avg_burn_per_call_tokens: all.calls ? Math.round(all.totalTokens / all.calls) : 0,
      total_duration_ms: all.durationMs,
      analytics_script_cost: summarizeAgg(analytics),
    },
    heatmap,
    rankings: {
      tools: summarizeGroups(rows, (row) => row.tool).slice(0, limit),
      branches: summarizeGroups(rows, (row) => row.branch).slice(0, limit),
      sessions: summarizeGroups(rows, (row) => row.taskSession).slice(0, limit),
      models: summarizeGroups(rows, (row) => row.resolvedModel).slice(0, limit),
      categories: summarizeGroups(rows, (row) => row.category).slice(0, limit),
    },
    failures: {
      error_causes: summarizeGroups(rows.filter((row) => !row.ok), (row) => row.code).slice(0, limit),
      failed_expensive_traces: rows.filter((row) => !row.ok).sort(sortCost).slice(0, limit).map(traceSummary),
    },
    expensive_traces: rows.slice().sort(sortCost).slice(0, limit).map(traceSummary),
    live_seed: rows.slice().sort((a, b) => b.tsMs - a.tsMs).slice(0, limit).map(traceSummary),
  };
}

function buildHeatmap(rows: PricedRow[]) {
  const cells = [];
  const maxByKey = new Map<string, PricedRow[]>();
  for (const day of orderedDayNames) {
    const dayIndex = dayNames.indexOf(day);
    for (let hour = 0; hour < 24; hour += 1) {
      maxByKey.set(`${dayIndex}:${hour}`, []);
    }
  }
  for (const row of rows) {
    const key = `${row.dayIndex}:${row.hour}`;
    if (maxByKey.has(key)) maxByKey.get(key)?.push(row);
  }
  const aggregates = [...maxByKey.entries()].map(([key, bucket]) => ({ key, agg: aggregate(key, bucket), rows: bucket }));
  const maxTokens = Math.max(1, ...aggregates.map((item) => item.agg.totalTokens));
  for (const item of aggregates) {
    const [dayIndexText, hourText] = item.key.split(':');
    const dayIndex = Number(dayIndexText);
    const hour = Number(hourText);
    const agg = item.agg;
    const intensity = agg.totalTokens === 0 ? 0 : Math.max(1, Math.ceil((agg.totalTokens / maxTokens) * 5));
    cells.push({
      day: dayNames[dayIndex],
      day_index: dayIndex,
      hour,
      hour_label: formatHour(hour),
      tokens: agg.totalTokens,
      input_tokens: agg.inputTokens,
      output_tokens: agg.outputTokens,
      cost_usd: money(agg.costUsd),
      calls: agg.calls,
      errors: agg.errors,
      error_rate: ratio(agg.errors, agg.calls),
      top_tool: topValue(item.rows, (row) => row.tool),
      top_branch: topValue(item.rows, (row) => row.branch),
      top_session: topValue(item.rows, (row) => row.taskSession),
      state: stateFor(intensity, agg.errors),
      intensity,
      css_class: intensity ? `l${intensity}` : '',
    });
  }
  return {
    rows: orderedDayNames,
    columns: Array.from({ length: 24 }, (_, hour) => ({ hour, label: formatHour(hour) })),
    max_tokens: maxTokens,
    cells,
  };
}

function aggregate(key: string, rows: PricedRow[]): Agg {
  const agg: Agg = { key, calls: 0, errors: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0, failedCostUsd: 0, durationMs: 0, lastSeenMs: 0 };
  for (const row of rows) {
    agg.calls += 1;
    agg.errors += row.ok ? 0 : 1;
    agg.inputTokens += row.inputTokens;
    agg.outputTokens += row.outputTokens;
    agg.totalTokens += row.totalTokens;
    agg.costUsd += row.costUsd;
    agg.failedCostUsd += row.ok ? 0 : row.costUsd;
    agg.durationMs += row.durationMs;
    agg.lastSeenMs = Math.max(agg.lastSeenMs, row.tsMs);
  }
  return agg;
}

function summarizeGroups(rows: PricedRow[], keyFn: (row: PricedRow) => string) {
  const map = new Map<string, PricedRow[]>();
  for (const row of rows) {
    const key = keyFn(row) || '(unknown)';
    const bucket = map.get(key) || [];
    bucket.push(row);
    map.set(key, bucket);
  }
  return [...map.entries()].map(([key, bucket]) => summarizeAgg(aggregate(key, bucket))).sort((a, b) => b.cost_usd - a.cost_usd || b.total_tokens - a.total_tokens || b.calls - a.calls);
}

function summarizeAgg(agg: Agg) {
  return {
    group: agg.key,
    calls: agg.calls,
    errors: agg.errors,
    error_rate: ratio(agg.errors, agg.calls),
    input_tokens: agg.inputTokens,
    output_tokens: agg.outputTokens,
    total_tokens: agg.totalTokens,
    cost_usd: money(agg.costUsd),
    failed_cost_usd: money(agg.failedCostUsd),
    avg_cost_per_call_usd: money(agg.calls ? agg.costUsd / agg.calls : 0),
    avg_burn_per_call_tokens: agg.calls ? Math.round(agg.totalTokens / agg.calls) : 0,
    total_duration_ms: agg.durationMs,
    last_seen: agg.lastSeenMs ? new Date(agg.lastSeenMs).toISOString() : null,
  };
}

function traceSummary(row: PricedRow) {
  return {
    id: row.id,
    ts: row.ts,
    relative_time: formatRelative(row.tsMs),
    tool: row.tool,
    branch: row.branch,
    task_session: row.taskSession,
    status: row.ok ? 'ok' : 'error',
    code: row.code,
    duration_ms: row.durationMs,
    input_tokens: row.inputTokens,
    output_tokens: row.outputTokens,
    total_tokens: row.totalTokens,
    cost_usd: money(row.costUsd),
    model: row.resolvedModel,
    category: row.category,
    message: row.message,
  };
}

function sortCost(a: PricedRow, b: PricedRow) {
  return b.costUsd - a.costUsd || b.totalTokens - a.totalTokens || b.durationMs - a.durationMs;
}

function topValue(rows: PricedRow[], keyFn: (row: PricedRow) => string): string | null {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(keyFn(row), (counts.get(keyFn(row)) || 0) + row.totalTokens);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function stateFor(intensity: number, errors: number): string {
  if (errors > 0 && intensity >= 4) return 'expensive failure risk';
  if (intensity >= 5) return 'output spike';
  if (intensity >= 4) return 'high burn';
  if (intensity >= 2) return 'normal load';
  return 'quiet';
}

function ratio(num: number, den: number): number {
  return den ? Number((num / den).toFixed(4)) : 0;
}

function money(value: number): number {
  return Number(value.toFixed(6));
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

function formatRelative(rawMs: number): string {
  const diffSeconds = Math.max(0, Math.round((nowMs - rawMs) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 48) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}

function buildFixtureRows(baseMs: number): Row[] {
  const rows: Row[] = [];
  const tools = ['cdx.codex_apps.workspace', 'github', 'fs.read', 'task.call', 'mac.call', 'verify'];
  const branches = ['workspace/build-trace-costs-analytics', '(no branch)', 'design/trace-burn-intelligence', 'clarify-tools-search-steering'];
  for (let d = 0; d < 7; d += 1) {
    for (let h = 0; h < 24; h += 1) {
      const peak = h >= 10 && h <= 20 ? 1 : 0;
      const tokens = 8_000 + ((d * 31 + h * 17) % 40_000) + peak * ((h % 3) + 1) * 80_000;
      const ts = new Date(baseMs - (6 - d) * 24 * 60 * 60 * 1000);
      ts.setHours(h, 0, 0, 0);
      rows.push({
        id: `fixture-${d}-${h}`,
        ts: ts.toISOString(),
        tool: tools[(d + h) % tools.length],
        branch: branches[(d + Math.floor(h / 6)) % branches.length],
        task_session: `tsk_fixture_${d}`,
        worktree: '/tmp/fixture',
        status: (d + h) % 23 === 0 ? 'error' : 'ok',
        ok: (d + h) % 23 === 0 ? 0 : 1,
        code: (d + h) % 23 === 0 ? 'COMMAND_FAILED' : 'OK',
        duration_ms: 200 + ((d * h) % 90) * 100,
        input_tokens: Math.round(tokens * 0.08),
        output_tokens: Math.round(tokens * 0.92),
        total_tokens: tokens,
        input_chars: tokens * 2,
        output_chars: tokens * 3,
        input_text_prefix: h % 4 === 0 ? 'bun run trace:costs -- --json' : 'workspace command',
        stderr: (d + h) % 23 === 0 ? 'command failed' : '',
      });
    }
  }
  return rows;
}
