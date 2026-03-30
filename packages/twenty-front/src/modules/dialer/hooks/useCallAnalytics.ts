import { useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { captureException } from '@sentry/react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import {
  callMetricsState,
  metricsLoadingState,
} from '@/dialer/states/historyState';
import { type CallMetrics } from '@/dialer/types/history';

type AnalyticsPeriod = 'today' | 'week' | 'month';

export const useCallAnalytics = () => {
  const [callMetrics, setCallMetrics] = useRecoilState(callMetricsState);
  const [metricsLoading, setMetricsLoading] =
    useRecoilState(metricsLoadingState);

  const fetchMetrics = useCallback(
    async (period: AnalyticsPeriod) => {
      setMetricsLoading(true);
      try {
        const res = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/analytics/callMetrics?period=${period}`,
        );
        if (!res.ok) throw new Error('fetch failed');
        const data = (await res.json()) as { callMetrics: CallMetrics };
        setCallMetrics(data.callMetrics);
      } catch (err: unknown) {
        captureException(err, { extra: { context: 'fetchMetrics', period } });
        setCallMetrics(null);
      } finally {
        setMetricsLoading(false);
      }
    },
    [setCallMetrics, setMetricsLoading],
  );

  return { callMetrics, metricsLoading, fetchMetrics };
};

export type { AnalyticsPeriod };
