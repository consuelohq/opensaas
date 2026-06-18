
export type TraceSitesBrowserTransport = {
  fetchJson: (path: string) => Promise<unknown>;
  createEventSource?: (
    path: string,
    handlers: {
      onMessage: (event: TraceSitesBrowserLiveMessage) => void;
      onError?: (error: unknown) => void;
    },
  ) => { close: () => void };
  wait?: (ms?: number) => Promise<void>;
};

type TraceSitesBrowserLiveMessage = {
  type: string;
  cursor?: string;
  state?: string;
  trace?: TraceSitesBrowserEvent;
};

type TraceSitesBrowserEvent = {
  id: string;
  cursor?: string;
  idempotencyKey?: string;
  toolName?: string;
  status?: string;
};

type BrowserClientOptions = {
  workspaceId: string;
  transport: TraceSitesBrowserTransport;
  polling?: { maxPollsForTest?: number };
};

type RecentResponse = {
  ok?: boolean;
  publicBoundary?: 'consuelo-gateway';
  workspaceId?: string;
  cursor?: string;
  events?: TraceSitesBrowserEvent[];
  code?: string;
  sourceMode?: string;
};

type SummaryResponse = {
  ok?: boolean;
  publicBoundary?: 'consuelo-gateway';
  workspaceId?: string;
  cursor?: string;
  summary?: Record<string, unknown>;
  code?: string;
  sourceMode?: string;
};

function asRecent(value: unknown): RecentResponse {
  return typeof value === 'object' && value !== null ? (value as RecentResponse) : { ok: false };
}

function asSummary(value: unknown): SummaryResponse {
  return typeof value === 'object' && value !== null ? (value as SummaryResponse) : { ok: false };
}

function mergeEvent(events: TraceSitesBrowserEvent[], next: TraceSitesBrowserEvent): TraceSitesBrowserEvent[] {
  const key = next.idempotencyKey ?? next.id;
  const exists = events.some((event) => (event.idempotencyKey ?? event.id) === key);
  return exists ? events : [...events, next];
}

function assertGatewayPath(path: string): void {
  if (!path.startsWith('/gateway/traces')) {
    throw new Error(`Trace Sites browser client can only call gateway trace routes: ${path}`);
  }
  if (path.includes('127.0.0.1') || path.includes('localhost')) {
    throw new Error('Trace Sites browser client cannot call local runtime routes');
  }
}

export function createTraceSitesBrowserClient(options: BrowserClientOptions) {
  return {
    async start() {
      const recentPath = '/gateway/traces/recent';
      const summaryPath = '/gateway/traces/summary';
      assertGatewayPath(recentPath);
      assertGatewayPath(summaryPath);

      const recent = asRecent(await options.transport.fetchJson(recentPath));
      const summary = asSummary(await options.transport.fetchJson(summaryPath));

      if (recent.ok === false && recent.code === 'BRIDGE_REQUIRED') {
        return {
          status: 'bridge-required' as const,
          publicBoundary: 'consuelo-gateway' as const,
          workspaceId: options.workspaceId,
          sourceMode: recent.sourceMode,
          events: [] as TraceSitesBrowserEvent[],
        };
      }

      let cursor = recent.cursor ?? summary.cursor ?? 'cur_000';
      let status: 'live' | 'stale' | 'bridge-required' | 'degraded' = 'stale';
      let events = [...(recent.events ?? [])];
      const closeables: Array<{ close: () => void }> = [];

      if (options.transport.createEventSource) {
        const eventsPath = `/gateway/traces/events?cursor=${cursor}`;
        assertGatewayPath(eventsPath);
        try {
          const source = options.transport.createEventSource(eventsPath, {
            onMessage(message) {
              if (message.cursor) cursor = message.cursor;
              if (message.type === 'trace' && message.trace) {
                events = mergeEvent(events, message.trace);
              }
              if (message.type === 'state') {
                if (message.state === 'live') status = 'live';
                if (message.state === 'degraded') status = 'degraded';
                if (message.state === 'bridge-required') status = 'bridge-required';
              }
            },
            onError() {
              status = 'stale';
            },
          });
          closeables.push(source);
          await Promise.resolve();
          await options.transport.wait?.(0);
          await Promise.resolve();
        } catch (_error: unknown) {
          status = 'stale';
          const polls = options.polling?.maxPollsForTest ?? 1;
          for (let index = 0; index < polls; index += 1) {
            const pollPath = `/gateway/traces/recent?cursor=${cursor}`;
            assertGatewayPath(pollPath);
            const polled = asRecent(await options.transport.fetchJson(pollPath));
            if (polled.cursor) cursor = polled.cursor;
            for (const event of polled.events ?? []) events = mergeEvent(events, event);
          }
        } finally {
          for (const closeable of closeables) closeable.close();
        }
      }

      return {
        status,
        publicBoundary: 'consuelo-gateway' as const,
        workspaceId: options.workspaceId,
        cursor,
        summary: summary.summary,
        events,
      };
    },
  };
}
