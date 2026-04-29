#!/usr/bin/env bun

import { executeTool } from './lib/facade/executor';
import type { ToolInput } from './lib/facade/types';

function writeStdout(value: string): void {
  process.stdout.write(value);
}

function writeStderr(value: string): void {
  process.stderr.write(`${value}\n`);
}

function printHelp(): void {
  writeStdout([
    'usage: bun packages/workspace/scripts/tool-runner.ts <tool.name> <json-input>',
    '',
    'runs one typed workspace tool and prints one JSON envelope to stdout.',
    '',
    'examples:',
    '  bun packages/workspace/scripts/tool-runner.ts fs.read \'{"path":"packages/workspace/package.json"}\'',
    '  bun packages/workspace/scripts/tool-runner.ts context.categories \'{}\'',
    '',
  ].join('\n'));
}

async function main(): Promise<void> {
  const [toolName, rawInput] = process.argv.slice(2);
  if (!toolName || toolName === '--help' || toolName === '-h') {
    printHelp();
    return;
  }

  let input: ToolInput;
  try {
    input = rawInput ? JSON.parse(rawInput) as ToolInput : {};
  } catch (error: unknown) {
    writeStderr(error instanceof Error ? error.message : 'invalid JSON input');
    process.exitCode = 1;
    return;
  }

  const result = await executeTool(toolName, input);
  writeStdout(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = result.exitCode || 1;
}

main().catch((error: unknown) => {
  writeStderr(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
