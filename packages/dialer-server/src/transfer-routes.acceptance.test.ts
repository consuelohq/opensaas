import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';
import { Hono } from 'hono';

import type { DialerServerDependencies } from './contracts';
import { createCallSessionRoutes } from './routes/call-sessions';

const identity = {
  workspaceId: 'workspace-one',
  userId: 'user-one',
  role: 'user',
};

const boot = () => {
  const initiate = mock((_input: unknown) =>
    Effect.succeed({
      success: true,
      transferId: 'transfer-one',
      transferCallSid: 'CA_transfer_one',
      conferenceSid: 'CF_one',
      status: 'consulting' as const,
    }),
  );
  const getStatus = mock((_input: unknown) =>
    Effect.succeed({
      success: true,
      transferId: 'transfer-one',
      transferCallSid: 'CA_transfer_one',
      conferenceSid: 'CF_one',
      status: 'consulting' as const,
    }),
  );
  const complete = mock((_input: unknown) =>
    Effect.succeed({ success: true, transferId: 'transfer-one', status: 'completed' as const }),
  );
  const cancel = mock((_input: unknown) =>
    Effect.succeed({ success: true, transferId: 'transfer-one', status: 'cancelled' as const }),
  );
  const dependencies = {
    application: {
      startCallSession: () => Effect.die('unused'),
      getCallSession: () => Effect.die('unused'),
      terminateCallSession: () => Effect.die('unused'),
      processTwilioStatus: () => Effect.die('unused'),
      generateTwilioCustomerTwiml: () => Effect.die('unused'),
      generateTwilioAgentTwiml: () => Effect.die('unused'),
      markAgentReady: () => Effect.die('unused'),
    },
    transfers: { initiate, getStatus, complete, cancel, processStatusCallback: () => Effect.die('unused') },
    authenticate: async () => identity,
    verifyTwilioSignature: async () => true,
  } as unknown as DialerServerDependencies;
  const app = new Hono<{ Variables: { identity: typeof identity } }>();
  app.use('/v1/*', async (context, next) => {
    context.set('identity', identity);
    await next();
  });
  app.route('/', createCallSessionRoutes(dependencies));
  return { app, initiate, getStatus, complete, cancel };
};

describe('call transfer HTTP routes', () => {
  it('derives workspace and operator identity on initiate, complete, and cancel instead of trusting browser tenant fields', async () => {
    const { app, initiate, getStatus, complete, cancel } = boot();
    const attacker = {
      workspaceId: 'attacker-workspace',
      userId: 'attacker-user',
      conferenceName: 'attacker-conference',
      callSid: 'CA_attacker',
    };
    const initiated = await app.request('/v1/call-sessions/group-one/transfers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...attacker,
        type: 'warm',
        to: '+15550100111',
      }),
    });
    const status = await app.request(
      '/v1/call-sessions/group-one/transfers/transfer-one',
    );
    const completed = await app.request(
      '/v1/call-sessions/group-one/transfers/transfer-one/complete',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(attacker),
      },
    );
    const cancelled = await app.request(
      '/v1/call-sessions/group-one/transfers/transfer-one/cancel',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(attacker),
      },
    );

    expect([initiated.status, status.status, completed.status, cancelled.status]).toEqual([
      201, 200, 200, 200,
    ]);
    expect(initiate).toHaveBeenCalledWith({
      workspaceId: 'workspace-one',
      userId: 'user-one',
      sessionId: 'group-one',
      type: 'warm',
      to: '+15550100111',
    });
    expect(getStatus).toHaveBeenCalledWith({
      workspaceId: 'workspace-one',
      userId: 'user-one',
      sessionId: 'group-one',
      transferId: 'transfer-one',
    });
    expect(complete).toHaveBeenCalledWith({
      workspaceId: 'workspace-one',
      userId: 'user-one',
      sessionId: 'group-one',
      transferId: 'transfer-one',
    });
    expect(cancel).toHaveBeenCalledWith({
      workspaceId: 'workspace-one',
      userId: 'user-one',
      sessionId: 'group-one',
      transferId: 'transfer-one',
    });
  });

  it('rejects malformed transfer targets before invoking the provider boundary', async () => {
    const { app, initiate } = boot();
    const response = await app.request('/v1/call-sessions/group-one/transfers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'cold', to: 'not-a-number' }),
    });

    expect(response.status).toBe(400);
    expect(initiate).not.toHaveBeenCalled();
  });
});
