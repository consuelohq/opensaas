import type { ParallelDialProfile, ParallelGroup } from '../types';

import {
  InMemoryParallelStore,
  ParallelDialerService,
} from './parallel-dialer';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

type CleanupAwareParallelDialer = ParallelDialerService & {
  retryPendingCleanup(groupId: string): Promise<{
    retried: number;
    remaining: number;
  }>;
  getGroupForWorkspace(
    groupId: string,
    workspaceId: string,
  ): Promise<ParallelGroup | null>;
  terminateGroupForWorkspace(
    groupId: string,
    workspaceId: string,
  ): Promise<boolean>;
};

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

const mockCallsCreate = jest.fn();
const mockCallUpdate = jest.fn();
const mockParticipantUpdate = jest.fn();
const mockConferencesList = jest.fn();
const mockCallsAccessor = jest.fn((callSid: string) => ({
  update: (input: { status: string }) => mockCallUpdate(callSid, input),
}));

const mockClient = {
  calls: Object.assign(mockCallsAccessor, {
    create: mockCallsCreate,
  }),
  conferences: Object.assign(
    jest.fn(() => ({
      participants: jest.fn(() => ({
        update: mockParticipantUpdate,
      })),
    })),
    {
      list: mockConferencesList,
    },
  ),
};

jest.mock('twilio', () => ({
  __esModule: true,
  default: () => mockClient,
}));

describe('parallel dial lifecycle contract', () => {
  let store: InMemoryParallelStore;
  let service: ParallelDialerService;

  const profile: ParallelDialProfile = {
    id: 'balanced',
    fanout: 3,
    staggerMs: 0,
    amdPolicy: 'human-or-unknown',
    terminationPolicy: 'winner-take-all',
  };

  const baseOptions = {
    workspaceId: 'workspace-1',
    customerNumbers: ['+15551111111', '+15552222222', '+15553333333'],
    fromNumbers: ['+15554444444', '+15555555555', '+15556666666'],
    queueId: 'queue-1',
    userId: 'user-1',
    statusCallbackUrl: 'https://example.com/status',
    customerTwimlUrl: 'https://example.com/twiml',
    profile,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    store = new InMemoryParallelStore();
    service = new ParallelDialerService(
      { accountSid: 'AC_test', authToken: 'test_token' },
      store,
    );

    let callCount = 0;
    mockCallsCreate.mockImplementation(async () => {
      callCount += 1;
      return { sid: `CA_call_${callCount}` };
    });
    mockCallUpdate.mockResolvedValue({});
    mockConferencesList.mockResolvedValue([{ sid: 'CF_parallel' }]);
    mockParticipantUpdate.mockResolvedValue({});
  });

  it('keeps customer legs muted without provider hold music until the agent starts the conference', async () => {
    const result = await service.initiateGroup({
      ...baseOptions,
      customerNumbers: baseOptions.customerNumbers.slice(0, 1),
      fromNumbers: baseOptions.fromNumbers.slice(0, 1),
      profile: { ...profile, fanout: 1 },
    });

    const twiml = await service.generateCustomerTwiml(result.calls[0].callSid);

    expect(twiml).toContain('startConferenceOnEnter="false"');
    expect(twiml).toContain('endConferenceOnExit="false"');
    expect(twiml).toContain('waitUrl=""');
    expect(twiml).toContain('muted="true"');
    expect(twiml).toContain(
      `participantLabel="customer-${result.calls[0].callSid}"`,
    );
  });

  it('retains a callback that arrives while later legs are still being created', async () => {
    const secondCall = deferred<{ sid: string }>();
    mockCallsCreate
      .mockResolvedValueOnce({ sid: 'CA_first' })
      .mockImplementationOnce(() => secondCall.promise);

    const startPromise = service.initiateGroup({
      ...baseOptions,
      customerNumbers: baseOptions.customerNumbers.slice(0, 2),
      fromNumbers: baseOptions.fromNumbers.slice(0, 2),
      profile: { ...profile, fanout: 2 },
    });

    let groupId: string | null = null;
    for (let attempt = 0; attempt < 20 && !groupId; attempt += 1) {
      await Promise.resolve();
      groupId = await store.getCallMapping('CA_first');
    }

    expect(groupId).not.toBeNull();
    await service.handleStatusCallback('CA_first', 'in-progress', 'human');

    secondCall.resolve({ sid: 'CA_second' });
    const result = await startPromise;
    const group = await service.getGroup(result.groupId);

    expect(group?.winnerSid).toBe('CA_first');
    expect(group?.status).toBe('connected');
    expect(
      group?.calls.find((call) => call.callSid === 'CA_first')?.status,
    ).toBe('in-progress');
  });

  it('keeps exactly one durable winner under simultaneous human callbacks', async () => {
    const result = await service.initiateGroup(baseOptions);
    const [first, second] = result.calls;

    await Promise.all([
      service.handleStatusCallback(first.callSid, 'in-progress', 'human'),
      service.handleStatusCallback(second.callSid, 'in-progress', 'human'),
    ]);

    const group = await service.getGroup(result.groupId);
    const winnerSid = group?.winnerSid;

    expect([first.callSid, second.callSid]).toContain(winnerSid);
    expect(group?.status).toBe('connected');
    expect(
      group?.calls.filter((call) => call.status === 'in-progress'),
    ).toHaveLength(1);
    expect(mockParticipantUpdate).toHaveBeenCalledTimes(1);
    expect(mockParticipantUpdate).toHaveBeenCalledWith({
      muted: false,
      endConferenceOnExit: true,
    });
  });

  it('claims telemetry emission exactly once under concurrent callbacks', async () => {
    const result = await service.initiateGroup(baseOptions);

    const claims = await Promise.all([
      service.markTelemetryEmittedIfAbsent(result.groupId),
      service.markTelemetryEmittedIfAbsent(result.groupId),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(claims.filter((claim) => !claim)).toHaveLength(1);
  });

  it('records failed loser cleanup and clears it after reconciliation succeeds', async () => {
    const result = await service.initiateGroup({
      ...baseOptions,
      customerNumbers: baseOptions.customerNumbers.slice(0, 2),
      fromNumbers: baseOptions.fromNumbers.slice(0, 2),
      profile: { ...profile, fanout: 2 },
    });
    const [winner, loser] = result.calls;

    mockCallUpdate.mockImplementationOnce(async (callSid: string) => {
      if (callSid === loser.callSid) {
        throw new Error('provider unavailable');
      }
      return {};
    });

    await service.handleStatusCallback(winner.callSid, 'in-progress', 'human');

    const failedGroup = await service.getGroup(result.groupId);
    expect(failedGroup?.cleanupFailures).toEqual([
      expect.objectContaining({
        action: 'terminate-call',
        callSid: loser.callSid,
        attempts: 1,
      }),
    ]);
    expect(
      failedGroup?.calls.find((call) => call.callSid === loser.callSid)?.status,
    ).toBe('dialing');

    mockCallUpdate.mockResolvedValue({});
    await (service as CleanupAwareParallelDialer).retryPendingCleanup(
      result.groupId,
    );

    const reconciledGroup = await service.getGroup(result.groupId);
    expect(reconciledGroup?.cleanupFailures).toEqual([]);
    expect(
      reconciledGroup?.calls.find((call) => call.callSid === loser.callSid)
        ?.status,
    ).toBe('completed');
  });

  it('does not persist a false winner-unmute failure before the participant enters', async () => {
    const result = await service.initiateGroup({
      ...baseOptions,
      customerNumbers: baseOptions.customerNumbers.slice(0, 1),
      fromNumbers: baseOptions.fromNumbers.slice(0, 1),
      profile: { ...profile, fanout: 1 },
    });
    const [winner] = result.calls;

    mockParticipantUpdate.mockRejectedValueOnce({
      status: 404,
      code: 20404,
      message:
        'The requested resource /Conferences/CF_parallel/Participants/CA_call_1.json was not found',
    });
    await service.handleStatusCallback(winner.callSid, 'in-progress', 'human');

    const connected = await service.getGroup(result.groupId);
    expect(connected?.status).toBe('connected');
    expect(connected?.winnerSid).toBe(winner.callSid);
    expect(connected?.cleanupFailures).toEqual([]);

    const twiml = await service.generateCustomerTwiml(winner.callSid);
    expect(twiml).toContain('muted="false"');
    expect(twiml).toContain('endConferenceOnExit="false"');
  });

  it('records failed winner unmute and clears it after reconciliation succeeds', async () => {
    const result = await service.initiateGroup({
      ...baseOptions,
      customerNumbers: baseOptions.customerNumbers.slice(0, 1),
      fromNumbers: baseOptions.fromNumbers.slice(0, 1),
      profile: { ...profile, fanout: 1 },
    });
    const [winner] = result.calls;

    mockConferencesList.mockResolvedValueOnce([]);
    await service.handleStatusCallback(winner.callSid, 'in-progress', 'human');

    const failedGroup = await service.getGroup(result.groupId);
    expect(failedGroup?.status).toBe('connected');
    expect(failedGroup?.cleanupFailures).toEqual([
      expect.objectContaining({
        action: 'unmute-winner',
        callSid: winner.callSid,
        attempts: 1,
      }),
    ]);

    mockConferencesList.mockResolvedValue([{ sid: 'CF_parallel' }]);
    await (service as CleanupAwareParallelDialer).retryPendingCleanup(
      result.groupId,
    );

    const reconciledGroup = await service.getGroup(result.groupId);
    expect(reconciledGroup?.cleanupFailures).toEqual([]);
    expect(mockParticipantUpdate).toHaveBeenCalledWith({
      muted: false,
      endConferenceOnExit: true,
    });
  });

  it('completes the group when the selected winner hangs up', async () => {
    const result = await service.initiateGroup({
      ...baseOptions,
      customerNumbers: baseOptions.customerNumbers.slice(0, 2),
      fromNumbers: baseOptions.fromNumbers.slice(0, 2),
      profile: { ...profile, fanout: 2 },
    });
    const [winner] = result.calls;

    await service.handleStatusCallback(winner.callSid, 'in-progress', 'human');
    await service.handleStatusCallback(winner.callSid, 'completed');

    const completed = await service.getGroup(result.groupId);
    expect(completed?.status).toBe('completed');
    expect(completed?.completedAt).toBeDefined();
    expect(completed?.cleanupFailures).not.toContainEqual(
      expect.objectContaining({
        action: 'unmute-winner',
        callSid: winner.callSid,
      }),
    );
  });

  it('persists workspace ownership and rejects cross-workspace access', async () => {
    const result = await service.initiateGroup(baseOptions);
    const lifecycleService = service as CleanupAwareParallelDialer;

    const owned = await lifecycleService.getGroupForWorkspace(
      result.groupId,
      'workspace-1',
    );
    const foreign = await lifecycleService.getGroupForWorkspace(
      result.groupId,
      'workspace-2',
    );
    const foreignTermination =
      await lifecycleService.terminateGroupForWorkspace(
        result.groupId,
        'workspace-2',
      );

    expect(owned?.workspaceId).toBe('workspace-1');
    expect(foreign).toBeNull();
    expect(foreignTermination).toBe(false);
    expect((await service.getGroup(result.groupId))?.status).toBe('dialing');
  });

  it('ignores an answered callback after the same leg is terminal', async () => {
    const result = await service.initiateGroup(baseOptions);
    const callSid = result.calls[0].callSid;

    await service.handleStatusCallback(callSid, 'completed');
    await service.handleStatusCallback(callSid, 'in-progress', 'human');

    const group = await service.getGroup(result.groupId);
    expect(group?.winnerSid).toBeNull();
    expect(group?.calls[0].status).toBe('completed');
  });
});
