import { useCallback } from 'react';
import { useRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import {
  callMetricsState,
  metricsLoadingState,
} from '@/dialer/states/historyState';
import { type CallMetrics } from '@/dialer/types/history';

type AnalyticsPeriod = 'today' | 'week' | 'month';

export const useCallAnalytics = () => {
  const [metrics, setMetrics] = useRecoilState(callMetricsState);
  const [loading, setLoading] = useRecoilState(metricsLoadingState);

  const fetchMetrics = useCallback(
    async (period: AnalyticsPeriod) => {
      setLoading(true);
      try {
        const res = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/analytics/metrics?period=${period}`,
          { credentials: 'include' },
        );
        if (!res.ok) throw new Error('fetch failed');
        const data = (await res.json()) as { metrics: CallMetrics };
        setMetrics(data.metrics);
      } catch {
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    },
    [setMetrics, setLoading],
  );

  return { metrics, loading, fetchMetrics };
};

export type { AnalyticsPeriod };
