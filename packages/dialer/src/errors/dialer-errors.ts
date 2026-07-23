import { Data } from 'effect';

export type DialerProviderOperation =
  | 'create-call'
  | 'terminate-call'
  | 'unmute-winner';

export class DialerProviderError extends Data.TaggedError(
  'DialerProviderError',
)<{
  operation: DialerProviderOperation;
  message: string;
  retryable: boolean;
  cause?: unknown;
}> {}

export class DialerStateError extends Data.TaggedError('DialerStateError')<{
  operation: string;
  message: string;
  retryable: boolean;
  cause?: unknown;
}> {}

export class DialerCleanupError extends Data.TaggedError('DialerCleanupError')<{
  action: 'terminate-call' | 'unmute-winner';
  callSid: string;
  message: string;
  retryable: boolean;
  cause?: unknown;
}> {}

export class DialerTransitionError extends Data.TaggedError(
  'DialerTransitionError',
)<{
  groupId: string;
  callSid: string;
  message: string;
  retryable: false;
}> {}

export class DialerTimeoutError extends Data.TaggedError('DialerTimeoutError')<{
  operation: DialerProviderOperation;
  timeoutMs: number;
  message: string;
  retryable: true;
}> {}

export class DialerInterruptedError extends Data.TaggedError(
  'DialerInterruptedError',
)<{
  operation: string;
  message: string;
  retryable: true;
}> {}

export type DialerApplicationError =
  | DialerProviderError
  | DialerStateError
  | DialerCleanupError
  | DialerTransitionError
  | DialerTimeoutError
  | DialerInterruptedError;

export const errorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

export const isRetryableDialerError = (
  error: DialerApplicationError,
): boolean => error.retryable;
