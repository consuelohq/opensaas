#!/usr/bin/env bun

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { executeCodeCall } from './lib/code-call/runtime';
import type { CodeCallInput, CodeCallMode } from './lib/code-call/types';

type JsonRecord = Record<string, unknown>;

type CliFailure = {
  now: string;
  ok: false;
  code: 'VALIDATION_ERROR';
  message: string;
  data: null;
  stderr: string;
  exitCode: 1;
  durationMs: 0;
  traceId: 'trc_code_call_cli';
  apiVersion: '1.0.0';
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function optionalNumber(record: JsonRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function optionalBoolean(record: JsonRecord, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function isCodeCallMode(value: unknown): value is CodeCallMode {
  return value === 'read' || value === 'edit' || value === 'verify';
}

function fail(message: string): never {
  const result: CliFailure = {
    now: new Date().toISOString(),
    ok: false,
    code: 'VALIDATION_ERROR',
    message,
    data: null,
    stderr: message,
    exitCode: 1,
    durationMs: 0,
    traceId: 'trc_code_call_cli',
    apiVersion: '1.0.0',
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(1);
}

function parseJsonSource(source: string, label: string): unknown {
  try {
    return JSON.parse(source) as unknown;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`failed to parse JSON from ${label}: ${message}`);
  }
}

function toCodeCallInput(value: unknown): CodeCallInput {
  if (!isRecord(value)) fail('input must be a JSON object');

  const language = optionalString(value, 'language');
  if (!language) fail('language is required');

  const mode = value.mode;
  if (!isCodeCallMode(mode)) fail('mode must be "read", "edit", or "verify"');

  return {
    language,
    mode,
    ...(optionalString(value, 'code') !== undefined ? { code: optionalString(value, 'code') } : {}),
    ...(optionalString(value, 'codeFile') !== undefined ? { codeFile: optionalString(value, 'codeFile') } : {}),
    ...(optionalString(value, 'stdin') !== undefined ? { stdin: optionalString(value, 'stdin') } : {}),
    ...(optionalString(value, 'stdinFile') !== undefined ? { stdinFile: optionalString(value, 'stdinFile') } : {}),
    ...(optionalString(value, 'cwd') !== undefined ? { cwd: optionalString(value, 'cwd') } : {}),
    ...(optionalNumber(value, 'timeout') !== undefined ? { timeout: optionalNumber(value, 'timeout') } : {}),
    ...(optionalNumber(value, 'maxResultChars') !== undefined ? { maxResultChars: optionalNumber(value, 'maxResultChars') } : {}),
    ...(optionalBoolean(value, 'dryRun') !== undefined ? { dryRun: optionalBoolean(value, 'dryRun') } : {}),
    ...(optionalString(value, 'requestId') !== undefined ? { requestId: optionalString(value, 'requestId') } : {}),
    ...(optionalString(value, 'taskSession') !== undefined ? { taskSession: optionalString(value, 'taskSession') } : {}),
    ...(optionalString(value, 'taskWorktree') !== undefined ? { taskWorktree: optionalString(value, 'taskWorktree') } : {}),
    ...(optionalString(value, 'branch') !== undefined ? { branch: optionalString(value, 'branch') } : {}),
  };
}

function readStdin(): string {
  return readFileSync(0, 'utf8');
}

function usage(): string {
  return [
    'usage: bun run code-call -- --input-file /tmp/input.json',
    '       bun run code-call -- --stdin',
    '       bun run code-call -- \'{"language":"python","mode":"read","code":"print(1)"}\'',
  ].join('\n');
}

function parseArgs(argv: string[]): CodeCallInput {
  const args = argv.filter((arg) => arg !== '--json');
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`${usage()}\n`);
    process.exit(0);
  }

  const inputFileIndex = args.indexOf('--input-file');
  if (inputFileIndex !== -1) {
    const inputFile = args[inputFileIndex + 1];
    if (!inputFile) fail('--input-file requires a path');
    return toCodeCallInput(parseJsonSource(readFileSync(inputFile, 'utf8'), inputFile));
  }

  if (args.includes('--stdin')) {
    return toCodeCallInput(parseJsonSource(readStdin(), 'stdin'));
  }

  const sourceArg = args.find((arg) => !arg.startsWith('--'));
  if (!sourceArg) fail(`missing code.call input\n${usage()}`);

  const source = sourceArg.trimStart().startsWith('{')
    ? sourceArg
    : readFileSync(path.resolve(sourceArg), 'utf8');
  const label = existsSync(path.resolve(sourceArg)) ? sourceArg : 'argument';

  return toCodeCallInput(parseJsonSource(source, label));
}

async function main(): Promise<void> {
  const input = parseArgs(Bun.argv.slice(2));
  const result = await executeCodeCall(input, { cwd: process.cwd() });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exit(result.exitCode || 1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});
