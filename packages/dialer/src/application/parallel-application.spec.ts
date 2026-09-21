import { Effect, Either, Fiber, Layer } from 'effect';

import {
  DialerCleanupError,
  DialerProviderError,
  DialerStateError,
  DialerTransitionError,
} from '../errors/dialer-errors';
import type {
  ParallelCall,
  ParallelDialOptions,
  ParallelGroup,
  PredictiveDecisionContext,
} from '../types';
import { processProviderCallback } from './process-provider-callback';
import { retryPendingCleanup } from './retry-pending-cleanup';
import { startParallelSession } from './start-parallel-session';
import { CallProvider, type CallProviderService } from '../ports/call-provider';
import { DialerClock, type DialerClockService } from '../ports/clock';
import {
  DialerIdGenerator,
  type DialerIdGeneratorService,
} from '../ports/id-generator';
import {
  ParallelStateStore,
  type ParallelStateStoreService,
} from '../ports/parallel-state-store';

const baseOptions: ParallelDialOptions = {
  workspaceId: 'workspace-1',
  customerNumbers: ['+15551111111', '+15552222222'],
  fromNumbers: ['+15553333333', '+15554444444'],
  queueId: 'queue-1',
  userId: 'user-1',
  statusCallbackUrl: 'https://example.com/status',
  customerTwimlUrl: 'https://example.com/twiml',
  profile: {
    id: 'balanced',
    fanout: 2,
    staggerMs: 0,
    amdPolicy: 'human-or-unknown',
    terminationPolicy: 'winner-take-all',
  },
};

type TestState = {
  groups: Map<string, ParallelGroup>;
  callMappings: Map<string, string>;
  winner: Map<string, string>;
};

const createStateService = (state: TestState): ParallelStateStoreService => {
  const service: ParallelStateStoreService = {
    setGroup: (group) =>
      Effect.sync(() => {
        state.groups.set(group.groupId, structuredClone(group));
      }),
    getGroup: (groupId) =>
      Effect.sync(() => {
        const group = state.groups.get(groupId);
        return group ? structuredClone(group) : null;
      }),
    registerCall: (groupId, call) =>
      Effect.sync(() => {
        const group = state.groups.get(groupId);
        if (!group) throw new Error('group missing');
        if (
          !group.calls.some((candidate) => candidate.callSid === call.callSid)
        ) {
          group.calls.push(structuredClone(call));
        }
        state.callMappings.set(call.callSid, groupId);
      }),
    getGroupIdForCall: (callSid) =>
      Effect.sync(() => state.callMappings.get(callSid) ?? null),
    claimWinner: (groupId, callSid) =>
      Effect.sync(() => {
        if (state.winner.has(groupId)) return false;
        state.winner.set(groupId, callSid);
        return true;
      }),
    getWinner: (groupId) =>
      Effect.sync(() => state.winner.get(groupId) ?? null),
    claimTelemetryEmission: (groupId, emittedAt) =>
      Effect.sync(() => {
        const group = state.groups.get(groupId);
        if (!group || group.telemetryEmittedAt) return false;
        group.telemetryEmittedAt = emittedAt;
        return true;
      }),
    withGroupLock: (_groupId, operation) => operation,
    deleteGroup: (groupId) =>
      Effect.sync(() => {
        state.groups.delete(groupId);
        state.winner.delete(groupId);
      }),
  };

  return service;
};

const createStateLayer = (state: TestState) =>
  Layer.succeed(ParallelStateStore, createStateService(state));

const createProviderLayer = (overrides: Partial<CallProviderService> = {}) => {
  let callNumber = 0;
  const service: CallProviderService = {
    createCall: () =>
      Effect.sync(() => {
        callNumber += 1;
        return { callSid: `CA_${callNumber}` };
      }),
    terminateCall: () => Effect.void,
    unmuteConferenceParticipant: () => Effect.void,
    ...overrides,
  };

  return Layer.succeed(CallProvider, service);
};

const clockService: DialerClockService = {
  now: Effect.succeed(new Date('2026-07-23T12:00:00.000Z')),
  sleep: () => Effect.void,
};

const idService: DialerIdGeneratorService = {
  generateParallelGroupId: Effect.succeed('pg_test'),
  generateDialerSessionId: Effect.succeed('session_test'),
};

const createLayer = (state: TestState, providerLayer = createProviderLayer()) =>
  Layer.mergeAll(
    createStateLayer(state),
    providerLayer,
    Layer.succeed(DialerClock, clockService),
    Layer.succeed(DialerIdGenerator, idService),
  );

const createState = (): TestState => ({
  groups: new Map(),
  callMappings: new Map(),
  winner: new Map(),
});

const cleanupGroup = (): ParallelGroup => ({
  groupId: 'pg_cleanup',
  conferenceName: 'pg_cleanup_queue-1',
  status: 'connected',
  winnerSid: 'CA_winner',
  calls: [
    {
      callSid: 'CA_retryable',
      customerNumber: '+15551111111',
      fromNumber: '+15552222222',
      position: 1,
      status: 'dialing',
      dialStartedAt: '2026-07-23T12:00:00.000Z',
    },
    {
      callSid: 'CA_non_retryable',
      customerNumber: '+15553333333',
      fromNumber: '+15554444444',
      position: 2,
      status: 'dialing',
      dialStartedAt: '2026-07-23T12:00:00.000Z',
    },
  ],
  workspaceId: 'workspace-1',
  queueId: 'queue-1',
  userId: 'user-1',
  createdAt: '2026-07-23T12:00:00.000Z',
  connectedAt: '2026-07-23T12:00:05.000Z',
  profile: baseOptions.profile,
  resolverReason: 'route-resolved',
  cleanupFailures: [
    {
      action: 'terminate-call',
      callSid: 'CA_retryable',
      message: 'temporary provider failure',
      attempts: 1,
      firstFailedAt: '2026-07-23T12:00:05.000Z',
      lastFailedAt: '2026-07-23T12:00:05.000Z',
      retryable: true,
    },
    {
      action: 'terminate-call',
      callSid: 'CA_non_retryable',
      message: 'invalid provider call id',
      attempts: 1,
      firstFailedAt: '2026-07-23T12:00:05.000Z',
      lastFailedAt: '2026-07-23T12:00:05.000Z',
      retryable: false,
    },
  ],
});

describe('parallel Effect application programs', () => {
  it('substitutes deterministic provider, state, clock, and id Layers', async () => {
    const state = createState();

    const result = await Effect.runPromise(
      startParallelSession(baseOptions).pipe(
        Effect.provide(createLayer(state)),
      ),
    );

    expect(result).toEqual(
      expect.objectContaining({
        groupId: 'pg_test',
        conferenceName: 'pg_test_queue-1',
        profileId: 'balanced',
      }),
    );
    expect(result.calls.map((call) => call.callSid)).toEqual(['CA_1', 'CA_2']);
    expect(state.groups.get('pg_test')).toEqual(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        status: 'dialing',
      }),
    );
    expect(state.callMappings).toEqual(
      new Map([
        ['CA_1', 'pg_test'],
        ['CA_2', 'pg_test'],
      ]),
    );
  });

  it('carries immutable predictive decision context into the stored provider calls', async () => {
    const state = createState();
    const context: PredictiveDecisionContext = {
      schemaVersion: 2,
      capturedAt: '2026-07-23T11:59:00.000Z',
      timezone: 'UTC',
      timezoneSource: 'workspace_fallback',
      localHour: 11,
      localDayOfWeek: 4,
      attemptsUsed: 1,
      attemptsToday: 1,
      attemptsThisWeek: 2,
      minutesSinceLastAttempt: 120,
      localPresenceRequested: true,
      source: {
        opportunityId: 'opportunity-1',
        opportunityValue: 1_000,
      },
      d3: {
        nextAttemptNumber: 2,
        answerProbability: 0.4,
        answerProbabilityUpperBound: 0.6,
        score: 59,
        hazardSource: 'exact_local_slot',
        suppressed: false,
      },
    };

    await Effect.runPromise(
      startParallelSession({
        ...baseOptions,
        contactIds: ['contact-1', 'contact-2'],
        predictiveDecisionIds: ['decision-1', null],
        decisionContexts: [context, null],
      }).pipe(Effect.provide(createLayer(state))),
    );

    expect(state.groups.get('pg_test')?.calls[0]).toEqual(
      expect.objectContaining({
        contactId: 'contact-1',
        predictiveDecisionId: 'decision-1',
        decisionContext: context,
      }),
    );
    expect(state.groups.get('pg_test')?.calls[1]).toEqual(
      expect.objectContaining({ contactId: 'contact-2' }),
    );
    expect(state.groups.get('pg_test')?.calls[1]?.decisionContext).toBeUndefined();
  });

  it('preserves a typed retryable provider failure', async () => {
    const state = createState();
    const providerError = new DialerProviderError({
      operation: 'create-call',
      message: 'provider unavailable',
      retryable: true,
    });
    const layer = createLayer(
      state,
      createProviderLayer({ createCall: () => Effect.fail(providerError) }),
    );

    const result = await Effect.runPromise(
      Effect.either(
        startParallelSession(baseOptions).pipe(Effect.provide(layer)),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) return;
    expect(result.left).toEqual(
      expect.objectContaining({
        _tag: 'DialerProviderError',
        operation: 'create-call',
        message: 'provider unavailable',
        retryable: true,
      }),
    );
    expect(state.groups.get('pg_test')).toEqual(
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('returns a typed non-retryable transition failure', async () => {
    const state = createState();
    const group = cleanupGroup();
    group.cleanupFailures = [];
    state.groups.set(group.groupId, group);
    state.callMappings.set('CA_unknown', group.groupId);

    const result = await Effect.runPromise(
      Effect.either(
        processProviderCallback({
          callSid: 'CA_unknown',
          callStatus: 'in-progress',
          answeredBy: 'human',
        }).pipe(Effect.provide(createLayer(state))),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) return;
    expect(result.left).toBeInstanceOf(DialerTransitionError);
    expect(result.left.retryable).toBe(false);
  });

  it('preserves a typed retryable state failure from a substituted Layer', async () => {
    const state = createState();
    const stateError = new DialerStateError({
      operation: 'get-call-mapping',
      message: 'state temporarily unavailable',
      retryable: true,
    });
    const stateLayer = Layer.succeed(ParallelStateStore, {
      ...createStateService(state),
      getGroupIdForCall: () => Effect.fail(stateError),
    });
    const layer = Layer.mergeAll(
      stateLayer,
      createProviderLayer(),
      Layer.succeed(DialerClock, clockService),
      Layer.succeed(DialerIdGenerator, idService),
    );

    const result = await Effect.runPromise(
      Effect.either(
        processProviderCallback({
          callSid: 'CA_state_error',
          callStatus: 'ringing',
        }).pipe(Effect.provide(layer)),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) return;
    expect(result.left).toEqual(
      expect.objectContaining({
        _tag: 'DialerStateError',
        operation: 'get-call-mapping',
        message: 'state temporarily unavailable',
        retryable: true,
      }),
    );
    expect(result.left.retryable).toBe(true);
  });

  it('retries only cleanup failures classified as retryable', async () => {
    const state = createState();
    const group = cleanupGroup();
    state.groups.set(group.groupId, group);
    const terminated: string[] = [];
    const providerLayer = createProviderLayer({
      terminateCall: (callSid) =>
        Effect.sync(() => {
          terminated.push(callSid);
        }),
    });

    const result = await Effect.runPromise(
      retryPendingCleanup(group.groupId).pipe(
        Effect.provide(createLayer(state, providerLayer)),
      ),
    );

    expect(result).toEqual({ retried: 1, remaining: 1, errors: [] });
    expect(terminated).toEqual(['CA_retryable']);
    expect(state.groups.get(group.groupId)?.cleanupFailures).toEqual([
      expect.objectContaining({
        callSid: 'CA_non_retryable',
        retryable: false,
      }),
    ]);
  });

  it('returns typed cleanup failures while preserving durable reconciliation state', async () => {
    const state = createState();
    const group = cleanupGroup();
    state.groups.set(group.groupId, group);
    const providerError = new DialerProviderError({
      operation: 'terminate-call',
      message: 'provider rejected cleanup',
      retryable: false,
    });
    const providerLayer = createProviderLayer({
      terminateCall: () => Effect.fail(providerError),
    });

    const result = await Effect.runPromise(
      retryPendingCleanup(group.groupId).pipe(
        Effect.provide(createLayer(state, providerLayer)),
      ),
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBeInstanceOf(DialerCleanupError);
    expect(result.errors[0]).toEqual(
      expect.objectContaining({ retryable: false, callSid: 'CA_retryable' }),
    );
    expect(state.groups.get(group.groupId)?.cleanupFailures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          callSid: 'CA_retryable',
          retryable: false,
        }),
      ]),
    );
  });

  it('times out provider creation without losing the persisted failed group', async () => {
    const state = createState();
    const layer = createLayer(
      state,
      createProviderLayer({ createCall: () => Effect.never }),
    );

    const result = await Effect.runPromise(
      Effect.either(
        startParallelSession(baseOptions, { providerTimeoutMs: 10 }).pipe(
          Effect.provide(layer),
        ),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) return;
    expect(result.left).toEqual(
      expect.objectContaining({
        _tag: 'DialerTimeoutError',
        operation: 'create-call',
        retryable: true,
      }),
    );
    expect(state.groups.get('pg_test')).toEqual(
      expect.objectContaining({
        status: 'failed',
        workspaceId: 'workspace-1',
      }),
    );
  });

  it('marks the persisted group failed when the start fiber is interrupted', async () => {
    const state = createState();
    const layer = createLayer(
      state,
      createProviderLayer({ createCall: () => Effect.never }),
    );
    const fiber = Effect.runFork(
      startParallelSession(baseOptions).pipe(Effect.provide(layer)),
    );

    for (
      let attempt = 0;
      attempt < 20 && !state.groups.has('pg_test');
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    await Effect.runPromise(Fiber.interrupt(fiber));

    expect(state.groups.get('pg_test')).toEqual(
      expect.objectContaining({
        status: 'failed',
        workspaceId: 'workspace-1',
      }),
    );
  });
});
