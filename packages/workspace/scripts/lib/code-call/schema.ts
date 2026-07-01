import { Effect } from 'effect';

import { codeCallServiceError } from './errors';
import { normalizeLanguage, resolveRuntimeProviderEffect, type RuntimeProvider } from './runtimes';
import type { CodeCallInput, CodeCallLanguage, CodeCallMode } from './types';

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_RESULT_CHARS = 20_000;

export type NormalizedCodeCallInput = Omit<CodeCallInput, 'language'> & {
  language: CodeCallLanguage;
  requestedLanguage: string;
  mode: CodeCallMode;
  timeoutMs: number;
  maxResultChars: number;
  provider: RuntimeProvider;
};

export function elapsedMs(startedAt: number, now?: () => number): number {
  return Math.max(0, (now || Date.now)() - startedAt);
}

export const normalizeCodeCallInputEffect = (input: CodeCallInput) => Effect.gen(function* () {
  const requestedLanguage = input.language;
  const language = normalizeLanguage(requestedLanguage);
  const mode = input.mode;

  if (!language) {
    return yield* Effect.fail(codeCallServiceError({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'unsupported language: ' + requestedLanguage,
      detectedMistakeClass: 'unsupported_language',
      language: 'python',
      requestedLanguage,
      runtime: '',
      mode,
      cwd: '',
    }));
  }

  const provider = yield* resolveRuntimeProviderEffect(language);

  return {
    ...input,
    language,
    requestedLanguage,
    mode,
    timeoutMs: input.timeout ?? DEFAULT_TIMEOUT_MS,
    maxResultChars: input.maxResultChars ?? DEFAULT_MAX_RESULT_CHARS,
    provider,
  } satisfies NormalizedCodeCallInput;
});
