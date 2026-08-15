import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  loadNodeYamlConfig,
  resolveConsueloHomeLayout,
} from './consuelo-home';
import { readWorkSession, type WorkSessionMetadata } from './work-session';

export type WorkSessionFsScopeErrorCode =
  | 'WORK_SESSION_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR';

export class WorkSessionFsScopeError extends Error {
  readonly code: WorkSessionFsScopeErrorCode;

  constructor(code: WorkSessionFsScopeErrorCode, message: string) {
    super(message);
    this.name = 'WorkSessionFsScopeError';
    this.code = code;
  }
}

export type WorkSessionFsScope = {
  workSession: string;
  root: string;
  metadata: WorkSessionMetadata;
};

function canonicalExistingPath(candidate: string): string {
  return fs.realpathSync(path.resolve(candidate));
}

function containsPath(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function pathsOverlap(first: string, second: string): boolean {
  return containsPath(first, second) || containsPath(second, first);
}

function worktreeRoots(managedRepoRoot: string): string[] {
  try {
    const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: managedRepoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split('\n')
      .filter((line) => line.startsWith('worktree '))
      .map((line) => line.slice('worktree '.length).trim())
      .filter(Boolean)
      .map((candidate) => {
        try {
          return canonicalExistingPath(candidate);
        } catch {
          return path.resolve(candidate);
        }
      });
  } catch {
    return [];
  }
}

function resolveSessionHome(env: NodeJS.ProcessEnv): string | undefined {
  return env.CONSUELO_HOME
    || env.WORKSPACE_DAEMON_CONSUELO_HOME
    || env.CONSUELO_OS_HOME;
}

export function resolveWorkSessionFsScope(input: {
  workSession: string;
  env?: NodeJS.ProcessEnv;
  managedRepoRoot?: string;
}): WorkSessionFsScope {
  const env = input.env ?? process.env;
  const home = resolveSessionHome(env);
  let metadata: WorkSessionMetadata | undefined;
  try {
    metadata = readWorkSession({ home, workSession: input.workSession });
  } catch (error: unknown) {
    throw new WorkSessionFsScopeError(
      'VALIDATION_ERROR',
      `Invalid work session metadata: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!metadata) {
    throw new WorkSessionFsScopeError(
      'WORK_SESSION_NOT_FOUND',
      `Work session not found on this node: ${input.workSession}. Start or resume the work session on its owning node.`,
    );
  }

  const layout = resolveConsueloHomeLayout(home);
  let nodeId: string;
  try {
    nodeId = loadNodeYamlConfig(layout.nodeConfigPath).node.id;
  } catch (error: unknown) {
    throw new WorkSessionFsScopeError(
      'VALIDATION_ERROR',
      `Cannot validate work session owner: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (metadata.ownerNodeId !== nodeId) {
    throw new WorkSessionFsScopeError(
      'PERMISSION_DENIED',
      `Work session ${input.workSession} belongs to another node. Route the request through its owning node.`,
    );
  }

  let root: string;
  try {
    root = canonicalExistingPath(metadata.path);
  } catch {
    throw new WorkSessionFsScopeError(
      'WORK_SESSION_NOT_FOUND',
      `Work session path is no longer available: ${metadata.path}.`,
    );
  }
  if (!fs.statSync(root).isDirectory()) {
    throw new WorkSessionFsScopeError(
      'VALIDATION_ERROR',
      `Work session path is not a directory: ${metadata.path}.`,
    );
  }
  if (path.resolve(metadata.path) !== root) {
    throw new WorkSessionFsScopeError(
      'PERMISSION_DENIED',
      `Work session path changed after the session was created: ${metadata.path}. Start a new work session for the current path.`,
    );
  }

  const consueloHome = fs.existsSync(layout.home)
    ? canonicalExistingPath(layout.home)
    : path.resolve(layout.home);
  if (pathsOverlap(root, consueloHome)) {
    throw new WorkSessionFsScopeError(
      'PERMISSION_DENIED',
      'Work sessions cannot edit Consuelo-managed state. Use the typed Consuelo lifecycle/configuration tools instead.',
    );
  }

  const managedRepoRoot = input.managedRepoRoot?.trim();
  if (managedRepoRoot) {
    let canonicalManagedRoot: string | null = null;
    try {
      canonicalManagedRoot = canonicalExistingPath(managedRepoRoot);
    } catch {
      canonicalManagedRoot = null;
    }
    if (canonicalManagedRoot) {
      const protectedRoots = worktreeRoots(canonicalManagedRoot);
      if (protectedRoots.length === 0) protectedRoots.push(canonicalManagedRoot);
      const protectedRoot = protectedRoots.find((candidate) => pathsOverlap(root, candidate));
      if (protectedRoot) {
        throw new WorkSessionFsScopeError(
          'PERMISSION_DENIED',
          `Work sessions cannot edit the managed repository or its task worktrees (${protectedRoot}). Use taskSession for repository edits.`,
        );
      }
    }
  }

  return {
    workSession: metadata.workSession,
    root,
    metadata,
  };
}
