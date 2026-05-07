import { useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';
import { captureException } from '@sentry/react';

import { useStartDialerCall } from '@/dialer/hooks/useStartDialerCall';
import {
  activeQueueState,
  currentQueueIndexState,
  queueItemsState,
} from '@/dialer/states/queueState';
import type { ParallelCall } from '@/dialer/types/dialer';
import {
  playDialingStartedSound,
  playErrorSound,
} from '@/dialer/utils/notificationSounds';

const MAX_SUPPORTED_PARALLEL_LINES = 4;

type StartParallelBatchResult =
  | { status: 'started'; groupId: string }
  | {
      status: 'skipped';
      reason: 'disabled' | 'already-dialing' | 'insufficient-dialable-items';
    }
  | {
      status: 'blocked';
      reason: 'caller-id-locked';
      responseStatus: 409;
      retryAfterMs?: number;
    }
  | { status: 'failed'; responseStatus?: number };

const toParallelCallStatus = (status: string): ParallelCall['status'] => {
  if (
    status === 'dialing' ||
    status === 'ringing' ||
    status === 'in-progress' ||
    status === 'completed' ||
    status === 'failed' ||
    status === 'terminated' ||
    status === 'voicemail'
  ) {
    return status;
  }

  return 'dialing';
};

export const useParallelDialer = () => {
  const [activeQueue, setActiveQueue] = useRecoilState(activeQueueState);
  const [queueItems, setQueueItems] = useRecoilState(queueItemsState);
  const [currentQueueIndex] = useRecoilState(currentQueueIndexState);
  const [activeCalls, setActiveCalls] = useState<ParallelCall[]>([]);
  const [isDialing, setIsDialing] = useState(false);
  const { startDialerCall, terminateDialerCall } = useStartDialerCall();

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

  const startParallelBatch =
    useCallback(async (): Promise<StartParallelBatchResult> => {
      if (!activeQueue?.parallelDialingEnabled) {
        return { status: 'skipped', reason: 'disabled' };
      }

      if (isDialing) {
        return { status: 'skipped', reason: 'already-dialing' };
      }

      const pendingItems = queueItems.filter(
        (item) => item.status === 'pending' || item.status === 'calling',
      );

      if (pendingItems.length === 0) {
        return { status: 'skipped', reason: 'insufficient-dialable-items' };
      }

      const requestedFanout = Math.min(
        activeQueue.settings.parallelDialingMaxLines,
        MAX_SUPPORTED_PARALLEL_LINES,
      );

      setIsDialing(true);

      try {
        const result = await startDialerCall({
          source: 'queue',
          selectionStrategy: 'predictive',
          requestedFanout,
          queueId: activeQueue.id,
        });
        const calls: ParallelCall[] = result.calls.map((call) => ({
          callSid: call.callSid,
          customerNumber: call.customerNumber,
          fromNumber: call.callerId,
          position: call.position,
          status: toParallelCallStatus(call.status),
          contactId: call.contactId,
        }));

        if (calls.length === 0) {
          throw new Error('Predictive dialer returned no calls');
        }

        playDialingStartedSound();

        setQueueItems((prev) =>
          prev.map((item) => {
            const call = calls.find(
              (parallelCall) => parallelCall.contactId === item.contactId,
            );

            return call
              ? {
                  ...item,
                  status: 'calling' as const,
                  lastAttemptAt: new Date().toISOString(),
                  attempts: item.attempts + 1,
                }
              : item;
          }),
        );

        const parallelGroupId = result.twilioGroupId ?? result.sessionId;

        setActiveQueue((prev) =>
          prev !== null
            ? {
                ...prev,
                parallelDialingActive: true,
                parallelGroupId,
                parallelActiveCalls: calls,
                parallelCurrentBatch: prev.parallelCurrentBatch + 1,
              }
            : null,
        );

        setActiveCalls(calls);

        return { status: 'started', groupId: parallelGroupId };
      } catch (err: unknown) {
        captureException(err, {
          extra: {
            context: 'startParallelBatch',
            currentQueueIndex,
            queueId: activeQueue?.id,
          },
        });
        playErrorSound();
        clearParallelState();

        return { status: 'failed' };
      }
    }, [
      activeQueue,
      clearParallelState,
      currentQueueIndex,
      isDialing,
      queueItems,
      setActiveQueue,
      setQueueItems,
      startDialerCall,
    ]);

  const cancelParallelDial = useCallback(async () => {
    const groupId = activeQueue?.parallelGroupId;

    if (!groupId) {
      clearParallelState();
      return;
    }

    try {
      await terminateDialerCall(groupId);
      clearParallelState();
    } catch (err: unknown) {
      captureException(err, {
        extra: {
          context: 'cancelParallelDial',
          groupId,
          queueId: activeQueue?.id,
        },
      });
      playErrorSound();
    }
  }, [
    activeQueue?.id,
    activeQueue?.parallelGroupId,
    clearParallelState,
    terminateDialerCall,
  ]);

  return {
    startParallelBatch,
    cancelParallelDial,
    activeCalls,
    isDialing,
  };
};
