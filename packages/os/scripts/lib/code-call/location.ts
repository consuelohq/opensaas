import { execFileSync } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Effect } from 'effect';

import { resolveConsueloHomeLayout } from '../consuelo-home';
import { causeMessage, codeCallServiceError } from './errors';
import type { CodeCallInput } from './types';

export type CodeCallAuthorityKind = 'task' | 'work';

export type ResolvedCwd = {
  cwd: string;
  allowedRoots: string[];
  authorityKind?: CodeCallAuthorityKind;
  writeBoundaryRoot?: string;
  containmentRequired: boolean;
};

export function isInsidePath(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function pathsOverlap(left: string, right: string): boolean {
  return isInsidePath(left, right) || isInsidePath(right, left);
}

export const realpathIfExistsEffect = (value: string) => Effect.try({
  try: () => realpathSync(value),
  catch: () => path.resolve(value),
}).pipe(Effect.catchAll((fallback) => Effect.succeed(fallback)));

function gitOutput(cwd: string, args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function canonicalGitPath(cwd: string, value: string): string {
  const absolute = path.isAbsolute(value) ? value : path.resolve(cwd, value);
  try {
    return realpathSync(absolute);
  } catch {
    return path.resolve(absolute);
  }
}

function gitRoot(cwd: string): string | null {
  const value = gitOutput(cwd, ['rev-parse', '--show-toplevel']);
  return value ? canonicalGitPath(cwd, value) : null;
}

function gitCommonDir(cwd: string): string | null {
  const value = gitOutput(cwd, ['rev-parse', '--git-common-dir']);
  return value ? canonicalGitPath(cwd, value) : null;
}

function gitBranch(cwd: string): string | null {
  const value = gitOutput(cwd, ['branch', '--show-current']);
  return value || null;
}

function gitWorktreePaths(cwd: string): string[] {
  const output = gitOutput(cwd, ['worktree', 'list', '--porcelain']);
  if (!output) return [];
  const roots: string[] = [];
  for (const line of output.split('\n')) {
    if (!line.startsWith('worktree ')) continue;
    const root = canonicalGitPath(cwd, line.slice('worktree '.length));
    if (!roots.includes(root)) roots.push(root);
  }
  return roots;
}

export const findGitRootEffect = (cwd: string) => Effect.succeed(gitRoot(cwd));

const uniqueRealRootsEffect = (values: Array<string | undefined | null>) => Effect.gen(function* () {
  const present = values.filter((value): value is string => typeof value === 'string' && value.length > 0);
  const resolved = yield* Effect.forEach(present, (value) => realpathIfExistsEffect(value));
  const roots: string[] = [];
  for (const value of resolved) {
    if (!roots.includes(value)) roots.push(value);
  }
  return roots;
});

const failUnsafeTaskWorktree = (taskWorktree: string, reason: string) => codeCallServiceError({
  envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
  message: 'taskWorktree is not a managed task worktree: ' + taskWorktree + ': ' + reason,
  detectedMistakeClass: 'cwd_out_of_scope',
});

const resolveManagedTaskWorktreeEffect = (
  taskWorktree: string | undefined,
  contextCwd: string,
  expectedBranch: string | undefined,
) => Effect.gen(function* () {
  if (!taskWorktree) return null;

  const resolved = yield* realpathIfExistsEffect(taskWorktree);
  const stats = yield* Effect.try({
    try: () => statSync(resolved),
    catch: (cause) => failUnsafeTaskWorktree(taskWorktree, causeMessage(cause)),
  });
  if (!stats.isDirectory()) {
    return yield* Effect.fail(failUnsafeTaskWorktree(taskWorktree, 'not a directory'));
  }

  const candidateRoot = gitRoot(resolved);
  const contextRoot = gitRoot(contextCwd);
  const candidateCommonDir = gitCommonDir(resolved);
  const contextCommonDir = gitCommonDir(contextCwd);
  const branch = gitBranch(resolved);
  const registeredWorktrees = gitWorktreePaths(contextCwd);

  if (!candidateRoot || candidateRoot !== resolved) {
    return yield* Effect.fail(failUnsafeTaskWorktree(taskWorktree, 'path is not a git worktree root'));
  }
  if (!contextRoot || !candidateCommonDir || !contextCommonDir || candidateCommonDir !== contextCommonDir) {
    return yield* Effect.fail(failUnsafeTaskWorktree(taskWorktree, 'git common directory does not match the active Consuelo repository'));
  }
  if (candidateRoot === contextRoot || !registeredWorktrees.includes(candidateRoot)) {
    return yield* Effect.fail(failUnsafeTaskWorktree(taskWorktree, 'path is not a linked worktree of the active Consuelo repository'));
  }
  if (!branch || !branch.startsWith('task/')) {
    return yield* Effect.fail(failUnsafeTaskWorktree(taskWorktree, 'linked worktree is not on a task/* branch'));
  }
  if (expectedBranch && branch !== expectedBranch) {
    return yield* Effect.fail(failUnsafeTaskWorktree(taskWorktree, 'linked worktree branch does not match input.branch'));
  }

  return resolved;
});

const failUnsafeWorkSessionRoot = (root: string, reason: string) => codeCallServiceError({
  envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
  message: 'workSession cannot edit this path because it overlaps a managed Consuelo repository or runtime: '
    + root
    + '. '
    + reason
    + ' Use a taskSession for managed repository edits.',
  detectedMistakeClass: 'work_session_protected_root',
});

const resolveWorkSessionRootEffect = (
  input: CodeCallInput,
  contextCwd: string,
  env: NodeJS.ProcessEnv,
) => Effect.gen(function* () {
  if (!input.workSession) return null;
  if (!input.workSessionRoot) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'workSession could not be resolved to a local path on this node.',
      detectedMistakeClass: 'cwd_out_of_scope',
    }));
  }

  const resolved = yield* realpathIfExistsEffect(input.workSessionRoot);
  const stats = yield* Effect.try({
    try: () => statSync(resolved),
    catch: (cause) => codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'workSession path is unavailable: ' + causeMessage(cause),
      detectedMistakeClass: 'cwd_out_of_scope',
    }),
  });
  if (!stats.isDirectory()) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'workSession path is not a directory: ' + resolved,
      detectedMistakeClass: 'cwd_out_of_scope',
    }));
  }

  const protectedRoots = gitWorktreePaths(contextCwd);
  const consueloHome = yield* realpathIfExistsEffect(resolveConsueloHomeLayout(env.CONSUELO_HOME).home);
  protectedRoots.push(consueloHome);
  const overlap = protectedRoots.find((protectedRoot) => pathsOverlap(resolved, protectedRoot));
  if (overlap) {
    return yield* Effect.fail(failUnsafeWorkSessionRoot(
      resolved,
      'The work-session root overlaps protected path ' + overlap + '.',
    ));
  }

  return resolved;
});

export const resolveSafeCwdEffect = (
  input: CodeCallInput,
  contextCwd: string,
  env: NodeJS.ProcessEnv = process.env,
) => Effect.gen(function* () {
  if (input.taskWorktree && input.workSessionRoot) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'Code Call may use taskSession or workSession authority, but not both.',
      detectedMistakeClass: 'edit_mode_gated',
    }));
  }

  const taskWorktree = yield* resolveManagedTaskWorktreeEffect(
    input.taskWorktree,
    contextCwd,
    typeof input.branch === 'string' ? input.branch : undefined,
  );
  const workSessionRoot = yield* resolveWorkSessionRootEffect(input, contextCwd, env);
  const writeBoundaryRoot = taskWorktree || workSessionRoot || undefined;
  const authorityKind: CodeCallAuthorityKind | undefined = taskWorktree
    ? 'task'
    : workSessionRoot
      ? 'work'
      : undefined;
  const defaultCwd = writeBoundaryRoot || path.resolve(contextCwd);
  const requested = input.cwd
    ? path.resolve(path.isAbsolute(input.cwd) ? input.cwd : path.join(defaultCwd, input.cwd))
    : defaultCwd;

  const stats = yield* Effect.try({
    try: () => statSync(requested),
    catch: (cause) => codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'cwd does not exist: ' + (input.cwd || requested) + ': ' + causeMessage(cause),
      detectedMistakeClass: 'cwd_out_of_scope',
    }),
  });
  if (!stats.isDirectory()) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'cwd is not a directory: ' + (input.cwd || requested),
      detectedMistakeClass: 'cwd_out_of_scope',
    }));
  }

  const resolvedCwd = yield* realpathIfExistsEffect(requested);
  if (writeBoundaryRoot && !isInsidePath(resolvedCwd, writeBoundaryRoot)) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'cwd is outside the active session root: ' + (input.cwd || requested),
      detectedMistakeClass: 'cwd_out_of_scope',
      cwd: resolvedCwd,
    }));
  }

  const gitRootPath = writeBoundaryRoot ? null : gitRoot(defaultCwd);
  const roots = yield* uniqueRealRootsEffect(writeBoundaryRoot
    ? [writeBoundaryRoot, tmpdir()]
    : [defaultCwd, gitRootPath, tmpdir()]);

  if (!roots.some((root) => isInsidePath(resolvedCwd, root))) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'cwd is outside approved workspace and temp roots: ' + (input.cwd || requested),
      detectedMistakeClass: 'cwd_out_of_scope',
    }));
  }

  return {
    cwd: resolvedCwd,
    allowedRoots: roots,
    ...(authorityKind ? { authorityKind } : {}),
    ...(writeBoundaryRoot ? { writeBoundaryRoot } : {}),
    containmentRequired: authorityKind === 'work',
  } satisfies ResolvedCwd;
});

export const resolveSafeFileEffect = (filePath: string, cwd: string, allowedRoots: string[]) => Effect.gen(function* () {
  const candidate = path.resolve(path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath));
  const resolved = yield* realpathIfExistsEffect(candidate);

  if (!allowedRoots.some((root) => isInsidePath(resolved, root))) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'file is outside approved workspace and temp roots: ' + filePath,
      detectedMistakeClass: 'cwd_out_of_scope',
      cwd,
    }));
  }

  const stats = yield* Effect.try({
    try: () => statSync(resolved),
    catch: () => codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'file does not exist: ' + filePath,
      detectedMistakeClass: 'invalid_source',
      cwd,
    }),
  });

  if (!stats.isFile()) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'file must be a regular file: ' + filePath,
      detectedMistakeClass: 'invalid_source',
      cwd,
    }));
  }

  return resolved;
});
