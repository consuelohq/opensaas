import type { ApiRequest, ApiResponse } from '../types.js';

/** Wraps a handler to catch errors and return consistent error format */
export function errorHandler(handler: (req: ApiRequest, res: ApiResponse) => Promise<void>) {
  return async (req: ApiRequest, res: ApiResponse) => {
    try {
      await handler(req, res);
    } catch (err: unknown) {
      const isErrorLike = (e: unknown): e is { message?: string; code?: string; status?: number } =>
        typeof e === 'object' && e !== null;
      const message = isErrorLike(err) && err.message ? err.message : 'Internal server error';
      const code = isErrorLike(err) && err.code ? err.code : 'internal_error';
      const status = isErrorLike(err) && err.status ? err.status : 500;

      try {
        const { createLogger } = await import('@consuelo/logger');
        createLogger('api:error-handler').error(message, { code, status, path: req.path });
      } catch { /* logger optional */ }

      if (status >= 500) {
        try {
          const Sentry = await import('@sentry/node');
          Sentry.captureException(err instanceof Error ? err : new Error(message));
        } catch { /* sentry optional */ }
      }

      res.status(status).json({ error: { code, message } });
    }
  };
}
