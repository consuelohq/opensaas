import { useEffect, useMemo } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { type CallOutcome, type QueueAggregatedStats } from '@/dialer/types/queue';
import {
  activeQueueState,
  queueItemsState,
  queueSessionState,
} from '@/dialer/states/queueState';
import {
  calculateAggregatedStats,
  calculateOutcomeBreakdown,
} from '@/dialer/utils/analyticsCalculator';

export const useQueueAnalytics = (): {
  stats: QueueAggregatedStats | null;
  outcomeBreakdown: Record<CallOutcome, number>;
} => {
  const items = useRecoilValue(queueItemsState);
  const session = useRecoilValue(queueSessionState);
  const [queue, setQueue] = useRecoilState(activeQueueState);

  const stats = useMemo(() => {
    if (!queue) return null;
    return calculateAggregatedStats(items, session?.startedAt ?? null);
  }, [items, session?.startedAt, queue]);

  const outcomeBreakdown = useMemo(
    () => calculateOutcomeBreakdown(items),
    [items],
  );

  // sync aggregatedStats back to queue atom
  useEffect(() => {
    if (!stats || !queue) return;
    if (
      queue.aggregatedStats?.answeredCount === stats.answeredCount &&
      queue.aggregatedStats?.noAnswerCount === stats.noAnswerCount
    ) {
      return;
    }
    setQueue((prev) =>
      prev ? { ...prev, aggregatedStats: stats } : null,
    );
  }, [stats, queue, setQueue]);

  return { stats, outcomeBreakdown };
};
