#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

type Row = Record<string, unknown>;
type Args = {
  db?: string;
  task?: string;
  branch?: string;
  worktree?: string;
  tool?: string;
  errors: boolean;
  json: boolean;
  rawJson: boolean;
  color: boolean;
  once: boolean;
  help: boolean;
  nested: boolean;
  nestedLimit: number;
  limit: number;
  interval: number;
  since?: string;
};

type NestedOperation = {
  tool: string;
  helper?: string;
  ok: boolean;
  code?: string;
  message?: string;
  traceId?: string;
  durationMs?: number;
};

const defaultTraceDb = join(
  homedir(),
  'Library/Application Support/OpenWorkspace/traces/e8425497c3ee20bf0a28e9da/traces.db',
);

const usage = `Watch local workspace traces live.

Usage:
  bun run trace:watch [options]

Options:
  --db <path>            Trace DB path. Defaults to current OpenWorkspace trace DB.
  --task <taskSession>   Only show one task session.
  --branch <branch>      Only show one branch.
  --worktree <text>      Match worktree path text.
  --tool <tool>          Only show one tool.
  --errors               Only show failed or non-OK calls.
  --since <duration>     Start from recent history: 5m, 1h, 24h.
  --limit <n>            Print recent rows before watching. Default: 0.
  --interval <ms>        Poll interval. Default: 1000.
  --json                 Output compact JSON lines.
  --raw-json             Output raw database rows including full result_json/stderr.
  --once                 Print matching rows once and exit.
  --no-nested            Hide nested code.run/batch child operations.
  --nested-limit <n>     Max nested child operations to show. Default: 6.
  --no-color             Disable colors.
  --help                 Show help.

Examples:
  bun run trace:watch
  bun run trace:watch --limit 20
  bun run trace:watch --branch task/workspace-agents/fix-database
  bun run trace:watch --errors --since 1h
`;

function parseArgs(argv: string[]): Args {
  const args: Args = { errors: false, json: false, rawJson: false, color: process.stdout.isTTY, once: false, help: false, nested: true, nestedLimit: 6, limit: 0, interval: 1000 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i] || '';
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--errors') args.errors = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--raw-json') { args.json = true; args.rawJson = true; }
    else if (arg === '--once') args.once = true;
    else if (arg === '--no-color') args.color = false;
    else if (arg === '--no-nested') args.nested = false;
    else if (arg === '--nested-limit') args.nestedLimit = Number(next());
    else if (arg.startsWith('--nested-limit=')) args.nestedLimit = Number(arg.slice(15));
    else if (arg === '--db') args.db = next();
    else if (arg.startsWith('--db=')) args.db = arg.slice(5);
    else if (arg === '--task') args.task = next();
    else if (arg.startsWith('--task=')) args.task = arg.slice(7);
    else if (arg === '--branch') args.branch = next();
    else if (arg.startsWith('--branch=')) args.branch = arg.slice(9);
    else if (arg === '--worktree') args.worktree = next();
    else if (arg.startsWith('--worktree=')) args.worktree = arg.slice(11);
    else if (arg === '--tool') args.tool = next();
    else if (arg.startsWith('--tool=')) args.tool = arg.slice(7);
    else if (arg === '--since') args.since = next();
    else if (arg.startsWith('--since=')) args.since = arg.slice(8);
    else if (arg === '--limit') args.limit = Number(next());
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice(8));
    else if (arg === '--interval') args.interval = Number(next());
    else if (arg.startsWith('--interval=')) args.interval = Number(arg.slice(11));
    else throw new Error(`unknown option: ${arg}`);
  }
  if (!Number.isFinite(args.limit) || args.limit < 0) args.limit = 0;
  if (!Number.isFinite(args.nestedLimit) || args.nestedLimit < 0) args.nestedLimit = 6;
  if (!Number.isFinite(args.interval) || args.interval < 250) args.interval = 1000;
  return args;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function durationToSql(value: string): string {
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error(`invalid --since duration: ${value}. Use 5m, 1h, 24h, or 1d.`);
  const [, amount, unit] = match;
  const name = unit === 's' ? 'seconds' : unit === 'm' ? 'minutes' : unit === 'h' ? 'hours' : 'days';
  return `datetime('now', '-${amount} ${name}')`;
}

type SqlResult = { rows: Row[]; locked: boolean };

function isLockedError(text: string): boolean {
  return /database is locked|database table is locked|SQLITE_BUSY/i.test(text);
}

function runSql(db: string, sql: string): SqlResult {
  const result = spawnSync('sqlite3', ['-cmd', '.timeout 1000', '-json', db, sql], { encoding: 'utf8' });
  if (result.status !== 0) {
    const message = result.stderr || result.stdout || `sqlite3 exited ${result.status}`;
    if (isLockedError(message)) return { rows: [], locked: true };
    throw new Error(message);
  }
  const text = result.stdout.trim();
  return { rows: text ? JSON.parse(text) as Row[] : [], locked: false };
}

function sqlFilters(args: Args): string {
  const filters: string[] = [];
  if (args.task) filters.push(`task_session = ${shellQuote(args.task)}`);
  if (args.branch) filters.push(`branch = ${shellQuote(args.branch)}`);
  if (args.worktree) filters.push(`coalesce(worktree, '') LIKE ${shellQuote(`%${args.worktree}%`)}`);
  if (args.tool) filters.push(`tool = ${shellQuote(args.tool)}`);
  if (args.errors) filters.push(`(status != 'ok' OR code != 'OK' OR exit_code IS NOT NULL AND exit_code != 0)`);
  if (args.since) filters.push(`ts >= ${durationToSql(args.since)}`);
  return filters.length ? ` AND ${filters.join(' AND ')}` : '';
}

function baseSelect(where: string, order: 'ASC' | 'DESC', limit?: number, raw = false): string {
  const resultJson = raw ? 'result_json' : "substr(coalesce(result_json, ''), 1, 4000) AS result_json";
  const stderr = raw ? 'stderr' : "substr(coalesce(stderr, ''), 1, 4000) AS stderr";
  return `
SELECT
  rowid AS rownum,
  id AS record_id,
  ts,
  trace_id,
  tool,
  task_session,
  branch,
  worktree,
  status,
  code,
  exit_code,
  duration_ms,
  input_tokens,
  output_tokens,
  total_tokens,
  input_json,
  resolved_input_json,
  ${resultJson},
  CASE WHEN tool = 'code.run' THEN coalesce(json_extract(result_json, '$.data.operations'), json_extract(result_json, '$.data.data.operations')) ELSE NULL END AS nested_operations_json,
  CASE WHEN tool = 'batch' THEN coalesce(json_extract(result_json, '$.data.results'), json_extract(result_json, '$.data.data.results')) ELSE NULL END AS batch_results_json,
  length(coalesce(result_json, '')) AS result_json_chars,
  ${stderr},
  length(coalesce(stderr, '')) AS stderr_chars
FROM tool_traces
WHERE 1=1 ${where}
ORDER BY rowid ${order}
${limit && limit > 0 ? `LIMIT ${limit}` : ''};`;
}

function c(args: Args, code: string, text: string): string {
  if (!args.color) return text;
  return `\u001b[${code}m${text}\u001b[0m`;
}


const traceTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function fmtTraceTime(value: unknown): string {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return traceTimeFormatter.format(date).replace(/^24:/, '00:');
}

function fmtDuration(ms: unknown): string {
  const n = Number(ms || 0);
  if (!Number.isFinite(n)) return '0.00s';
  return `${(n / 1000).toFixed(2)}s`;
}

function fmtTokens(row: Row): string {
  const total = Number(row.total_tokens || 0);
  if (!Number.isFinite(total) || total <= 0) return '0 tokens';
  if (total >= 1000) return `${(total / 1000).toFixed(1)}k tokens`;
  return `${total} tokens`;
}

function shortBranch(row: Row): string {
  const raw = String(row.branch || row.task_session || 'no-branch');
  return raw.replace(/^task\//, '').replace(/^stream\//, 'stream/');
}

function parseJson(value: unknown): any {
  if (typeof value !== 'string' || !value.trim()) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function cleanText(value: unknown): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function isJsonEnvelope(value: string): boolean {
  const text = value.trim();
  return text.startsWith('{\"level\":') || text.startsWith('{"level":') || text.includes('\"event\":\"tool.executed\"') || text.includes('"event":"tool.executed"');
}

function textSize(value: unknown): number {
  return typeof value === 'string' ? value.length : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numericValue(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function compactJsonValue(value: unknown, limit = 1200): unknown {
  if (typeof value !== 'string') return value;
  const cleaned = cleanText(value);
  return cleaned.length > limit
    ? { preview: cleaned.slice(0, limit), chars: value.length, truncated: true, omitted: cleaned.length - limit }
    : cleaned;
}

function compactTraceRow(row: Row): Row {
  const result = parseJson(row.result_json);
  const stderr = cleanText(row.stderr);
  return {
    rownum: row.rownum,
    record_id: row.record_id,
    ts: row.ts,
    trace_id: row.trace_id,
    tool: row.tool,
    task_session: row.task_session,
    branch: row.branch,
    worktree: row.worktree,
    status: row.status,
    code: row.code,
    exit_code: row.exit_code,
    duration_ms: row.duration_ms,
    input_tokens: row.input_tokens,
    output_tokens: row.output_tokens,
    total_tokens: row.total_tokens,
    input_json: compactJsonValue(row.input_json, 800),
    resolved_input_json: compactJsonValue(row.resolved_input_json, 800),
    result: summarizeResultForTrace(result),
    nested_operations: nestedOperationsForRow(row),
    result_json_chars: numericValue(row.result_json_chars, textSize(row.result_json)),
    stderr: compactJsonValue(stderr, 1200),
    stderr_chars: numericValue(row.stderr_chars, textSize(row.stderr)),
  };
}

function summarizeResultForTrace(result: unknown): unknown {
  if (!isRecord(result)) return result;
  const data = isRecord(result.data) ? result.data : result;
  const schema = data.schema || result.schema;
  if (schema === 'review.summary.v1') {
    return {
      schema,
      base: data.base,
      branch: data.branch,
      files: data.files,
      affectedProjects: data.affectedProjects,
      checksRun: data.checksRun,
      summary: data.summary,
      mustFixCount: Array.isArray(data.mustFix) ? data.mustFix.length : 0,
      mustFix: Array.isArray(data.mustFix) ? data.mustFix.slice(0, 5) : [],
      preExistingDigest: data.preExistingDigest ? {
        total: data.preExistingDigest.total,
        byRule: data.preExistingDigest.byRule,
        byFile: data.preExistingDigest.byFile,
        truncated: data.preExistingDigest.truncated,
        omitted: data.preExistingDigest.omitted,
        sampleCount: Array.isArray(data.preExistingDigest.sample) ? data.preExistingDigest.sample.length : 0,
      } : undefined,
      testSummary: data.testSummary,
      fullEvidence: data.fullEvidence,
    };
  }
  if ('ok' in result || 'code' in result || 'message' in result) {
    return { ok: result.ok, code: result.code, message: result.message, exitCode: result.exitCode };
  }
  return compactJsonValue(JSON.stringify(result), 1200);
}

function compactSuccessDetail(row: Row): string {
  const input = parseJson(row.resolved_input_json) || parseJson(row.input_json) || {};
  const result = parseJson(row.result_json) || {};
  const candidates: string[] = [];
  if (result.message) candidates.push(cleanText(result.message));
  if (input.path) candidates.push(cleanText(input.path));
  if (input.pattern) candidates.push(`pattern=${cleanText(input.pattern)}`);
  if (input.query) candidates.push(`query=${cleanText(input.query)}`);
  if (input.keyword) candidates.push(`keyword=${cleanText(input.keyword)}`);
  const detail = candidates.find((candidate) => candidate && !isJsonEnvelope(candidate));
  return (detail || '').slice(0, 120);
}

function compactErrorDetail(row: Row): string {
  const result = parseJson(row.result_json) || {};
  const stderr = cleanText(row.stderr);
  const message = cleanText(result.message);
  const candidates = [stderr, message, cleanText(row.code), cleanText(row.status)].filter(Boolean);
  const detail = candidates.find((candidate) => !isJsonEnvelope(candidate)) || '';
  return detail.slice(0, 240);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nestedOperationFromResult(result: unknown, toolFallback: string): NestedOperation | null {
  if (!isRecord(result)) return null;
  const ok = result.ok === true || (result.code === 'OK' && result.ok !== false);
  return {
    tool: cleanText(result.tool || toolFallback || 'unknown') || 'unknown',
    helper: cleanText(result.helper),
    ok,
    code: cleanText(result.code || (ok ? 'OK' : 'ERR')),
    message: cleanText(result.message),
    traceId: cleanText(result.traceId),
    durationMs: numericValue(result.durationMs, 0),
  };
}

function codeRunOperations(row: Row): NestedOperation[] {
  const extracted = parseJson(row.nested_operations_json);
  const result = parseJson(row.result_json);
  const operations = asArray(extracted ?? (isRecord(result) && isRecord(result.data) ? result.data.operations : undefined) ?? (isRecord(result) && isRecord(result.data) && isRecord(result.data.data) ? result.data.data.operations : undefined));
  return operations
    .map((operation) => nestedOperationFromResult(operation, 'unknown'))
    .filter((operation): operation is NestedOperation => operation !== null);
}

function batchOperations(row: Row): NestedOperation[] {
  const input = parseJson(row.resolved_input_json) || parseJson(row.input_json) || {};
  const steps = isRecord(input) ? asArray(input.steps) : [];
  const extracted = parseJson(row.batch_results_json);
  const result = parseJson(row.result_json);
  const results = asArray(extracted ?? (isRecord(result) && isRecord(result.data) ? result.data.results : undefined) ?? (isRecord(result) && isRecord(result.data) && isRecord(result.data.data) ? result.data.data.results : undefined));
  return results
    .map((batchResult, index) => {
      const step = steps[index];
      const tool = isRecord(step) ? cleanText(step.tool) : 'unknown';
      return nestedOperationFromResult(batchResult, tool || 'unknown');
    })
    .filter((operation): operation is NestedOperation => operation !== null);
}

function nestedOperationsForRow(row: Row): NestedOperation[] {
  const tool = String(row.tool || '');
  if (tool === 'code.run') return codeRunOperations(row);
  if (tool === 'batch') return batchOperations(row);
  return [];
}

function renderNestedOperation(args: Args, operation: NestedOperation): string {
  const ok = operation.ok && (operation.code === 'OK' || !operation.code);
  const icon = ok ? c(args, '32', '✓') : c(args, '31', '✗');
  const tool = c(args, '36', operation.tool.padEnd(16).slice(0, 16));
  const code = ok ? c(args, '2', operation.code || 'OK') : c(args, '33', operation.code || 'ERR');
  const detail = cleanText(operation.helper || operation.message || '').slice(0, 100);
  const suffix = detail ? ` ${c(args, '2', '|')} ${c(args, '2', detail)}` : '';
  return `${c(args, '2', '          ↳')} ${icon} ${tool} ${fmtDuration(operation.durationMs).padStart(7)} ${code}${suffix}`;
}

function renderNestedOverflow(args: Args, omitted: number): string {
  return `${c(args, '2', '          ↳')} ${c(args, '2', `… ${omitted} more nested operation${omitted === 1 ? '' : 's'}`)}`;
}

const branchColors = ['35', '36', '33', '34', '32', '95', '96', '93', '94'];

function hashText(value: string): number {
  let hash = 0;
  for (const char of value) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

function branchColor(row: Row): string {
  const label = shortBranch(row);
  return branchColors[hashText(label) % branchColors.length] || '35';
}

function divider(args: Args): string {
  return c(args, '2', `  ${'·'.repeat(74)}`);
}

function renderStartup(args: Args, db: string) {
  if (args.json) return;
  console.log(c(args, '2', `watching traces • ${db}`));
  console.log(c(args, '2', 'press Ctrl-C to stop • flags: --limit 20, --errors, --since 10m, --task <id>, --branch <branch>, --worktree <text>, --tool <tool>, --json, --raw-json'));
  console.log(divider(args));
}

function renderRow(args: Args, row: Row) {
  if (args.json) {
    console.log(JSON.stringify(args.rawJson ? row : compactTraceRow(row)));
    return;
  }
  const ok = String(row.status || '') === 'ok' && String(row.code || '') === 'OK' && Number(row.exit_code || 0) === 0;
  const icon = ok ? c(args, '32', '✓') : c(args, '31', '✗');
  const tool = c(args, '36', String(row.tool || 'unknown').padEnd(16).slice(0, 16));
  const code = ok ? c(args, '2', String(row.code || 'OK')) : c(args, '33', String(row.code || row.status || 'ERR'));
  const time = fmtTraceTime(row.ts);
  const tokens = fmtTokens(row).padStart(12);
  const branch = c(args, branchColor(row), shortBranch(row));
  const first = ok
    ? `${c(args, '2', time)}  ${icon} ${tool} ${fmtDuration(row.duration_ms).padStart(7)} ${tokens} ${code}  ${branch}`
    : `${c(args, '2', time)}  ${icon} ${tool} ${code} ${fmtDuration(row.duration_ms).padStart(7)} ${tokens}  ${branch}`;
  const detail = ok ? compactSuccessDetail(row) : compactErrorDetail(row);
  if (ok && detail) console.log(`${first} ${c(args, '2', '|')} ${c(args, '2', detail)}`);
  else console.log(first);
  if (!ok && detail) console.log(`  ${c(args, '2', detail)}`);
  if (args.nested) {
    const nested = nestedOperationsForRow(row);
    for (const operation of nested.slice(0, args.nestedLimit)) console.log(renderNestedOperation(args, operation));
    if (nested.length > args.nestedLimit) console.log(renderNestedOverflow(args, nested.length - args.nestedLimit));
  }
  console.log(divider(args));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let args: Args;
  try { args = parseArgs(Bun.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(2); }
  if (args.help) { console.log(usage); return; }
  const db = args.db || process.env.TRACE_DB || defaultTraceDb;
  if (!existsSync(db)) { console.error(`trace db not found: ${db}`); process.exit(1); }

  const filters = sqlFilters(args);
  if (!args.once) renderStartup(args, db);
  let lastId = 0;
  if (args.limit > 0 || args.once) {
    const initial = runSql(db, baseSelect(filters, 'DESC', args.limit || 50, args.rawJson));
    const rows = initial.rows.reverse();
    for (const row of rows) {
      lastId = Math.max(lastId, Number(row.rownum || 0));
      renderRow(args, row);
    }
    if (args.once) return;
  } else if (args.since) {
    lastId = 0;
  } else {
    const latest = runSql(db, 'SELECT coalesce(max(rowid), 0) AS rownum FROM tool_traces;');
    lastId = Number(latest.rows[0]?.rownum || 0);
  }

  let lockedPolls = 0;
  while (true) {
    const result = runSql(db, baseSelect(` AND rowid > ${lastId}${filters}`, 'ASC', undefined, args.rawJson));
    if (result.locked) {
      lockedPolls += 1;
      if (!args.json && lockedPolls === 3) console.error(c(args, '2', 'trace db is busy; waiting for writer lock to clear...'));
      await sleep(args.interval);
      continue;
    }
    lockedPolls = 0;
    const rows = result.rows;
    for (const row of rows) {
      lastId = Math.max(lastId, Number(row.rownum || 0));
      renderRow(args, row);
    }
    await sleep(args.interval);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
