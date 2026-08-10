import { describe, expect, test } from 'bun:test';

import { proxyCentralMcpRequest } from '../cloudflare/os-device-authority/src/services/mcp-proxy';
import { createMemoryDeviceGrantStore } from '../cloudflare/os-device-authority/src/stores';
import { hash } from '../cloudflare/os-device-authority/src/utils';
import {
  createInMemoryWorkspaceRouteD1,
  migrateWorkspaceRouteD1,
  upsertWorkspaceHostnameInD1,
} from '../scripts/lib/workspace-cloudflare-d1-route-registry';
import { CENTRAL_MCP_READ_ONLY_FACADE_TOOLS } from '../scripts/lib/tool-scope-authorization';

describe('central MCP proxy scope enforcement', () => {
  test('keeps the central read-only classifier aligned with the generated facade manifest', async () => {
    const manifest = await Bun.file(new URL(
      '../manifests/generated/tool.manifest.json',
      import.meta.url,
    )).json() as {
      tools: Array<{
        name: string;
        kind: string;
        definition?: { capabilities?: { readOnly?: boolean; mutating?: boolean } };
      }>;
    };
    const generatedReadOnlyTools = manifest.tools
      .filter((tool) =>
        tool.kind === 'facade-tool'
        && tool.definition?.capabilities?.readOnly === true
        && tool.definition.capabilities.mutating !== true)
      .map((tool) => tool.name)
      .sort();

    expect([...CENTRAL_MCP_READ_ONLY_FACADE_TOOLS].sort()).toEqual(
      generatedReadOnlyTools,
    );
  });

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

  test('forwards read-only facade calls without allowing writes for a tool read grant', async () => {
    const origin = 'https://os.consuelohq.com';
    const workspaceHost = 'read-scope-proxy.consuelohq.com';
    const token = 'coa_read_scope_test';
    const nowMs = Date.parse('2026-06-13T00:00:00.000Z');
    const store = createMemoryDeviceGrantStore();
    await store.putMcpOAuthAccessToken({
      tokenHash: await hash(token),
      clientId: 'chatgpt-consuelo-os',
      scope: 'route:/mcp:read tool:*:read',
      scopes: ['route:/mcp:read', 'tool:*:read'],
      resource: `${origin}/mcp`,
      workspaceHost,
      accountId: 'google:read-scope-proxy-user',
      email: 'read-scope-proxy@example.com',
      issuedAt: nowMs,
      expiresAt: nowMs + 60_000,
    });

    const routeRegistry = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routeRegistry);
    await upsertWorkspaceHostnameInD1(routeRegistry, {
      workspaceId: 'workspace_read_scope_proxy',
      workspaceSlug: 'read-scope-proxy',
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
          connectorId: 'connector_read_scope_proxy',
          connectorStatus: 'connected',
          tunnelOriginUrl: 'https://connector.read-scope-proxy.example',
        },
      }],
    });

    const forwardedTools: string[] = [];
    const proxy = async (tool: string) => proxyCentralMcpRequest({
      request: new Request(`${origin}/mcp`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: tool,
          method: 'tools/call',
          params: {
            name: 'call',
            arguments: {
              tool,
              input: tool === 'fs.read'
                ? { path: 'README.md' }
                : { path: 'README.md', content: 'blocked' },
            },
          },
        }),
      }),
      store,
      origin,
      nowMs,
      routeRegistry,
      fetchImpl: async (request) => {
        const payload = await request.clone().json() as {
          params?: { arguments?: { tool?: string } };
        };
        forwardedTools.push(payload.params?.arguments?.tool ?? '');
        return new Response('{}', { status: 200 });
      },
    });

    const read = await proxy('fs.read');
    expect(read.status).toBe(200);
    expect(forwardedTools).toEqual(['fs.read']);

    const write = await proxy('fs.write');
    expect(write.status).toBe(403);
    expect(forwardedTools).toEqual(['fs.read']);
    await expect(write.json()).resolves.toMatchObject({
      error: { code: 'MISSING_SCOPE' },
    });
  });
});
