import { createState } from '@/ui/utilities/state/utils/createState';
import {
  type CallHistoryItem,
  type CallMetrics,
  type HistoryFilters,
} from '@/dialer/types/history';

export const callHistoryState = createState<CallHistoryItem[]>({
  key: 'dialerCallHistoryState',
  defaultValue: [],
});

export const historyLoadingState = createState<boolean>({
  key: 'dialerHistoryLoadingState',
  defaultValue: false,
});

export const historyErrorState = createState<string | null>({
  key: 'dialerHistoryErrorState',
  defaultValue: null,
});

export const historyFiltersState = createState<HistoryFilters>({
  key: 'dialerHistoryFiltersState',
  defaultValue: {
    outcome: 'all',
    dateFrom: null,
    dateTo: null,
    contactId: null,
  },
});

export const callMetricsState = createState<CallMetrics | null>({
  key: 'dialerCallMetricsState',
  defaultValue: null,
});

export const metricsLoadingState = createState<boolean>({
  key: 'dialerMetricsLoadingState',
  defaultValue: false,
});

export const activePlaybackIdState = createState<string | null>({
  key: 'dialerActivePlaybackIdState',
  defaultValue: null,
});
