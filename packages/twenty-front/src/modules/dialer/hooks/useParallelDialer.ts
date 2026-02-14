import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import {
  activeQueueState,
  currentQueueIndexState,
  queueItemsState,
} from '@/dialer/states/queueState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import type { ParallelCall } from '@/dialer/types/dialer';

export const useParallelDialer = () => {
  const [queue, setQueue] = useRecoilState(activeQueueState);
  const [items, setItems] = useRecoilState(queueItemsState);
  const [currentIndex, setCurrentIndex] = useRecoilState(currentQueueIndexState);
  const callState = useRecoilValue(callStateAtom);
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
      setItems((prev) =>
        prev.map((item) => {
          const call = allCalls.find((c) => c.contactId === item.contactId);
          if (!call) return item;
          if (call.callSid === winner.callSid) {
            return { ...item, status: 'calling' as const, callOutcome: 'connected' as const };
          }
          return { ...item, status: 'completed' as const, callOutcome: 'no-answer' as const };
        }),
      );

      setQueue((prev) =>
        prev ? { ...prev, parallelDialingActive: false, parallelActiveCalls: [] } : null,
      );
      setIsDialing(false);
    },
    [setItems, setQueue],
  );

  const handleAllFailed = useCallback(
    (allCalls: ParallelCall[]) => {
      setItems((prev) =>
        prev.map((item) => {
          const call = allCalls.find((c) => c.contactId === item.contactId);
          if (!call) return item;
          return { ...item, status: 'completed' as const, callOutcome: 'no-answer' as const };
        }),
      );

      const cooldown = queue?.settings.parallelDialingCooldown ?? 2000;
      setTimeout(() => {
        const nextIdx = currentIndex + allCalls.length;
        setCurrentIndex(nextIdx);
        setIsDialing(false);
      }, cooldown);
    },
    [queue?.settings.parallelDialingCooldown, currentIndex, setItems, setCurrentIndex],
  );

  const startPolling = useCallback(
    (groupId: string) => {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(
            `${REACT_APP_SERVER_BASE_URL}/v1/calls/parallel/${groupId}`,
            { headers: { 'Content-Type': 'application/json' }, credentials: 'include' },
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
            (c: ParallelCall) => c.status === 'completed' || c.status === 'failed' || c.status === 'terminated',
          );
          if (allDone) {
            clearPoll();
            handleAllFailed(calls);
          }
        } catch {
          // poll failed — will retry on next interval
        }
      }, 500);
    },
    [clearPoll, handleWinner, handleAllFailed],
  );

  const startParallelBatch = useCallback(async () => {
    if (!queue?.parallelDialingEnabled || isDialing) return;

    const maxLines = queue.settings.parallelDialingMaxLines;
    const batchItems = items
      .slice(currentIndex, currentIndex + maxLines)
      .filter((item) => item.status === 'pending');

    if (batchItems.length === 0) return;

    setIsDialing(true);

    setItems((prev) =>
      prev.map((item) =>
        batchItems.find((b) => b.id === item.id)
          ? { ...item, status: 'calling' as const, lastAttemptAt: new Date().toISOString(), attempts: item.attempts + 1 }
          : item,
      ),
    );

    try {
      const res = await fetch(`${REACT_APP_SERVER_BASE_URL}/v1/calls/parallel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          queueId: queue.id,
          contacts: batchItems.map((item) => ({
            contactId: item.contactId,
            phone: item.contact.phone,
          })),
          fromNumber: callState.fromNumber,
        }),
      });

      const { groupId, calls } = await res.json();

      setQueue((prev) =>
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
    } catch {
      setIsDialing(false);
      // revert items to pending on failure
      setItems((prev) =>
        prev.map((item) =>
          batchItems.find((b) => b.id === item.id)
            ? { ...item, status: 'pending' as const }
            : item,
        ),
      );
    }
  }, [queue, isDialing, items, currentIndex, callState.fromNumber, setItems, setQueue, startPolling]);

  const cancelParallelDial = useCallback(async () => {
    clearPoll();
    const groupId = queue?.parallelGroupId;
    if (groupId) {
      try {
        await fetch(`${REACT_APP_SERVER_BASE_URL}/v1/calls/parallel/${groupId}/terminate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
      } catch {
        // terminate request failed
      }
    }
    setIsDialing(false);
    setActiveCalls([]);
    setQueue((prev) =>
      prev ? { ...prev, parallelDialingActive: false, parallelActiveCalls: [], parallelGroupId: null } : null,
    );
  }, [clearPoll, queue?.parallelGroupId, setQueue]);

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
