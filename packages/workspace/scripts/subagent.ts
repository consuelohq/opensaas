#!/usr/bin/env bun

import { executeTool } from './lib/facade/executor';
import type { ToolInput } from './lib/facade/types';

function printHelp(): void {
  process.stdout.write([
    'usage: bun run subagent -- --provider <codex|pi|opencode|grok> --instruction-path <path> [options]',
    '',
    'runs the subagent runtime exposed through the workspace facade.',
    '',
    'options:',
    '  --provider <id>              codex, pi, opencode, or grok',
    '  --model <name>               provider model override',
    '  --bundle <core|media>         steering bundle (default: core; media replaces core)',
    '  --policy <read|edit>          permission policy (default: read)',
    '  --instruction-path <path>     tmp instruction file path',
    '  --cwd <path>                 working directory',
    '  --task-session <id>          required for edit policy',
    '  --timeout-ms <ms>            timeout in milliseconds',
    '  --output-format <text|json>  requested output format',
    '  --workspace-only <value>     preferred, strict, true, or false',
    '',
    'examples:',
    '  bun run subagent -- --provider grok --bundle media --output-format json --instruction-path /tmp/ko-social.md',
    '  bun run subagent -- --provider codex --policy edit --task-session tsk_123 --instruction-path .task/foo/work.md',
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
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }
  if (args[0] === 'call') throw new Error('subagent has no call subcommand; pass flags directly after --');

  const timeoutRaw = readOption(args, '--timeout-ms');
  const workspaceOnly = parseWorkspaceOnly(readOption(args, '--workspace-only'));
  const input: ToolInput = {
    provider: requireOption(readOption(args, '--provider'), '--provider'),
    ...(readOption(args, '--model') ? { model: readOption(args, '--model') } : {}),
    ...(readOption(args, '--bundle') ? { bundle: readOption(args, '--bundle') } : {}),
    ...(readOption(args, '--policy') ? { policy: readOption(args, '--policy') } : {}),
    instructionPath: requireOption(readOption(args, '--instruction-path'), '--instruction-path'),
    ...(readOption(args, '--cwd') ? { cwd: readOption(args, '--cwd') } : {}),
    ...(readOption(args, '--task-session') ? { taskSession: readOption(args, '--task-session') } : {}),
    ...(timeoutRaw ? { timeoutMs: Number(timeoutRaw) } : {}),
    ...(readOption(args, '--output-format') ? { outputFormat: readOption(args, '--output-format') } : {}),
    ...(workspaceOnly !== undefined ? { workspaceOnly } : {}),
  };

  const result = await executeTool('subagent', input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = result.exitCode || 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
