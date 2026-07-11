import { dedupeTraceRows, stableTraceKey, type TraceRecord } from './model';

export type TracePageDirection = 'append' | 'prepend';

export type MergeTraceRowsOptions = {
  direction: TracePageDirection;
  maxRows: number;
  selectedKey?: string;
};

export type TracePrefetchState = {
  lastVirtualIndex: number | null;
  rowCount: number;
  threshold: number;
  nextCursor: string | null;
  fetching: boolean;
};

export function mergeTraceRows(
  current: Iterable<TraceRecord>,
  incoming: Iterable<TraceRecord>,
  options: MergeTraceRowsOptions,
): TraceRecord[] {
  const ordered =
    options.direction === 'prepend'
      ? [...incoming, ...current]
      : [...current, ...incoming];
  const deduped = dedupeTraceRows(ordered);
  return retainTraceWindow(
    deduped,
    options.maxRows,
    options.direction,
    options.selectedKey ?? '',
  );
}

export function retainTraceWindow(
  rows: TraceRecord[],
  maxRows: number,
  direction: TracePageDirection,
  selectedKey = '',
): TraceRecord[] {
  const limit = Math.max(1, Math.floor(maxRows));
  if (rows.length <= limit) return rows;

  const window =
    direction === 'append' ? rows.slice(-limit) : rows.slice(0, limit);
  if (!selectedKey || window.some((row) => stableTraceKey(row) === selectedKey))
    return window;

  const selectedIndex = rows.findIndex(
    (row) => stableTraceKey(row) === selectedKey,
  );
  if (selectedIndex < 0) return window;

  const start =
    direction === 'append'
      ? Math.min(selectedIndex, rows.length - limit)
      : Math.max(0, selectedIndex - limit + 1);
  return rows.slice(start, start + limit);
}

export function shouldPrefetchTracePage(state: TracePrefetchState): boolean {
  if (
    state.fetching ||
    !state.nextCursor ||
    state.rowCount <= 0 ||
    state.lastVirtualIndex === null
  )
    return false;

  const remainingRows = state.rowCount - state.lastVirtualIndex - 1;
  return remainingRows <= Math.max(0, state.threshold);
}
