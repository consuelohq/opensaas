import { stableTraceKey, type TraceRecord } from './model';

export type TraceHistoryPage = {
  rows: TraceRecord[];
  nextCursor: string | null;
};

export type TraceLivePage = TraceHistoryPage;

export type TracePrefetchRequestDetail = {
  cursor: string;
  rowCount: number;
  lastVirtualIndex: number;
  accept: (rows: TraceRecord[], nextCursor: string | null) => void;
  fail: () => void;
};

export type TraceHistoryTransport = {
  fetchJson: (url: string) => Promise<unknown>;
};

declare global {
  interface Window {
    __consueloTraceHistoryTransport?: TraceHistoryTransport;
  }
}

export function deriveTraceHistoryCursor(
  rows: Iterable<TraceRecord>,
  explicitCursor?: string | null,
): string | null {
  if (explicitCursor !== undefined) {
    return typeof explicitCursor === 'string' && explicitCursor
      ? explicitCursor
      : null;
  }
  const ordered = Array.from(rows);
  const key = stableTraceKey(ordered.at(-1));
  return key ? `id:${key}` : null;
}

export function traceHistoryUrl(cursor: string, limit = 100): string {
  return traceCursorUrl('older', cursor, limit);
}

export function traceLiveUrl(cursor: string, limit = 100): string {
  return traceCursorUrl('newer', cursor, limit);
}

function traceCursorUrl(
  direction: 'older' | 'newer',
  cursor: string,
  limit: number,
): string {
  const params = new URLSearchParams({
    direction,
    cursor,
    limit: String(Math.max(1, Math.floor(limit))),
    site: 'trace-burn-intelligence',
    sourceMode: 'local-networked',
    includeRawPayload: 'true',
  });
  return `/gateway/traces/recent?${params.toString()}`;
}

export function parseTraceHistoryResponse(value: unknown): TraceHistoryPage {
  return parseTraceCursorResponse(value, 'older');
}

export function parseTraceLiveResponse(value: unknown): TraceLivePage {
  return parseTraceCursorResponse(value, 'newer');
}

function parseTraceCursorResponse(
  value: unknown,
  direction: 'older' | 'newer',
): TraceHistoryPage {
  const envelope = asRecord(value);
  if (!envelope || envelope.ok !== true) {
    const error = asRecord(envelope?.error);
    throw new Error(clean(error?.message) || 'Trace history request failed.');
  }
  const data = asRecord(envelope.data);
  if (!data || data.direction !== direction) {
    throw new Error(`Trace response is missing the ${direction} direction.`);
  }
  if (!Array.isArray(data.rows)) {
    throw new Error('Trace history response rows must be an array.');
  }
  const rows = data.rows.map(asRecord).filter(Boolean) as TraceRecord[];
  if (rows.length !== data.rows.length) {
    throw new Error('Trace history response rows must contain objects.');
  }
  const nextCursor = data.nextCursor;
  if (nextCursor !== null && typeof nextCursor !== 'string') {
    throw new Error(
      'Trace history response nextCursor must be a string or null.',
    );
  }
  return { rows, nextCursor };
}

export function deriveTraceLiveCursor(rows: Iterable<TraceRecord>): string {
  const newest = Array.from(rows).at(0);
  const metadata = asRecord(newest?.metadata);
  const rowid = clean(metadata?.rowid);
  if (rowid && /^\d+$/.test(rowid)) return rowid.padStart(12, '0');
  const key = stableTraceKey(newest);
  return key ? `id:${key}` : '000000000000';
}

export function installTracePaginationTransport(): () => void {
  const inFlight = new Set<string>();
  const handlePrefetch = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = prefetchDetail(event.detail);
    if (!detail) return;
    event.preventDefault();
    if (inFlight.has(detail.cursor)) return;

    inFlight.add(detail.cursor);
    void fetchTraceHistoryPage(detail.cursor)
      .then((page) => detail.accept(page.rows, page.nextCursor))
      .catch(() => detail.fail())
      .finally(() => inFlight.delete(detail.cursor));
  };

  document.addEventListener('trace:prefetch-request', handlePrefetch);
  return () =>
    document.removeEventListener('trace:prefetch-request', handlePrefetch);
}

async function fetchTraceHistoryPage(
  cursor: string,
): Promise<TraceHistoryPage> {
  try {
    const transport = window.__consueloTraceHistoryTransport;
    if (!transport) {
      throw new Error('Trusted trace history transport is unavailable.');
    }
    const payload = await transport.fetchJson(traceHistoryUrl(cursor));
    return parseTraceHistoryResponse(payload);
  } catch (error: unknown) {
    throw error instanceof Error
      ? error
      : new Error('Trace history request failed.');
  }
}

function prefetchDetail(value: unknown): TracePrefetchRequestDetail | null {
  const record = asRecord(value);
  if (
    !record ||
    typeof record.cursor !== 'string' ||
    !record.cursor ||
    typeof record.accept !== 'function' ||
    typeof record.fail !== 'function'
  )
    return null;
  return record as unknown as TracePrefetchRequestDetail;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}
