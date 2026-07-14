import { Effect } from 'effect';

import { buildStreamContextEffect, printStreamContext } from './context-runtime';
import { createStreamFromCliEffect } from './create-runtime';
import { buildStreamListEffect, printStreamList } from './list-runtime';

function parse(argv: string[], booleans: Set<string>) {
  const values: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const [flag, inline] = argv[index].split('=', 2);
    if (!flag.startsWith('--')) throw new Error(`unexpected argument: ${flag}`);
    if (booleans.has(flag)) {
      values[flag.slice(2)] = inline === undefined ? true : inline !== 'false';
      continue;
    }
    const value = inline ?? argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
    values[flag.slice(2)] = value;
  }
  return values;
}

function fail(error: unknown): never {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

export async function runStreamContextCli(): Promise<void> {
  try {
    const args = parse(process.argv.slice(2), new Set(['--json', '--help']));
    if (args.help) {
      process.stdout.write('usage: bun run stream:context -- --area <area> [--stream <branch>] [--repo <owner/name>] [--json]\n');
      return;
    }
    if (typeof args.area !== 'string') throw new Error('missing required --area');
    const result = await Effect.runPromise(buildStreamContextEffect({
      area: args.area,
      stream: typeof args.stream === 'string' ? args.stream : undefined,
      repo: typeof args.repo === 'string' ? args.repo : undefined,
    }));
    printStreamContext(result, Boolean(args.json));
  } catch (error: unknown) {
    fail(error);
  }
}

export async function runStreamListCli(): Promise<void> {
  try {
    const args = parse(process.argv.slice(2), new Set(['--json', '--help', '--all']));
    if (args.help) {
      process.stdout.write('usage: bun run stream:list -- [--area <area>] [--repo <owner/name>] [--all] [--json]\n');
      return;
    }
    const result = await Effect.runPromise(buildStreamListEffect({
      area: typeof args.area === 'string' ? args.area : undefined,
      repo: typeof args.repo === 'string' ? args.repo : undefined,
      all: Boolean(args.all),
    }));
    printStreamList(result, Boolean(args.json), Boolean(args.all));
  } catch (error: unknown) {
    fail(error);
  }
}

export async function runStreamCreateCli(): Promise<void> {
  try {
    const args = parse(process.argv.slice(2), new Set(['--json', '--help']));
    if (args.help) {
      process.stdout.write('usage: bun run stream:create -- --area <area> [--from <branch>] [--repo <owner/name>] [--json]\n');
      process.stdout.write('Creates a new stream branch and seeds its optional AGENTS.md instructions.\n');
      return;
    }
    if (typeof args.area !== 'string') throw new Error('missing required --area');
    const result = await Effect.runPromise(createStreamFromCliEffect({
      area: args.area,
      sourceBranch: typeof args.from === 'string' ? args.from : undefined,
      repo: typeof args.repo === 'string' ? args.repo : undefined,
    }));
    if (args.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else {
      process.stdout.write(`created ${result.stream} from ${result.sourceBranch}\n`);
      process.stdout.write(`instructions: ${result.instructionPaths.join(', ')}\n`);
      process.stdout.write(`local tracking branch: ${result.localTrackingCreated ? 'created' : 'already existed'}\n`);
    }
  } catch (error: unknown) {
    fail(error);
  }
}
