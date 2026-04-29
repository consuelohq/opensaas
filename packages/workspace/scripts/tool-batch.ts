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

  let rawInput: string;
  if (args[0] === '--file') {
    if (!args[1] || args[1].startsWith('--')) {
      writeStderr('--file requires a path');
      process.exitCode = 1;
      return;
    }
    try {
      rawInput = fs.readFileSync(args[1], 'utf8');
    } catch (error: unknown) {
      writeStderr(error instanceof Error ? error.message : `unable to read batch file: ${args[1]}`);
      process.exitCode = 1;
      return;
    }
  } else {
    rawInput = args[0];
  }

  let steps: BatchStep[];
  try {
    steps = JSON.parse(rawInput) as BatchStep[];
  } catch (error: unknown) {
    writeStderr(error instanceof Error ? error.message : 'invalid JSON input');
    process.exitCode = 1;
    return;
  }

  if (!Array.isArray(steps)) {
    writeStderr('batch input must be a JSON array');
    process.exitCode = 1;
    return;
  }

  const invalidIndex = steps.findIndex((step) => {
    if (!step || typeof step !== 'object') return true;
    const maybeStep = step as Partial<BatchStep>;
    const hasInput = typeof maybeStep.input === 'object' && maybeStep.input !== null;
    const hasArgs = typeof maybeStep.args === 'object' && maybeStep.args !== null;
    return (
      typeof maybeStep.tool !== 'string' ||
      (!hasInput && !hasArgs) ||
      (maybeStep.parallel !== undefined && typeof maybeStep.parallel !== 'boolean')
    );
  });

  if (invalidIndex !== -1) {
    writeStderr(`batch step ${invalidIndex + 1} must include tool and input or args`);
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
