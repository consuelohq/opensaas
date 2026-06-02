#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type TraceHomeRow = {
  rownum?: number;
  record_id?: string;
  ts?: string;
  trace_id?: string;
  tool?: string;
  task_session?: string;
  branch?: string;
  worktree?: string;
  status?: string;
  code?: string;
  exit_code?: number | null;
  duration_ms?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  input_json?: string | null;
  resolved_input_json?: string | null;
  result_json?: string | null;
  nested_operations_json?: string | null;
  batch_results_json?: string | null;
  stderr?: string | null;
};

type JsonRecord = Record<string, unknown>;

type CommandQuality = {
  quality: 'good' | 'suspect' | 'bad';
  reason: string;
  replacement?: string;
};

type TraceChild = {
  tool: string;
  ok: boolean;
  status: string;
  durationMs: number;
  totalTokens: number;
  detail: string;
};

type NormalizedTraceRow = {
  id: string;
  rownum: number;
  time: string;
  traceId: string;
  tool: string;
  status: string;
  ok: boolean;
  code: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  branch: string;
  shortBranch: string;
  command: string;
  message: string;
  stderr: string;
  raw: TraceHomeRow;
  children: TraceChild[];
  commandQuality?: CommandQuality;
};

export type TraceHomeModel = {
  header: {
    title: 'trace:home';
    live: boolean;
    rows: number;
    errors: number;
    running: number;
    branches: number;
    since: string;
    filter: string;
  };
  rows: NormalizedTraceRow[];
  summary: {
    rows: number;
    errors: number;
    running: number;
    branches: number;
    since: string;
  };
  topTools: Array<{ tool: string; tokens: number; calls: number }>;
  rawShell: { total: number; good: number; suspect: number; bad: number };
  selected?: {
    traceId: string;
    status: string;
    duration: string;
    tokens: string;
    branch: string;
    timing: string;
    command: string;
    stderr: string;
    commandQuality?: CommandQuality;
    tabs: string[];
  };
  tree: { lines: string[] };
  rawJson: string;
};

export type TraceHomeBuildOptions = {
  now?: Date;
  selectedTraceId?: string;
  sinceLabel?: string;
  live?: boolean;
  filterLabel?: string;
};

export type TraceHomeRenderOptions = {
  width?: number;
  height?: number;
  color?: boolean;
};

type Args = {
  db?: string;
  limit: number;
  interval: number;
  once: boolean;
  color: boolean;
  help: boolean;
  selectedTraceId?: string;
  filterLabel: string;
};

const defaultTraceDb = join(
  homedir(),
  'Library/Application Support/OpenWorkspace/traces/e8425497c3ee20bf0a28e9da/traces.db',
);

const usage = `Trace homebase dashboard.

Usage:
  bun run trace:home [options]

Options:
  --db <path>              Trace DB path. Defaults to current OpenWorkspace trace DB.
  --limit <n>              Number of latest rows to load. Default: 80.
  --interval <ms>          Live refresh interval. Default: 1000.
  --trace-id <id>          Select a trace id in the inspector panes.
  --once                   Render once and exit.
  --no-color               Disable ANSI color.
  --help                   Show help.

Keys in live TTY mode:
  q quit · r refresh · space pause/resume
`;

export function resolveTraceDb(argsDb?: string, env: Record<string, string | undefined> = process.env): string {
  return argsDb || env.OPENWORKSPACE_TRACE_DB || env.TRACE_DB || defaultTraceDb;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    limit: 80,
    interval: 1000,
    once: false,
    color: process.stdout.isTTY,
    help: false,
    filterLabel: 'none',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index] || '';
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--once') args.once = true;
    else if (arg === '--no-color') args.color = false;
    else if (arg === '--db') args.db = next();
    else if (arg.startsWith('--db=')) args.db = arg.slice(5);
    else if (arg === '--limit') args.limit = Number(next());
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice(8));
    else if (arg === '--interval') args.interval = Number(next());
    else if (arg.startsWith('--interval=')) args.interval = Number(arg.slice(11));
    else if (arg === '--trace-id') args.selectedTraceId = next();
    else if (arg.startsWith('--trace-id=')) args.selectedTraceId = arg.slice(11);
    else throw new Error(`unknown option: ${arg}`);
  }
  if (!Number.isFinite(args.limit) || args.limit <= 0) args.limit = 80;
  if (!Number.isFinite(args.interval) || args.interval < 250) args.interval = 1000;
  return args;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function numeric(value: unknown, fallback = 0): number {
  const numberValue = Number(value ?? fallback);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function isOk(row: TraceHomeRow): boolean {
  return String(row.status || '') === 'ok' && String(row.code || '') === 'OK' && numeric(row.exit_code, 0) === 0;
}

function formatTime(value: unknown): string {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date).replace(/^24:/, '00:');
}

function formatDuration(ms: unknown): string {
  const duration = numeric(ms, 0);
  return `${(duration / 1000).toFixed(2)}s`;
}

function formatTokens(value: unknown): string {
  const tokens = numeric(value, 0);
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return String(Math.round(tokens));
}

function shortBranch(value: unknown): string {
  const raw = cleanText(value || 'no-branch');
  return raw.replace(/^task\//, '').replace(/^stream\//, 'stream/');
}

function commandFromRow(row: TraceHomeRow): string[] {
  const input = parseJson(row.resolved_input_json) ?? parseJson(row.input_json);
  if (isRecord(input) && Array.isArray(input.command)) return input.command.map((part) => String(part));
  return [];
}

function commandText(command: string[]): string {
  return command.join(' ');
}

function extractShellFile(command: string): string | undefined {
  const sed = command.match(/sed\s+-n\s+['"][^'"]+['"]\s+([^\s;&|]+)/);
  if (sed?.[1]) return sed[1];
  const reader = command.match(/(?:cat|head|tail)\s+(?:-[^\s]+\s+)?([^\s;&|]+)/);
  if (reader?.[1]) return reader[1];
  const grep = command.match(/(?:grep|rg)\s+.*?\s+([^\s;&|]+\.(?:ts|tsx|js|jsx|md|json))/);
  if (grep?.[1]) return grep[1];
  const gitShow = command.match(/git\s+show\s+[^:]+:([^\s;&|]+)/);
  if (gitShow?.[1]) return gitShow[1];
  return undefined;
}

export function classifyTaskCallCommand(command: string[]): CommandQuality {
  if (command.length === 0) {
    return { quality: 'good', reason: 'No shell command recorded.' };
  }

  const text = commandText(command);
  const shellBody = command[0] === 'bash' || command[0] === 'sh' || command[0] === 'zsh'
    ? command.slice(2).join(' ')
    : text;

  if (/\brm\s+-rf\b|\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-f|\bkill\s+-9\b|\bpkill\b/.test(shellBody)) {
    return {
      quality: 'bad',
      reason: 'Destructive or broad shell operation.',
      replacement: 'Use a typed workspace cleanup, restore, or trash tool.',
    };
  }

  if ((command[0] === 'bash' || command[0] === 'sh' || command[0] === 'zsh') && /\b(sed|cat|head|tail|grep|rg|find)\b|\bgit\s+(show|status)\b/.test(shellBody)) {
    const file = extractShellFile(shellBody);
    return {
      quality: 'suspect',
      reason: 'Repository file inspection via shell.',
      replacement: file ? `fs.read({ path: '${file}' })` : 'Use fs.read, fs.search, or git.diff instead.',
    };
  }

  return {
    quality: 'good',
    reason: command[0] === 'bash' || command[0] === 'sh' || command[0] === 'zsh'
      ? 'Shell command appears to run an intended package/runtime command.'
      : 'Command appears to be an intended package/runtime command.',
  };
}

function nestedOperationFromResult(result: unknown, toolFallback: string): TraceChild | undefined {
  if (!isRecord(result)) return undefined;
  const ok = result.ok === true || (result.code === 'OK' && result.ok !== false);
  return {
    tool: cleanText(result.tool || toolFallback || 'unknown') || 'unknown',
    ok,
    status: ok ? 'ok' : cleanText(result.code || 'ERR'),
    durationMs: numeric(result.durationMs ?? result.duration_ms, 0),
    totalTokens: numeric(result.totalTokens ?? result.total_tokens, 0),
    detail: cleanText(result.detail || result.message || ''),
  };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function codeRunChildren(row: TraceHomeRow): TraceChild[] {
  const extracted = parseJson(row.nested_operations_json);
  const result = parseJson(row.result_json);
  const data = isRecord(result) && isRecord(result.data) ? result.data : undefined;
  const nestedData = data && isRecord(data.data) ? data.data : undefined;
  return asArray(extracted ?? data?.operations ?? nestedData?.operations)
    .map((operation) => nestedOperationFromResult(operation, 'unknown'))
    .filter((operation): operation is TraceChild => Boolean(operation));
}

function batchChildren(row: TraceHomeRow): TraceChild[] {
  const input = parseJson(row.resolved_input_json) ?? parseJson(row.input_json) ?? {};
  const steps = Array.isArray(input) ? input : isRecord(input) ? asArray(input.steps) : [];
  const extracted = parseJson(row.batch_results_json);
  const result = parseJson(row.result_json);
  const data = isRecord(result) && isRecord(result.data) ? result.data : undefined;
  const nestedData = data && isRecord(data.data) ? data.data : undefined;
  return asArray(extracted ?? data?.results ?? nestedData?.results)
    .map((batchResult, index) => {
      const step = steps[index];
      const tool = isRecord(step) ? cleanText(step.tool) : 'unknown';
      return nestedOperationFromResult(batchResult, tool || 'unknown');
    })
    .filter((operation): operation is TraceChild => Boolean(operation));
}

function childrenForRow(row: TraceHomeRow): TraceChild[] {
  if (row.tool === 'code.run') return codeRunChildren(row);
  if (row.tool === 'batch') return batchChildren(row);
  return [];
}

function messageForRow(row: TraceHomeRow, command: string[]): string {
  if (command.length > 0) return commandText(command);
  const result = parseJson(row.result_json);
  if (isRecord(result)) {
    if (result.message) return cleanText(result.message);
    if (isRecord(result.data) && result.data.message) return cleanText(result.data.message);
  }
  return cleanText(row.code || row.status || '');
}

function normalizeRow(row: TraceHomeRow): NormalizedTraceRow {
  const command = commandFromRow(row);
  const ok = isOk(row);
  const children = childrenForRow(row);
  const childTokens = children.reduce((sum, child) => sum + child.totalTokens, 0);
  const commandQuality = row.tool === 'task.call' ? classifyTaskCallCommand(command) : undefined;
  return {
    id: cleanText(row.record_id || row.trace_id || row.rownum || ''),
    rownum: numeric(row.rownum, 0),
    time: formatTime(row.ts),
    traceId: cleanText(row.trace_id),
    tool: cleanText(row.tool || 'unknown'),
    status: cleanText(row.status || (ok ? 'ok' : 'failed')),
    ok,
    code: cleanText(row.code || (ok ? 'OK' : 'ERR')),
    durationMs: numeric(row.duration_ms, 0),
    inputTokens: numeric(row.input_tokens, 0),
    outputTokens: numeric(row.output_tokens, 0),
    totalTokens: numeric(row.total_tokens, 0) || childTokens,
    branch: cleanText(row.branch || row.task_session || 'no-branch'),
    shortBranch: shortBranch(row.branch || row.task_session || 'no-branch'),
    command: commandText(command),
    message: messageForRow(row, command),
    stderr: cleanText(row.stderr),
    raw: row,
    children,
    commandQuality,
  };
}

function selectedFromRow(row: NormalizedTraceRow): TraceHomeModel['selected'] {
  const timing = `emit 5ms   provider ${Math.max(0, row.durationMs - 5)}ms   wall ${formatDuration(row.durationMs)}   exact`;
  return {
    traceId: row.traceId,
    status: row.ok ? 'ok' : 'failed',
    duration: `${formatDuration(row.durationMs)} (wall)`,
    tokens: `${row.totalTokens} (input ${row.inputTokens} / output ${row.outputTokens})`,
    branch: row.shortBranch,
    timing,
    command: row.command || row.message,
    stderr: row.stderr,
    commandQuality: row.commandQuality,
    tabs: ['COMMAND', 'STDOUT', 'STDERR', 'JSON', `CHILDREN (${row.children.length})`, 'METRICS'],
  };
}

function buildTree(rows: NormalizedTraceRow[]): string[] {
  const lines: string[] = [];
  for (const row of rows) {
    const marker = row.ok ? '✓' : '✕';
    lines.push(`${marker} ${row.tool} (${formatDuration(row.durationMs)}) ${row.message}`.trim());
    for (const child of row.children) {
      const childMarker = child.ok ? '✓' : '✕';
      lines.push(`  ├─ ${childMarker} ${child.tool} (${formatDuration(child.durationMs)}) ${child.detail}`.trimEnd());
    }
  }
  return lines;
}

function compactString(value: string, limit = 500): string | { preview: string; chars: number; truncated: true } {
  if (value.length <= limit) return value;
  return { preview: value.slice(0, limit), chars: value.length, truncated: true };
}

function compactRawRow(row: TraceHomeRow, classification?: CommandQuality): JsonRecord {
  const compacted: JsonRecord = {};
  for (const [key, value] of Object.entries(row)) {
    compacted[key] = typeof value === 'string' ? compactString(value) : value;
  }
  compacted.classification = classification;
  return compacted;
}

export function buildTraceHomeModel(rows: TraceHomeRow[], options: TraceHomeBuildOptions = {}): TraceHomeModel {
  const normalized = [...rows].sort((left, right) => numeric(left.rownum, 0) - numeric(right.rownum, 0)).map(normalizeRow);
  const errors = normalized.filter((row) => !row.ok).length;
  const running = normalized.filter((row) => row.status === 'running' || row.status === 'pending').length;
  const branches = new Set(normalized.map((row) => row.branch)).size;
  const since = options.sinceLabel || 'now';
  const selectedRow = normalized.find((row) => row.traceId === options.selectedTraceId) ?? normalized.find((row) => !row.ok) ?? normalized[0];

  const toolAgg = new Map<string, { tool: string; tokens: number; calls: number }>();
  for (const row of normalized) {
    const current = toolAgg.get(row.tool) ?? { tool: row.tool, tokens: 0, calls: 0 };
    current.tokens += row.totalTokens;
    current.calls += 1;
    toolAgg.set(row.tool, current);
  }
  const topTools = [...toolAgg.values()].sort((left, right) => right.tokens - left.tokens || right.calls - left.calls).slice(0, 8);

  const rawShell = { total: 0, good: 0, suspect: 0, bad: 0 };
  for (const row of normalized) {
    if (row.tool !== 'task.call' || !row.commandQuality) continue;
    rawShell.total += 1;
    rawShell[row.commandQuality.quality] += 1;
  }
  const rawJson = selectedRow
    ? JSON.stringify(compactRawRow(selectedRow.raw, selectedRow.commandQuality), null, 2)
    : '{}';


  return {
    header: {
      title: 'trace:home',
      live: options.live !== false,
      rows: normalized.length,
      errors,
      running,
      branches,
      since,
      filter: options.filterLabel || 'none',
    },
    rows: normalized,
    summary: { rows: normalized.length, errors, running, branches, since },
    topTools,
    rawShell,
    selected: selectedRow ? selectedFromRow(selectedRow) : undefined,
    tree: { lines: buildTree(normalized) },
    rawJson,
  };
}

function fit(value: string, width: number): string {
  if (width <= 0) return '';
  const text = value.replace(/\n/g, ' ');
  if (text.length > width) return `${text.slice(0, Math.max(0, width - 1))}…`;
  return text.padEnd(width);
}

function line(parts: string[]): string {
  return parts.join('  ').trimEnd();
}

function section(title: string): string {
  return title;
}

export function renderTraceHome(model: TraceHomeModel, options: TraceHomeRenderOptions = {}): string {
  const width = options.width || 151;
  const leftWidth = Math.max(82, Math.floor(width * 0.82));
  const visibleRows = Math.max(4, Math.min(14, (options.height || 44) - 30));
  const output: string[] = [];

  output.push(`trace:home   ${model.header.live ? 'LIVE ●' : 'PAUSED'}   since ${model.header.since}   rows ${model.header.rows.toLocaleString('en-US')}   errors ${model.header.errors}   running ${model.header.running}   branches ${model.header.branches}   filter: ${model.header.filter}`);
  output.push('TIME      STATUS  TOOL             DUR      TOKENS     BRANCH / TASK                                  MESSAGE / COMMAND');
  for (const row of model.rows.slice(-visibleRows)) {
    const status = row.ok ? '✓' : '✕';
    output.push(line([
      fit(row.time, 8),
      fit(status, 6),
      fit(row.tool, 14),
      fit(formatDuration(row.durationMs), 8),
      fit(formatTokens(row.totalTokens), 8),
      fit(row.shortBranch, 42),
      fit(row.message, 68),
    ]));
    for (const child of row.children.slice(0, 6)) {
      output.push(line([
        fit(row.time, 8),
        fit('├─ ' + (child.ok ? '✓' : '✕'), 6),
        fit(child.tool, 14),
        fit(formatDuration(child.durationMs), 8),
        fit(formatTokens(child.totalTokens), 8),
        fit(row.shortBranch, 42),
        fit(child.detail, 68),
      ]));
    }
  }

  output.push('');
  output.push(section('SUMMARY').padEnd(leftWidth) + '  ' + section('TOP TOOLS (TOKENS)'));
  output.push(`rows ${model.summary.rows.toLocaleString('en-US')}   errors ${model.summary.errors}   running ${model.summary.running}   branches ${model.summary.branches}   since ${model.summary.since}`.padEnd(leftWidth) + '  ' + model.topTools.map((tool) => `${tool.tool} ${formatTokens(tool.tokens)}`).join('   '));
  output.push(section('RAW SHELL (TASK.CALL)'));
  output.push(`total ${model.rawShell.total}   good ${model.rawShell.good}   suspect ${model.rawShell.suspect}   bad ${model.rawShell.bad}`);

  output.push('');
  output.push(`${section('trace:inspect')}  ${section('trace:tree')}  ${section('trace:json')}`);
  if (model.selected) {
    output.push(`STATUS ${model.selected.status}   DURATION ${model.selected.duration}   TOKENS ${model.selected.tokens}`);
    output.push(`BRANCH / TASK ${model.selected.branch}`);
    output.push(`TIMING ${model.selected.timing}`);
    output.push('COMMAND QUALITY ' + (model.selected.commandQuality ? model.selected.commandQuality.quality : 'none'));
    if (model.selected.commandQuality) {
      output.push(`REASON ${model.selected.commandQuality.reason}`);
      if (model.selected.commandQuality.replacement) output.push(`REPLACEMENT ${model.selected.commandQuality.replacement}`);
    }
    output.push(model.selected.tabs.join(' | '));
    output.push(`COMMAND ${fit(model.selected.command, 120)}`);
    if (model.selected.stderr) output.push(`STDERR ${fit(model.selected.stderr, 120)}`);
  }
  output.push('');
  output.push(model.tree.lines.slice(0, 12).join('\n'));
  output.push('');
  output.push(model.rawJson.split('\n').slice(0, 20).join('\n'));
  output.push('');
  output.push('enter: open   space: pause live   /: search   f: failed   b: filter branch   t: filter tool   g: group   r: refresh   c: copy id   ?: help   q: quit');
  return output.join('\n');
}

function runSql(db: string, sql: string): TraceHomeRow[] {
  const result = spawnSync('sqlite3', ['-cmd', '.timeout 1000', '-json', db, sql], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `sqlite3 exited ${result.status}`);
  const text = result.stdout.trim();
  return text ? JSON.parse(text) as TraceHomeRow[] : [];
}

function loadRows(db: string, limit: number): TraceHomeRow[] {
  const sql = `
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
  CASE WHEN tool = 'code.run' THEN coalesce(json_extract(result_json, '$.data.operations'), json_extract(result_json, '$.data.data.operations')) ELSE NULL END AS nested_operations_json,
  CASE WHEN tool = 'batch' THEN coalesce(json_extract(result_json, '$.data.results'), json_extract(result_json, '$.data.data.results')) ELSE NULL END AS batch_results_json,
  stderr
FROM tool_traces
ORDER BY rowid DESC
LIMIT ${Math.max(1, Math.min(500, limit))};`;
  return runSql(db, sql).reverse();
}

function clearScreen(): void {
  process.stdout.write('\u001b[?25l\u001b[H\u001b[2J');
}

function showCursor(): void {
  process.stdout.write('\u001b[?25h');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  let args: Args;
  try {
    args = parseArgs(Bun.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
  if (args.help) {
    console.log(usage);
    return;
  }
  const db = resolveTraceDb(args.db);
  if (!existsSync(db)) {
    console.error(`trace db not found: ${db}`);
    process.exit(1);
  }

  let paused = false;
  let shouldQuit = false;
  if (!args.once && process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (buffer) => {
      const key = buffer.toString('utf8');
      if (key === 'q' || key === '\u0003') shouldQuit = true;
      if (key === ' ') paused = !paused;
    });
  }

  try {
    do {
      const rows = loadRows(db, args.limit);
      const model = buildTraceHomeModel(rows, {
        selectedTraceId: args.selectedTraceId,
        sinceLabel: 'live',
        live: !paused,
        filterLabel: args.filterLabel,
      });
      if (!args.once && process.stdout.isTTY) clearScreen();
      console.log(renderTraceHome(model, { color: args.color }));
      if (args.once) break;
      await sleep(paused ? 250 : args.interval);
    } while (!shouldQuit);
  } finally {
    if (!args.once && process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      showCursor();
    }
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
