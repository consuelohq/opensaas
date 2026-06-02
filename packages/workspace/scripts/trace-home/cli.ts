import { existsSync } from 'node:fs';
import { loadRows, resolveTraceDb } from './db';
import { buildTraceHomeModel } from './model';
import { renderTraceHome } from './text-renderer';
import { runTraceHomeTui } from './tui/app';

export type TraceHomeArgs = {
  db?: string;
  limit: number;
  interval: number;
  once: boolean;
  color: boolean;
  help: boolean;
  selectedTraceId?: string;
  rawJson: boolean;
};

const usage = `Trace homebase dashboard.\n\nUsage:\n  bun run trace:home [options]\n\nOptions:\n  --db <path>      Trace DB path.\n  --limit <n>      Number of latest rows to load. Default: 80.\n  --interval <ms>  Live refresh interval. Default: 1000.\n  --trace-id <id>  Select a trace id.\n  --once           Render once and exit.\n  --raw-json       Show raw selected-row JSON.\n  --no-color       Disable ANSI color.\n  --help           Show help.\n\nKeys: q quit · ctrl+c quit · r refresh · space pause/resume · up/down or j/k select · / search · f failed-only · b branch · t tool · g group · c copy id · ? help`;

export function parseArgs(argv: string[]): TraceHomeArgs {
  const args: TraceHomeArgs = {
    limit: 80,
    interval: 1000,
    once: false,
    color: process.stdout.isTTY,
    help: false,
    rawJson: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index] || '';
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--once') args.once = true;
    else if (arg === '--raw-json') args.rawJson = true;
    else if (arg === '--no-color') args.color = false;
    else if (arg === '--db') args.db = next();
    else if (arg.startsWith('--db=')) args.db = arg.slice(5);
    else if (arg === '--limit') args.limit = Number(next());
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice(8));
    else if (arg === '--interval') args.interval = Number(next());
    else if (arg.startsWith('--interval=')) args.interval = Number(arg.slice(11));
    else if (arg === '--trace-id') args.selectedTraceId = next();
    else if (arg.startsWith('--trace-id=')) args.selectedTraceId = arg.slice(11);
    else throw new Error(`unknown option: ${arg}`);
  }

  if (!Number.isFinite(args.limit) || args.limit <= 0) args.limit = 80;
  if (!Number.isFinite(args.interval) || args.interval < 250) args.interval = 1000;
  return args;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(`${usage}\n`);
    return;
  }

  const db = resolveTraceDb(args.db);
  if (!existsSync(db)) throw new Error(`trace database not found: ${db}`);

  if (args.once || !process.stdout.isTTY) {
    const rows = loadRows(db, args.limit);
    const model = buildTraceHomeModel(rows, {
      selectedTraceId: args.selectedTraceId,
      live: false,
      rawJson: args.rawJson,
    });
    process.stdout.write(renderTraceHome(model, { color: args.color }) + "\n");
    return;
  }

  try {
    await runTraceHomeTui({
      db,
      limit: args.limit,
      interval: args.interval,
      color: args.color,
      selectedTraceId: args.selectedTraceId,
      rawJson: args.rawJson,
    });
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}

export { buildTraceHomeModel } from './model';
export { renderTraceHome } from './text-renderer';
export { resolveTraceDb, loadRows } from './db';
export { classifyTaskCallCommand, classifyTaskExecCommand, classifyTaskCommand } from './command-quality';
export type { TraceHomeRow, TraceHomeModel } from './types';
