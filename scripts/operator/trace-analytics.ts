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

const traceDb = process.env.TRACE_DB || Bun.argv.find((arg) => arg.startsWith('--db='))?.slice(5) || defaultTraceDb;

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
  return text ? JSON.parse(text) as Row[] : [];
}

function value(row: Row, key: string): string {
  const raw = row[key];
  if (raw === null || raw === undefined) return '';
  return String(raw);
}

function printTable(title: string, rows: Row[], columns: string[]) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
  if (!rows.length) {
    console.log('(none)');
    return;
  }
  const widths = columns.map((column) => Math.min(
    Math.max(column.length, ...rows.map((row) => value(row, column).length)),
    column === 'branch' || column === 'reason_preview' ? 72 : 24,
  ));
  console.log(columns.map((column, index) => column.padEnd(widths[index])).join('  '));
  console.log(columns.map((_, index) => '-'.repeat(widths[index])).join('  '));
  for (const row of rows) {
    console.log(columns.map((column, index) => {
      const cell = value(row, column).replace(/\s+/g, ' ');
      const width = widths[index];
      return (cell.length > width ? `${cell.slice(0, Math.max(0, width - 1))}…` : cell).padEnd(width);
    }).join('  '));
  }
}

const estimatedInput = `CAST(round((length(coalesce(input_json, '')) + length(coalesce(resolved_input_json, ''))) / 4.0) AS INTEGER)`;
const estimatedOutput = `CAST(round((length(coalesce(result_json, '')) + length(coalesce(stderr, ''))) / 4.0) AS INTEGER)`;
const inputMixed = `coalesce(input_tokens, ${estimatedInput})`;
const outputMixed = `coalesce(output_tokens, ${estimatedOutput})`;
const totalMixed = `coalesce(total_tokens, ${inputMixed} + ${outputMixed})`;

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
  printf('%.2fs', coalesce(sum(t.duration_ms), 0) / 1000.0) AS duration
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

const topToolsSql = `
SELECT
  tool,
  count(*) AS calls,
  count(total_tokens) AS tracked_rows,
  count(*) - count(total_tokens) AS estimated_rows,
  coalesce(sum(${totalMixed}), 0) AS mixed_total,
  coalesce(sum(total_tokens), 0) AS tracked_total,
  printf('%.2fs', coalesce(sum(duration_ms), 0) / 1000.0) AS duration,
  sum(CASE WHEN status != 'ok' OR code != 'OK' THEN 1 ELSE 0 END) AS errors
FROM tool_traces
WHERE ts >= datetime('now', '-1 day')
GROUP BY tool
ORDER BY mixed_total DESC, calls DESC
LIMIT 20;
`;

const topBranchesSql = `
SELECT
  coalesce(branch, '(no branch)') AS branch,
  count(*) AS calls,
  count(total_tokens) AS tracked_rows,
  count(*) - count(total_tokens) AS estimated_rows,
  coalesce(sum(${totalMixed}), 0) AS mixed_total,
  coalesce(sum(total_tokens), 0) AS tracked_total,
  printf('%.2fs', coalesce(sum(duration_ms), 0) / 1000.0) AS duration,
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

console.log('Workspace trace analytics');
console.log('=========================');
console.log(`trace_db: ${traceDb}`);
console.log('token note: tracked_* uses recorded token columns. mixed_* uses recorded tokens when present and character-count estimates for older rows.');

printTable('Token coverage by window', sqlJson(windowsSql), [
  'window', 'calls', 'tracked_rows', 'estimated_rows', 'tracked_total', 'mixed_total', 'duration',
]);
printTable('Tracked token coverage', sqlJson(coverageSql), [
  'first_tracked_token_row', 'latest_tracked_token_row', 'tracked_rows', 'tracked_total_tokens',
]);
printTable('Top tools by mixed tokens — past day', sqlJson(topToolsSql), [
  'tool', 'calls', 'tracked_rows', 'estimated_rows', 'mixed_total', 'tracked_total', 'duration', 'errors',
]);
printTable('Top task branches by mixed tokens — past day', sqlJson(topBranchesSql), [
  'branch', 'calls', 'tracked_rows', 'estimated_rows', 'mixed_total', 'tracked_total', 'duration', 'errors',
]);
printTable('Top errors by code/tool — past day', sqlJson(errorSummarySql), [
  'tool', 'code', 'errors', 'avg_duration', 'last_seen',
]);
printTable('Recent errors with reason preview', sqlJson(recentErrorsSql), [
  'ts', 'tool', 'branch', 'code', 'duration', 'reason_preview',
]);
printTable('Slowest calls — past day', sqlJson(slowestSql), [
  'ts', 'tool', 'branch', 'code', 'duration', 'mixed_total',
]);
printTable('High-output calls — past day', sqlJson(highOutputSql), [
  'ts', 'tool', 'branch', 'code', 'mixed_output', 'mixed_total', 'duration',
]);
