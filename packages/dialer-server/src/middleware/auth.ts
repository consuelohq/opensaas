import type { MiddlewareHandler } from 'hono';

import type { DialerIdentity, DialerServerDependencies } from '../contracts';
import { unauthorizedResponse } from '../errors';

export type DialerVariables = { identity: DialerIdentity };

export const createAuthenticationMiddleware =
  (
    dependencies: Pick<DialerServerDependencies, 'authenticate'>,
  ): MiddlewareHandler<{ Variables: DialerVariables }> =>
  async (context, next) => {
    let identity: DialerIdentity | null;
    try {
      identity = await dependencies.authenticate(context.req.raw);
    } catch (_error: unknown) {
      return context.json(
        {
          error: {
            code: 'AUTHENTICATION_UNAVAILABLE',
            message: 'Authentication service unavailable',
            retryable: true,
          },
        },
        503,
      );
    }
    if (!identity?.workspaceId || !identity.userId) {
      return unauthorizedResponse(context);
    }
    context.set('identity', identity);
    await next();
  };
