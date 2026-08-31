#!/usr/bin/env bun

import { publishDailySchedule, type DailyScheduleFormat } from './lib/daily-schedules-publisher';
import { DAILY_SCHEDULE_KINDS, type DailyScheduleKind } from './lib/daily-schedules';

type Args = {
  kind?: DailyScheduleKind;
  sourceFile?: string;
  content?: string;
  format?: DailyScheduleFormat;
  date?: string;
  title?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = () => argv[++index];
    if (value === '--kind') args.kind = next() as DailyScheduleKind;
    else if (value === '--source-file') args.sourceFile = next();
    else if (value === '--content') args.content = next();
    else if (value === '--format') args.format = next() as DailyScheduleFormat;
    else if (value === '--date') args.date = next();
    else if (value === '--title') args.title = next();
    else throw new Error(`unknown daily-schedules option: ${value}`);
  }
  return args;
}

function main(): void {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.kind || !DAILY_SCHEDULE_KINDS.includes(args.kind)) {
      throw new Error(`--kind is required and must be one of: ${DAILY_SCHEDULE_KINDS.join(', ')}`);
    }
    if (Boolean(args.sourceFile) === (args.content !== undefined)) {
      throw new Error('provide exactly one of --source-file or --content');
    }
    const result = publishDailySchedule({
      kind: args.kind,
      ...(args.sourceFile ? { sourceFile: args.sourceFile } : {}),
      ...(args.content !== undefined ? { content: args.content } : {}),
      ...(args.format ? { format: args.format } : {}),
      ...(args.date ? { date: args.date } : {}),
      ...(args.title ? { title: args.title } : {}),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${JSON.stringify({
      ok: false,
      error: { code: 'DAILY_SCHEDULE_PUBLISH_FAILED', message },
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

main();
