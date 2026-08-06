import { describe, expect, it } from 'vitest';

import {
  createInMemoryWorkspaceRouteD1,
  createWorkspaceCloudflareD1RouteRegistry,
  migrateWorkspaceRouteD1,
  upsertWorkspaceHostnameInD1,
  type WorkspaceRouteD1RecordInput,
} from '../scripts/lib/workspace-cloudflare-d1-route-registry';
import { createWorkspaceCloudflareEdgeRouter } from '../scripts/lib/workspace-cloudflare-edge-router';

const now = 1_800_000_000_000;
const connectorOrigin = 'https://c-node-primary.consuelohq.com';

function workspaceRecord(input: {
  connectorStatus?: 'connected' | 'disconnected';
  lastSeenAt?: number;
  state?: 'active' | 'revoked';
} = {}): WorkspaceRouteD1RecordInput {
  return {
    workspaceId: 'workspace_acme',
    workspaceSlug: 'acme',
    hostname: 'acme.consuelohq.com',
    baseDomain: 'consuelohq.com',
    provider: 'cloudflare',
    owner: 'consuelo-os-cloud',
    status: 'active',
    defaultNodeId: 'node-primary',
    nodeTargets: [
      {
        nodeId: 'node-primary',
        connectorId: 'connector-primary',
        connectorStatus: input.connectorStatus ?? 'connected',
        tunnelOriginUrl: connectorOrigin,
        state: input.state ?? 'active',
        lastSeenAt: input.lastSeenAt ?? now,
        heartbeatTtlMs: 60_000,
      },
    ],
    routes: [
      {
        surface: 'sites',
        pathPrefix: '/gateway/traces/events',
        auth: 'workspace-session',
        status: 'active',
        target: {
          kind: 'consuelo-gateway-service',
          serviceName: 'trace-sites-live-endpoints',
          gatewayRouteFamily: '/gateway/traces/*',
          publicSiteRouteFamily: '/observability/*',
        },
      },
      {
        surface: 'sites',
        pathPrefix: '/gateway/traces',
        auth: 'workspace-session',
        status: 'active',
        target: {
          kind: 'consuelo-gateway-service',
          serviceName: 'trace-sites-read-layer',
          gatewayRouteFamily: '/gateway/traces/*',
          publicSiteRouteFamily: '/observability/*',
        },
      },
      {
        surface: 'sites',
        pathPrefix: '/gateway/environments',
        auth: 'workspace-session',
        status: 'active',
        target: {
          kind: 'consuelo-gateway-service',
          serviceName: 'environment-sites-read-endpoints',
          gatewayRouteFamily: '/gateway/environments/*',
          publicSiteRouteFamily: '/environments/*',
        },
      },
    ],
  };
}

async function createRouter(input: {
  record?: WorkspaceRouteD1RecordInput;
  authorize?: boolean;
  fetchUpstream?: (request: Request) => Promise<Response>;
}) {
  const db = createInMemoryWorkspaceRouteD1();
  await migrateWorkspaceRouteD1(db);
  await upsertWorkspaceHostnameInD1(db, input.record ?? workspaceRecord());
  return createWorkspaceCloudflareEdgeRouter({
    registry: createWorkspaceCloudflareD1RouteRegistry(db),
    internalSigningSecret: 'edge-signing-secret',
    now: () => now,
    createNonce: () => 'gateway-node-proxy-nonce',
    authorizeWorkspaceSession: async () => input.authorize ?? true,
    fetchUpstream: input.fetchUpstream,
  });
}

describe('workspace gateway node proxy', () => {
  it('proxies an authenticated trace read to the selected node with signed routing headers', async () => {
    const upstream: Request[] = [];
    const router = await createRouter({
      fetchUpstream: async (request) => {
        upstream.push(request);
        return Response.json({ ok: true, snapshot: { rows: [{ id: 'trace-1' }] } });
      },
    });

    const response = await router.fetch(
      new Request('https://acme.consuelohq.com/gateway/traces/recent?cursor=latest', {
        headers: { cookie: 'consuelo_workspace_session=session-acme' },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      snapshot: { rows: [{ id: 'trace-1' }] },
    });
    expect(upstream).toHaveLength(1);
    expect(upstream[0].url).toBe(
      connectorOrigin + '/gateway/traces/recent?cursor=latest',
    );
    expect(upstream[0].headers.get('x-consuelo-workspace-id')).toBe(
      'workspace_acme',
    );
    expect(upstream[0].headers.get('x-consuelo-hostname')).toBe(
      'acme.consuelohq.com',
    );
    expect(upstream[0].headers.get('x-consuelo-node-id')).toBe('node-primary');
    expect(upstream[0].headers.get('x-consuelo-device-id')).toBe('node-primary');
    expect(upstream[0].headers.get('x-consuelo-connector-id')).toBe(
      'connector-primary',
    );
    expect(upstream[0].headers.get('x-consuelo-edge-signature')).toMatch(
      /^sha256=[0-9a-f]{64}$/,
    );
  });

  it('preserves POST bodies for environment writes', async () => {
    const upstream: Request[] = [];
    const router = await createRouter({
      fetchUpstream: async (request) => {
        upstream.push(request);
        return Response.json({ ok: true, snapshot: { environments: [] } });
      },
    });

    const response = await router.fetch(
      new Request('https://acme.consuelohq.com/gateway/environments/upsert', {
        method: 'POST',
        headers: {
          cookie: 'consuelo_workspace_session=session-acme',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'production' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveLength(1);
    expect(upstream[0].method).toBe('POST');
    expect(await upstream[0].text()).toBe('{"name":"production"}');
  });

  it('passes through an event-stream response without buffering it into a descriptor', async () => {
    const router = await createRouter({
      fetchUpstream: async () =>
        new Response('event: trace\ndata: {"id":"trace-1"}\n\n', {
          headers: { 'content-type': 'text/event-stream' },
        }),
    });

    const response = await router.fetch(
      new Request('https://acme.consuelohq.com/gateway/traces/events?cursor=latest', {
        headers: { cookie: 'consuelo_workspace_session=session-acme' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(await response.text()).toContain('event: trace');
  });

  it('rejects an unauthenticated browser before contacting the node', async () => {
    const upstream: Request[] = [];
    const router = await createRouter({
      authorize: false,
      fetchUpstream: async (request) => {
        upstream.push(request);
        return new Response('unexpected');
      },
    });

    const response = await router.fetch(
      new Request('https://acme.consuelohq.com/gateway/traces/recent'),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'workspace_session_required' });
    expect(upstream).toHaveLength(0);
  });

  it.each([
    {
      name: 'stale node',
      record: workspaceRecord({ lastSeenAt: now - 180_001 }),
      code: 'WORKSPACE_NODE_OFFLINE',
    },
    {
      name: 'disconnected connector',
      record: workspaceRecord({ connectorStatus: 'disconnected' }),
      code: 'WORKSPACE_NODE_OFFLINE',
    },
    {
      name: 'revoked node',
      record: workspaceRecord({ state: 'revoked' }),
      code: 'WORKSPACE_NODE_REVOKED',
    },
  ])('fails closed for $name', async ({ record, code }) => {
    const upstream: Request[] = [];
    const router = await createRouter({
      record,
      fetchUpstream: async (request) => {
        upstream.push(request);
        return new Response('unexpected');
      },
    });

    const response = await router.fetch(
      new Request('https://acme.consuelohq.com/gateway/traces/recent', {
        headers: { cookie: 'consuelo_workspace_session=session-acme' },
      }),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(code === 'WORKSPACE_NODE_REVOKED' ? 404 : 503);
    expect(body.error.code).toBe(code);
    expect(upstream).toHaveLength(0);
  });
});
