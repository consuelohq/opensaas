import { act } from '@testing-library/react';
import { type MutableSnapshot } from 'recoil';

import { useParallelDialer } from '@/dialer/hooks/useParallelDialer';
import { renderHookWithRecoil } from '@/dialer/testing/renderWithRecoil';
import {
  activeQueueState,
  currentQueueIndexState,
  queueItemsState,
} from '@/dialer/states/queueState';
import {
  DEFAULT_QUEUE_SETTINGS,
  type CallQueue,
  type QueueItem,
} from '@/dialer/types/queue';

const mockStartDialerCall = jest.fn();
const mockTerminateDialerCall = jest.fn();
const mockPlayDialingStartedSound = jest.fn();
const mockPlayErrorSound = jest.fn();

jest.mock('@/dialer/hooks/useStartDialerCall', () => ({
  useStartDialerCall: () => ({
    startDialerCall: mockStartDialerCall,
    terminateDialerCall: mockTerminateDialerCall,
  }),
}));

jest.mock('@/dialer/utils/notificationSounds', () => ({
  playDialingStartedSound: () => mockPlayDialingStartedSound(),
  playErrorSound: () => mockPlayErrorSound(),
}));

jest.mock('@sentry/react', () => ({
  captureException: jest.fn(),
}));

const createContact = (id: string, phone: string) => ({
  id,
  name: id,
  firstName: null,
  lastName: null,
  company: null,
  phone,
  email: null,
  avatarUrl: null,
});

const createQueueItem = (
  id: string,
  phone: string,
  status: QueueItem['status'],
): QueueItem => ({
  id,
  queueId: 'queue-1',
  contactId: `${id}-contact`,
  contact: createContact(id, phone),
  position: 1,
  status,
  attempts: 0,
  lastAttemptAt: null,
  callOutcome: null,
  notes: null,
  skipReason: null,
  callDurationSeconds: null,
});

const activeParallelQueue: CallQueue = {
  id: 'list-1',
  name: 'test queue',
  description: null,
  sourceType: 'list',
  sourceId: 'list-1',
  totalContacts: 2,
  completedContacts: 0,
  skippedContacts: 0,
  status: 'active',
  settings: {
    ...DEFAULT_QUEUE_SETTINGS,
    parallelDialingEnabled: true,
    parallelDialingMaxLines: 2,
  },
  createdAt: '2026-04-24T00:00:00.000Z',
  updatedAt: '2026-04-24T00:00:00.000Z',
  startedAt: '2026-04-24T00:00:00.000Z',
  completedAt: null,
  category: 'custom',
  callingMode: 'browser',
  dncFilteredCount: 0,
  parallelDialingEnabled: true,
  parallelDialFromNumbers: [],
  parallelDialingActive: false,
  parallelCurrentBatch: 0,
  parallelGroupId: null,
  parallelActiveCalls: [],
  aggregatedStats: null,
};

const queueItems = [
  createQueueItem('item-1', '+13472030054', 'calling'),
  createQueueItem('item-2', '+18054259549', 'pending'),
];

const queueItemsWithStaleListQueueId = queueItems.map((item) => ({
  ...item,
  queueId: 'list-1',
}));

const renderUseParallelDialer = (
  initializeState: (snap: MutableSnapshot) => void,
) => renderHookWithRecoil(() => useParallelDialer(), { initializeState });

describe('useParallelDialer', () => {
  beforeEach(() => {
    mockStartDialerCall.mockReset();
    mockTerminateDialerCall.mockReset();
    mockPlayDialingStartedSound.mockReset();
    mockPlayErrorSound.mockReset();
  });

  it('returns skipped without playing audio when recoil queue state is not hydrated yet', async () => {
    const { result } = renderUseParallelDialer((snap) => {
      snap.set(activeQueueState, null);
      snap.set(queueItemsState, queueItems);
      snap.set(currentQueueIndexState, 0);
    });

    let startResult: Awaited<
      ReturnType<typeof result.current.startParallelBatch>
    > | null = null;

    await act(async () => {
      startResult = await result.current.startParallelBatch();
    });

    expect(startResult).toEqual({ status: 'skipped', reason: 'disabled' });
    expect(mockPlayDialingStartedSound).not.toHaveBeenCalled();
    expect(mockStartDialerCall).not.toHaveBeenCalled();
  });

  it('starts a predictive GraphQL call with the explicit runtime queue ID', async () => {
    mockStartDialerCall.mockResolvedValue({
      sessionId: 'session_test',
      twilioGroupId: 'pg_test',
      queueId: 'queue-1',
      selectionStrategy: 'predictive',
      requestedFanout: 2,
      actualFanout: 1,
      status: 'dialing',
      capacity: {
        requestedFanout: 2,
        callableTargetCount: 2,
        availableCallerIdCount: 1,
        reducedCapacityReasons: ['caller-id-capacity'],
        blockedReasons: [],
        actualFanout: 1,
      },
      calls: [
        {
          callSid: 'CA1',
          contactId: 'item-1-contact',
          customerNumber: '+13472030054',
          callerId: '+12025550123',
          position: 1,
          status: 'dialing',
        },
      ],
    });

    const { result } = renderUseParallelDialer((snap) => {
      snap.set(activeQueueState, activeParallelQueue);
      snap.set(queueItemsState, queueItemsWithStaleListQueueId);
      snap.set(currentQueueIndexState, 0);
    });

    let startResult: Awaited<
      ReturnType<typeof result.current.startParallelBatch>
    > | null = null;

    await act(async () => {
      startResult = await result.current.startParallelBatch({
        queueId: 'queue-1',
      });
    });

    expect(startResult).toEqual({ status: 'started', groupId: 'pg_test' });
    expect(mockPlayDialingStartedSound).toHaveBeenCalledTimes(1);
    expect(mockStartDialerCall).toHaveBeenCalledWith({
      source: 'queue',
      selectionStrategy: 'predictive',
      requestedFanout: 2,
      queueId: 'queue-1',
    });
    expect(result.current.activeCalls).toEqual([
      {
        callSid: 'CA1',
        contactId: 'item-1-contact',
        customerNumber: '+13472030054',
        fromNumber: '+12025550123',
        position: 1,
        status: 'dialing',
      },
    ]);
  });

  it('terminates backend group before clearing local parallel state when canceled', async () => {
    mockTerminateDialerCall.mockResolvedValue({
      twilioGroupId: 'pg_test',
      status: 'completed',
    });
    const { result } = renderUseParallelDialer((snap) => {
      snap.set(activeQueueState, {
        ...activeParallelQueue,
        parallelDialingActive: true,
        parallelGroupId: 'pg_test',
        parallelActiveCalls: [
          {
            callSid: 'CA1',
            customerNumber: '+13472030054',
            fromNumber: '+12025550123',
            position: 1,
            status: 'dialing',
          },
        ],
      });
      snap.set(queueItemsState, queueItems);
      snap.set(currentQueueIndexState, 0);
    });

    await act(async () => {
      await result.current.cancelParallelDial();
    });

    expect(mockStartDialerCall).not.toHaveBeenCalled();
    expect(mockTerminateDialerCall).toHaveBeenCalledWith('pg_test');
    expect(result.current.activeCalls).toEqual([]);
    expect(result.current.isDialing).toBe(false);
  });

  it('keeps local parallel state visible when cancel terminate fails', async () => {
    mockTerminateDialerCall.mockRejectedValue(new Error('terminate failed'));
    const { result } = renderUseParallelDialer((snap) => {
      snap.set(activeQueueState, {
        ...activeParallelQueue,
        parallelDialingActive: true,
        parallelGroupId: 'pg_test',
        parallelActiveCalls: [
          {
            callSid: 'CA1',
            customerNumber: '+13472030054',
            fromNumber: '+12025550123',
            position: 1,
            status: 'dialing',
          },
        ],
      });
      snap.set(queueItemsState, queueItems);
      snap.set(currentQueueIndexState, 0);
    });

    await act(async () => {
      await result.current.cancelParallelDial();
    });

    expect(mockTerminateDialerCall).toHaveBeenCalledWith('pg_test');
    expect(mockPlayErrorSound).toHaveBeenCalledTimes(1);
    expect(result.current.isDialing).toBe(false);
  });
});
