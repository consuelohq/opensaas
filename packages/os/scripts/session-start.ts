#!/usr/bin/env bun

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveConsueloHomeLayout } from './lib/consuelo-home';
import { createWorkSession, type WorkSessionMetadata } from './lib/work-session';
import { findProtectedProspectiveWorkSessionRoot } from './lib/work-session-protection';
import { resolveActiveWorkspaceProjectCwd } from './lib/workspace-project-cwd';

type SessionKind = 'task' | 'work';

export type ParsedArgs = {
  kind?: SessionKind;
  path?: string;
  json: boolean;
  forwarded: string[];
};

export function parseArgs(argv: string[]): ParsedArgs {
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

function writeResult(value: unknown, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function slugifyWorkSessionTitle(title: string | undefined): string {
  const slug = (title ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return slug || 'work';
}

function workSessionRecoveryMessage(protectedKind: 'consuelo-home' | 'managed-repository', protectedPath: string): string {
  if (protectedKind === 'consuelo-home') {
    return 'Work sessions cannot edit Consuelo-managed state. Choose a narrower ordinary directory, or omit path to create an isolated work directory automatically.';
  }
  return `Work sessions cannot edit the managed repository or its task worktrees (${protectedPath}). Use a taskSession for repository edits, choose a narrower ordinary directory, or omit path to create an isolated work directory automatically.`;
}

export function startWorkSession(input: {
  home?: string;
  userHome?: string;
  path?: string;
  title?: string;
  now?: () => Date;
  randomUUID?: () => string;
  managedRepoRoot?: string;
}): WorkSessionMetadata {
  let uuid: string | undefined;
  const nextUuid = (): string => {
    uuid ??= (input.randomUUID ?? randomUUID)();
    return uuid;
  };
  const userHome = path.resolve(input.userHome ?? process.env.HOME ?? os.homedir());
  const requestedPath = input.path?.trim()
    ? path.resolve(input.path)
    : path.join(
      userHome,
      'Library',
      'Application Support',
      'Consuelo Work Sessions',
      `${slugifyWorkSessionTitle(input.title)}-${nextUuid().replace(/-/gu, '').slice(0, 8)}`,
    );

  const layout = resolveConsueloHomeLayout(input.home);
  const protectedRoot = findProtectedProspectiveWorkSessionRoot({
    root: requestedPath,
    consueloHome: layout.home,
    managedRepoRoot: input.managedRepoRoot,
  });
  if (protectedRoot) {
    throw new Error(workSessionRecoveryMessage(protectedRoot.kind, protectedRoot.path));
  }

  fs.mkdirSync(requestedPath, { recursive: true, mode: 0o700 });
  return createWorkSession({
    home: input.home,
    path: requestedPath,
    now: input.now,
    randomUUID: nextUuid,
    managedRepoRoot: input.managedRepoRoot,
  });
}

export function parseWorkOptions(forwarded: string[]): { title?: string } {
  let title: string | undefined;
  for (let index = 0; index < forwarded.length; index += 1) {
    const argument = forwarded[index];
    if (argument === '--json') continue;
    if (argument === '--title') {
      const value = forwarded[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--title requires a value');
      title = value;
      index += 1;
      continue;
    }
    throw new Error('work sessions accept only --kind, --path, --title, and --json');
  }
  return title ? { title } : {};
}

export async function startTaskSession(
  args: ParsedArgs,
  cwd = resolveActiveWorkspaceProjectCwd() ?? process.cwd(),
): Promise<void> {
  try {
    const taskStart = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'task-start.js');
    const child = Bun.spawn([process.execPath, taskStart, ...args.forwarded], {
      cwd,
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
      env: process.env,
    });
    const exitCode = await child.exited;
    if (exitCode !== 0) {
      throw new Error(`task-start exited with code ${exitCode}`);
    }
  } catch (error: unknown) {
    throw new Error(
      `task session start failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.kind === 'task') {
    if (args.path) throw new Error('--path is only valid for work sessions');
    await startTaskSession(args);
    return;
  }
  const workOptions = parseWorkOptions(args.forwarded);
  const metadata = startWorkSession({
    path: args.path,
    title: workOptions.title,
    managedRepoRoot: resolveActiveWorkspaceProjectCwd() ?? process.cwd(),
  });
  writeResult({
    sessionKind: 'work',
    workSession: metadata.workSession,
    ownerNodeId: metadata.ownerNodeId,
    path: metadata.path,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  }, args.json);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
