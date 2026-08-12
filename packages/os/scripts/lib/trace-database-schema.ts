import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

export type TraceStatement = {
  run: (...values: unknown[]) => unknown;
  all: (...values: unknown[]) => unknown[];
};

export type TraceDatabase = {
  exec: (sql: string) => void;
  query: (sql: string) => TraceStatement;
  close: () => void;
};

type TraceDatabaseConstructor = new (
  filename: string,
  options?: { create?: boolean; readonly?: boolean },
) => TraceDatabase;

const TRACE_COLUMNS: Array<{ name: string; alterSql: string }> = [
  { name: 'id', alterSql: 'ALTER TABLE tool_traces ADD COLUMN id TEXT;' },
  { name: 'ts', alterSql: 'ALTER TABLE tool_traces ADD COLUMN ts TEXT;' },
  { name: 'trace_id', alterSql: 'ALTER TABLE tool_traces ADD COLUMN trace_id TEXT;' },
  { name: 'mcp_trace_id', alterSql: 'ALTER TABLE tool_traces ADD COLUMN mcp_trace_id TEXT;' },
  { name: 'source', alterSql: 'ALTER TABLE tool_traces ADD COLUMN source TEXT;' },
  { name: 'tool', alterSql: 'ALTER TABLE tool_traces ADD COLUMN tool TEXT;' },
  { name: 'task_session', alterSql: 'ALTER TABLE tool_traces ADD COLUMN task_session TEXT;' },
  { name: 'branch', alterSql: 'ALTER TABLE tool_traces ADD COLUMN branch TEXT;' },
  { name: 'worktree', alterSql: 'ALTER TABLE tool_traces ADD COLUMN worktree TEXT;' },
  { name: 'requested_node_id', alterSql: 'ALTER TABLE tool_traces ADD COLUMN requested_node_id TEXT;' },
  { name: 'resolved_node_id', alterSql: 'ALTER TABLE tool_traces ADD COLUMN resolved_node_id TEXT;' },
  { name: 'resolved_node_name', alterSql: 'ALTER TABLE tool_traces ADD COLUMN resolved_node_name TEXT;' },
  { name: 'default_node_id', alterSql: 'ALTER TABLE tool_traces ADD COLUMN default_node_id TEXT;' },
  { name: 'route_source', alterSql: 'ALTER TABLE tool_traces ADD COLUMN route_source TEXT;' },
  { name: 'status', alterSql: 'ALTER TABLE tool_traces ADD COLUMN status TEXT;' },
  { name: 'ok', alterSql: 'ALTER TABLE tool_traces ADD COLUMN ok INTEGER;' },
  { name: 'code', alterSql: 'ALTER TABLE tool_traces ADD COLUMN code TEXT;' },
  { name: 'exit_code', alterSql: 'ALTER TABLE tool_traces ADD COLUMN exit_code INTEGER;' },
  { name: 'duration_ms', alterSql: 'ALTER TABLE tool_traces ADD COLUMN duration_ms INTEGER;' },
  { name: 'input_json', alterSql: 'ALTER TABLE tool_traces ADD COLUMN input_json TEXT;' },
  { name: 'resolved_input_json', alterSql: 'ALTER TABLE tool_traces ADD COLUMN resolved_input_json TEXT;' },
  { name: 'result_json', alterSql: 'ALTER TABLE tool_traces ADD COLUMN result_json TEXT;' },
  { name: 'stderr', alterSql: 'ALTER TABLE tool_traces ADD COLUMN stderr TEXT;' },
  { name: 'input_tokens', alterSql: 'ALTER TABLE tool_traces ADD COLUMN input_tokens INTEGER;' },
  { name: 'output_tokens', alterSql: 'ALTER TABLE tool_traces ADD COLUMN output_tokens INTEGER;' },
  { name: 'total_tokens', alterSql: 'ALTER TABLE tool_traces ADD COLUMN total_tokens INTEGER;' },
];

export function openTraceDatabase(dbPath: string): TraceDatabase {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const { Database } = require('bun:sqlite') as { Database: TraceDatabaseConstructor };
  const db = new Database(dbPath, { create: true });
  db.exec('PRAGMA busy_timeout = 1000;');
  return db;
}

export function ensureToolTraceSchema(db: TraceDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_traces (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      trace_id TEXT NOT NULL,
      mcp_trace_id TEXT,
      source TEXT NOT NULL,
      tool TEXT NOT NULL,
      task_session TEXT,
      branch TEXT,
      worktree TEXT,
      requested_node_id TEXT,
      resolved_node_id TEXT,
      resolved_node_name TEXT,
      default_node_id TEXT,
      route_source TEXT,
      status TEXT NOT NULL,
      ok INTEGER NOT NULL,
      code TEXT,
      exit_code INTEGER,
      duration_ms INTEGER,
      input_json TEXT,
      resolved_input_json TEXT,
      result_json TEXT,
      stderr TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER
    );
  `);

  const columns = new Set(
    (db.query('PRAGMA table_info(tool_traces)').all() as Array<{ name?: unknown }>)
      .map((row) => typeof row.name === 'string' ? row.name : '')
      .filter(Boolean),
  );
  for (const column of TRACE_COLUMNS) {
    if (!columns.has(column.name)) db.exec(column.alterSql);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS tool_traces_ts_idx ON tool_traces(ts);
    CREATE INDEX IF NOT EXISTS tool_traces_trace_id_idx ON tool_traces(trace_id);
    CREATE INDEX IF NOT EXISTS tool_traces_mcp_trace_id_idx ON tool_traces(mcp_trace_id);
    CREATE INDEX IF NOT EXISTS tool_traces_tool_idx ON tool_traces(tool);
    CREATE INDEX IF NOT EXISTS tool_traces_status_idx ON tool_traces(status);
    CREATE INDEX IF NOT EXISTS tool_traces_task_session_idx ON tool_traces(task_session);
    CREATE INDEX IF NOT EXISTS tool_traces_branch_idx ON tool_traces(branch);
    CREATE INDEX IF NOT EXISTS tool_traces_resolved_node_id_idx ON tool_traces(resolved_node_id);
    CREATE INDEX IF NOT EXISTS tool_traces_route_source_idx ON tool_traces(route_source);
  `);
}

export function ensureTraceDatabaseSchema(dbPath: string): void {
  const db = openTraceDatabase(dbPath);
  try {
    ensureToolTraceSchema(db);
  } finally {
    db.close();
  }
}
