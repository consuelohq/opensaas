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
import {
  type TraceSitesDashboardEvent,
  type TraceSitesDashboardSummary,
} from '../scripts/lib/trace-sites-gateway-contract';

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
  topBranches: [
    { branch: 'task/sites/trace-live-read-endpoints', tokens: 2500 },
  ],
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
      'x-consuelo-node-id': 'node_live',
      'x-consuelo-device-id': 'node_live',
      'x-consuelo-trace-read': 'true',
      'x-consuelo-allowed-sites': 'trace,trace-burn-intelligence',
      'x-consuelo-source-modes':
        'local-networked,cloud-compute,local-off-network',
      'x-consuelo-retention-policy-id': 'ret_workspace_default',
    },
  });
}

async function createHistoryFixtureDb(dbPath: string): Promise<void> {
  const { Database } = await import('bun:sqlite');
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE tool_traces (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      trace_id TEXT NOT NULL,
      mcp_trace_id TEXT,
      source TEXT NOT NULL,
      tool TEXT NOT NULL,
      task_session TEXT,
      branch TEXT,
      worktree TEXT,
      status TEXT NOT NULL,
      ok INTEGER NOT NULL,
      code TEXT,
      exit_code INTEGER,
      duration_ms INTEGER,
      input_json TEXT,
      resolved_input_json TEXT,
      result_json TEXT,
      stderr TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER
    );
  `);
  const insert = db.prepare(`
    INSERT INTO tool_traces (
      id, ts, trace_id, mcp_trace_id, source, tool, task_session, branch,
      worktree, status, ok, code, exit_code, duration_ms, input_json,
      resolved_input_json, result_json, stderr, input_tokens, output_tokens,
      total_tokens
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (let index = 1; index <= 4; index += 1) {
    insert.run(
      `row_${index}`,
      `2026-07-11T00:00:0${index}.000Z`,
      `trc_history_${index}`,
      `mcp_history_${index}`,
      'workspace',
      index === 2 ? 'batch' : 'workspace.call',
      'tsk_history',
      'task/trace-site/connect-perpetual-trace-pagination',
      '/tmp/history-worktree',
      index === 2 ? 'error' : 'ok',
      index === 2 ? 0 : 1,
      index === 2 ? 'COMMAND_FAILED' : 'OK',
      index === 2 ? 1 : 0,
      index * 100,
      JSON.stringify({ index, original: true }),
      JSON.stringify({ index, resolved: true }),
      JSON.stringify({
        ok: index !== 2,
        message: `history result ${index}`,
        data: index === 2 ? { results: [{ ok: false, tool: 'fs.read' }] } : {},
      }),
      index === 2 ? 'history fixture failed' : '',
      index * 10,
      index * 20,
      index * 30,
    );
  }
  db.close();
}

describe('Trace Sites gateway live endpoints', () => {
  it('serves recent Trace Site events through gateway JSON without exposing direct backend targets', async () => {
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: createFixtureTraceSitesReadBackend({
        cursor: '00000001',
        events: [event],
      }),
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const response = await endpoints.handle(
      request(
        '/gateway/traces/recent?cursor=00000000&limit=20&sourceMode=local-networked',
      ),
    );
    const body = (await response.json()) as Record<string, unknown>;
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body).toMatchObject({
      ok: true,
      publicBoundary: 'consuelo-gateway',
      route: '/gateway/traces/recent',
      data: {
        workspaceId: 'wrk_live',
        workspaceHost: 'testing.consuelohq.com',
        nodeId: 'node_live',
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

  it('rejects unsupported history directions instead of falling through to the recent feed', async () => {
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: createFixtureTraceSitesReadBackend({
        cursor: '00000001',
        events: [event],
      }),
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const response = await endpoints.handle(
      request(
        '/gateway/traces/recent?direction=sideways&cursor=00000000&sourceMode=local-networked',
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      route: '/gateway/traces/recent',
      workspaceId: 'wrk_live',
      workspaceHost: 'testing.consuelohq.com',
      nodeId: 'node_live',
      error: {
        code: 'TRACE_HISTORY_DIRECTION_INVALID',
      },
    });
  });

  it('serves summary and aggregate dashboard data through the same gateway read layer', async () => {
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: createFixtureTraceSitesReadBackend({
        cursor: '00000001',
        events: [event],
      }),
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const summary = await endpoints.handle(
      request(
        '/gateway/traces/summary?cursor=00000000&sourceMode=local-networked',
      ),
    );
    const aggregate = await endpoints.handle(
      request(
        '/gateway/traces/aggregates?cursor=00000000&sourceMode=local-networked',
      ),
    );

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

  it('forwards a full-history search query through the authenticated recent route', async () => {
    let observedQuery = '';
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: {
        resolveHealth() { return {}; },
        readRecentEvents(input) { return { cursor: input.cursor, events: [] }; },
        readCachedAggregate() { return { cursor: '000000000000', summary: null }; },
        readHistoryPage(input) {
          observedQuery = input.query ?? '';
          return { rows: [], nextCursor: null };
        },
      },
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const response = await endpoints.handle(
      request('/gateway/traces/recent?direction=older&cursor=latest&limit=100&sourceMode=local-networked&includeRawPayload=true&query=tool%3Afs.read+branch%3Afeature%2Fsearch'),
    );

    expect(response.status).toBe(200);
    expect(observedQuery).toBe('tool:fs.read branch:feature/search');
  });

  it('serves older rich trace pages through the authenticated recent route without changing the live cursor contract', async () => {
    const dbPath = join(tempDir, 'history-endpoint.db');
    await createHistoryFixtureDb(dbPath);
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: createLocalTraceSitesReadBackend({ dbPath }),
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const denied = await endpoints.handle(
      request(
        '/gateway/traces/recent?direction=older&cursor=id%3Arow_4&limit=2&sourceMode=local-networked',
      ),
    );
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({
      ok: false,
      error: { code: 'RAW_PAYLOAD_ACCESS_DENIED' },
      errors: ['RAW_PAYLOAD_ACCESS_DENIED'],
    });

    const first = await endpoints.handle(
      request(
        '/gateway/traces/recent?direction=older&cursor=id%3Arow_4&limit=2&sourceMode=local-networked&includeRawPayload=true',
      ),
    );

    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      ok: true,
      publicBoundary: 'consuelo-gateway',
      route: '/gateway/traces/recent',
      data: {
        direction: 'older',
        nextCursor: '000000000002',
        rows: [
          { recordId: 'row_3', traceId: 'trc_history_3' },
          {
            recordId: 'row_2',
            traceId: 'trc_history_2',
            status: 'error',
            batchResultsCount: 1,
          },
        ],
      },
    });

    const terminal = await endpoints.handle(
      request(
        '/gateway/traces/recent?direction=older&cursor=000000000002&limit=2&sourceMode=local-networked&includeRawPayload=true',
      ),
    );
    expect(await terminal.json()).toMatchObject({
      ok: true,
      data: {
        direction: 'older',
        nextCursor: null,
        rows: [{ recordId: 'row_1' }],
      },
    });
  });

  it('serves full newer trace rows from the SQLite cursor without replaying or skipping records', async () => {
    const dbPath = join(tempDir, 'newer-endpoint.db');
    await createHistoryFixtureDb(dbPath);
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: createLocalTraceSitesReadBackend({ dbPath }),
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const first = await endpoints.handle(
      request(
        '/gateway/traces/recent?direction=newer&cursor=id%3Arow_2&limit=1&sourceMode=local-networked&includeRawPayload=true',
      ),
    );
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      ok: true,
      data: {
        direction: 'newer',
        nextCursor: '000000000003',
        rows: [{ recordId: 'row_3', inputTokens: 30, outputTokens: 60 }],
      },
    });

    const second = await endpoints.handle(
      request(
        '/gateway/traces/recent?direction=newer&cursor=000000000003&limit=10&sourceMode=local-networked&includeRawPayload=true',
      ),
    );
    expect(await second.json()).toMatchObject({
      ok: true,
      data: {
        direction: 'newer',
        nextCursor: '000000000004',
        rows: [{ recordId: 'row_4' }],
      },
    });
  });

  it('anchors an unknown newer cursor at the current high-water mark', async () => {
    const dbPath = join(tempDir, 'unknown-newer-cursor.db');
    await createHistoryFixtureDb(dbPath);
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: createLocalTraceSitesReadBackend({ dbPath }),
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const anchored = await endpoints.handle(
      request(
        '/gateway/traces/recent?direction=newer&cursor=id%3Amissing-row&limit=10&sourceMode=local-networked&includeRawPayload=true',
      ),
    );
    expect(anchored.status).toBe(200);
    expect(await anchored.json()).toMatchObject({
      ok: true,
      data: {
        direction: 'newer',
        nextCursor: '000000000004',
        rows: [],
      },
    });

    const { Database } = await import('bun:sqlite');
    const db = new Database(dbPath);
    try {
      db.prepare(`
        INSERT INTO tool_traces (
          id, ts, trace_id, mcp_trace_id, source, tool, task_session, branch,
          worktree, status, ok, code, exit_code, duration_ms, input_json,
          resolved_input_json, result_json, stderr, input_tokens, output_tokens,
          total_tokens
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'row_5',
        '2026-07-11T00:00:05.000Z',
        'trc_history_5',
        'mcp_history_5',
        'workspace',
        'workspace.call',
        'tsk_history',
        'task/trace-site/connect-perpetual-trace-pagination',
        '/tmp/history-worktree',
        'ok',
        1,
        'OK',
        0,
        500,
        JSON.stringify({ index: 5, original: true }),
        JSON.stringify({ index: 5, resolved: true }),
        JSON.stringify({ ok: true, message: 'history result 5', data: {} }),
        '',
        50,
        100,
        150,
      );
    } finally {
      db.close();
    }

    const next = await endpoints.handle(
      request(
        '/gateway/traces/recent?direction=newer&cursor=000000000004&limit=10&sourceMode=local-networked&includeRawPayload=true',
      ),
    );
    expect(await next.json()).toMatchObject({
      ok: true,
      data: {
        direction: 'newer',
        nextCursor: '000000000005',
        rows: [{ recordId: 'row_5' }],
      },
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

    const response = await endpoints.handle(
      request(
        '/gateway/traces/aggregates?cursor=00000000&sourceMode=local-networked',
      ),
    );

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

  it('serves the live stream endpoint for Trace Sites SSE events', async () => {
    const nextEvent: TraceSitesDashboardEvent = {
      ...event,
      traceId: 'trc_live_2',
      idempotencyKey: 'wrk_live:trc_live_2:00000002',
      tool: 'trace:finish',
    };
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: {
        resolveHealth() {
          return {};
        },
        readRecentEvents(input) {
          if (input.cursor === '00000001') {
            return { cursor: '00000002', events: [nextEvent] };
          }
          return { cursor: '00000001', events: [event] };
        },
        readCachedAggregate() {
          return { cursor: '00000001', summary: null };
        },
      },
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const response = await endpoints.handle(
      request(
        '/gateway/traces/events?cursor=00000000&sourceMode=local-networked',
      ),
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('cache-control')).toContain('no-cache');
    expect(text).toContain('event: snapshot');
    expect(text).toContain('event: trace');
    expect(text).toContain('event: keepalive');
    expect(text).toContain('"publicBoundary":"consuelo-gateway"');
    expect(text).toContain('"traceId":"trc_live_2"');
    expect(text).not.toContain('event: trace-sites-snapshot');
  });

  it('returns structured unavailable errors for local off-network without a bridge', async () => {
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: createFixtureTraceSitesReadBackend({
        cursor: '00000001',
        events: [event],
      }),
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const response = await endpoints.handle(
      request(
        '/gateway/traces/recent?cursor=00000000&sourceMode=local-off-network',
      ),
    );

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

  it('should migrate missing routing columns when rich history reads an older trace database', async () => {
    const dbPath = join(tempDir, 'legacy-history.db');
    await createHistoryFixtureDb(dbPath);
    const { Database } = await import('bun:sqlite');
    const before = new Database(dbPath, { readonly: true });
    const beforeColumns = (before.query('PRAGMA table_info(tool_traces)').all() as Array<{ name: string }>)
      .map((column) => column.name);
    before.close();
    expect(beforeColumns).not.toContain('resolved_node_id');
    expect(beforeColumns).not.toContain('route_source');

    const backend = createLocalTraceSitesReadBackend({ dbPath });
    const page = await backend.readHistoryPage!({
      workspaceId: 'wrk_live',
      workspaceHost: 'testing.consuelohq.com',
      site: 'trace-burn-intelligence',
      sourceMode: 'local-networked',
      cursor: 'id:row_4',
      limit: 2,
    });

    expect(page.rows.map((historyRow) => historyRow.recordId)).toEqual(['row_3', 'row_2']);
    const after = new Database(dbPath, { readonly: true });
    const afterColumns = (after.query('PRAGMA table_info(tool_traces)').all() as Array<{ name: string }>)
      .map((column) => column.name);
    after.close();
    expect(afterColumns).toEqual(expect.arrayContaining([
      'requested_node_id',
      'resolved_node_id',
      'resolved_node_name',
      'default_node_id',
      'route_source',
    ]));
  });

  it('reads overlap-free rich older-history pages from an opaque record cursor', async () => {
    const dbPath = join(tempDir, 'history.db');
    await createHistoryFixtureDb(dbPath);

    const backend = createLocalTraceSitesReadBackend({ dbPath });
    expect(backend.readHistoryPage).toBeTypeOf('function');

    const first = await backend.readHistoryPage!({
      workspaceId: 'wrk_live',
      workspaceHost: 'testing.consuelohq.com',
      site: 'trace-burn-intelligence',
      sourceMode: 'local-networked',
      cursor: 'id:row_4',
      limit: 2,
    });

    expect(first.nextCursor).toBe('000000000002');
    expect(first.rows.map((historyRow) => historyRow.recordId)).toEqual([
      'row_3',
      'row_2',
    ]);
    expect(first.rows[1]).toMatchObject({
      id: 'row_2',
      recordId: 'row_2',
      traceId: 'trc_history_2',
      name: 'batch',
      traceName: 'batch',
      branch: 'task/trace-site/connect-perpetual-trace-pagination',
      status: 'error',
      ok: false,
      code: 'COMMAND_FAILED',
      exitCode: 1,
      durationMs: 200,
      inputTokens: 20,
      outputTokens: 40,
      tokens: 60,
      rawInputJson: JSON.stringify({ index: 2, original: true }),
      rawResolvedInputJson: JSON.stringify({ index: 2, resolved: true }),
      rawStderr: 'history fixture failed',
      batchResultsCount: 1,
    });

    const terminal = await backend.readHistoryPage!({
      workspaceId: 'wrk_live',
      workspaceHost: 'testing.consuelohq.com',
      site: 'trace-burn-intelligence',
      sourceMode: 'local-networked',
      cursor: first.nextCursor!,
      limit: 2,
    });

    expect(terminal.rows.map((historyRow) => historyRow.recordId)).toEqual([
      'row_1',
    ]);
    expect(terminal.nextCursor).toBeNull();
  });

  it('resolves trace and MCP trace aliases before the newest-row fallback', async () => {
    const dbPath = join(tempDir, 'history-aliases.db');
    await createHistoryFixtureDb(dbPath);
    const backend = createLocalTraceSitesReadBackend({ dbPath });

    const fromTraceId = await backend.readHistoryPage!({
      workspaceId: 'wrk_live',
      workspaceHost: 'testing.consuelohq.com',
      site: 'trace-burn-intelligence',
      sourceMode: 'local-networked',
      cursor: 'id:trc_history_4',
      limit: 2,
    });
    const fromMcpTraceId = await backend.readHistoryPage!({
      workspaceId: 'wrk_live',
      workspaceHost: 'testing.consuelohq.com',
      site: 'trace-burn-intelligence',
      sourceMode: 'local-networked',
      cursor: 'id:mcp_history_4',
      limit: 2,
    });

    expect(fromTraceId.rows.map((historyRow) => historyRow.recordId)).toEqual([
      'row_3',
      'row_2',
    ]);
    expect(
      fromMcpTraceId.rows.map((historyRow) => historyRow.recordId),
    ).toEqual(['row_3', 'row_2']);
  });
});
