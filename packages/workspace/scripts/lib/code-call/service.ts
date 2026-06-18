import { Effect } from 'effect';

import { createToolResult, createTraceId, getErrorMessage } from '../facade/errors';
import { codeCallServiceError, isCodeCallServiceError, type CodeCallServiceError } from './errors';
import { resolveSafeCwdEffect, resolveSafeFileEffect } from './location';
import { truncateOutputEffect } from './output';
import { detectTransportMistakeEffect, validateEditDryRunEffect, validateEditScopeEffect, validateMutationPolicyEffect } from './policy';
import { runRuntimeEffect } from './process';
import { cleanupStagedSourceEffect, loadSourceEffect, stageSourceEffect, validateSourceInputsEffect } from './source';
import { elapsedMs, normalizeCodeCallInputEffect } from './schema';
import { captureSnapshotEffect, changedFiles } from './snapshot';
import type { CodeCallContext, CodeCallData, CodeCallInput, CodeCallLanguage, CodeCallMode, CodeCallMistakeClass, CodeCallResult } from './types';

function runtimeEnv(input: CodeCallInput, baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    ...(typeof input.branch === 'string' && input.branch ? { TASK_BRANCH: input.branch } : {}),
    ...(typeof input.taskWorktree === 'string' && input.taskWorktree ? { TASK_WORKTREE: input.taskWorktree } : {}),
  };
}

function buildData(input: {
  ok: boolean;
  exitCode: number;
  language: CodeCallLanguage;
  requestedLanguage?: string;
  runtime: string;
  mode: CodeCallMode;
  cwd: string;
  durationMs: number;
  stdout?: string;
  stderr?: string;
  filesChanged?: string[];
  truncated?: boolean;
  traceId: string;
  message?: string;
  code?: string;
  detectedMistakeClass?: CodeCallMistakeClass;
  stdoutLogPath?: string;
  stderrLogPath?: string;
}): CodeCallData {
  return {
    ok: input.ok,
    exitCode: input.exitCode,
    language: input.language,
    ...(input.requestedLanguage && input.requestedLanguage !== input.language ? { requestedLanguage: input.requestedLanguage } : {}),
    runtime: input.runtime,
    mode: input.mode,
    cwd: input.cwd,
    durationMs: input.durationMs,
    stdout: input.stdout || '',
    stderr: input.stderr || '',
    filesChanged: input.filesChanged || [],
    truncated: input.truncated || false,
    traceId: input.traceId,
    ...(input.message ? { message: input.message } : {}),
    ...(input.code ? { code: input.code } : {}),
    ...(input.detectedMistakeClass ? { detectedMistakeClass: input.detectedMistakeClass } : {}),
    ...(input.stdoutLogPath ? { stdoutLogPath: input.stdoutLogPath } : {}),
    ...(input.stderrLogPath ? { stderrLogPath: input.stderrLogPath } : {}),
  };
}

function failureResult(input: {
  error: CodeCallServiceError;
  language: CodeCallLanguage;
  requestedLanguage?: string;
  runtime: string;
  mode: CodeCallMode;
  cwd: string;
  startedAt: number;
  traceId: string;
  requestId?: string;
  now?: () => number;
}): CodeCallResult {
  const durationMs = elapsedMs(input.startedAt, input.now);
  const error = input.error;
  const language = error.language || input.language;
  const requestedLanguage = error.requestedLanguage || input.requestedLanguage;
  const runtime = error.runtime ?? input.runtime;
  const mode = error.mode || input.mode;
  const cwd = error.cwd ?? input.cwd;
  const exitCode = error.exitCode ?? 1;
  const stderr = error.stderr;

  return createToolResult({
    ok: false,
    code: error.envelopeCode,
    message: error.message,
    data: buildData({
      ok: false,
      exitCode,
      language,
      requestedLanguage,
      runtime,
      mode,
      cwd,
      durationMs,
      stdout: error.stdout,
      stderr,
      filesChanged: error.filesChanged,
      truncated: error.truncated,
      traceId: input.traceId,
      message: error.message,
      code: error.envelopeCode,
      detectedMistakeClass: error.detectedMistakeClass,
      stdoutLogPath: error.stdoutLogPath,
      stderrLogPath: error.stderrLogPath,
    }),
    stderr,
    exitCode,
    durationMs,
    traceId: input.traceId,
    requestId: input.requestId,
    now: input.now,
  });
}

function unexpectedError(cause: unknown): CodeCallServiceError {
  return codeCallServiceError({
    envelopeCode: 'COMMAND_FAILED',
    message: getErrorMessage(cause),
    detectedMistakeClass: 'invalid_source',
  });
}

export function executeCodeCallEffect(input: CodeCallInput, context: CodeCallContext = {}) {
  const startedAt = (context.now || Date.now)();
  const traceId = context.traceId || createTraceId(context.randomUUID);
  const requestId = input.requestId || context.requestId;
  const fallback = {
    language: 'python' as CodeCallLanguage,
    requestedLanguage: input.language,
    runtime: '',
    mode: input.mode,
    cwd: '',
  };

  const program = Effect.gen(function* () {
    const contextCwd = context.cwd || process.cwd();
    const normalized = yield* normalizeCodeCallInputEffect(input);
    fallback.language = normalized.language;
    fallback.requestedLanguage = normalized.requestedLanguage;
    fallback.runtime = normalized.provider.runtime;
    fallback.mode = normalized.mode;

    const cwdResolution = yield* resolveSafeCwdEffect(input, contextCwd);
    fallback.cwd = cwdResolution.cwd;

    if (normalized.mode === 'edit') {
      yield* validateEditScopeEffect(input, cwdResolution.cwd);
    }
    yield* validateEditDryRunEffect(input, cwdResolution.cwd);
    yield* validateSourceInputsEffect(input);

    const sourcePath = input.codeFile
      ? yield* resolveSafeFileEffect(input.codeFile, cwdResolution.cwd, cwdResolution.allowedRoots)
      : null;
    const stdinPath = input.stdinFile
      ? yield* resolveSafeFileEffect(input.stdinFile, cwdResolution.cwd, cwdResolution.allowedRoots)
      : null;
    const loaded = yield* loadSourceEffect(input, sourcePath, stdinPath);
    yield* detectTransportMistakeEffect(loaded.source, normalized.language, cwdResolution.cwd);

    const staged = yield* stageSourceEffect(loaded.source, normalized.provider, traceId);
    let keepStageDir = false;

    const execution = Effect.gen(function* () {
      const before = yield* captureSnapshotEffect(cwdResolution.cwd);
      const run = yield* runRuntimeEffect(normalized.provider.runtime, [staged.sourcePath], {
        cwd: cwdResolution.cwd,
        env: runtimeEnv(input, context.env || process.env),
        stdin: loaded.stdin,
        timeoutMs: normalized.timeoutMs,
      });
      const after = yield* captureSnapshotEffect(cwdResolution.cwd);
      const filesChanged = changedFiles(before, after);
      const output = yield* truncateOutputEffect(staged.stageDir, run.stdout, run.stderr, normalized.maxResultChars);
      keepStageDir = output.truncated;

      if (run.timedOut) {
        return yield* Effect.fail(codeCallServiceError({
          envelopeCode: 'TIMEOUT',
          message: 'code.call timed out after ' + String(normalized.timeoutMs) + 'ms',
          detectedMistakeClass: 'timeout',
          cwd: cwdResolution.cwd,
          exitCode: 1,
          stdout: output.stdout,
          stderr: output.stderr,
          filesChanged,
          truncated: output.truncated,
          stdoutLogPath: output.stdoutLogPath,
          stderrLogPath: output.stderrLogPath,
        }));
      }

      if (run.runtimeMissing) {
        return yield* Effect.fail(codeCallServiceError({
          envelopeCode: 'COMMAND_FAILED',
          message: 'runtime is missing: ' + normalized.provider.runtime,
          detectedMistakeClass: 'runtime_missing',
          cwd: cwdResolution.cwd,
          exitCode: 1,
          stdout: output.stdout,
          stderr: output.stderr,
          filesChanged,
          truncated: output.truncated,
          stdoutLogPath: output.stdoutLogPath,
          stderrLogPath: output.stderrLogPath,
        }));
      }

      yield* validateMutationPolicyEffect(normalized.mode, filesChanged, cwdResolution.cwd, output);

      const ok = run.exitCode === 0;
      const durationMs = elapsedMs(startedAt, context.now);
      return createToolResult({
        ok,
        code: ok ? 'OK' : 'COMMAND_FAILED',
        message: ok ? 'code.call completed' : 'code.call command failed',
        data: buildData({
          ok,
          exitCode: run.exitCode,
          language: normalized.language,
          requestedLanguage: normalized.requestedLanguage,
          runtime: normalized.provider.runtime,
          mode: normalized.mode,
          cwd: cwdResolution.cwd,
          durationMs,
          stdout: output.stdout,
          stderr: output.stderr,
          filesChanged,
          truncated: output.truncated,
          traceId,
          message: ok ? undefined : 'runtime exited non-zero',
          code: ok ? undefined : 'COMMAND_FAILED',
          stdoutLogPath: output.stdoutLogPath,
          stderrLogPath: output.stderrLogPath,
        }),
        stderr: output.stderr,
        exitCode: run.exitCode,
        durationMs,
        traceId,
        requestId,
        now: context.now,
      });
    });

    return yield* execution.pipe(Effect.ensuring(Effect.gen(function* () {
      yield* cleanupStagedSourceEffect(staged, keepStageDir);
    })));
  });

  return program.pipe(Effect.catchAll((cause) => Effect.succeed(failureResult({
    error: isCodeCallServiceError(cause) ? cause : unexpectedError(cause),
    language: fallback.language,
    requestedLanguage: fallback.requestedLanguage,
    runtime: fallback.runtime,
    mode: fallback.mode,
    cwd: fallback.cwd,
    startedAt,
    traceId,
    requestId,
    now: context.now,
  }))));
}

export async function executeCodeCall(input: CodeCallInput, context: CodeCallContext = {}): Promise<CodeCallResult> {
  return Effect.runPromise(executeCodeCallEffect(input, context));
}
