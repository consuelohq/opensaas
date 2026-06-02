import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { TraceHomeRow } from './types';

const defaultTraceDb = join(homedir(), 'Library/Application Support/OpenWorkspace/traces/e8425497c3ee20bf0a28e9da/traces.db');
export function resolveTraceDb(argsDb?: string, env: Record<string, string | undefined> = process.env): string { return argsDb || env.OPENWORKSPACE_TRACE_DB || env.TRACE_DB || defaultTraceDb; }
function runSql(db: string, sql: string): TraceHomeRow[] { const result = spawnSync('sqlite3', ['-cmd', '.timeout 1000', '-json', db, sql], { encoding: 'utf8' }); if (result.status !== 0) throw new Error(result.stderr || result.stdout || `sqlite3 exited ${result.status}`); const text = result.stdout.trim(); return text ? JSON.parse(text) as TraceHomeRow[] : []; }
function hasTable(db: string, table: string): boolean { const result = spawnSync('sqlite3', [db, `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`], { encoding: 'utf8' }); return result.status === 0 && result.stdout.trim() === table; }
export function loadRows(db: string, limit: number): TraceHomeRow[] {
  if (!existsSync(db)) throw new Error(`trace database not found: ${db}`);
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const table = hasTable(db, 'tool_traces') ? 'tool_traces' : 'traces';
  const sql = table === 'tool_traces'
    ? `SELECT rowid AS rownum, id AS record_id, ts, trace_id, tool, task_session, branch, worktree, status, code, exit_code, duration_ms, input_tokens, output_tokens, total_tokens, input_json, resolved_input_json, result_json, NULL AS nested_operations_json, NULL AS batch_results_json, stderr FROM tool_traces ORDER BY rowid DESC LIMIT ${safeLimit};`
    : `SELECT rowid AS rownum, id AS record_id, ts, trace_id, tool, task_session, branch, worktree, status, code, exit_code, duration_ms, input_tokens, output_tokens, total_tokens, input_json, resolved_input_json, result_json, nested_operations_json, batch_results_json, stderr FROM traces ORDER BY rowid DESC LIMIT ${safeLimit};`;
  return runSql(db, sql).reverse();
}
