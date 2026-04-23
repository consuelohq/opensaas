import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { captureException } from '@sentry/react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import {
  activeQueueState,
  currentQueueIndexState,
  queueItemsState,
} from '@/dialer/states/queueState';
import type { ParallelCall } from '@/dialer/types/dialer';
import {
  playCallConnectedSound,
  playDialingStartedSound,
  playErrorSound,
} from '@/dialer/utils/notificationSounds';

const getParallelProfileId = (maxLines: number): 'conservative' | 'balanced' | 'aggressive' => {
  if (maxLines <= 2) {
    return 'conservative';
  }

  if (maxLines === 3) {
    return 'balanced';
  }

  return 'aggressive';
};

export const useParallelDialer = () => {
  const [activeQueue, setActiveQueue] = useRecoilState(activeQueueState);
  const [queueItems, setQueueItems] = useRecoilState(queueItemsState);
  const [currentQueueIndex, setCurrentQueueIndex] = useRecoilState(
    currentQueueIndexState,
  );
  const [activeCalls, setActiveCalls] = useState<ParallelCall[]>([]);
  const [isDialing, setIsDialing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleWinner = useCallback(
    (winner: ParallelCall, allCalls: ParallelCall[]) => {
      playCallConnectedSound();

      setQueueItems((prev) =>
        prev.map((item) => {
          const call = allCalls.find((c) => c.contactId === item.contactId);
          if (!call) return item;
          if (call.callSid === winner.callSid) {
            return {
              ...item,
              status: 'calling' as const,
              callOutcome: 'connected' as const,
            };
          }
          return {
            ...item,
            status: 'completed' as const,
            callOutcome: 'no-answer' as const,
          };
        }),
      );

      setActiveQueue((prev) =>
        prev
          ? {
              ...prev,
              parallelDialingActive: false,
              parallelActiveCalls: [],
              parallelGroupId: null,
            }
          : null,
      );
      setIsDialing(false);
    },
    [setQueueItems, setActiveQueue],
  );

  const handleAllFailed = useCallback(
    (allCalls: ParallelCall[]) => {
      playErrorSound();

      setQueueItems((prev) =>
        prev.map((item) => {
          const call = allCalls.find((c) => c.contactId === item.contactId);
          if (!call) return item;
          return {
            ...item,
            status: 'completed' as const,
            callOutcome: 'no-answer' as const,
          };
        }),
      );

      setActiveQueue((prev) =>
        prev
          ? {
              ...prev,
              parallelDialingActive: false,
              parallelActiveCalls: [],
              parallelGroupId: null,
            }
          : null,
      );

      const cooldown = activeQueue?.settings.parallelDialingCooldown ?? 2000;
      setTimeout(() => {
        const nextIdx = currentQueueIndex + allCalls.length;
        setCurrentQueueIndex(nextIdx);
        setIsDialing(false);
      }, cooldown);
    },
    [
      activeQueue?.settings.parallelDialingCooldown,
      currentQueueIndex,
      setQueueItems,
      setCurrentQueueIndex,
    ],
  );

  const startPolling = useCallback(
    (groupId: string) => {
      pollRef.current = setInterval(async () => {
        try {
          const res = await authenticatedFetch(
            `${REACT_APP_SERVER_BASE_URL}/v1/calls/parallel/${groupId}`,
            {
              headers: { 'Content-Type': 'application/json' },
            },
          );
          const data = await res.json();
          const calls: ParallelCall[] = data.calls ?? [];
          const winner: ParallelCall | null = data.winner ?? null;

          setActiveCalls(calls);

          if (winner) {
            clearPoll();
            handleWinner(winner, calls);
            return;
          }

          const allDone = calls.every(
            (c: ParallelCall) =>
              c.status === 'completed' ||
              c.status === 'failed' ||
              c.status === 'terminated',
          );
          if (allDone) {
            clearPoll();
            handleAllFailed(calls);
          }
        } catch (err: unknown) {
          captureException(err, {
            extra: { context: 'pollParallelCalls', groupId },
          });
        }
      }, 500);
    },
    [clearPoll, handleWinner, handleAllFailed],
  );

  const startParallelBatch = useCallback(async () => {
    if (!activeQueue?.parallelDialingEnabled || isDialing) return;

    const maxLines = activeQueue.settings.parallelDialingMaxLines;
    const batchItems = queueItems
      .slice(currentQueueIndex, currentQueueIndex + maxLines)
      .filter((item) => item.status === 'pending' || item.status === 'calling');

    if (batchItems.length === 0) return;

    setIsDialing(true);

    setQueueItems((prev) =>
      prev.map((item) =>
        batchItems.find((b) => b.id === item.id)
          ? {
              ...item,
              status: 'calling' as const,
              lastAttemptAt: new Date().toISOString(),
              attempts: item.attempts + 1,
            }
          : item,
      ),
    );

    try {
      playDialingStartedSound();

      const res = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/calls/parallel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queueId: activeQueue.id,
            customerNumbers: batchItems.map((item) => item.contact.phone),
            contactIds: batchItems.map((item) => item.contactId),
            profileId: getParallelProfileId(maxLines),
          }),
        },
      );

      if (!res.ok) {
        throw new Error(`Parallel dial failed: ${res.status}`);
      }

      const { groupId, calls } = await res.json();

      setActiveQueue((prev) =>
        prev
          ? {
              ...prev,
              parallelDialingActive: true,
              parallelGroupId: groupId,
              parallelActiveCalls: calls,
              parallelCurrentBatch: prev.parallelCurrentBatch + 1,
            }
          : null,
      );

      setActiveCalls(calls);
      startPolling(groupId);
    } catch (err: unknown) {
      captureException(err, {
        extra: { context: 'startParallelBatch', queueId: activeQueue?.id },
      });
      setIsDialing(false);
      // revert queueItems to pending on failure
      setQueueItems((prev) =>
        prev.map((item) =>
          batchItems.find((b) => b.id === item.id)
            ? { ...item, status: 'pending' as const }
            : item,
        ),
      );
    }
  }, [
    activeQueue,
    isDialing,
    queueItems,
    currentQueueIndex,
    setQueueItems,
    setActiveQueue,
    startPolling,
  ]);

  const cancelParallelDial = useCallback(async () => {
    clearPoll();
    const groupId = activeQueue?.parallelGroupId;
    if (groupId) {
      try {
        await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/calls/parallel/${groupId}/terminate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          },
        );
      } catch (err: unknown) {
        captureException(err, {
          extra: { context: 'cancelParallelDial', groupId },
        });
      }
    }
    setIsDialing(false);
    setActiveCalls([]);
    setActiveQueue((prev) =>
      prev
        ? {
            ...prev,
            parallelDialingActive: false,
            parallelActiveCalls: [],
            parallelGroupId: null,
          }
        : null,
    );
  }, [clearPoll, activeQueue?.parallelGroupId, setActiveQueue]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      clearPoll();
    };
  }, [clearPoll]);

  return {
    startParallelBatch,
    cancelParallelDial,
    activeCalls,
    isDialing,
  };
};
