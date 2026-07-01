import { Effect } from 'effect';

import { codeCallServiceError } from './errors';
import { normalizeLanguage, resolveRuntimeProviderEffect, type RuntimeProvider } from './runtimes';
import type { CodeCallInput, CodeCallLanguage, CodeCallMode } from './types';

export const DEFAULT_TIMEOUT_MS = 180_000;
export const DEFAULT_MAX_RESULT_CHARS = 20_000;
const MIN_TIMEOUT_MS = 1;
const MAX_TIMEOUT_MS = 300_000;
const MIN_RESULT_CHARS = 1;
const MAX_RESULT_CHARS_LIMIT = 200_000;

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

function normalizePositiveBoundedNumber(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  const boundedValue = Math.floor(value);
  if (boundedValue < minimum || boundedValue > maximum) {
    return fallback;
  }
  return boundedValue;
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
    timeoutMs: normalizePositiveBoundedNumber(
      input.timeout,
      DEFAULT_TIMEOUT_MS,
      MIN_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    ),
    maxResultChars: normalizePositiveBoundedNumber(
      input.maxResultChars,
      DEFAULT_MAX_RESULT_CHARS,
      MIN_RESULT_CHARS,
      MAX_RESULT_CHARS_LIMIT,
    ),
    provider,
  } satisfies NormalizedCodeCallInput;
});
