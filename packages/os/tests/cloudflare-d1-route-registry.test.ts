import { describe, expect, it } from 'vitest';

import {
  createInMemoryWorkspaceRouteD1,
  migrateWorkspaceRouteD1,
  resolveWorkspaceRouteFromD1,
  revokeWorkspaceHostnameInD1,
  upsertWorkspaceHostnameInD1,
} from '../scripts/lib/workspace-cloudflare-d1-route-registry';

describe('workspace Cloudflare D1 route registry contract', () => {
  it('should migrate the edge registry schema and resolve longest-prefix routes', async () => {
    const db = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(db);

    await upsertWorkspaceHostnameInD1(db, {
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      hostname: 'kokayi.consuelohq.com',
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      routes: [
        {
          surface: 'os',
          pathPrefix: '/traces',
          auth: 'required',
          status: 'active',
          target: {
            kind: 'os-connector',
            connectorId: 'connector_123',
            connectorStatus: 'connected',
            tunnelOriginUrl: 'https://connector-123.os-origin.consuelohq.com',
          },
        },
        {
          surface: 'os',
          pathPrefix: '/traces/runs',
          auth: 'required',
          status: 'active',
          target: {
            kind: 'os-connector',
            connectorId: 'connector_123',
            connectorStatus: 'connected',
            tunnelOriginUrl: 'https://connector-123.os-origin.consuelohq.com',
          },
        },
        {
          surface: 'dialer',
          pathPrefix: '/dialer',
          auth: 'required',
          status: 'active',
          target: {
            kind: 'service-upstream',
            service: 'dialer',
            upstreamUrl: 'https://dialer-production.up.railway.app',
          },
        },
      ],
    });

    await expect(
      resolveWorkspaceRouteFromD1(db, {
        host: 'kokayi.consuelohq.com',
        path: '/traces/runs/trc_123',
      }),
    ).resolves.toMatchObject({
      allowed: true,
      workspaceId: 'workspace_123',
      hostname: 'kokayi.consuelohq.com',
      route: '/traces/runs',
      surface: 'os',
      target: {
        kind: 'os-connector',
        connectorId: 'connector_123',
        connectorStatus: 'connected',
      },
    });

    await expect(
      resolveWorkspaceRouteFromD1(db, {
        host: 'kokayi.consuelohq.com',
        path: '/dialer/calls',
      }),
    ).resolves.toMatchObject({
      allowed: true,
      workspaceId: 'workspace_123',
      hostname: 'kokayi.consuelohq.com',
      route: '/dialer',
      surface: 'dialer',
      target: {
        kind: 'service-upstream',
        service: 'dialer',
        upstreamUrl: 'https://dialer-production.up.railway.app',
      },
    });
  });

  it('should let Dialer stay active while OS connector routes fail closed', async () => {
    const db = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(db);

    await upsertWorkspaceHostnameInD1(db, {
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      hostname: 'kokayi.consuelohq.com',
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      routes: [
        {
          surface: 'os',
          pathPrefix: '/traces',
          auth: 'required',
          status: 'active',
          target: {
            kind: 'os-connector',
            connectorId: 'connector_123',
            connectorStatus: 'disconnected',
            tunnelOriginUrl: 'https://connector-123.os-origin.consuelohq.com',
          },
        },
        {
          surface: 'dialer',
          pathPrefix: '/dialer',
          auth: 'required',
          status: 'active',
          target: {
            kind: 'service-upstream',
            service: 'dialer',
            upstreamUrl: 'https://dialer-production.up.railway.app',
          },
        },
      ],
    });

    await expect(
      resolveWorkspaceRouteFromD1(db, {
        host: 'kokayi.consuelohq.com',
        path: '/traces',
      }),
    ).resolves.toMatchObject({
      allowed: false,
      status: 503,
      errorCode: 'WORKSPACE_HOSTNAME_OS_CONNECTOR_OFFLINE',
    });

    await expect(
      resolveWorkspaceRouteFromD1(db, {
        host: 'kokayi.consuelohq.com',
        path: '/dialer',
      }),
    ).resolves.toMatchObject({
      allowed: true,
      surface: 'dialer',
    });
  });

  it('should ignore disabled routes and fail closed for unknown paths', async () => {
    const db = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(db);

    await upsertWorkspaceHostnameInD1(db, {
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      hostname: 'kokayi.consuelohq.com',
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      routes: [
        {
          surface: 'os',
          pathPrefix: '/mcp',
          auth: 'required',
          status: 'disabled',
          target: {
            kind: 'os-connector',
            connectorId: 'connector_123',
            connectorStatus: 'connected',
            tunnelOriginUrl: 'https://connector-123.os-origin.consuelohq.com',
          },
        },
      ],
    });

    await expect(
      resolveWorkspaceRouteFromD1(db, {
        host: 'kokayi.consuelohq.com',
        path: '/mcp/call',
      }),
    ).resolves.toMatchObject({
      allowed: false,
      status: 404,
      errorCode: 'WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND',
    });
  });

  it('should revoke workspace hostnames fail closed', async () => {
    const db = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(db);

    await upsertWorkspaceHostnameInD1(db, {
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      hostname: 'kokayi.consuelohq.com',
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      routes: [
        {
          surface: 'dialer',
          pathPrefix: '/dialer',
          auth: 'required',
          status: 'active',
          target: {
            kind: 'service-upstream',
            service: 'dialer',
            upstreamUrl: 'https://dialer-production.up.railway.app',
          },
        },
      ],
    });

    await revokeWorkspaceHostnameInD1(db, {
      hostname: 'kokayi.consuelohq.com',
      reason: 'user-disabled',
    });

    await expect(
      resolveWorkspaceRouteFromD1(db, {
        host: 'kokayi.consuelohq.com',
        path: '/dialer',
      }),
    ).resolves.toMatchObject({
      allowed: false,
      status: 404,
      errorCode: 'WORKSPACE_HOSTNAME_NOT_FOUND',
    });
  });

  it('should keep tunnel tokens out of durable D1 route rows', async () => {
    const db = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(db);

    await upsertWorkspaceHostnameInD1(db, {
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      hostname: 'kokayi.consuelohq.com',
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      routes: [
        {
          surface: 'os',
          pathPrefix: '/api',
          auth: 'required',
          status: 'active',
          target: {
            kind: 'os-connector',
            connectorId: 'connector_123',
            connectorStatus: 'connected',
            tunnelOriginUrl: 'https://connector-123.os-origin.consuelohq.com',
          },
        },
      ],
    });

    const row = await db.dumpHostnameRow('kokayi.consuelohq.com');

    expect(JSON.stringify(row)).not.toMatch(/tunnelToken|secret_tunnel_token|client_secret/i);
  });
});
