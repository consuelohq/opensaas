import { useCallback } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { callStateAtom } from '@/dialer/states/callStateAtom';
import {
  activeQueueState,
  currentQueueIndexState,
  queueItemsState,
} from '@/dialer/states/queueState';
import { useTwilioDevice } from '@/dialer/hooks/useTwilioDevice';
import type { QueueItem } from '@/dialer/types/queue';

export const useQueueControls = () => {
  const [queue, setQueue] = useRecoilState(activeQueueState);
  const [items, setItems] = useRecoilState(queueItemsState);
  const [currentIndex, setCurrentIndex] = useRecoilState(
    currentQueueIndexState,
  );
  const callState = useRecoilValue(callStateAtom);
  const { connect, disconnect } = useTwilioDevice();

  const callContact = useCallback(
    async (item: QueueItem) => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                status: 'calling' as const,
                lastAttemptAt: new Date().toISOString(),
                attempts: i.attempts + 1,
              }
            : i,
        ),
      );

      const from = callState.fromNumber;
      if (from && item.contact.phone) {
        try {
          await connect({ To: item.contact.phone, From: from });
        } catch {
          // call initiation failed — mark item as failed
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, status: 'failed' as const } : i,
            ),
          );
        }
      }
    },
    [callState.fromNumber, connect, setItems],
  );

  const advanceQueue = useCallback(async () => {
    try {
      const nextIndex = currentIndex + 1;

      if (nextIndex >= items.length) {
        setQueue((prev) =>
          prev
            ? {
                ...prev,
                status: 'completed',
                completedAt: new Date().toISOString(),
              }
            : null,
        );
        return;
      }

      setCurrentIndex(nextIndex);

      if (queue?.status === 'active') {
        const nextItem = items[nextIndex];
        if (nextItem) {
          await callContact(nextItem);
        }
      }
    } catch {
      // advance failed — queue stays at current position
    }
  }, [currentIndex, items, queue?.status, setQueue, setCurrentIndex, callContact]);

  const startQueue = useCallback(async () => {
    if (!queue) return;

    try {
      setQueue({ ...queue, status: 'active', startedAt: new Date().toISOString() });

      const firstItem = items[0];
      if (firstItem) {
        await callContact(firstItem);
      }
    } catch {
      // start failed — revert to idle
      setQueue((prev) => (prev ? { ...prev, status: 'idle' } : null));
    }
  }, [queue, items, setQueue, callContact]);

  const pauseQueue = useCallback(() => {
    if (!queue) return;
    setQueue({ ...queue, status: 'paused' });
  }, [queue, setQueue]);

  const resumeQueue = useCallback(async () => {
    if (!queue) return;

    try {
      setQueue({ ...queue, status: 'active' });

      const currentItem = items[currentIndex];
      if (currentItem && currentItem.status === 'pending') {
        await callContact(currentItem);
      }
    } catch {
      // resume failed — revert to paused
      setQueue((prev) => (prev ? { ...prev, status: 'paused' } : null));
    }
  }, [queue, items, currentIndex, setQueue, callContact]);

  const skipContact = useCallback(
    async (reason?: string) => {
      try {
        const currentItem = items[currentIndex];
        if (!currentItem) return;

        setItems((prev) =>
          prev.map((item, i) =>
            i === currentIndex
              ? {
                  ...item,
                  status: 'skipped' as const,
                  skipReason: reason ?? null,
                  notes: reason ?? null,
                }
              : item,
          ),
        );

        setQueue((prev) =>
          prev
            ? { ...prev, skippedContacts: prev.skippedContacts + 1 }
            : null,
        );

        disconnect();
        await advanceQueue();
      } catch {
        // skip failed — item stays at current status
      }
    },
    [items, currentIndex, setItems, setQueue, disconnect, advanceQueue],
  );

  const endQueue = useCallback(() => {
    disconnect();
    setQueue((prev) =>
      prev
        ? { ...prev, status: 'stopped', completedAt: new Date().toISOString() }
        : null,
    );
  }, [disconnect, setQueue]);

  const restartQueue = useCallback(() => {
    if (!queue) return;

    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        status: 'pending' as const,
        attempts: 0,
        lastAttemptAt: null,
        callOutcome: null,
        skipReason: null,
        notes: null,
        callDurationSeconds: null,
      })),
    );

    setQueue({
      ...queue,
      status: 'idle',
      completedContacts: 0,
      skippedContacts: 0,
      startedAt: null,
      completedAt: null,
      aggregatedStats: null,
    });

    setCurrentIndex(0);
  }, [queue, setItems, setQueue, setCurrentIndex]);

  // STUB: backend route POST /v1/queues/:id/assign not yet implemented (DEV-733)
  const assignQueue = useCallback(
    async (_userId: string) => {
      if (!queue) return;
      setQueue(null);
      setItems([]);
      setCurrentIndex(0);
    },
    [queue, setQueue, setItems, setCurrentIndex],
  );

  return {
    startQueue,
    pauseQueue,
    resumeQueue,
    skipContact,
    advanceQueue,
    endQueue,
    restartQueue,
    assignQueue,
    isActive: queue?.status === 'active',
    isPaused: queue?.status === 'paused',
    isCompleted: queue?.status === 'completed',
    canRestart: queue?.status === 'completed' || queue?.status === 'stopped',
  };
};
