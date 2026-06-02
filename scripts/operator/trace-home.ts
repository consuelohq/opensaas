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

type GroupMode = 'flat' | 'branch' | 'tool';

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
  branchColor: string;
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
    groupMode: GroupMode;
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
    stdout: string;
    stderr: string;
    commandQuality?: CommandQuality;
    tabs: string[];
  };
  tree: { lines: string[] };
  rawJson: string;
  statusLine?: string;
};

export type TraceHomeBuildOptions = {
  now?: Date;
  selectedTraceId?: string;
  sinceLabel?: string;
  live?: boolean;
  filterLabel?: string;
  search?: string;
  failedOnly?: boolean;
  branchFilter?: string;
  toolFilter?: string;
  groupMode?: GroupMode;
  rawJson?: boolean;
  statusLine?: string;
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
  rawJson: boolean;
  selectedTraceId?: string;
  search: string;
  failedOnly: boolean;
  branchFilter?: string;
  toolFilter?: string;
};

type LiveState = {
  paused: boolean;
  shouldQuit: boolean;
  selectedTraceId?: string;
  search: string;
  failedOnly: boolean;
  branchFilter?: string;
  toolFilter?: string;
  groupMode: GroupMode;
  help: boolean;
  activePane: 'table' | 'inspect';
  inputMode?: 'search' | 'branch' | 'tool';
  inputBuffer: string;
  statusLine: string;
  rawJson: boolean;
};

export const terminalSequences = {
  enter: '\u001b[?1049h\u001b[?25l\u001b[H\u001b[2J',
  frame: '\u001b[H',
  clear: '\u001b[H\u001b[2J',
  exit: '\u001b[0m\u001b[?25h\u001b[?1049l',
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
  --search <text>          Filter visible rows by text.
  --branch <branch>        Filter visible rows by branch/task.
  --tool <tool>            Filter visible rows by tool.
  --failed                 Show failed rows only.
  --raw-json               Show compact raw JSON strings instead of sanitized default JSON.
  --once                   Render once and exit.
  --no-color               Disable ANSI color.
  --help                   Show help.

Keys in live TTY mode:
  enter open · space pause live · / search · f failed · b filter branch · t filter tool
  g group · r refresh · c copy id · ? help · q quit · arrows/j/k move · esc back
`;

const branchPalette = ['#c084fc', '#60a5fa', '#fbbf24', '#34d399', '#fb7185', '#22d3ee', '#a3e635', '#f472b6'];
const groupModes: GroupMode[] = ['flat', 'branch', 'tool'];

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
    rawJson: false,
    search: '',
    failedOnly: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index] || '';
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--once') args.once = true;
    else if (arg === '--no-color') args.color = false;
    else if (arg === '--failed') args.failedOnly = true;
    else if (arg === '--raw-json') args.rawJson = true;
    else if (arg === '--db') args.db = next();
    else if (arg.startsWith('--db=')) args.db = arg.slice(5);
    else if (arg === '--limit') args.limit = Number(next());
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice(8));
    else if (arg === '--interval') args.interval = Number(next());
    else if (arg.startsWith('--interval=')) args.interval = Number(arg.slice(11));
    else if (arg === '--trace-id') args.selectedTraceId = next();
    else if (arg.startsWith('--trace-id=')) args.selectedTraceId = arg.slice(11);
    else if (arg === '--search') args.search = next();
    else if (arg.startsWith('--search=')) args.search = arg.slice(9);
    else if (arg === '--branch') args.branchFilter = next();
    else if (arg.startsWith('--branch=')) args.branchFilter = arg.slice(9);
    else if (arg === '--tool') args.toolFilter = next();
    else if (arg.startsWith('--tool=')) args.toolFilter = arg.slice(7);
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

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '');
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
  if (duration >= 100000) return `${(duration / 1000).toFixed(1)}s`;
  return `${(duration / 1000).toFixed(2)}s`;
}

function formatTokens(value: unknown): string {
  const tokens = numeric(value, 0);
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}m`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return String(Math.round(tokens));
}

function shortBranch(value: unknown): string {
  const raw = cleanText(value || 'no-branch');
  return raw.replace(/^task\//, '').replace(/^stream\//, 'stream/');
}

function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function branchColor(value: string): string {
  return branchPalette[hashText(value) % branchPalette.length];
}

function commandFromRow(row: TraceHomeRow): string[] {
  const input = parseJson(row.resolved_input_json) ?? parseJson(row.input_json);
  if (isRecord(input) && Array.isArray(input.command)) return input.command.map((part) => String(part));
  return [];
}

function commandText(command: string[]): string {
  return command.join(' ');
}

function normalizedCommand(command: string[]): string[] {
  return command[0] === 'task.exec' || command[0] === 'task.call' ? command.slice(1) : command;
}

function shellBodyFromCommand(command: string[]): string {
  const normalized = normalizedCommand(command);
  if (['bash', 'sh', 'zsh'].includes(normalized[0]) && normalized[1] === '-lc') return normalized.slice(2).join(' ');
  if (['bash', 'sh', 'zsh'].includes(normalized[0])) return normalized.slice(1).join(' ');
  return commandText(normalized);
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
  const normalized = normalizedCommand(command);
  if (normalized.length === 0) {
    return { quality: 'good', reason: 'No shell command recorded.' };
  }

  const shellBody = shellBodyFromCommand(command);

  if (/\brm\s+-rf\b|\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-f|\bkill\s+-9\b|\bpkill\b/.test(shellBody)) {
    return {
      quality: 'bad',
      reason: 'Destructive or broad shell operation.',
      replacement: 'Use a typed workspace cleanup, restore, or trash tool.',
    };
  }

  if (/\b(sed|cat|head|tail|grep|rg|find)\b|\bgit\s+(show|status)\b/.test(shellBody) && ['bash', 'sh', 'zsh'].includes(normalized[0])) {
    const file = extractShellFile(shellBody);
    return {
      quality: 'suspect',
      reason: 'Repository file inspection via shell.',
      replacement: file ? `fs.read({ path: '${file}' })` : 'Use fs.read, fs.search, or git.diff instead.',
    };
  }

  return {
    quality: 'good',
    reason: ['bash', 'sh', 'zsh'].includes(normalized[0])
      ? 'Shell command appears to run an intended package/runtime command.'
      : 'Command appears to be an intended package/runtime command.',
  };
}

function githubCommandShape(row?: TraceHomeRow): string {
  const input = row ? parseJson(row.resolved_input_json) ?? parseJson(row.input_json) : undefined;
  if (!isRecord(input)) return 'gh';
  const rawArgs = Array.isArray(input.rawArgs) ? input.rawArgs.map(String) : Array.isArray(input.args) ? input.args.map(String) : [];
  if (rawArgs.length > 0) return `gh ${rawArgs.join(' ')}`;
  const operation = cleanText(input.operation || 'raw');
  return operation === 'raw' ? 'gh' : `github ${operation}`;
}

function githubOperation(row?: TraceHomeRow): string {
  const input = row ? parseJson(row.resolved_input_json) ?? parseJson(row.input_json) : undefined;
  if (isRecord(input)) return cleanText(input.operation || 'raw') || 'raw';
  return 'raw';
}

function summarizeGithubWrapper(value: string, row?: TraceHomeRow): string | undefined {
  const lower = value.toLowerCase();
  if (!lower.includes('execfilesync') && !lower.includes('logs unavailable') && !lower.includes('still in progress')) return undefined;
  const reason = lower.includes('still in progress') || lower.includes('logs unavailable')
    ? 'job still in progress; logs unavailable yet'
    : 'GitHub wrapper command failed';
  return `github ${githubOperation(row)} — ${reason} — ${githubCommandShape(row)}`;
}

export function sanitizeDefaultText(value: unknown, row?: TraceHomeRow): string {
  const raw = String(value ?? '');
  const githubSummary = summarizeGithubWrapper(raw, row);
  if (githubSummary) return githubSummary;

  return raw
    .split(/\r?\n/)
    .filter((lineText) => !lineText.includes("execFileSync('gh', args"))
    .filter((lineText) => !/^\s*at\s+/.test(lineText))
    .filter((lineText) => !lineText.includes('implementationCommand'))
    .join('\n')
    .trim()
    .replace(/\s+/g, ' ');
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
    detail: sanitizeDefaultText(result.detail || result.message || ''),
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

function resultStdout(row: TraceHomeRow): string {
  const result = parseJson(row.result_json);
  if (!isRecord(result)) return '';
  const data = isRecord(result.data) ? result.data : undefined;
  return sanitizeDefaultText(data?.raw || data?.stdout || result.stdout || '', row);
}

function messageForRow(row: TraceHomeRow, command: string[]): string {
  if (row.tool === 'github') {
    const stderr = sanitizeDefaultText(row.stderr, row);
    if (stderr) return stderr;
  }
  if (command.length > 0) return sanitizeDefaultText(commandText(command), row);
  const result = parseJson(row.result_json);
  if (isRecord(result)) {
    if (result.message) return sanitizeDefaultText(result.message, row);
    if (isRecord(result.data) && result.data.message) return sanitizeDefaultText(result.data.message, row);
  }
  return sanitizeDefaultText(row.code || row.status || '', row);
}

function normalizeRow(row: TraceHomeRow): NormalizedTraceRow {
  const command = commandFromRow(row);
  const ok = isOk(row);
  const children = childrenForRow(row);
  const childTokens = children.reduce((sum, child) => sum + child.totalTokens, 0);
  const commandQuality = row.tool === 'task.call' || row.tool === 'task.exec' ? classifyTaskCallCommand(command) : undefined;
  const branch = cleanText(row.branch || row.task_session || 'no-branch');
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
    branch,
    shortBranch: shortBranch(branch),
    branchColor: branchColor(branch),
    command: sanitizeDefaultText(commandText(command), row),
    message: messageForRow(row, command),
    stderr: sanitizeDefaultText(row.stderr, row),
    raw: row,
    children,
    commandQuality,
  };
}

function selectedFromRow(row: NormalizedTraceRow): TraceHomeModel['selected'] {
  const timing = `emit unavailable   provider unavailable   wall ${formatDuration(row.durationMs)}   derived`;
  return {
    traceId: row.traceId,
    status: row.ok ? 'ok' : 'failed',
    duration: `${formatDuration(row.durationMs)} (wall)`,
    tokens: `${row.totalTokens} (input ${row.inputTokens} / output ${row.outputTokens})`,
    branch: row.shortBranch,
    timing,
    command: row.command || row.message,
    stdout: resultStdout(row.raw),
    stderr: row.stderr,
    commandQuality: row.commandQuality,
    tabs: ['COMMAND', 'STDOUT', 'STDERR', 'JSON', `CHILDREN (${row.children.length})`, 'METRICS'],
  };
}

function buildTree(rows: NormalizedTraceRow[], selectedTraceId?: string): string[] {
  const lines: string[] = [];
  for (const row of rows) {
    const marker = row.traceId === selectedTraceId ? '>' : row.ok ? '✓' : '✕';
    lines.push(`${marker} ${row.tool} (${formatDuration(row.durationMs)}) ${row.message}`.trim());
    for (const child of row.children) {
      const childMarker = child.ok ? '✓' : '✕';
      lines.push(`  ├─ ${childMarker} ${child.tool} (${formatDuration(child.durationMs)}) ${child.detail}`.trimEnd());
    }
  }
  return lines;
}

function compactString(value: string, limit = 500): string | { preview: string; chars: number; truncated: true } {
  const sanitized = sanitizeDefaultText(value);
  if (sanitized.length <= limit) return sanitized;
  return { preview: sanitized.slice(0, limit), chars: sanitized.length, truncated: true };
}

function compactRawRow(row: TraceHomeRow, classification?: CommandQuality, rawJson = false): JsonRecord {
  const compacted: JsonRecord = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string') compacted[key] = rawJson ? compactString(value, 1200) : compactString(value);
    else compacted[key] = value;
  }
  compacted.classification = classification;
  return compacted;
}

function rowMatchesSearch(row: NormalizedTraceRow, search: string): boolean {
  if (!search) return true;
  const haystack = `${row.traceId} ${row.tool} ${row.branch} ${row.message} ${row.command} ${row.stderr}`.toLowerCase();
  return haystack.includes(search.toLowerCase());
}

function filterLabel(options: TraceHomeBuildOptions): string {
  const labels: string[] = [];
  if (options.failedOnly) labels.push('failed');
  if (options.branchFilter) labels.push(`branch:${options.branchFilter}`);
  if (options.toolFilter) labels.push(`tool:${options.toolFilter}`);
  if (options.search) labels.push(`search:${options.search}`);
  return options.filterLabel || labels.join(' ') || 'none';
}

export function buildTraceHomeModel(rows: TraceHomeRow[], options: TraceHomeBuildOptions = {}): TraceHomeModel {
  const normalizedAll = [...rows].sort((left, right) => numeric(left.rownum, 0) - numeric(right.rownum, 0)).map(normalizeRow);
  const normalized = normalizedAll.filter((row) => {
    if (options.failedOnly && row.ok) return false;
    if (options.branchFilter && row.branch !== options.branchFilter && row.shortBranch !== options.branchFilter) return false;
    if (options.toolFilter && row.tool !== options.toolFilter) return false;
    return rowMatchesSearch(row, options.search || '');
  });
  const errors = normalized.filter((row) => !row.ok).length;
  const running = normalized.filter((row) => row.status === 'running' || row.status === 'pending').length;
  const branches = new Set(normalized.map((row) => row.branch)).size;
  const since = options.sinceLabel || 'now';
  const selectedRow = normalized.find((row) => row.traceId === options.selectedTraceId)
    ?? normalized.find((row) => !row.ok)
    ?? normalized[normalized.length - 1];

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
    if (!['task.call', 'task.exec'].includes(row.tool) || !row.commandQuality) continue;
    rawShell.total += 1;
    rawShell[row.commandQuality.quality] += 1;
  }
  const rawJson = selectedRow
    ? JSON.stringify(compactRawRow(selectedRow.raw, selectedRow.commandQuality, options.rawJson), null, 2)
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
      filter: filterLabel(options),
      groupMode: options.groupMode || 'flat',
    },
    rows: normalized,
    summary: { rows: normalized.length, errors, running, branches, since },
    topTools,
    rawShell,
    selected: selectedRow ? selectedFromRow(selectedRow) : undefined,
    tree: { lines: buildTree(normalized, selectedRow?.traceId) },
    rawJson,
    statusLine: options.statusLine,
  };
}

function visibleRowsFor(model: TraceHomeModel): NormalizedTraceRow[] {
  if (model.header.groupMode === 'flat') return model.rows;
  return [...model.rows].sort((left, right) => {
    const groupLeft = model.header.groupMode === 'branch' ? left.shortBranch : left.tool;
    const groupRight = model.header.groupMode === 'branch' ? right.shortBranch : right.tool;
    return groupLeft.localeCompare(groupRight) || left.rownum - right.rownum;
  });
}

function fit(value: string, width: number): string {
  if (width <= 0) return '';
  const text = stripAnsi(value).replace(/\n/g, ' ');
  if (text.length > width) return `${text.slice(0, Math.max(0, width - 1))}…`;
  return text.padEnd(width);
}

function compact(value: string, width: number): string {
  return fit(value, width).trimEnd();
}

function put(lines: string[], y: number, x: number, text: string, width: number): void {
  if (y < 0 || y >= lines.length || width <= 0) return;
  const current = lines[y].padEnd(x + width);
  const visible = fit(text, width);
  lines[y] = current.slice(0, x) + visible + current.slice(x + width);
}

function divider(lines: string[], y: number, x: number, width: number): void {
  put(lines, y, x, '─'.repeat(Math.max(0, width)), width);
}

function renderSidebar(model: TraceHomeModel, lines: string[], left: number, top: number, bottom: number, width: number): void {
  let y = top;
  put(lines, y++, left, 'SUMMARY', width);
  put(lines, y++, left, `rows ${model.summary.rows.toLocaleString('en-US')}`, width);
  put(lines, y++, left, `errors ${model.summary.errors}`, width);
  put(lines, y++, left, `running ${model.summary.running}`, width);
  put(lines, y++, left, `branches ${model.summary.branches}`, width);
  put(lines, y++, left, `since ${model.summary.since}`, width);
  divider(lines, y++, left, width);
  put(lines, y++, left, 'TOP TOOLS (TOKENS)', width);
  for (const tool of model.topTools.slice(0, Math.max(0, bottom - y - 6))) {
    put(lines, y++, left, `${tool.tool.padEnd(16)} ${formatTokens(tool.tokens)}`, width);
  }
  divider(lines, y++, left, width);
  put(lines, y++, left, 'RAW SHELL (TASK.CALL)', width);
  put(lines, y++, left, `total ${model.rawShell.total}`, width);
  put(lines, y++, left, `good ${model.rawShell.good}`, width);
  put(lines, y++, left, `suspect ${model.rawShell.suspect}`, width);
  put(lines, y++, left, `bad ${model.rawShell.bad}`, width);
}

function renderTable(model: TraceHomeModel, lines: string[], left: number, top: number, bottom: number, width: number): void {
  put(lines, top, left, 'TIME      STATUS  TOOL             DUR      TOKENS    BRANCH / TASK                           MESSAGE / COMMAND', width);
  divider(lines, top + 1, left, width);
  let y = top + 2;
  let previousGroup = '';
  const rows = visibleRowsFor(model);
  const selectedTraceId = model.selected?.traceId;
  const maxRows = Math.max(0, bottom - y + 1);
  const selectedIndex = Math.max(0, rows.findIndex((row) => row.traceId === selectedTraceId));
  const start = Math.max(0, Math.min(rows.length - maxRows, selectedIndex - Math.floor(maxRows / 2)));
  for (const row of rows.slice(start, start + maxRows)) {
    const group = model.header.groupMode === 'branch' ? row.shortBranch : model.header.groupMode === 'tool' ? row.tool : '';
    if (group && group !== previousGroup && y <= bottom) {
      put(lines, y++, left, `▸ ${group}`, width);
      previousGroup = group;
    }
    if (y > bottom) break;
    const selected = row.traceId === selectedTraceId ? '›' : ' ';
    const status = row.ok ? '✓' : '✕';
    const message = compact(row.message, Math.max(18, width - 86));
    put(
      lines,
      y++,
      left,
      `${selected} ${fit(row.time, 8)} ${fit(status, 6)} ${fit(row.tool, 14)} ${fit(formatDuration(row.durationMs), 8)} ${fit(formatTokens(row.totalTokens), 8)} ${fit(row.shortBranch, 38)} ${message}`,
      width,
    );
    for (const child of row.children.slice(0, 3)) {
      if (y > bottom) break;
      put(
        lines,
        y++,
        left,
        `    ${fit(row.time, 8)} ${fit('├─ ' + (child.ok ? '✓' : '✕'), 6)} ${fit(child.tool, 14)} ${fit(formatDuration(child.durationMs), 8)} ${fit(formatTokens(child.totalTokens), 8)} ${fit(row.shortBranch, 38)} ${compact(child.detail, Math.max(18, width - 90))}`,
        width,
      );
    }
  }
}

function renderInspect(model: TraceHomeModel, lines: string[], left: number, top: number, bottom: number, width: number): void {
  put(lines, top, left, 'trace:inspect', width);
  divider(lines, top + 1, left, width);
  if (!model.selected) return;
  const selected = model.selected;
  const data = [
    `STATUS ${selected.status}`,
    `DURATION ${selected.duration}`,
    `TOKENS ${selected.tokens}`,
    `BRANCH / TASK ${selected.branch}`,
    `TIMING ${selected.timing}`,
    `COMMAND QUALITY ${selected.commandQuality?.quality || 'none'}`,
    `REASON ${selected.commandQuality?.reason || 'unavailable'}`,
    `REPLACEMENT ${selected.commandQuality?.replacement || 'none'}`,
    selected.tabs.join(' | '),
    `COMMAND ${selected.command || 'none'}`,
    selected.stderr ? `STDERR ${selected.stderr}` : `STDOUT ${selected.stdout || 'empty'}`,
  ];
  let y = top + 2;
  for (const text of data) {
    if (y > bottom) break;
    put(lines, y++, left, text, width);
  }
}

function renderTree(model: TraceHomeModel, lines: string[], left: number, top: number, bottom: number, width: number): void {
  put(lines, top, left, 'trace:tree', width);
  divider(lines, top + 1, left, width);
  let y = top + 2;
  for (const text of model.tree.lines) {
    if (y > bottom) break;
    put(lines, y++, left, text, width);
  }
}

function renderJson(model: TraceHomeModel, lines: string[], left: number, top: number, bottom: number, width: number): void {
  put(lines, top, left, 'trace:json', width);
  divider(lines, top + 1, left, width);
  let y = top + 2;
  for (const text of model.rawJson.split('\n')) {
    if (y > bottom) break;
    put(lines, y++, left, text, width);
  }
}

function renderHelpOverlay(lines: string[], width: number, height: number): void {
  const boxWidth = Math.min(80, Math.max(50, width - 8));
  const x = Math.max(0, Math.floor((width - boxWidth) / 2));
  const y = Math.max(1, Math.floor(height / 2) - 7);
  const help = [
    '╭' + '─'.repeat(boxWidth - 2) + '╮',
    '│ trace:home help'.padEnd(boxWidth - 1) + '│',
    '│ enter: open inspect pane'.padEnd(boxWidth - 1) + '│',
    '│ space: pause live updates'.padEnd(boxWidth - 1) + '│',
    '│ /: search   f: failed   b: branch prompt   t: tool prompt'.padEnd(boxWidth - 1) + '│',
    '│ g: group mode   r: refresh   c: copy selected id'.padEnd(boxWidth - 1) + '│',
    '│ arrows/j/k: move selection'.padEnd(boxWidth - 1) + '│',
    '│ esc: close overlay/back   q: quit'.padEnd(boxWidth - 1) + '│',
    '╰' + '─'.repeat(boxWidth - 2) + '╯',
  ];
  for (let index = 0; index < help.length; index += 1) put(lines, y + index, x, help[index], boxWidth);
}

export function renderTraceHome(model: TraceHomeModel, options: TraceHomeRenderOptions = {}): string {
  const width = Math.max(80, options.width || process.stdout.columns || 151);
  const height = Math.max(24, options.height || process.stdout.rows || 44);
  const lines = Array.from({ length: height }, () => ''.padEnd(width));
  const sidebarWidth = width >= 112 ? Math.min(30, Math.max(24, Math.floor(width * 0.2))) : 0;
  const sidebarLeft = sidebarWidth ? width - sidebarWidth - 1 : width;
  const tableWidth = sidebarWidth ? sidebarLeft - 1 : width;
  const bottomHeight = Math.max(10, Math.min(16, Math.floor(height * 0.34)));
  const bottomTop = height - bottomHeight;
  const keybarY = Math.max(5, bottomTop - 1);
  const tableBottom = Math.max(4, keybarY - 1);

  put(lines, 0, 0, `trace:home   ${model.header.live ? 'LIVE ●' : 'PAUSED'}   since ${model.header.since}   rows ${model.header.rows.toLocaleString('en-US')}   errors ${model.header.errors}   running ${model.header.running}   branches ${model.header.branches}   group ${model.header.groupMode}   filter: ${model.header.filter}   ||   ?`, width);
  divider(lines, 1, 0, width);
  renderTable(model, lines, 2, 2, tableBottom, Math.max(0, tableWidth - 2));
  if (sidebarWidth) renderSidebar(model, lines, sidebarLeft + 1, 2, tableBottom, sidebarWidth - 2);

  put(lines, keybarY, 0, 'enter: open   space: pause live   /: search   f: failed   b: filter branch   t: filter tool   g: group   r: refresh   c: copy id   ?: help   q: quit', width);
  divider(lines, keybarY + 1, 0, width);

  const gap = 2;
  const paneWidth = Math.floor((width - gap * 2) / 3);
  const inspectWidth = paneWidth;
  const treeWidth = paneWidth;
  const jsonWidth = width - inspectWidth - treeWidth - gap * 2;
  const paneTop = Math.min(height - 2, keybarY + 2);
  const paneBottom = height - 1;
  renderInspect(model, lines, 0, paneTop, paneBottom, inspectWidth);
  renderTree(model, lines, inspectWidth + gap, paneTop, paneBottom, treeWidth);
  renderJson(model, lines, inspectWidth + treeWidth + gap * 2, paneTop, paneBottom, jsonWidth);

  if (model.statusLine) put(lines, height - 1, 0, model.statusLine, width);
  if (model.statusLine?.startsWith('HELP')) renderHelpOverlay(lines, width, height);

  return lines.map((lineText) => fit(lineText, width).trimEnd()).join('\n');
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

function writeFrame(frame: string): void {
  process.stdout.write(terminalSequences.frame + frame);
}

function selectableIds(model: TraceHomeModel): string[] {
  return model.rows.map((row) => row.traceId).filter(Boolean);
}

function moveSelection(ids: string[], selectedTraceId: string | undefined, delta: number): string | undefined {
  if (ids.length === 0) return selectedTraceId;
  const current = Math.max(0, ids.indexOf(selectedTraceId || ids[ids.length - 1]));
  const next = Math.max(0, Math.min(ids.length - 1, current + delta));
  return ids[next];
}

function buildOptions(state: LiveState, since: string): TraceHomeBuildOptions {
  return {
    selectedTraceId: state.selectedTraceId,
    sinceLabel: since,
    live: !state.paused,
    search: state.search,
    failedOnly: state.failedOnly,
    branchFilter: state.branchFilter,
    toolFilter: state.toolFilter,
    groupMode: state.groupMode,
    rawJson: state.rawJson,
    statusLine: state.inputMode ? `${state.inputMode}: ${state.inputBuffer}` : state.help ? 'HELP overlay — esc closes' : state.statusLine,
  };
}

function copyText(text: string): boolean {
  if (process.platform === 'darwin') {
    const copied = spawnSync('pbcopy', { input: text, encoding: 'utf8' });
    return copied.status === 0;
  }
  return false;
}

function cycleGroupMode(current: GroupMode): GroupMode {
  const index = groupModes.indexOf(current);
  return groupModes[(index + 1) % groupModes.length];
}

function cycleValue(values: string[], current: string | undefined): string | undefined {
  const distinct = [...new Set(values.filter(Boolean))].sort();
  if (distinct.length === 0) return undefined;
  if (!current) return distinct[0];
  const index = distinct.indexOf(current);
  if (index < 0 || index === distinct.length - 1) return undefined;
  return distinct[index + 1];
}

function handleInput(buffer: Buffer, state: LiveState, currentModel: TraceHomeModel | undefined): void {
  const key = buffer.toString('utf8');
  if (state.inputMode) {
    if (key === '\u0003') state.shouldQuit = true;
    else if (key === '\u001b') {
      state.inputMode = undefined;
      state.inputBuffer = '';
      state.statusLine = '';
    } else if (key === '\r' || key === '\n') {
      if (state.inputMode === 'search') state.search = state.inputBuffer;
      if (state.inputMode === 'branch') state.branchFilter = state.inputBuffer || undefined;
      if (state.inputMode === 'tool') state.toolFilter = state.inputBuffer || undefined;
      state.inputMode = undefined;
      state.inputBuffer = '';
      state.statusLine = 'filter updated';
    } else if (key === '\u007f') {
      state.inputBuffer = state.inputBuffer.slice(0, -1);
    } else if (/^[\x20-\x7e]+$/.test(key)) {
      state.inputBuffer += key;
    }
    return;
  }

  if (key === 'q' || key === '\u0003') state.shouldQuit = true;
  else if (key === ' ') state.paused = !state.paused;
  else if (key === '\u001b[A' || key === 'k') state.selectedTraceId = moveSelection(selectableIds(currentModel || emptyModel()), state.selectedTraceId, -1);
  else if (key === '\u001b[B' || key === 'j') state.selectedTraceId = moveSelection(selectableIds(currentModel || emptyModel()), state.selectedTraceId, 1);
  else if (key === '\r' || key === '\n') {
    state.activePane = 'inspect';
    state.statusLine = 'opened inspect pane';
  } else if (key === '/') {
    state.inputMode = 'search';
    state.inputBuffer = state.search;
  } else if (key === 'f') {
    state.failedOnly = !state.failedOnly;
  } else if (key === 'b') {
    if (currentModel) state.branchFilter = cycleValue(currentModel.rows.map((row) => row.branch), state.branchFilter);
  } else if (key === 't') {
    if (currentModel) state.toolFilter = cycleValue(currentModel.rows.map((row) => row.tool), state.toolFilter);
  } else if (key === 'g') {
    state.groupMode = cycleGroupMode(state.groupMode);
  } else if (key === 'r') {
    state.statusLine = 'refreshed';
  } else if (key === 'c') {
    const selected = currentModel?.rows.find((row) => row.traceId === currentModel.selected?.traceId);
    const copied = selected ? copyText(selected.traceId || selected.command) : false;
    state.statusLine = copied ? 'copied selected trace id' : 'copy unavailable; selected trace id ready in inspect';
  } else if (key === '?') {
    state.help = true;
    state.statusLine = 'HELP overlay — esc closes';
  } else if (key === '\u001b') {
    state.help = false;
    state.activePane = 'table';
    state.statusLine = '';
  }
}

function emptyModel(): TraceHomeModel {
  return buildTraceHomeModel([], { live: false });
}

function sinceLabel(startedAt: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
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

  const interactive = !args.once && Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
  const startedAt = new Date();
  const state: LiveState = {
    paused: false,
    shouldQuit: false,
    selectedTraceId: args.selectedTraceId,
    search: args.search,
    failedOnly: args.failedOnly,
    branchFilter: args.branchFilter,
    toolFilter: args.toolFilter,
    groupMode: 'flat',
    help: false,
    activePane: 'table',
    inputBuffer: '',
    statusLine: interactive ? '' : 'non-tty: rendered one frame',
    rawJson: args.rawJson,
  };

  if (!interactive) {
    const rows = loadRows(db, args.limit);
    const options = buildOptions(state, args.once ? 'once' : sinceLabel(startedAt));
    options.live = false;
    const model = buildTraceHomeModel(rows, options);
    process.stdout.write(renderTraceHome(model, { color: args.color }) + '\n');
    return;
  }

  process.stdout.write(terminalSequences.enter);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  let currentRows = loadRows(db, args.limit);
  let currentModel: TraceHomeModel | undefined;
  let renderPending = true;
  const requestRender = () => { renderPending = true; };
  const onData = (buffer: Buffer) => {
    handleInput(buffer, state, currentModel);
    requestRender();
  };
  process.stdin.on('data', onData);

  const interval = setInterval(() => {
    if (!state.paused) {
      currentRows = loadRows(db, args.limit);
      requestRender();
    }
  }, args.interval);

  try {
    while (!state.shouldQuit) {
      if (renderPending) {
        currentModel = buildTraceHomeModel(currentRows, buildOptions(state, sinceLabel(startedAt)));
        if (!state.selectedTraceId && currentModel.selected) state.selectedTraceId = currentModel.selected.traceId;
        writeFrame(renderTraceHome(currentModel, { color: args.color }));
        renderPending = false;
      }
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
  } finally {
    clearInterval(interval);
    process.stdin.off('data', onData);
    process.stdin.setRawMode(false);
    process.stdout.write(terminalSequences.exit);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    process.stdout.write(terminalSequences.exit);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

