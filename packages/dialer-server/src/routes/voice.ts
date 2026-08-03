import { Hono } from 'hono';

import type { DialerServerDependencies } from '../contracts';
import type { DialerVariables } from '../middleware/auth';

export const createVoiceRoutes = (dependencies: DialerServerDependencies) => {
  const routes = new Hono<{ Variables: DialerVariables }>();

  routes.get('/v1/voice/token', async (context) => {
    if (!dependencies.issueVoiceToken) {
      return context.json(
        {
          error: {
            code: 'VOICE_TOKEN_UNAVAILABLE',
            message: 'Browser voice is not configured',
            retryable: false,
          },
        },
        503,
      );
    }
    try {
      return context.json(
        await dependencies.issueVoiceToken(context.get('identity')),
      );
    } catch (_error: unknown) {
      return context.json(
        {
          error: {
            code: 'VOICE_TOKEN_UNAVAILABLE',
            message: 'Browser voice token could not be issued',
            retryable: true,
          },
        },
        503,
      );
    }
  });

  return routes;
};
