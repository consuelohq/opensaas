import { Hono } from 'hono';

import type { DialerServerDependencies } from '../contracts';
import { runApplicationEffect } from '../effect-runner';
import { dialerErrorResponse, invalidRequestResponse } from '../errors';
import type { DialerVariables } from '../middleware/auth';

type CallOperationsApplication = NonNullable<
  DialerServerDependencies['callOperations']
>;

const resolveCallOperations = (
  dependencies: DialerServerDependencies,
): Partial<CallOperationsApplication> =>
  dependencies.callOperations ??
  (dependencies.application as unknown as Partial<CallOperationsApplication>);

const limitFrom = (value: string | undefined): number | null => {
  if (!value) return 50;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100
    ? parsed
    : null;
};

export const createCallOperationsRoutes = (
  dependencies: DialerServerDependencies,
) => {
  const routes = new Hono<{ Variables: DialerVariables }>();
  const application = resolveCallOperations(dependencies);

  routes.get('/v1/calls/active', async (context) => {
    try {
      if (!application.listActiveCalls) {
        return context.json(
          {
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Call history is unavailable',
              retryable: true,
            },
          },
          503,
        );
      }
      const result = await runApplicationEffect(
        application.listActiveCalls({
          workspaceId: context.get('identity').workspaceId,
        }),
      );
      return result.ok
        ? context.json({ calls: result.value })
        : dialerErrorResponse(context, result.error);
    } catch (error: unknown) {
      return dialerErrorResponse(context, error);
    }
  });

  routes.get('/v1/calls', async (context) => {
    try {
      if (!application.listCallHistory) {
        return context.json(
          {
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Call history is unavailable',
              retryable: true,
            },
          },
          503,
        );
      }
      const limit = limitFrom(context.req.query('limit'));
      if (limit === null) {
        return invalidRequestResponse(
          context,
          'limit must be between 1 and 100',
        );
      }
      const status = context.req.query('status') || undefined;
      const cursor = context.req.query('cursor') || undefined;
      const result = await runApplicationEffect(
        application.listCallHistory({
          workspaceId: context.get('identity').workspaceId,
          ...(status ? { status } : {}),
          ...(cursor ? { cursor } : {}),
          limit,
        }),
      );
      return result.ok
        ? context.json(result.value)
        : dialerErrorResponse(context, result.error);
    } catch (error: unknown) {
      return dialerErrorResponse(context, error);
    }
  });

  routes.get('/v1/calls/:callId/transcript', async (context) => {
    try {
      if (!application.getCallTranscript) {
        return context.json(
          {
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Call transcript is unavailable',
              retryable: true,
            },
          },
          503,
        );
      }
      const result = await runApplicationEffect(
        application.getCallTranscript({
          workspaceId: context.get('identity').workspaceId,
          callId: context.req.param('callId'),
        }),
      );
      return result.ok
        ? context.json({ segments: result.value })
        : dialerErrorResponse(context, result.error);
    } catch (error: unknown) {
      return dialerErrorResponse(context, error);
    }
  });

  routes.get('/v1/calls/:callId', async (context) => {
    try {
      if (!application.getCallDetail) {
        return context.json(
          {
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Call detail is unavailable',
              retryable: true,
            },
          },
          503,
        );
      }
      const result = await runApplicationEffect(
        application.getCallDetail({
          workspaceId: context.get('identity').workspaceId,
          callId: context.req.param('callId'),
        }),
      );
      if (!result.ok) return dialerErrorResponse(context, result.error);
      if (!result.value.opportunityId || !dependencies.leadConnector)
        return context.json(result.value);
      const current = await runApplicationEffect(
        dependencies.leadConnector.searchOpportunities({
          workspaceId: context.get('identity').workspaceId,
          limit: 100,
        }),
      );
      if (!current.ok) return context.json(result.value);
      const opportunity = current.value.opportunities.find(
        (candidate) => candidate.id === result.value.opportunityId,
      );
      return context.json({
        ...result.value,
        currentOpportunity: opportunity
          ? {
              id: opportunity.id,
              status: opportunity.status,
              monetaryValue: opportunity.monetaryValue,
              pipelineId: opportunity.pipelineId,
              stageId: opportunity.stageId,
            }
          : null,
      });
    } catch (error: unknown) {
      return dialerErrorResponse(context, error);
    }
  });

  return routes;
};
