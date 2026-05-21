#!/usr/bin/env bun

import { createToolResult } from './lib/facade/errors';
import { execute } from './lib/codemode/executor';
import { buildToolRegistry } from './lib/codemode/tools/index';

type CodeRunCliInput = { code: string; mode?: 'read' | 'edit' | 'verify'; timeout?: number; memoryLimit?: number; taskSession?: string; requestId?: string };

function parseInput(args: string[]): CodeRunCliInput | null {
  const filtered = args.filter((arg) => arg !== '--json');
  const [first, second, ...rest] = filtered;
  if (!first || first === '--help' || first === '-h') return null;
  if (first.trim().startsWith('{')) return JSON.parse(first) as CodeRunCliInput;
  const input: CodeRunCliInput = first.startsWith('tsk_') && second
    ? { taskSession: first, code: second }
    : { code: first };
  const flagArgs = first.startsWith('tsk_') && second ? rest : [second, ...rest].filter(Boolean) as string[];
  for (let index = 0; index < flagArgs.length; index += 1) {
    const arg = flagArgs[index];
    const next = flagArgs[index + 1];
    if (arg === '--mode' && (next === 'read' || next === 'edit' || next === 'verify')) {
      input.mode = next;
      index += 1;
    } else if (arg === '--timeout' && next) {
      input.timeout = Number(next);
      index += 1;
    } else if (arg === '--memory-limit' && next) {
      input.memoryLimit = Number(next);
      index += 1;
    } else if (arg === '--task-session' && next) {
      input.taskSession = next;
      index += 1;
    }
  }
  return input;
}

async function main(): Promise<void> {
  try {
    const input = parseInput(process.argv.slice(2));
    if (!input) {
      process.stdout.write('usage: code-run <json-input> OR code-run [taskSession] <code> [--mode read|edit|verify]\n');
      return;
    }
    const state = { operations: [], blockedTools: [], changedFiles: new Set<string>() };
  const tools = buildToolRegistry(process.cwd(), { taskSession: input.taskSession, mode: input.mode || 'read', state });
  const execution = await execute(input.code, tools, {
    timeout: input.timeout ?? 30000,
    memoryLimit: input.memoryLimit ?? 128,
    workingDirectory: process.cwd(),
  });
  const changedFiles = [...state.changedFiles];
  const operations = state.operations;
  const blockedTools = state.blockedTools;
  const ok = execution.success && operations.every((operation: { ok: boolean }) => operation.ok) && blockedTools.length === 0;
  const notes: string[] = [];
  const nextSteps: string[] = [];
  if (blockedTools.length > 0) nextSteps.push('Run blocked helpers as explicit workspace.call steps.');
  if (changedFiles.length > 0) nextSteps.push('Reread changed ranges and run targeted validation.');
  if (operations.some((operation: { ok: boolean }) => !operation.ok)) nextSteps.push('Inspect operations for trace IDs and messages.');
  if (nextSteps.length === 0) nextSteps.push('Use the result to choose the next step.');
  const result = createToolResult({
    ok,
    code: ok ? 'OK' : 'COMMAND_FAILED',
    message: ok ? 'code.run completed' : 'code.run completed with issues',
    data: { mode: input.mode || 'read', result: execution.result, console: execution.console, operations, blockedTools, notes, nextSteps, changedFiles },
    stderr: execution.success ? '' : JSON.stringify(execution.result),
    exitCode: ok ? 0 : 1,
    durationMs: execution.duration,
    requestId: input.requestId,
  });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 1;
  } catch (error: unknown) {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
