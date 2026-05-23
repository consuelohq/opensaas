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
  color: boolean;
  once: boolean;
  help: boolean;
  limit: number;
  interval: number;
  since?: string;
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
  --json                 Output JSON lines.
  --once                 Print matching rows once and exit.
  --no-color             Disable colors.
  --help                 Show help.

Examples:
  bun run trace:watch
  bun run trace:watch --limit 20
  bun run trace:watch --branch task/workspace-agents/fix-database
  bun run trace:watch --errors --since 1h
`;

function parseArgs(argv: string[]): Args {
  const args: Args = { errors: false, json: false, color: process.stdout.isTTY, once: false, help: false, limit: 0, interval: 1000 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i] || '';
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--errors') args.errors = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--once') args.once = true;
    else if (arg === '--no-color') args.color = false;
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

function runSql(db: string, sql: string): Row[] {
  const result = spawnSync('sqlite3', ['-json', db, sql], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `sqlite3 exited ${result.status}`);
  const text = result.stdout.trim();
  return text ? JSON.parse(text) as Row[] : [];
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

function baseSelect(where: string, order: 'ASC' | 'DESC', limit?: number): string {
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
  result_json,
  stderr
FROM tool_traces
WHERE 1=1 ${where}
ORDER BY rowid ${order}
${limit && limit > 0 ? `LIMIT ${limit}` : ''};`;
}

function c(args: Args, code: string, text: string): string {
  if (!args.color) return text;
  return `\u001b[${code}m${text}\u001b[0m`;
}

function fmtDuration(ms: unknown): string {
  const n = Number(ms || 0);
  if (!Number.isFinite(n)) return '0.00s';
  return `${(n / 1000).toFixed(2)}s`;
}

function fmtTokens(row: Row): string {
  const total = Number(row.total_tokens || 0);
  if (!Number.isFinite(total) || total <= 0) return '0 tok';
  if (total >= 1000) return `${(total / 1000).toFixed(1)}k tok`;
  return `${total} tok`;
}

function shortBranch(row: Row): string {
  const raw = String(row.branch || row.task_session || 'no-branch');
  return raw.replace(/^task\//, '').replace(/^stream\//, 'stream/');
}

function parseJson(value: unknown): any {
  if (typeof value !== 'string' || !value.trim()) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function compactDetail(row: Row): string {
  const input = parseJson(row.resolved_input_json) || parseJson(row.input_json) || {};
  const result = parseJson(row.result_json) || {};
  const stderr = String(row.stderr || '').trim().replace(/\s+/g, ' ');
  const parts: string[] = [];
  if (input.path) parts.push(String(input.path));
  if (input.pattern) parts.push(`pattern=${input.pattern}`);
  if (Array.isArray(input.paths)) parts.push(input.paths.slice(0, 3).join(', '));
  if (input.query) parts.push(`query=${input.query}`);
  if (input.keyword) parts.push(`keyword=${input.keyword}`);
  if (Array.isArray(input.command)) parts.push(input.command.slice(0, 5).join(' '));
  if (result.message) parts.push(String(result.message));
  if (stderr) parts.push(stderr.slice(0, 180));
  return parts.join(' | ').slice(0, 220);
}

function renderRow(args: Args, row: Row) {
  if (args.json) {
    console.log(JSON.stringify(row));
    return;
  }
  const ok = String(row.status || '') === 'ok' && String(row.code || '') === 'OK' && Number(row.exit_code || 0) === 0;
  const icon = ok ? c(args, '32', '✓') : c(args, '31', '✗');
  const tool = c(args, '36', String(row.tool || 'unknown').padEnd(16).slice(0, 16));
  const code = ok ? c(args, '2', String(row.code || 'OK')) : c(args, '33', String(row.code || row.status || 'ERR'));
  const time = String(row.ts || '').replace('T', ' ').replace(/\.\d+Z?$/, '').slice(11, 19);
  const first = `${c(args, '2', time)}  ${icon} ${tool} ${fmtDuration(row.duration_ms).padStart(7)} ${fmtTokens(row).padStart(9)} ${code}`;
  console.log(`${first}  ${c(args, '35', shortBranch(row))}`);
  const detail = compactDetail(row);
  if (detail) console.log(`          ${c(args, '2', detail)}`);
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
  let lastId = 0;
  if (args.limit > 0 || args.once) {
    const rows = runSql(db, baseSelect(filters, 'DESC', args.limit || 50)).reverse();
    for (const row of rows) {
      lastId = Math.max(lastId, Number(row.rownum || 0));
      renderRow(args, row);
    }
    if (args.once) return;
  } else if (args.since) {
    lastId = 0;
  } else {
    const rows = runSql(db, 'SELECT coalesce(max(rowid), 0) AS rownum FROM tool_traces;');
    lastId = Number(rows[0]?.rownum || 0);
  }

  if (!args.json) {
    console.error(c(args, '2', `watching ${db}`));
    console.error(c(args, '2', 'press Ctrl-C to stop'));
  }

  while (true) {
    const rows = runSql(db, baseSelect(` AND rowid > ${lastId}${filters}`, 'ASC'));
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
