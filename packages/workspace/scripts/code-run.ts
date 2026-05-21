#!/usr/bin/env bun

import { existsSync, readFileSync } from 'node:fs';
import { createToolResult } from './lib/facade/errors';
import { execute } from './lib/codemode/executor';
import { buildToolRegistry } from './lib/codemode/tools/index';

type CodeRunMode = 'read' | 'edit' | 'verify';
type CodeRunCliInput = {
  code: string;
  mode?: CodeRunMode;
  timeout?: number;
  memoryLimit?: number;
  maxOperations?: number;
  maxResultChars?: number;
  inputFile?: string;
  taskSession?: string;
  requestId?: string;
};

const DEFAULT_MAX_RESULT_CHARS = 200_000;

function isMode(value: string | undefined): value is CodeRunMode {
  return value === 'read' || value === 'edit' || value === 'verify';
}

function printHelp(): void {
  process.stdout.write('usage: code-run <json-input> OR code-run [taskSession] <code> [--mode read|edit|verify] [--input-file path] [--stdin]\n');
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseFlagArgs(input: CodeRunCliInput, args: string[]): void {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === '--json') continue;
    if (arg === '--mode' && isMode(next)) {
      input.mode = next;
      index += 1;
    } else if (arg === '--timeout') {
      input.timeout = parseNumber(next);
      index += 1;
    } else if (arg === '--memory-limit') {
      input.memoryLimit = parseNumber(next);
      index += 1;
    } else if (arg === '--max-operations') {
      input.maxOperations = parseNumber(next);
      index += 1;
    } else if (arg === '--max-result-chars') {
      input.maxResultChars = parseNumber(next);
      index += 1;
    } else if (arg === '--input-file' && next) {
      input.inputFile = next;
      index += 1;
    } else if (arg === '--task-session' && next) {
      input.taskSession = next;
      index += 1;
    }
  }
}

function readStdin(): string {
  return readFileSync(0, 'utf8').trim();
}

async function parseInput(args: string[]): Promise<CodeRunCliInput | null> {
  const filtered = args.filter((arg) => arg !== '--json');
  const inputFileIndex = filtered.indexOf('--input-file');
  if (inputFileIndex >= 0 && filtered[inputFileIndex + 1]) {
    const fromFile = JSON.parse(readFileSync(filtered[inputFileIndex + 1], 'utf8')) as CodeRunCliInput;
    parseFlagArgs(fromFile, filtered);
    return fromFile;
  }
  if (filtered.includes('--stdin')) {
    const fromStdin = JSON.parse(readStdin()) as CodeRunCliInput;
    parseFlagArgs(fromStdin, filtered);
    return fromStdin;
  }
  const [first, second, ...rest] = filtered;
  if (!first || first === '--help' || first === '-h') return null;
  if (first.trim().startsWith('{')) return JSON.parse(first) as CodeRunCliInput;
  if (existsSync(first)) {
    const fromExistingFile = JSON.parse(readFileSync(first, 'utf8')) as CodeRunCliInput;
    parseFlagArgs(fromExistingFile, [second, ...rest].filter(Boolean) as string[]);
    return fromExistingFile;
  }
  const input: CodeRunCliInput = first.startsWith('tsk_') && second
    ? { taskSession: first, code: second }
    : { code: first };
  const flagArgs = first.startsWith('tsk_') && second ? rest : [second, ...rest].filter(Boolean) as string[];
  parseFlagArgs(input, flagArgs);
  return input;
}

function truncateValue(value: unknown, maxChars: number): { value: unknown; truncated: boolean } {
  const serialized = JSON.stringify(value);
  if (!serialized || serialized.length <= maxChars) return { value, truncated: false };
  return {
    value: {
      truncated: true,
      message: `code.run result exceeded maxResultChars=${maxChars}`,
      preview: serialized.slice(0, maxChars),
    },
    truncated: true,
  };
}

function truncateConsole(consoleOutput: { log: string[]; warn: string[]; error: string[] }, maxChars: number): { log: string[]; warn: string[]; error: string[]; truncated: boolean } {
  const next = { log: [...consoleOutput.log], warn: [...consoleOutput.warn], error: [...consoleOutput.error], truncated: false };
  for (const key of ['log', 'warn', 'error'] as const) {
    let total = 0;
    next[key] = next[key].filter((line) => {
      total += line.length;
      if (total <= maxChars) return true;
      next.truncated = true;
      return false;
    });
  }
  return next;
}

async function main(): Promise<void> {
  try {
    const input = await parseInput(process.argv.slice(2));
    if (!input) {
      printHelp();
      return;
    }
    const state = { operations: [], blockedTools: [], changedFiles: new Set<string>() };
    const tools = buildToolRegistry(process.cwd(), { taskSession: input.taskSession, mode: input.mode || 'read', state });
    const maxResultChars = input.maxResultChars ?? DEFAULT_MAX_RESULT_CHARS;
    const execution = await execute(input.code, tools, {
      timeout: input.timeout ?? 30_000,
      memoryLimit: input.memoryLimit ?? 128,
      workingDirectory: process.cwd(),
      maxOperations: input.maxOperations ?? 100,
    });
    const changedFiles = [...state.changedFiles];
    const operations = state.operations;
    const blockedTools = state.blockedTools;
    const resultValue = truncateValue(execution.result, maxResultChars);
    const consoleValue = truncateConsole(execution.console, Math.floor(maxResultChars / 4));
    const ok = execution.success && operations.every((operation: { ok: boolean }) => operation.ok) && blockedTools.length === 0;
    const notes: string[] = [];
    const nextSteps: string[] = [];
    if (resultValue.truncated || consoleValue.truncated) notes.push('code.run output was truncated; return a smaller object or raise maxResultChars intentionally.');
    if (blockedTools.length > 0) nextSteps.push('Run blocked helpers as explicit workspace.call steps.');
    if (changedFiles.length > 0) nextSteps.push('Reread changed ranges and run targeted validation.');
    if (operations.some((operation: { ok: boolean }) => !operation.ok)) nextSteps.push('Inspect operations for trace IDs and messages.');
    if (nextSteps.length === 0) nextSteps.push('Use the result to choose the next step.');
    const result = createToolResult({
      ok,
      code: ok ? 'OK' : 'COMMAND_FAILED',
      message: ok ? 'code.run completed' : 'code.run completed with issues',
      data: {
        mode: input.mode || 'read',
        result: resultValue.value,
        console: consoleValue,
        operations,
        blockedTools,
        notes,
        nextSteps,
        changedFiles,
        operationCount: execution.operations,
      },
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
