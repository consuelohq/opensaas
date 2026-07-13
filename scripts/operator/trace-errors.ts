#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

type Row = Record<string, unknown>;

const defaultTraceDb = join(
  homedir(),
  'Library/Application Support/OpenWorkspace/traces/e8425497c3ee20bf0a28e9da/traces.db',
);

const traceDb =
  process.env.TRACE_DB ||
  Bun.argv.find((arg) => arg.startsWith('--db='))?.slice(5) ||
  defaultTraceDb;

if (!existsSync(traceDb)) {
  console.error(`trace db not found: ${traceDb}`);
  process.exit(1);
}

function sqlJson(sql: string): Row[] {
  const result = spawnSync('sqlite3', ['-json', traceDb, sql], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }

  const text = result.stdout.trim();
  return text ? (JSON.parse(text) as Row[]) : [];
}

const integerFormatter = new Intl.NumberFormat('en-US');
const estFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const integerColumns = new Set([
  'calls',
  'errors',
  'affected_branches',
  'affected_sessions',
  'safety_blocks',
  'timeouts',
  'session_errors',
  'command_failures',
  'validation_errors',
  'parse_errors',
  'total_tokens',
  'mixed_total',
]);

function parseTraceDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw);
  if (!text) return null;
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatEst(raw: unknown): string {
  const date = parseTraceDate(raw);
  if (!date) return String(raw ?? '');
  return `${estFormatter.format(date)} ET`;
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

function formatDuration(raw: unknown): string {
  if (raw === null || raw === undefined) return '0s';
  const text = String(raw);
  const seconds = Number(text.endsWith('s') ? text.slice(0, -1) : text);
  if (!Number.isFinite(seconds)) return text;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

function formatInteger(raw: unknown): string {
  const value = Number(raw);
  if (!Number.isFinite(value)) return String(raw ?? '0');
  return integerFormatter.format(Math.round(value));
}

function value(row: Row, key: string): string {
  const raw = row[key];
  if (raw === null || raw === undefined) return '0';
  if (key === 'ts') return formatEst(raw);
  if (key === 'last_seen' || key === 'first_seen') return formatRelative(raw);
  if (key === 'last_seen_at' || key === 'first_seen_at') return formatEst(raw);
  if (key === 'duration' || key === 'avg_duration' || key === 'max_duration' || key === 'total_duration') return formatDuration(raw);
  if (integerColumns.has(key)) return formatInteger(raw);
  return String(raw);
}

function printTable(title: string, rows: Row[], columns: string[]) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
  if (!rows.length) {
    console.log('(none)');
    return;
  }

  const widths = columns.map((column) => {
    const max = Math.max(column.length, ...rows.map((row) => value(row, column).length));
    if (column === 'branch' || column === 'reason' || column === 'reason_preview' || column === 'example') return Math.min(max, 84);
    if (column === 'trace_id') return Math.min(max, 18);
    if (column === 'ts' || column === 'first_seen_at' || column === 'last_seen_at') return Math.min(max, 20);
    return Math.min(max, 18);
  });

  console.log(columns.map((column, index) => column.padEnd(widths[index])).join('  '));
  console.log(columns.map((_, index) => '-'.repeat(widths[index])).join('  '));
  for (const row of rows) {
    console.log(
      columns
        .map((column, index) => {
          const cell = value(row, column).replace(/\s+/g, ' ');
          const width = widths[index];
          return (cell.length > width ? `${cell.slice(0, Math.max(0, width - 1))}…` : cell).padEnd(width);
        })
        .join('  '),
    );
  }
}

const reasonExpr = `trim(substr(replace(replace(coalesce(stderr, ''), char(10), ' '), char(13), ' '), 1, 220))`;
const errorWhere = `(status != 'ok' OR code != 'OK')`;
const mixedTotal = `coalesce(total_tokens, CAST(round((length(coalesce(input_json, '')) + length(coalesce(resolved_input_json, '')) + length(coalesce(result_json, '')) + length(coalesce(stderr, ''))) / 4.0) AS INTEGER))`;

const overviewSql = `
WITH windows(label, since, sort) AS (
  VALUES
    ('past_hour', datetime('now', '-1 hour'), 1),
    ('past_day', datetime('now', '-1 day'), 2),
    ('past_week', datetime('now', '-7 days'), 3),
    ('past_month', datetime('now', '-30 days'), 4)
)
SELECT
  label AS window,
  count(t.id) AS calls,
  sum(CASE WHEN t.id IS NOT NULL AND ${errorWhere} THEN 1 ELSE 0 END) AS errors,
  count(DISTINCT CASE WHEN ${errorWhere} THEN t.branch END) AS affected_branches,
  count(DISTINCT CASE WHEN ${errorWhere} THEN t.task_session END) AS affected_sessions,
  sum(CASE WHEN t.code = 'SAFETY_BLOCKED' THEN 1 ELSE 0 END) AS safety_blocks,
  sum(CASE WHEN t.code = 'TIMEOUT' THEN 1 ELSE 0 END) AS timeouts,
  sum(CASE WHEN t.code LIKE 'TASK_SESSION%' THEN 1 ELSE 0 END) AS session_errors,
  max(CASE WHEN ${errorWhere} THEN t.ts END) AS last_seen
FROM windows w
LEFT JOIN tool_traces t ON t.ts >= w.since
GROUP BY label, sort
ORDER BY sort;
`;

const errorBudgetSql = `
SELECT
  tool,
  count(*) AS errors,
  sum(CASE WHEN code = 'COMMAND_FAILED' THEN 1 ELSE 0 END) AS command_failures,
  sum(CASE WHEN code = 'TIMEOUT' THEN 1 ELSE 0 END) AS timeouts,
  sum(CASE WHEN code LIKE 'TASK_SESSION%' THEN 1 ELSE 0 END) AS session_errors,
  sum(CASE WHEN code = 'SAFETY_BLOCKED' THEN 1 ELSE 0 END) AS safety_blocks,
  count(DISTINCT branch) AS affected_branches,
  printf('%.2fs', avg(duration_ms) / 1000.0) AS avg_duration,
  max(ts) AS last_seen
FROM tool_traces
WHERE ts >= datetime('now', '-1 day')
  AND ${errorWhere}
GROUP BY tool
ORDER BY errors DESC, last_seen DESC
LIMIT 25;
`;

const codeSummarySql = `
SELECT
  code,
  count(*) AS errors,
  count(DISTINCT tool) AS tools,
  count(DISTINCT branch) AS affected_branches,
  printf('%.2fs', avg(duration_ms) / 1000.0) AS avg_duration,
  max(ts) AS last_seen
FROM tool_traces
WHERE ts >= datetime('now', '-1 day')
  AND ${errorWhere}
GROUP BY code
ORDER BY errors DESC, last_seen DESC;
`;

const recentIncidentsSql = `
SELECT
  ts,
  tool,
  code,
  coalesce(branch, '') AS branch,
  printf('%.2fs', duration_ms / 1000.0) AS duration,
  ${mixedTotal} AS mixed_total,
  trace_id,
  ${reasonExpr} AS reason_preview
FROM tool_traces
WHERE ts >= datetime('now', '-1 day')
  AND ${errorWhere}
ORDER BY ts DESC
LIMIT 30;
`;

const repeatedReasonsSql = `
WITH normalized AS (
  SELECT
    tool,
    code,
    CASE
      WHEN coalesce(stderr, '') = '' THEN '(empty stderr)'
      WHEN lower(stderr) LIKE '%task_session_required%' OR code = 'TASK_SESSION_REQUIRED' THEN 'task session required / missing top-level taskSession'
      WHEN lower(stderr) LIKE '%task_session_not_found%' OR code = 'TASK_SESSION_NOT_FOUND' THEN 'task session not found / stale task handle'
      WHEN lower(stderr) LIKE '%verify required%' THEN 'verify required before publish'
      WHEN lower(stderr) LIKE '%http 404%' THEN 'HTTP 404 / missing route or artifact'
      WHEN lower(stderr) LIKE '%safety%' OR code = 'SAFETY_BLOCKED' THEN 'platform/workspace safety block'
      WHEN lower(stderr) LIKE '%timed out%' OR code = 'TIMEOUT' THEN 'timeout / caller stopped waiting'
      WHEN lower(stderr) LIKE '%validation%' OR code = 'VALIDATION_ERROR' THEN 'validation error / wrong input shape'
      WHEN lower(stderr) LIKE '%parse%' OR code = 'PARSE_ERROR' THEN 'parse error / invalid generated output'
      ELSE substr(replace(replace(stderr, char(10), ' '), char(13), ' '), 1, 160)
    END AS reason,
    ts,
    trace_id,
    branch
  FROM tool_traces
  WHERE ts >= datetime('now', '-1 day')
    AND ${errorWhere}
)
SELECT
  reason,
  count(*) AS errors,
  group_concat(DISTINCT tool) AS tools,
  count(DISTINCT branch) AS affected_branches,
  max(ts) AS last_seen,
  max(trace_id) AS trace_id
FROM normalized
GROUP BY reason
ORDER BY errors DESC, last_seen DESC
LIMIT 20;
`;

const branchPressureSql = `
SELECT
  coalesce(branch, '(no branch)') AS branch,
  count(*) AS errors,
  group_concat(DISTINCT tool) AS tools,
  group_concat(DISTINCT code) AS codes,
  max(ts) AS last_seen,
  max(trace_id) AS trace_id
FROM tool_traces
WHERE ts >= datetime('now', '-1 day')
  AND ${errorWhere}
GROUP BY branch
ORDER BY errors DESC, last_seen DESC
LIMIT 25;
`;

const safetyTimeoutSessionSql = `
SELECT
  ts,
  tool,
  code,
  coalesce(branch, '') AS branch,
  printf('%.2fs', duration_ms / 1000.0) AS duration,
  trace_id,
  ${reasonExpr} AS reason_preview
FROM tool_traces
WHERE ts >= datetime('now', '-7 days')
  AND (
    code = 'SAFETY_BLOCKED'
    OR code = 'TIMEOUT'
    OR code LIKE 'TASK_SESSION%'
  )
ORDER BY ts DESC
LIMIT 30;
`;

const slowFailSql = `
SELECT
  ts,
  tool,
  code,
  coalesce(branch, '') AS branch,
  printf('%.2fs', duration_ms / 1000.0) AS duration,
  trace_id,
  ${reasonExpr} AS reason_preview
FROM tool_traces
WHERE ts >= datetime('now', '-1 day')
  AND ${errorWhere}
ORDER BY duration_ms DESC
LIMIT 20;
`;

const noisyRecentSql = `
WITH recent AS (
  SELECT
    *,
    CAST(strftime('%s', ts) / 300 AS INTEGER) AS bucket
  FROM tool_traces
  WHERE ts >= datetime('now', '-6 hours')
    AND ${errorWhere}
)
SELECT
  tool,
  code,
  count(*) AS errors,
  min(ts) AS first_seen,
  max(ts) AS last_seen,
  count(DISTINCT branch) AS affected_branches,
  max(trace_id) AS trace_id
FROM recent
GROUP BY tool, code, bucket
HAVING count(*) >= 2
ORDER BY last_seen DESC, errors DESC
LIMIT 20;
`;

console.log('Workspace trace errors');
console.log('======================');
console.log(`trace_db: ${traceDb}`);
console.log('focus: recent failures, repeated causes, affected branches, and trace IDs for debugging.');

printTable('Error overview', sqlJson(overviewSql), [
  'window', 'calls', 'errors', 'affected_branches', 'affected_sessions', 'safety_blocks', 'timeouts', 'session_errors', 'last_seen',
]);
printTable('Failing tools — past day', sqlJson(errorBudgetSql), [
  'tool', 'errors', 'command_failures', 'timeouts', 'session_errors', 'safety_blocks', 'affected_branches', 'avg_duration', 'last_seen',
]);
printTable('Failure codes — past day', sqlJson(codeSummarySql), [
  'code', 'errors', 'tools', 'affected_branches', 'avg_duration', 'last_seen',
]);
printTable('Repeated reasons — past day', sqlJson(repeatedReasonsSql), [
  'reason', 'errors', 'tools', 'affected_branches', 'last_seen', 'trace_id',
]);
printTable('Recent incidents — past day', sqlJson(recentIncidentsSql), [
  'ts', 'tool', 'code', 'branch', 'duration', 'mixed_total', 'trace_id', 'reason_preview',
]);
printTable('Branch pressure — past day', sqlJson(branchPressureSql), [
  'branch', 'errors', 'tools', 'codes', 'last_seen', 'trace_id',
]);
printTable('Safety / timeout / task-session incidents — past week', sqlJson(safetyTimeoutSessionSql), [
  'ts', 'tool', 'code', 'branch', 'duration', 'trace_id', 'reason_preview',
]);
printTable('Slow failing calls — past day', sqlJson(slowFailSql), [
  'ts', 'tool', 'code', 'branch', 'duration', 'trace_id', 'reason_preview',
]);
printTable('Bursty failures — 5-minute buckets, past 6h', sqlJson(noisyRecentSql), [
  'tool', 'code', 'errors', 'first_seen', 'last_seen', 'affected_branches', 'trace_id',
]);
