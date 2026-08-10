import { Hono } from 'hono';

import type { DialerServerDependencies } from '../contracts';
import { runApplicationEffect } from '../effect-runner';
import { invalidRequestResponse, leadConnectorErrorResponse } from '../errors';

export const createEmbedRoutes = (dependencies: DialerServerDependencies) => {
  const routes = new Hono();

  routes.post('/v1/embed/session', async (context) => {
    const issueEmbedSession = dependencies.issueEmbedSession;
    const leadConnector = dependencies.leadConnector;
    if (!issueEmbedSession || !leadConnector) {
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
      const body: unknown = await context.req.json().catch(() => null);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return invalidRequestResponse(context);
      }
      const encryptedData = (body as Record<string, unknown>).encryptedData;
      if (
        typeof encryptedData !== 'string' ||
        encryptedData.trim().length === 0
      ) {
        return invalidRequestResponse(
          context,
          'Encrypted user context is required',
        );
      }
      const principal = await runApplicationEffect(
        leadConnector.exchangeEmbedBootstrap({
          encryptedData: encryptedData.trim(),
        }),
      );
      if (!principal.ok) {
        return leadConnectorErrorResponse(context, principal.error);
      }
      const session = await issueEmbedSession(principal.value);
      return context.json(session, 201);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && '_tag' in error) {
        return leadConnectorErrorResponse(context, error);
      }
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
