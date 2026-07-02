#!/usr/bin/env bun
import path from 'node:path';

import {
  buildProcessTelemetryPacket,
  pruneProcessTelemetry,
  renderProcessTelemetryPacket,
  sampleAndStoreProcessTelemetry,
} from './lib/process-telemetry';

type Args = {
  command: 'once' | 'monitor' | 'report' | 'packet';
  db?: string;
  home?: string;
  since?: string;
  limit?: number;
  json: boolean;
  includeAll: boolean;
  intervalSeconds: number;
  retentionDays: number;
};

function write(value: string): void {
  process.stdout.write(value);
}

function usage(): string {
  return [
    'usage:',
    '  bun ./scripts/process-health.ts once [--json] [--include-all] [--db <path>]',
    '  bun ./scripts/process-health.ts monitor [--interval-seconds 10] [--retention-days 7] [--include-all] [--db <path>]',
    '  bun ./scripts/process-health.ts report [--since 1h] [--limit 30] [--json] [--db <path>]',
    '  bun ./scripts/process-health.ts packet [--since 1h] [--limit 30] [--json] [--db <path>]',
    '',
  ].join('\n');
}

function parseArgs(argv: string[]): Args {
  const [rawCommand = 'report', ...rest] = argv;
  const command = rawCommand === 'once' || rawCommand === 'monitor' || rawCommand === 'report' || rawCommand === 'packet' ? rawCommand : 'report';
  const args: Args = { command, json: false, includeAll: false, intervalSeconds: 10, retentionDays: 7 };
  const remaining = rawCommand === command ? rest : argv;
  for (let index = 0; index < remaining.length; index += 1) {
    const arg = remaining[index];
    const next = (): string => remaining[++index] ?? '';
    if (arg === '--db') args.db = path.resolve(next());
    else if (arg.startsWith('--db=')) args.db = path.resolve(arg.slice(5));
    else if (arg === '--home') args.home = next();
    else if (arg.startsWith('--home=')) args.home = arg.slice(7);
    else if (arg === '--since') args.since = next();
    else if (arg.startsWith('--since=')) args.since = arg.slice(8);
    else if (arg === '--limit') args.limit = Number(next());
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice(8));
    else if (arg === '--json') args.json = true;
    else if (arg === '--include-all') args.includeAll = true;
    else if (arg === '--interval-seconds') args.intervalSeconds = Number(next());
    else if (arg.startsWith('--interval-seconds=')) args.intervalSeconds = Number(arg.slice(19));
    else if (arg === '--retention-days') args.retentionDays = Number(next());
    else if (arg.startsWith('--retention-days=')) args.retentionDays = Number(arg.slice(17));
    else if (arg === '--help') {
      write(usage());
      process.exit(0);
    } else throw new Error(`unknown option: ${arg}`);
  }
  if (!Number.isFinite(args.intervalSeconds) || args.intervalSeconds < 1) args.intervalSeconds = 10;
  if (!Number.isFinite(args.retentionDays) || args.retentionDays < 1) args.retentionDays = 7;
  if (args.home && !args.db) args.db = path.join(path.resolve(args.home.replace(/^~(?=$|\/)/, process.env.HOME ?? '')), 'consuelo.db');
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === 'monitor') {
    let running = true;
    process.on('SIGINT', () => { running = false; });
    process.on('SIGTERM', () => { running = false; });
    if (!args.json) write(`OS process health monitor started: interval=${args.intervalSeconds}s retention=${args.retentionDays}d\n`);
    while (running) {
      const result = sampleAndStoreProcessTelemetry({ dbPath: args.db, includeAll: args.includeAll });
      const pruned = pruneProcessTelemetry({ dbPath: args.db, retentionMs: args.retentionDays * 24 * 60 * 60 * 1000 });
      if (args.json) write(`${JSON.stringify({ ok: true, stored: result.stored, sampled: result.samples.length, pruned, ts: new Date().toISOString() })}\n`);
      await Bun.sleep(args.intervalSeconds * 1000);
    }
    return;
  }

  if (args.command === 'once') {
    const result = sampleAndStoreProcessTelemetry({ dbPath: args.db, includeAll: args.includeAll });
    if (args.json) write(`${JSON.stringify({ ok: true, stored: result.stored, sampled: result.samples.length }, null, 2)}\n`);
    else write(`stored ${result.stored} process telemetry samples\n`);
    return;
  }
  const packet = buildProcessTelemetryPacket({ dbPath: args.db, since: args.since, limit: args.limit });
  if (args.json || args.command === 'packet') write(`${JSON.stringify(packet, null, 2)}\n`);
  else write(renderProcessTelemetryPacket(packet));
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
