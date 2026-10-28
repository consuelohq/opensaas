import fs from 'node:fs';
import path from 'node:path';

import {
  loadNodeYamlConfig,
  resolveConsueloHomeLayout,
} from './consuelo-home';
import { readWorkSession, type WorkSessionMetadata } from './work-session';
import { canonicalExistingPath, findProtectedWorkSessionRoot } from './work-session-protection';

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

  const protectedRoot = findProtectedWorkSessionRoot({
    root,
    consueloHome: layout.home,
    managedRepoRoot: input.managedRepoRoot,
  });
  if (protectedRoot?.kind === 'consuelo-home') {
    throw new WorkSessionFsScopeError(
      'PERMISSION_DENIED',
      'Work sessions cannot edit Consuelo-managed state. Use the typed Consuelo lifecycle/configuration tools instead.',
    );
  }
  if (protectedRoot?.kind === 'managed-repository') {
    throw new WorkSessionFsScopeError(
      'PERMISSION_DENIED',
      `Work sessions cannot edit the managed repository or its task worktrees (${protectedRoot.path}). Use a taskSession for repository edits.`,
    );
  }

  return {
    workSession: metadata.workSession,
    root,
    metadata,
  };
}
