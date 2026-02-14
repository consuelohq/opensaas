import { useCallback, useEffect } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import {
  callHistoryState,
  historyErrorState,
  historyFiltersState,
  historyLoadingState,
} from '@/dialer/states/historyState';
import {
  type CallHistoryItem,
  type HistoryFilters,
} from '@/dialer/types/history';

const REFRESH_INTERVAL = 30_000;

type UseCallHistoryReturn = {
  callHistory: CallHistoryItem[];
  historyLoading: boolean;
  historyError: string | null;
  fetchHistory: (overrideFilters?: Partial<HistoryFilters>) => Promise<void>;
  refresh: () => void;
};

export const useCallHistory = (): UseCallHistoryReturn => {
  const [callHistory, setCallHistory] = useRecoilState(callHistoryState);
  const historyFilters = useRecoilValue(historyFiltersState);
  const [historyLoading, setHistoryLoading] =
    useRecoilState(historyLoadingState);
  const historyError = useRecoilValue(historyErrorState);
  const setHistoryError = useSetRecoilState(historyErrorState);

  const fetchHistory = useCallback(
    async (overrideFilters?: Partial<HistoryFilters>) => {
      setHistoryLoading(true);
      setHistoryError(null);

      try {
        const merged = { ...historyFilters, ...overrideFilters };
        const params = new URLSearchParams();
        if (merged.outcome !== 'all') params.set('outcome', merged.outcome);
        if (merged.dateFrom !== null) params.set('from', merged.dateFrom);
        if (merged.dateTo !== null) params.set('to', merged.dateTo);
        if (merged.contactId !== null)
          params.set('contactId', merged.contactId);
        params.set('limit', '50');
        params.set('offset', '0');

        const query = params.toString();
        const url = `${REACT_APP_SERVER_BASE_URL}/v1/calls/history${query.length > 0 ? `?${query}` : ''}`;

        const res = await fetch(url, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          throw new Error(`History API error: ${res.status}`);
        }

        const data = (await res.json()) as CallHistoryItem[];
        setCallHistory(data);
      } catch (err: unknown) {
        const message =
          // eslint-disable-next-line lingui/no-unlocalized-strings
          err instanceof Error ? err.message : 'Failed to fetch call history';
        setHistoryError(message);
      } finally {
        setHistoryLoading(false);
      }
    },
    [historyFilters, setCallHistory, setHistoryLoading, setHistoryError],
  );

  const refresh = useCallback(() => {
    void fetchHistory();
  }, [fetchHistory]);

  // auto-refresh every 30s, pause when tab hidden
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (intervalId === null) {
        intervalId = setInterval(() => {
          void fetchHistory();
        }, REFRESH_INTERVAL);
      }
    };

    const stop = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchHistory();
        start();
      } else {
        stop();
      }
    };

    // initial fetch + start polling
    void fetchHistory();
    start();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchHistory]);

  return {
    callHistory,
    historyLoading,
    historyError,
    fetchHistory,
    refresh,
  };
};
