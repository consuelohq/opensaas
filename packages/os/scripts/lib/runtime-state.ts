import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { redactJson, redactText } from './redaction';
import type { CallOutput } from './types';

export type ExecutionStatus = 'started' | 'succeeded' | 'failed';

export type RuntimePaths = {
  home: string;
  dbPath: string;
  artifactsDir: string;
  logsDir: string;
  runsDir: string;
  tmpDir: string;
};

export type ExecutionRecordInput = {
  traceId: string;
  name: string;
  workspaceId?: string;
  userId?: string;
  input?: unknown;
};

export type ExecutionFinishInput = {
  traceId: string;
  status: ExecutionStatus;
  output?: CallOutput;
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
};

function expandHome(value: string): string {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

export function getConsueloHome(): string {
  return path.resolve(expandHome(process.env.CONSUELO_HOME ?? '~/.consuelo/os'));
}

export function getRuntimePaths(): RuntimePaths {
  const home = getConsueloHome();
  return {
    home,
    dbPath: path.join(home, 'consuelo.db'),
    artifactsDir: path.join(home, 'artifacts'),
    logsDir: path.join(home, 'logs'),
    runsDir: path.join(home, 'runs'),
    tmpDir: path.join(home, 'tmp'),
  };
}

export function ensureRuntimePaths(): RuntimePaths {
  const paths = getRuntimePaths();
  for (const dir of [paths.home, paths.artifactsDir, paths.logsDir, paths.runsDir, paths.tmpDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return paths;
}

function openDatabase(): Database {
  const paths = ensureRuntimePaths();
  const db = new Database(paths.dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_executions (
      trace_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      workspace_id TEXT,
      user_id TEXT,
      status TEXT NOT NULL,
      input_json TEXT,
      output_json TEXT,
      error_code TEXT,
      error_message TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      duration_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS execution_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trace_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

function safeJson(value: unknown): string | null {
  if (value === undefined) return null;
  return JSON.stringify(redactJson(value));
}

function nowIso(): string {
  return new Date().toISOString();
}

export function recordExecutionStarted(input: ExecutionRecordInput): void {
  const db = openDatabase();
  try {
    db.query('INSERT INTO skill_executions (trace_id, name, workspace_id, user_id, status, input_json, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      input.traceId,
      input.name,
      input.workspaceId ?? null,
      input.userId ?? null,
      'started',
      safeJson(input.input),
      nowIso(),
    );

    db.query('INSERT INTO execution_events (trace_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)').run(input.traceId, 'execution.started', safeJson({ name: input.name }), nowIso());
  } finally {
    db.close();
  }
}

export function recordExecutionFinished(input: ExecutionFinishInput): void {
  const db = openDatabase();
  try {
    db.query('UPDATE skill_executions SET status = ?, output_json = ?, error_code = ?, error_message = ?, finished_at = ?, duration_ms = ? WHERE trace_id = ?').run(
      input.status,
      safeJson(input.output),
      input.errorCode ?? input.output?.error?.code ?? null,
      input.errorMessage ? redactText(input.errorMessage) : input.output?.error?.message ? redactText(input.output.error.message) : null,
      nowIso(),
      input.durationMs,
      input.traceId,
    );

    db.query('INSERT INTO execution_events (trace_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)').run(
      input.traceId,
      `execution.${input.status}`,
      safeJson({ errorCode: input.errorCode ?? input.output?.error?.code, durationMs: input.durationMs }),
      nowIso(),
    );
  } finally {
    db.close();
  }
}
