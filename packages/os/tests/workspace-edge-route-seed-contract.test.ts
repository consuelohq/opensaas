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
      '/office',
      '/observability',
      '/traces',
      '/tracing',
      '/diffs',
      '/docs',
      '/settings',
      '/gateway/traces/events',
      '/gateway/traces',
    ]);
    expect(record.routes.filter((route) => route.target.kind === 'site-snapshot')).toEqual(expect.arrayContaining([
      expect.objectContaining({ pathPrefix: '/', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'launcher', versionId: 'seeded-workspace-site-shell', manifestKey: 'sites/workspace_internal/launcher/seeded-workspace-site-shell/index.html', cachePolicy: 'static-shell' }) }),
      expect.objectContaining({ pathPrefix: '/office', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'office', manifestKey: 'sites/workspace_internal/office/seeded-workspace-site-shell/index.html' }) }),
      expect.objectContaining({ pathPrefix: '/observability', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'traces', manifestKey: 'sites/workspace_internal/traces/seeded-workspace-site-shell/index.html' }) }),
      expect.objectContaining({ pathPrefix: '/traces', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'traces', manifestKey: 'sites/workspace_internal/traces/seeded-workspace-site-shell/index.html' }) }),
      expect.objectContaining({ pathPrefix: '/tracing', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'traces', manifestKey: 'sites/workspace_internal/traces/seeded-workspace-site-shell/index.html' }) }),
      expect.objectContaining({ pathPrefix: '/diffs', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'diffs', manifestKey: 'sites/workspace_internal/diffs/seeded-workspace-site-shell/index.html' }) }),
      expect.objectContaining({ pathPrefix: '/docs', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'docs', manifestKey: 'sites/workspace_internal/docs/seeded-workspace-site-shell/index.html' }) }),
      expect.objectContaining({ pathPrefix: '/settings', surface: 'sites', auth: 'public', target: expect.objectContaining({ siteId: 'settings', manifestKey: 'sites/workspace_internal/settings/seeded-workspace-site-shell/index.html' }) }),
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
    expect(appOnlySql).not.toMatch(/token|credential|secret/i);
    expect(appOnlySql.split('\n')).toHaveLength(1);
    expect(appOnlySql).not.toMatch(/INSERT OR REPLACE INTO workspace_route_registry \(\n/);

    const osSql = seed.createWorkspaceEdgeRouteSeedSql({
      connectorId: '  connector_internal  ',
      tunnelOriginUrl: '  https://connector-internal.os-origin.consuelohq.com  ',
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
    expect(osSql).toMatch(/\/observability/);
    expect(osSql).toMatch(/\/traces/);
    expect(osSql).toMatch(/consuelo-gateway-service/);
    expect(osSql).toMatch(/trace-sites-read-layer/);
    expect(osSql).toMatch(/trace-sites-live-endpoints/);
    expect(osSql).not.toMatch(/  connector_internal  /);
    expect(osSql).not.toMatch(/token|credential|secret/i);
    expect(osSql).not.toMatch(/"pathPrefix":"\/traces"[^}]+"kind":"os-connector"/);
  });

  it('should ignore incomplete connector inputs instead of persisting empty connector routes', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();
    const osSql = seed.createWorkspaceEdgeRouteSeedSql({
      connectorId: '   ',
      tunnelOriginUrl: 'https://connector-internal.os-origin.consuelohq.com',
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
