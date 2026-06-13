export const TRACE_SITES_GATEWAY_CONTRACT_VERSION = '2026-06-13.pr1';

export type TraceSourceMode = 'local-networked' | 'cloud-compute' | 'local-off-network';
export type TraceComputeRuntime = 'local-macos' | 'local-linux' | 'cloud-linux' | 'cloud-macos' | 'unknown';
export type TraceRedactionStatus = 'redacted' | 'summarized' | 'raw';
export type TraceServiceName = 'trace-read' | 'trace-ingest' | 'runner-control' | 'aggregate-cache';
export type TraceGatewayRouteKind = 'read' | 'ingest' | 'live-events' | 'runner-control';
export type TraceGatewayPublicBoundary = 'consuelo-gateway';
export type TraceDirectBackendTarget = 'local-trace-db' | 'local-agent' | 'cloud-runner' | 'trace-store-file';

export type TraceSitesArchitectureMode = {
  sourceMode: TraceSourceMode;
  computeLocation: 'user-device' | 'consuelo-managed-runner';
  sitesHost: 'consuelohq.com';
  sitesHydration: 'consuelo-gateway' | 'unavailable-without-bridge';
  requiresConsueloNetwork: boolean;
  emitsThroughGateway: boolean;
  implementedForTraceSites: boolean;
  outOfScopeReason?: string;
};

export type TraceGatewayRoute = {
  name: 'recent' | 'summary' | 'aggregates' | 'events' | 'ingest' | 'runner-control';
  method: 'GET' | 'POST';
  path: string;
  routeKind: TraceGatewayRouteKind;
  publicBoundary: TraceGatewayPublicBoundary;
  service: TraceServiceName;
  requiresWorkspaceScope: true;
  cacheStrategy: 'cursor-window' | 'materialized-window' | 'event-stream' | 'write-through' | 'control-plane';
};

export type TraceGatewaySessionScope = {
  userId: string;
  workspaceId: string;
  workspaceHost: string;
  allowedSites: string[];
  traceRead: boolean;
  traceWrite: boolean;
  runnerControl: boolean;
  sourceModesAllowed: TraceSourceMode[];
  retentionPolicyId: string;
};

export type TraceGatewayDiscoveryInput = {
  workspaceId: string;
  workspaceHost: string;
  sourceMode: TraceSourceMode;
  bridgeConfigured?: boolean;
};

export type TraceGatewayDiscovery = {
  publicBoundary: TraceGatewayPublicBoundary;
  workspaceId: string;
  workspaceHost: string;
  sourceMode: TraceSourceMode;
  readService: TraceServiceName | null;
  ingestService: TraceServiceName | null;
  runnerControlService: TraceServiceName | null;
  sitesHydration: TraceSitesArchitectureMode['sitesHydration'];
  relayStatus: 'required' | 'not-required' | 'bridge-required';
};

export type TraceIngestEnvelope = {
  workspaceId?: string;
  sourceMode?: TraceSourceMode;
  computeRuntime?: TraceComputeRuntime;
  runnerId?: string;
  sessionId?: string;
  traceId?: string;
  cursor?: string;
  idempotencyKey?: string;
  payloadBytes?: number;
  redactionStatus?: TraceRedactionStatus;
};

export type TraceIngestPolicy = {
  maxPayloadBytes: number;
  allowedSourceModes: TraceSourceMode[];
};

export type TraceIngestValidationError =
  | 'MISSING_WORKSPACE_ID'
  | 'MISSING_SOURCE_MODE'
  | 'SOURCE_MODE_NOT_ALLOWED'
  | 'LOCAL_OFF_NETWORK_OUT_OF_SCOPE'
  | 'MISSING_TRACE_ID'
  | 'MISSING_CURSOR'
  | 'MISSING_IDEMPOTENCY_KEY'
  | 'TRACE_PAYLOAD_TOO_LARGE'
  | 'TRACE_PAYLOAD_NOT_REDACTED';

export type TraceIngestValidation = {
  ok: boolean;
  errors: TraceIngestValidationError[];
};

export type TraceGatewayResilienceInput = {
  sourceMode: TraceSourceMode;
  localRelayOnline: boolean;
  cloudRunnerSaturated: boolean;
  traceStoreAvailable: boolean;
  aggregateCacheAvailable: boolean;
};

export type TraceGatewayResilienceState = {
  liveFeed: 'live' | 'disconnected' | 'degraded';
  dashboardData: 'fresh' | 'stale-snapshot' | 'cached-aggregates' | 'unavailable';
  retryPolicy: 'normal' | 'backoff' | 'circuit-open';
  userVisibleState: 'healthy' | 'local-relay-offline' | 'cloud-runner-saturated' | 'trace-store-degraded' | 'unavailable';
};

export type TraceSitesDashboardEvent = {
  traceId: string;
  idempotencyKey: string;
  sourceMode: TraceSourceMode;
  branch: string;
  tool: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  success: boolean;
  errorCause?: string;
};

export type TraceSitesDashboardSummary = {
  calls: number;
  totalTraceBurn: number;
  outputTokens: number;
  totalCostUsd: number;
  errorPressure: number;
  avgBurnPerCall: number;
  topBranches: Array<{ branch: string; tokens: number }>;
  topTools: Array<{ tool: string; tokens: number }>;
  failureCauses: Array<{ cause: string; count: number }>;
  sourceModes: TraceSourceMode[];
};

export const DEFAULT_TRACE_INGEST_POLICY: TraceIngestPolicy = {
  maxPayloadBytes: 64 * 1024,
  allowedSourceModes: ['local-networked', 'cloud-compute'],
};

export const TRACE_RETENTION_POLICY_CONTRACT = {
  policyType: 'workspace-config',
  rawPayloadTtlDays: 7,
  aggregateTtlDays: 90,
  userConfigurable: true,
  commercialTierCoupled: false,
} as const;

const TRACE_SITES_ARCHITECTURE_MODES: Record<TraceSourceMode, TraceSitesArchitectureMode> = {
  'local-networked': {
    sourceMode: 'local-networked',
    computeLocation: 'user-device',
    sitesHost: 'consuelohq.com',
    sitesHydration: 'consuelo-gateway',
    requiresConsueloNetwork: true,
    emitsThroughGateway: true,
    implementedForTraceSites: true,
  },
  'cloud-compute': {
    sourceMode: 'cloud-compute',
    computeLocation: 'consuelo-managed-runner',
    sitesHost: 'consuelohq.com',
    sitesHydration: 'consuelo-gateway',
    requiresConsueloNetwork: false,
    emitsThroughGateway: true,
    implementedForTraceSites: true,
  },
  'local-off-network': {
    sourceMode: 'local-off-network',
    computeLocation: 'user-device',
    sitesHost: 'consuelohq.com',
    sitesHydration: 'unavailable-without-bridge',
    requiresConsueloNetwork: false,
    emitsThroughGateway: false,
    implementedForTraceSites: false,
    outOfScopeReason: 'Future installer/settings mode; hosted Sites require a configured bridge before hydration.',
  },
};

export const TRACE_GATEWAY_ROUTES: TraceGatewayRoute[] = [
  {
    name: 'recent',
    method: 'GET',
    path: '/gateway/traces/recent',
    routeKind: 'read',
    publicBoundary: 'consuelo-gateway',
    service: 'trace-read',
    requiresWorkspaceScope: true,
    cacheStrategy: 'cursor-window',
  },
  {
    name: 'summary',
    method: 'GET',
    path: '/gateway/traces/summary',
    routeKind: 'read',
    publicBoundary: 'consuelo-gateway',
    service: 'trace-read',
    requiresWorkspaceScope: true,
    cacheStrategy: 'materialized-window',
  },
  {
    name: 'aggregates',
    method: 'GET',
    path: '/gateway/traces/aggregates',
    routeKind: 'read',
    publicBoundary: 'consuelo-gateway',
    service: 'aggregate-cache',
    requiresWorkspaceScope: true,
    cacheStrategy: 'materialized-window',
  },
  {
    name: 'events',
    method: 'GET',
    path: '/gateway/traces/events',
    routeKind: 'live-events',
    publicBoundary: 'consuelo-gateway',
    service: 'trace-read',
    requiresWorkspaceScope: true,
    cacheStrategy: 'event-stream',
  },
  {
    name: 'ingest',
    method: 'POST',
    path: '/gateway/traces/ingest',
    routeKind: 'ingest',
    publicBoundary: 'consuelo-gateway',
    service: 'trace-ingest',
    requiresWorkspaceScope: true,
    cacheStrategy: 'write-through',
  },
  {
    name: 'runner-control',
    method: 'POST',
    path: '/gateway/runners/control',
    routeKind: 'runner-control',
    publicBoundary: 'consuelo-gateway',
    service: 'runner-control',
    requiresWorkspaceScope: true,
    cacheStrategy: 'control-plane',
  },
];

export function getTraceSitesArchitectureMode(sourceMode: TraceSourceMode): TraceSitesArchitectureMode {
  return TRACE_SITES_ARCHITECTURE_MODES[sourceMode];
}

export function listTraceSitesArchitectureModes(): TraceSitesArchitectureMode[] {
  return Object.values(TRACE_SITES_ARCHITECTURE_MODES);
}

export function getTraceGatewayRoutesForSites(): TraceGatewayRoute[] {
  return TRACE_GATEWAY_ROUTES.filter((route) => route.routeKind !== 'runner-control');
}

export function isDirectTraceBackendTarget(target: TraceGatewayPublicBoundary | TraceDirectBackendTarget): target is TraceDirectBackendTarget {
  return target !== 'consuelo-gateway';
}

export function canScopeReadTraceSites(scope: TraceGatewaySessionScope, workspaceHost: string): boolean {
  return scope.traceRead && scope.workspaceHost === workspaceHost && scope.allowedSites.includes('trace-burn-intelligence');
}

export function resolveTraceGatewayDiscovery(input: TraceGatewayDiscoveryInput): TraceGatewayDiscovery {
  const mode = getTraceSitesArchitectureMode(input.sourceMode);

  if (input.sourceMode === 'local-off-network' && !input.bridgeConfigured) {
    return {
      publicBoundary: 'consuelo-gateway',
      workspaceId: input.workspaceId,
      workspaceHost: input.workspaceHost,
      sourceMode: input.sourceMode,
      readService: null,
      ingestService: null,
      runnerControlService: null,
      sitesHydration: 'unavailable-without-bridge',
      relayStatus: 'bridge-required',
    };
  }

  return {
    publicBoundary: 'consuelo-gateway',
    workspaceId: input.workspaceId,
    workspaceHost: input.workspaceHost,
    sourceMode: input.sourceMode,
    readService: 'trace-read',
    ingestService: 'trace-ingest',
    runnerControlService: input.sourceMode === 'cloud-compute' ? 'runner-control' : null,
    sitesHydration: mode.sitesHydration,
    relayStatus: input.sourceMode === 'local-networked' ? 'required' : 'not-required',
  };
}

export function validateTraceIngestEnvelope(
  envelope: TraceIngestEnvelope,
  policy: TraceIngestPolicy = DEFAULT_TRACE_INGEST_POLICY,
): TraceIngestValidation {
  const errors: TraceIngestValidationError[] = [];

  if (!envelope.workspaceId) errors.push('MISSING_WORKSPACE_ID');
  if (!envelope.sourceMode) errors.push('MISSING_SOURCE_MODE');
  if (envelope.sourceMode && !policy.allowedSourceModes.includes(envelope.sourceMode)) errors.push('SOURCE_MODE_NOT_ALLOWED');
  if (envelope.sourceMode === 'local-off-network') errors.push('LOCAL_OFF_NETWORK_OUT_OF_SCOPE');
  if (!envelope.traceId) errors.push('MISSING_TRACE_ID');
  if (!envelope.cursor) errors.push('MISSING_CURSOR');
  if (!envelope.idempotencyKey) errors.push('MISSING_IDEMPOTENCY_KEY');
  if ((envelope.payloadBytes ?? 0) > policy.maxPayloadBytes) errors.push('TRACE_PAYLOAD_TOO_LARGE');
  if (envelope.redactionStatus !== 'redacted' && envelope.redactionStatus !== 'summarized') {
    errors.push('TRACE_PAYLOAD_NOT_REDACTED');
  }

  return { ok: errors.length === 0, errors };
}

export function resolveTraceGatewayResilienceState(input: TraceGatewayResilienceInput): TraceGatewayResilienceState {
  if (!input.traceStoreAvailable && input.aggregateCacheAvailable) {
    return {
      liveFeed: 'degraded',
      dashboardData: 'cached-aggregates',
      retryPolicy: 'backoff',
      userVisibleState: 'trace-store-degraded',
    };
  }

  if (!input.traceStoreAvailable) {
    return {
      liveFeed: 'disconnected',
      dashboardData: 'unavailable',
      retryPolicy: 'circuit-open',
      userVisibleState: 'unavailable',
    };
  }

  if (input.sourceMode === 'local-networked' && !input.localRelayOnline) {
    return {
      liveFeed: 'disconnected',
      dashboardData: 'stale-snapshot',
      retryPolicy: 'backoff',
      userVisibleState: 'local-relay-offline',
    };
  }

  if (input.sourceMode === 'cloud-compute' && input.cloudRunnerSaturated) {
    return {
      liveFeed: 'degraded',
      dashboardData: 'fresh',
      retryPolicy: 'circuit-open',
      userVisibleState: 'cloud-runner-saturated',
    };
  }

  return {
    liveFeed: 'live',
    dashboardData: 'fresh',
    retryPolicy: 'normal',
    userVisibleState: 'healthy',
  };
}

export function reduceTraceSitesDashboard(events: TraceSitesDashboardEvent[]): TraceSitesDashboardSummary {
  const uniqueEvents = new Map<string, TraceSitesDashboardEvent>();
  for (const event of events) {
    if (!uniqueEvents.has(event.idempotencyKey)) {
      uniqueEvents.set(event.idempotencyKey, event);
    }
  }

  const branchTokens = new Map<string, number>();
  const toolTokens = new Map<string, number>();
  const failureCauses = new Map<string, number>();
  const sourceModes = new Set<TraceSourceMode>();

  let totalTraceBurn = 0;
  let outputTokens = 0;
  let totalCostUsd = 0;
  let errors = 0;

  for (const event of uniqueEvents.values()) {
    const eventBurn = event.inputTokens + event.outputTokens;
    totalTraceBurn += eventBurn;
    outputTokens += event.outputTokens;
    totalCostUsd += event.costUsd;
    sourceModes.add(event.sourceMode);
    branchTokens.set(event.branch, (branchTokens.get(event.branch) ?? 0) + eventBurn);
    toolTokens.set(event.tool, (toolTokens.get(event.tool) ?? 0) + eventBurn);

    if (!event.success) {
      errors += 1;
      const cause = event.errorCause ?? 'unknown';
      failureCauses.set(cause, (failureCauses.get(cause) ?? 0) + 1);
    }
  }

  const calls = uniqueEvents.size;

  return {
    calls,
    totalTraceBurn,
    outputTokens,
    totalCostUsd: Number(totalCostUsd.toFixed(6)),
    errorPressure: calls === 0 ? 0 : errors / calls,
    avgBurnPerCall: calls === 0 ? 0 : totalTraceBurn / calls,
    topBranches: sortTokenMap(branchTokens, 'branch'),
    topTools: sortTokenMap(toolTokens, 'tool'),
    failureCauses: [...failureCauses.entries()]
      .map(([cause, count]) => ({ cause, count }))
      .sort((left, right) => right.count - left.count || left.cause.localeCompare(right.cause)),
    sourceModes: [...sourceModes].sort(),
  };
}

function sortTokenMap<TName extends 'branch' | 'tool'>(values: Map<string, number>, key: TName): Array<Record<TName, string> & { tokens: number }> {
  return [...values.entries()]
    .map(([name, tokens]) => ({ [key]: name, tokens }) as Record<TName, string> & { tokens: number })
    .sort((left, right) => right.tokens - left.tokens || left[key].localeCompare(right[key]));
}
