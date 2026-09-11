import { Hono } from 'hono';

import type { DialerServerDependencies } from '../contracts';
import { resolveCommercialCallTargetInput } from '../commercial-target-authorization';
import { runApplicationEffect } from '../effect-runner';
import { dialerErrorResponse, invalidRequestResponse } from '../errors';
import type { DialerVariables } from '../middleware/auth';

const callSessionStartResponse = (value: {
  twilioGroupId: string | null;
  [key: string]: unknown;
}) => {
  const { twilioGroupId, ...publicValue } = value;
  return { ...publicValue, providerGroupId: twilioGroupId };
};

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

const stripUntrustedScientificContext = (
  input: Record<string, unknown>,
): Record<string, unknown> => {
  const { targetContexts: _targetContexts, ...trustedInput } = input;
  return trustedInput;
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
      const authorizedInput = dependencies.commercial?.authorizeCall
        ? await runApplicationEffect(
            dependencies.commercial.authorizeCall(identity, input),
          )
        : null;
      if (authorizedInput && !authorizedInput.ok) {
        return dialerErrorResponse(context, authorizedInput.error);
      }
      const applicationInput = authorizedInput?.ok
        ? await resolveCommercialCallTargetInput(
            authorizedInput.value,
            identity,
            dependencies.leadConnector,
          )
        : stripUntrustedScientificContext(input);
      const result = await runApplicationEffect(
        dependencies.application.startCallSession({
          workspaceId: identity.workspaceId,
          userId: identity.userId,
          installationId: identity.installationId,
          locationId: identity.locationId,
          input: applicationInput as never,
        }),
      );
      return result.ok
        ? context.json(callSessionStartResponse(result.value), 201)
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

  routes.post('/v1/call-sessions/:sessionId/agent-ready', async (context) => {
    try {
      const identity = context.get('identity');
      const result = await runApplicationEffect(
        dependencies.application.markAgentReady({
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

  if (dependencies.transfers) {
    routes.post('/v1/call-sessions/:sessionId/transfers', async (context) => {
      try {
        const input = await readJsonObject(context.req.raw);
        const type = input?.type === 'cold' || input?.type === 'warm'
          ? input.type
          : null;
        const to = typeof input?.to === 'string' ? input.to.trim() : '';
        if (!type || !/^\+[1-9]\d{7,14}$/.test(to)) {
          return context.json(
            {
              error: {
                code: 'INVALID_TRANSFER_REQUEST',
                message: 'A valid E.164 target and transfer type are required',
                retryable: false,
              },
            },
            400,
          );
        }
        const identity = context.get('identity');
        const result = await runApplicationEffect(
          dependencies.transfers!.initiate({
            workspaceId: identity.workspaceId,
            userId: identity.userId,
            sessionId: context.req.param('sessionId'),
            type,
            to,
          }),
        );
        return result.ok
          ? context.json(result.value, 201)
          : dialerErrorResponse(context, result.error);
      } catch (error: unknown) {
        return dialerErrorResponse(context, error);
      }
    });

    routes.get(
      '/v1/call-sessions/:sessionId/transfers/:transferId',
      async (context) => {
        try {
          const identity = context.get('identity');
          const result = await runApplicationEffect(
            dependencies.transfers!.getStatus({
              workspaceId: identity.workspaceId,
              userId: identity.userId,
              sessionId: context.req.param('sessionId'),
              transferId: context.req.param('transferId'),
            }),
          );
          return result.ok
            ? context.json(result.value)
            : dialerErrorResponse(context, result.error);
        } catch (error: unknown) {
          return dialerErrorResponse(context, error);
        }
      },
    );

    routes.post(
      '/v1/call-sessions/:sessionId/transfers/:transferId/complete',
      async (context) => {
        try {
          const identity = context.get('identity');
          const result = await runApplicationEffect(
            dependencies.transfers!.complete({
              workspaceId: identity.workspaceId,
              userId: identity.userId,
              sessionId: context.req.param('sessionId'),
              transferId: context.req.param('transferId'),
            }),
          );
          return result.ok
            ? context.json(result.value)
            : dialerErrorResponse(context, result.error);
        } catch (error: unknown) {
          return dialerErrorResponse(context, error);
        }
      },
    );

    routes.post(
      '/v1/call-sessions/:sessionId/transfers/:transferId/cancel',
      async (context) => {
        try {
          const identity = context.get('identity');
          const result = await runApplicationEffect(
            dependencies.transfers!.cancel({
              workspaceId: identity.workspaceId,
              userId: identity.userId,
              sessionId: context.req.param('sessionId'),
              transferId: context.req.param('transferId'),
            }),
          );
          return result.ok
            ? context.json(result.value)
            : dialerErrorResponse(context, result.error);
        } catch (error: unknown) {
          return dialerErrorResponse(context, error);
        }
      },
    );
  }

  return routes;
};
