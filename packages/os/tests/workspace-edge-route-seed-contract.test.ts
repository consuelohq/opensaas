import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

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
  connectorId?: string;
  tunnelOriginUrl?: string;
  localServiceUrl?: string;
};

type WorkspaceEdgeRouteSeedContract = {
  createWorkspaceEdgeRouteSeedRecord: (
    input?: WorkspaceEdgeRouteSeedInput,
  ) => unknown;
  createWorkspaceEdgeRouteSeedSql: (input?: WorkspaceEdgeRouteSeedInput) => string;
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

contractDescribe('workspace edge route seed contract', () => {
  it('should default the migration host to internal.consuelohq.com and route Sites shells plus Trace gateway routes', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();
    const record = seed.createWorkspaceEdgeRouteSeedRecord() as {
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
    expect(record.routes.map((route) => route.pathPrefix)).toEqual([
      '/',
      '/artifacts',
      '/observability',
      '/traces',
      '/tracing',
      '/diffs',
      '/docs',
      '/configuration',
      '/tools',
      '/environments',
      '/secrets',
      '/settings',
      '/gateway/traces/events',
      '/gateway/traces',
      '/gateway/configuration/overlay',
      '/gateway/configuration',
      '/gateway/settings/overlay',
      '/gateway/settings',
      '/gateway/environments/upsert',
      '/gateway/environments/delete',
      '/gateway/environments',
      '/gateway/artifacts',
      '/office',
      '/design-wiki',
    ]);
    expect(record.routes.filter((route) => route.target.kind === 'site-snapshot')).toEqual(expect.arrayContaining([
      expect.objectContaining({ pathPrefix: '/', surface: 'sites', auth: 'workspace-session', target: expect.objectContaining({ siteId: 'launcher', versionId: 'seeded-workspace-site-shell', manifestKey: 'sites/workspace_internal/launcher/seeded-workspace-site-shell/index.html', cachePolicy: 'private-preview' }) }),
      expect.objectContaining({ pathPrefix: '/artifacts', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'artifacts', manifestKey: 'sites/workspace_internal/artifacts/seeded-workspace-site-shell/index.html' }) }),
      expect.objectContaining({ pathPrefix: '/observability', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'traces', manifestKey: 'sites/workspace_internal/traces/seeded-workspace-site-shell/index.html' }) }),
      expect.objectContaining({ pathPrefix: '/traces', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'traces', manifestKey: 'sites/workspace_internal/traces/seeded-workspace-site-shell/index.html' }) }),
      expect.objectContaining({ pathPrefix: '/tracing', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'traces', manifestKey: 'sites/workspace_internal/traces/seeded-workspace-site-shell/index.html' }) }),
      expect.objectContaining({ pathPrefix: '/diffs', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'diffs', manifestKey: 'sites/workspace_internal/diffs/seeded-workspace-site-shell/index.html' }) }),
      expect.objectContaining({ pathPrefix: '/docs', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'docs', manifestKey: 'sites/workspace_internal/docs/seeded-workspace-site-shell/index.html' }) }),
      expect.objectContaining({ pathPrefix: '/configuration', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'configuration', manifestKey: 'sites/workspace_internal/configuration/seeded-workspace-site-shell/index.html' }) }),
      expect.objectContaining({ pathPrefix: '/tools', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'tools', manifestKey: 'sites/workspace_internal/tools/seeded-workspace-site-shell/index.html' }) }),
      expect.objectContaining({ pathPrefix: '/environments', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'environments', manifestKey: 'sites/workspace_internal/environments/seeded-workspace-site-shell/index.html' }) }),
      expect.objectContaining({ pathPrefix: '/secrets', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'secrets', manifestKey: 'sites/workspace_internal/secrets/seeded-workspace-site-shell/index.html' }) }),
    ]));
    expect(record.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pathPrefix: '/gateway/traces/events',
        auth: 'required',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'trace-sites-live-endpoints',
          gatewayRouteFamily: '/gateway/traces/*',
          publicSiteRouteFamily: '/observability/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/traces',
        auth: 'required',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'trace-sites-read-layer',
          gatewayRouteFamily: '/gateway/traces/*',
          publicSiteRouteFamily: '/observability/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/configuration/overlay',
        auth: 'required',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'configuration-sites-write-endpoints',
          gatewayRouteFamily: '/gateway/configuration/*',
          publicSiteRouteFamily: '/configuration/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/configuration',
        auth: 'required',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'configuration-sites-read-endpoints',
          gatewayRouteFamily: '/gateway/configuration/*',
          publicSiteRouteFamily: '/configuration/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/settings/overlay',
        auth: 'required',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'configuration-sites-write-endpoints',
          gatewayRouteFamily: '/gateway/settings/*',
          publicSiteRouteFamily: '/settings/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/settings',
        auth: 'required',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'configuration-sites-read-endpoints',
          gatewayRouteFamily: '/gateway/settings/*',
          publicSiteRouteFamily: '/settings/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/environments/upsert',
        auth: 'required',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'environment-sites-write-endpoints',
          gatewayRouteFamily: '/gateway/environments/*',
          publicSiteRouteFamily: '/environments/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/environments/delete',
        auth: 'required',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'environment-sites-write-endpoints',
          gatewayRouteFamily: '/gateway/environments/*',
          publicSiteRouteFamily: '/environments/*',
        }),
      }),
      expect.objectContaining({
        pathPrefix: '/gateway/environments',
        auth: 'required',
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
        pathPrefix: '/gateway/artifacts',
        auth: 'required',
        target: expect.objectContaining({
          kind: 'consuelo-gateway-service',
          serviceName: 'artifacts-sites-read-layer',
          gatewayRouteFamily: '/gateway/artifacts/*',
          publicSiteRouteFamily: '/artifacts/*',
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

  it('should replace empty seed identity inputs with defaults before normalization', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();
    const record = seed.createWorkspaceEdgeRouteSeedRecord({
      workspaceId: '   ',
      workspaceSlug: '   ',
      hostname: '   ',
      baseDomain: '   ',
      appUpstreamUrl: '   ',
    });

    expect(record).toMatchObject({
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      hostname: 'internal.consuelohq.com',
      baseDomain: 'consuelohq.com',
    });
    expect((record as { routes: Array<{ pathPrefix: string; surface: string; target: { kind: string; manifestKey?: string } }> }).routes.find((route) => route.pathPrefix === '/')).toMatchObject({
      surface: 'sites',
      target: {
        kind: 'site-snapshot',
        manifestKey: 'sites/workspace_internal/launcher/seeded-workspace-site-shell/index.html',
      },
    });
  });

  it('should emit D1-safe SQL without secrets and include connector rows only when OS route inputs are provided', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();
    const appOnlySql = seed.createWorkspaceEdgeRouteSeedSql();

    expect(appOnlySql).toMatch(/INSERT OR REPLACE INTO workspace_route_registry/i);
    expect(appOnlySql).toMatch(/internal\.consuelohq\.com/);
    expect(appOnlySql).not.toMatch(/workspace_connectors/i);
    expect(appOnlySql).not.toMatch(/api[_-]?key|access[_-]?token|refresh[_-]?token|credential[_-]?value|secret[_-]?value/i);
    expect(appOnlySql.split('\n')).toHaveLength(1);
    expect(appOnlySql).not.toMatch(/INSERT OR REPLACE INTO workspace_route_registry \(\n/);

    const osSql = seed.createWorkspaceEdgeRouteSeedSql({
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

  it('should ignore incomplete connector inputs instead of persisting empty connector routes', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();
    const osSql = seed.createWorkspaceEdgeRouteSeedSql({
      connectorId: '   ',
      tunnelOriginUrl: 'https://c-97c89262e0970bc466db457d4484f366.consuelohq.com',
    });

    expect(osSql).not.toMatch(/INSERT OR REPLACE INTO workspace_connectors/i);
    expect(osSql).not.toMatch(/os-connector/);
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
