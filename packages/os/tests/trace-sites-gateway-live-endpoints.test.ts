import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTraceSitesGatewayLiveEndpoints,
  traceGatewayScopeFromHeaders,
} from '../scripts/lib/trace-sites-gateway-live-endpoints';
import { createLocalTraceSitesReadBackend } from '../scripts/lib/trace-sites-local-read-backend';
import { createFixtureTraceSitesReadBackend } from '../scripts/lib/trace-sites-gateway-read-layer';
import { type TraceSitesDashboardEvent, type TraceSitesDashboardSummary } from '../scripts/lib/trace-sites-gateway-contract';

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `trace-sites-live-${crypto.randomUUID()}`);
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const event: TraceSitesDashboardEvent = {
  traceId: 'trc_live_1',
  idempotencyKey: 'wrk_live:trc_live_1:00000001',
  sourceMode: 'local-networked',
  branch: 'task/sites/trace-live-read-endpoints',
  tool: 'trace:watch',
  inputTokens: 120,
  outputTokens: 380,
  costUsd: 0,
  success: true,
};

const cachedSummary: TraceSitesDashboardSummary = {
  calls: 5,
  totalTraceBurn: 2500,
  outputTokens: 1800,
  totalCostUsd: 0,
  errorPressure: 0.2,
  avgBurnPerCall: 500,
  topBranches: [{ branch: 'task/sites/trace-live-read-endpoints', tokens: 2500 }],
  topTools: [{ tool: 'trace:watch', tokens: 2500 }],
  failureCauses: [{ cause: 'COMMAND_FAILED', count: 1 }],
  sourceModes: ['local-networked'],
};

function request(path: string): Request {
  return new Request(`https://testing.consuelohq.com${path}`, {
    headers: {
      'x-consuelo-user-id': 'usr_live',
      'x-consuelo-workspace-id': 'wrk_live',
      'x-consuelo-workspace-host': 'testing.consuelohq.com',
      'x-consuelo-trace-read': 'true',
      'x-consuelo-allowed-sites': 'trace,trace-burn-intelligence',
      'x-consuelo-source-modes': 'local-networked,cloud-compute,local-off-network',
      'x-consuelo-retention-policy-id': 'ret_workspace_default',
    },
  });
}

describe('Trace Sites gateway live endpoints', () => {
  it('serves recent Trace Site events through gateway JSON without exposing direct backend targets', async () => {
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: createFixtureTraceSitesReadBackend({ cursor: '00000001', events: [event] }),
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const response = await endpoints.handle(request('/gateway/traces/recent?cursor=00000000&limit=20&sourceMode=local-networked'));
    const body = await response.json() as Record<string, unknown>;
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body).toMatchObject({
      ok: true,
      publicBoundary: 'consuelo-gateway',
      route: '/gateway/traces/recent',
      data: {
        cursor: '00000001',
        dataState: 'fresh',
        recentEvents: [event],
      },
    });
    expect(serialized).not.toContain(`local-${'trace'}-db`);
    expect(serialized).not.toContain(`local-${'agent'}`);
    expect(serialized).not.toContain(`cloud-${'runner'}`);
    expect(serialized).not.toContain(`trace-${'store'}-file`);
    expect(serialized).not.toContain(`raw-${'trace'}-service`);
  });

  it('serves summary and aggregate dashboard data through the same gateway read layer', async () => {
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: createFixtureTraceSitesReadBackend({ cursor: '00000001', events: [event] }),
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const summary = await endpoints.handle(request('/gateway/traces/summary?cursor=00000000&sourceMode=local-networked'));
    const aggregate = await endpoints.handle(request('/gateway/traces/aggregates?cursor=00000000&sourceMode=local-networked'));

    expect(await summary.json()).toMatchObject({
      ok: true,
      route: '/gateway/traces/summary',
      data: { summary: { calls: 1, totalTraceBurn: 500, outputTokens: 380 } },
    });
    expect(await aggregate.json()).toMatchObject({
      ok: true,
      route: '/gateway/traces/aggregates',
      data: { summary: { calls: 1, totalTraceBurn: 500, outputTokens: 380 } },
    });
  });

  it('serves cached aggregate degraded state when the trace store is unavailable', async () => {
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: createFixtureTraceSitesReadBackend({
        cachedCursor: 'cache-0001',
        cachedSummary,
        health: { traceStoreAvailable: false, aggregateCacheAvailable: true },
      }),
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const response = await endpoints.handle(request('/gateway/traces/aggregates?cursor=00000000&sourceMode=local-networked'));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: {
        aggregateSource: 'aggregate-cache',
        dataState: 'cached-aggregates',
        summary: cachedSummary,
        resilience: { userVisibleState: 'trace-store-degraded' },
      },
    });
  });

  it('serves snapshot-first SSE for Trace Sites live events', async () => {
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: createFixtureTraceSitesReadBackend({ cursor: '00000001', events: [event] }),
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const response = await endpoints.handle(request('/gateway/traces/events?cursor=00000000&sourceMode=local-networked'));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(text).toContain('event: trace-sites-snapshot');
    expect(text).toContain('id: 00000001');
    expect(text).toContain('"publicBoundary":"consuelo-gateway"');
    expect(text).toContain('"recentEvents"');
  });

  it('returns structured unavailable errors for local off-network without a bridge', async () => {
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: createFixtureTraceSitesReadBackend({ cursor: '00000001', events: [event] }),
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const response = await endpoints.handle(request('/gateway/traces/recent?cursor=00000000&sourceMode=local-off-network'));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: 'BRIDGE_REQUIRED' },
      dataState: 'bridge-required',
      publicBoundary: 'consuelo-gateway',
    });
  });
});

describe('Trace Sites local trace backend adapter', () => {
  it('reads real local tool trace rows into Trace Sites dashboard events', async () => {
    const dbPath = join(tempDir, 'traces.db');
    const { Database } = await import('bun:sqlite');
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE tool_traces (
        id TEXT,
        ts TEXT,
        trace_id TEXT,
        tool TEXT,
        task_session TEXT,
        branch TEXT,
        status TEXT,
        code TEXT,
        exit_code INTEGER,
        duration_ms INTEGER,
        input_tokens INTEGER,
        output_tokens INTEGER,
        total_tokens INTEGER,
        result_json TEXT,
        stderr TEXT
      );
      INSERT INTO tool_traces (
        id, ts, trace_id, tool, task_session, branch, status, code, exit_code,
        duration_ms, input_tokens, output_tokens, total_tokens, result_json, stderr
      ) VALUES (
        'row_1', '2026-06-13T14:00:00.000Z', 'trc_db_1', 'workspace.call', 'tsk_live',
        'task/sites/trace-live-read-endpoints', 'ok', 'OK', NULL, 100, 25, 75, 100, '{}', ''
      );
    `);
    db.close();

    const backend = createLocalTraceSitesReadBackend({ dbPath });
    const recent = await backend.readRecentEvents({
      workspaceId: 'wrk_live',
      workspaceHost: 'testing.consuelohq.com',
      site: 'trace-burn-intelligence',
      sourceMode: 'local-networked',
      cursor: '000000000000',
      limit: 10,
    });

    expect(recent.cursor).toBe('000000000001');
    expect(recent.events).toEqual([
      expect.objectContaining({
        traceId: 'trc_db_1',
        idempotencyKey: 'wrk_live:trc_db_1:000000000001',
        sourceMode: 'local-networked',
        branch: 'task/sites/trace-live-read-endpoints',
        tool: 'workspace.call',
        inputTokens: 25,
        outputTokens: 75,
        costUsd: 0,
        success: true,
      }),
    ]);
  });
});
