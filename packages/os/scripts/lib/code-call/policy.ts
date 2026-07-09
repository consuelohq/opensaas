import { Effect } from 'effect';

import { codeCallServiceError } from './errors';
import { isInsidePath, isManagedTaskWorktreePathEffect, realpathIfExistsEffect } from './location';
import type { TruncatedOutput } from './output';
import type { CodeCallInput, CodeCallLanguage, CodeCallMode } from './types';

const pythonShellTransportPattern = new RegExp('^python3?\\s+-c\\b');
const bunShellTransportPattern = new RegExp('^(node|bun)\\s+(-e|--eval)\\b');
const bashShellTransportPattern = new RegExp('^bash\\s+-lc\\b');
const heredocWrapperPattern = new RegExp('(python3?|node|bun)\\s+-[^\\n]*<<[\'\"]?[A-Z]');
const base64TransportPattern = new RegExp('base64\\s+(-d|--decode)|Buffer\\.from\\([^)]*base64|atob\\(', 's');
const unsafeBashPattern = new RegExp('rm\\s+-rf\\s+/|git\\s+reset\\s+--hard|curl\\s+[^|]+\\|\\s*(sh|bash)');

export const validateEditScopeEffect = (input: CodeCallInput, resolvedCwd: string) => Effect.gen(function* () {
  const explicitTaskWorktree = typeof input.taskWorktree === 'string' && input.taskWorktree.trim().length > 0
    ? input.taskWorktree
    : undefined;
  const managedTaskWorktree = explicitTaskWorktree
    ? undefined
    : (yield* isManagedTaskWorktreePathEffect(resolvedCwd))
      ? resolvedCwd
      : undefined;
  const taskWorktree = explicitTaskWorktree || managedTaskWorktree;

  if (!taskWorktree) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'mode=edit requires taskSession or an explicit taskWorktree.',
      detectedMistakeClass: 'edit_without_task',
      cwd: resolvedCwd,
    }));
  }

  const resolvedTaskWorktree = yield* realpathIfExistsEffect(taskWorktree);
  if (!isInsidePath(resolvedCwd, resolvedTaskWorktree)) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'mode=edit cwd must be inside the explicit taskWorktree.',
      detectedMistakeClass: 'edit_mode_gated',
      cwd: resolvedCwd,
    }));
  }

  const branch = typeof input.branch === 'string' ? input.branch : '';
  if (branch && !branch.startsWith('task/')) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'mode=edit refuses non-task branches. Pass a taskSession or task worktree for isolated edits.',
      detectedMistakeClass: 'edit_mode_gated',
      cwd: resolvedCwd,
    }));
  }
});

export const validateEditDryRunEffect = (input: CodeCallInput, resolvedCwd: string) => Effect.gen(function* () {
  if (input.mode === 'edit' && input.dryRun === true) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'mode=edit does not support dryRun. Use mode=verify for non-mutating validation.',
      detectedMistakeClass: 'edit_mode_gated',
      cwd: resolvedCwd,
    }));
  }
});

export const detectTransportMistakeEffect = (source: string, language: CodeCallLanguage, cwd: string) => Effect.gen(function* () {
  const trimmed = source.trim();
  if (pythonShellTransportPattern.test(trimmed)) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'Send raw multiline Python in code instead of wrapping it in python3 -c shell transport.',
      detectedMistakeClass: 'shell_escaped_code',
      cwd,
    }));
  }
  if (bunShellTransportPattern.test(trimmed)) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'Send raw JavaScript or TypeScript in code with language="bun" instead of node -e or bun -e shell transport.',
      detectedMistakeClass: 'shell_escaped_code',
      cwd,
    }));
  }
  if (bashShellTransportPattern.test(trimmed) || heredocWrapperPattern.test(trimmed)) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'Send the inner program through code, codeFile, stdin, or stdinFile instead of an execution heredoc wrapper.',
      detectedMistakeClass: 'shell_escaped_code',
      cwd,
    }));
  }
  if (base64TransportPattern.test(trimmed)) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'Send large payloads through codeFile or stdinFile instead of manual base64 transport.',
      detectedMistakeClass: 'shell_escaped_code',
      cwd,
    }));
  }
  if (language === 'bash' && unsafeBashPattern.test(trimmed)) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'Bash code.call blocks destructive shell patterns. Use a typed workspace tool or a narrower command.',
      detectedMistakeClass: 'unsafe_shell',
      cwd,
    }));
  }
});

export const validateMutationPolicyEffect = (mode: CodeCallMode, filesChanged: string[], cwd: string, output: TruncatedOutput) => Effect.gen(function* () {
  if (filesChanged.length > 0 && mode !== 'edit') {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'COMMAND_FAILED',
      message: mode + ' mode changed files; use an edit-capable task workflow for mutations.',
      detectedMistakeClass: 'mutation_in_read_mode',
      cwd,
      exitCode: 1,
      stdout: output.stdout,
      stderr: output.stderr,
      filesChanged,
      truncated: output.truncated,
      stdoutLogPath: output.stdoutLogPath,
      stderrLogPath: output.stderrLogPath,
    }));
  }
});
