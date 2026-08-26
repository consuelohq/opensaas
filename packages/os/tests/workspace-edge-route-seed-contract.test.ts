import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'vitest';

const runContract =
  process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

type WorkspaceEdgeRouteSeedInput = {
  workspaceId?: string;
  workspaceSlug?: string;
  hostname?: string;
  baseDomain?: string;
  appUpstreamUrl?: string;
  siteSnapshotKey?: string;
  siteVersionId?: string;
  publishedSiteIds?: string[];
  siteContentHashes?: Record<string, string>;
  connectorId?: string;
  tunnelOriginUrl?: string;
  localServiceUrl?: string;
  preserveExistingConnectorState?: boolean;
};

type WorkspaceEdgeRouteSeedContract = {
  createWorkspaceEdgeRouteSeedRecord: (
    input?: WorkspaceEdgeRouteSeedInput,
  ) => unknown;
  createWorkspaceEdgeRouteSeedSql: (input?: WorkspaceEdgeRouteSeedInput) => string;
  createWorkspaceReleaseManagedSiteRefreshSql: (input: {
    versionId: string;
    snapshotWorkspaceId: string;
    siteContentHashes: Record<string, string>;
  }) => string;
};

type WorkspaceEdgeRouteSeedScriptContract = {
  readArg: (name: string) => string | undefined;
};

async function loadWorkspaceEdgeRouteSeedContract(): Promise<WorkspaceEdgeRouteSeedContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'workspace-edge-route-seed.ts'),
  ).href;
  const module = (await import(modulePath)) as Partial<WorkspaceEdgeRouteSeedContract>;
  const missingExports = [
    'createWorkspaceEdgeRouteSeedRecord',
    'createWorkspaceEdgeRouteSeedSql',
    'createWorkspaceReleaseManagedSiteRefreshSql',
  ].filter((name) => typeof module[name as keyof WorkspaceEdgeRouteSeedContract] !== 'function');

  if (missingExports.length > 0) {
    throw new Error(
      `workspace edge route seed module is missing exports: ${missingExports.join(', ')}`,
    );
  }

  return module as WorkspaceEdgeRouteSeedContract;
}

async function loadWorkspaceEdgeRouteSeedScriptContract(): Promise<WorkspaceEdgeRouteSeedScriptContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'seed-workspace-edge-route.ts'),
  ).href;
  const module = (await import(modulePath)) as Partial<WorkspaceEdgeRouteSeedScriptContract>;

  if (typeof module.readArg !== 'function') {
    throw new Error('workspace edge route seed script is missing readArg export');
  }

  return module as WorkspaceEdgeRouteSeedScriptContract;
}

const INTERNAL_SEED_IDENTITY = {
  workspaceId: 'workspace_internal',
  workspaceSlug: 'internal',
  hostname: 'internal.consuelohq.com',
  baseDomain: 'consuelohq.com',
} as const;

contractDescribe('workspace edge route seed contract', () => {
  it('should seed an explicitly named migration host without routing unpublished child Sites', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();
    const record = seed.createWorkspaceEdgeRouteSeedRecord({
      ...INTERNAL_SEED_IDENTITY,
    }) as {
      workspaceId: string;
      workspaceSlug: string;
      hostname: string;
      baseDomain: string;
      provider: string;
      owner: string;
      status: string;
      routes: Array<{ pathPrefix: string; surface: string; auth: string; status: string; target: { kind: string; siteId?: string; manifestKey?: string; versionId?: string; cachePolicy?: string; serviceName?: string; gatewayRouteFamily?: string; publicSiteRouteFamily?: string } }>;
    };

    expect(record).toMatchObject({
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      hostname: 'internal.consuelohq.com',
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
    });
    expect(record.routes.filter((route) => route.status === 'active').map((route) => route.pathPrefix)).toEqual([
      '/',
      '/settings',
      '/gateway/traces/events',
      '/gateway/traces',
      '/gateway/configuration/source-control/github',
      '/gateway/configuration/overlay',
      '/gateway/configuration',
      '/gateway/settings/overlay',
      '/gateway/settings',
      '/gateway/environments/upsert',
      '/gateway/environments/delete',
      '/gateway/environments',
      '/gateway/secrets/install',
      '/gateway/secrets',
      '/artifacts',
      '/gateway/artifacts',
      '/gateway/diffs/write',
      '/gateway/diffs',
      '/diffs',
      '/office',
      '/design-wiki',
    ]);
    expect(record.routes.filter(
      (route) => route.target.kind === 'site-snapshot' && route.status === 'active',
    )).toEqual([
      expect.objectContaining({ pathPrefix: '/', surface: 'sites', auth: 'workspace-session', target: expect.objectContaining({ siteId: 'launcher', versionId: 'seeded-workspace-site-shell', manifestKey: 'sites/workspace_internal/launcher/seeded-workspace-site-shell/index.html', cachePolicy: 'private-preview' }) }),
    ]);
    expect(record.routes.find((route) => route.pathPrefix === '/tools')).toMatchObject({
      status: 'disabled',
      target: { kind: 'site-snapshot', siteId: 'tools' },
    });
    expect(record.routes.find((route) => route.pathPrefix === '/nodes')).toMatchObject({
      status: 'disabled',
      target: { kind: 'site-snapshot', siteId: 'nodes' },
    });
    expect(record.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pathPrefix: '/gateway/traces/events',
        auth: 'workspace-session',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'trace-sites-live-endpoints',
          gatewayRouteFamily: '/gateway/traces/*',
          publicSiteRouteFamily: '/observability/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/traces',
        auth: 'workspace-session',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'trace-sites-read-layer',
          gatewayRouteFamily: '/gateway/traces/*',
          publicSiteRouteFamily: '/observability/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/configuration/source-control/github',
        auth: 'workspace-session',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'configuration-sites-write-endpoints',
          gatewayRouteFamily: '/gateway/configuration/*',
          publicSiteRouteFamily: '/configuration/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/configuration/overlay',
        auth: 'workspace-session',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'configuration-sites-write-endpoints',
          gatewayRouteFamily: '/gateway/configuration/*',
          publicSiteRouteFamily: '/configuration/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/configuration',
        auth: 'workspace-session',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'configuration-sites-read-endpoints',
          gatewayRouteFamily: '/gateway/configuration/*',
          publicSiteRouteFamily: '/configuration/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/settings/overlay',
        auth: 'workspace-session',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'configuration-sites-write-endpoints',
          gatewayRouteFamily: '/gateway/settings/*',
          publicSiteRouteFamily: '/settings/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/settings',
        auth: 'workspace-session',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'configuration-sites-read-endpoints',
          gatewayRouteFamily: '/gateway/settings/*',
          publicSiteRouteFamily: '/settings/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/environments/upsert',
        auth: 'workspace-session',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'environment-sites-write-endpoints',
          gatewayRouteFamily: '/gateway/environments/*',
          publicSiteRouteFamily: '/environments/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/environments/delete',
        auth: 'workspace-session',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'environment-sites-write-endpoints',
          gatewayRouteFamily: '/gateway/environments/*',
          publicSiteRouteFamily: '/environments/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/environments',
        auth: 'workspace-session',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'environment-sites-read-endpoints',
          gatewayRouteFamily: '/gateway/environments/*',
          publicSiteRouteFamily: '/environments/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/settings',
        auth: 'public',
        target: { kind: 'redirect', location: '/configuration', statusCode: 308 },
      }),
      expect.objectContaining({
        pathPrefix: '/artifacts',
        auth: 'workspace-session',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'artifacts-sites-read-layer',
          gatewayRouteFamily: '/gateway/artifacts/*',
          publicSiteRouteFamily: '/artifacts/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/artifacts',
        auth: 'workspace-session',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'artifacts-sites-read-layer',
          gatewayRouteFamily: '/gateway/artifacts/*',
          publicSiteRouteFamily: '/artifacts/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/diffs/write',
        auth: 'workspace-session',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'diffs-sites-write-endpoints',
          gatewayRouteFamily: '/gateway/diffs/*',
          publicSiteRouteFamily: '/diffs/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/diffs',
        auth: 'workspace-session',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'diffs-sites-read-endpoints',
          gatewayRouteFamily: '/gateway/diffs/*',
          publicSiteRouteFamily: '/diffs/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/office',
        auth: 'public',
        target: { kind: 'redirect', location: '/artifacts', statusCode: 308 },
      }),
      expect.objectContaining({
        pathPrefix: '/design-wiki',
        auth: 'public',
        target: { kind: 'redirect', location: '/artifacts', statusCode: 308 },
      }),
    ]));
  });

  it('should route only the Site snapshots explicitly proven published', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();
    const record = seed.createWorkspaceEdgeRouteSeedRecord({
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      hostname: 'internal.consuelohq.com',
      baseDomain: 'consuelohq.com',
      siteSnapshotKey: 'sites/workspace_internal/launcher/sha256-release/index.html',
      siteVersionId: 'sha256-release',
      siteContentHashes: {
        launcher: 'a'.repeat(64),
        tools: 'b'.repeat(64),
      },
      publishedSiteIds: [
        'launcher',
        'artifacts',
        'traces',
        'diffs',
        'docs',
        'configuration',
        'tools',
        'nodes',
        'environments',
        'secrets',
      ],
    }) as {
      routes: Array<{
        pathPrefix: string;
        auth: string;
        target: { kind: string; siteId?: string; manifestKey?: string; versionId?: string; cachePolicy?: string; serviceName?: string };
      }>;
    };

    const snapshotRoutes = record.routes.filter(
      (route) => route.target.kind === 'site-snapshot',
    );
    expect(snapshotRoutes.map((route) => route.pathPrefix)).toEqual([
      '/',
      '/observability',
      '/observability/traces',
      '/traces',
      '/tracing',
      '/trace-burn-intelligence',
      '/docs',
      '/configuration',
      '/tools',
      '/nodes',
      '/environments',
      '/secrets',
    ]);
    expect(record.routes.find((route) => route.pathPrefix === '/artifacts')).toMatchObject({
      auth: 'workspace-session',
      target: {
        kind: 'consuelo-gateway-service',
        serviceName: 'artifacts-sites-read-layer',
      },
    });
    expect(record.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pathPrefix: '/diffs',
        auth: 'workspace-session',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'diffs-sites-read-endpoints',
        }),
      }),
    ]));
    expect(
      snapshotRoutes
        .filter((route) => route.target.siteId === 'traces')
        .map((route) => route.auth),
    ).toEqual(Array(5).fill('workspace-session'));
    expect(
      snapshotRoutes
        .filter((route) => ['launcher', 'traces', 'configuration', 'tools', 'nodes', 'environments', 'secrets'].includes(route.target.siteId ?? ''))
        .every((route) => route.auth === 'workspace-session'),
    ).toBe(true);
    expect(
      snapshotRoutes
        .filter((route) => ['artifacts', 'docs'].includes(route.target.siteId ?? ''))
        .every((route) => route.auth === 'public'),
    ).toBe(true);
    expect(snapshotRoutes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pathPrefix: '/tools',
        target: expect.objectContaining({
          siteId: 'tools',
          manifestKey: 'sites/workspace_internal/tools/sha256-release/index.html',
          contentHash: 'b'.repeat(64),
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/nodes',
        target: expect.objectContaining({
          siteId: 'nodes',
          manifestKey: 'sites/workspace_internal/nodes/sha256-release/index.html',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/environments',
        target: expect.objectContaining({
          siteId: 'environments',
          manifestKey: 'sites/workspace_internal/environments/sha256-release/index.html',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/secrets',
        target: expect.objectContaining({
          siteId: 'secrets',
          manifestKey: 'sites/workspace_internal/secrets/sha256-release/index.html',
        }),
      }),
    ]));
  });

  it('should preserve live node and connector routing when a Site publication updates the hostname row', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();
    const connectorTarget = {
      kind: 'os-connector',
      connectorId: 'connector_primary',
      connectorStatus: 'connected',
      tunnelOriginUrl: 'https://connector-primary.example.test',
    } as const;
    const existingRecord = {
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      hostname: 'internal.consuelohq.com',
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      defaultNodeId: 'node_primary',
      nodeTargets: [{
        nodeId: 'node_primary',
        connectorId: 'connector_primary',
        connectorStatus: 'connected',
        tunnelOriginUrl: 'https://connector-primary.example.test',
        state: 'active',
        lastSeenAt: 1_786_486_000_000,
        heartbeatTtlMs: 90_000,
      }],
      routes: [
        {
          surface: 'os',
          pathPrefix: '/gtm',
          auth: 'workspace-session',
          status: 'active',
          target: connectorTarget,
        },
        {
          surface: 'os',
          pathPrefix: '/mcp',
          auth: 'required',
          status: 'active',
          target: connectorTarget,
        },
      ],
      updatedAt: '2026-08-11T23:00:00.000Z',
    };

    const routeSql = seed.createWorkspaceEdgeRouteSeedSql({
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      hostname: 'internal.consuelohq.com',
      baseDomain: 'consuelohq.com',
      siteSnapshotKey: 'sites/workspace_internal/launcher/sha256-release/index.html',
      siteVersionId: 'sha256-release',
      publishedSiteIds: [
        'launcher',
        'artifacts',
        'traces',
        'diffs',
        'docs',
        'configuration',
        'tools',
        'nodes',
        'environments',
        'secrets',
      ],
    });

    const state = JSON.parse(execFileSync('bun', ['-e', `
      import { Database } from 'bun:sqlite';
      const db = new Database(':memory:');
      db.exec(\`
        CREATE TABLE workspace_route_registry (
          hostname TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          workspace_slug TEXT NOT NULL,
          workspace_host TEXT NOT NULL,
          base_domain TEXT NOT NULL,
          route_path_prefix TEXT NOT NULL,
          route_surface TEXT NOT NULL,
          route_status TEXT NOT NULL,
          route_target_kind TEXT NOT NULL,
          target_origin_url TEXT NOT NULL,
          connector_id TEXT,
          connector_status TEXT,
          record_json TEXT NOT NULL,
          revoked_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      \`);
      const existing = ${JSON.stringify(existingRecord)};
      db.prepare(\`
        INSERT INTO workspace_route_registry (
          hostname, workspace_id, workspace_slug, workspace_host, base_domain,
          route_path_prefix, route_surface, route_status, route_target_kind,
          target_origin_url, connector_id, connector_status, record_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      \`).run(
        existing.hostname,
        existing.workspaceId,
        existing.workspaceSlug,
        existing.hostname,
        existing.baseDomain,
        '/gtm',
        'os',
        'active',
        'os-connector',
        ${JSON.stringify(connectorTarget.tunnelOriginUrl)},
        ${JSON.stringify(connectorTarget.connectorId)},
        ${JSON.stringify(connectorTarget.connectorStatus)},
        JSON.stringify(existing),
      );
      db.exec(${JSON.stringify(routeSql)});
      const row = db.query(\`
        SELECT connector_id, connector_status, record_json
        FROM workspace_route_registry
        WHERE hostname = 'internal.consuelohq.com'
      \`).get();
      process.stdout.write(JSON.stringify(row));
      db.close();
    `], { encoding: 'utf8' })) as {
      connector_id: string | null;
      connector_status: string | null;
      record_json: string;
    };
    const row = state;
    const record = JSON.parse(row.record_json) as {
      defaultNodeId?: string;
      nodeTargets?: Array<{ nodeId: string; lastSeenAt: number }>;
      routes: Array<{ pathPrefix: string; target: { kind: string; versionId?: string } }>;
    };

    expect(row.connector_id).toBe('connector_primary');
    expect(row.connector_status).toBe('connected');
    expect(record.defaultNodeId).toBe('node_primary');
    expect(record.nodeTargets).toEqual([
      expect.objectContaining({ nodeId: 'node_primary', lastSeenAt: 1_786_486_000_000 }),
    ]);
    expect(record.routes.filter((route) => route.pathPrefix === '/gtm')).toHaveLength(1);
    expect(record.routes.filter((route) => route.pathPrefix === '/mcp')).toHaveLength(1);
    expect(record.routes.find((route) => route.pathPrefix === '/trace-burn-intelligence')).toMatchObject({
      target: { kind: 'site-snapshot', versionId: 'sha256-release' },
    });
  });

  it('refreshes only release-managed private site snapshots across existing workspace rows', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE workspace_route_registry (
        hostname TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        workspace_slug TEXT NOT NULL,
        workspace_host TEXT NOT NULL,
        base_domain TEXT NOT NULL,
        route_path_prefix TEXT NOT NULL,
        route_surface TEXT NOT NULL,
        route_status TEXT NOT NULL,
        route_target_kind TEXT NOT NULL,
        target_origin_url TEXT NOT NULL,
        connector_id TEXT,
        connector_status TEXT,
        record_json TEXT NOT NULL,
        revoked_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const record = seed.createWorkspaceEdgeRouteSeedRecord({
      ...INTERNAL_SEED_IDENTITY,
      siteSnapshotKey: 'sites/workspace_testing/launcher/sha256-old/index.html',
      siteVersionId: 'sha256-old',
      publishedSiteIds: [
        'launcher', 'artifacts', 'traces', 'diffs', 'docs',
        'configuration', 'tools', 'nodes', 'environments', 'secrets',
      ],
      connectorId: 'connector_home',
      tunnelOriginUrl: 'https://connector-home.example.test',
    }) as {
      hostname: string;
      workspaceId: string;
      workspaceSlug: string;
      baseDomain: string;
      routes: Array<{
        pathPrefix: string;
        target: {
          kind: string;
          siteId?: string;
          versionId?: string;
          manifestKey?: string;
          htmlKey?: string;
          contentHash?: string;
          connectorId?: string;
        };
      }>;
      defaultNodeId?: string;
      nodeTargets?: Array<Record<string, unknown>>;
    };
    record.defaultNodeId = 'node_home';
    record.nodeTargets = [{
      nodeId: 'node_home',
      connectorId: 'connector_home',
      connectorStatus: 'connected',
      tunnelOriginUrl: 'https://connector-home.example.test',
      state: 'active',
      lastSeenAt: 1_786_473_600_000,
      heartbeatTtlMs: 60_000,
    }];
    for (const route of record.routes) {
      if (route.target.siteId === 'artifacts' || route.target.siteId === 'docs') {
        route.target.versionId = 'sha256-user-published';
        route.target.manifestKey =
          'sites/workspace_internal/' + route.target.siteId + '/sha256-user-published/index.html';
        route.target.htmlKey = route.target.manifestKey;
        route.target.contentHash = 'f'.repeat(64);
      }
    }
    db.query(
      'INSERT INTO workspace_route_registry (' +
        'hostname, workspace_id, workspace_slug, workspace_host, base_domain, ' +
        'route_path_prefix, route_surface, route_status, route_target_kind, ' +
        'target_origin_url, connector_id, connector_status, record_json' +
        ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      record.hostname,
      record.workspaceId,
      record.workspaceSlug,
      record.hostname,
      record.baseDomain,
      '/mcp',
      'os',
      'active',
      'os-connector',
      'https://connector-home.example.test',
      'connector_home',
      'connected',
      JSON.stringify(record),
    );
    const managedSiteIds = [
      'launcher', 'traces', 'configuration', 'tools', 'nodes', 'environments', 'secrets',
    ];
    const siteContentHashes = Object.fromEntries(
      managedSiteIds.map((siteId, index) => [siteId, String(index + 1).repeat(64).slice(0, 64)]),
    );

    db.exec(seed.createWorkspaceReleaseManagedSiteRefreshSql({
      versionId: 'sha256-new-release',
      snapshotWorkspaceId: 'workspace_testing',
      siteContentHashes,
    }));

    const row = db.query<{ record_json: string }, []>(
      "SELECT record_json FROM workspace_route_registry WHERE hostname = 'internal.consuelohq.com'",
    ).get();
    if (!row) throw new Error('refreshed route row was not found');
    const refreshed = JSON.parse(row.record_json) as typeof record;
    expect(refreshed.defaultNodeId).toBe('node_home');
    expect(refreshed.nodeTargets).toEqual([
      expect.objectContaining({ nodeId: 'node_home', connectorId: 'connector_home' }),
    ]);
    expect(refreshed.routes.find((route) => route.pathPrefix === '/mcp')).toMatchObject({
      target: { kind: 'os-connector', connectorId: 'connector_home' },
    });
    for (const siteId of managedSiteIds) {
      expect(refreshed.routes.find((route) => route.target.siteId === siteId)).toMatchObject({
        target: {
          kind: 'site-snapshot',
          siteId,
          versionId: 'sha256-new-release',
          manifestKey: 'sites/workspace_testing/' + siteId + '/sha256-new-release/index.html',
          htmlKey: 'sites/workspace_testing/' + siteId + '/sha256-new-release/index.html',
          contentHash: siteContentHashes[siteId],
        },
      });
    }
    expect(refreshed.routes.find((route) => route.target.siteId === 'docs')).toMatchObject({
      target: {
        siteId: 'docs',
        versionId: 'sha256-user-published',
        manifestKey: 'sites/workspace_internal/docs/sha256-user-published/index.html',
        contentHash: 'f'.repeat(64),
      },
    });
    expect(refreshed.routes.find((route) => route.pathPrefix === '/artifacts')).toMatchObject({
      auth: 'workspace-session',
      target: {
        kind: 'consuelo-gateway-service',
        serviceName: 'artifacts-sites-read-layer',
      },
    });
    expect(refreshed.routes.some((route) => route.target.siteId === 'artifacts')).toBe(false);
    db.close();
  });

  it('should reject invalid publication sets before creating route records', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();

    expect(() => seed.createWorkspaceEdgeRouteSeedRecord({
      ...INTERNAL_SEED_IDENTITY,
      publishedSiteIds: [],
    })).toThrow('workspace edge seed requires a published launcher snapshot');

    expect(() => seed.createWorkspaceEdgeRouteSeedRecord({
      ...INTERNAL_SEED_IDENTITY,
      publishedSiteIds: ['tools'],
    })).toThrow('workspace edge seed requires a published launcher snapshot');

    expect(() => seed.createWorkspaceEdgeRouteSeedRecord({
      ...INTERNAL_SEED_IDENTITY,
      publishedSiteIds: ['launcher', 'not-a-site'],
    })).toThrow('workspace edge seed received unknown Site snapshot: not-a-site');

    expect(() => seed.createWorkspaceEdgeRouteSeedRecord({
      ...INTERNAL_SEED_IDENTITY,
      publishedSiteIds: ['launcher'],
      siteContentHashes: { launcher: 'not-a-sha256' },
    })).toThrow('workspace edge seed received invalid site snapshot content hash');
  });

  it('should reject empty seed identity inputs instead of selecting a default tenant', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();
    expect(() => seed.createWorkspaceEdgeRouteSeedRecord({
      workspaceId: '   ',
      workspaceSlug: '   ',
      hostname: '   ',
      baseDomain: '   ',
      appUpstreamUrl: '   ',
    })).toThrow(/workspace edge seed requires explicit workspace identity/);
  });

  it('should emit D1-safe SQL without secrets and include connector rows only when OS route inputs are provided', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();
    const appOnlySql = seed.createWorkspaceEdgeRouteSeedSql({
      ...INTERNAL_SEED_IDENTITY,
    });

    expect(appOnlySql).toMatch(/INSERT INTO workspace_route_registry/i);
    expect(appOnlySql).toMatch(/ON CONFLICT\(hostname\) DO UPDATE SET/i);
    expect(appOnlySql).not.toMatch(/INSERT OR REPLACE INTO workspace_route_registry/i);
    expect(appOnlySql).toMatch(/json_each\(workspace_route_registry\.record_json/);
    expect(appOnlySql).toMatch(/os-connector/);
    expect(appOnlySql).toMatch(/internal\.consuelohq\.com/);
    expect(appOnlySql).not.toMatch(/workspace_connectors/i);
    expect(appOnlySql).not.toMatch(/api[_-]?key|access[_-]?token|refresh[_-]?token|credential[_-]?value|secret[_-]?value/i);
    expect(appOnlySql.split('\n')).toHaveLength(1);
    expect(appOnlySql).not.toMatch(/INSERT OR REPLACE INTO workspace_route_registry \(\n/);

    const osSql = seed.createWorkspaceEdgeRouteSeedSql({
      ...INTERNAL_SEED_IDENTITY,
      connectorId: '  connector_internal  ',
      tunnelOriginUrl: '  https://c-97c89262e0970bc466db457d4484f366.consuelohq.com  ',
      localServiceUrl: '  http://127.0.0.1:8787  ',
    });

    expect(osSql).toMatch(/INSERT OR REPLACE INTO workspace_connectors/i);
    expect(osSql).toMatch(/connector_internal/);
    expect(osSql.split('\n')).toHaveLength(3);
    for (const statement of osSql.split('\n\n')) {
      expect(statement).toMatch(/;$/);
      expect(statement).not.toContain('\n');
    }
    expect(osSql).toMatch(/http:\/\/127\.0\.0\.1:8787/);
    expect(osSql).toMatch(/\/mcp/);
    expect(osSql).toMatch(/\/gtm/);
    expect(osSql).toMatch(/\/observability/);
    expect(osSql).toMatch(/\/traces/);
    expect(osSql).toMatch(/consuelo-gateway-service/);
    expect(osSql).toMatch(/trace-sites-read-layer/);
    expect(osSql).toMatch(/trace-sites-live-endpoints/);
    expect(osSql).toMatch(/configuration-sites-read-endpoints/);
    expect(osSql).toMatch(/configuration-sites-write-endpoints/);
    expect(osSql).toMatch(/environment-sites-read-endpoints/);
    expect(osSql).toMatch(/environment-sites-write-endpoints/);
    expect(osSql).not.toMatch(/  connector_internal  /);
    expect(osSql).not.toMatch(/api[_-]?key|access[_-]?token|refresh[_-]?token|credential[_-]?value|secret[_-]?value/i);
    expect(osSql).not.toMatch(/"pathPrefix":"\/traces"[^}]+"kind":"os-connector"/);

    const record = seed.createWorkspaceEdgeRouteSeedRecord({
      hostname: 'acme.consuelohq.com',
      workspaceId: 'workspace_acme',
      workspaceSlug: 'acme',
      baseDomain: 'consuelohq.com',
      connectorId: 'connector_acme',
      tunnelOriginUrl: 'https://connector-acme.example.test',
    }) as { routes: Array<{ pathPrefix: string; auth: string; target: { kind: string; connectorId?: string } }> };
    const gtmIndex = record.routes.findIndex((route) => route.pathPrefix === '/gtm');
    const mcpIndex = record.routes.findIndex((route) => route.pathPrefix === '/mcp');
    const launcherIndex = record.routes.findIndex((route) => route.pathPrefix === '/');
    expect(record.routes[gtmIndex]).toMatchObject({
      pathPrefix: '/gtm',
      auth: 'workspace-session',
      target: { kind: 'os-connector', connectorId: 'connector_acme' },
    });
    expect(gtmIndex).toBeGreaterThanOrEqual(0);
    expect(gtmIndex).toBeLessThan(mcpIndex);
    expect(gtmIndex).toBeLessThan(launcherIndex);
  });

  it('should preserve connector routes and node targets when a Sites-only seed refreshes the hostname', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE workspace_connectors (
        connector_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        workspace_host TEXT NOT NULL,
        transport TEXT NOT NULL,
        local_service_url TEXT NOT NULL,
        connector_status TEXT NOT NULL,
        revoked_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE workspace_route_registry (
        hostname TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        workspace_slug TEXT NOT NULL,
        workspace_host TEXT NOT NULL,
        base_domain TEXT NOT NULL,
        route_path_prefix TEXT NOT NULL,
        route_surface TEXT NOT NULL,
        route_status TEXT NOT NULL,
        route_target_kind TEXT NOT NULL,
        target_origin_url TEXT NOT NULL,
        connector_id TEXT,
        connector_status TEXT,
        record_json TEXT NOT NULL,
        revoked_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.exec(seed.createWorkspaceEdgeRouteSeedSql({
      ...INTERNAL_SEED_IDENTITY,
      connectorId: 'connector_home',
      tunnelOriginUrl: 'https://connector-home.example.test',
      localServiceUrl: 'http://127.0.0.1:46320',
    }));
    const initialRow = db
      .query<{ record_json: string }, []>(
        'SELECT record_json FROM workspace_route_registry WHERE hostname = \'internal.consuelohq.com\'',
      )
      .get();
    if (!initialRow) throw new Error('initial route row was not created');
    const initialRecord = JSON.parse(initialRow.record_json) as Record<string, unknown>;
    initialRecord.defaultNodeId = 'node_home';
    initialRecord.nodeTargets = [
      {
        nodeId: 'node_home',
        connectorId: 'connector_home',
        connectorStatus: 'connected',
        tunnelOriginUrl: 'https://connector-home.example.test',
        state: 'active',
        lastSeenAt: 1_786_473_600_000,
        heartbeatTtlMs: 60_000,
      },
    ];
    db.query(
      'UPDATE workspace_route_registry SET record_json = ? WHERE hostname = ?',
    ).run(JSON.stringify(initialRecord), 'internal.consuelohq.com');

    db.exec(seed.createWorkspaceEdgeRouteSeedSql({
      ...INTERNAL_SEED_IDENTITY,
      siteSnapshotKey:
        'sites/workspace_internal/launcher/sha256-sites-refresh/index.html',
      siteVersionId: 'sha256-sites-refresh',
      preserveExistingConnectorState: true,
    }));

    const refreshedRow = db
      .query<{
        connector_id: string | null;
        connector_status: string | null;
        record_json: string;
      }, []>(
        'SELECT connector_id, connector_status, record_json FROM workspace_route_registry WHERE hostname = \'internal.consuelohq.com\'',
      )
      .get();
    if (!refreshedRow) throw new Error('refreshed route row was not created');
    const refreshedRecord = JSON.parse(refreshedRow.record_json) as {
      defaultNodeId?: string;
      nodeTargets?: Array<{ nodeId: string; connectorId: string }>;
      routes: Array<{
        pathPrefix: string;
        target: { kind: string; connectorId?: string; versionId?: string };
      }>;
    };
    expect(refreshedRow.connector_id).toBe('connector_home');
    expect(refreshedRow.connector_status).toBe('connected');
    expect(refreshedRecord.defaultNodeId).toBe('node_home');
    expect(refreshedRecord.nodeTargets).toEqual([
      expect.objectContaining({
        nodeId: 'node_home',
        connectorId: 'connector_home',
      }),
    ]);
    expect(refreshedRecord.routes.find((route) => route.pathPrefix === '/mcp')).toMatchObject({
      target: {
        kind: 'os-connector',
        connectorId: 'connector_home',
      },
    });
    expect(refreshedRecord.routes.find((route) => route.pathPrefix === '/')).toMatchObject({
      target: {
        kind: 'site-snapshot',
        versionId: 'sha256-sites-refresh',
      },
    });
  });

  it('should ignore incomplete connector inputs instead of persisting empty connector routes', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();
    const osSql = seed.createWorkspaceEdgeRouteSeedSql({
      ...INTERNAL_SEED_IDENTITY,
      connectorId: '   ',
      tunnelOriginUrl: 'https://c-97c89262e0970bc466db457d4484f366.consuelohq.com',
    });

    expect(osSql).not.toMatch(/INSERT OR REPLACE INTO workspace_connectors/i);
    expect(osSql).not.toContain('"kind":"os-connector"');
  });

  it('should parse CLI flag values only when the next token is a value', async () => {
    const { readArg } = await loadWorkspaceEdgeRouteSeedScriptContract();
    const originalArgv = process.argv;

    try {
      process.argv = [
        'bun',
        'seed-workspace-edge-route.ts',
        '--workspace-host',
        '--connector-id',
        'connector_internal',
        '--base-domain',
      ];

      expect(readArg('--workspace-host')).toBeUndefined();
      expect(readArg('--connector-id')).toBe('connector_internal');
      expect(readArg('--base-domain')).toBeUndefined();
      expect(readArg('--missing')).toBeUndefined();
    } finally {
      process.argv = originalArgv;
    }
  });
});
