import { execFileSync } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Effect } from 'effect';

import { causeMessage, codeCallServiceError } from './errors';
import type { CodeCallInput } from './types';

export type ResolvedCwd = {
  cwd: string;
  allowedRoots: string[];
};

export function isInsidePath(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export const realpathIfExistsEffect = (value: string) => Effect.try({
  try: () => realpathSync(value),
  catch: () => path.resolve(value),
}).pipe(Effect.catchAll((fallback) => Effect.succeed(fallback)));

export const findGitRootEffect = (cwd: string) => Effect.try({
  try: () => execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim(),
  catch: () => null,
}).pipe(Effect.catchAll(() => Effect.succeed(null)));

const uniqueRealRootsEffect = (values: Array<string | undefined | null>) => Effect.gen(function* () {
  const present = values.filter((value): value is string => typeof value === 'string' && value.length > 0);
  const resolved = yield* Effect.forEach(present, (value) => realpathIfExistsEffect(value));
  const roots: string[] = [];
  for (const value of resolved) {
    if (!roots.includes(value)) roots.push(value);
  }
  return roots;
});

export const resolveSafeCwdEffect = (input: CodeCallInput, contextCwd: string) => Effect.gen(function* () {
  const defaultCwd = path.resolve(input.taskWorktree || contextCwd);
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
  const gitRoot = yield* findGitRootEffect(defaultCwd);
  const roots = yield* uniqueRealRootsEffect([
    defaultCwd,
    input.taskWorktree,
    gitRoot,
    tmpdir(),
  ]);

  if (!roots.some((root) => isInsidePath(resolvedCwd, root))) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'cwd is outside approved workspace and temp roots: ' + (input.cwd || requested),
      detectedMistakeClass: 'cwd_out_of_scope',
    }));
  }

  return { cwd: resolvedCwd, allowedRoots: roots } satisfies ResolvedCwd;
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

export const isManagedTaskWorktreePathEffect = (candidate: string) => Effect.gen(function* () {
  const resolved = yield* realpathIfExistsEffect(candidate);
  const worktreeRoot = path.basename(path.dirname(resolved));
  const worktreeName = path.basename(resolved);
  return worktreeRoot === 'opensaas-worktrees' && worktreeName.startsWith('task-');
});
