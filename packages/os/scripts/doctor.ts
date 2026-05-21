#!/usr/bin/env bun

import { runDoctor } from './lib/install-state';

function writeStdout(value: string): void {
  process.stdout.write(value);
}

function parseArgs(argv: string[]): { home?: string; json: boolean; quiet: boolean } {
  const options = { home: undefined as string | undefined, json: false, quiet: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--home') options.home = argv[++index];
    else if (arg === '--json') options.json = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--help') {
      writeStdout([
        'usage: bun ./scripts/doctor.ts [--home <path>]',
        '',
        'Options:',
        '  --home <path>  override OS home',
        '  --json         machine-readable output',
        '  --quiet        print only failures',
        '',
      ].join('\n'));
      process.exit(0);
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const result = await runDoctor(options.home);

  if (options.json) {
    writeStdout(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (!options.quiet) writeStdout(`Consuelo OS doctor: ${result.home}\n`);
  for (const check of result.checks) {
    if (options.quiet && check.status === 'connected') continue;
    writeStdout(`${check.status.padEnd(18)} ${check.name} - ${check.message}\n`);
  }

  if (!result.ok) process.exitCode = 1;
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
