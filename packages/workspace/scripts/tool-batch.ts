#!/usr/bin/env bun

import fs from 'node:fs';

import { runBatch } from './lib/facade/batch';
import type { BatchStep } from './lib/facade/types';

function writeStdout(value: string): void {
  process.stdout.write(value);
}

function writeStderr(value: string): void {
  process.stderr.write(`${value}\n`);
}

function printHelp(): void {
  writeStdout([
    'usage: bun packages/workspace/scripts/tool-batch.ts <json-array>',
    '       bun packages/workspace/scripts/tool-batch.ts --file /tmp/batch.json',
    '',
    'runs typed workspace tools in a sequential batch.',
    '',
  ].join('\n'));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const rawInput = args[0] === '--file'
    ? fs.readFileSync(args[1], 'utf8')
    : args[0];

  let steps: BatchStep[];
  try {
    steps = JSON.parse(rawInput) as BatchStep[];
  } catch (error: unknown) {
    writeStderr(error instanceof Error ? error.message : 'invalid JSON input');
    process.exitCode = 1;
    return;
  }

  const result = await runBatch(steps);
  writeStdout(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = result.exitCode || 1;
}

main().catch((error: unknown) => {
  writeStderr(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
