#!/usr/bin/env bun

import { executeTool } from './lib/facade/executor';
import type { ToolInput } from './lib/facade/types';

function printHelp(): void {
  process.stdout.write([
    'usage: bun run worker -- call --provider <cdx|pi|opc|mini> --instruction-path <path> [options]',
    '',
    'runs the same worker.call runtime exposed through the workspace facade.',
    '',
    'options:',
    '  --provider <id>           cdx, pi, opc, or legacy mini',
    '  --profile <name>          provider profile, for example mini for pi',
    '  --mode <check|step|work>  worker mode',
    '  --policy <read|safe|edit|ship>',
    '  --instruction-path <path> instruction file path',
    '  --cwd <path>              working directory',
    '  --task-session <id>       task session for edit/ship policies',
    '  --timeout-ms <ms>         timeout in milliseconds',
    '  --workspace-only <value>  preferred, strict, true, or false',
    '',
    'examples:',
    '  bun run worker -- call --provider pi --profile mini --policy safe --instruction-path .task/foo/step.md',
    '  bun run worker -- call --provider cdx --policy edit --task-session tsk_123 --instruction-path .task/foo/work.md',
    '',
  ].join('\n'));
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function parseWorkspaceOnly(value: string | undefined): boolean | 'preferred' | 'strict' | undefined {
  if (value == null) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'preferred' || value === 'strict') return value;
  throw new Error(`invalid --workspace-only value: ${value}`);
}

function requireOption(value: string | undefined, name: string): string {
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }
  if (command !== 'call') throw new Error(`unknown worker command: ${command}`);

  const timeoutRaw = readOption(args, '--timeout-ms');
  const input: ToolInput = {
    provider: requireOption(readOption(args, '--provider'), '--provider'),
    ...(readOption(args, '--profile') ? { profile: readOption(args, '--profile') } : {}),
    ...(readOption(args, '--mode') ? { mode: readOption(args, '--mode') } : {}),
    ...(readOption(args, '--policy') ? { policy: readOption(args, '--policy') } : {}),
    instructionPath: requireOption(readOption(args, '--instruction-path'), '--instruction-path'),
    ...(readOption(args, '--cwd') ? { cwd: readOption(args, '--cwd') } : {}),
    ...(readOption(args, '--task-session') ? { taskSession: readOption(args, '--task-session') } : {}),
    ...(timeoutRaw ? { timeoutMs: Number(timeoutRaw) } : {}),
    ...(parseWorkspaceOnly(readOption(args, '--workspace-only')) !== undefined ? { workspaceOnly: parseWorkspaceOnly(readOption(args, '--workspace-only')) } : {}),
  };

  const result = await executeTool('worker.call', input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = result.exitCode || 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
