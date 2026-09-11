import {
  deriveTraceHistoryCursor,
  deriveTraceLiveCursor,
  parseTraceLiveResponse,
  traceLiveUrl,
  type TraceHistoryTransport,
} from './pagination-browser';
import type { TraceRecord } from './model';

type LiveTarget = Window & {
  __traceLiveDispose?: () => void;
  __traceVirtualList?: {
    replaceRows(rows: TraceRecord[], cursor?: string | null): void;
    prependRows(rows: TraceRecord[]): void;
  };
};

export function installTraceLiveUpdates(): () => void {
  const target = window as LiveTarget;
  target.__traceLiveDispose?.();
  let disposed = false;
  let hydrated = false;
  let cursor = '';
  let failures = 0;
  let nextAttempt = 0;
  let streamRetryAt = 0;
  let timer = 0;
  let events: EventSource | undefined;
  let streamWatchdog = 0;
  let pending: AbortController | undefined;
  let generation = 0;
  let blocked = false;
  let status = document.querySelector<HTMLElement>('[data-trace-live-status]');
  if (!status) {
    status = document.createElement('div');
    status.dataset.traceLiveStatus = '';
    status.setAttribute('role', 'status');
    status.style.cssText = 'padding:6px 12px;font:12px system-ui;color:inherit';
    (document.querySelector('.trxTablePane') ?? document.body).prepend(status);
  }
  const setStatus = (message: string) => {
    if (!disposed && status) status.textContent = message;
  };
  const active = () => !disposed && document.visibilityState !== 'hidden';
  const closeStream = () => {
    window.clearTimeout(streamWatchdog);
    events?.close();
    events = undefined;
  };
  const schedule = (delay: number) => {
    window.clearTimeout(timer);
    nextAttempt = Math.max(nextAttempt, Date.now() + delay);
    if (active() && !blocked)
      timer = window.setTimeout(
        () => void refresh(),
        Math.max(0, nextAttempt - Date.now()),
      );
  };
  const failed = (error: unknown) => {
    const detail = error as { status?: number; retryAfterMs?: number };
    failures += 1;
    if (detail?.status === 401 || detail?.status === 403) {
      blocked = true;
      setStatus(
        'Trace access expired or was denied. Sign in again, then reload this page.',
      );
      return;
    }
    const delay = Math.max(
      15_000,
      Math.min(300_000, 15_000 * 2 ** Math.min(failures - 1, 5)),
      detail?.retryAfterMs || 0,
    );
    setStatus(
      detail?.status === 429
        ? 'Trace requests are rate limited. Showing loaded traces; retrying shortly.'
        : 'Trace connection unavailable. Showing loaded traces; retrying shortly.',
    );
    schedule(delay);
  };
  const applyPage = (payload: unknown) => {
    const page = parseTraceLiveResponse(payload);
    if (page.rows.length) target.__traceVirtualList?.prependRows(page.rows);
    if (page.nextCursor) cursor = page.nextCursor;
    failures = 0;
    setStatus('Live');
  };
  const connect = (transport: TraceHistoryTransport) => {
    if (
      !active() ||
      events ||
      !transport.openEvents ||
      Date.now() < streamRetryAt
    )
      return false;
    const owner = generation;
    try {
      const stream = transport.openEvents(
        traceLiveUrl(cursor).replace('/recent?', '/events?'),
      );
      events = stream;
      const lost = () => {
        if (disposed || owner !== generation || events !== stream) return;
        closeStream();
        streamRetryAt = Date.now() + 300_000;
        setStatus('Live stream interrupted. Updates will retry shortly.');
        schedule(15_000);
      };
      const armWatchdog = () => {
        window.clearTimeout(streamWatchdog);
        streamWatchdog = window.setTimeout(lost, 45_000);
      };
      armWatchdog();
      stream.addEventListener('page', (event) => {
        if (!active() || owner !== generation || events !== stream) return;
        try {
          applyPage(JSON.parse((event as MessageEvent<string>).data));
          armWatchdog();
        } catch {
          lost();
        }
      });
      stream.addEventListener('unavailable', lost);
      stream.onerror = lost;
      return true;
    } catch {
      streamRetryAt = Date.now() + 300_000;
      return false;
    }
  };
  const refresh = async () => {
    if (!active() || blocked || pending || events) return;
    if (Date.now() < nextAttempt) {
      schedule(0);
      return;
    }
    const transport = window.__consueloTraceHistoryTransport;
    if (!transport) {
      failed(new Error('Missing trace transport'));
      return;
    }
    const owner = generation;
    const abort = new AbortController();
    pending = abort;
    try {
      if (!hydrated) {
        setStatus('Loading traces…');
        const payload = (await transport.fetchJson(
          '/trace-burn-intelligence/live-traces.json',
          abort.signal,
        )) as {
          rows?: TraceRecord[];
          traces?: TraceRecord[];
          nextCursor?: string | null;
        };
        if (!active() || owner !== generation) return;
        const rows = Array.isArray(payload)
          ? payload
          : (payload.rows ?? payload.traces);
        if (!Array.isArray(rows)) throw new Error('Invalid trace snapshot');
        target.__traceVirtualList?.replaceRows(
          rows,
          deriveTraceHistoryCursor(rows, payload.nextCursor),
        );
        cursor = deriveTraceLiveCursor(rows);
        hydrated = true;
        setStatus(
          rows.length ? 'Live' : 'No traces yet. Waiting for new activity.',
        );
        if (connect(transport)) return;
      } else {
        const payload = await transport.fetchJson(
          traceLiveUrl(cursor),
          abort.signal,
        );
        if (!active() || owner !== generation) return;
        applyPage(payload);
        if (connect(transport)) return;
      }
      failures = 0;
      schedule(15_000);
    } catch (error: unknown) {
      if (active() && owner === generation) failed(error);
    } finally {
      if (pending === abort) pending = undefined;
    }
  };
  const visibilityChanged = () => {
    generation += 1;
    window.clearTimeout(timer);
    pending?.abort();
    pending = undefined;
    closeStream();
    if (active()) schedule(0);
    else setStatus('Live updates paused while this page is hidden.');
  };
  const pageHidden = () => {
    generation += 1;
    window.clearTimeout(timer);
    pending?.abort();
    pending = undefined;
    closeStream();
  };
  const pageShown = (event: PageTransitionEvent) => {
    if (event.persisted) visibilityChanged();
  };
  const dispose = () => {
    disposed = true;
    generation += 1;
    window.clearTimeout(timer);
    pending?.abort();
    closeStream();
    document.removeEventListener('visibilitychange', visibilityChanged);
    window.removeEventListener('pagehide', pageHidden);
    window.removeEventListener('pageshow', pageShown);
    if (target.__traceLiveDispose === dispose) delete target.__traceLiveDispose;
  };
  target.__traceLiveDispose = dispose;
  document.addEventListener('visibilitychange', visibilityChanged);
  window.addEventListener('pagehide', pageHidden);
  window.addEventListener('pageshow', pageShown);
  void refresh();
  return dispose;
}
