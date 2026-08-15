#!/usr/bin/env bun

import path from 'node:path';

import { createWorkSession } from '../../os/scripts/lib/work-session';

type SessionKind = 'task' | 'work';

type ParsedArgs = {
  kind?: SessionKind;
  path?: string;
  json: boolean;
  forwarded: string[];
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { json: false, forwarded: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') {
      parsed.json = true;
      parsed.forwarded.push(argument);
      continue;
    }
    if (argument === '--kind') {
      const value = argv[index + 1];
      if (value !== 'task' && value !== 'work') throw new Error('--kind must be task or work');
      parsed.kind = value;
      index += 1;
      continue;
    }
    if (argument === '--path') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--path requires a value');
      parsed.path = value;
      index += 1;
      continue;
    }
    parsed.forwarded.push(argument);
  }
  if (!parsed.kind) throw new Error('--kind is required');
  return parsed;
}

async function startTaskSession(args: ParsedArgs): Promise<void> {
  try {
    const taskStart = path.resolve(import.meta.dir, 'task-start.js');
    const child = Bun.spawn([process.execPath, taskStart, ...args.forwarded], {
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
      env: process.env,
    });
    const exitCode = await child.exited;
    if (exitCode !== 0) throw new Error(`task-start exited with code ${exitCode}`);
  } catch (error: unknown) {
    throw new Error(
      `task session start failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.kind === 'task') {
    if (args.path) throw new Error('--path is only valid for work sessions');
    await startTaskSession(args);
    return;
  }
  if (!args.path) throw new Error('--path is required for work sessions');
  if (args.forwarded.some((argument) => argument !== '--json')) {
    throw new Error('work sessions accept only --kind, --path, and --json');
  }
  const metadata = createWorkSession({ path: args.path });
  const result = {
    sessionKind: 'work',
    workSession: metadata.workSession,
    ownerNodeId: metadata.ownerNodeId,
    path: metadata.path,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
