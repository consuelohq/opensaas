type CursorEnvelope = {
  ok: true;
  data: { direction: 'newer'; rows: unknown[]; nextCursor: string | null };
};

// Reads stay on the node; a browser connection does not create an HTTP request per tick.
export async function createTraceCursorStream(
  request: Request,
  initial: Response,
  readPage: (cursor: string) => Promise<Response>,
): Promise<Response> {
  if (!initial.ok) return initial;
  let page: CursorEnvelope;
  try {
    page = (await initial.json()) as CursorEnvelope;
  } catch {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'TRACE_STREAM_UNAVAILABLE',
          message: 'Trace stream unavailable.',
        },
      },
      { status: 503 },
    );
  }
  let cursor =
    page.data.nextCursor ||
    new URL(request.url).searchParams.get('cursor') ||
    '000000000000';
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let wake: ((active: boolean) => void) | undefined;
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  let lastSent = Date.now();
  const encoder = new TextEncoder();
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    clearTimeout(expiry);
    request.signal.removeEventListener('abort', stop);
    wake?.(false);
    controller?.close();
  };
  const expiry = setTimeout(stop, 300_000);
  const send = (event: string, data: unknown) => {
    if (stopped) return;
    controller?.enqueue(
      encoder.encode(
        'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n',
      ),
    );
    lastSent = Date.now();
  };
  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
      request.signal.addEventListener('abort', stop, { once: true });
      if (request.signal.aborted) {
        stop();
        return;
      }
      send('page', page);
    },
    async pull() {
      // Pull-based production bounds queued pages even when the client stops reading.
      while (!stopped) {
        const active = await new Promise<boolean>((resolve) => {
          wake = resolve;
          timer = setTimeout(() => {
            wake = undefined;
            resolve(true);
          }, 1_000);
        });
        if (!active || stopped) return;
        try {
          const response = await readPage(cursor);
          if (stopped) return;
          if (!response.ok) {
            send('unavailable', { status: response.status });
            stop();
            return;
          }
          page = (await response.json()) as CursorEnvelope;
          if (stopped) return;
          cursor = page.data.nextCursor || cursor;
          if (page.data.rows.length || Date.now() - lastSent >= 15_000) {
            send('page', page);
            return;
          }
        } catch {
          if (!stopped) {
            send('unavailable', { status: 503 });
            stop();
          }
        }
      }
    },
    cancel() {
      controller = undefined;
      stop();
    },
  });
  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'private, no-store, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}
