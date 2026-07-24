import { Hono } from 'hono';

import type { DialerServerDependencies } from '../contracts';
import type { DialerVariables } from '../middleware/auth';

export const createEmbedRoutes = (dependencies: DialerServerDependencies) => {
  const routes = new Hono<{ Variables: DialerVariables }>();

  routes.post('/v1/embed/session', async (context) => {
    const issueEmbedSession = dependencies.issueEmbedSession;
    if (!issueEmbedSession) {
      return context.json(
        {
          error: {
            code: 'EMBED_SESSION_UNAVAILABLE',
            message: 'Embedded dialer sessions are not configured',
            retryable: false,
          },
        },
        503,
      );
    }
    try {
      const identity = context.get('identity');
      const session = await issueEmbedSession(identity);
      return context.json(session, 201);
    } catch (_error: unknown) {
      return context.json(
        {
          error: {
            code: 'EMBED_SESSION_FAILED',
            message: 'Embedded dialer session could not be created',
            retryable: true,
          },
        },
        503,
      );
    }
  });

  return routes;
};
