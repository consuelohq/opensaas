import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, expect, test } from 'vitest';

const tempRoots = [];

function makeTraceDb() {
  const root = mkdtempSync(join(tmpdir(), 'context-trace-'));
  tempRoots.push(root);
  const dbPath = join(root, 'traces.db');
  const python = `
import json
import sqlite3
import sys

conn = sqlite3.connect(sys.argv[1])
conn.executescript("""
CREATE TABLE tool_traces (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  mcp_trace_id TEXT,
  source TEXT NOT NULL,
  tool TEXT NOT NULL,
  task_session TEXT,
  branch TEXT,
  worktree TEXT,
  status TEXT NOT NULL,
  ok INTEGER NOT NULL,
  code TEXT,
  exit_code INTEGER,
  duration_ms INTEGER,
  input_json TEXT,
  resolved_input_json TEXT,
  result_json TEXT,
  stderr TEXT
)
""")
conn.execute("""
INSERT INTO tool_traces(
  id, ts, trace_id, mcp_trace_id, source, tool, task_session, branch, worktree,
  status, ok, code, exit_code, duration_ms, input_json, resolved_input_json, result_json, stderr
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", (
  'id-1',
  '2026-05-13T12:00:00.000Z',
  'trc_visible_1',
  'trc_mcp_1',
  'mcp',
  'fs.apply_patch',
  'tsk_1',
  'task/workspace-agents/example',
  '/tmp/worktree',
  'error',
  0,
  'COMMAND_FAILED',
  1,
  42,
  json.dumps({'path': 'src/a.ts'}),
  json.dumps({'path': 'src/a.ts', 'branch': 'task/workspace-agents/example'}),
  json.dumps({'ok': False, 'message': 'apply_patch failed'}),
  'multiline --content is unsafe',
))
conn.execute("""
INSERT INTO tool_traces(id, ts, trace_id, source, tool, status, ok, code, exit_code, duration_ms)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", ('id-2', '2026-05-13T12:01:00.000Z', 'trc_visible_2', 'mcp', 'status', 'ok', 1, 'OK', 0, 4))
conn.commit()
conn.close()
`;
  const result = spawnSync('python3', ['-c', python, dbPath], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return dbPath;
}

afterEach(() => {
  while (tempRoots.length) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

function runTrace(dbPath, args) {
  return spawnSync('bun', ['scripts/context.js', 'trace', '--db', dbPath, '--json', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, SUPABASE_URL: '', SUPABASE_KEY: '' },
  });
}

test('context trace filters local sqlite rows without supabase env', () => {
  const dbPath = makeTraceDb();
  const result = runTrace(dbPath, ['--status', 'error', '--contains', 'multiline']);
  expect(result.status).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.count).toBe(1);
  expect(payload.rows[0]).toMatchObject({
    traceId: 'trc_visible_1',
    mcpTraceId: 'trc_mcp_1',
    tool: 'fs.apply_patch',
    status: 'error',
    ok: false,
    code: 'COMMAND_FAILED',
  });
  expect(payload.rows[0]).not.toHaveProperty('input');
  expect(payload.rows[0]).toHaveProperty('inputTokens');
  expect(payload.rows[0]).toHaveProperty('outputTokens');
  expect(payload.rows[0]).toHaveProperty('totalTokens');
});

test('context trace returns raw structured payloads when requested', () => {
  const dbPath = makeTraceDb();
  const result = runTrace(dbPath, ['--trace-id', 'trc_mcp_1', '--raw']);
  expect(result.status).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.count).toBe(1);
  expect(payload.rows[0].input).toEqual({ path: 'src/a.ts' });
  expect(payload.rows[0].result).toEqual({ ok: false, message: 'apply_patch failed' });
  expect(payload.rows[0].stderr).toBe('multiline --content is unsafe');
});


test('context trace returns token usage columns after schema migration', () => {
  const dbPath = makeTraceDb();
  const migrate = runTrace(dbPath, ['--limit', '1']);
  expect(migrate.status).toBe(0);
  const update = spawnSync('python3', ['-c', `
import sqlite3
import sys
conn = sqlite3.connect(sys.argv[1])
conn.execute('UPDATE tool_traces SET input_tokens = 10, output_tokens = 7, total_tokens = 17 WHERE trace_id = ?', ('trc_visible_1',))
conn.commit()
conn.close()
`, dbPath], { encoding: 'utf8' });
  expect(update.status).toBe(0);

  const result = runTrace(dbPath, ['--trace-id', 'trc_visible_1']);
  expect(result.status).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.rows[0]).toMatchObject({
    inputTokens: 10,
    outputTokens: 7,
    totalTokens: 17,
  });
});
