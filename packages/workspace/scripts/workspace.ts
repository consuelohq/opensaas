#!/usr/bin/env bun

import manifestJson from '../tooling/tool-manifest.json';
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


type ToolManifestEntry = {
  name: string;
  description: string;
  category: string;
  underlying: string;
  command: { script: string; subcommand?: string; internal?: string };
  sessionRequired?: boolean;
};

const manifestEntries = manifestJson as ToolManifestEntry[];

function printToolHelp(toolName: string): boolean {
  const family = toolName.split('.')[0] || toolName;
  const matches = manifestEntries.filter((entry) => entry.name === toolName || entry.name.startsWith(`${toolName}.`) || entry.name.startsWith(`${family}.`) || entry.command.script === toolName || entry.command.script === family);
  if (matches.length === 0) return false;

  writeStdout([
    `workspace ${toolName} --help`,
    '',
    "Use get_steering's tool manifest as the canonical tool list. This help output is a recovery aid for command syntax.",
    '',
    'matching tools:',
    ...matches.slice(0, 20).map((entry) => `  ${entry.name} - ${entry.description}`),
    matches.length > 20 ? `  ...and ${matches.length - 20} more` : '',
    '',
    'examples:',
    ...matches.slice(0, 3).map((entry) => `  workspace ${entry.name} '<json-input>'`),
    '',
  ].filter(Boolean).join('\n'));
  return true;
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

  if (rawInput === '--help' || rawInput === '-h') {
    if (!printToolHelp(toolName)) {
      printHelp();
    }
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
