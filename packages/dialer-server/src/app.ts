import { Hono } from 'hono';

import type { DialerServerDependencies } from './contracts';
import {
  createAuthenticationMiddleware,
  type DialerVariables,
} from './middleware/auth';
import { createCallSessionRoutes } from './routes/call-sessions';
import { createHealthRoutes } from './routes/health';
import { createTwilioRoutes } from './routes/twilio';

export function createDialerServer(dependencies: DialerServerDependencies) {
  const app = new Hono<{ Variables: DialerVariables }>();
  app.route('/', createHealthRoutes());
  app.use('/v1/*', createAuthenticationMiddleware(dependencies));
  app.route('/', createCallSessionRoutes(dependencies));
  app.route('/', createTwilioRoutes(dependencies));
  app.notFound((context) =>
    context.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found',
          retryable: false,
        },
      },
      404,
    ),
  );
  app.onError((_error, context) =>
    context.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Dialer request failed',
          retryable: false,
        },
      },
      500,
    ),
  );
  return app;
}
