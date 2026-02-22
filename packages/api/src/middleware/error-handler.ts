import type { ApiRequest, ApiResponse } from '../types.js';

/** Wraps a handler to catch errors and return consistent error format */
export function errorHandler(
  handler: (req: ApiRequest, res: ApiResponse) => Promise<void>,
) {
  return async (req: ApiRequest, res: ApiResponse) => {
    try {
      await handler(req, res);
    } catch (err: unknown) {
      const isErrorLike = (
        e: unknown,
      ): e is { message?: string; code?: string; status?: number } =>
        typeof e === 'object' && e !== null;
      const statusCode = isErrorLike(err) && err.status ? err.status : 500;

      const isServerError = statusCode >= 500;
      const safeMessage = isServerError
        ? 'An unexpected error occurred'
        : isErrorLike(err) && err.message
          ? err.message
          : 'Request failed';

      const code = isErrorLike(err) && err.code ? err.code : 'internal_error';

      try {
        const { createLogger } = await import('@consuelo/logger');
        createLogger('api:error-handler').error(safeMessage, {
          code,
          status: statusCode,
          path: req.path,
          originalError: err instanceof Error ? err.message : String(err),
        });
      } catch (_err: unknown) {
        /* logger optional — intentional: errors in error logging should not crash the handler */
      }

      if (isServerError) {
        try {
          const Sentry = await import('@sentry/node');
          Sentry.captureException(
            err instanceof Error ? err : new Error(String(err)),
          );
        } catch (_err: unknown) {
          /* sentry optional — intentional: errors in sentry init should not crash the handler */
        }
      }

      res.status(statusCode).json({ error: { code, message: safeMessage } });
    }
  };
}
