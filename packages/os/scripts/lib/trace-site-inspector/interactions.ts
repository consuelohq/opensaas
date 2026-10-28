import { clean, stableTraceKey, type TraceRecord } from './model';
import { semanticToolLabel } from './table-formatters';

export function nextTraceInteractionIndex(
  length: number,
  currentIndex: number,
  direction: -1 | 1,
): number {
  if (length <= 0) return -1;
  if (currentIndex < 0) return direction > 0 ? 0 : length - 1;
  return Math.min(length - 1, Math.max(0, currentIndex + direction));
}

export function traceIdentityCopyText(row: TraceRecord): string {
  const tool = semanticToolLabel(row);
  const traceId = clean(
    row.traceId ?? row.trace ?? row.recordId ?? row.id ?? stableTraceKey(row),
  );
  return traceId ? `${tool} · ${traceId}` : tool;
}
