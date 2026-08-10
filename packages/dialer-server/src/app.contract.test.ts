import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';
import {
  DialerConflictError,
  DialerInfrastructureError,
  DialerNotFoundError,
  DialerProviderError,
  DialerRequestError,
  DialerTransitionError,
} from '@consuelo/dialer';

import { createDialerServer } from './app';
import type { DialerServerDependencies } from './contracts';

const identity = { workspaceId: 'workspace-1', userId: 'user-1' };

const createDependencies = (
  overrides: Partial<DialerServerDependencies> = {},
) => {
  const application = {
    startCallSession: mock(() =>
      Effect.succeed({
        sessionId: 'session-1',
        twilioGroupId: 'group-1',
        queueId: 'queue-1',
        selectionStrategy: 'predictive' as const,
        requestedFanout: 2,
        actualFanout: 2,
        status: 'dialing' as const,
        capacity: {
          requestedFanout: 2,
          callableTargetCount: 2,
          availableCallerIdCount: 2,
          reducedCapacityReasons: [],
          blockedReasons: [],
          actualFanout: 2,
        },
        calls: [],
      }),
    ),
    getCallSession: mock(() =>
      Effect.succeed({
        groupId: 'group-1',
        conferenceName: 'conference-1',
        status: 'dialing',
        winnerSid: null,
        winner: null,
        calls: [],
      }),
    ),
    terminateCallSession: mock(() =>
      Effect.succeed({ groupId: 'group-1', status: 'completed' as const }),
    ),
    processTwilioStatus: mock(() =>
      Effect.succeed({ received: true as const, groupId: 'group-1' }),
    ),
    generateTwilioCustomerTwiml: mock(() => Effect.succeed('<Response />')),
    generateTwilioAgentTwiml: mock(() => Effect.succeed('<Response />')),
    markAgentReady: mock(() =>
      Effect.succeed({ groupId: 'group-1', status: 'connected', remainingCleanup: 0 }),
    ),
  };
  return {
    application,
    authenticate: mock(async () => identity),
    verifyTwilioSignature: mock(async () => true),
    issueVoiceToken: mock(async () => ({
      token: 'voice-token',
      identity: 'user_user-1',
      ttl: 3600,
    })),
    ...overrides,
  } satisfies DialerServerDependencies;
};

const authenticatedRequest = (path: string, init: RequestInit = {}) =>
  new Request(`https://dialer.test${path}`, {
    ...init,
    headers: {
      authorization: 'Bearer test-token',
      'content-type': 'application/json',
      ...init.headers,
    },
  });

describe('dialer-server HTTP contracts', () => {
  it('returns a deterministic health response without application dependencies', async () => {
    const dependencies = createDependencies();
    const response = await createDialerServer(dependencies).request('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      service: 'dialer-server',
      status: 'ok',
    });
    expect(dependencies.authenticate).not.toHaveBeenCalled();
  });

  it('starts one call session and propagates workspace and user identity exactly once', async () => {
    const dependencies = createDependencies();
    const body = {
      source: 'queue',
      selectionStrategy: 'predictive',
      requestedFanout: 2,
      targetPhones: ['+15550000001', '+15550000002'],
    };
    const response = await createDialerServer(dependencies).fetch(
      authenticatedRequest('/v1/call-sessions', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        sessionId: 'session-1',
        providerGroupId: 'group-1',
      }),
    );
    expect(dependencies.authenticate).toHaveBeenCalledTimes(1);
    expect(dependencies.application.startCallSession).toHaveBeenCalledTimes(1);
    expect(dependencies.application.startCallSession).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      input: body,
    });
  });

  it('loads and terminates a session through one shared use case per route', async () => {
    const dependencies = createDependencies();
    const app = createDialerServer(dependencies);
    const status = await app.fetch(
      authenticatedRequest('/v1/call-sessions/group-1'),
    );
    expect(status.status).toBe(200);
    expect(dependencies.application.getCallSession).toHaveBeenCalledTimes(1);
    expect(dependencies.application.getCallSession).toHaveBeenCalledWith({
      sessionId: 'group-1',
      workspaceId: 'workspace-1',
    });

    const termination = await app.fetch(
      authenticatedRequest('/v1/call-sessions/group-1/terminate', {
        method: 'POST',
      }),
    );
    expect(termination.status).toBe(200);
    expect(dependencies.application.terminateCallSession).toHaveBeenCalledTimes(
      1,
    );
    expect(dependencies.application.terminateCallSession).toHaveBeenCalledWith({
      sessionId: 'group-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });
  });

  it('issues an authenticated browser voice token and marks the agent participant ready', async () => {
    const dependencies = createDependencies();
    const app = createDialerServer(dependencies);

    const token = await app.fetch(authenticatedRequest('/v1/voice/token'));
    expect(token.status).toBe(200);
    expect(await token.json()).toEqual({
      token: 'voice-token',
      identity: 'user_user-1',
      ttl: 3600,
    });
    expect(dependencies.issueVoiceToken).toHaveBeenCalledWith(identity);

    const ready = await app.fetch(
      authenticatedRequest('/v1/call-sessions/group-1/agent-ready', {
        method: 'POST',
      }),
    );
    expect(ready.status).toBe(200);
    expect(dependencies.application.markAgentReady).toHaveBeenCalledWith({
      sessionId: 'group-1',
      workspaceId: 'workspace-1',
    });
  });

  it('fails closed before invoking an application use case when identity is absent', async () => {
    const dependencies = createDependencies({
      authenticate: mock(async () => null),
    });
    const response = await createDialerServer(dependencies).fetch(
      authenticatedRequest('/v1/call-sessions/group-1'),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        retryable: false,
      },
    });
    expect(dependencies.application.getCallSession).not.toHaveBeenCalled();
  });

  it.each([
    [
      new DialerRequestError({
        code: 'INVALID_REQUEST',
        message: 'Invalid request',
        retryable: false,
        details: { phone: '+15550000001' },
      }),
      400,
      'INVALID_REQUEST',
    ],
    [
      new DialerConflictError({
        code: 'CALLER_ID_LOCKED',
        message: 'Caller ID is in use',
        retryAfterMs: 5000,
        retryable: false,
      }),
      409,
      'CALLER_ID_LOCKED',
    ],
    [
      new DialerNotFoundError({
        code: 'NOT_FOUND',
        message: 'Call session not found',
        retryable: false,
      }),
      404,
      'NOT_FOUND',
    ],
    [
      new DialerTransitionError({
        groupId: 'group-1',
        callSid: 'CA_SECRET',
        message: 'Transition rejected',
        retryable: false,
      }),
      409,
      'TRANSITION_REJECTED',
    ],
    [
      new DialerProviderError({
        operation: 'create-call',
        message: 'provider leaked +15550000001 token-secret',
        retryable: true,
      }),
      502,
      'PROVIDER_ERROR',
    ],
    [
      new DialerInfrastructureError({
        operation: 'load-state',
        message: 'redis://secret@host',
        retryable: true,
      }),
      503,
      'SERVICE_UNAVAILABLE',
    ],
  ])(
    'maps %s to a stable redacted HTTP contract',
    async (failure, expectedStatus, expectedCode) => {
      const base = createDependencies();
      const failingStart = mock(() => Effect.fail(failure));
      const dependencies: DialerServerDependencies = {
        ...base,
        application: { ...base.application, startCallSession: failingStart },
      };
      const response = await createDialerServer(dependencies).fetch(
        authenticatedRequest('/v1/call-sessions', {
          method: 'POST',
          body: JSON.stringify({
            source: 'direct',
            selectionStrategy: 'single',
            requestedFanout: 1,
            targetPhone: '+15550000001',
          }),
        }),
      );
      const text = await response.text();
      expect(response.status).toBe(expectedStatus);
      expect(JSON.parse(text)).toMatchObject({ error: { code: expectedCode } });
      expect(text).not.toContain('+15550000001');
      expect(text).not.toContain('token-secret');
      expect(text).not.toContain('redis://');
      expect(text).not.toContain('CA_SECRET');
    },
  );
});
