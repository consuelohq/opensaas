import { Hono } from 'hono';

import type { DialerServerDependencies } from '../contracts';
import { runApplicationEffect } from '../effect-runner';
import { invalidRequestResponse, leadConnectorErrorResponse } from '../errors';
import type { DialerVariables } from '../middleware/auth';

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
