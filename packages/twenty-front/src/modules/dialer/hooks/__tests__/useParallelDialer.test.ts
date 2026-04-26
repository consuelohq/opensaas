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

const mockAuthenticatedFetch = jest.fn();
const mockPlayDialingStartedSound = jest.fn();
const mockPlayErrorSound = jest.fn();

jest.mock('@/dialer/utils/authenticatedFetch', () => ({
  authenticatedFetch: (...args: unknown[]) => mockAuthenticatedFetch(...args),
}));

jest.mock('@/dialer/utils/notificationSounds', () => ({
  playCallConnectedSound: jest.fn(),
  playDialingStartedSound: () => mockPlayDialingStartedSound(),
  playErrorSound: () => mockPlayErrorSound(),
}));

jest.mock('@sentry/react', () => ({
  captureException: jest.fn(),
}));

jest.mock('~/config', () => ({
  REACT_APP_SERVER_BASE_URL: 'https://app.example.test',
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
  id: 'queue-1',
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

const renderUseParallelDialer = (
  initializeState: (snap: MutableSnapshot) => void,
) => renderHookWithRecoil(() => useParallelDialer(), { initializeState });

describe('useParallelDialer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAuthenticatedFetch.mockReset();
    mockPlayDialingStartedSound.mockReset();
    mockPlayErrorSound.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns false without playing audio when recoil queue state is not hydrated yet', async () => {
    const { result } = renderUseParallelDialer((snap) => {
      snap.set(activeQueueState, null);
      snap.set(queueItemsState, queueItems);
      snap.set(currentQueueIndexState, 0);
    });

    let started = true;

    await act(async () => {
      started = await result.current.startParallelBatch();
    });

    expect(started).toBe(false);
    expect(mockPlayDialingStartedSound).not.toHaveBeenCalled();
    expect(mockAuthenticatedFetch).not.toHaveBeenCalled();
  });

  it('returns true after creating a parallel batch from a calling item and a pending item', async () => {
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        groupId: 'pg_test',
        calls: [
          {
            callSid: 'CA1',
            customerNumber: '+13472030054',
            position: 1,
            status: 'dialing',
          },
          {
            callSid: 'CA2',
            customerNumber: '+18054259549',
            position: 2,
            status: 'dialing',
          },
        ],
      }),
    });

    const { result } = renderUseParallelDialer((snap) => {
      snap.set(activeQueueState, activeParallelQueue);
      snap.set(queueItemsState, queueItems);
      snap.set(currentQueueIndexState, 0);
    });

    let started = false;

    await act(async () => {
      started = await result.current.startParallelBatch();
    });

    expect(started).toBe(true);
    expect(mockPlayDialingStartedSound).toHaveBeenCalledTimes(1);
    expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(1);
    expect(mockAuthenticatedFetch.mock.calls[0][0]).toBe(
      'https://app.example.test/api/v1/calls/parallel',
    );
    expect(
      JSON.parse(mockAuthenticatedFetch.mock.calls[0][1].body),
    ).toMatchObject({
      queueId: 'queue-1',
      customerNumbers: ['+13472030054', '+18054259549'],
      contactIds: ['item-1-contact', 'item-2-contact'],
      profileId: 'conservative',
    });
  });

  it('stops polling and fails the active batch when status lookup returns non-ok', async () => {
    mockAuthenticatedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          groupId: 'pg_test',
          calls: [
            {
              callSid: 'CA1',
              customerNumber: '+13472030054',
              position: 1,
              status: 'dialing',
              contactId: 'item-1-contact',
            },
            {
              callSid: 'CA2',
              customerNumber: '+18054259549',
              position: 2,
              status: 'dialing',
              contactId: 'item-2-contact',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const { result } = renderUseParallelDialer((snap) => {
      snap.set(activeQueueState, activeParallelQueue);
      snap.set(queueItemsState, queueItems);
      snap.set(currentQueueIndexState, 0);
    });

    await act(async () => {
      await result.current.startParallelBatch();
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
      'https://app.example.test/api/v1/calls/parallel/pg_test/terminate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    );
    expect(mockPlayErrorSound).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(3);
  });

  it('terminates and clears an active parallel group when canceled', async () => {
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
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

    expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
      'https://app.example.test/api/v1/calls/parallel/pg_test/terminate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    );
    expect(result.current.activeCalls).toEqual([]);
    expect(result.current.isDialing).toBe(false);
  });
});
