import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { TraceHomeRow } from './types';

export type TraceHomeLoadResult = { rows: TraceHomeRow[]; transientError?: string };

const defaultTraceDb = join(homedir(), 'Library/Application Support/OpenWorkspace/traces/e8425497c3ee20bf0a28e9da/traces.db');

export function resolveTraceDb(argsDb?: string, env: Record<string, string | undefined> = process.env): string {
  return argsDb || env.OPENWORKSPACE_TRACE_DB || env.TRACE_DB || defaultTraceDb;
}

function compactError(text: string): string {
  const compact = String(text || '').trim().replace(/\s+/g, ' ');
  return compact.length > 240 ? `${compact.slice(0, 239)}...` : compact;
}

function runSql(db: string, sql: string): TraceHomeLoadResult {
  const result = spawnSync('sqlite3', ['-cmd', '.timeout 1000', '-json', db, sql], { encoding: 'utf8' });
  if (result.status !== 0) {
    const message = compactError(result.stderr || result.stdout || `sqlite3 exited ${result.status}`);
    return { rows: [], transientError: message };
  }
  const text = result.stdout.trim();
  if (!text) return { rows: [] };
  try {
    return { rows: JSON.parse(text) as TraceHomeRow[] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { rows: [], transientError: `failed to parse sqlite JSON output: ${compactError(message)}` };
  }
}

function hasTable(db: string, table: string): boolean {
  const result = spawnSync('sqlite3', [db, `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim() === table;
}

export function loadRowsResult(db: string, limit: number): TraceHomeLoadResult {
  if (!existsSync(db)) throw new Error(`trace database not found: ${db}`);
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const table = hasTable(db, 'tool_traces') ? 'tool_traces' : 'traces';
  const sql = table === 'tool_traces'
    ? `SELECT rowid AS rownum, id AS record_id, ts, trace_id, tool, task_session, branch, worktree, status, code, exit_code, duration_ms, input_tokens, output_tokens, total_tokens, input_json, resolved_input_json, substr(coalesce(result_json, ''), 1, 4000) AS result_json, NULL AS nested_operations_json, NULL AS batch_results_json, substr(coalesce(stderr, ''), 1, 4000) AS stderr FROM tool_traces ORDER BY rowid DESC LIMIT ${safeLimit};`
    : `SELECT rowid AS rownum, id AS record_id, ts, trace_id, tool, task_session, branch, worktree, status, code, exit_code, duration_ms, input_tokens, output_tokens, total_tokens, input_json, resolved_input_json, substr(coalesce(result_json, ''), 1, 4000) AS result_json, nested_operations_json, batch_results_json, substr(coalesce(stderr, ''), 1, 4000) AS stderr FROM traces ORDER BY rowid DESC LIMIT ${safeLimit};`;
  const result = runSql(db, sql);
  return { rows: result.rows.reverse(), transientError: result.transientError };
}

export function loadRows(db: string, limit: number): TraceHomeRow[] {
  return loadRowsResult(db, limit).rows;
}
