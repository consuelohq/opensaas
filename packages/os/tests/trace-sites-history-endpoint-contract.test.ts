import { describe, expect, it } from 'vitest';

import { createTraceSitesGatewayLiveEndpoints } from '../scripts/lib/trace-sites-gateway-live-endpoints';
import type {
  TraceSitesGatewayReadBackendAdapter,
  TraceSitesGatewayReadBackendInput,
} from '../scripts/lib/trace-sites-gateway-read-layer';

const scopeHeaders = {
  'x-consuelo-user-id': 'usr_history',
  'x-consuelo-workspace-id': 'wrk_history',
  'x-consuelo-workspace-host': 'testing.consuelohq.com',
  'x-consuelo-node-id': 'node_history',
  'x-consuelo-trace-read': 'true',
  'x-consuelo-allowed-sites': 'trace,trace-burn-intelligence',
  'x-consuelo-source-modes': 'local-networked',
};

function request(query: string): Request {
  return new Request(
    `https://testing.consuelohq.com/gateway/traces/recent?${query}`,
    { headers: scopeHeaders },
  );
}

function backend(overrides: Partial<TraceSitesGatewayReadBackendAdapter> = {}) {
  const calls: Array<{
    direction: 'older' | 'newer';
    input: TraceSitesGatewayReadBackendInput;
  }> = [];
  const adapter: TraceSitesGatewayReadBackendAdapter = {
    resolveHealth() {
      return { traceStoreAvailable: true };
    },
    readRecentEvents(input) {
      return { cursor: input.cursor, events: [] };
    },
    readHistoryPage(input) {
      calls.push({ direction: 'older', input });
      return {
        rows: [
          {
            id: 'row_older',
            recordId: 'row_older',
            traceId: 'trc_older',
            name: 'fs.read',
            traceName: 'fs.read',
            status: 'success',
            ok: true,
          },
        ],
        nextCursor: '000000000041',
      };
    },
    readNewerPage(input) {
      calls.push({ direction: 'newer', input });
      return {
        rows: [
          {
            id: 'row_newer',
            recordId: 'row_newer',
            traceId: 'trc_newer',
            name: 'code.call',
            traceName: 'code.call',
            status: 'success',
            ok: true,
          },
        ],
        nextCursor: '000000000043',
      };
    },
    readCachedAggregate(input) {
      return { cursor: input.cursor, summary: null };
    },
    ...overrides,
  };
  return { adapter, calls };
}

describe('Trace Sites authenticated history endpoint contract', () => {
  it('denies rich history unless the authenticated Trace Burn request opts into raw payload access', async () => {
    const fixture = backend();
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: fixture.adapter,
      resolveScope: async (incoming) => {
        const { traceGatewayScopeFromHeaders } = await import(
          '../scripts/lib/trace-sites-gateway-live-endpoints'
        );
        return traceGatewayScopeFromHeaders(incoming);
      },
    });

    const response = await endpoints.handle(
      request(
        'direction=older&cursor=000000000042&limit=25&site=trace-burn-intelligence&sourceMode=local-networked',
      ),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: 'RAW_PAYLOAD_ACCESS_DENIED' },
    });
    expect(fixture.calls).toHaveLength(0);
  });

  it('routes older history to the OS backend with the authenticated workspace and returns its cursor', async () => {
    const fixture = backend();
    const { traceGatewayScopeFromHeaders } = await import(
      '../scripts/lib/trace-sites-gateway-live-endpoints'
    );
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: fixture.adapter,
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const response = await endpoints.handle(
      request(
        'direction=older&cursor=000000000042&limit=25&site=trace-burn-intelligence&sourceMode=local-networked&includeRawPayload=true',
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      publicBoundary: 'consuelo-gateway',
      route: '/gateway/traces/recent',
      data: {
        direction: 'older',
        workspaceId: 'wrk_history',
        workspaceHost: 'testing.consuelohq.com',
        nodeId: 'node_history',
        nextCursor: '000000000041',
        rows: [{ recordId: 'row_older', traceId: 'trc_older' }],
      },
    });
    expect(fixture.calls).toEqual([
      {
        direction: 'older',
        input: expect.objectContaining({
          workspaceId: 'wrk_history',
          workspaceHost: 'testing.consuelohq.com',
          nodeId: 'node_history',
          site: 'trace-burn-intelligence',
          sourceMode: 'local-networked',
          cursor: '000000000042',
          limit: 25,
        }),
      },
    ]);
  });

  it('routes newer hydration to the distinct newer-page backend contract', async () => {
    const fixture = backend();
    const { traceGatewayScopeFromHeaders } = await import(
      '../scripts/lib/trace-sites-gateway-live-endpoints'
    );
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: fixture.adapter,
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const response = await endpoints.handle(
      request(
        'direction=newer&cursor=000000000042&limit=10&site=trace-burn-intelligence&sourceMode=local-networked&includeRawPayload=true',
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: {
        direction: 'newer',
        nextCursor: '000000000043',
        rows: [{ recordId: 'row_newer', traceId: 'trc_newer' }],
      },
    });
    expect(fixture.calls[0]).toMatchObject({
      direction: 'newer',
      input: { cursor: '000000000042', limit: 10 },
    });
  });

  it('rejects unsupported history directions before touching the backend', async () => {
    const fixture = backend();
    const { traceGatewayScopeFromHeaders } = await import(
      '../scripts/lib/trace-sites-gateway-live-endpoints'
    );
    const endpoints = createTraceSitesGatewayLiveEndpoints({
      backend: fixture.adapter,
      resolveScope: traceGatewayScopeFromHeaders,
    });

    const response = await endpoints.handle(
      request(
        'direction=sideways&cursor=000000000042&site=trace-burn-intelligence&sourceMode=local-networked&includeRawPayload=true',
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'TRACE_HISTORY_DIRECTION_INVALID' },
    });
    expect(fixture.calls).toHaveLength(0);
  });
});
