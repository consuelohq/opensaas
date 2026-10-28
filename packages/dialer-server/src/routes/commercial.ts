import { Effect } from 'effect';
import { Hono } from 'hono';

import type { DialerIdentity } from '../contracts';

export type CommercialIdentity = DialerIdentity;

export type CommercialRouteDependencies = {
  catalog: () => Effect.Effect<unknown, unknown>;
  dashboard: (
    identity: CommercialIdentity,
  ) => Effect.Effect<unknown, unknown>;
  createCheckout: (
    identity: CommercialIdentity,
    body: unknown,
  ) => Effect.Effect<unknown, unknown>;
  createBillingPortal: (
    identity: CommercialIdentity,
    body: unknown,
  ) => Effect.Effect<unknown, unknown>;
  previewBillingChange: (
    identity: CommercialIdentity,
    body: unknown,
  ) => Effect.Effect<unknown, unknown>;
  applyBillingChange: (
    identity: CommercialIdentity,
    body: unknown,
  ) => Effect.Effect<unknown, unknown>;
  callerContext?: (
    identity: CommercialIdentity,
  ) => Effect.Effect<unknown, unknown>;
  authorizeCall?: (
    identity: CommercialIdentity,
    body: unknown,
  ) => Effect.Effect<Record<string, unknown>, unknown>;
  updateTeam: (
    identity: CommercialIdentity,
    body: unknown,
  ) => Effect.Effect<unknown, unknown>;
  assignNumber: (
    identity: CommercialIdentity,
    body: unknown,
  ) => Effect.Effect<unknown, unknown>;
  searchNumbers: (
    identity: CommercialIdentity,
    body: unknown,
  ) => Effect.Effect<unknown, unknown>;
  provisionNumber: (
    identity: CommercialIdentity,
    body: unknown,
  ) => Effect.Effect<unknown, unknown>;
  releaseNumber: (
    identity: CommercialIdentity,
    body: unknown,
  ) => Effect.Effect<unknown, unknown>;
  processStripeWebhook: (input: {
    rawBody: string;
    signature: string;
  }) => Effect.Effect<{ received: true; duplicate: boolean }, unknown>;
  processInstallationUninstall: (event: {
    id: string;
    workspaceId: string;
    locationId: string;
    appId: string | null;
  }) => Effect.Effect<{ duplicate: boolean; cancellationScheduled: boolean }, unknown>;
  recordProviderCompletion: (input: {
    workspaceId: string;
    sessionId: string;
    providerCallId: string;
    status: string;
  }) => Effect.Effect<{ duplicate: boolean } | null, unknown>;
};

type CommercialVariables = { identity: CommercialIdentity };

const errorCode = (cause: unknown): string =>
  cause instanceof Error && cause.message ? cause.message : 'COMMERCIAL_ERROR';

const errorStatus = (code: string): 400 | 401 | 403 | 409 | 500 => {
  if (code === 'INVALID_STRIPE_SIGNATURE') return 401;
  if (code === 'FORBIDDEN' || code === 'ADMIN_REQUIRED') return 403;
  if (code === 'NUMBER_LIMIT_REACHED' || code === 'NUMBER_ALREADY_ASSIGNED') {
    return 409;
  }
  if (code === 'COMMERCIAL_ERROR') return 500;
  return 400;
};

export const createCommercialRoutes = (
  dependencies: CommercialRouteDependencies,
) => {
  const app = new Hono<{ Variables: CommercialVariables }>();

  app.get('/v1/commercial/catalog', async (context) =>
    context.json(await Effect.runPromise(dependencies.catalog())),
  );
  app.get('/v1/commercial/admin', async (context) =>
    context.json(
      await Effect.runPromise(dependencies.dashboard(context.get('identity'))),
    ),
  );
  if (dependencies.callerContext) {
    app.get('/v1/commercial/caller', async (context) =>
      context.json(
        await Effect.runPromise(
          dependencies.callerContext!(context.get('identity')),
        ),
      ),
    );
  }

  const mutation = (
    operation: (
      identity: CommercialIdentity,
      body: unknown,
    ) => Effect.Effect<unknown, unknown>,
  ) =>
    async (context: {
      get: (key: 'identity') => CommercialIdentity;
      req: { json: () => Promise<unknown> };
      json: (body: unknown, status?: number) => Response;
    }): Promise<Response> => {
      try {
        const body = await context.req.json().catch(() => ({}));
        const result = await Effect.runPromise(
          operation(context.get('identity'), body),
        );
        return context.json(result, 200);
      } catch (cause: unknown) {
        const code = errorCode(cause);
        return context.json(
          {
            error: {
              code,
              message:
                cause instanceof Error
                  ? cause.message
                  : 'Commercial request failed',
            },
          },
          errorStatus(code),
        );
      }
    };

  app.post(
    '/v1/commercial/billing/checkout',
    mutation(dependencies.createCheckout),
  );
  app.post(
    '/v1/commercial/billing/portal',
    mutation(dependencies.createBillingPortal),
  );
  app.post(
    '/v1/commercial/billing/preview',
    mutation(dependencies.previewBillingChange),
  );
  app.post(
    '/v1/commercial/billing/apply',
    mutation(dependencies.applyBillingChange),
  );
  app.patch('/v1/commercial/team', mutation(dependencies.updateTeam));
  app.post(
    '/v1/commercial/numbers/assign',
    mutation(dependencies.assignNumber),
  );
  app.post(
    '/v1/commercial/numbers/search',
    mutation(dependencies.searchNumbers),
  );
  app.post(
    '/v1/commercial/numbers/provision',
    mutation(dependencies.provisionNumber),
  );
  app.post(
    '/v1/commercial/numbers/release',
    mutation(dependencies.releaseNumber),
  );
  return app;
};

export const createCommercialPublicRoutes = (
  dependencies: CommercialRouteDependencies,
) => {
  const app = new Hono();
  app.post('/v1/webhooks/stripe', async (context) => {
    try {
      const signature = context.req.header('stripe-signature')?.trim() ?? '';
      if (!signature) {
        return context.json(
          {
            error: {
              code: 'INVALID_STRIPE_SIGNATURE',
              message: 'Stripe webhook signature is required',
            },
          },
          401,
        );
      }
      const result = await Effect.runPromise(
        dependencies.processStripeWebhook({
          rawBody: await context.req.text(),
          signature,
        }),
      );
      return context.json(result);
    } catch (cause: unknown) {
      const code = errorCode(cause);
      return context.json(
        {
          error: {
            code,
            message:
              code === 'INVALID_STRIPE_SIGNATURE'
                ? 'Stripe webhook signature is invalid'
                : 'Commercial webhook failed',
          },
        },
        errorStatus(code),
      );
    }
  });
  return app;
};
