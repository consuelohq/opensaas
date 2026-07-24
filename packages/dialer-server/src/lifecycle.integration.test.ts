import { describe, expect, it } from 'bun:test';
import {
  CallProvider,
  DialerCallRepository,
  DialerCallRuntime,
  DialerClock,
  DialerIdGenerator,
  DialerRequestError,
  DialerTargetRepository,
  InMemoryParallelStore,
  ParallelCompatibilityRuntime,
  ParallelStateStore,
  createParallelStateStoreLayer,
  getCallSession,
  initiateParallelDial,
  getCallSessionForWorkspace,
  processProviderCallback,
  startParallelSession,
  terminateCallSession,
  terminateCallSessionForWorkspace,
  type CallProviderService,
  type DialerCallRepositoryService,
  type DialerCallRuntimeService,
  type DialerClockService,
  type DialerIdGeneratorService,
  type DialerTargetRepositoryService,
  type ParallelCompatibilityRuntimeService,
  type ParallelGroup,
  type ParallelStateStoreService,
  type PhoneNumber,
} from '@consuelo/dialer';
import { Effect, Layer } from 'effect';

import { createDialerServer } from './app';
import { createEffectDialerApplication } from './application';

const profile = {
  id: 'conservative' as const,
  fanout: 2,
  staggerMs: 0,
  amdPolicy: 'human-or-unknown' as const,
  terminationPolicy: 'winner-take-all' as const,
};

describe('dialer-server in-memory lifecycle', () => {
  it('starts through Hono, selects one winner, terminates the loser, completes, and releases locks', async () => {
    const store = new InMemoryParallelStore();
    const terminated: string[] = [];
    const unmuted: string[] = [];
    const locks = new Map<string, string>();
    let callSequence = 0;
    let telemetryCount = 0;

    const provider: CallProviderService = {
      createCall: () =>
        Effect.sync(() => ({ callSid: `CA_${++callSequence}` })),
      terminateCall: (callSid) =>
        Effect.sync(() => {
          terminated.push(callSid);
        }),
      unmuteConferenceParticipant: (_conferenceName, callSid) =>
        Effect.sync(() => {
          unmuted.push(callSid);
        }),
    };
    const clock: DialerClockService = {
      now: Effect.sync(() => new Date('2026-07-23T20:00:00.000Z')),
      sleep: () => Effect.void,
    };
    let groupSequence = 0;
    const ids: DialerIdGeneratorService = {
      generateParallelGroupId: Effect.sync(() => `group-${++groupSequence}`),
      generateDialerSessionId: Effect.succeed('session-1'),
    };
    const stateLayer = createParallelStateStoreLayer(store);
    const coreLayer = Layer.mergeAll(
      Layer.succeed(CallProvider, provider),
      stateLayer,
      Layer.succeed(DialerClock, clock),
      Layer.succeed(DialerIdGenerator, ids),
    );

    const getGroupIdForCall = (callSid: string) =>
      Effect.gen(function* () {
        const state = yield* ParallelStateStore;
        return yield* state.getGroupIdForCall(callSid);
      }).pipe(Effect.provide(coreLayer));
    const claimTelemetry = (groupId: string) =>
      Effect.gen(function* () {
        const state = yield* ParallelStateStore;
        return yield* state.claimTelemetryEmission(
          groupId,
          '2026-07-23T20:01:00.000Z',
          43_200,
        );
      }).pipe(Effect.provide(coreLayer));

    const numbers: PhoneNumber[] = [
      {
        phoneNumber: '+15551110001',
        areaCode: '555',
        isPrimary: true,
        isActive: true,
      },
      {
        phoneNumber: '+15551110002',
        areaCode: '555',
        isPrimary: false,
        isActive: true,
      },
    ];
    const numberByTarget = new Map([
      ['+15550000001', numbers[0].phoneNumber],
      ['+15550000002', numbers[1].phoneNumber],
    ]);

    const parallelRuntime: ParallelCompatibilityRuntimeService = {
      normalizeCustomerNumber: (value) =>
        typeof value === 'string' && value
          ? Effect.succeed(value)
          : Effect.fail(
              new DialerRequestError({
                code: 'INVALID_PHONE',
                message: 'Invalid phone',
                retryable: false,
              }),
            ),
      resolveStrategy: () =>
        Effect.succeed({ profile, reason: 'integration-test' }),
      listNumbers: () => Effect.succeed(numbers),
      resolveCallerId: ({ customerNumber }) =>
        Effect.succeed(
          numberByTarget.get(customerNumber) ?? numbers[0].phoneNumber,
        ),
      acquireCallerIdLock: ({ phoneNumber, callSid }) =>
        Effect.sync(() => {
          if (locks.has(phoneNumber)) return false;
          locks.set(phoneNumber, callSid);
          return true;
        }),
      transferCallerIdLock: ({ phoneNumber, expectedCallSid, callSid }) =>
        Effect.sync(() => {
          if (locks.get(phoneNumber) !== expectedCallSid) return false;
          locks.set(phoneNumber, callSid);
          return true;
        }),
      refreshCallerIdLock: (call) =>
        Effect.sync(() => {
          if (locks.get(call.fromNumber) === call.callSid)
            locks.set(call.fromNumber, call.callSid);
        }),
      releaseCallerIdLocks: (fromNumbers) =>
        Effect.sync(() => {
          for (const number of fromNumbers) locks.delete(number);
        }),
      initiateGroup: (options) =>
        startParallelSession(options).pipe(Effect.provide(coreLayer)),
      terminateGroup: (groupId) =>
        terminateCallSession(groupId).pipe(Effect.provide(coreLayer)),
      validateRequirements: (current, required) => ({
        valid: current >= required,
        required,
        current,
        missing: Math.max(0, required - current),
      }),
      handleStatusCallback: (input) =>
        processProviderCallback(input).pipe(Effect.provide(coreLayer)),
      getGroupIdForCall,
      getGroup: (groupId) =>
        getCallSession(groupId).pipe(Effect.provide(coreLayer)),
      getReleasableNumbers: (group) =>
        group.calls
          .filter((call) => call.callSid !== group.winnerSid)
          .map((call) => call.fromNumber),
      getGroupForWorkspace: (groupId, workspaceId) =>
        getCallSessionForWorkspace(groupId, workspaceId).pipe(
          Effect.provide(coreLayer),
        ),
      generateCustomerTwiml: (callSid) =>
        Effect.gen(function* () {
          const groupId = yield* getGroupIdForCall(callSid);
          return groupId
            ? '<Response><Dial><Conference>test</Conference></Dial></Response>'
            : null;
        }),
      terminateGroupForWorkspace: (groupId, workspaceId) =>
        terminateCallSessionForWorkspace(groupId, workspaceId).pipe(
          Effect.provide(coreLayer),
        ),
      claimTelemetryEmission: claimTelemetry,
      recordTelemetry: () =>
        Effect.sync(() => {
          telemetryCount += 1;
        }),
    };
    const parallelLayer = Layer.succeed(
      ParallelCompatibilityRuntime,
      parallelRuntime,
    );

    const targets: DialerTargetRepositoryService = {
      resolveInputQueueId: ({ input }) =>
        Effect.succeed(input.queueId ?? 'queue-1'),
      resolveDirectTargets: ({ input }) =>
        Effect.succeed([
          {
            contactId: input.contactId ?? 'contact-1',
            phone: input.targetPhone ?? '',
          },
        ]),
      resolveQueueTargets: ({ fallbackPhonesByContactId }) =>
        Effect.succeed(
          [...fallbackPhonesByContactId.entries()].map(
            ([contactId, phone]) => ({ contactId, phone }),
          ),
        ),
      createDirectQueue: () => Effect.succeed('queue-direct'),
    };
    const calls: DialerCallRepositoryService = {
      createMockCalls: () => Effect.succeed([]),
    };
    const runtime: DialerCallRuntimeService = {
      assertSafeTargetsAllowed: () => Effect.void,
      resolveCallerIds: ({ targetCount }) =>
        Effect.succeed(
          numbers.slice(0, targetCount).map((number) => number.phoneNumber),
        ),
      initiateProviderCalls: (input) =>
        Effect.gen(function* () {
          const result = yield* initiateParallelDial({
            body: {
              customerNumbers: input.targets.map((target) => target.phone),
              contactIds: input.targets.map((target) => target.contactId),
              queueId: input.queueId,
              profileId: 'conservative',
            },
            userId: input.userId,
            workspaceId: input.workspaceId,
            callbackBaseUrl: 'https://dialer.test',
          }).pipe(Effect.provide(parallelLayer));
          return {
            twilioGroupId: result.groupId,
            calls: result.calls.map((call) => ({
              callSid: call.callSid,
              contactId: input.targets[call.position - 1].contactId,
              customerNumber: call.customerNumber,
              callerId: call.fromNumber,
              status: call.status,
              position: call.position,
            })),
          };
        }),
    };
    const startLayer = Layer.mergeAll(
      Layer.succeed(DialerTargetRepository, targets),
      Layer.succeed(DialerCallRepository, calls),
      Layer.succeed(DialerCallRuntime, runtime),
      Layer.succeed(DialerIdGenerator, ids),
    );

    const app = createDialerServer({
      application: createEffectDialerApplication({ startLayer, parallelLayer }),
      authenticate: async () => ({
        workspaceId: 'workspace-1',
        userId: 'user-1',
      }),
      verifyTwilioSignature: async () => true,
    });
    const startResponse = await app.request('/v1/call-sessions', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        source: 'queue',
        selectionStrategy: 'predictive',
        requestedFanout: 2,
        queueId: 'queue-1',
        contactIds: ['contact-1', 'contact-2'],
        targetPhones: ['+15550000001', '+15550000002'],
        callMode: 'live',
      }),
    });
    expect(startResponse.status).toBe(201);
    const start = (await startResponse.json()) as { providerGroupId: string };
    expect(start.providerGroupId).toBe('group-1');
    expect(locks.size).toBe(2);

    const callbackHeaders = {
      'content-type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': 'valid',
    };
    const winnerResponse = await app.request('/webhooks/twilio/status', {
      method: 'POST',
      headers: callbackHeaders,
      body: 'CallSid=CA_1&CallStatus=in-progress&AnsweredBy=human',
    });
    expect(winnerResponse.status).toBe(200);
    expect(terminated).toEqual(['CA_2']);
    expect(unmuted).toEqual(['CA_1']);
    expect(locks.size).toBe(1);

    const terminalResponse = await app.request('/webhooks/twilio/status', {
      method: 'POST',
      headers: callbackHeaders,
      body: 'CallSid=CA_1&CallStatus=completed&AnsweredBy=human&CallDuration=40',
    });
    expect(terminalResponse.status).toBe(200);
    expect(locks.size).toBe(0);
    expect(telemetryCount).toBe(1);

    const terminationResponse = await app.request(
      '/v1/call-sessions/group-1/terminate',
      {
        method: 'POST',
        headers: { authorization: 'Bearer test' },
      },
    );
    expect(terminationResponse.status).toBe(200);

    const statusResponse = await app.request('/v1/call-sessions/group-1', {
      headers: { authorization: 'Bearer test' },
    });
    expect(statusResponse.status).toBe(200);
    const status = (await statusResponse.json()) as {
      status: string;
      winnerSid: string | null;
      calls: Array<{ callSid: string; status: string }>;
    };
    expect(status.status).toBe('completed');
    expect(status.winnerSid).toBe('CA_1');
    expect(status.calls).toEqual([
      expect.objectContaining({ callSid: 'CA_1', status: 'completed' }),
      expect.objectContaining({ callSid: 'CA_2', status: 'completed' }),
    ]);
  });
});
