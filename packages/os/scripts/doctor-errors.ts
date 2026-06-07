#!/usr/bin/env bun
import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { ensureRuntimePaths, getRuntimePaths } from './lib/runtime-state';
import { redactJson, redactText } from './lib/redaction';

type Row = {
  trace_id: string;
  name: string;
  status: string;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  duration_ms: number | null;
};

type Args = { home?: string; db?: string; skill?: string; traceId?: string; json: boolean; limit: number };

function write(value: string): void { process.stdout.write(value); }

function parseArgs(argv: string[]): Args {
  const args: Args = { json: false, limit: 20 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = (): string => argv[++index] ?? '';
    if (arg === '--home') args.home = next();
    else if (arg.startsWith('--home=')) args.home = arg.slice(7);
    else if (arg === '--db') args.db = next();
    else if (arg.startsWith('--db=')) args.db = arg.slice(5);
    else if (arg === '--skill') args.skill = next();
    else if (arg.startsWith('--skill=')) args.skill = arg.slice(8);
    else if (arg === '--trace-id') args.traceId = next();
    else if (arg.startsWith('--trace-id=')) args.traceId = arg.slice(11);
    else if (arg === '--json') args.json = true;
    else if (arg === '--limit') args.limit = Number(next());
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice(8));
    else if (arg === '--help') {
      write('usage: bun run doctor:errors -- [--home <path>] [--db <path>] [--skill <name>] [--trace-id <id>] [--json] [--limit <n>]\n');
      process.exit(0);
    } else throw new Error(`unknown option: ${arg}`);
  }
  if (!Number.isFinite(args.limit) || args.limit < 0) args.limit = 20;
  return args;
}

function resolveDb(args: Args): string {
  if (args.db) return path.resolve(args.db);
  if (args.home) return path.join(path.resolve(args.home.replace(/^~(?=$|\/)/, process.env.HOME ?? '')), 'consuelo.db');
  ensureRuntimePaths();
  return getRuntimePaths().dbPath;
}

function queryRows(db: Database, args: Args): Row[] {
  if (args.skill && args.traceId) {
    return db.query("SELECT trace_id, name, status, error_code, error_message, started_at, duration_ms FROM skill_executions WHERE status = 'failed' AND name = ? AND trace_id = ? ORDER BY rowid DESC LIMIT ?").all(args.skill, args.traceId, args.limit) as Row[];
  }
  if (args.skill) {
    return db.query("SELECT trace_id, name, status, error_code, error_message, started_at, duration_ms FROM skill_executions WHERE status = 'failed' AND name = ? ORDER BY rowid DESC LIMIT ?").all(args.skill, args.limit) as Row[];
  }
  if (args.traceId) {
    return db.query("SELECT trace_id, name, status, error_code, error_message, started_at, duration_ms FROM skill_executions WHERE status = 'failed' AND trace_id = ? ORDER BY rowid DESC LIMIT ?").all(args.traceId, args.limit) as Row[];
  }
  return db.query("SELECT trace_id, name, status, error_code, error_message, started_at, duration_ms FROM skill_executions WHERE status = 'failed' ORDER BY rowid DESC LIMIT ?").all(args.limit) as Row[];
}

function duration(value: number | null): string {
  const ms = Number(value ?? 0);
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = resolveDb(args);
  if (!fs.existsSync(dbPath)) throw new Error(`Doctor database does not exist: ${dbPath}`);
  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = queryRows(db, args);
    if (args.json) {
      for (const row of rows) write(`${JSON.stringify(redactJson({ traceId: row.trace_id, skill: row.name, status: row.status, errorCode: row.error_code, errorMessage: row.error_message, durationMs: row.duration_ms }))}\n`);
      return;
    }
    write(`Doctor errors: ${dbPath}\n`);
    if (rows.length === 0) { write('no failed executions matched\n'); return; }
    for (const row of rows) write(`${row.started_at.slice(11, 19)}  ${duration(row.duration_ms).padStart(7)}  ${row.name}  ${row.trace_id}\n  ${row.error_code ?? 'UNKNOWN'}: ${redactText(String(row.error_message ?? '')).slice(0, 500)}\n`);
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
