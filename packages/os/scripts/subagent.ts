#!/usr/bin/env bun

import { executeTool } from './lib/facade/executor';
import type { ToolInput } from './lib/facade/types';

export function subagentCliHelpText(): string {
  return [
    'usage: bun run subagent -- [--action <run|start|status|wait|logs|cancel>] [options]',
    '',
    'runs the subagent runtime exposed through the workspace facade.',
    '',
    'options:',
    '  --action <id>                run, start, status, wait, logs, or cancel (default: run)',
    '  --run-id <id>                durable run identity for attachment actions',
    '  --request-id <id>            idempotency key for run/start retries',
    '  --provider <id>              codex, pi, opencode, or grok',
    '  --model <name>               provider model override',
    '  --reasoning-effort <level>   provider-specific reasoning level',
    '  --bundle <core|media>         steering bundle (default: core; media replaces core)',
    '  --policy <read|edit>          permission policy (default: read)',
    '  --instruction-path <path>     tmp instruction file path',
    '  --cwd <path>                 working directory',
    '  --task-session <id>          existing task session (optional for self-bootstrap edit)',
    '  --timeout-ms <ms>            timeout in milliseconds',
    '  --wait-ms <ms>               bounded wait duration for wait attachments',
    '  --output-format <text|json>  requested output format',
    '  --workspace-only <value>     preferred, strict, true, or false',
    '',
    'attachment actions status/wait/logs attach to an existing run and never spawn.',
    '',
    'examples:',
    '  bun run subagent -- --provider grok --bundle media --output-format json --instruction-path .task/example/ko-social.md',
    '  bun run subagent -- --provider codex --policy edit --task-session tsk_123 --instruction-path .task/foo/work.md',
    '',
  ].join('\n');
}

function printHelp(): void {
  process.stdout.write(subagentCliHelpText());
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

export function parseSubagentCliInput(args: string[]): ToolInput {
  const timeoutRaw = readOption(args, '--timeout-ms');
  const action = readOption(args, '--action') || 'run';
  const provider = readOption(args, '--provider');
  const instructionPath = readOption(args, '--instruction-path');
  const waitRaw = readOption(args, '--wait-ms');
  const workspaceOnly = parseWorkspaceOnly(readOption(args, '--workspace-only'));
  const input: ToolInput = {
    action,
    ...(provider ? { provider } : {}),
    ...(instructionPath ? { instructionPath } : {}),
    ...(readOption(args, '--run-id') ? { runId: readOption(args, '--run-id') } : {}),
    ...(readOption(args, '--request-id') ? { requestId: readOption(args, '--request-id') } : {}),
    ...(readOption(args, '--model') ? { model: readOption(args, '--model') } : {}),
    ...(readOption(args, '--reasoning-effort') ? { reasoningEffort: readOption(args, '--reasoning-effort') } : {}),
    ...(readOption(args, '--bundle') ? { bundle: readOption(args, '--bundle') } : {}),
    ...(readOption(args, '--policy') ? { policy: readOption(args, '--policy') } : {}),
    ...(readOption(args, '--cwd') ? { cwd: readOption(args, '--cwd') } : {}),
    ...(readOption(args, '--task-session') ? { taskSession: readOption(args, '--task-session') } : {}),
    ...(timeoutRaw ? { timeoutMs: Number(timeoutRaw) } : {}),
    ...(waitRaw ? { waitMs: Number(waitRaw) } : {}),
    ...(readOption(args, '--output-format') ? { outputFormat: readOption(args, '--output-format') } : {}),
    ...(workspaceOnly !== undefined ? { workspaceOnly } : {}),
  };

  if (action === 'run' || action === 'start') {
    input.provider = requireOption(provider, '--provider');
    input.instructionPath = requireOption(instructionPath, '--instruction-path');
  }

  return input;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }
  if (args[0] === 'call') throw new Error('subagent has no call subcommand; pass flags directly after --');

  const input = parseSubagentCliInput(args);
  const result = await executeTool('subagent', input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = result.exitCode || 1;
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exit(1);
  });
}
