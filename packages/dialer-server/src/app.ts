import { Hono } from 'hono';

import type { DialerServerDependencies } from './contracts';
import {
  createAuthenticationMiddleware,
  type DialerVariables,
} from './middleware/auth';
import { createCallSessionRoutes } from './routes/call-sessions';
import { createEmbedRoutes } from './routes/embed';
import { createHealthRoutes } from './routes/health';
import {
  createLeadConnectorAuthenticatedRoutes,
  createLeadConnectorPublicRoutes,
} from './routes/lead-connector';
import { createCallOperationsRoutes } from './routes/calls';
import { createTwilioRoutes } from './routes/twilio';
import { createTwilioMediaRoutes } from './routes/twilio-media';
import { createVoiceRoutes } from './routes/voice';

export function createDialerServer(dependencies: DialerServerDependencies) {
  const app = new Hono<{ Variables: DialerVariables }>();
  app.route('/', createHealthRoutes());
  app.route('/', createLeadConnectorPublicRoutes(dependencies));
  app.route('/', createEmbedRoutes(dependencies));
  app.use('/v1/*', createAuthenticationMiddleware(dependencies));
  app.route('/', createCallSessionRoutes(dependencies));
  app.route('/', createCallOperationsRoutes(dependencies));
  app.route('/', createVoiceRoutes(dependencies));
  app.route('/', createLeadConnectorAuthenticatedRoutes(dependencies));
  app.route('/', createTwilioRoutes(dependencies));
  app.route('/', createTwilioMediaRoutes(dependencies));
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
