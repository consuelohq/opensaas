#!/usr/bin/env bun
import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { ensureRuntimePaths, getRuntimePaths } from './lib/runtime-state';
import { redactJson, redactText } from './lib/redaction';

type Row = {
  rowid: number;
  trace_id: string;
  name: string;
  status: string;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  duration_ms: number | null;
  output_json: string | null;
};

type Args = {
  home?: string;
  db?: string;
  skill?: string;
  traceId?: string;
  errors: boolean;
  json: boolean;
  once: boolean;
  limit: number;
  interval: number;
};

function write(value: string): void {
  process.stdout.write(value);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { errors: false, json: false, once: false, limit: 20, interval: 1000 };
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
    else if (arg === '--errors') args.errors = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--once') args.once = true;
    else if (arg === '--limit') args.limit = Number(next());
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice(8));
    else if (arg === '--interval') args.interval = Number(next());
    else if (arg.startsWith('--interval=')) args.interval = Number(arg.slice(11));
    else if (arg === '--help') {
      write('usage: bun run doctor:watch -- [--home <path>] [--db <path>] [--skill <name>] [--trace-id <id>] [--errors] [--json] [--once] [--limit <n>] [--interval <ms>]\n');
      process.exit(0);
    } else throw new Error(`unknown option: ${arg}`);
  }
  if (!Number.isFinite(args.limit) || args.limit < 0) args.limit = 20;
  if (!Number.isFinite(args.interval) || args.interval < 250) args.interval = 1000;
  return args;
}

function resolveDb(args: Args): string {
  if (args.db) return path.resolve(args.db);
  if (args.home) return path.join(path.resolve(args.home.replace(/^~(?=$|\/)/, process.env.HOME ?? '')), 'consuelo.db');
  ensureRuntimePaths();
  return getRuntimePaths().dbPath;
}

function openDb(dbPath: string): Database {
  if (!fs.existsSync(dbPath)) throw new Error(`Doctor database does not exist: ${dbPath}`);
  return new Database(dbPath, { readonly: true });
}

function filters(args: Args, afterRowid?: number): { clause: string; values: unknown[] } {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (afterRowid !== undefined) {
    clauses.push('rowid > ?');
    values.push(afterRowid);
  }
  if (args.skill) {
    clauses.push('name = ?');
    values.push(args.skill);
  }
  if (args.traceId) {
    clauses.push('trace_id = ?');
    values.push(args.traceId);
  }
  if (args.errors) clauses.push("status = 'failed'");
  return { clause: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values };
}

function queryRows(db: Database, args: Args, afterRowid?: number): Row[] {
  const selected = filters(args, afterRowid);
  const sql = `SELECT rowid, trace_id, name, status, error_code, error_message, started_at, duration_ms, output_json FROM skill_executions ${selected.clause} ORDER BY rowid ${afterRowid === undefined ? 'DESC' : 'ASC'} ${afterRowid === undefined && args.limit > 0 ? 'LIMIT ?' : ''}`;
  const values = afterRowid === undefined && args.limit > 0 ? [...selected.values, args.limit] : selected.values;
  const rows = db.query(sql).all(...values) as Row[];
  return afterRowid === undefined ? rows.reverse() : rows;
}

function duration(value: number | null): string {
  const ms = Number(value ?? 0);
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function artifactCount(row: Row): number {
  if (!row.output_json) return 0;
  const output = JSON.parse(row.output_json) as { artifacts?: unknown[] };
  return Array.isArray(output.artifacts) ? output.artifacts.length : 0;
}

function printRow(args: Args, row: Row): void {
  if (args.json) {
    write(`${JSON.stringify(redactJson(row))}\n`);
    return;
  }
  const artifacts = artifactCount(row);
  const artifactText = artifacts ? ` | ${artifacts} artifact${artifacts === 1 ? '' : 's'}` : '';
  const errorText = row.error_message ? ` | ${row.error_code ?? 'UNKNOWN'}: ${redactText(row.error_message).slice(0, 220)}` : '';
  write(`${row.started_at.slice(11, 19)}  ${row.status.padEnd(9)} ${duration(row.duration_ms).padStart(7)}  ${row.name}  ${row.trace_id}${artifactText}${errorText}\n`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = resolveDb(args);
  const db = openDb(dbPath);
  try {
    if (!args.json) write(`Doctor watch: ${dbPath}\n`);
    let lastRowid = 0;
    for (const row of queryRows(db, args)) {
      lastRowid = Math.max(lastRowid, row.rowid);
      printRow(args, row);
    }
    if (args.once) return;
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, args.interval));
      for (const row of queryRows(db, { ...args, limit: 0 }, lastRowid)) {
        lastRowid = Math.max(lastRowid, row.rowid);
        printRow(args, row);
      }
    }
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
