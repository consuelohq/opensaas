import type { ApiRequest, ApiResponse } from '../types.js';

/**
 * Middleware that validates X-Twilio-Signature header on Twilio webhook requests.
 *
 * Twilio sends a signature in the X-Twilio-Signature header that is computed
 * using the webhook URL and request body with the account's auth token.
 * This middleware validates that signature to ensure requests come from Twilio.
 *
 * IMPORTANT: Must be applied BEFORE body parsing middleware so the raw body
 * is available for signature validation.
 */
export function twilioSignatureMiddleware() {
  return async (req: ApiRequest, res: ApiResponse, next: () => void) => {
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!authToken) {
      res.status(500).json({
        error: {
          code: 'CONFIG_ERROR',
          message: 'TWILIO_AUTH_TOKEN is not configured',
        },
      });
      return;
    }

    const signature = req.headers['x-twilio-signature'];
    if (!signature || typeof signature !== 'string') {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing Twilio signature',
        },
      });
      return;
    }

    // Construct the full URL (protocol + host + path)
    const protocol = req.headers['x-forwarded-proto'] ?? 'https';
    const host = req.headers.host ?? '';
    const url = `${protocol}://${host}${req.originalUrl ?? req.url}`;

    // Get the raw body for signature validation
    // The raw body should be available on req.rawBody if body parser is configured
    // Otherwise, we use the parsed body
    const body = (req as Record<string, unknown>).rawBody;
    const params =
      typeof body === 'string'
        ? undefined
        : (req.body as Record<string, string> | undefined);

    try {
      // Lazy import — twilio is a peer dependency
      const twilio = await import('twilio');

      // validateRequest is a static method on the twilio module
      const isValid = twilio.validateRequest(authToken, signature, url, params);

      if (!isValid) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid Twilio signature',
          },
        });
        return;
      }

      next();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Signature validation failed';
      res.status(500).json({
        error: {
          code: 'VALIDATION_ERROR',
          message,
        },
      });
    }
  };
}
