export const normalizeAsyncError = (cause: unknown): Error =>
  cause instanceof Error
    ? cause
    : new Error('ASYNC_OPERATION_FAILED', { cause });
