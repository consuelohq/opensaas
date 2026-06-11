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
    };

type WorkspaceRouteD1Route = {
  surface: 'os' | 'dialer' | 'app' | 'sites' | 'twenty';
  pathPrefix: string;
  auth: 'required';
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
  routes: WorkspaceRouteD1Route[];
};

type WorkspaceRouteD1ResolutionInput = {
  host: string;
  path: string;
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
          if (/insert/i.test(sql)) {
            rows.set(String(values[0]), {
              hostname: values[0],
              record_json: values[1],
              status: values[2],
              updated_at: values[3],
              revoked_at: values[4] ?? null,
              revocation_reason: values[5] ?? null,
            });
          } else if (/update/i.test(sql)) {
            const existing = rows.get(String(values[0]));

            if (existing) {
              rows.set(String(values[0]), {
                ...existing,
                record_json: values[1],
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
            tunnelOriginUrl: 'https://connector-123.os-origin.consuelohq.com',
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
            tunnelOriginUrl: 'https://connector-123.os-origin.consuelohq.com',
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
            tunnelOriginUrl: 'https://connector-123.os-origin.consuelohq.com',
          },
        },
      ],
    });

    const row = await db.dumpHostnameRow('kokayi.consuelohq.com');

    expect(JSON.stringify(row)).not.toMatch(/tunnelCredential|credential_fixture|client_secret/i);
  });
});
