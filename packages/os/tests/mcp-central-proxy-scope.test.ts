import { describe, expect, test } from 'bun:test';

import { proxyCentralMcpRequest } from '../cloudflare/os-device-authority/src/services/mcp-proxy';
import { createMemoryDeviceGrantStore } from '../cloudflare/os-device-authority/src/stores';
import { hash } from '../cloudflare/os-device-authority/src/utils';
import {
  createInMemoryWorkspaceRouteD1,
  migrateWorkspaceRouteD1,
  upsertWorkspaceHostnameInD1,
} from '../scripts/lib/workspace-cloudflare-d1-route-registry';

describe('central MCP proxy scope enforcement', () => {
  test('does not forward a tools/call request with only the route-level grant', async () => {
    const origin = 'https://os.consuelohq.com';
    const workspaceHost = 'scope-proxy.consuelohq.com';
    const token = 'coa_route_only_test';
    const nowMs = Date.parse('2026-06-13T00:00:00.000Z');
    const store = createMemoryDeviceGrantStore();
    await store.putMcpOAuthAccessToken({
      tokenHash: await hash(token),
      clientId: 'chatgpt-consuelo-os',
      scope: 'route:/mcp:read',
      scopes: ['route:/mcp:read'],
      resource: `${origin}/mcp`,
      workspaceHost,
      accountId: 'google:scope-proxy-user',
      email: 'scope-proxy@example.com',
      issuedAt: nowMs,
      expiresAt: nowMs + 60_000,
    });

    const routeRegistry = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routeRegistry);
    await upsertWorkspaceHostnameInD1(routeRegistry, {
      workspaceId: 'workspace_scope_proxy',
      workspaceSlug: 'scope-proxy',
      hostname: workspaceHost,
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      routes: [{
        surface: 'os',
        pathPrefix: '/mcp',
        auth: 'signed-connector',
        status: 'active',
        target: {
          kind: 'os-connector',
          connectorId: 'connector_scope_proxy',
          connectorStatus: 'connected',
          tunnelOriginUrl: 'https://connector.scope-proxy.example',
        },
      }],
    });

    let forwarded = false;
    const response = await proxyCentralMcpRequest({
      request: new Request(`${origin}/mcp`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'call',
            arguments: { tool: 'status', input: {} },
          },
        }),
      }),
      store,
      origin,
      nowMs,
      routeRegistry,
      fetchImpl: async () => {
        forwarded = true;
        return new Response('{}', { status: 200 });
      },
    });

    expect(response.status).toBe(403);
    expect(forwarded).toBe(false);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'MISSING_SCOPE' },
    });
  });
});
