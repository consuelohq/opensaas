import { it, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { createInboundOperatorRoutes } from './inbound-operator';
import type { createInboundOperator } from '../inbound/operator';
import type { DialerVariables } from '../middleware/auth';
it('requires current access for new receiving/acceptance while preserving away, history and wrap-up', async () => {
  const operation = mock(async () => ({ ok: true }));
  const authorize = mock(async () => {
    throw new Error('TEAM_ACCESS_REVOKED');
  });
  const operator = {
    snapshot: operation,
    readiness: operation,
    heartbeat: operation,
    accept: operation,
    decline: operation,
    wrapUp: operation,
    updateDevices: operation,
  } as unknown as ReturnType<typeof createInboundOperator>;
  const app = new Hono<{ Variables: DialerVariables }>();
  app.use('*', async (c, next) => {
    c.set('identity', { workspaceId: 'workspace', userId: 'rep' });
    await next();
  });
  app.route('/', createInboundOperatorRoutes(operator, authorize));
  const post = async (path: string, body: unknown) =>
    app.request('/v1/inbound/operator/' + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  expect((await post('readiness', { ready: true })).status).toBe(409);
  expect((await post('offers/accept', {})).status).toBe(409);
  expect(operation).not.toHaveBeenCalled();
  expect((await post('readiness', { ready: false })).status).toBe(200);
  expect((await post('wrap-up', {})).status).toBe(200);
  expect((await app.request('/v1/inbound/operator/snapshot')).status).toBe(200);
  expect(operation).toHaveBeenCalledTimes(3);
  expect(authorize).toHaveBeenCalledTimes(2);
});
