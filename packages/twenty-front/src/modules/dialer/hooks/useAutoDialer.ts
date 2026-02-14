import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { callStateAtom } from '@/dialer/states/callStateAtom';
import {
  activeQueueState,
  currentQueueIndexState,
  lastCallOutcomeState,
  queueItemsState,
} from '@/dialer/states/queueState';
import { useQueueControls } from '@/dialer/hooks/useQueueControls';
import type { CallOutcome, QueueItem, QueueSettings } from '@/dialer/types/queue';

const shouldRetry = (item: QueueItem, settings: QueueSettings): boolean => {
  if (item.attempts >= settings.maxAttempts) return false;
  const outcome = item.callOutcome;
  if (!outcome) return false;
  if (outcome === 'connected' || outcome === 'wrong-number' || outcome === 'not-interested' || outcome === 'dnc') {
    return false;
  }
  return outcome === 'no-answer' || outcome === 'voicemail' || outcome === 'busy';
};

const getRetryDelay = (attempts: number): number =>
  Math.min(1000 * Math.pow(2, attempts - 1), 30000);

export const useAutoDialer = () => {
  const queue = useRecoilValue(activeQueueState);
  const callState = useRecoilValue(callStateAtom);
  const callOutcome = useRecoilValue(lastCallOutcomeState);
  const items = useRecoilValue(queueItemsState);
  const currentIndex = useRecoilValue(currentQueueIndexState);
  const { advanceQueue, skipContact } = useQueueControls();
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatusRef = useRef(callState.status);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCountdown(null);
  }, []);

  // watch for call end → start countdown
  useEffect(() => {
    const wasActive = prevStatusRef.current === 'active' || prevStatusRef.current === 'ringing';
    prevStatusRef.current = callState.status;

    if (callState.status !== 'ended') return;
    if (!wasActive) return;
    if (queue?.status !== 'active') return;
    if (!queue.settings.autoAdvance) return;

    // auto-skip voicemail immediately if enabled
    if (queue.settings.autoSkipVoicemail && callOutcome === 'voicemail') {
      try {
        skipContact('Voicemail - auto-skipped');
      } catch {
        // skip failed
      }
      return;
    }

    // check retry logic
    const currentItem = items[currentIndex];
    if (currentItem && shouldRetry(currentItem, queue.settings)) {
      const retryDelay = getRetryDelay(currentItem.attempts);
      const delaySec = Math.ceil(retryDelay / 1000);
      setCountdown(delaySec);

      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearTimer();
            try {
              advanceQueue();
            } catch {
              // advance failed
            }
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }

    // normal auto-advance with configured delay
    let delay = queue.settings.autoAdvanceDelay;
    if (callOutcome === 'voicemail') {
      delay += queue.settings.voicemailSkipDelay;
    }

    const delaySec = Math.max(1, Math.ceil(delay / 1000));
    setCountdown(delaySec);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearTimer();
          try {
            advanceQueue();
          } catch {
            // advance failed
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [callState.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const cancelAutoAdvance = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  return {
    countdown,
    cancelAutoAdvance,
    isAutoAdvancing: countdown !== null,
  };
};
