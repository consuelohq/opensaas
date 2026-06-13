import { describe, expect, it } from 'vitest';

import {
  createFixtureTraceSitesReadBackend,
  createTraceSitesGatewayReadLayer,
  type TraceSitesGatewayReadLayerRequest,
} from '../scripts/lib/trace-sites-gateway-read-layer';
import {
  reduceTraceSitesDashboard,
  type TraceGatewaySessionScope,
  type TraceSitesDashboardEvent,
  type TraceSitesDashboardSummary,
  type TraceSitesLiveDelta,
} from '../scripts/lib/trace-sites-gateway-contract';

const BASE_SCOPE: TraceGatewaySessionScope = {
  userId: 'usr_trace_sites',
  workspaceId: 'wrk_trace_sites',
  workspaceHost: 'testing.consuelohq.com',
  allowedSites: ['trace', 'trace-burn-intelligence'],
  traceRead: true,
  traceWrite: false,
  runnerControl: false,
  sourceModesAllowed: ['local-networked', 'cloud-compute', 'local-off-network'],
  retentionPolicyId: 'ret_workspace_default',
};

const LOCAL_EVENT: TraceSitesDashboardEvent = {
  traceId: 'trc_local_1',
  idempotencyKey: 'wrk_trace_sites:trc_local_1:00000001',
  sourceMode: 'local-networked',
  branch: 'task/sites/trace-gateway-read-layer',
  tool: 'task.call',
  inputTokens: 100,
  outputTokens: 300,
  costUsd: 0.01,
  success: true,
};

function request(overrides: Partial<TraceSitesGatewayReadLayerRequest> = {}): TraceSitesGatewayReadLayerRequest {
  return {
    scope: BASE_SCOPE,
    workspaceId: 'wrk_trace_sites',
    workspaceHost: 'testing.consuelohq.com',
    site: 'trace-burn-intelligence',
    sourceMode: 'local-networked',
    cursor: '00000000',
    limit: 100,
    ...overrides,
  };
}

describe('Trace Sites gateway read layer', () => {
  it('should return recent Trace Sites events when workspace has traceRead scope', async () => {
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({
      cursor: '00000001',
      events: [LOCAL_EVENT],
    }));

    const result = await readLayer.readTraceSitesDashboard(request());

    expect(result).toMatchObject({
      ok: true,
      publicBoundary: 'consuelo-gateway',
      workspaceId: 'wrk_trace_sites',
      workspaceHost: 'testing.consuelohq.com',
      site: 'trace-burn-intelligence',
      sourceMode: 'local-networked',
      aggregateSource: 'trace-store',
      cursor: '00000001',
      dataState: 'fresh',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected Trace Sites read to succeed');
    expect(result.discovery.readService).toBe('trace-read');
    expect(result.gatewayServices.readService).toBe('trace-read');
    expect(result.recentEvents).toEqual([LOCAL_EVENT]);
    expect(result.summary).toMatchObject({
      calls: 1,
      totalTraceBurn: 400,
      outputTokens: 300,
      totalCostUsd: 0.01,
      errorPressure: 0,
      avgBurnPerCall: 400,
      sourceModes: ['local-networked'],
    });
  });

  it('should deny access when workspace lacks traceRead scope', async () => {
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({ events: [LOCAL_EVENT] }));

    const result = await readLayer.readTraceSitesDashboard(request({
      scope: { ...BASE_SCOPE, traceRead: false },
    }));

    expect(result).toMatchObject({
      ok: false,
      publicBoundary: 'consuelo-gateway',
      dataState: 'denied',
      errors: [expect.objectContaining({ code: 'SCOPE_DENIED' })],
    });
  });

  it('should deny access when requested site is not in allowedSites', async () => {
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({ events: [LOCAL_EVENT] }));

    const result = await readLayer.readTraceSitesDashboard(request({
      scope: { ...BASE_SCOPE, allowedSites: ['trace'] },
      site: 'trace-burn-intelligence',
    }));

    expect(result).toMatchObject({
      ok: false,
      dataState: 'denied',
      errors: [expect.objectContaining({ code: 'SCOPE_DENIED' })],
    });
  });

  it('should discover Trace Sites through relay semantics when sourceMode is local-networked', async () => {
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({ events: [LOCAL_EVENT] }));

    const result = await readLayer.readTraceSitesDashboard(request({ sourceMode: 'local-networked' }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected Trace Sites read to succeed');
    expect(result.discovery).toMatchObject({
      publicBoundary: 'consuelo-gateway',
      sourceMode: 'local-networked',
      readService: 'trace-read',
      ingestService: 'trace-ingest',
      runnerControlService: null,
      relayStatus: 'required',
      localRelayConnection: 'connected-through-consuelo-network',
      traceBackendLocation: 'hosted-trace-backend',
    });
  });

  it('should wire runner control discovery when sourceMode is cloud-compute', async () => {
    const cloudEvent: TraceSitesDashboardEvent = {
      ...LOCAL_EVENT,
      traceId: 'trc_cloud_1',
      idempotencyKey: 'wrk_trace_sites:trc_cloud_1:00000001',
      sourceMode: 'cloud-compute',
      tool: 'runner.exec',
    };
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({ events: [cloudEvent] }));

    const result = await readLayer.readTraceSitesDashboard(request({ sourceMode: 'cloud-compute' }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected Trace Sites read to succeed');
    expect(result.discovery).toMatchObject({
      publicBoundary: 'consuelo-gateway',
      sourceMode: 'cloud-compute',
      readService: 'trace-read',
      ingestService: 'trace-ingest',
      runnerControlService: 'runner-control',
      relayStatus: 'not-required',
      cloudRunnerPool: 'consuelo-managed-runner-pool',
      traceBackendLocation: 'hosted-trace-backend',
    });
    expect(result.gatewayServices).toMatchObject({
      readService: 'trace-read',
      aggregateService: 'aggregate-cache',
      runnerControlService: 'runner-control',
    });
  });

  it('should return bridge-required state when sourceMode is local-off-network and no bridge is configured', async () => {
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({ events: [LOCAL_EVENT] }));

    const result = await readLayer.readTraceSitesDashboard(request({ sourceMode: 'local-off-network' }));

    expect(result).toMatchObject({
      ok: false,
      publicBoundary: 'consuelo-gateway',
      sourceMode: 'local-off-network',
      dataState: 'bridge-required',
      discovery: expect.objectContaining({
        readService: null,
        ingestService: null,
        runnerControlService: null,
        sitesHydration: 'unavailable-without-bridge',
        relayStatus: 'bridge-required',
        traceBackendLocation: null,
      }),
      errors: [expect.objectContaining({ code: 'BRIDGE_REQUIRED' })],
    });
  });

  it('should deduplicate events by idempotency key when duplicate retries occur', async () => {
    const retryDelta: TraceSitesLiveDelta = {
      cursor: '00000002',
      event: {
        traceId: 'trc_local_1_retry',
        idempotencyKey: LOCAL_EVENT.idempotencyKey,
        sourceMode: 'local-networked',
        branch: 'task/sites/trace-gateway-read-layer',
        tool: 'task.call',
        inputTokens: 999,
        outputTokens: 999,
        costUsd: 9.99,
        success: false,
        errorCause: 'DUPLICATE_RETRY',
      },
    };
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({
      cursor: '00000001',
      events: [LOCAL_EVENT],
      deltas: [retryDelta],
    }));

    const result = await readLayer.readTraceSitesDashboard(request());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected Trace Sites read to succeed');
    expect(result.cursor).toBe('00000002');
    expect(result.recentEvents).toEqual([LOCAL_EVENT]);
    expect(result.summary).toEqual(reduceTraceSitesDashboard([LOCAL_EVENT]));
  });

  it('should return cached aggregates with degraded state when trace store is unavailable but cache is available', async () => {
    const cachedSummary: TraceSitesDashboardSummary = {
      calls: 42,
      totalTraceBurn: 12000,
      outputTokens: 9000,
      totalCostUsd: 1.234567,
      errorPressure: 0.25,
      avgBurnPerCall: 285.7142857142857,
      topBranches: [{ branch: 'task/sites/trace-gateway-read-layer', tokens: 12000 }],
      topTools: [{ tool: 'task.call', tokens: 12000 }],
      failureCauses: [{ cause: 'COMMAND_FAILED', count: 3 }],
      sourceModes: ['local-networked'],
    };
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({
      cachedCursor: 'cache-0001',
      cachedSummary,
      health: {
        traceStoreAvailable: false,
        aggregateCacheAvailable: true,
      },
    }));

    const result = await readLayer.readTraceSitesDashboard(request());

    expect(result).toMatchObject({
      ok: true,
      aggregateSource: 'aggregate-cache',
      dataState: 'cached-aggregates',
      cursor: 'cache-0001',
      recentEvents: [],
      resilience: {
        liveFeed: 'degraded',
        dashboardData: 'cached-aggregates',
        retryPolicy: 'backoff',
        userVisibleState: 'trace-store-degraded',
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected cached aggregate read to succeed');
    expect(result.summary).toEqual(cachedSummary);
  });

  it('should return unavailable state when both trace store and aggregate cache are unavailable', async () => {
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({
      health: {
        traceStoreAvailable: false,
        aggregateCacheAvailable: false,
      },
    }));

    const result = await readLayer.readTraceSitesDashboard(request());

    expect(result).toMatchObject({
      ok: false,
      publicBoundary: 'consuelo-gateway',
      dataState: 'unavailable',
      resilience: {
        liveFeed: 'disconnected',
        dashboardData: 'unavailable',
        retryPolicy: 'circuit-open',
        userVisibleState: 'unavailable',
      },
      errors: [expect.objectContaining({ code: 'TRACE_STORE_UNAVAILABLE' })],
    });
  });

  it('should not expose direct backend targets in serialized responses', async () => {
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({ events: [LOCAL_EVENT] }));

    const result = await readLayer.readTraceSitesDashboard(request());
    const serialized = JSON.stringify(result);
    const directTargets = [
      `local-${'trace'}-db`,
      `local-${'agent'}`,
      `cloud-${'runner'}`,
      `trace-${'store'}-file`,
      `raw-${'trace'}-service`,
      'directBackendTarget',
      'backendTarget',
    ];

    expect(result.publicBoundary).toBe('consuelo-gateway');
    for (const directTarget of directTargets) {
      expect(serialized).not.toContain(directTarget);
    }
  });
});
