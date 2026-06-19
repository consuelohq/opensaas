import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Effect } from 'effect';

import { causeMessage, codeCallServiceError } from './errors';
import { readCodeCallTextFileEffect } from './file-source-guard';
import type { RuntimeProvider } from './runtimes';
import type { CodeCallInput, CodeCallLanguage } from './types';

export type LoadedSource = {
  source: string;
  stdin?: string;
};

export type StagedSource = {
  stageDir: string;
  sourcePath: string;
};

export const validateSourceInputsEffect = (input: CodeCallInput) => Effect.gen(function* () {
  const hasCode = typeof input.code === 'string' && input.code.length > 0;
  const hasCodeFile = typeof input.codeFile === 'string' && input.codeFile.length > 0;
  if (hasCode === hasCodeFile) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'provide exactly one of code or codeFile',
      detectedMistakeClass: 'invalid_source',
    }));
  }

  const hasStdin = typeof input.stdin === 'string';
  const hasStdinFile = typeof input.stdinFile === 'string' && input.stdinFile.length > 0;
  if (hasStdin && hasStdinFile) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'provide at most one of stdin or stdinFile',
      detectedMistakeClass: 'invalid_source',
    }));
  }
});

export const loadSourceEffect = (input: CodeCallInput, sourcePath: string | null, stdinPath: string | null) => Effect.gen(function* () {
  const source = typeof input.code === 'string'
    ? input.code
    : yield* readCodeCallTextFileEffect(String(sourcePath), 'codeFile');
  const stdin = typeof input.stdin === 'string'
    ? input.stdin
    : stdinPath
      ? yield* readCodeCallTextFileEffect(stdinPath, 'stdinFile')
      : undefined;

  return { source, ...(stdin === undefined ? {} : { stdin }) } satisfies LoadedSource;
});

function sourceWithPrelude(source: string, language: CodeCallLanguage): string {
  if (language === 'bash' && !source.trimStart().startsWith('set ')) {
    return 'set -euo pipefail\n' + source;
  }
  return source;
}

export const stageSourceEffect = (source: string, provider: RuntimeProvider, traceId: string) => Effect.gen(function* () {
  const stageRoot = path.join(tmpdir(), 'opensaas-code-call');
  yield* Effect.try({
    try: () => mkdirSync(stageRoot, { recursive: true }),
    catch: (cause) => codeCallServiceError({
      envelopeCode: 'COMMAND_FAILED',
      message: 'failed to create code.call stage root: ' + causeMessage(cause),
      detectedMistakeClass: 'invalid_source',
    }),
  });

  const stageDir = yield* Effect.try({
    try: () => mkdtempSync(path.join(stageRoot, traceId + '-')),
    catch: (cause) => codeCallServiceError({
      envelopeCode: 'COMMAND_FAILED',
      message: 'failed to create code.call stage dir: ' + causeMessage(cause),
      detectedMistakeClass: 'invalid_source',
    }),
  });
  const sourcePath = path.join(stageDir, 'program.' + provider.sourceExtension);

  yield* Effect.try({
    try: () => writeFileSync(sourcePath, sourceWithPrelude(source, provider.language), 'utf8'),
    catch: (cause) => codeCallServiceError({
      envelopeCode: 'COMMAND_FAILED',
      message: 'failed to stage code.call source: ' + causeMessage(cause),
      detectedMistakeClass: 'invalid_source',
    }),
  });

  return { stageDir, sourcePath } satisfies StagedSource;
});

export const cleanupStagedSourceEffect = (staged: StagedSource, keepStageDir: boolean) => {
  if (keepStageDir) return Effect.void;
  return Effect.try({
    try: () => rmSync(staged.stageDir, { recursive: true, force: true }),
    catch: () => undefined,
  }).pipe(Effect.catchAll(() => Effect.void));
};
