import { describe, expect, it } from 'bun:test';

import { Effect } from 'effect';

import { createDialerCallStartApplication } from './dialer-call-start-application.js';

const WORKSPACE_ID = 'workspace-m1';
const USER_ID = 'user-m1';

describe('createDialerCallStartApplication', () => {
  it('owns call-start port composition outside any compatibility server', async () => {
    const calls: string[] = [];
    const application = createDialerCallStartApplication({
      targets: {
        resolveInputQueueId: () => Effect.succeed('unused-queue'),
        resolveDirectTargets: ({ input }) => {
          calls.push('resolve-direct-targets');
          return Effect.succeed([
            {
              contactId: input.contactId ?? 'contact-m1',
              phone: input.targetPhone ?? '+14155552671',
            },
          ]);
        },
        resolveQueueTargets: () => Effect.succeed([]),
        createDirectQueue: ({ contactIds }) => {
          calls.push(`create-direct-queue:${contactIds.join(',')}`);
          return Effect.succeed('queue-m1');
        },
      },
      calls: {
        createMockCalls: ({ sessionId, targets, callerIds }) => {
          calls.push(`create-mock-calls:${sessionId}`);
          return Effect.succeed([
            {
              callSid: 'mock-call-m1',
              contactId: targets[0]?.contactId ?? 'missing-contact',
              customerNumber: targets[0]?.phone ?? 'missing-phone',
              callerId: callerIds[0] ?? 'missing-caller-id',
              status: 'mocked',
              position: 1,
            },
          ]);
        },
      },
      runtime: {
        assertSafeTargetsAllowed: () => Effect.void,
        resolveCallerIds: () => {
          calls.push('resolve-caller-ids');
          return Effect.succeed(['+12025550123']);
        },
        initiateProviderCalls: () => Effect.die('mock mode must not call provider'),
      },
    });

    const result = await Effect.runPromise(
      application.start({
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        sessionId: 'session-m1',
        input: {
          source: 'direct',
          selectionStrategy: 'single',
          requestedFanout: 1,
          targetPhone: '+14155552671',
          callerIdNumber: '+12025550123',
          callMode: 'mock',
        },
      }),
    );

    expect(result).toMatchObject({
      sessionId: 'session-m1',
      queueId: 'queue-m1',
      selectionStrategy: 'single',
      actualFanout: 1,
      status: 'mocked',
    });
    expect(result.calls).toEqual([
      expect.objectContaining({
        callSid: 'mock-call-m1',
        contactId: 'contact-m1',
        callerId: '+12025550123',
      }),
    ]);
    expect(calls).toEqual([
      'resolve-direct-targets',
      'resolve-caller-ids',
      'create-direct-queue:contact-m1',
      'create-mock-calls:session-m1',
    ]);
  });
});
