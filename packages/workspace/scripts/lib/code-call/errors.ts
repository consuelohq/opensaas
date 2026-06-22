import type { CodeCallLanguage, CodeCallMistakeClass, CodeCallMode } from './types';

export type CodeCallEnvelopeCode = 'CODE_CALL_VALIDATION_ERROR' | 'COMMAND_FAILED' | 'TIMEOUT';

export type CodeCallServiceError = {
  _tag: 'CodeCallServiceError';
  envelopeCode: CodeCallEnvelopeCode;
  message: string;
  detectedMistakeClass: CodeCallMistakeClass;
  language?: CodeCallLanguage;
  requestedLanguage?: string;
  runtime?: string;
  mode?: CodeCallMode;
  cwd?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  filesChanged?: string[];
  truncated?: boolean;
  stdoutLogPath?: string;
  stderrLogPath?: string;
};

export function codeCallServiceError(input: Omit<CodeCallServiceError, '_tag'>): CodeCallServiceError {
  return { _tag: 'CodeCallServiceError', ...input };
}

export function isCodeCallServiceError(value: unknown): value is CodeCallServiceError {
  return typeof value === 'object'
    && value !== null
    && '_tag' in value
    && (value as { _tag?: unknown })._tag === 'CodeCallServiceError';
}

export function causeMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
