import {
  DEFAULT_TRACE_READ_POLICY,
  applyTraceSitesLiveDeltas,
  canScopeReadTraceSites,
  resolveTraceGatewayDiscovery,
  resolveTraceGatewayResilienceState,
  validateTraceReadQuery,
  type TraceGatewayDiscovery,
  type TraceGatewayResilienceState,
  type TraceGatewaySessionScope,
  type TraceReadPolicy,
  type TraceReadValidationError,
  type TraceSiteSlug,
  type TraceSitesDashboardEvent,
  type TraceSitesDashboardSummary,
  type TraceSitesLiveDelta,
  type TraceSourceMode,
} from './trace-sites-gateway-contract';

export const TRACE_SITES_GATEWAY_READ_LAYER_VERSION = '2026-06-13.pr2';

export type TraceSitesGatewayReadLayerErrorCode =
  | 'SCOPE_DENIED'
  | 'SOURCE_MODE_DENIED'
  | 'READ_QUERY_INVALID'
  | 'BRIDGE_REQUIRED'
  | 'TRACE_STORE_UNAVAILABLE'
  | 'AGGREGATE_CACHE_EMPTY';

export type TraceSitesGatewayReadLayerError = {
  code: TraceSitesGatewayReadLayerErrorCode;
  message: string;
  contractErrors?: TraceReadValidationError[];
};

export type TraceSitesGatewayReadLayerRequest = {
  scope: TraceGatewaySessionScope;
  workspaceId: string;
  workspaceHost: string;
  site: TraceSiteSlug;
  sourceMode: TraceSourceMode;
  cursor: string;
  limit?: number;
  bridgeConfigured?: boolean;
  includeRawPayload?: boolean;
  requesterCanReadRawPayload?: boolean;
};

export type TraceSitesGatewayReadBackendInput = {
  workspaceId: string;
  workspaceHost: string;
  site: TraceSiteSlug;
  sourceMode: TraceSourceMode;
  cursor: string;
  limit: number;
};

export type TraceSitesGatewayReadBackendHealth = {
  traceStoreAvailable: boolean;
  aggregateCacheAvailable: boolean;
  localRelayOnline: boolean;
  cloudRunnerSaturated: boolean;
};

export type TraceSitesGatewayRecentEvents = {
  cursor: string;
  events: TraceSitesDashboardEvent[];
  deltas?: TraceSitesLiveDelta[];
};

export type TraceSitesGatewayCachedAggregate = {
  cursor: string;
  summary: TraceSitesDashboardSummary | null;
};

type MaybePromise<T> = T | Promise<T>;

export type TraceSitesGatewayReadBackendAdapter = {
  resolveHealth?: (input: TraceSitesGatewayReadBackendInput) => MaybePromise<Partial<TraceSitesGatewayReadBackendHealth>>;
  readRecentEvents: (input: TraceSitesGatewayReadBackendInput) => MaybePromise<TraceSitesGatewayRecentEvents>;
  readCachedAggregate: (input: TraceSitesGatewayReadBackendInput) => MaybePromise<TraceSitesGatewayCachedAggregate>;
};

export type TraceSitesGatewayServices = {
  readService: TraceGatewayDiscovery['readService'];
  aggregateService: TraceGatewayDiscovery['readService'] | 'aggregate-cache' | null;
  runnerControlService: TraceGatewayDiscovery['runnerControlService'];
};

type TraceSitesReadDataState = TraceGatewayResilienceState['dashboardData'] | 'bridge-required' | 'denied';

export type TraceSitesGatewayReadLayerSuccess = {
  ok: true;
  publicBoundary: 'consuelo-gateway';
  workspaceId: string;
  workspaceHost: string;
  site: TraceSiteSlug;
  sourceMode: TraceSourceMode;
  discovery: TraceGatewayDiscovery;
  gatewayServices: TraceSitesGatewayServices;
  resilience: TraceGatewayResilienceState;
  dataState: TraceSitesReadDataState;
  cursor: string;
  recentEvents: TraceSitesDashboardEvent[];
  summary: TraceSitesDashboardSummary;
  aggregateSource: 'trace-store' | 'aggregate-cache';
};

export type TraceSitesGatewayReadLayerFailure = {
  ok: false;
  publicBoundary: 'consuelo-gateway';
  workspaceId: string;
  workspaceHost: string;
  site: TraceSiteSlug;
  sourceMode: TraceSourceMode;
  discovery?: TraceGatewayDiscovery;
  gatewayServices?: TraceSitesGatewayServices;
  resilience?: TraceGatewayResilienceState;
  dataState: TraceSitesReadDataState;
  errors: TraceSitesGatewayReadLayerError[];
};

export type TraceSitesGatewayReadLayerResult = TraceSitesGatewayReadLayerSuccess | TraceSitesGatewayReadLayerFailure;

export type TraceSitesGatewayReadLayer = {
  readTraceSitesDashboard: (request: TraceSitesGatewayReadLayerRequest) => Promise<TraceSitesGatewayReadLayerResult>;
};

export function createTraceSitesGatewayReadLayer(
  backend: TraceSitesGatewayReadBackendAdapter,
  options: { readPolicy?: TraceReadPolicy } = {},
): TraceSitesGatewayReadLayer {
  const readPolicy = options.readPolicy ?? DEFAULT_TRACE_READ_POLICY;

  return {
    async readTraceSitesDashboard(request: TraceSitesGatewayReadLayerRequest): Promise<TraceSitesGatewayReadLayerResult> {
      const discovery = resolveTraceGatewayDiscovery({
        workspaceId: request.workspaceId,
        workspaceHost: request.workspaceHost,
        sourceMode: request.sourceMode,
        bridgeConfigured: request.bridgeConfigured,
      });
      const gatewayServices = getGatewayServices(discovery);

      if (!canScopeReadTraceSites(request.scope, request.workspaceHost, request.site) || request.scope.workspaceId !== request.workspaceId) {
        return failure(request, 'denied', [{
          code: 'SCOPE_DENIED',
          message: 'Trace Sites reads require workspace trace-read scope and the requested Site scope.',
        }], discovery, gatewayServices);
      }

      if (!request.scope.sourceModesAllowed.includes(request.sourceMode)) {
        return failure(request, 'denied', [{
          code: 'SOURCE_MODE_DENIED',
          message: 'The workspace session is not allowed to read the requested trace source mode.',
        }], discovery, gatewayServices);
      }

      const validation = validateTraceReadQuery({
        workspaceId: request.workspaceId,
        workspaceHost: request.workspaceHost,
        site: request.site,
        cursor: request.cursor,
        limit: request.limit,
        includeRawPayload: request.includeRawPayload,
        requesterCanReadRawPayload: request.requesterCanReadRawPayload,
      }, readPolicy);

      if (!validation.ok) {
        return failure(request, 'denied', [{
          code: 'READ_QUERY_INVALID',
          message: 'Trace Sites read query failed the PR1 gateway read contract.',
          contractErrors: validation.errors,
        }], discovery, gatewayServices);
      }

      if (discovery.sitesHydration === 'unavailable-without-bridge' || discovery.relayStatus === 'bridge-required') {
        return failure(request, 'bridge-required', [{
          code: 'BRIDGE_REQUIRED',
          message: 'Local off-network Trace Sites hydration requires a configured bridge.',
        }], discovery, gatewayServices, resolveTraceGatewayResilienceState({
          sourceMode: request.sourceMode,
          localRelayOnline: false,
          cloudRunnerSaturated: false,
          traceStoreAvailable: false,
          aggregateCacheAvailable: false,
        }));
      }

      const backendInput: TraceSitesGatewayReadBackendInput = {
        workspaceId: request.workspaceId,
        workspaceHost: request.workspaceHost,
        site: request.site,
        sourceMode: request.sourceMode,
        cursor: request.cursor,
        limit: request.limit ?? readPolicy.maxWindowSize,
      };
      const health = await resolveBackendHealth(backend, backendInput);
      const resilience = resolveTraceGatewayResilienceState({
        sourceMode: request.sourceMode,
        localRelayOnline: health.localRelayOnline,
        cloudRunnerSaturated: health.cloudRunnerSaturated,
        traceStoreAvailable: health.traceStoreAvailable,
        aggregateCacheAvailable: health.aggregateCacheAvailable,
      });

      if (!health.traceStoreAvailable) {
        if (health.aggregateCacheAvailable) {
          const cached = await backend.readCachedAggregate(backendInput);
          if (cached.summary) {
            return {
              ok: true,
              publicBoundary: 'consuelo-gateway',
              workspaceId: request.workspaceId,
              workspaceHost: request.workspaceHost,
              site: request.site,
              sourceMode: request.sourceMode,
              discovery,
              gatewayServices,
              resilience,
              dataState: resilience.dashboardData,
              cursor: cached.cursor,
              recentEvents: [],
              summary: cached.summary,
              aggregateSource: 'aggregate-cache',
            };
          }

          return failure(request, 'unavailable', [{
            code: 'AGGREGATE_CACHE_EMPTY',
            message: 'Trace store is unavailable and the aggregate cache did not return a cached summary.',
          }], discovery, gatewayServices, resilience);
        }

        return failure(request, 'unavailable', [{
          code: 'TRACE_STORE_UNAVAILABLE',
          message: 'Trace store is unavailable and no aggregate cache is available for Trace Sites.',
        }], discovery, gatewayServices, resilience);
      }

      const recent = await backend.readRecentEvents(backendInput);
      const boundedEvents = boundEvents(recent.events, backendInput.limit);
      const liveState = applyTraceSitesLiveDeltas({
        cursor: recent.cursor,
        events: boundedEvents,
      }, recent.deltas ?? []);

      return {
        ok: true,
        publicBoundary: 'consuelo-gateway',
        workspaceId: request.workspaceId,
        workspaceHost: request.workspaceHost,
        site: request.site,
        sourceMode: request.sourceMode,
        discovery,
        gatewayServices,
        resilience,
        dataState: resilience.dashboardData,
        cursor: liveState.cursor,
        recentEvents: liveState.events,
        summary: liveState.summary,
        aggregateSource: 'trace-store',
      };
    },
  };
}

export function createFixtureTraceSitesReadBackend(input: {
  events?: TraceSitesDashboardEvent[];
  deltas?: TraceSitesLiveDelta[];
  cursor?: string;
  cachedSummary?: TraceSitesDashboardSummary | null;
  cachedCursor?: string;
  health?: Partial<TraceSitesGatewayReadBackendHealth>;
} = {}): TraceSitesGatewayReadBackendAdapter {
  const cursor = input.cursor ?? '00000000';
  return {
    resolveHealth() {
      return input.health ?? {};
    },
    readRecentEvents(readInput) {
      return {
        cursor,
        events: boundEvents(input.events ?? [], readInput.limit),
        deltas: input.deltas ?? [],
      };
    },
    readCachedAggregate() {
      return {
        cursor: input.cachedCursor ?? cursor,
        summary: input.cachedSummary ?? null,
      };
    },
  };
}

function getGatewayServices(discovery: TraceGatewayDiscovery): TraceSitesGatewayServices {
  return {
    readService: discovery.readService,
    aggregateService: discovery.readService ? 'aggregate-cache' : null,
    runnerControlService: discovery.runnerControlService,
  };
}

async function resolveBackendHealth(
  backend: TraceSitesGatewayReadBackendAdapter,
  input: TraceSitesGatewayReadBackendInput,
): Promise<TraceSitesGatewayReadBackendHealth> {
  const health = await backend.resolveHealth?.(input);
  return {
    traceStoreAvailable: health?.traceStoreAvailable ?? true,
    aggregateCacheAvailable: health?.aggregateCacheAvailable ?? true,
    localRelayOnline: health?.localRelayOnline ?? true,
    cloudRunnerSaturated: health?.cloudRunnerSaturated ?? false,
  };
}

function failure(
  request: TraceSitesGatewayReadLayerRequest,
  dataState: TraceSitesReadDataState,
  errors: TraceSitesGatewayReadLayerError[],
  discovery?: TraceGatewayDiscovery,
  gatewayServices?: TraceSitesGatewayServices,
  resilience?: TraceGatewayResilienceState,
): TraceSitesGatewayReadLayerFailure {
  return {
    ok: false,
    publicBoundary: 'consuelo-gateway',
    workspaceId: request.workspaceId,
    workspaceHost: request.workspaceHost,
    site: request.site,
    sourceMode: request.sourceMode,
    discovery,
    gatewayServices,
    resilience,
    dataState,
    errors,
  };
}

function boundEvents(events: TraceSitesDashboardEvent[], limit: number): TraceSitesDashboardEvent[] {
  if (limit < 0) return [];
  return events.slice(Math.max(0, events.length - limit));
}
