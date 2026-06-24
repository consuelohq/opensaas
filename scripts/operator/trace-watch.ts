#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

type Row = Record<string, unknown>;
export type Args = {
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
  nestedLimit?: number;
  limit: number;
  interval: number;
  since?: string;
};

export type NestedOperation = {
  tool: string;
  helper?: string;
  ok: boolean;
  code?: string;
  message?: string;
  traceId?: string;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  detail?: string;
  changed?: boolean;
};
type CodeCallLanguage = 'python' | 'bun' | 'bash' | 'unknown';
type CodeCallMode = 'read' | 'edit' | 'verify' | 'unknown';
type CodeCallSourceKind = 'inline' | 'codeFile' | 'unknown';
type CodeCallOutputShape = 'json' | 'json-lines' | 'text' | 'empty';
type CodeCallIntent =
  | 'focused-test'
  | 'multi-command-verification'
  | 'package-script-orchestration'
  | 'codegen'
  | 'structured-repo-inspection'
  | 'structured-repo-edit'
  | 'exact-cli-reproduction'
  | 'syntax-or-typecheck'
  | 'small-diagnostic'
  | 'shell-specific'
  | 'unknown';

export type CodeCallTraceSummary = {
  language: CodeCallLanguage;
  mode: CodeCallMode;
  sourceKind: CodeCallSourceKind;
  sourceLines: number;
  sourceChars: number;
  stdoutShape: CodeCallOutputShape;
  stderrShape: 'text' | 'empty';
  changedCount: number;
  truncated: boolean;
  intent: CodeCallIntent;
  quality: 'good' | 'suspect' | 'bad';
  reason: string;
  replacement?: string;
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
  --nested-limit <n>     Max nested child operations to show. Default: all.
  --no-color             Disable colors.
  --help                 Show help.

Examples:
  bun run trace:watch
  bun run trace:watch --limit 20
  bun run trace:watch --branch task/workspace-agents/fix-database
  bun run trace:watch --errors --since 1h
`;

function parseArgs(argv: string[]): Args {
  const args: Args = { errors: false, json: false, rawJson: false, color: process.stdout.isTTY, once: false, help: false, nested: true, limit: 0, interval: 1000 };
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
  if (args.nestedLimit !== undefined && (!Number.isFinite(args.nestedLimit) || args.nestedLimit < 0)) args.nestedLimit = undefined;
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
  CASE WHEN tool = 'code.call' THEN json_extract(result_json, '$.data.language') ELSE NULL END AS code_call_language,
  CASE WHEN tool = 'code.call' THEN json_extract(result_json, '$.data.mode') ELSE NULL END AS code_call_mode,
  CASE WHEN tool = 'code.call' THEN substr(coalesce(json_extract(result_json, '$.data.stdout'), ''), 1, 12000) ELSE NULL END AS code_call_stdout,
  CASE
    WHEN tool = 'code.call' AND json_valid(json_extract(result_json, '$.data.stdout')) THEN (
      SELECT json_group_array(json_object(
        'command', CASE
          WHEN json_type(step.value, '$.command') = 'array' THEN (
            SELECT group_concat(command_part.value, ' ')
            FROM json_each(step.value, '$.command') AS command_part
          )
          ELSE json_extract(step.value, '$.command')
        END,
        'ok', json_extract(step.value, '$.ok'),
        'exitCode', coalesce(json_extract(step.value, '$.exitCode'), json_extract(step.value, '$.exit_code')),
        'durationMs', coalesce(json_extract(step.value, '$.durationMs'), json_extract(step.value, '$.duration_ms')),
        'code', json_extract(step.value, '$.code'),
        'message', json_extract(step.value, '$.message'),
        'detail', json_extract(step.value, '$.detail'),
        'changed', json_extract(step.value, '$.changed'),
        'stdoutChars', length(coalesce(json_extract(step.value, '$.stdout'), '')),
        'stderrChars', length(coalesce(json_extract(step.value, '$.stderr'), ''))
      ))
      FROM json_each(
        CASE
          WHEN json_type(json_extract(result_json, '$.data.stdout')) = 'array' THEN json_extract(result_json, '$.data.stdout')
          ELSE coalesce(json_extract(json_extract(result_json, '$.data.stdout'), '$.results'), '[]')
        END
      ) AS step
    )
    ELSE NULL
  END AS code_call_results_json,
  CASE WHEN tool = 'code.call' THEN substr(coalesce(json_extract(result_json, '$.data.stderr'), ''), 1, 4000) ELSE NULL END AS code_call_stderr,
  CASE WHEN tool = 'code.call' THEN json_array_length(json_extract(result_json, '$.data.filesChanged')) ELSE NULL END AS code_call_files_changed_count,
  CASE WHEN tool = 'code.call' THEN json_extract(result_json, '$.data.truncated') ELSE NULL END AS code_call_truncated,
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
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function traceTimeParts(date: Date): Record<string, string> {
  return Object.fromEntries(traceTimeFormatter.formatToParts(date).map((part) => [part.type, part.value])) as Record<string, string>;
}

function fmtTraceTime(value: unknown): string {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '---- -- -- --:--:--';
  const parts = traceTimeParts(date);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}:${parts.second}`;
}

function fmtDuration(ms: unknown): string {
  const n = Number(ms || 0);
  if (!Number.isFinite(n)) return '0.00s';
  return `${(n / 1000).toFixed(2)}s`;
}

function fmtTokenCount(value: unknown): string {
  const total = Number(value || 0);
  if (!Number.isFinite(total) || total <= 0) return '0 tokens';
  if (total >= 1000) return `${(total / 1000).toFixed(1)}k tokens`;
  return `${total} tokens`;
}

function operationTokenTotal(operation: NestedOperation): number | undefined {
  const explicitTotal = optionalNumber(operation.totalTokens);
  const input = optionalNumber(operation.inputTokens);
  const output = optionalNumber(operation.outputTokens);
  if (explicitTotal !== undefined && explicitTotal > 0) return explicitTotal;
  if (input !== undefined || output !== undefined) return (input || 0) + (output || 0);
  if (explicitTotal !== undefined) return explicitTotal;
  return undefined;
}

function fmtTokens(row: Row, nested?: NestedOperation[]): string {
  const nestedTotal = nested?.reduce((sum, operation) => sum + (operationTokenTotal(operation) || 0), 0) || 0;
  return fmtTokenCount(nestedTotal > 0 ? nestedTotal : row.total_tokens);
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

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function dataRecordFromResult(result: unknown): Record<string, unknown> {
  if (!isRecord(result)) return {};
  return isRecord(result.data) ? result.data : result;
}

function codeCallInput(row: Row): Record<string, unknown> {
  const resolved = parseJson(row.resolved_input_json);
  if (isRecord(resolved)) return resolved;
  const input = parseJson(row.input_json);
  return isRecord(input) ? input : {};
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function codeCallData(row: Row): Record<string, unknown> {
  const data = dataRecordFromResult(parseJson(row.result_json));
  return {
    ...data,
    language: data.language ?? row.code_call_language,
    mode: data.mode ?? row.code_call_mode,
    stdout: data.stdout ?? row.code_call_stdout,
    stderr: data.stderr ?? row.code_call_stderr,
    filesChangedCount: data.filesChangedCount ?? row.code_call_files_changed_count,
    truncated: data.truncated ?? row.code_call_truncated,
  };
}

function normalizeCodeCallLanguage(value: unknown): CodeCallLanguage {
  const language = cleanText(value).toLowerCase();
  if (['python', 'py', 'python3'].includes(language)) return 'python';
  if (['bun', 'node', 'javascript', 'typescript', 'js', 'ts'].includes(language)) return 'bun';
  if (['bash', 'shell', 'sh', 'zsh'].includes(language)) return 'bash';
  return 'unknown';
}

function normalizeCodeCallMode(value: unknown): CodeCallMode {
  const mode = cleanText(value).toLowerCase();
  if (mode === 'read' || mode === 'edit' || mode === 'verify') return mode;
  return 'unknown';
}

function codeCallSource(input: Record<string, unknown>): { kind: CodeCallSourceKind; text: string } {
  const inlineCode = stringValue(input.code);
  if (inlineCode) return { kind: 'inline', text: inlineCode };
  const codeFile = stringValue(input.codeFile);
  if (codeFile) return { kind: 'codeFile', text: codeFile };
  return { kind: 'unknown', text: '' };
}

function parseStdoutPayload(stdout: unknown): unknown {
  const stdoutText = stringValue(stdout).trim();
  if (!stdoutText) return null;
  return parseJson(stdoutText);
}

function outputShape(value: unknown): CodeCallOutputShape {
  const text = stringValue(value).trim();
  if (!text) return 'empty';
  if (parseJson(text) !== null) return 'json';
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1 && lines.every((line) => parseJson(line) !== null)) return 'json-lines';
  return 'text';
}

function codeCallResults(row: Row): unknown[] {
  const compactResults = parseJson(row.code_call_results_json);
  if (Array.isArray(compactResults)) return compactResults;
  const data = codeCallData(row);
  const payload = parseStdoutPayload(data.stdout);
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.results)) return payload.results;
  return [];
}

function commandTextFromCodeCallResult(result: unknown): string {
  if (!isRecord(result)) return '';
  if (Array.isArray(result.command)) return result.command.map(String).join(' ');
  const command = cleanText(result.command);
  if (command) return command;
  return cleanText(result.detail || result.message || result.tool);
}

function isTestCommand(command: string): boolean {
  return /(^|\s)(test|vitest|jest)(\s|$)/.test(command) || /\bbun\s+(?:--cwd\s+\S+\s+)?test\b/.test(command);
}

function codeCallResultCode(result: Record<string, unknown>, ok: boolean, exitCode: number, command: string): string {
  if (ok) return cleanText(result.code || 'OK') || 'OK';
  if (isTestCommand(command)) return 'TESTS_FAILED';
  return cleanText(result.code || 'EXIT_' + exitCode) || 'ERR';
}

function codeCallFailureCode(row: Row): string | undefined {
  for (const result of codeCallResults(row)) {
    if (!isRecord(result)) continue;
    const exitCode = numericValue(result.exitCode ?? result.exit_code, 0);
    const ok = result.ok === true || (result.ok !== false && exitCode === 0);
    if (ok) continue;
    const command = commandTextFromCodeCallResult(result);
    if (isTestCommand(command)) return 'TESTS_FAILED';
  }
  return undefined;
}

function codeCallChangedCount(data: Record<string, unknown>): number {
  const extractedCount = numericValue(data.filesChangedCount, -1);
  if (extractedCount >= 0) return extractedCount;
  if (Array.isArray(data.filesChanged)) return data.filesChanged.length;
  if (Array.isArray(data.changedFiles)) return data.changedFiles.length;
  if (Array.isArray(data.changed)) return data.changed.length;
  return data.changed === true ? 1 : 0;
}

function classifyCodeCallIntent(language: CodeCallLanguage, mode: CodeCallMode, sourceText: string, commandTexts: string[]): CodeCallIntent {
  const combined = cleanText([sourceText, ...commandTexts].join(' ')).toLowerCase();
  if (/generate-tool-manifest|generate-types|generate-docs|codegen/.test(combined)) return 'codegen';
  if (/tsc|typecheck|check-files|syntax/.test(combined)) return 'syntax-or-typecheck';
  if (language === 'bash' && /^(bun|python|python3|node)\b/.test(combined)) return 'package-script-orchestration';
  if (mode === 'verify' && commandTexts.length > 1) return 'multi-command-verification';
  if (mode === 'verify' && /\b(test|vitest|jest|lint|build)\b/.test(combined)) return 'focused-test';
  if (mode === 'edit') return 'structured-repo-edit';
  if (mode === 'read' && /bun\.file|git show|readfile|read_text|lineSpans|snippets/.test(combined)) return 'structured-repo-inspection';
  if (/--help|repro|smoke|argv|exitcode/.test(combined)) return 'exact-cli-reproduction';
  if (language === 'bash') return 'shell-specific';
  if (mode === 'read') return 'small-diagnostic';
  return 'unknown';
}

function isBashTransportOnly(sourceText: string): 'bun' | 'python' | 'node' | undefined {
  const body = sourceText.trim();
  const firstWord = body.match(/^([a-zA-Z0-9_-]+)/)?.[1];
  if (!firstWord) return undefined;
  if (!['bun', 'python', 'python3', 'node'].includes(firstWord)) return undefined;
  if (/[|<>;&]/.test(body) || /\bset\s+-[a-z]/.test(body)) return undefined;
  if (firstWord === 'python3') return 'python';
  return firstWord as 'bun' | 'python' | 'node';
}

function classifyCodeCallQuality(language: CodeCallLanguage, sourceText: string, stdoutShape: CodeCallOutputShape, results: unknown[]): Pick<CodeCallTraceSummary, 'quality' | 'reason' | 'replacement'> {
  if (language === 'bash') {
    const transport = isBashTransportOnly(sourceText);
    if (transport) {
      const runtime = transport === 'node' ? 'bun' : transport;
      const helper = runtime === 'bun' ? 'Bun.spawnSync(...)' : 'a Python script';
      const runtimeName = transport === 'bun' ? 'Bun' : transport === 'python' ? 'Python' : 'Node';
      return {
        quality: 'suspect',
        reason: 'Bash used only to invoke ' + runtimeName + '.',
        replacement: 'use language="' + runtime + '" and ' + helper,
      };
    }
    return { quality: 'good', reason: 'Bash is used for shell-specific execution.' };
  }
  if (results.length > 1 && stdoutShape !== 'json') {
    return { quality: 'suspect', reason: 'Multi-step code.call output should be a compact JSON packet.' };
  }
  return { quality: 'good', reason: 'code.call uses a native runtime with compact evidence.' };
}

export function summarizeCodeCallForTraceWatch(row: Row): CodeCallTraceSummary {
  const input = codeCallInput(row);
  const data = codeCallData(row);
  const language = normalizeCodeCallLanguage(data.language || input.language || input.requestedLanguage);
  const mode = normalizeCodeCallMode(data.mode || input.mode);
  const source = codeCallSource(input);
  const sourceLines = source.text ? source.text.split('\n').length : 0;
  const results = codeCallResults(row);
  const commandTexts = results.map(commandTextFromCodeCallResult).filter(Boolean);
  const stdoutShape = results.length > 0 ? 'json' : outputShape(data.stdout);
  const intent = classifyCodeCallIntent(language, mode, source.text, commandTexts);
  const quality = classifyCodeCallQuality(language, source.text, stdoutShape, results);
  return {
    language,
    mode,
    sourceKind: source.kind,
    sourceLines,
    sourceChars: source.text.length,
    stdoutShape,
    stderrShape: stringValue(data.stderr).trim() ? 'text' : 'empty',
    changedCount: codeCallChangedCount(data),
    truncated: booleanValue(data.truncated),
    intent,
    ...quality,
  };
}

function codeCallDetail(row: Row): string {
  const summary = summarizeCodeCallForTraceWatch(row);
  const parts = [
    summary.language + '/' + summary.mode,
    summary.intent,
    summary.quality,
    'changed ' + summary.changedCount,
    summary.truncated ? 'truncated' : '',
    summary.quality !== 'good' ? summary.reason : '',
    summary.replacement || '',
  ].filter(Boolean);
  return parts.join(' · ').slice(0, 180);
}

function codeCallOperations(row: Row): NestedOperation[] {
  return codeCallResults(row)
    .map((result) => {
      if (!isRecord(result)) return null;
      const exitCode = numericValue(result.exitCode ?? result.exit_code, 0);
      const ok = result.ok === true || (result.ok !== false && exitCode === 0);
      const command = commandTextFromCodeCallResult(result);
      return {
        tool: 'code.call cmd',
        ok,
        code: codeCallResultCode(result, ok, exitCode, command),
        message: cleanText(result.message),
        durationMs: numericValue(result.durationMs ?? result.duration_ms, 0),
        inputTokens: optionalNumber(result.inputTokens ?? result.input_tokens),
        outputTokens: optionalNumber(result.outputTokens ?? result.output_tokens),
        totalTokens: optionalNumber(result.totalTokens ?? result.total_tokens),
        detail: command || cleanText(result.detail || result.message),
        changed: result.changed === true,
      } satisfies NestedOperation;
    })
    .filter((operation): operation is NestedOperation => operation !== null);
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
    result: summarizeResultForTrace(result, String(row.tool || '')),
    code_call: String(row.tool || '') === 'code.call' ? summarizeCodeCallForTraceWatch(row) : undefined,
    nested_operations: nestedOperationsForRow(row),
    result_json_chars: numericValue(row.result_json_chars, textSize(row.result_json)),
    stderr: compactJsonValue(stderr, 1200),
    stderr_chars: numericValue(row.stderr_chars, textSize(row.stderr)),
  };
}

function summarizeResultForTrace(result: unknown, tool?: string): unknown {
  if (!isRecord(result)) return result;
  const data = isRecord(result.data) ? result.data : result;
  const schema = data.schema || result.schema;
  if (tool === 'code.call' && isRecord(data)) {
    return {
      ok: result.ok,
      code: result.code,
      message: result.message,
      language: data.language,
      mode: data.mode,
      runtime: data.runtime,
      exitCode: data.exitCode,
      stdoutShape: outputShape(data.stdout),
      stderrShape: stringValue(data.stderr).trim() ? 'text' : 'empty',
      changedCount: codeCallChangedCount(data),
      truncated: booleanValue(data.truncated),
    };
  }
  if (tool === 'verify' && isRecord(data)) {
    return {
      ok: result.ok,
      code: result.code,
      message: result.message,
      mode: data.mode,
      publishValid: data.publishValid,
      passed: data.passed,
      because: data.because,
      review: isRecord(data.review) ? { skipped: data.review.skipped, passed: data.review.passed } : undefined,
      db: isRecord(data.db) ? { skipped: data.db.skipped, passed: data.db.passed, warnOnly: data.db.warnOnly } : undefined,
      stamp: data.stamp,
    };
  }
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

export function compactSuccessDetail(row: Row): string {
  if (String(row.tool || '') === 'code.call') return codeCallDetail(row);
  const input = parseJson(row.resolved_input_json) || parseJson(row.input_json) || {};
  const result = parseJson(row.result_json) || {};
  const candidates: string[] = [];
  if (result.message) candidates.push(cleanText(result.message));
  if (input.facadeTool) candidates.push(`facade=${cleanText(input.facadeTool)}`);
  if (input.command) candidates.push(cleanText(input.command));
  if (input.path) candidates.push(cleanText(input.path));
  if (input.pattern) candidates.push(`pattern=${cleanText(input.pattern)}`);
  if (input.query) candidates.push(`query=${cleanText(input.query)}`);
  if (input.keyword) candidates.push(`keyword=${cleanText(input.keyword)}`);
  const detail = candidates.find((candidate) => candidate && !isJsonEnvelope(candidate));
  return (detail || '').slice(0, 120);
}


function verifyBecauseLines(row: Row): string[] {
  const result = parseJson(row.result_json);
  if (!isRecord(result)) return [];
  const data = isRecord(result.data) ? result.data : result;
  const because = isRecord(data.because) ? data.because : undefined;
  const lines = Array.isArray(because?.lines) ? because.lines : [];
  return lines.map((line) => cleanText(line)).filter(Boolean);
}

function renderVerifyBecause(args: Args, row: Row): void {
  if (String(row.tool || '') !== 'verify') return;
  const lines = verifyBecauseLines(row);
  if (lines.length === 0) return;
  console.log(`  ${c(args, '2', 'because:')}`);
  for (const line of lines) {
    console.log(`    ${c(args, '2', '-')} ${line}`);
  }
}

function compactErrorDetail(row: Row): string {
  if (String(row.tool || '') === 'code.call' && codeCallFailureCode(row) === 'TESTS_FAILED') return 'tests failed';
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

function jsonString(value: unknown): string {
  try { return JSON.stringify(value ?? {}); } catch { return '{}'; }
}

function codeCallRowFromResult(result: Record<string, unknown>, input: unknown): Row {
  const data = dataRecordFromResult(result);
  const ok = result.ok === true || (result.code === 'OK' && result.ok !== false);
  return {
    tool: 'code.call',
    status: ok ? 'ok' : 'error',
    code: cleanText(result.code || (ok ? 'OK' : 'ERR')),
    exit_code: numericValue(result.exitCode ?? result.exit_code ?? data.exitCode ?? data.exit_code, ok ? 0 : 1),
    duration_ms: numericValue(result.durationMs ?? result.duration_ms ?? data.durationMs ?? data.duration_ms, 0),
    input_tokens: optionalNumber(result.inputTokens ?? result.input_tokens),
    output_tokens: optionalNumber(result.outputTokens ?? result.output_tokens),
    total_tokens: optionalNumber(result.totalTokens ?? result.total_tokens),
    input_json: jsonString(input),
    resolved_input_json: jsonString(input),
    result_json: jsonString(result),
    stderr: cleanText(result.stderr || data.stderr),
  };
}

function codeCallNestedOperationFromResult(result: Record<string, unknown>, input: unknown): NestedOperation {
  const row = codeCallRowFromResult(result, input);
  const ok = String(row.status || '') === 'ok' && String(row.code || '') === 'OK' && Number(row.exit_code || 0) === 0;
  const failureCode = codeCallFailureCode(row);
  const summaryDetail = codeCallDetail(row);
  return {
    tool: 'code.call',
    helper: cleanText(result.helper),
    ok,
    code: failureCode || cleanText(result.code || (ok ? 'OK' : 'ERR')),
    message: cleanText(result.message),
    traceId: cleanText(result.traceId),
    durationMs: numericValue(result.durationMs ?? result.duration_ms, 0),
    inputTokens: optionalNumber(result.inputTokens ?? result.input_tokens),
    outputTokens: optionalNumber(result.outputTokens ?? result.output_tokens),
    totalTokens: optionalNumber(result.totalTokens ?? result.total_tokens),
    detail: failureCode === 'TESTS_FAILED' ? ['tests failed', summaryDetail].filter(Boolean).join(' · ') : summaryDetail || cleanText(result.detail || result.message),
    changed: false,
  };
}

function nestedOperationFromResult(result: unknown, toolFallback: string, input?: unknown): NestedOperation | null {
  if (!isRecord(result)) return null;
  const tool = cleanText(result.tool || toolFallback || 'unknown') || 'unknown';
  if (tool === 'code.call') return codeCallNestedOperationFromResult(result, input || {});
  const ok = result.ok === true || (result.code === 'OK' && result.ok !== false);
  return {
    tool,
    helper: cleanText(result.helper),
    ok,
    code: cleanText(result.code || (ok ? 'OK' : 'ERR')),
    message: cleanText(result.message),
    traceId: cleanText(result.traceId),
    durationMs: numericValue(result.durationMs, 0),
    inputTokens: optionalNumber(result.inputTokens ?? result.input_tokens),
    outputTokens: optionalNumber(result.outputTokens ?? result.output_tokens),
    totalTokens: optionalNumber(result.totalTokens ?? result.total_tokens),
    detail: cleanText(result.detail),
    changed: result.changed === true,
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
  const steps = Array.isArray(input) ? input : isRecord(input) ? asArray(input.steps) : [];
  const extracted = parseJson(row.batch_results_json);
  const result = parseJson(row.result_json);
  const results = asArray(extracted ?? (isRecord(result) && isRecord(result.data) ? result.data.results : undefined) ?? (isRecord(result) && isRecord(result.data) && isRecord(result.data.data) ? result.data.data.results : undefined));
  return results
    .map((batchResult, index) => {
      const step = steps[index];
      const tool = isRecord(step) ? cleanText(step.tool) : 'unknown';
      const input = isRecord(step) ? step.input ?? step.args ?? {} : {};
      return nestedOperationFromResult(batchResult, tool || 'unknown', input);
    })
    .filter((operation): operation is NestedOperation => operation !== null);
}

export function nestedOperationsForRow(row: Row): NestedOperation[] {
  const tool = String(row.tool || '');
  if (tool === 'code.run') return codeRunOperations(row);
  if (tool === 'batch') return batchOperations(row);
  if (tool === 'code.call') return codeCallOperations(row);
  return [];
}

function renderNestedOperation(args: Args, operation: NestedOperation): string {
  const ok = operation.ok && (operation.code === 'OK' || !operation.code);
  const icon = ok ? c(args, '32', '✓') : c(args, '31', '✗');
  const tool = c(args, '36', operation.tool.padEnd(16).slice(0, 16));
  const code = ok ? c(args, '2', operation.code || 'OK') : c(args, '33', operation.code || 'ERR');
  const tokenTotal = operationTokenTotal(operation);
  const tokens = tokenTotal === undefined ? ''.padStart(10) : fmtTokenCount(tokenTotal).padStart(10);
  const marker = operation.changed ? c(args, '33', 'changed') : '';
  const detail = cleanText(operation.detail || operation.helper || operation.message || '').slice(0, 120);
  const suffixParts = [marker, detail ? c(args, '2', detail) : ''].filter(Boolean);
  const suffix = suffixParts.length ? ` ${c(args, '2', '|')} ${suffixParts.join(c(args, '2', ' | '))}` : '';
  return `${c(args, '2', '          ↳')} ${icon} ${tool} ${fmtDuration(operation.durationMs).padStart(7)} ${tokens} ${code}${suffix}`;
}

function renderNestedOverflow(args: Args, omitted: number): string {
  return `${c(args, '2', '          ↳')} ${c(args, '2', `… ${omitted} more nested operation${omitted === 1 ? '' : 's'}`)}`;
}

function enrichNestedOperationsWithTraceTokens(args: Args, operations: NestedOperation[]): NestedOperation[] {
  const traceIds = [...new Set(operations.map((operation) => operation.traceId).filter(Boolean))];
  if (!args.db || traceIds.length === 0) return operations;
  const quotedTraceIds = traceIds.map((traceId) => shellQuote(String(traceId))).join(', ');
  const result = runSql(
    args.db,
    `SELECT trace_id, input_tokens, output_tokens, total_tokens FROM tool_traces WHERE trace_id IN (${quotedTraceIds});`,
  );
  if (result.locked || result.rows.length === 0) return operations;
  const tokenStats = new Map(result.rows.map((row) => [String(row.trace_id), row]));
  return operations.map((operation) => {
    const row = operation.traceId ? tokenStats.get(operation.traceId) : undefined;
    if (!row) return operation;
    return {
      ...operation,
      inputTokens: optionalNumber(row.input_tokens) ?? operation.inputTokens,
      outputTokens: optionalNumber(row.output_tokens) ?? operation.outputTokens,
      totalTokens: optionalNumber(row.total_tokens) ?? operation.totalTokens,
    };
  });
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

export function renderRow(args: Args, row: Row) {
  if (args.json) {
    console.log(JSON.stringify(args.rawJson ? row : compactTraceRow(row)));
    return;
  }
  const ok = String(row.status || '') === 'ok' && String(row.code || '') === 'OK' && Number(row.exit_code || 0) === 0;
  const icon = ok ? c(args, '32', '✓') : c(args, '31', '✗');
  const tool = c(args, '36', String(row.tool || 'unknown').padEnd(16).slice(0, 16));
  const displayCode = ok ? String(row.code || 'OK') : (codeCallFailureCode(row) || String(row.code || row.status || 'ERR'));
  const code = ok ? c(args, '2', displayCode) : c(args, '33', displayCode);
  const nested = args.nested ? enrichNestedOperationsWithTraceTokens(args, nestedOperationsForRow(row)) : [];
  const time = fmtTraceTime(row.ts);
  const tokens = fmtTokens(row, nested).padStart(12);
  const branch = c(args, branchColor(row), shortBranch(row));
  const first = ok
    ? `${c(args, '2', time)}  ${icon} ${tool} ${fmtDuration(row.duration_ms).padStart(7)} ${tokens} ${code}  ${branch}`
    : `${c(args, '2', time)}  ${icon} ${tool} ${code} ${fmtDuration(row.duration_ms).padStart(7)} ${tokens}  ${branch}`;
  const detail = ok ? compactSuccessDetail(row) : compactErrorDetail(row);
  if (ok && detail) console.log(`${first} ${c(args, '2', '|')} ${c(args, '2', detail)}`);
  else console.log(first);
  if (!ok && detail) console.log(`  ${c(args, '2', detail)}`);
  renderVerifyBecause(args, row);
  if (args.nested) {
    const visibleNested = args.nestedLimit === undefined ? nested : nested.slice(0, args.nestedLimit);
    for (const operation of visibleNested) console.log(renderNestedOperation(args, operation));
    if (args.nestedLimit !== undefined && nested.length > args.nestedLimit) console.log(renderNestedOverflow(args, nested.length - args.nestedLimit));
  }
  console.log(divider(args));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function main() {
  let args: Args;
  try { args = parseArgs(Bun.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(2); }
  if (args.help) { console.log(usage); return; }
  const db = args.db || process.env.TRACE_DB || defaultTraceDb;
  args.db = db;
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

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

