import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type WorkspaceRouteD1RouteTarget =
  | {
      kind: 'service-upstream';
      service: 'dialer' | 'app' | 'sites' | 'twenty';
      upstreamUrl: string;
    }
  | {
      kind: 'os-connector';
      connectorId: string;
      connectorStatus: 'connected' | 'disconnected';
      tunnelOriginUrl: string;
    }
  | {
      kind: 'site-snapshot';
      siteId: string;
      versionId: string;
      manifestKey: string;
      cachePolicy: 'static-shell' | 'versioned-asset' | 'mutable-artifact' | 'private-preview';
    }
  | {
      kind: 'consuelo-gateway-service';
      serviceName: string;
      gatewayRouteFamily: string;
      publicSiteRouteFamily: string;
    };

type WorkspaceRouteD1Route = {
  surface: 'os' | 'dialer' | 'app' | 'sites' | 'twenty';
  pathPrefix: string;
  auth: 'public' | 'required' | 'workspace-session' | 'signed-connector';
  status: 'active' | 'disabled';
  target: WorkspaceRouteD1RouteTarget;
};

type WorkspaceRouteD1RecordInput = {
  workspaceId: string;
  workspaceSlug: string;
  hostname: string;
  baseDomain: string;
  provider: 'cloudflare';
  owner: 'consuelo-os-cloud';
  status: 'active' | 'revoked';
  defaultNodeId?: string;
  nodeTargets?: Array<{
    nodeId: string;
    connectorId: string;
    connectorStatus: 'connected' | 'disconnected';
    tunnelOriginUrl: string;
    state: 'active' | 'revoked';
    lastSeenAt: number;
    heartbeatTtlMs: number;
  }>;
  routes: WorkspaceRouteD1Route[];
};

type WorkspaceRouteD1ResolutionInput = {
  host: string;
  path: string;
  nodeId?: string;
  nowMs?: number;
};

type WorkspaceRouteD1RevocationInput = {
  hostname: string;
  reason: string;
};

type WorkspaceRouteD1PreparedStatement = {
  bind: (...values: unknown[]) => WorkspaceRouteD1PreparedStatement;
  first: <T = unknown>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

type WorkspaceRouteD1Database = {
  dumpHostnameRow?: (hostname: string) => Promise<unknown>;
  prepare?: (sql: string) => WorkspaceRouteD1PreparedStatement;
  exec?: (sql: string) => Promise<unknown>;
};

type WorkspaceRouteD1RegistryContract = {
  createInMemoryWorkspaceRouteD1: () => WorkspaceRouteD1Database;
  migrateWorkspaceRouteD1: (db: WorkspaceRouteD1Database) => Promise<void>;
  upsertWorkspaceHostnameInD1: (
    db: WorkspaceRouteD1Database,
    input: WorkspaceRouteD1RecordInput,
  ) => Promise<void>;
  resolveWorkspaceRouteFromD1: (
    db: WorkspaceRouteD1Database,
    input: WorkspaceRouteD1ResolutionInput,
  ) => Promise<unknown>;
  revokeWorkspaceHostnameInD1: (
    db: WorkspaceRouteD1Database,
    input: WorkspaceRouteD1RevocationInput,
  ) => Promise<void>;
  updateWorkspaceNodeTargetInD1: (
    db: WorkspaceRouteD1Database,
    input: {
      hostname: string;
      nodeId: string;
      connectorStatus?: 'connected' | 'disconnected';
      state?: 'active' | 'revoked';
      lastSeenAt?: number;
      heartbeatTtlMs?: number;
    },
  ) => Promise<void>;
  upsertWorkspaceNodeTargetInD1: (
    db: WorkspaceRouteD1Database,
    input: {
      record: WorkspaceRouteD1RecordInput;
      target: NonNullable<WorkspaceRouteD1RecordInput['nodeTargets']>[number];
      makeDefault?: boolean;
      localServiceUrl?: string;
      refreshSiteSnapshots?: boolean;
    },
  ) => Promise<void>;
};

const runContract =
  process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;


const createFixtureCloudflareD1 = (): WorkspaceRouteD1Database => {
  const rows = new Map<string, Record<string, unknown>>();

  return {
    async exec() {},
    prepare(sql: string): WorkspaceRouteD1PreparedStatement {
      let values: unknown[] = [];

      return {
        bind(...nextValues: unknown[]): WorkspaceRouteD1PreparedStatement {
          values = nextValues;
          return this;
        },
        async first<T = unknown>(): Promise<T | null> {
          if (/select/i.test(sql)) {
            return (rows.get(String(values[0])) as T | undefined) ?? null;
          }

          return null;
        },
        async run(): Promise<unknown> {
          if (values.length === 0) return { success: true };
          if (/insert/i.test(sql)) {
            const recordJson = [...values]
              .reverse()
              .find(
                (value) =>
                  typeof value === 'string' &&
                  value.trim().startsWith('{') &&
                  value.includes('"workspaceId"'),
              );
            rows.set(String(values[0]), {
              hostname: values[0],
              record_json: recordJson ?? values[1],
              status: values[2],
              updated_at: values[3],
              revoked_at: values[4] ?? null,
              revocation_reason: values[5] ?? null,
            });
          } else if (/update/i.test(sql)) {
            const existing = rows.get(String(values[0]));
            const recordJson = [...values]
              .reverse()
              .find(
                (value) =>
                  typeof value === 'string' &&
                  value.trim().startsWith('{') &&
                  value.includes('"workspaceId"'),
              );

            if (existing) {
              rows.set(String(values[0]), {
                ...existing,
                record_json: recordJson ?? values[1],
                status: values[2],
                updated_at: values[3],
                revoked_at: values[4] ?? null,
                revocation_reason: values[5] ?? null,
              });
            }
          }

          return { success: true };
        },
      };
    },
  };
};

async function loadWorkspaceRouteD1RegistryContract(): Promise<WorkspaceRouteD1RegistryContract> {
  const modulePath = pathToFileURL(
    join(
      process.cwd(),
      'scripts',
      'lib',
      'workspace-cloudflare-d1-route-registry.ts',
    ),
  ).href;
  const module = (await import(
    modulePath
  )) as Partial<WorkspaceRouteD1RegistryContract>;
  const requiredExports: Array<keyof WorkspaceRouteD1RegistryContract> = [
    'createInMemoryWorkspaceRouteD1',
    'migrateWorkspaceRouteD1',
    'upsertWorkspaceHostnameInD1',
    'resolveWorkspaceRouteFromD1',
    'revokeWorkspaceHostnameInD1',
    'updateWorkspaceNodeTargetInD1',
    'upsertWorkspaceNodeTargetInD1',
  ];
  const missingExports = requiredExports.filter(
    (name) => typeof module[name] !== 'function',
  );

  if (missingExports.length > 0) {
    throw new Error(
      `workspace Cloudflare D1 route registry contract module is missing exports: ${missingExports.join(', ')}`,
    );
  }

  return module as WorkspaceRouteD1RegistryContract;
}

contractDescribe('workspace Cloudflare D1 route registry contract', () => {

  it('should read and write route rows through a Cloudflare D1 binding', async () => {
    const registry = await loadWorkspaceRouteD1RegistryContract();
    const db = createFixtureCloudflareD1();
    await registry.migrateWorkspaceRouteD1(db);

    await registry.upsertWorkspaceHostnameInD1(db, {
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
          status: 'active',
          target: {
            kind: 'os-connector',
            connectorId: 'connector_123',
            connectorStatus: 'connected',
            tunnelOriginUrl: 'https://c-ad94b888d3062f30e27d571fdeb3d6f4.consuelohq.com',
          },
        },
      ],
    });

    await expect(
      registry.resolveWorkspaceRouteFromD1(db, {
        host: 'kokayi.consuelohq.com',
        path: '/mcp/tools/list',
      }),
    ).resolves.toMatchObject({
      allowed: true,
      workspaceId: 'workspace_123',
      route: '/mcp',
      surface: 'os',
      target: {
        kind: 'os-connector',
        connectorId: 'connector_123',
      },
    });

    await registry.revokeWorkspaceHostnameInD1(db, {
      hostname: 'kokayi.consuelohq.com',
      reason: 'user-disabled',
    });

    await expect(
      registry.resolveWorkspaceRouteFromD1(db, {
        host: 'kokayi.consuelohq.com',
        path: '/mcp/tools/list',
      }),
    ).resolves.toMatchObject({
      allowed: false,
      status: 404,
      errorCode: 'WORKSPACE_HOSTNAME_NOT_FOUND',
    });
  });

  it('should migrate the edge registry schema and resolve longest-prefix routes', async () => {
    const registry = await loadWorkspaceRouteD1RegistryContract();
    const db = registry.createInMemoryWorkspaceRouteD1();
    await registry.migrateWorkspaceRouteD1(db);

    await registry.upsertWorkspaceHostnameInD1(db, {
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
            tunnelOriginUrl: 'https://c-ad94b888d3062f30e27d571fdeb3d6f4.consuelohq.com',
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
            tunnelOriginUrl: 'https://c-ad94b888d3062f30e27d571fdeb3d6f4.consuelohq.com',
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
      registry.resolveWorkspaceRouteFromD1(db, {
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
      registry.resolveWorkspaceRouteFromD1(db, {
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
    const registry = await loadWorkspaceRouteD1RegistryContract();
    const db = registry.createInMemoryWorkspaceRouteD1();
    await registry.migrateWorkspaceRouteD1(db);

    await registry.upsertWorkspaceHostnameInD1(db, {
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
            tunnelOriginUrl: 'https://c-ad94b888d3062f30e27d571fdeb3d6f4.consuelohq.com',
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
      registry.resolveWorkspaceRouteFromD1(db, {
        host: 'kokayi.consuelohq.com',
        path: '/traces',
      }),
    ).resolves.toMatchObject({
      allowed: false,
      status: 503,
      errorCode: 'WORKSPACE_HOSTNAME_OS_CONNECTOR_OFFLINE',
    });

    await expect(
      registry.resolveWorkspaceRouteFromD1(db, {
        host: 'kokayi.consuelohq.com',
        path: '/dialer',
      }),
    ).resolves.toMatchObject({
      allowed: true,
      surface: 'dialer',
    });
  });

  it('should ignore disabled routes and fail closed for unknown paths', async () => {
    const registry = await loadWorkspaceRouteD1RegistryContract();
    const db = registry.createInMemoryWorkspaceRouteD1();
    await registry.migrateWorkspaceRouteD1(db);

    await registry.upsertWorkspaceHostnameInD1(db, {
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
            tunnelOriginUrl: 'https://c-ad94b888d3062f30e27d571fdeb3d6f4.consuelohq.com',
          },
        },
      ],
    });

    await expect(
      registry.resolveWorkspaceRouteFromD1(db, {
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
    const registry = await loadWorkspaceRouteD1RegistryContract();
    const db = registry.createInMemoryWorkspaceRouteD1();
    await registry.migrateWorkspaceRouteD1(db);

    await registry.upsertWorkspaceHostnameInD1(db, {
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

    await registry.revokeWorkspaceHostnameInD1(db, {
      hostname: 'kokayi.consuelohq.com',
      reason: 'user-disabled',
    });

    await expect(
      registry.resolveWorkspaceRouteFromD1(db, {
        host: 'kokayi.consuelohq.com',
        path: '/dialer',
      }),
    ).resolves.toMatchObject({
      allowed: false,
      status: 404,
      errorCode: 'WORKSPACE_HOSTNAME_NOT_FOUND',
    });
  });

  it('should keep tunnel credentials out of durable D1 route rows', async () => {
    const registry = await loadWorkspaceRouteD1RegistryContract();
    const db = registry.createInMemoryWorkspaceRouteD1();
    await registry.migrateWorkspaceRouteD1(db);

    await registry.upsertWorkspaceHostnameInD1(db, {
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
            tunnelOriginUrl: 'https://c-ad94b888d3062f30e27d571fdeb3d6f4.consuelohq.com',
          },
        },
      ],
    });

    const row = await db.dumpHostnameRow('kokayi.consuelohq.com');

    expect(JSON.stringify(row)).not.toMatch(/tunnelCredential|credential_fixture|client_secret/i);
  });

  it('should use root routes as host-level fallbacks after more-specific routes', async () => {
    const registry = await loadWorkspaceRouteD1RegistryContract();
    const db = registry.createInMemoryWorkspaceRouteD1();
    await registry.migrateWorkspaceRouteD1(db);

    await registry.upsertWorkspaceHostnameInD1(db, {
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      hostname: 'internal.consuelohq.com',
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      routes: [
        {
          surface: 'app',
          pathPrefix: '/',
          auth: 'required',
          status: 'active',
          target: {
            kind: 'service-upstream',
            service: 'app',
            upstreamUrl: 'https://app.consuelohq.com',
          },
        },
        {
          surface: 'os',
          pathPrefix: '/mcp',
          auth: 'required',
          status: 'active',
          target: {
            kind: 'os-connector',
            connectorId: 'connector_internal',
            connectorStatus: 'connected',
            tunnelOriginUrl: 'https://c-97c89262e0970bc466db457d4484f366.consuelohq.com',
          },
        },
      ],
    });

    await expect(
      registry.resolveWorkspaceRouteFromD1(db, {
        host: 'internal.consuelohq.com',
        path: '/health',
      }),
    ).resolves.toMatchObject({
      allowed: true,
      route: '/',
      surface: 'app',
    });

    await expect(
      registry.resolveWorkspaceRouteFromD1(db, {
        host: 'internal.consuelohq.com',
        path: '/mcp/status',
      }),
    ).resolves.toMatchObject({
      allowed: true,
      route: '/mcp',
      surface: 'os',
    });
  });

  it('should merge missing OS routes into an existing site-only workspace record', async () => {
    const registry = await loadWorkspaceRouteD1RegistryContract();
    const db = registry.createInMemoryWorkspaceRouteD1();
    await registry.migrateWorkspaceRouteD1(db);
    const nowMs = Date.parse('2026-07-29T22:30:00.000Z');

    await registry.upsertWorkspaceHostnameInD1(db, {
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      hostname: 'internal.consuelohq.com',
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      routes: [
        {
          surface: 'app',
          pathPrefix: '/',
          auth: 'required',
          status: 'active',
          target: {
            kind: 'service-upstream',
            service: 'app',
            upstreamUrl: 'https://app.consuelohq.com',
          },
        },
      ],
    });

    await registry.upsertWorkspaceNodeTargetInD1(db, {
      record: {
        workspaceId: 'workspace_internal',
        workspaceSlug: 'internal',
        hostname: 'internal.consuelohq.com',
        baseDomain: 'consuelohq.com',
        provider: 'cloudflare',
        owner: 'consuelo-os-cloud',
        status: 'active',
        routes: [
          {
            surface: 'os',
            pathPrefix: '/gtm',
            auth: 'workspace-session',
            status: 'active',
            target: {
              kind: 'os-connector',
              connectorId: 'connector_fresh',
              connectorStatus: 'connected',
              tunnelOriginUrl: 'https://fresh.connector.test',
            },
          },
          {
            surface: 'os',
            pathPrefix: '/mcp',
            auth: 'required',
            status: 'active',
            target: {
              kind: 'os-connector',
              connectorId: 'connector_fresh',
              connectorStatus: 'connected',
              tunnelOriginUrl: 'https://fresh.connector.test',
            },
          },
        ],
      },
      target: {
        nodeId: 'node-fresh',
        connectorId: 'connector_fresh',
        connectorStatus: 'connected',
        tunnelOriginUrl: 'https://fresh.connector.test',
        state: 'active',
        lastSeenAt: nowMs,
        heartbeatTtlMs: 60_000,
      },
      makeDefault: true,
      localServiceUrl: 'http://127.0.0.1:46320',
    });

    await expect(
      registry.resolveWorkspaceRouteFromD1(db, {
        host: 'internal.consuelohq.com',
        path: '/mcp',
        nowMs,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      route: '/mcp',
      nodeId: 'node-fresh',
      target: {
        connectorId: 'connector_fresh',
        tunnelOriginUrl: 'https://fresh.connector.test',
      },
    });
    await expect(
      registry.resolveWorkspaceRouteFromD1(db, {
        host: 'internal.consuelohq.com',
        path: '/gtm',
        nowMs,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      route: '/gtm',
      nodeId: 'node-fresh',
    });
    await expect(
      registry.resolveWorkspaceRouteFromD1(db, {
        host: 'internal.consuelohq.com',
        path: '/health',
        nowMs,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      route: '/',
      surface: 'app',
    });
  });

  it('should refresh active release-managed site snapshots without replacing published public sites', async () => {
    const registry = await loadWorkspaceRouteD1RegistryContract();
    const db = registry.createInMemoryWorkspaceRouteD1();
    await registry.migrateWorkspaceRouteD1(db);
    const nowMs = Date.parse('2026-08-14T09:30:00.000Z');

    const siteRoute = (pathPrefix: string, siteId: string, versionId: string, workspaceId: string, auth: WorkspaceRouteD1Route['auth']): WorkspaceRouteD1Route => ({
      surface: 'sites',
      pathPrefix,
      auth,
      status: 'active',
      target: {
        kind: 'site-snapshot',
        siteId,
        versionId,
        manifestKey: `sites/${workspaceId}/${siteId}/${versionId}/index.html`,
        cachePolicy: pathPrefix === '/' ? 'private-preview' : 'static-shell',
      },
    });

    await registry.upsertWorkspaceHostnameInD1(db, {
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      hostname: 'internal.consuelohq.com',
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      routes: [
        siteRoute('/', 'launcher', 'old-shell', 'workspace_internal', 'workspace-session'),
        siteRoute('/observability', 'traces', 'old-shell', 'workspace_internal', 'workspace-session'),
        siteRoute('/artifacts', 'artifacts', 'customer-artifact-version', 'workspace_internal', 'public'),
      ],
    });

    await registry.upsertWorkspaceNodeTargetInD1(db, {
      record: {
        workspaceId: 'workspace_internal',
        workspaceSlug: 'internal',
        hostname: 'internal.consuelohq.com',
        baseDomain: 'consuelohq.com',
        provider: 'cloudflare',
        owner: 'consuelo-os-cloud',
        status: 'active',
        routes: [
          siteRoute('/', 'launcher', 'new-shell', 'workspace_testing', 'workspace-session'),
          siteRoute('/observability', 'traces', 'new-shell', 'workspace_testing', 'workspace-session'),
          { surface: 'sites', pathPrefix: '/artifacts', auth: 'public', status: 'disabled', target: { kind: 'site-snapshot', siteId: 'artifacts', versionId: 'new-shell', manifestKey: 'sites/workspace_testing/artifacts/new-shell/index.html', cachePolicy: 'static-shell' } },
        ],
      },
      target: {
        nodeId: 'node-current',
        connectorId: 'connector_current',
        connectorStatus: 'connected',
        tunnelOriginUrl: 'https://current.connector.test',
        state: 'active',
        lastSeenAt: nowMs,
        heartbeatTtlMs: 60_000,
      },
      makeDefault: true,
      refreshSiteSnapshots: true,
      localServiceUrl: 'http://127.0.0.1:46320',
    });

    await expect(registry.resolveWorkspaceRouteFromD1(db, {
      host: 'internal.consuelohq.com',
      path: '/observability',
      nowMs,
    })).resolves.toMatchObject({
      allowed: true,
      target: {
        kind: 'site-snapshot',
        versionId: 'new-shell',
        manifestKey: 'sites/workspace_testing/traces/new-shell/index.html',
      },
    });
    await expect(registry.resolveWorkspaceRouteFromD1(db, {
      host: 'internal.consuelohq.com',
      path: '/artifacts',
      nowMs,
    })).resolves.toMatchObject({
      allowed: true,
      target: {
        kind: 'site-snapshot',
        versionId: 'customer-artifact-version',
        manifestKey: 'sites/workspace_internal/artifacts/customer-artifact-version/index.html',
      },
    });
  });

  it('reconciles canonical gateway routes over stale snapshots without replacing published static sites', async () => {
    const registry = await loadWorkspaceRouteD1RegistryContract();
    const db = registry.createInMemoryWorkspaceRouteD1();
    await registry.migrateWorkspaceRouteD1(db);
    const nowMs = Date.parse('2026-08-13T18:00:00.000Z');
    const rootSnapshot = {
      kind: 'site-snapshot' as const,
      siteId: 'launcher',
      versionId: 'sha256-current-sites',
      manifestKey: 'sites/workspace_internal/launcher/sha256-current-sites/index.html',
      cachePolicy: 'static-shell' as const,
    };
    const staleDiffsSnapshot = {
      kind: 'site-snapshot' as const,
      siteId: 'diffs',
      versionId: 'sha256-reserved-diffs',
      manifestKey: 'sites/workspace_internal/diffs/sha256-reserved-diffs/index.html',
      cachePolicy: 'static-shell' as const,
    };
    const nodesSnapshot = {
      kind: 'site-snapshot' as const,
      siteId: 'nodes',
      versionId: rootSnapshot.versionId,
      manifestKey: `sites/workspace_internal/nodes/${rootSnapshot.versionId}/index.html`,
      cachePolicy: 'static-shell' as const,
    };
    const observabilitySnapshot = {
      kind: 'site-snapshot' as const,
      siteId: 'traces',
      versionId: rootSnapshot.versionId,
      manifestKey: `sites/workspace_internal/traces/${rootSnapshot.versionId}/index.html`,
      cachePolicy: 'static-shell' as const,
    };
    const canonicalRecord: WorkspaceRouteD1RecordInput = {
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      hostname: 'internal.consuelohq.com',
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      routes: [
        {
          surface: 'os',
          pathPrefix: '/mcp',
          auth: 'required',
          status: 'active',
          target: {
            kind: 'os-connector',
            connectorId: 'connector_current',
            connectorStatus: 'connected',
            tunnelOriginUrl: 'https://current.connector.test',
          },
        },
        {
          surface: 'sites',
          pathPrefix: '/gateway/diffs',
          auth: 'signed-connector',
          status: 'active',
          target: {
            kind: 'consuelo-gateway-service',
            serviceName: 'diffs-sites-gateway-endpoints',
            gatewayRouteFamily: '/gateway/diffs',
            publicSiteRouteFamily: '/diffs',
          },
        },
        {
          surface: 'sites',
          pathPrefix: '/diffs',
          auth: 'workspace-session',
          status: 'active',
          target: {
            kind: 'consuelo-gateway-service',
            serviceName: 'diffs-sites-gateway-endpoints',
            gatewayRouteFamily: '/gateway/diffs',
            publicSiteRouteFamily: '/diffs',
          },
        },
      ],
    };
    const target = {
      nodeId: 'node-current',
      connectorId: 'connector_current',
      connectorStatus: 'connected' as const,
      tunnelOriginUrl: 'https://current.connector.test',
      state: 'active' as const,
      lastSeenAt: nowMs,
      heartbeatTtlMs: 60_000,
    };

    await registry.upsertWorkspaceHostnameInD1(db, {
      ...canonicalRecord,
      defaultNodeId: 'node-current',
      nodeTargets: [target],
      routes: [
        {
          surface: 'sites',
          pathPrefix: '/',
          auth: 'public',
          status: 'active',
          target: rootSnapshot,
        },
        {
          surface: 'sites',
          pathPrefix: '/diffs',
          auth: 'public',
          status: 'active',
          target: staleDiffsSnapshot,
        },
        {
          surface: 'sites',
          pathPrefix: '/nodes',
          auth: 'workspace-session',
          status: 'active',
          target: nodesSnapshot,
        },
        {
          surface: 'sites',
          pathPrefix: '/observability',
          auth: 'workspace-session',
          status: 'active',
          target: observabilitySnapshot,
        },
      ],
    });

    await registry.upsertWorkspaceNodeTargetInD1(db, {
      record: canonicalRecord,
      target,
      makeDefault: true,
    });
    await registry.upsertWorkspaceNodeTargetInD1(db, {
      record: canonicalRecord,
      target,
      makeDefault: true,
    });

    await expect(
      registry.resolveWorkspaceRouteFromD1(db, {
        host: 'internal.consuelohq.com',
        path: '/diffs',
        nowMs,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      route: '/diffs',
      auth: 'workspace-session',
      target: {
        kind: 'consuelo-gateway-service',
        serviceName: 'diffs-sites-gateway-endpoints',
      },
    });
    await expect(
      registry.resolveWorkspaceRouteFromD1(db, {
        host: 'internal.consuelohq.com',
        path: '/',
        nowMs,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      route: '/',
      target: rootSnapshot,
    });
    await expect(
      registry.resolveWorkspaceRouteFromD1(db, {
        host: 'internal.consuelohq.com',
        path: '/nodes',
        nowMs,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      route: '/nodes',
      target: nodesSnapshot,
    });
    await expect(
      registry.resolveWorkspaceRouteFromD1(db, {
        host: 'internal.consuelohq.com',
        path: '/observability',
        nowMs,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      route: '/observability',
      target: observabilitySnapshot,
    });

    const stored = (await db.dumpHostnameRow?.('internal.consuelohq.com')) as
      | { routes?: Array<{ pathPrefix: string }> }
      | undefined;
    expect(stored?.routes?.filter((route) => route.pathPrefix === '/diffs')).toHaveLength(1);
    expect(stored?.routes?.filter((route) => route.pathPrefix === '/gateway/diffs')).toHaveLength(1);
  });

  it('should update node heartbeat state through a production-shaped prepare-only D1 binding', async () => {
    const registry = await loadWorkspaceRouteD1RegistryContract();
    const fixture = createFixtureCloudflareD1();
    const db: WorkspaceRouteD1Database = { prepare: fixture.prepare };
    const nowMs = Date.parse('2026-07-22T20:00:00.000Z');
    await registry.migrateWorkspaceRouteD1(db);
    await registry.upsertWorkspaceHostnameInD1(db, {
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      hostname: 'kokayi.consuelohq.com',
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      defaultNodeId: 'node_home',
      nodeTargets: [
        {
          nodeId: 'node_home',
          connectorId: 'connector_home',
          connectorStatus: 'connected',
          tunnelOriginUrl: 'https://home.connector.test',
          state: 'active',
          lastSeenAt: nowMs - 300_000,
          heartbeatTtlMs: 60_000,
        },
      ],
      routes: [
        {
          surface: 'os',
          pathPrefix: '/mcp',
          auth: 'required',
          status: 'active',
          target: {
            kind: 'os-connector',
            connectorId: 'connector_home',
            connectorStatus: 'connected',
            tunnelOriginUrl: 'https://home.connector.test',
          },
        },
      ],
    });

    await registry.updateWorkspaceNodeTargetInD1(db, {
      hostname: 'kokayi.consuelohq.com',
      nodeId: 'node_home',
      connectorStatus: 'connected',
      state: 'active',
      lastSeenAt: nowMs,
      heartbeatTtlMs: 60_000,
    });

    await expect(
      registry.resolveWorkspaceRouteFromD1(db, {
        host: 'kokayi.consuelohq.com',
        path: '/mcp',
        nowMs,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      nodeId: 'node_home',
      target: { connectorId: 'connector_home' },
    });
  });

});
