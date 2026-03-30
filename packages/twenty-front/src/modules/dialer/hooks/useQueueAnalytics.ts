import { useEffect, useMemo } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import {
  type QueueAggregatedStats,
  type QueueOutcome,
} from '@/dialer/types/queue';
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
  outcomeBreakdown: Record<QueueOutcome, number>;
} => {
  const queueItems = useRecoilValue(queueItemsState);
  const queueSession = useRecoilValue(queueSessionState);
  const [activeQueue, setActiveQueue] = useRecoilState(activeQueueState);

  const stats = useMemo(() => {
    if (!activeQueue) return null;
    return calculateAggregatedStats(queueItems, queueSession?.startedAt ?? null);
  }, [queueItems, queueSession?.startedAt, activeQueue]);

  const outcomeBreakdown = useMemo(
    () => calculateOutcomeBreakdown(queueItems),
    [queueItems],
  );

  // sync aggregatedStats back to activeQueue atom
  useEffect(() => {
    if (!stats || !activeQueue) return;
    if (
      activeQueue.aggregatedStats?.answeredCount === stats.answeredCount &&
      activeQueue.aggregatedStats?.noAnswerCount === stats.noAnswerCount
    ) {
      return;
    }
    setActiveQueue((prev) => (prev ? { ...prev, aggregatedStats: stats } : null));
  }, [stats, activeQueue, setActiveQueue]);

  return { stats, outcomeBreakdown };
};
