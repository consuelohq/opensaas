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

const baseScope: TraceGatewaySessionScope = {
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

const localEvent: TraceSitesDashboardEvent = {
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
    scope: baseScope,
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
  it('lets a scoped workspace read recent Trace Sites events through the gateway read layer', async () => {
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({
      cursor: '00000001',
      events: [localEvent],
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
    expect(result.ok && result.discovery.readService).toBe('trace-read');
    expect(result.ok && result.gatewayServices.readService).toBe('trace-read');
    expect(result.ok && result.recentEvents).toEqual([localEvent]);
    expect(result.ok && result.summary).toMatchObject({
      calls: 1,
      totalTraceBurn: 400,
      outputTokens: 300,
      totalCostUsd: 0.01,
      errorPressure: 0,
      avgBurnPerCall: 400,
      sourceModes: ['local-networked'],
    });
  });

  it('denies a workspace without trace-read scope', async () => {
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({ events: [localEvent] }));

    const result = await readLayer.readTraceSitesDashboard(request({
      scope: { ...baseScope, traceRead: false },
    }));

    expect(result).toMatchObject({
      ok: false,
      publicBoundary: 'consuelo-gateway',
      dataState: 'denied',
      errors: [expect.objectContaining({ code: 'SCOPE_DENIED' })],
    });
  });

  it('denies a workspace without the trace-burn-intelligence Site scope', async () => {
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({ events: [localEvent] }));

    const result = await readLayer.readTraceSitesDashboard(request({
      scope: { ...baseScope, allowedSites: ['trace'] },
      site: 'trace-burn-intelligence',
    }));

    expect(result).toMatchObject({
      ok: false,
      dataState: 'denied',
      errors: [expect.objectContaining({ code: 'SCOPE_DENIED' })],
    });
  });

  it('discovers local-networked Trace Sites through required relay semantics', async () => {
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({ events: [localEvent] }));

    const result = await readLayer.readTraceSitesDashboard(request({ sourceMode: 'local-networked' }));

    expect(result.ok && result.discovery).toMatchObject({
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

  it('discovers cloud-compute runner control while reads still go through gateway services', async () => {
    const cloudEvent: TraceSitesDashboardEvent = {
      ...localEvent,
      traceId: 'trc_cloud_1',
      idempotencyKey: 'wrk_trace_sites:trc_cloud_1:00000001',
      sourceMode: 'cloud-compute',
      tool: 'runner.exec',
    };
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({ events: [cloudEvent] }));

    const result = await readLayer.readTraceSitesDashboard(request({ sourceMode: 'cloud-compute' }));

    expect(result.ok && result.discovery).toMatchObject({
      publicBoundary: 'consuelo-gateway',
      sourceMode: 'cloud-compute',
      readService: 'trace-read',
      ingestService: 'trace-ingest',
      runnerControlService: 'runner-control',
      relayStatus: 'not-required',
      cloudRunnerPool: 'consuelo-managed-runner-pool',
      traceBackendLocation: 'hosted-trace-backend',
    });
    expect(result.ok && result.gatewayServices).toMatchObject({
      readService: 'trace-read',
      aggregateService: 'aggregate-cache',
      runnerControlService: 'runner-control',
    });
  });

  it('returns bridge-required behavior for local off-network Trace Sites without a bridge', async () => {
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({ events: [localEvent] }));

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

  it('dedupes duplicate retry events by idempotency key through the PR1 dashboard reducer', async () => {
    const retryDelta: TraceSitesLiveDelta = {
      cursor: '00000002',
      event: {
        traceId: 'trc_local_1_retry',
        idempotencyKey: localEvent.idempotencyKey,
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
      events: [localEvent],
      deltas: [retryDelta],
    }));

    const result = await readLayer.readTraceSitesDashboard(request());

    expect(result.ok && result.cursor).toBe('00000002');
    expect(result.ok && result.recentEvents).toEqual([localEvent]);
    expect(result.ok && result.summary).toEqual(reduceTraceSitesDashboard([localEvent]));
  });

  it('returns cached aggregate data with degraded state when the trace store is unavailable and aggregate cache is available', async () => {
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
    expect(result.ok && result.summary).toEqual(cachedSummary);
  });

  it('returns unavailable state when the trace store is unavailable and no aggregate cache exists', async () => {
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

  it('does not expose direct backend targets to Sites callers', async () => {
    const readLayer = createTraceSitesGatewayReadLayer(createFixtureTraceSitesReadBackend({ events: [localEvent] }));

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
