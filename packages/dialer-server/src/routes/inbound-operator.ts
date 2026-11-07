import type { DialerIdentity } from '../contracts';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { DialerVariables } from '../middleware/auth';
import type { createInboundOperator } from '../inbound/operator';

export const createInboundOperatorRoutes = (
  operator: ReturnType<typeof createInboundOperator>,
  authorizeRep?: (identity: DialerIdentity) => Promise<void>,
) => {
  const routes = new Hono<{ Variables: DialerVariables }>();
  routes.use('/v1/inbound/operator/*', bodyLimit({ maxSize: 8192 }));
  routes.get('/v1/inbound/operator/snapshot', async (context) => {
    try {
      return context.json(await operator.snapshot(context.get('identity')));
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Inbound snapshot failed with a non-Error cause', {
        cause,
      });
    }
  });
  routes.get('/v1/inbound/operator/configuration', async (context) =>
    context.json(
      (await operator.snapshot(context.get('identity'))).configuration,
    ),
  );
  routes.patch('/v1/inbound/operator/configuration', (context) =>
    context.json(
      {
        error: {
          code: 'STRUCTURED_POLICY_REQUIRED',
          message:
            'Configure number and queue policies through the typed administration contract; display labels cannot change routing.',
          retryable: false,
        },
      },
      501,
    ),
  );
  routes.post('/v1/inbound/operator/reconnect', async (context) =>
    context.json(await operator.snapshot(context.get('identity'))),
  );
  routes.post('/v1/inbound/operator/devices', async (context) => {
    try {
      return context.json(
        await operator.updateDevices(
          context.get('identity'),
          await context.req.json(),
        ),
      );
    } catch {
      return context.json(
        {
          error: {
            code: 'DEVICE_CHANGE_REJECTED',
            message:
              'Device settings could not be saved. Use a valid phone number, finish any call, refresh and try again.',
            retryable: false,
          },
        },
        409,
      );
    }
  });
  for (const [path, operation] of [
    ['readiness', operator.readiness],
    ['heartbeat', operator.heartbeat],
    ['offers/accept', operator.accept],
    ['offers/decline', operator.decline],
    ['wrap-up', operator.wrapUp],
  ] as const) {
    routes.post('/v1/inbound/operator/' + path, async (context) => {
      try {
        const body = await context.req.json();
        if (
          authorizeRep &&
          ((path === 'readiness' && body?.ready === true) ||
            path === 'heartbeat' ||
            path === 'offers/accept')
        )
          await authorizeRep(context.get('identity'));
        return context.json(await operation(context.get('identity'), body));
      } catch {
        return context.json(
          {
            error: {
              code: 'INBOUND_ACTION_REJECTED',
              message:
                'The action could not be committed. Refresh authoritative state.',
              retryable: false,
            },
          },
          409,
        );
      }
    });
  }
  return routes;
};
