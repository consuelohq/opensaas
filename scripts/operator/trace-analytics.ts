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
  'rows',
  'rows_in_past_week',
  'rows_in_past_month',
  'rows_older_than_week',
  'tracked_rows',
  'estimated_rows',
  'token_rows',
  'rows_without_tokens',
  'input_tokens',
  'output_tokens',
  'total_tokens',
  'tracked_input',
  'tracked_output',
  'tracked_total',
  'mixed_input',
  'mixed_output',
  'mixed_total',
  'tracked_total_tokens',
  'input_tokens',
  'output_tokens',
  'errors',
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
  if (key === 'last_seen') return formatRelative(raw);
  if (
    key === 'first_row' ||
    key === 'latest_row' ||
    key === 'first_tracked_token_row' ||
    key === 'latest_tracked_token_row'
  ) {
    return formatEst(raw);
  }
  if (key === 'duration' || key === 'avg_duration' || key === 'total_duration') return formatDuration(raw);
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
    if (column === 'branch' || column === 'reason_preview' || column === 'window_note') return Math.min(max, 88);
    if (column === 'ts' || column === 'last_seen' || column.includes('row')) return Math.min(max, 26);
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

const estimatedInput = `CAST(round((length(coalesce(input_json, '')) + length(coalesce(resolved_input_json, ''))) / 4.0) AS INTEGER)`;
const estimatedOutput = `CAST(round((length(coalesce(result_json, '')) + length(coalesce(stderr, ''))) / 4.0) AS INTEGER)`;
const inputMixed = `coalesce(input_tokens, ${estimatedInput})`;
const outputMixed = `coalesce(output_tokens, ${estimatedOutput})`;
const totalMixed = `coalesce(total_tokens, ${inputMixed} + ${outputMixed})`;

const historySql = `
SELECT
  min(ts) AS first_row,
  max(ts) AS latest_row,
  count(*) AS rows,
  sum(CASE WHEN ts >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS rows_in_past_week,
  sum(CASE WHEN ts >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS rows_in_past_month,
  sum(CASE WHEN ts < datetime('now', '-7 days') THEN 1 ELSE 0 END) AS rows_older_than_week,
  CASE
    WHEN count(*) = 0 THEN 'no trace rows found'
    WHEN sum(CASE WHEN ts < datetime('now', '-7 days') THEN 1 ELSE 0 END) = 0 THEN 'past_week and past_month match because this trace DB has no rows older than 7 days'
    ELSE 'past_month includes rows older than 7 days'
  END AS window_note
FROM tool_traces;
`;

const windowsSql = `
WITH windows(label, since, sort) AS (
  VALUES
    ('past_day', datetime('now', '-1 day'), 1),
    ('past_week', datetime('now', '-7 days'), 2),
    ('past_month', datetime('now', '-30 days'), 3)
)
SELECT
  label AS window,
  count(t.id) AS calls,
  count(t.total_tokens) AS tracked_rows,
  count(t.id) - count(t.total_tokens) AS estimated_rows,
  coalesce(sum(t.input_tokens), 0) AS tracked_input,
  coalesce(sum(t.output_tokens), 0) AS tracked_output,
  coalesce(sum(t.total_tokens), 0) AS tracked_total,
  coalesce(sum(${inputMixed}), 0) AS mixed_input,
  coalesce(sum(${outputMixed}), 0) AS mixed_output,
  coalesce(sum(${totalMixed}), 0) AS mixed_total,
  printf('%.2fs', coalesce(sum(t.duration_ms), 0) / 1000.0) AS total_duration
FROM windows w
LEFT JOIN tool_traces t ON t.ts >= w.since
GROUP BY label, sort
ORDER BY sort;
`;

const coverageSql = `
SELECT
  min(ts) AS first_tracked_token_row,
  max(ts) AS latest_tracked_token_row,
  count(*) AS tracked_rows,
  coalesce(sum(total_tokens), 0) AS tracked_total_tokens
FROM tool_traces
WHERE total_tokens IS NOT NULL;
`;

const topToolsTrackedSql = `
SELECT
  tool,
  count(*) AS calls,
  count(total_tokens) AS token_rows,
  coalesce(sum(total_tokens), 0) AS total_tokens,
  coalesce(sum(input_tokens), 0) AS input_tokens,
  coalesce(sum(output_tokens), 0) AS output_tokens,
  printf('%.2fs', coalesce(sum(duration_ms), 0) / 1000.0) AS total_duration,
  sum(CASE WHEN status != 'ok' OR code != 'OK' THEN 1 ELSE 0 END) AS errors
FROM tool_traces
WHERE ts >= datetime('now', '-1 day')
GROUP BY tool
ORDER BY total_tokens DESC, calls DESC
LIMIT 20;
`;

const topToolsMixedSql = `
SELECT
  tool,
  count(*) AS calls,
  count(total_tokens) AS tracked_rows,
  count(*) - count(total_tokens) AS estimated_rows,
  coalesce(sum(${totalMixed}), 0) AS mixed_total,
  coalesce(sum(total_tokens), 0) AS tracked_total,
  printf('%.2fs', coalesce(sum(duration_ms), 0) / 1000.0) AS total_duration,
  sum(CASE WHEN status != 'ok' OR code != 'OK' THEN 1 ELSE 0 END) AS errors
FROM tool_traces
WHERE ts >= datetime('now', '-1 day')
GROUP BY tool
ORDER BY mixed_total DESC, calls DESC
LIMIT 20;
`;

const topBranchesTrackedSql = `
SELECT
  coalesce(branch, '(no branch)') AS branch,
  count(*) AS calls,
  count(total_tokens) AS token_rows,
  coalesce(sum(total_tokens), 0) AS total_tokens,
  coalesce(sum(input_tokens), 0) AS input_tokens,
  coalesce(sum(output_tokens), 0) AS output_tokens,
  printf('%.2fs', coalesce(sum(duration_ms), 0) / 1000.0) AS total_duration,
  sum(CASE WHEN status != 'ok' OR code != 'OK' THEN 1 ELSE 0 END) AS errors
FROM tool_traces
WHERE ts >= datetime('now', '-1 day')
GROUP BY branch
ORDER BY total_tokens DESC, calls DESC
LIMIT 20;
`;

const topBranchesMixedSql = `
SELECT
  coalesce(branch, '(no branch)') AS branch,
  count(*) AS calls,
  count(total_tokens) AS tracked_rows,
  count(*) - count(total_tokens) AS estimated_rows,
  coalesce(sum(${totalMixed}), 0) AS mixed_total,
  coalesce(sum(total_tokens), 0) AS tracked_total,
  printf('%.2fs', coalesce(sum(duration_ms), 0) / 1000.0) AS total_duration,
  sum(CASE WHEN status != 'ok' OR code != 'OK' THEN 1 ELSE 0 END) AS errors
FROM tool_traces
WHERE ts >= datetime('now', '-1 day')
GROUP BY branch
ORDER BY mixed_total DESC, calls DESC
LIMIT 20;
`;

const errorSummarySql = `
SELECT
  tool,
  code,
  count(*) AS errors,
  printf('%.2fs', avg(duration_ms) / 1000.0) AS avg_duration,
  max(ts) AS last_seen
FROM tool_traces
WHERE ts >= datetime('now', '-1 day')
  AND (status != 'ok' OR code != 'OK')
GROUP BY tool, code
ORDER BY errors DESC, last_seen DESC
LIMIT 20;
`;

const recentErrorsSql = `
SELECT
  ts,
  tool,
  coalesce(branch, '') AS branch,
  code,
  printf('%.2fs', duration_ms / 1000.0) AS duration,
  replace(substr(coalesce(stderr, ''), 1, 180), char(10), ' ') AS reason_preview
FROM tool_traces
WHERE ts >= datetime('now', '-1 day')
  AND (status != 'ok' OR code != 'OK')
ORDER BY ts DESC
LIMIT 20;
`;

const slowestSql = `
SELECT
  ts,
  tool,
  coalesce(branch, '') AS branch,
  code,
  printf('%.2fs', duration_ms / 1000.0) AS duration,
  ${totalMixed} AS mixed_total
FROM tool_traces
WHERE ts >= datetime('now', '-1 day')
ORDER BY duration_ms DESC
LIMIT 20;
`;

const highOutputSql = `
SELECT
  ts,
  tool,
  coalesce(branch, '') AS branch,
  code,
  coalesce(output_tokens, ${estimatedOutput}) AS mixed_output,
  ${totalMixed} AS mixed_total,
  printf('%.2fs', duration_ms / 1000.0) AS duration
FROM tool_traces
WHERE ts >= datetime('now', '-1 day')
ORDER BY mixed_output DESC
LIMIT 20;
`;

const activeBranchesSql = `
SELECT
  branch,
  count(*) AS calls,
  max(ts) AS last_seen,
  coalesce(sum(total_tokens), 0) AS tracked_total,
  coalesce(sum(${totalMixed}), 0) AS mixed_total,
  sum(CASE WHEN status != 'ok' OR code != 'OK' THEN 1 ELSE 0 END) AS errors
FROM tool_traces
WHERE ts >= datetime('now', '-1 day')
  AND branch LIKE 'task/%'
GROUP BY branch
ORDER BY last_seen DESC
LIMIT 30;
`;

console.log('Workspace trace analytics');
console.log('=========================');
console.log(`trace_db: ${traceDb}`);
console.log('token note: tracked_* uses recorded token columns. mixed_* uses recorded tokens when present and character-count estimates for older rows.');

printTable('Trace history', sqlJson(historySql), [
  'first_row',
  'latest_row',
  'rows',
  'rows_in_past_week',
  'rows_in_past_month',
  'rows_older_than_week',
  'window_note',
]);
printTable('Token coverage by window', sqlJson(windowsSql), [
  'window',
  'calls',
  'tracked_rows',
  'estimated_rows',
  'tracked_input',
  'tracked_output',
  'tracked_total',
  'mixed_input',
  'mixed_output',
  'mixed_total',
  'total_duration',
]);
printTable('Tracked token coverage', sqlJson(coverageSql), [
  'first_tracked_token_row',
  'latest_tracked_token_row',
  'tracked_rows',
  'tracked_total_tokens',
]);
printTable('Top tools by tracked tokens — past day', sqlJson(topToolsTrackedSql), [
  'tool',
  'calls',
  'token_rows',
  'total_tokens',
  'input_tokens',
  'output_tokens',
  'total_duration',
  'errors',
]);
printTable('Top tools by mixed tokens — past day', sqlJson(topToolsMixedSql), [
  'tool',
  'calls',
  'tracked_rows',
  'estimated_rows',
  'mixed_total',
  'tracked_total',
  'total_duration',
  'errors',
]);
printTable('Top task branches by tracked tokens — past day', sqlJson(topBranchesTrackedSql), [
  'branch',
  'calls',
  'token_rows',
  'total_tokens',
  'input_tokens',
  'output_tokens',
  'total_duration',
  'errors',
]);
printTable('Top task branches by mixed tokens — past day', sqlJson(topBranchesMixedSql), [
  'branch',
  'calls',
  'tracked_rows',
  'estimated_rows',
  'mixed_total',
  'tracked_total',
  'total_duration',
  'errors',
]);
printTable('Top errors by code/tool — past day', sqlJson(errorSummarySql), [
  'tool',
  'code',
  'errors',
  'avg_duration',
  'last_seen',
]);
printTable('Recent errors with reason preview', sqlJson(recentErrorsSql), [
  'ts',
  'tool',
  'branch',
  'code',
  'duration',
  'reason_preview',
]);
printTable('Slowest calls — past day', sqlJson(slowestSql), [
  'ts',
  'tool',
  'branch',
  'code',
  'duration',
  'mixed_total',
]);
printTable('High-output calls — past day', sqlJson(highOutputSql), [
  'ts',
  'tool',
  'branch',
  'code',
  'mixed_output',
  'mixed_total',
  'duration',
]);
printTable('Active traced task branches — past day', sqlJson(activeBranchesSql), [
  'branch',
  'calls',
  'last_seen',
  'tracked_total',
  'mixed_total',
  'errors',
]);
