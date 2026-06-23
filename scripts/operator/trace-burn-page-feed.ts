#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

type DbRow = Record<string, unknown>;
type Args = {
  db?: string;
  artifactDir: string;
  limit: number;
  interval: number;
  once: boolean;
  raw: boolean;
  maxRowid?: number;
  help: boolean;
};

const defaultTraceDb = join(
  homedir(),
  'Library/Application Support/OpenWorkspace/traces/e8425497c3ee20bf0a28e9da/traces.db',
);

const defaultArtifactDir =
  'packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence';

const usage = `Write a pseudo-live JSON feed for the Trace Burn Intelligence archive page.

Usage:
  bun run trace:burn-feed -- [options]

Options:
  --db <path>             Trace SQLite DB path. Default: current OpenWorkspace trace DB.
  --artifact-dir <path>   Trace Burn Intelligence artifact directory.
  --limit <n>             Rows to export. Default: 250.
  --interval <seconds>    Watch interval in seconds. Default: 15.
  --once                  Write once and exit.
  --no-raw                Keep previews and parsed objects, but omit raw payload string copies.
  --max-rowid <n>         Export rows at or below a rowid, useful for stable tests.
  --help                  Print this help.

Examples:
  bun run trace:burn-feed -- --once --limit 250
  bun run trace:burn-feed -- --interval 15 --limit 250
`;

function parseArgs(argv: string[]): Args {
  const args: Args = {
    artifactDir: defaultArtifactDir,
    limit: 250,
    interval: 15,
    once: false,
    raw: true,
    help: false,
  };

  function next(index: number, flag: string): string {
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
    return value;
  }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--db') args.db = next(index++, arg);
    else if (arg.startsWith('--db=')) args.db = arg.slice('--db='.length);
    else if (arg === '--artifact-dir') args.artifactDir = next(index++, arg);
    else if (arg.startsWith('--artifact-dir=')) args.artifactDir = arg.slice('--artifact-dir='.length);
    else if (arg === '--limit') args.limit = Number(next(index++, arg));
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length));
    else if (arg === '--interval') args.interval = Number(next(index++, arg));
    else if (arg.startsWith('--interval=')) args.interval = Number(arg.slice('--interval='.length));
    else if (arg === '--max-rowid') args.maxRowid = Number(next(index++, arg));
    else if (arg.startsWith('--max-rowid=')) args.maxRowid = Number(arg.slice('--max-rowid='.length));
    else if (arg === '--once') args.once = true;
    else if (arg === '--no-raw') args.raw = false;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }

  if (!Number.isFinite(args.limit) || args.limit < 1) throw new Error('--limit must be a positive number');
  if (!Number.isFinite(args.interval) || args.interval < 1) throw new Error('--interval must be at least 1 second');
  if (args.maxRowid !== undefined && (!Number.isFinite(args.maxRowid) || args.maxRowid < 1)) {
    throw new Error('--max-rowid must be a positive number');
  }

  args.limit = Math.floor(args.limit);
  args.interval = Math.floor(args.interval);
  if (args.maxRowid !== undefined) args.maxRowid = Math.floor(args.maxRowid);
  return args;
}

function runJson(db: string, sql: string): DbRow[] {
  const result = spawnSync('sqlite3', ['-cmd', '.timeout 1000', '-json', db, sql], {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `sqlite3 exited ${result.status}`);
  }
  return JSON.parse(result.stdout || '[]') as DbRow[];
}

function sqlNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`invalid numeric SQL value: ${value}`);
  return String(Math.floor(value));
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseJson(raw: string): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return text.slice(0, Math.max(0, limit - 1)) + '…';
}

function formatDateTime(value: unknown): string {
  const date = new Date(asString(value));
  if (Number.isNaN(date.getTime())) return asString(value).replace('T', ' ').slice(0, 19);
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function formatTime(value: unknown): string {
  const date = new Date(asString(value));
  if (Number.isNaN(date.getTime())) return asString(value).slice(11, 19) || '--:--:--';
  return date.toISOString().slice(11, 19);
}

function formatDuration(ms: unknown): string {
  const value = asNumber(ms);
  if (value < 1000) return `${value}ms`;
  if (value < 60000) return `${(value / 1000).toFixed(value < 10000 ? 2 : 1)}s`;
  return `${(value / 60000).toFixed(1)}m`;
}

function statusFor(row: DbRow): string {
  const ok = asNumber(row.ok) === 1;
  const status = asString(row.status);
  const exitCode = asNumber(row.exit_code);
  return ok && status === 'ok' && exitCode === 0 ? 'success' : 'error';
}

function codeFor(row: DbRow): string {
  return asString(row.code || (statusFor(row) === 'success' ? 'OK' : 'ERROR'));
}

function summaryFor(row: DbRow, outputObj: unknown, stderr: string): string {
  const data = outputObj && typeof outputObj === 'object' && 'data' in outputObj ? (outputObj as Record<string, unknown>).data : null;
  const records = [data, outputObj].filter((value): value is Record<string, unknown> => Boolean(value && typeof value === 'object'));
  const candidates = [
    ...records.flatMap((record) => [record.message, record.detail, record.code]),
    stderr,
    row.result_json,
  ];
  const found = candidates.map(asString).find((value) => value.trim());
  return truncate(asString(found).replace(/s+/g, ' '), 700);
}

function rowToTrace(row: DbRow, index: number, raw: boolean) {
  const inputRaw = asString(row.input_json);
  const resolvedInputRaw = asString(row.resolved_input_json);
  const resultRaw = asString(row.result_json);
  const stderrRaw = asString(row.stderr);
  const inputObj = parseJson(inputRaw);
  const resolvedInputObj = parseJson(resolvedInputRaw);
  const outputObj = parseJson(resultRaw);
  const stderrObj = stderrRaw ? parseJson(stderrRaw) : null;
  const status = statusFor(row);
  const tokens = asNumber(row.total_tokens);
  const inputTokens = asNumber(row.input_tokens);
  const outputTokens = asNumber(row.output_tokens);
  const cost = tokens * 0.000003;
  const summary = summaryFor(row, outputObj, stderrRaw);
  const traceId = asString(row.trace_id);
  const mcpTraceId = asString(row.mcp_trace_id);

  return {
    id: index,
    recordId: asString(row.id) || `${mcpTraceId || 'trace'}:${traceId || asString(row.rowid)}`,
    startTime: formatDateTime(row.ts),
    time: formatTime(row.ts),
    type: asString(row.source) || 'mcp',
    name: asString(row.tool) || 'unknown',
    traceName: asString(row.tool) || 'unknown',
    input: resolvedInputRaw || inputRaw,
    output: resultRaw || stderrRaw || summary,
    summary,
    inputObj,
    resolvedInputObj,
    outputObj,
    stderrObj,
    ...(raw ? {
      rawInputJson: inputRaw,
      rawResolvedInputJson: resolvedInputRaw,
      rawResultJson: resultRaw,
      rawStderr: stderrRaw,
    } : {}),
    metadata: {
      rowid: asNumber(row.rowid),
      id: asString(row.id),
      trace_id: traceId,
      mcp_trace_id: mcpTraceId,
      source: asString(row.source),
      tool: asString(row.tool),
      task_session: asString(row.task_session),
      branch: asString(row.branch),
      worktree: asString(row.worktree),
      status: asString(row.status),
      ok: asNumber(row.ok) === 1,
      code: asString(row.code),
      exit_code: row.exit_code === null || row.exit_code === undefined ? null : asNumber(row.exit_code),
      duration_ms: asNumber(row.duration_ms),
      token_cost_model: 'static_estimate_usd_per_token_0.000003',
      raw_lengths: {
        input_json: inputRaw.length,
        resolved_input_json: resolvedInputRaw.length,
        result_json: resultRaw.length,
        stderr: stderrRaw.length,
      },
    },
    level: status === 'success' ? 'info' : 'error',
    latency: formatDuration(row.duration_ms),
    durationMs: asNumber(row.duration_ms),
    cost,
    costLabel: `$${cost.toFixed(4)}`,
    tokens,
    inputTokens,
    outputTokens,
    status,
    code: codeFor(row),
    branch: asString(row.branch || row.task_session || 'no-branch'),
    taskSession: asString(row.task_session),
    worktree: asString(row.worktree),
    env: asString(row.source) || 'mcp',
    stderr: stderrRaw,
  };
}

function traceToFailure(row: ReturnType<typeof rowToTrace>) {
  return {
    ts: row.startTime,
    time: row.time,
    tool: row.name,
    code: row.code,
    branch: row.branch,
    taskSession: row.taskSession,
    duration: row.latency,
    durationMs: row.durationMs,
    tokens: row.tokens,
    traceId: row.metadata.trace_id,
    status: 'error',
    exitCode: row.metadata.exit_code ?? 1,
    reason: row.stderr || row.summary || row.output || row.code,
    input: row.input,
    output: row.output,
    stderr: row.stderr,
  };
}

function readTraceRows(db: string, args: Args) {
  const ceiling = args.maxRowid ? `WHERE rowid <= ${sqlNumber(args.maxRowid)}` : '';
  const sql = `
SELECT rowid, id, ts, trace_id, mcp_trace_id, source, tool, task_session, branch, worktree, status, ok, code, exit_code, duration_ms,
       input_json, resolved_input_json, result_json, stderr, input_tokens, output_tokens, total_tokens
FROM tool_traces
${ceiling}
ORDER BY rowid DESC
LIMIT ${sqlNumber(args.limit)};
`;
  return runJson(db, sql).map((row, index) => rowToTrace(row, index, args.raw));
}

function topBy(rows: ReturnType<typeof rowToTrace>[], key: 'name' | 'branch') {
  const map = new Map<string, { key: string; count: number; tokens: number; errors: number }>();
  for (const row of rows) {
    const current = map.get(row[key]) || { key: row[key], count: 0, tokens: 0, errors: 0 };
    current.count += 1;
    current.tokens += row.tokens;
    if (row.status !== 'success') current.errors += 1;
    map.set(row[key], current);
  }
  return [...map.values()].sort((a, b) => b.tokens - a.tokens || b.count - a.count).slice(0, 8);
}

function writeJsonAtomically(filePath: string, value: unknown) {
  mkdirSync(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(value));
  renameSync(temporaryPath, filePath);
}

function buildFeed(db: string, args: Args) {
  const rows = readTraceRows(db, args);
  const failures = rows.filter((row) => row.status !== 'success').map(traceToFailure);
  const maxRowid = rows.reduce((max, row) => Math.max(max, row.metadata.rowid), 0);
  const tokens = rows.reduce((sum, row) => sum + row.tokens, 0);
  const inputTokens = rows.reduce((sum, row) => sum + row.inputTokens, 0);
  const outputTokens = rows.reduce((sum, row) => sum + row.outputTokens, 0);
  const cost = rows.reduce((sum, row) => sum + row.cost, 0);
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      db,
      limit: args.limit,
      raw: args.raw,
      maxRowid,
      rowCount: rows.length,
      failureCount: failures.length,
      tokens,
      inputTokens,
      outputTokens,
      cost,
      topTools: topBy(rows, 'name'),
      topBranches: topBy(rows, 'branch'),
    },
    rows,
    failures,
  };
}

function writeFeed(args: Args) {
  const db = args.db || process.env.TRACE_DB || defaultTraceDb;
  if (!existsSync(db)) throw new Error(`trace db not found: ${db}`);
  if (!existsSync(args.artifactDir)) throw new Error(`artifact dir not found: ${args.artifactDir}`);
  const feed = buildFeed(db, args);
  const feedPath = join(args.artifactDir, 'live-traces.json');
  writeJsonAtomically(feedPath, feed);
  return { feedPath, ...feed.meta };
}

function printStatus(status: ReturnType<typeof writeFeed>) {
  console.log(JSON.stringify({ ok: true, ...status }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage);
    return;
  }

  const status = writeFeed(args);
  printStatus(status);
  if (args.once) return;

  const intervalMs = args.interval * 1000;
  setInterval(() => {
    try {
      printStatus(writeFeed(args));
    } catch (error) {
      console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    }
  }, intervalMs);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
