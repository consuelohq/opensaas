import { Effect, Either, Layer } from 'effect';

import {
  DialerCallRepository,
  type DialerCallRepositoryService,
  DialerCallRuntime,
  type DialerCallRuntimeService,
  DialerTargetRepository,
  type DialerTargetRepositoryService,
} from '../ports/dialer-call-start';
import {
  ParallelCompatibilityRuntime,
  type ParallelCompatibilityRuntimeService,
} from '../ports/parallel-compatibility';
import { DialerIdGenerator } from '../ports/id-generator';
import type { ParallelGroup } from '../types';
import { startDialerCall } from './start-dialer-call';
import { markParallelAgentReady } from './parallel-compatibility-application';
import { processParallelCallback } from './process-parallel-callback';

const context = { workspaceId: 'workspace-1', userId: 'user-1' };

const targetRepository = (calls: string[]): DialerTargetRepositoryService => ({
  resolveInputQueueId: (input) =>
    Effect.sync(() => {
      calls.push(`queue:${input.workspaceId}`);
      return 'queue-1';
    }),
  resolveDirectTargets: (input) =>
    Effect.sync(() => {
      calls.push(`direct:${input.workspaceId}`);
      return [{ contactId: 'contact-1', phone: '+15551111111' }];
    }),
  resolveQueueTargets: (input) =>
    Effect.sync(() => {
      calls.push(`targets:${input.workspaceId}`);
      return [
        { contactId: 'contact-1', phone: '+15551111111' },
        { contactId: 'contact-2', phone: '+15552222222' },
      ];
    }),
  createDirectQueue: (input) =>
    Effect.sync(() => {
      calls.push(`create-queue:${input.workspaceId}`);
      return 'direct-queue-1';
    }),
});

const callRepository = (calls: string[]): DialerCallRepositoryService => ({
  createMockCalls: (input) =>
    Effect.sync(() => {
      calls.push(`mock:${input.workspaceId}`);
      return input.targets.map((target, index) => ({
        callSid: `mock-${index + 1}`,
        contactId: target.contactId,
        customerNumber: target.phone,
        callerId: input.callerIds[index],
        status: 'mocked',
        position: index + 1,
      }));
    }),
});

const runtime = (calls: string[]): DialerCallRuntimeService => ({
  assertSafeTargetsAllowed: (input) =>
    Effect.sync(() => {
      calls.push(`allowlist:${input.workspaceId}`);
    }),
  resolveCallerIds: (input) =>
    Effect.sync(() => {
      calls.push(`caller-ids:${input.workspaceId}`);
      return ['+15553333333', '+15554444444'];
    }),
  initiateProviderCalls: (input) =>
    Effect.sync(() => {
      calls.push(`provider:${input.workspaceId}`);
      return {
        twilioGroupId: 'pg-1',
        calls: input.targets.map((target, index) => ({
          callSid: `CA_${index + 1}`,
          contactId: target.contactId,
          customerNumber: target.phone,
          callerId: input.callerIds[index],
          status: 'dialing',
          position: index + 1,
        })),
      };
    }),
});

const startLayer = (calls: string[]) =>
  Layer.mergeAll(
    Layer.succeed(DialerTargetRepository, targetRepository(calls)),
    Layer.succeed(DialerCallRepository, callRepository(calls)),
    Layer.succeed(DialerCallRuntime, runtime(calls)),
    Layer.succeed(DialerIdGenerator, {
      generateParallelGroupId: Effect.succeed('pg-unused'),
      generateDialerSessionId: Effect.succeed('session-1'),
    }),
  );

const parallelRuntime = (
  overrides: Partial<ParallelCompatibilityRuntimeService> = {},
): ParallelCompatibilityRuntimeService => ({
  normalizeCustomerNumber: (value) => Effect.succeed(String(value)),
  resolveStrategy: () =>
    Effect.succeed({
      profile: {
        id: 'balanced',
        fanout: 2,
        staggerMs: 0,
        amdPolicy: 'human-only',
        terminationPolicy: 'winner-take-all',
      },
      reason: 'test',
    }),
  listNumbers: () => Effect.succeed([]),
  resolveCallerId: () => Effect.succeed('+15553333333'),
  acquireCallerIdLock: () => Effect.succeed(true),
  transferCallerIdLock: () => Effect.succeed(true),
  refreshCallerIdLock: () => Effect.void,
  releaseCallerIdLocks: () => Effect.void,
  initiateGroup: () =>
    Effect.succeed({
      groupId: 'pg-1',
      conferenceName: 'conference-1',
      profileId: 'balanced',
      calls: [],
    }),
  terminateGroup: () => Effect.void,
  validateRequirements: (current, required) => ({
    valid: current >= required,
    required,
    current,
    missing: Math.max(0, required - current),
  }),
  handleStatusCallback: () => Effect.void,
  getGroupIdForCall: () => Effect.succeed(null),
  getGroup: () => Effect.succeed(null),
  getReleasableNumbers: () => [],
  getGroupForWorkspace: () => Effect.succeed(null),
  generateCustomerTwiml: () => Effect.succeed(null),
  terminateGroupForWorkspace: () => Effect.succeed(false),
  retryPendingCleanup: () => Effect.succeed({ retried: 0, remaining: 0 }),
  claimTelemetryEmission: () => Effect.succeed(false),
  recordTelemetry: () => Effect.void,
  ...overrides,
});

describe('dialer compatibility application contracts', () => {
  it('propagates workspace identity through start repositories and invokes the provider once', async () => {
    const calls: string[] = [];

    const result = await Effect.runPromise(
      startDialerCall({
        ...context,
        input: {
          source: 'queue',
          selectionStrategy: 'predictive',
          requestedFanout: 2,
          queueId: 'queue-1',
          callMode: 'live',
        },
      }).pipe(Effect.provide(startLayer(calls))),
    );

    expect(result.twilioGroupId).toBe('pg-1');
    expect(result.actualFanout).toBe(2);
    expect(calls).toEqual([
      'queue:workspace-1',
      'targets:workspace-1',
      'allowlist:workspace-1',
      'caller-ids:workspace-1',
      'provider:workspace-1',
    ]);
  });

  it('uses repository-backed mock persistence without invoking the provider', async () => {
    const calls: string[] = [];

    const result = await Effect.runPromise(
      startDialerCall({
        ...context,
        input: {
          source: 'direct',
          selectionStrategy: 'single',
          requestedFanout: 1,
          targetPhone: '+15551111111',
          callMode: 'mock',
        },
      }).pipe(Effect.provide(startLayer(calls))),
    );

    expect(result.status).toBe('mocked');
    expect(calls).toEqual([
      'direct:workspace-1',
      'caller-ids:workspace-1',
      'create-queue:workspace-1',
      'mock:workspace-1',
    ]);
  });

  it('retries winner cleanup after the browser agent media leg becomes ready', async () => {
    let cleanupAttempts = 0;
    const group: ParallelGroup = {
      groupId: 'pg-agent-ready',
      conferenceName: 'conference-agent-ready',
      status: 'connected',
      winnerSid: 'CA_winner',
      calls: [],
      workspaceId: 'workspace-1',
      queueId: 'queue-1',
      userId: 'user-1',
      createdAt: '2026-08-03T18:00:00.000Z',
      resolverReason: 'test',
      profile: {
        id: 'balanced',
        fanout: 1,
        staggerMs: 0,
        amdPolicy: 'human-only',
        terminationPolicy: 'winner-take-all',
      },
      cleanupFailures: [
        {
          action: 'unmute-winner',
          callSid: 'CA_winner',
          message: 'Active conference not found',
          attempts: 1,
          firstFailedAt: '2026-08-03T18:00:01.000Z',
          lastFailedAt: '2026-08-03T18:00:01.000Z',
          retryable: true,
        },
      ],
    };
    const service = parallelRuntime({
      getGroupForWorkspace: () => Effect.succeed(group),
      retryPendingCleanup: () =>
        Effect.sync(() => {
          cleanupAttempts += 1;
          return cleanupAttempts === 1
            ? { retried: 1, remaining: 1 }
            : { retried: 1, remaining: 0 };
        }),
    });

    const result = await Effect.runPromise(
      markParallelAgentReady({
        groupId: group.groupId,
        workspaceId: group.workspaceId,
      }).pipe(
        Effect.provide(Layer.succeed(ParallelCompatibilityRuntime, service)),
      ),
    );

    expect(cleanupAttempts).toBe(2);
    expect(result).toEqual({
      groupId: group.groupId,
      status: 'connected',
      remainingCleanup: 0,
    });
  });

  it('invokes the shared callback runtime exactly once and returns its lifecycle result', async () => {
    const invocations: Array<Record<string, string | undefined>> = [];
    const service = parallelRuntime({
      handleStatusCallback: (input) =>
        Effect.sync(() => {
          invocations.push(input);
        }),
    });

    const result = await Effect.runPromise(
      processParallelCallback({
        callSid: 'CA_1',
        callStatus: 'in-progress',
        answeredBy: 'human',
      }).pipe(
        Effect.provide(Layer.succeed(ParallelCompatibilityRuntime, service)),
      ),
    );

    expect(result).toEqual({ received: true, groupId: null });
    expect(invocations).toEqual([
      {
        callSid: 'CA_1',
        callStatus: 'in-progress',
        answeredBy: 'human',
      },
    ]);
  });

  it('records terminal telemetry for an all-no-answer group', async () => {
    const group: ParallelGroup = {
      groupId: 'pg-no-answer',
      conferenceName: 'conference-no-answer',
      status: 'completed',
      winnerSid: null,
      calls: [
        {
          callSid: 'CA_no_answer',
          customerNumber: '+15551111111',
          fromNumber: '+15553333333',
          position: 1,
          status: 'no-answer',
          contactId: 'contact-1',
          dialStartedAt: '2026-08-01T12:00:00.000Z',
          terminatedAt: '2026-08-01T12:00:30.000Z',
        },
      ],
      workspaceId: 'workspace-1',
      queueId: 'queue-1',
      userId: 'user-1',
      createdAt: '2026-08-01T12:00:00.000Z',
      completedAt: '2026-08-01T12:00:30.000Z',
      profile: {
        id: 'balanced',
        fanout: 1,
        staggerMs: 0,
        amdPolicy: 'human-or-unknown',
        terminationPolicy: 'winner-take-all',
      },
      resolverReason: 'test',
      cleanupFailures: [],
    };
    let telemetryRecords = 0;
    const service = parallelRuntime({
      getGroupIdForCall: () => Effect.succeed(group.groupId),
      getGroup: () => Effect.succeed(group),
      claimTelemetryEmission: () => Effect.succeed(true),
      recordTelemetry: (record) =>
        Effect.sync(() => {
          telemetryRecords += 1;
          expect(record.success).toBe(false);
          expect(record.group.groupId).toBe(group.groupId);
        }),
    });

    await Effect.runPromise(
      processParallelCallback({
        callSid: 'CA_no_answer',
        callStatus: 'no-answer',
      }).pipe(
        Effect.provide(Layer.succeed(ParallelCompatibilityRuntime, service)),
      ),
    );

    expect(telemetryRecords).toBe(1);
  });

  it('preserves typed callback failures from the shared runtime', async () => {
    const failure = {
      _tag: 'DialerStateError' as const,
      operation: 'callback',
    };
    const service = parallelRuntime({
      handleStatusCallback: () => Effect.fail(failure as never),
    });

    const result = await Effect.runPromise(
      Effect.either(
        processParallelCallback({
          callSid: 'CA_1',
          callStatus: 'completed',
        }).pipe(
          Effect.provide(Layer.succeed(ParallelCompatibilityRuntime, service)),
        ),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) return;
    expect(result.left).toEqual(failure);
  });
});
