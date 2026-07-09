#!/usr/bin/env bun

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));

function writeStdout(value: string): void {
  process.stdout.write(value);
}

function printHelp(): void {
  writeStdout([
    'usage: workspace <tool.name> [json-input]',
    '       workspace batch <json-array>',
    '',
    'examples:',
    '  workspace status',
    '  workspace stream.context \'{"area":"workspace-agents"}\'',
    '  workspace fs.read \'{"path":"AGENTS.md"}\'',
    '',
  ].join('\n'));
}

function runBunScript(scriptName: string, args: string[]): Promise<number> {
  const proc = Bun.spawn(['bun', path.join(scriptsDir, scriptName), ...args], {
    stdout: 'inherit',
    stderr: 'inherit',
  });

  return proc.exited;
}

function writeError(error: unknown): void {
  process.stderr.write(error instanceof Error ? error.stack || error.message : String(error));
  process.stderr.write('\n');
}

async function main(): Promise<void> {
  const [toolName, rawInput, ...extra] = process.argv.slice(2);
  if (!toolName || toolName === '--help' || toolName === '-h') {
    printHelp();
    return;
  }

  if (extra.length > 0) {
    process.stderr.write('workspace commands accept at most one JSON input argument\n');
    process.exitCode = 1;
    return;
  }

  try {
    if (toolName === 'batch') {
      process.exitCode = await runBunScript('tool-batch.ts', rawInput ? [rawInput] : ['[]']);
      return;
    }

    process.exitCode = await runBunScript('tool-runner.ts', rawInput ? [toolName, rawInput] : [toolName]);
  } catch (error: unknown) {
    writeError(error);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  writeError(error);
  process.exit(1);
});
