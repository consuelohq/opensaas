
type TraceRow = {
  id: string;
  traceId?: string;
  cursor: string;
  idempotencyKey?: string;
  toolName?: string;
  status?: string;
  startedAt?: string;
};

type SnapshotResult = { cursor: string; rows: TraceRow[] };
type GatewayRequest = {
  method?: string;
  url: string;
  host?: string;
  workspaceId?: string;
  sourceMode?: string;
  bridgeConfigured?: boolean;
  headers?: Record<string, string>;
  session?: { workspaceId?: string };
  now?: string;
};

type GatewayBackend = {
  readInitialSnapshot: (input: { cursor: string; request: GatewayRequest }) => Promise<SnapshotResult>;
  readAfterCursor: (cursor: string, request: GatewayRequest) => Promise<SnapshotResult>;
};

type EndpointOptions = {
  auth?: { browserStreamAuth?: string };
  stream?: {
    keepAliveMs?: number;
    maxEventsForTest?: number;
    maxDurationMs?: number;
    maxBufferedEvents?: number;
  };
  backend: GatewayBackend;
};

type SseEvent = {
  type: string;
  cursor?: string;
  publicBoundary?: 'consuelo-gateway';
  routeFamily?: '/gateway/traces/*';
  state?: string;
  reason?: string;
  trace?: TraceRow;
  traces?: TraceRow[];
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function getCursor(url: string): string {
  try {
    return new URL(url).searchParams.get('cursor') ?? 'cur_000';
  } catch (_error: unknown) {
    return 'cur_000';
  }
}

function dedupeRows(rows: TraceRow[], seen: Set<string>): TraceRow[] {
  const out: TraceRow[] = [];
  for (const row of rows) {
    const key = row.idempotencyKey ?? row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function encodeEvent(event: SseEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function makeStream(events: SseEvent[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(encodeEvent(event)));
      controller.close();
    },
  });
}

export function createTraceSitesGatewayLiveStreamEndpoint(options: EndpointOptions) {
  return {
    async handle(request: GatewayRequest): Promise<Response> {
      try {
        if (options.auth?.browserStreamAuth === 'custom-headers') {
          return jsonResponse(400, {
            ok: false,
            publicBoundary: 'consuelo-gateway',
            code: 'EVENTSOURCE_AUTH_STRATEGY_REQUIRED',
          });
        }

        if (request.sourceMode === 'local-networked' && request.bridgeConfigured === false) {
          return jsonResponse(424, {
            ok: false,
            publicBoundary: 'consuelo-gateway',
            code: 'BRIDGE_REQUIRED',
            sourceMode: 'local-networked',
          });
        }

        const requestedCursor = getCursor(request.url);
        const seen = new Set<string>();
        const snapshot = await options.backend.readInitialSnapshot({ cursor: requestedCursor, request });
        const snapshotRows = dedupeRows(snapshot.rows, seen);
        const events: SseEvent[] = [
          {
            type: 'snapshot',
            cursor: snapshot.cursor,
            publicBoundary: 'consuelo-gateway',
            routeFamily: '/gateway/traces/*',
            traces: snapshotRows,
          },
        ];

        const maxEvents = options.stream?.maxEventsForTest ?? 4;
        const maxBuffered = options.stream?.maxBufferedEvents ?? Number.POSITIVE_INFINITY;
        const next = await options.backend.readAfterCursor(snapshot.cursor, request);
        const deltaRows = dedupeRows(next.rows, seen);

        if (deltaRows.length > maxBuffered) {
          events.push({
            type: 'state',
            state: 'degraded',
            reason: 'BACKPRESSURE_LIMIT_REACHED',
            cursor: next.cursor,
            publicBoundary: 'consuelo-gateway',
            routeFamily: '/gateway/traces/*',
          });
        } else {
          for (const trace of deltaRows) {
            events.push({
              type: 'trace',
              cursor: trace.cursor ?? next.cursor,
              trace,
              publicBoundary: 'consuelo-gateway',
              routeFamily: '/gateway/traces/*',
            });
          }
          events.push({
            type: 'keepalive',
            cursor: next.cursor,
            publicBoundary: 'consuelo-gateway',
            routeFamily: '/gateway/traces/*',
          });
          events.push({
            type: 'state',
            state: 'closing',
            cursor: next.cursor,
            publicBoundary: 'consuelo-gateway',
            routeFamily: '/gateway/traces/*',
          });
        }

        const body = makeStream(events.slice(0, maxEvents));
        return new Response(body, {
          status: 200,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache, no-transform',
            connection: 'keep-alive',
          },
        });
      } catch (_error: unknown) {
        return jsonResponse(503, {
          ok: false,
          publicBoundary: 'consuelo-gateway',
          code: 'TRACE_STREAM_UNAVAILABLE',
          dataState: 'degraded',
        });
      }
    },
  };
}

export async function collectTraceSitesSseEventsForTest(
  body: ReadableStream<Uint8Array> | null,
  options: { maxEvents?: number } = {},
): Promise<SseEvent[]> {
  try {
    if (!body) return [];
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();

    const events: SseEvent[] = [];
    for (const block of text.split('\n\n')) {
      const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
      if (!dataLine) continue;
      events.push(JSON.parse(dataLine.slice('data: '.length)) as SseEvent);
      if (options.maxEvents !== undefined && events.length >= options.maxEvents) break;
    }
    return events;
  } catch (_error: unknown) {
    return [];
  }
}
