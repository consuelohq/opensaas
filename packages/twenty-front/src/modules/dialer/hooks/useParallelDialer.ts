import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { captureException } from '@sentry/react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { getParallelDialerEndpoint } from '@/dialer/utils/parallel-dialer-endpoint';
import { toE164 } from '@/dialer/utils/phoneFormat';
import {
  activeQueueState,
  currentQueueIndexState,
  queueItemsState,
} from '@/dialer/states/queueState';
import type { ParallelCall } from '@/dialer/types/dialer';
import type { QueueItem } from '@/dialer/types/queue';
import {
  playCallConnectedSound,
  playDialingStartedSound,
  playErrorSound,
} from '@/dialer/utils/notificationSounds';

const MIN_SUPPORTED_PARALLEL_LINES = 2;
const MAX_SUPPORTED_PARALLEL_LINES = 4;
const PARALLEL_DIAL_POLL_INTERVAL_MS = 500;
const PARALLEL_DIAL_STUCK_TIMEOUT_MS = 60_000;
const PARALLEL_TERMINAL_CALL_STATUSES = new Set<string>([
  'completed',
  'failed',
  'terminated',
  'busy',
  'no-answer',
  'canceled',
  'voicemail',
]);
const PARALLEL_TERMINAL_GROUP_STATUSES = new Set<string>([
  'completed',
  'failed',
]);

type DialableBatchItem = {
  item: QueueItem;
  customerNumber: string;
};

const getParallelProfileId = (
  maxLines: number,
): 'conservative' | 'balanced' | 'aggressive' => {
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
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartedAtRef = useRef<number | null>(null);

  const clearPoll = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    pollStartedAtRef.current = null;
  }, []);

  const clearParallelState = useCallback(() => {
    setIsDialing(false);
    setActiveCalls([]);
    setActiveQueue((prev) =>
      prev !== null
        ? {
            ...prev,
            parallelDialingActive: false,
            parallelActiveCalls: [],
            parallelGroupId: null,
          }
        : null,
    );
  }, [setActiveQueue]);

  const terminateParallelGroup = useCallback(
    async (groupId: string, context: string) => {
      try {
        await authenticatedFetch(
          getParallelDialerEndpoint(
            REACT_APP_SERVER_BASE_URL,
            `${groupId}/terminate`,
          ),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          },
        );
      } catch (err: unknown) {
        captureException(err, {
          extra: { context, groupId },
        });
      }
    },
    [],
  );

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
        prev !== null
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
        prev !== null
          ? {
              ...prev,
              parallelDialingActive: false,
              parallelActiveCalls: [],
              parallelGroupId: null,
            }
          : null,
      );
      setActiveCalls([]);

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
      setActiveQueue,
      setCurrentQueueIndex,
    ],
  );

  const startPolling = useCallback(
    (groupId: string, initialCalls: ParallelCall[] = []) => {
      clearPoll();
      pollStartedAtRef.current = Date.now();
      let latestCalls = initialCalls;

      const interval = setInterval(async () => {
        try {
          const res = await authenticatedFetch(
            getParallelDialerEndpoint(REACT_APP_SERVER_BASE_URL, groupId),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          );

          if (!res.ok) {
            clearPoll();
            await terminateParallelGroup(
              groupId,
              'pollParallelCalls.nonOkStatus',
            );
            handleAllFailed(latestCalls);
            return;
          }

          const data = (await res.json()) as {
            status?: string;
            calls?: ParallelCall[];
            winner?: ParallelCall | null;
          };
          const calls = data.calls ?? [];
          const winner = data.winner ?? null;

          latestCalls = calls;
          setActiveCalls(calls);

          if (winner !== null) {
            clearPoll();
            handleWinner(winner, calls);
            return;
          }

          const pollStartedAt = pollStartedAtRef.current;
          const stuckDialing =
            data.status === 'dialing' &&
            pollStartedAt !== null &&
            Date.now() - pollStartedAt >= PARALLEL_DIAL_STUCK_TIMEOUT_MS;

          if (stuckDialing) {
            clearPoll();
            await terminateParallelGroup(
              groupId,
              'pollParallelCalls.stuckDialing',
            );
            handleAllFailed(calls);
            return;
          }

          const groupDone =
            typeof data.status === 'string' &&
            PARALLEL_TERMINAL_GROUP_STATUSES.has(data.status);
          const allDone =
            calls.length > 0 &&
            calls.every((call) =>
              PARALLEL_TERMINAL_CALL_STATUSES.has(call.status),
            );

          if (groupDone || allDone) {
            clearPoll();
            handleAllFailed(calls);
          }
        } catch (err: unknown) {
          captureException(err, {
            extra: { context: 'pollParallelCalls', groupId },
          });
        }
      }, PARALLEL_DIAL_POLL_INTERVAL_MS);

      pollIntervalRef.current = interval;
    },
    [clearPoll, handleWinner, handleAllFailed, terminateParallelGroup],
  );

  const startParallelBatch = useCallback(async (): Promise<boolean> => {
    if (!activeQueue?.parallelDialingEnabled || isDialing) return false;

    const maxLines = Math.min(
      activeQueue.settings.parallelDialingMaxLines,
      MAX_SUPPORTED_PARALLEL_LINES,
    );
    const batchItems = queueItems
      .slice(currentQueueIndex, currentQueueIndex + maxLines)
      .filter((item) => item.status === 'pending' || item.status === 'calling');
    const dialableBatchItems = batchItems.reduce<DialableBatchItem[]>(
      (items, item) => {
        const customerNumber = toE164(item.contact.phone);

        if (customerNumber === null) {
          return items;
        }

        return [...items, { item, customerNumber }];
      },
      [],
    );
    const dialingItems = dialableBatchItems.map(({ item }) => item);

    if (dialableBatchItems.length < MIN_SUPPORTED_PARALLEL_LINES) return false;

    clearPoll();
    setIsDialing(true);

    setQueueItems((prev) =>
      prev.map((item) =>
        dialingItems.find((dialingItem) => dialingItem.id === item.id)
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
        getParallelDialerEndpoint(REACT_APP_SERVER_BASE_URL),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queueId: activeQueue.id,
            customerNumbers: dialableBatchItems.map(
              ({ customerNumber }) => customerNumber,
            ),
            contactIds: dialingItems.map((item) => item.contactId),
            profileId: getParallelProfileId(dialableBatchItems.length),
          }),
        },
      );

      if (!res.ok) {
        throw new Error(`Parallel dial failed: ${res.status}`);
      }

      const { groupId, calls } = await res.json();

      setActiveQueue((prev) =>
        prev !== null
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
      startPolling(groupId, calls);

      return true;
    } catch (err: unknown) {
      captureException(err, {
        extra: { context: 'startParallelBatch', queueId: activeQueue?.id },
      });
      setIsDialing(false);
      // revert queueItems to pending on failure
      setQueueItems((prev) =>
        prev.map((item) =>
          dialingItems.find((dialingItem) => dialingItem.id === item.id)
            ? { ...item, status: 'pending' as const }
            : item,
        ),
      );

      return false;
    }
  }, [
    activeQueue,
    isDialing,
    queueItems,
    currentQueueIndex,
    clearPoll,
    setQueueItems,
    setActiveQueue,
    startPolling,
  ]);

  const cancelParallelDial = useCallback(async () => {
    const groupId = activeQueue?.parallelGroupId;
    clearPoll();
    clearParallelState();

    if (typeof groupId === 'string' && groupId.length > 0) {
      await terminateParallelGroup(groupId, 'cancelParallelDial');
    }
  }, [
    activeQueue?.parallelGroupId,
    clearPoll,
    clearParallelState,
    terminateParallelGroup,
  ]);

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
