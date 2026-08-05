import { Hono } from 'hono';

import type { DialerServerDependencies } from '../contracts';
import { runApplicationEffect } from '../effect-runner';
import {
  dialerErrorResponse,
  invalidRequestResponse,
  leadConnectorErrorResponse,
} from '../errors';
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

const readOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;

const readOptionalLimit = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 100
    ? parsed
    : undefined;
};

export const createLeadConnectorPublicRoutes = (
  dependencies: DialerServerDependencies,
) => {
  const routes = new Hono();
  const application = dependencies.leadConnector;
  if (!application) return routes;

  routes.get('/v1/integrations/leadconnector/callback', async (context) => {
    try {
      if (context.req.query('error')) {
        return context.json(
          {
            error: {
              code: 'LEADCONNECTOR_AUTH_DENIED',
              message: 'LeadConnector authorization was denied',
              retryable: false,
            },
          },
          400,
        );
      }
      const code = context.req.query('code');
      const state = context.req.query('state');
      if (!code || !state) {
        return invalidRequestResponse(context, 'Code and state are required');
      }
      const result = await runApplicationEffect(
        application.completeOAuth({ code, state }),
      );
      if (!result.ok) return leadConnectorErrorResponse(context, result.error);
      return context.json({
        connected: result.value.connected,
        locationId: result.value.locationId,
      });
    } catch (error: unknown) {
      return leadConnectorErrorResponse(context, error);
    }
  });

  routes.post('/v1/webhooks/leadconnector', async (context) => {
    try {
      const rawBody = await context.req.text();
      const headers = Object.fromEntries(context.req.raw.headers.entries());
      const result = await runApplicationEffect(
        application.processWebhook({ rawBody, headers }),
      );
      if (!result.ok) return leadConnectorErrorResponse(context, result.error);
      if (result.value.event?.type === 'installation.uninstalled') {
        if (dependencies.commercial) {
          const appId = result.value.event.data.appId;
          const commercialResult = await runApplicationEffect(
            dependencies.commercial.processInstallationUninstall({
              id: result.value.event.id,
              workspaceId: result.value.event.workspaceId,
              locationId: result.value.event.locationId,
              appId: typeof appId === 'string' ? appId : null,
            }),
          );
          if (!commercialResult.ok) {
            return dialerErrorResponse(context, commercialResult.error);
          }
        }
        const disabled = await runApplicationEffect(
          application.disableInstallation(result.value.workspaceId),
        );
        if (!disabled.ok) {
          return leadConnectorErrorResponse(context, disabled.error);
        }
      }
      return context.json({
        received: true,
        duplicate: result.value.duplicate,
      });
    } catch (error: unknown) {
      return leadConnectorErrorResponse(context, error);
    }
  });

  return routes;
};

export const createLeadConnectorAuthenticatedRoutes = (
  dependencies: DialerServerDependencies,
) => {
  const routes = new Hono<{ Variables: DialerVariables }>();
  const application = dependencies.leadConnector;
  if (!application) return routes;

  routes.get('/v1/integrations/leadconnector/contacts', async (context) => {
    try {
      const identity = context.get('identity');
      const result = await runApplicationEffect(
        application.listContacts({
          workspaceId: identity.workspaceId,
          query: readOptionalString(context.req.query('query')),
          limit: readOptionalLimit(context.req.query('limit')),
          cursor: readOptionalString(context.req.query('cursor')),
        }),
      );
      return result.ok
        ? context.json(result.value)
        : leadConnectorErrorResponse(context, result.error);
    } catch (error: unknown) {
      return leadConnectorErrorResponse(context, error);
    }
  });

  routes.post(
    '/v1/integrations/leadconnector/opportunities/search',
    async (context) => {
      try {
        const body = await readJsonObject(context.req.raw);
        if (!body) return invalidRequestResponse(context);
        const identity = context.get('identity');
        const result = await runApplicationEffect(
          application.searchOpportunities({
            workspaceId: identity.workspaceId,
            query: readOptionalString(body.query),
            pipelineId: readOptionalString(body.pipelineId),
            stageId: readOptionalString(body.stageId),
            status: readOptionalString(body.status),
            limit: readOptionalLimit(body.limit),
          }),
        );
        return result.ok
          ? context.json(result.value)
          : leadConnectorErrorResponse(context, result.error);
      } catch (error: unknown) {
        return leadConnectorErrorResponse(context, error);
      }
    },
  );

  routes.post(
    '/v1/integrations/leadconnector/queues/preview',
    async (context) => {
      try {
        const body = await readJsonObject(context.req.raw);
        if (!body) return invalidRequestResponse(context);
        const pipelineId = readOptionalString(body.pipelineId);
        const stageId = readOptionalString(body.stageId);
        if (!pipelineId || !stageId) {
          return invalidRequestResponse(
            context,
            'Pipeline and stage are required',
          );
        }
        const identity = context.get('identity');
        const result = await runApplicationEffect(
          application.resolveQueueCandidates({
            workspaceId: identity.workspaceId,
            pipelineId,
            stageId,
          }),
        );
        return result.ok
          ? context.json(result.value)
          : leadConnectorErrorResponse(context, result.error);
      } catch (error: unknown) {
        return leadConnectorErrorResponse(context, error);
      }
    },
  );

  routes.get('/v1/integrations/leadconnector/pipelines', async (context) => {
    try {
      const identity = context.get('identity');
      const result = await runApplicationEffect(
        application.listPipelines(identity.workspaceId),
      );
      return result.ok
        ? context.json({ pipelines: result.value })
        : leadConnectorErrorResponse(context, result.error);
    } catch (error: unknown) {
      return leadConnectorErrorResponse(context, error);
    }
  });

  routes.post(
    '/v1/integrations/leadconnector/dispositions',
    async (context) => {
      try {
        const body = await readJsonObject(context.req.raw);
        if (!body) return invalidRequestResponse(context);
        const contactId = readOptionalString(body.contactId);
        const disposition = readOptionalString(body.disposition);
        if (!contactId || !disposition) {
          return invalidRequestResponse(
            context,
            'Contact and disposition are required',
          );
        }
        const identity = context.get('identity');
        const sessionId = readOptionalString(body.sessionId);
        const tags = Array.isArray(body.tags)
          ? body.tags.filter(
              (tag): tag is string =>
                typeof tag === 'string' && tag.trim().length > 0,
            )
          : undefined;
        if (sessionId && dependencies.callOperations) {
          const localResult = await runApplicationEffect(
            dependencies.callOperations.recordDisposition({
              workspaceId: identity.workspaceId,
              sessionId,
              disposition,
              note: readOptionalString(body.note),
              tags,
            }),
          );
          if (!localResult.ok) {
            return dialerErrorResponse(context, localResult.error);
          }
        }
        const result = await runApplicationEffect(
          application.recordDisposition({
            workspaceId: identity.workspaceId,
            contactId,
            disposition,
            note: readOptionalString(body.note),
            tags,
          }),
        );
        if (sessionId && dependencies.callOperations) {
          await runApplicationEffect(
            dependencies.callOperations.setCrmSyncStatus({
              workspaceId: identity.workspaceId,
              sessionId,
              status: result.ok ? 'synced' : 'failed',
              ...(!result.ok ? { errorCode: 'LEADCONNECTOR_SYNC_FAILED' } : {}),
            }),
          );
        }
        return result.ok
          ? context.json({ ...result.value, crmSyncStatus: 'synced' })
          : leadConnectorErrorResponse(context, result.error);
      } catch (error: unknown) {
        return leadConnectorErrorResponse(context, error);
      }
    },
  );

  routes.post('/v1/integrations/leadconnector/oauth', async (context) => {
    try {
      const identity = context.get('identity');
      const result = await runApplicationEffect(
        application.beginOAuth({ workspaceId: identity.workspaceId }),
      );
      if (!result.ok) return leadConnectorErrorResponse(context, result.error);
      return context.json({
        redirectUrl: result.value.authorizationUrl,
        state: result.value.state,
      });
    } catch (error: unknown) {
      return leadConnectorErrorResponse(context, error);
    }
  });

  return routes;
};
