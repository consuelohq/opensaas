import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TRACE_INGEST_POLICY,
  TRACE_GATEWAY_ROUTES,
  TRACE_RETENTION_POLICY_CONTRACT,
  TRACE_SITES_GATEWAY_CONTRACT_VERSION,
  canScopeReadTraceSites,
  getTraceGatewayRoutesForSites,
  getTraceSitesArchitectureMode,
  isDirectTraceBackendTarget,
  listTraceSitesArchitectureModes,
  reduceTraceSitesDashboard,
  resolveTraceGatewayDiscovery,
  resolveTraceGatewayResilienceState,
  validateTraceIngestEnvelope,
  type TraceGatewaySessionScope,
} from '../scripts/lib/trace-sites-gateway-contract';

describe('Trace Sites gateway architecture contract', () => {
  it('locks the PR1 contract version and the three source modes', () => {
    expect(TRACE_SITES_GATEWAY_CONTRACT_VERSION).toBe('2026-06-13.pr1');
    expect(listTraceSitesArchitectureModes().map((mode) => mode.sourceMode).sort()).toEqual([
      'cloud-compute',
      'local-networked',
      'local-off-network',
    ]);
  });

  it('keeps default local mode as local compute on the Consuelo network with hosted Sites', () => {
    expect(getTraceSitesArchitectureMode('local-networked')).toMatchObject({
      computeLocation: 'user-device',
      sitesHost: 'consuelohq.com',
      sitesHydration: 'consuelo-gateway',
      requiresConsueloNetwork: true,
      emitsThroughGateway: true,
      implementedForTraceSites: true,
    });
  });

  it('keeps cloud compute behind the same hosted Sites and gateway contract', () => {
    expect(getTraceSitesArchitectureMode('cloud-compute')).toMatchObject({
      computeLocation: 'consuelo-managed-runner',
      sitesHost: 'consuelohq.com',
      sitesHydration: 'consuelo-gateway',
      requiresConsueloNetwork: false,
      emitsThroughGateway: true,
      implementedForTraceSites: true,
    });
  });

  it('keeps local off-network as future installer or settings work unless a bridge is configured', () => {
    expect(getTraceSitesArchitectureMode('local-off-network')).toMatchObject({
      sitesHydration: 'unavailable-without-bridge',
      emitsThroughGateway: false,
      implementedForTraceSites: false,
    });
  });

  it('forces Consuelo Sites to use the gateway instead of direct trace backends', () => {
    const sitesRoutes = getTraceGatewayRoutesForSites();

    expect(sitesRoutes.map((route) => route.name).sort()).toEqual(['aggregates', 'events', 'ingest', 'recent', 'summary']);
    expect(sitesRoutes.every((route) => route.publicBoundary === 'consuelo-gateway')).toBe(true);
    expect(sitesRoutes.every((route) => route.path.startsWith('/gateway/'))).toBe(true);
    expect(['local-trace-db', 'local-agent', 'cloud-runner', 'trace-store-file'].every(isDirectTraceBackendTarget)).toBe(true);
    expect(isDirectTraceBackendTarget('consuelo-gateway')).toBe(false);
  });

  it('defines the read, live, ingest, and runner-control gateway surfaces', () => {
    expect(TRACE_GATEWAY_ROUTES).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'recent', method: 'GET', service: 'trace-read', cacheStrategy: 'cursor-window' }),
      expect.objectContaining({ name: 'summary', method: 'GET', service: 'trace-read', cacheStrategy: 'materialized-window' }),
      expect.objectContaining({ name: 'aggregates', method: 'GET', service: 'aggregate-cache', cacheStrategy: 'materialized-window' }),
      expect.objectContaining({ name: 'events', method: 'GET', routeKind: 'live-events', cacheStrategy: 'event-stream' }),
      expect.objectContaining({ name: 'ingest', method: 'POST', service: 'trace-ingest', cacheStrategy: 'write-through' }),
      expect.objectContaining({ name: 'runner-control', method: 'POST', service: 'runner-control', cacheStrategy: 'control-plane' }),
    ]));
  });

  it('gates trace reads through workspace and Site scope', () => {
    const scope: TraceGatewaySessionScope = {
      userId: 'usr_123',
      workspaceId: 'wrk_123',
      workspaceHost: 'testing.consuelohq.com',
      allowedSites: ['trace-burn-intelligence'],
      traceRead: true,
      traceWrite: false,
      runnerControl: false,
      sourceModesAllowed: ['local-networked'],
      retentionPolicyId: 'ret_workspace_default',
    };

    expect(canScopeReadTraceSites(scope, 'testing.consuelohq.com')).toBe(true);
    expect(canScopeReadTraceSites({ ...scope, traceRead: false }, 'testing.consuelohq.com')).toBe(false);
    expect(canScopeReadTraceSites({ ...scope, allowedSites: ['office'] }, 'testing.consuelohq.com')).toBe(false);
    expect(canScopeReadTraceSites(scope, 'other.consuelohq.com')).toBe(false);
  });
});

describe('Trace Sites gateway routing and ingest contracts', () => {
  it('routes local-networked workspaces to read and ingest services with a required relay', () => {
    expect(resolveTraceGatewayDiscovery({
      workspaceId: 'wrk_local',
      workspaceHost: 'local.consuelohq.com',
      sourceMode: 'local-networked',
    })).toMatchObject({
      publicBoundary: 'consuelo-gateway',
      readService: 'trace-read',
      ingestService: 'trace-ingest',
      runnerControlService: null,
      sitesHydration: 'consuelo-gateway',
      relayStatus: 'required',
    });
  });

  it('routes cloud-compute workspaces to the same trace services plus runner control', () => {
    expect(resolveTraceGatewayDiscovery({
      workspaceId: 'wrk_cloud',
      workspaceHost: 'cloud.consuelohq.com',
      sourceMode: 'cloud-compute',
    })).toMatchObject({
      publicBoundary: 'consuelo-gateway',
      readService: 'trace-read',
      ingestService: 'trace-ingest',
      runnerControlService: 'runner-control',
      sitesHydration: 'consuelo-gateway',
      relayStatus: 'not-required',
    });
  });

  it('does not hydrate local off-network Sites without a configured bridge', () => {
    expect(resolveTraceGatewayDiscovery({
      workspaceId: 'wrk_off_network',
      workspaceHost: 'offline.consuelohq.com',
      sourceMode: 'local-off-network',
    })).toMatchObject({
      publicBoundary: 'consuelo-gateway',
      readService: null,
      ingestService: null,
      runnerControlService: null,
      sitesHydration: 'unavailable-without-bridge',
      relayStatus: 'bridge-required',
    });
  });

  it('requires workspace identity, allowed source mode, redaction, bounded payload, cursor, and idempotency for ingest', () => {
    expect(validateTraceIngestEnvelope({
      workspaceId: 'wrk_123',
      sourceMode: 'local-networked',
      computeRuntime: 'local-macos',
      runnerId: 'macbook-ko',
      sessionId: 'sess_123',
      traceId: 'trc_123',
      cursor: '00000001',
      idempotencyKey: 'wrk_123:trc_123:00000001',
      payloadBytes: DEFAULT_TRACE_INGEST_POLICY.maxPayloadBytes,
      redactionStatus: 'redacted',
    })).toEqual({ ok: true, errors: [] });

    expect(validateTraceIngestEnvelope({
      sourceMode: 'local-off-network',
      traceId: 'trc_123',
      payloadBytes: DEFAULT_TRACE_INGEST_POLICY.maxPayloadBytes + 1,
      redactionStatus: 'raw',
    }).errors).toEqual(expect.arrayContaining([
      'MISSING_WORKSPACE_ID',
      'SOURCE_MODE_NOT_ALLOWED',
      'LOCAL_OFF_NETWORK_OUT_OF_SCOPE',
      'MISSING_CURSOR',
      'MISSING_IDEMPOTENCY_KEY',
      'TRACE_PAYLOAD_TOO_LARGE',
      'TRACE_PAYLOAD_NOT_REDACTED',
    ]));
  });
});

describe('Trace Sites gateway resilience and dashboard contracts', () => {
  it('degrades cleanly when a local relay is offline', () => {
    expect(resolveTraceGatewayResilienceState({
      sourceMode: 'local-networked',
      localRelayOnline: false,
      cloudRunnerSaturated: false,
      traceStoreAvailable: true,
      aggregateCacheAvailable: true,
    })).toEqual({
      liveFeed: 'disconnected',
      dashboardData: 'stale-snapshot',
      retryPolicy: 'backoff',
      userVisibleState: 'local-relay-offline',
    });
  });

  it('opens the runner circuit when cloud compute is saturated', () => {
    expect(resolveTraceGatewayResilienceState({
      sourceMode: 'cloud-compute',
      localRelayOnline: true,
      cloudRunnerSaturated: true,
      traceStoreAvailable: true,
      aggregateCacheAvailable: true,
    })).toEqual({
      liveFeed: 'degraded',
      dashboardData: 'fresh',
      retryPolicy: 'circuit-open',
      userVisibleState: 'cloud-runner-saturated',
    });
  });

  it('keeps materialized dashboard aggregates available when the trace store is degraded', () => {
    expect(resolveTraceGatewayResilienceState({
      sourceMode: 'local-networked',
      localRelayOnline: true,
      cloudRunnerSaturated: false,
      traceStoreAvailable: false,
      aggregateCacheAvailable: true,
    })).toEqual({
      liveFeed: 'degraded',
      dashboardData: 'cached-aggregates',
      retryPolicy: 'backoff',
      userVisibleState: 'trace-store-degraded',
    });
  });

  it('reduces local-networked and cloud-compute traces into one dashboard model without double-counting retries', () => {
    const summary = reduceTraceSitesDashboard([
      {
        traceId: 'trc_local_1',
        idempotencyKey: 'wrk:trc_local_1:1',
        sourceMode: 'local-networked',
        branch: 'task/sites/trace-live-system-design-alignment',
        tool: 'task.call',
        inputTokens: 100,
        outputTokens: 300,
        costUsd: 0.01,
        success: true,
      },
      {
        traceId: 'trc_cloud_1',
        idempotencyKey: 'wrk:trc_cloud_1:1',
        sourceMode: 'cloud-compute',
        branch: 'task/sites/trace-live-system-design-alignment',
        tool: 'runner.exec',
        inputTokens: 50,
        outputTokens: 150,
        costUsd: 0.02,
        success: false,
        errorCause: 'RUNNER_SATURATED',
      },
      {
        traceId: 'trc_cloud_1_retry',
        idempotencyKey: 'wrk:trc_cloud_1:1',
        sourceMode: 'cloud-compute',
        branch: 'task/sites/trace-live-system-design-alignment',
        tool: 'runner.exec',
        inputTokens: 5000,
        outputTokens: 5000,
        costUsd: 5,
        success: false,
        errorCause: 'DUPLICATE_RETRY',
      },
    ]);

    expect(summary).toMatchObject({
      calls: 2,
      totalTraceBurn: 600,
      outputTokens: 450,
      totalCostUsd: 0.03,
      errorPressure: 0.5,
      avgBurnPerCall: 300,
      sourceModes: ['cloud-compute', 'local-networked'],
    });
    expect(summary.topBranches).toEqual([{ branch: 'task/sites/trace-live-system-design-alignment', tokens: 600 }]);
    expect(summary.topTools).toEqual([
      { tool: 'task.call', tokens: 400 },
      { tool: 'runner.exec', tokens: 200 },
    ]);
    expect(summary.failureCauses).toEqual([{ cause: 'RUNNER_SATURATED', count: 1 }]);
  });

  it('keeps retention configurable and decoupled from commercial tiering', () => {
    expect(TRACE_RETENTION_POLICY_CONTRACT).toEqual({
      policyType: 'workspace-config',
      rawPayloadTtlDays: 7,
      aggregateTtlDays: 90,
      userConfigurable: true,
      commercialTierCoupled: false,
    });
  });
});
