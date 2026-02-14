import { selector } from 'recoil';

import { createState } from '@/ui/utilities/state/utils/createState';

import {
  type CallQueue,
  type QueueCategory,
  type QueueItem,
  type QueueSession,
  type QueueStatus,
} from '@/dialer/types/queue';

// atoms

export const activeQueueState = createState<CallQueue | null>({
  key: 'dialerActiveQueue',
  defaultValue: null,
});

export const queueItemsState = createState<QueueItem[]>({
  key: 'dialerQueueItems',
  defaultValue: [],
});

export const currentQueueIndexState = createState<number>({
  key: 'dialerCurrentQueueIndex',
  defaultValue: 0,
});

export const queueSessionState = createState<QueueSession | null>({
  key: 'dialerQueueSession',
  defaultValue: null,
});

export const queueListState = createState<CallQueue[]>({
  key: 'dialerQueueList',
  defaultValue: [],
});

export const queueFilterState = createState<{
  status: QueueStatus | 'all';
  category: QueueCategory;
  search: string;
}>({
  key: 'dialerQueueFilter',
  defaultValue: { status: 'all', category: 'all', search: '' },
});

// selectors

export const currentQueueItemSelector = selector<QueueItem | null>({
  key: 'dialerCurrentQueueItem',
  get: ({ get }) => {
    const items = get(queueItemsState);
    const index = get(currentQueueIndexState);
    return items[index] ?? null;
  },
});

export const nextQueueItemSelector = selector<QueueItem | null>({
  key: 'dialerNextQueueItem',
  get: ({ get }) => {
    const items = get(queueItemsState);
    const index = get(currentQueueIndexState);
    return items[index + 1] ?? null;
  },
});

export const queueProgressSelector = selector<{
  total: number;
  completed: number;
  skipped: number;
  remaining: number;
  current: number;
  percentComplete: number;
} | null>({
  key: 'dialerQueueProgress',
  get: ({ get }) => {
    const queue = get(activeQueueState);
    const items = get(queueItemsState);
    if (!queue) return null;

    const completed = items.filter((i) => i.status === 'completed').length;
    const skipped = items.filter((i) => i.status === 'skipped').length;
    const remaining = items.filter((i) => i.status === 'pending').length;
    const current = items.findIndex((i) => i.status === 'calling');

    return {
      total: items.length,
      completed,
      skipped,
      remaining,
      current,
      percentComplete: items.length
        ? Math.round((completed / items.length) * 100)
        : 0,
    };
  },
});

export const filteredQueueListSelector = selector<CallQueue[]>({
  key: 'dialerFilteredQueueList',
  get: ({ get }) => {
    const queues = get(queueListState);
    const filter = get(queueFilterState);

    return queues.filter((q) => {
      if (filter.status !== 'all' && q.status !== filter.status) return false;
      if (filter.category !== 'all' && q.category !== filter.category)
        return false;
      if (
        filter.search &&
        !q.name.toLowerCase().includes(filter.search.toLowerCase())
      )
        return false;
      return true;
    });
  },
});

export const parallelDialingSelector = selector<{
  isActive: boolean;
  currentBatch: number;
  activeCalls: CallQueue['parallelActiveCalls'];
  maxLines: number;
} | null>({
  key: 'dialerParallelDialing',
  get: ({ get }) => {
    const queue = get(activeQueueState);
    if (!queue?.parallelDialingEnabled) return null;

    return {
      isActive: queue.parallelDialingActive,
      currentBatch: queue.parallelCurrentBatch,
      activeCalls: queue.parallelActiveCalls,
      maxLines: queue.settings.parallelDialingMaxLines,
    };
  },
});
