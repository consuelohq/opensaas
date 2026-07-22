#!/usr/bin/env bun
import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { ensureRuntimePaths, getRuntimePaths } from './lib/runtime-state';
import { redactJson } from './lib/redaction';

type Args = { home?: string; db?: string; skill?: string; json: boolean };
type AnalyticsRow = { name: string; status: string; count: number; avg_duration_ms: number | null; max_duration_ms: number | null };
type ErrorRow = { error_code: string; count: number };

function write(value: string): void { process.stdout.write(value); }

function parseArgs(argv: string[]): Args {
  const args: Args = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = (): string => argv[++index] ?? '';
    if (arg === '--home') args.home = next();
    else if (arg.startsWith('--home=')) args.home = arg.slice(7);
    else if (arg === '--db') args.db = next();
    else if (arg.startsWith('--db=')) args.db = arg.slice(5);
    else if (arg === '--skill') args.skill = next();
    else if (arg.startsWith('--skill=')) args.skill = arg.slice(8);
    else if (arg === '--json') args.json = true;
    else if (arg === '--help') {
      write('usage: bun run doctor:analytics -- [--home <path>] [--db <path>] [--skill <name>] [--json]\n');
      process.exit(0);
    } else throw new Error(`unknown option: ${arg}`);
  }
  return args;
}

function resolveDb(args: Args): string {
  if (args.db) return path.resolve(args.db);
  if (args.home) return path.join(path.resolve(args.home.replace(/^~(?=$|\/)/, process.env.HOME ?? '')), 'consuelo.db');
  ensureRuntimePaths();
  return getRuntimePaths().dbPath;
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
    const executions = args.skill
      ? db.query("SELECT name, status, count(*) AS count, round(avg(duration_ms), 0) AS avg_duration_ms, max(duration_ms) AS max_duration_ms FROM skill_executions WHERE name = ? GROUP BY name, status ORDER BY count DESC, name ASC, status ASC").all(args.skill) as AnalyticsRow[]
      : db.query("SELECT name, status, count(*) AS count, round(avg(duration_ms), 0) AS avg_duration_ms, max(duration_ms) AS max_duration_ms FROM skill_executions GROUP BY name, status ORDER BY count DESC, name ASC, status ASC").all() as AnalyticsRow[];
    const errors = args.skill
      ? db.query("SELECT coalesce(error_code, 'UNKNOWN') AS error_code, count(*) AS count FROM skill_executions WHERE name = ? AND status = 'failed' GROUP BY coalesce(error_code, 'UNKNOWN') ORDER BY count DESC, error_code ASC").all(args.skill) as ErrorRow[]
      : db.query("SELECT coalesce(error_code, 'UNKNOWN') AS error_code, count(*) AS count FROM skill_executions WHERE status = 'failed' GROUP BY coalesce(error_code, 'UNKNOWN') ORDER BY count DESC, error_code ASC").all() as ErrorRow[];
    if (args.json) {
      write(`${JSON.stringify(redactJson({ dbPath, executions, errors }), null, 2)}\n`);
      return;
    }
    write(`Doctor analytics: ${dbPath}\nexecutions by skill/status\n`);
    for (const row of executions) write(`  ${String(row.count).padStart(4)}  ${row.status.padEnd(10)}  ${duration(row.avg_duration_ms).padStart(7)} avg  ${duration(row.max_duration_ms).padStart(7)} max  ${row.name}\n`);
    write('error codes\n');
    if (errors.length === 0) { write('  none\n'); return; }
    for (const row of errors) write(`  ${String(row.count).padStart(4)}  ${row.error_code}\n`);
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
