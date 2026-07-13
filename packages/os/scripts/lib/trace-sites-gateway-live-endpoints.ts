import {
  createTraceSitesGatewayReadLayer,
  type TraceSitesGatewayReadBackendAdapter,
  type TraceSitesGatewayReadLayerRequest,
  type TraceSitesGatewayReadLayerResult,
} from './trace-sites-gateway-read-layer';
import {
  createTraceSitesGatewayLiveStreamEndpoint,
  type TraceSitesGatewayLiveStreamRow,
} from './trace-sites-gateway-live-stream';
import type {
  TraceGatewaySessionScope,
  TraceSiteSlug,
  TraceSitesDashboardEvent,
  TraceSourceMode,
} from './trace-sites-gateway-contract';

export type TraceSitesGatewayScopeResolver = (request: Request) => TraceGatewaySessionScope | Promise<TraceGatewaySessionScope>;

export type TraceSitesGatewayLiveEndpoints = {
  handle: (request: Request) => Promise<Response>;
};

export type TraceSitesGatewayLiveEndpointOptions = {
  backend: TraceSitesGatewayReadBackendAdapter;
  resolveScope: TraceSitesGatewayScopeResolver;
};

const TRACE_LIVE_ROUTES = new Set([
  '/gateway/traces/recent',
  '/gateway/traces/summary',
  '/gateway/traces/aggregates',
  '/gateway/traces/events',
]);

export function createTraceSitesGatewayLiveEndpoints(options: TraceSitesGatewayLiveEndpointOptions): TraceSitesGatewayLiveEndpoints {
  const readLayer = createTraceSitesGatewayReadLayer(options.backend);

  return {
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);
      if (request.method !== 'GET' || !TRACE_LIVE_ROUTES.has(url.pathname)) {
        return jsonResponse({
          ok: false,
          publicBoundary: 'consuelo-gateway',
          error: { code: 'NOT_FOUND', message: 'Trace Sites gateway route not found.' },
        }, 404);
      }

      let scope: TraceGatewaySessionScope;
      try {
        scope = await options.resolveScope(request);
      } catch (error: unknown) {
        return jsonResponse({
          ok: false,
          publicBoundary: 'consuelo-gateway',
          error: {
            code: 'SCOPE_RESOLUTION_FAILED',
            message: error instanceof Error ? error.message.slice(0, 240) : 'Trace Sites scope resolution failed.',
          },
        }, 403);
      }

      if (url.pathname === '/gateway/traces/events') {
        return sseLiveResponse(request, url, scope, readLayer);
      }

      const layerResult = await readLayer.readTraceSitesDashboard(readRequestFromUrl(url, scope));
      if (!layerResult.ok) return failureResponse(url.pathname, layerResult);
      return successJsonResponse(url.pathname, layerResult);
    },
  };
}

export function traceGatewayScopeFromHeaders(request: Request): TraceGatewaySessionScope {
  const url = new URL(request.url);
  const headers = request.headers;
  const allowedSites = splitHeader(headers.get('x-consuelo-allowed-sites'));
  const sourceModes = splitHeader(headers.get('x-consuelo-source-modes')).filter(isTraceSourceMode);

  return {
    userId: headers.get('x-consuelo-user-id') || headers.get('x-consuelo-caller-id') || 'signed-gateway-caller',
    workspaceId: headers.get('x-consuelo-workspace-id') || 'workspace-unknown',
    workspaceHost: headers.get('x-consuelo-workspace-host') || url.host,
    allowedSites: allowedSites.length ? allowedSites : ['trace', 'trace-burn-intelligence'],
    traceRead: headers.get('x-consuelo-trace-read') !== 'false',
    traceWrite: headers.get('x-consuelo-trace-write') === 'true',
    runnerControl: headers.get('x-consuelo-runner-control') === 'true',
    sourceModesAllowed: sourceModes.length ? sourceModes : ['local-networked', 'cloud-compute'],
    retentionPolicyId: headers.get('x-consuelo-retention-policy-id') || 'ret_workspace_default',
  };
}

function readRequestFromUrl(url: URL, scope: TraceGatewaySessionScope): TraceSitesGatewayReadLayerRequest {
  const sourceMode = parseSourceMode(url.searchParams.get('sourceMode'));
  const site = parseSite(url.searchParams.get('site'));
  const limit = parseLimit(url.searchParams.get('limit'));

  return {
    scope,
    workspaceId: url.searchParams.get('workspaceId') || scope.workspaceId,
    workspaceHost: url.searchParams.get('workspaceHost') || scope.workspaceHost || url.host,
    site,
    sourceMode,
    cursor: url.searchParams.get('cursor') || '000000000000',
    limit,
    bridgeConfigured: url.searchParams.get('bridgeConfigured') === 'true',
  };
}

function successJsonResponse(route: string, result: Extract<TraceSitesGatewayReadLayerResult, { ok: true }>): Response {
  return jsonResponse({
    ok: true,
    publicBoundary: result.publicBoundary,
    route,
    data: responseData(result),
  });
}

function failureResponse(route: string, result: Extract<TraceSitesGatewayReadLayerResult, { ok: false }>): Response {
  const firstError = result.errors[0] ?? { code: 'TRACE_SITES_GATEWAY_ERROR', message: 'Trace Sites gateway read failed.' };
  return jsonResponse({
    ok: false,
    publicBoundary: result.publicBoundary,
    route,
    dataState: result.dataState,
    discovery: result.discovery,
    resilience: result.resilience,
    error: firstError,
    errors: result.errors,
  }, statusForFailure(result));
}

async function sseLiveResponse(
  request: Request,
  url: URL,
  scope: TraceGatewaySessionScope,
  readLayer: ReturnType<typeof createTraceSitesGatewayReadLayer>,
): Promise<Response> {
  try {
    const initialReadRequest = readRequestFromUrl(url, scope);
    const initialResult = await readLayer.readTraceSitesDashboard(initialReadRequest);
    if (!initialResult.ok) return failureResponse(url.pathname, initialResult);

    const initialSnapshot = streamSnapshotFromReadResult(initialResult);
    const streamEndpoint = createTraceSitesGatewayLiveStreamEndpoint({
      backend: {
        readInitialSnapshot(input) {
          if (input.cursor === initialReadRequest.cursor) return Promise.resolve(initialSnapshot);
          return readStreamSnapshotAtCursor(url, scope, readLayer, input.cursor);
        },
        readAfterCursor(cursor) {
          return readStreamSnapshotAtCursor(url, scope, readLayer, cursor);
        },
      },
    });

    return streamEndpoint.handle({
      method: request.method,
      url: request.url,
      host: url.host,
      workspaceId: scope.workspaceId,
      sourceMode: initialReadRequest.sourceMode,
      bridgeConfigured: url.searchParams.get('bridgeConfigured') !== 'false',
      headers: Object.fromEntries(request.headers.entries()),
      session: { workspaceId: scope.workspaceId },
    });
  } catch (error: unknown) {
    return jsonResponse({
      ok: false,
      publicBoundary: 'consuelo-gateway',
      route: url.pathname,
      error: {
        code: 'TRACE_SITES_STREAM_UNAVAILABLE',
        message: error instanceof Error ? error.message.slice(0, 240) : 'Trace Sites live stream unavailable.',
      },
    }, 503);
  }
}

async function readStreamSnapshotAtCursor(
  url: URL,
  scope: TraceGatewaySessionScope,
  readLayer: ReturnType<typeof createTraceSitesGatewayReadLayer>,
  cursor: string,
) {
  try {
    const nextUrl = new URL(url.toString());
    nextUrl.searchParams.set('cursor', cursor);
    const result = await readLayer.readTraceSitesDashboard(readRequestFromUrl(nextUrl, scope));
    if (!result.ok) throw new Error(result.errors[0]?.code ?? 'TRACE_SITES_STREAM_READ_FAILED');
    return streamSnapshotFromReadResult(result);
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : 'TRACE_SITES_STREAM_READ_FAILED');
  }
}

function streamSnapshotFromReadResult(result: Extract<TraceSitesGatewayReadLayerResult, { ok: true }>) {
  return {
    cursor: result.cursor,
    rows: result.recentEvents.map((event, index) => streamRowFromDashboardEvent(event, result.cursor, index)),
  };
}

function streamRowFromDashboardEvent(
  event: TraceSitesDashboardEvent,
  cursor: string,
  index: number,
): TraceSitesGatewayLiveStreamRow {
  const record = event as TraceSitesDashboardEvent & Record<string, unknown>;
  const traceId = typeof record.traceId === 'string' ? record.traceId : undefined;
  const idempotencyKey = typeof record.idempotencyKey === 'string' ? record.idempotencyKey : undefined;
  const rowCursor = typeof record.cursor === 'string' ? record.cursor : cursor;
  const status = typeof record.status === 'string' ? record.status : record.success === false ? 'error' : 'ok';

  return {
    ...record,
    id: traceId ?? idempotencyKey ?? `${cursor}:${index}`,
    traceId,
    cursor: rowCursor,
    idempotencyKey,
    toolName: typeof record.tool === 'string' ? record.tool : undefined,
    status,
    startedAt: typeof record.startedAt === 'string' ? record.startedAt : undefined,
  };
}

function responseData(result: Extract<TraceSitesGatewayReadLayerResult, { ok: true }>) {
  return {
    cursor: result.cursor,
    sourceMode: result.sourceMode,
    site: result.site,
    dataState: result.dataState,
    recentEvents: result.recentEvents,
    summary: result.summary,
    aggregateSource: result.aggregateSource,
    discovery: result.discovery,
    gatewayServices: result.gatewayServices,
    resilience: result.resilience,
  };
}

function statusForFailure(result: Extract<TraceSitesGatewayReadLayerResult, { ok: false }>): number {
  if (result.dataState === 'denied') return 403;
  if (result.dataState === 'bridge-required') return 503;
  if (result.dataState === 'unavailable') return 503;
  return 400;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function splitHeader(value: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseSourceMode(value: string | null): TraceSourceMode {
  return isTraceSourceMode(value) ? value : 'local-networked';
}

function isTraceSourceMode(value: unknown): value is TraceSourceMode {
  return value === 'local-networked' || value === 'cloud-compute' || value === 'local-off-network';
}

function parseSite(value: string | null): TraceSiteSlug {
  return value === 'trace' ? 'trace' : 'trace-burn-intelligence';
}

function parseLimit(value: string | null): number | undefined {
  if (!value) return undefined;
  const limit = Number(value);
  return Number.isFinite(limit) ? limit : undefined;
}
