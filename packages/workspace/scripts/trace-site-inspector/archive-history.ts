import { createLocalTraceSitesReadBackend } from '../../../os/scripts/lib/trace-sites-local-read-backend';
import type {
  TraceSitesGatewayReadBackendAdapter,
  TraceSitesGatewayReadBackendInput,
} from '../../../os/scripts/lib/trace-sites-gateway-read-layer';

const HISTORY_ROUTE = '/gateway/traces/recent';
const HISTORY_SITE = 'trace-burn-intelligence';
const HISTORY_SOURCE_MODE = 'local-networked';
const MAX_HISTORY_PAGE_SIZE = 250;

export async function createArchiveTraceHistoryResponse(input: {
  request: Request;
  dbPath: string;
  backend?: TraceSitesGatewayReadBackendAdapter;
}): Promise<Response> {
  const url = new URL(input.request.url);
  if (input.request.method !== 'GET' || url.pathname !== HISTORY_ROUTE) {
    return jsonFailure('TRACE_HISTORY_ROUTE_NOT_FOUND', 'Trace history route not found.', 404);
  }

  const direction = url.searchParams.get('direction');
  const cursor = clean(url.searchParams.get('cursor'));
  const site = url.searchParams.get('site');
  const sourceMode = url.searchParams.get('sourceMode');
  const includeRawPayload = url.searchParams.get('includeRawPayload') === 'true';
  if (!includeRawPayload) {
    return jsonFailure(
      'RAW_PAYLOAD_ACCESS_DENIED',
      'Raw trace history requires the private archive transport.',
      403,
    );
  }
  if (
    direction !== 'older' ||
    !cursor ||
    site !== HISTORY_SITE ||
    sourceMode !== HISTORY_SOURCE_MODE
  ) {
    return jsonFailure(
      'TRACE_HISTORY_QUERY_INVALID',
      'Trace history query is invalid.',
      400,
    );
  }

  const limit = boundedLimit(url.searchParams.get('limit'));
  const backend =
    input.backend ?? createLocalTraceSitesReadBackend({ dbPath: input.dbPath });
  if (!backend.readHistoryPage) {
    return jsonFailure(
      'TRACE_HISTORY_UNAVAILABLE',
      'Trace history is unavailable.',
      503,
    );
  }

  const backendInput: TraceSitesGatewayReadBackendInput = {
    workspaceId: 'private-tailnet-archive',
    workspaceHost: url.hostname,
    site: HISTORY_SITE,
    sourceMode: HISTORY_SOURCE_MODE,
    cursor,
    limit,
  };

  try {
    const health = await backend.resolveHealth?.(backendInput);
    if (health?.traceStoreAvailable === false) {
      return jsonFailure(
        'TRACE_STORE_UNAVAILABLE',
        'The private trace store is unavailable.',
        503,
      );
    }
    const page = await backend.readHistoryPage(backendInput);
    return jsonResponse({
      ok: true,
      publicBoundary: 'consuelo-sites-private-archive',
      route: HISTORY_ROUTE,
      data: {
        direction: 'older',
        rows: page.rows,
        nextCursor: page.nextCursor,
      },
    });
  } catch (_error: unknown) {
    return jsonFailure(
      'TRACE_HISTORY_READ_FAILED',
      'Trace history read failed.',
      503,
    );
  }
}

function boundedLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 100;
  return Math.min(MAX_HISTORY_PAGE_SIZE, Math.floor(parsed));
}

function jsonFailure(code: string, message: string, status: number): Response {
  return jsonResponse(
    {
      ok: false,
      publicBoundary: 'consuelo-sites-private-archive',
      route: HISTORY_ROUTE,
      error: { code, message },
    },
    status,
  );
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    },
  });
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}
