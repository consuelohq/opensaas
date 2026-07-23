import { Hono } from 'hono';

import type { DialerServerDependencies } from '../contracts';
import { runApplicationEffect } from '../effect-runner';
import { dialerErrorResponse, invalidRequestResponse } from '../errors';
import type { DialerVariables } from '../middleware/auth';

const readJsonObject = async (
  request: Request,
): Promise<Record<string, unknown> | null> => {
  try {
    const value: unknown = await request.json();
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch (_error: unknown) {
    return null;
  }
};

export const createCallSessionRoutes = (
  dependencies: DialerServerDependencies,
) => {
  const routes = new Hono<{ Variables: DialerVariables }>();

  routes.post('/v1/call-sessions', async (context) => {
    try {
      const input = await readJsonObject(context.req.raw);
      if (!input) return invalidRequestResponse(context);
      const identity = context.get('identity');
      const result = await runApplicationEffect(
        dependencies.application.startCallSession({
          workspaceId: identity.workspaceId,
          userId: identity.userId,
          input: input as never,
        }),
      );
      return result.ok
        ? context.json(result.value, 201)
        : dialerErrorResponse(context, result.error);
    } catch (error: unknown) {
      return dialerErrorResponse(context, error);
    }
  });

  routes.get('/v1/call-sessions/:sessionId', async (context) => {
    try {
      const identity = context.get('identity');
      const result = await runApplicationEffect(
        dependencies.application.getCallSession({
          sessionId: context.req.param('sessionId'),
          workspaceId: identity.workspaceId,
        }),
      );
      return result.ok
        ? context.json(result.value)
        : dialerErrorResponse(context, result.error);
    } catch (error: unknown) {
      return dialerErrorResponse(context, error);
    }
  });

  routes.post('/v1/call-sessions/:sessionId/terminate', async (context) => {
    try {
      const identity = context.get('identity');
      const result = await runApplicationEffect(
        dependencies.application.terminateCallSession({
          sessionId: context.req.param('sessionId'),
          workspaceId: identity.workspaceId,
          userId: identity.userId,
        }),
      );
      return result.ok
        ? context.json(result.value)
        : dialerErrorResponse(context, result.error);
    } catch (error: unknown) {
      return dialerErrorResponse(context, error);
    }
  });

  return routes;
};
