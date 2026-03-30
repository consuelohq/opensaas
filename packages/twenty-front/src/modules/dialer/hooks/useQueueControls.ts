import { useCallback } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { captureException } from '@sentry/react';

import {
  activeQueueState,
  currentQueueIndexState,
  queueItemsState,
} from '@/dialer/states/queueState';
import { useTwilioDevice } from '@/dialer/hooks/useTwilioDevice';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import type { QueueItem } from '@/dialer/types/queue';

export const useQueueControls = () => {
  const [activeQueue, setActiveQueue] = useRecoilState(activeQueueState);
  const [queueItems, setQueueItems] = useRecoilState(queueItemsState);
  const [currentQueueIndex, setCurrentQueueIndex] = useRecoilState(
    currentQueueIndexState,
  );
  const callState = useRecoilValue(callStateAtom);
  const { connect, disconnect } = useTwilioDevice();

  const callContact = useCallback(
    async (item: QueueItem) => {
      setQueueItems((prev) =>
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
        } catch (err: unknown) {
          captureException(err, {
            extra: { context: 'callContact', contactId: item.contactId },
          });
          // call initiation failed — mark item as failed
          setQueueItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, status: 'failed' as const } : i,
            ),
          );
        }
      }
    },
    [callState.fromNumber, connect, setQueueItems],
  );

  const advanceQueue = useCallback(async () => {
    try {
      const nextIndex = currentQueueIndex + 1;

      if (nextIndex >= queueItems.length) {
        setActiveQueue((prev) =>
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

      setCurrentQueueIndex(nextIndex);

      if (activeQueue?.status === 'active') {
        const nextItem = queueItems[nextIndex];
        if (nextItem) {
          await callContact(nextItem);
        }
      }
    } catch (err: unknown) {
      captureException(err, { extra: { context: 'advanceQueue' } });
    }
  }, [
    currentQueueIndex,
    queueItems,
    activeQueue?.status,
    setActiveQueue,
    setCurrentQueueIndex,
    callContact,
  ]);

  const startQueue = useCallback(async () => {
    if (!activeQueue) return;

    try {
      setActiveQueue({
        ...activeQueue,
        status: 'active',
        startedAt: new Date().toISOString(),
      });

      const firstItem = queueItems[0];
      if (firstItem) {
        await callContact(firstItem);
      }
    } catch (err: unknown) {
      captureException(err, { extra: { context: 'startQueue' } });
      // start failed — revert to idle
      setActiveQueue((prev) => (prev ? { ...prev, status: 'idle' } : null));
    }
  }, [activeQueue, queueItems, setActiveQueue, callContact]);

  const pauseQueue = useCallback(() => {
    if (!activeQueue) return;
    setActiveQueue({ ...activeQueue, status: 'paused' });
  }, [activeQueue, setActiveQueue]);

  const resumeQueue = useCallback(async () => {
    if (!activeQueue) return;

    try {
      setActiveQueue({ ...activeQueue, status: 'active' });

      const currentItem = queueItems[currentQueueIndex];
      if (currentItem && currentItem.status === 'pending') {
        await callContact(currentItem);
      }
    } catch (err: unknown) {
      captureException(err, { extra: { context: 'resumeQueue' } });
      // resume failed — revert to paused
      setActiveQueue((prev) => (prev ? { ...prev, status: 'paused' } : null));
    }
  }, [activeQueue, queueItems, currentQueueIndex, setActiveQueue, callContact]);

  const skipContact = useCallback(
    async (reason?: string) => {
      try {
        const currentItem = queueItems[currentQueueIndex];
        if (!currentItem) return;

        setQueueItems((prev) =>
          prev.map((item, i) =>
            i === currentQueueIndex
              ? {
                  ...item,
                  status: 'skipped' as const,
                  skipReason: reason ?? null,
                  notes: reason ?? null,
                }
              : item,
          ),
        );

        setActiveQueue((prev) =>
          prev ? { ...prev, skippedContacts: prev.skippedContacts + 1 } : null,
        );

        disconnect();
        await advanceQueue();
      } catch (err: unknown) {
        captureException(err, { extra: { context: 'skipContact', reason } });
      }
    },
    [queueItems, currentQueueIndex, setQueueItems, setActiveQueue, disconnect, advanceQueue],
  );

  const endQueue = useCallback(() => {
    disconnect();
    setActiveQueue((prev) =>
      prev
        ? { ...prev, status: 'stopped', completedAt: new Date().toISOString() }
        : null,
    );
  }, [disconnect, setActiveQueue]);

  const restartQueue = useCallback(() => {
    if (!activeQueue) return;

    setQueueItems((prev) =>
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

    setActiveQueue({
      ...activeQueue,
      status: 'idle',
      completedContacts: 0,
      skippedContacts: 0,
      startedAt: null,
      completedAt: null,
      aggregatedStats: null,
    });

    setCurrentQueueIndex(0);
  }, [activeQueue, setQueueItems, setActiveQueue, setCurrentQueueIndex]);

  // STUB: backend route POST /v1/queues/:id/assign not yet implemented (DEV-733)
  const assignQueue = useCallback(
    async (_userId: string) => {
      if (!activeQueue) return;
      setActiveQueue(null);
      setQueueItems([]);
      setCurrentQueueIndex(0);
    },
    [activeQueue, setActiveQueue, setQueueItems, setCurrentQueueIndex],
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
    isActive: activeQueue?.status === 'active',
    isPaused: activeQueue?.status === 'paused',
    isCompleted: activeQueue?.status === 'completed',
    canRestart: activeQueue?.status === 'completed' || activeQueue?.status === 'stopped',
  };
};
