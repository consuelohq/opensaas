import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path, { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

const runContract = process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

type SiteSnapshotTarget = {
  kind: 'site-snapshot';
  siteId: string;
  versionId: string;
  manifestKey: string;
  htmlKey?: string;
  contentType?: string;
  cachePolicy: 'static-shell' | 'versioned-asset' | 'mutable-artifact' | 'private-preview';
};

type OsConnectorTarget = {
  kind: 'os-connector';
  connectorId: string;
  connectorStatus: 'connected' | 'disconnected';
  tunnelOriginUrl: string;
};

type ServiceUpstreamTarget = {
  kind: 'service-upstream';
  service: 'dialer' | 'app' | 'sites' | 'twenty';
  upstreamUrl: string;
};

type RedirectTarget = {
  kind: 'redirect';
  location: string;
  statusCode: 301 | 302 | 307 | 308;
};

type ConsueloGatewayServiceTarget = {
  kind: 'consuelo-gateway-service';
  serviceName:
    | 'trace-sites-read-layer'
    | 'trace-sites-live-endpoints'
    | 'configuration-sites-read-endpoints'
    | 'configuration-sites-write-endpoints'
    | 'settings-sites-read-endpoints'
    | 'settings-sites-write-endpoints'
    | (string & {});
  gatewayRouteFamily: '/gateway/traces/*' | '/gateway/configuration/*' | '/gateway/settings/*' | (string & {});
  publicSiteRouteFamily: '/observability/*' | '/configuration/*' | '/settings/*' | (string & {});
};

type RouteTarget = SiteSnapshotTarget | OsConnectorTarget | ServiceUpstreamTarget | RedirectTarget | ConsueloGatewayServiceTarget;

type WorkspaceRoute = {
  surface: 'os' | 'dialer' | 'app' | 'sites' | 'twenty';
  pathPrefix: string;
  auth: 'public' | 'required' | 'workspace-session' | 'signed-connector';
  status: 'active' | 'disabled';
  target: RouteTarget;
};

type WorkspaceRouteRecord = {
  workspaceId: string;
  workspaceSlug: string;
  hostname: string;
  baseDomain: string;
  provider: 'cloudflare';
  owner: 'consuelo-os-cloud';
  status: 'active' | 'revoked';
  routes: WorkspaceRoute[];
};

type RouteResolution =
  | {
      allowed: true;
      workspaceId: string;
      hostname: string;
      route: string;
      surface: WorkspaceRoute['surface'];
      auth: WorkspaceRoute['auth'];
      auditEvent: 'workspace.hostname.route.allowed';
      target: RouteTarget;
    }
  | { allowed: false; status: 404 | 503; errorCode: string; auditEvent: 'workspace.hostname.route.denied' };

type D1Database = {
  dumpHostnameRow?: (hostname: string) => Promise<unknown>;
};

type D1RegistryContract = {
  createInMemoryWorkspaceRouteD1: () => D1Database;
  migrateWorkspaceRouteD1: (db: D1Database) => Promise<void>;
  upsertWorkspaceHostnameInD1: (db: D1Database, input: WorkspaceRouteRecord) => Promise<void>;
  resolveWorkspaceRouteFromD1: (db: D1Database, input: { host: string; path: string }) => Promise<RouteResolution>;
  createWorkspaceCloudflareD1RouteRegistry: (db: D1Database) => {
    resolve: (input: { host: string; path: string; method: string }) => Promise<RouteResolution>;
  };
};

type EdgeRouterContract = {
  createWorkspaceCloudflareEdgeRouter: (input: {
    registry: { resolve: (input: { host: string; path: string; method: string }) => Promise<RouteResolution> };
    internalSigningSecret?: string;
    siteSnapshots?: {
      cache?: { match: (request: Request) => Promise<Response | null>; put: (request: Request, response: Response) => Promise<void> };
      r2?: { get: (key: string) => Promise<{ text: () => Promise<string> } | null> };
    };
    fetchUpstream?: (request: Request) => Promise<Response>;
  }) => { fetch: (request: Request) => Promise<Response> };
};

type EdgeRouteSeedContract = {
  createWorkspaceEdgeRouteSeedRecord: (input?: {
    workspaceId?: string;
    workspaceSlug?: string;
    hostname?: string;
    baseDomain?: string;
    connectorId?: string;
    tunnelOriginUrl?: string;
    publishedSiteIds?: string[];
  }) => WorkspaceRouteRecord & { updatedAt: string };
};

type TraceAdapterContract = {
  CONSUELO_TRACE_SITE_SERVICE_REGISTRATIONS: Array<{
    site: string;
    capability: string;
    serviceName: string;
    gatewayServiceName: string;
    publicSiteRouteFamily: string;
    gatewayRouteFamily: string;
    publicBoundary: string;
  }>;
};

type ConfigurationAdapterContract = {
  CONSUELO_CONFIGURATION_SITE_SERVICE_REGISTRATIONS: Array<{
    site: string;
    capability: string;
    serviceName: string;
    gatewayServiceName: string;
    publicSiteRouteFamily: string;
    gatewayRouteFamily: string;
    publicBoundary: string;
  }>;
};

type EnvironmentAdapterContract = {
  CONSUELO_ENVIRONMENT_SITE_SERVICE_REGISTRATIONS: Array<{
    site: string;
    capability: string;
    serviceName: string;
    gatewayServiceName: string;
    publicSiteRouteFamily: string;
    gatewayRouteFamily: string;
    publicBoundary: string;
  }>;
};

type InstallPublisherContract = {
  createWorkspaceEdgeSnapshotPlan: (input: {
    home: string;
    workspaceId: string;
    workspaceSlug: string;
    workspaceHost: string;
    now?: string;
  }) => { versionId: string; routeSql: string; verifyUrl: string; verifiedUrls: string[]; snapshots: Array<{ siteId: string; snapshotKey: string; snapshotPath: string; verifyUrl: string; contentHash: string }> };
  publishWorkspaceEdgeSnapshot: (input: {
    home: string;
    workspaceId: string;
    workspaceSlug: string;
    workspaceHost: string;
    now?: string;
    commandRunner?: (command: { argv: string[]; cwd?: string }) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
    fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  }) => Promise<{ status: 'succeeded'; verifyUrl: string; verifiedUrls: string[]; versionId: string; snapshots: Array<{ siteId: string; snapshotKey: string; snapshotPath: string; verifyUrl: string; contentHash: string }> }>;
};

const forbiddenBrowserLeakPattern = /local trace db|local-trace-db|local agent|local-agent|cloud runner|cloud-runner|trace file|trace-store-file|raw internal service|raw-trace-service|implementation path|implementationPath|backend target|backendTarget|directBackendTarget|tunnelOriginUrl|upstreamUrl|sqlite|\.db/i;

async function importModule<T>(relativePath: string): Promise<T> {
  const href = pathToFileURL(join(process.cwd(), relativePath)).href;
  return (await import(href)) as T;
}
function signInternalEdgeRequest(input: {
  secret: string;
  method: string;
  pathWithSearch: string;
  workspaceId: string;
  surface: string;
  timestamp: string;
  nonce: string;
}): string {
  const canonical = [
    input.method.toUpperCase(),
    input.pathWithSearch,
    input.workspaceId,
    input.surface,
    input.timestamp,
    input.nonce,
  ].join('\n');

  return `sha256=${createHmac('sha256', input.secret).update(canonical).digest('hex')}`;
}

function makeHome(html = '<!doctype html><title>Trace shell</title><main>Hosted Trace Site shell</main>') {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-edge-sites-gateway-'));
  const sitePaths = [
    ['index.html'],
    ['artifacts', 'index.html'],
    ['traces', 'index.html'],
    ['diffs', 'index.html'],
    ['docs', 'index.html'],
    ['configuration', 'index.html'],
    ['tools', 'index.html'],
    ['environments', 'index.html'],
    ['secrets', 'index.html'],
  ];
  for (const sitePath of sitePaths) {
    const filePath = path.join(home, 'sites', ...sitePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, html, 'utf8');
  }
  return home;
}

function siteSnapshotTarget(siteId: 'launcher' | 'artifacts' | 'traces' | 'diffs' | 'docs' | 'configuration' | 'tools' | 'environments' | 'secrets' = 'launcher'): SiteSnapshotTarget {
  return {
    kind: 'site-snapshot',
    siteId,
    versionId: 'version_trace_shell',
    manifestKey: `sites/workspace_internal/${siteId}/version_trace_shell/index.html`,
    contentType: 'text/html; charset=utf-8',
    cachePolicy: 'static-shell',
  };
}

function gatewayReadTarget(): ConsueloGatewayServiceTarget {
  return {
    kind: 'consuelo-gateway-service',
    serviceName: 'trace-sites-read-layer',
    gatewayRouteFamily: '/gateway/traces/*',
    publicSiteRouteFamily: '/observability/*',
  };
}

function gatewayLiveTarget(): ConsueloGatewayServiceTarget {
  return {
    kind: 'consuelo-gateway-service',
    serviceName: 'trace-sites-live-endpoints',
    gatewayRouteFamily: '/gateway/traces/*',
    publicSiteRouteFamily: '/observability/*',
  };
}

function gatewayConfigurationReadTarget(): ConsueloGatewayServiceTarget {
  return {
    kind: 'consuelo-gateway-service',
    serviceName: 'configuration-sites-read-endpoints',
    gatewayRouteFamily: '/gateway/configuration/*',
    publicSiteRouteFamily: '/configuration/*',
  };
}

function gatewayConfigurationWriteTarget(): ConsueloGatewayServiceTarget {
  return {
    kind: 'consuelo-gateway-service',
    serviceName: 'configuration-sites-write-endpoints',
    gatewayRouteFamily: '/gateway/configuration/*',
    publicSiteRouteFamily: '/configuration/*',
  };
}

function gatewayLegacySettingsReadTarget(): ConsueloGatewayServiceTarget {
  return {
    kind: 'consuelo-gateway-service',
    serviceName: 'configuration-sites-read-endpoints',
    gatewayRouteFamily: '/gateway/settings/*',
    publicSiteRouteFamily: '/settings/*',
  };
}

function gatewayLegacySettingsWriteTarget(): ConsueloGatewayServiceTarget {
  return {
    kind: 'consuelo-gateway-service',
    serviceName: 'configuration-sites-write-endpoints',
    gatewayRouteFamily: '/gateway/settings/*',
    publicSiteRouteFamily: '/settings/*',
  };
}

function gatewayEnvironmentReadTarget(): ConsueloGatewayServiceTarget {
  return {
    kind: 'consuelo-gateway-service',
    serviceName: 'environment-sites-read-endpoints',
    gatewayRouteFamily: '/gateway/environments/*',
    publicSiteRouteFamily: '/environments/*',
  };
}

function gatewayEnvironmentWriteTarget(): ConsueloGatewayServiceTarget {
  return {
    kind: 'consuelo-gateway-service',
    serviceName: 'environment-sites-write-endpoints',
    gatewayRouteFamily: '/gateway/environments/*',
    publicSiteRouteFamily: '/environments/*',
  };
}

function integratedRouteRecord(): WorkspaceRouteRecord {
  return {
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
          connectorId: 'connector_internal',
          connectorStatus: 'connected',
          tunnelOriginUrl: 'https://c-97c89262e0970bc466db457d4484f366.consuelohq.com',
        },
      },
      {
        surface: 'sites',
        pathPrefix: '/',
        auth: 'workspace-session',
        status: 'active',
        target: {
          ...siteSnapshotTarget('launcher'),
          cachePolicy: 'private-preview',
        },
      },
      { surface: 'sites', pathPrefix: '/artifacts', auth: 'public', status: 'active', target: siteSnapshotTarget('artifacts') },
      { surface: 'sites', pathPrefix: '/traces', auth: 'public', status: 'active', target: siteSnapshotTarget('traces') },
      { surface: 'sites', pathPrefix: '/tracing', auth: 'public', status: 'active', target: siteSnapshotTarget('traces') },
      { surface: 'sites', pathPrefix: '/diffs', auth: 'public', status: 'active', target: siteSnapshotTarget('diffs') },
      { surface: 'sites', pathPrefix: '/docs', auth: 'public', status: 'active', target: siteSnapshotTarget('docs') },
      { surface: 'sites', pathPrefix: '/configuration', auth: 'public', status: 'active', target: siteSnapshotTarget('configuration') },
      { surface: 'sites', pathPrefix: '/tools', auth: 'public', status: 'active', target: siteSnapshotTarget('tools') },
      { surface: 'sites', pathPrefix: '/environments', auth: 'public', status: 'active', target: siteSnapshotTarget('environments') },
      { surface: 'sites', pathPrefix: '/secrets', auth: 'public', status: 'active', target: siteSnapshotTarget('secrets') },
      { surface: 'sites', pathPrefix: '/settings', auth: 'public', status: 'active', target: { kind: 'redirect', location: '/configuration', statusCode: 308 } },
      { surface: 'sites', pathPrefix: '/gateway/traces/events', auth: 'workspace-session', status: 'active', target: gatewayLiveTarget() },
      { surface: 'sites', pathPrefix: '/gateway/traces', auth: 'workspace-session', status: 'active', target: gatewayReadTarget() },
      { surface: 'sites', pathPrefix: '/gateway/configuration/overlay', auth: 'workspace-session', status: 'active', target: gatewayConfigurationWriteTarget() },
      { surface: 'sites', pathPrefix: '/gateway/configuration', auth: 'workspace-session', status: 'active', target: gatewayConfigurationReadTarget() },
      { surface: 'sites', pathPrefix: '/gateway/settings/overlay', auth: 'workspace-session', status: 'active', target: gatewayLegacySettingsWriteTarget() },
      { surface: 'sites', pathPrefix: '/gateway/settings', auth: 'workspace-session', status: 'active', target: gatewayLegacySettingsReadTarget() },
      { surface: 'sites', pathPrefix: '/gateway/environments/upsert', auth: 'workspace-session', status: 'active', target: gatewayEnvironmentWriteTarget() },
      { surface: 'sites', pathPrefix: '/gateway/environments/delete', auth: 'workspace-session', status: 'active', target: gatewayEnvironmentWriteTarget() },
      { surface: 'sites', pathPrefix: '/gateway/environments', auth: 'workspace-session', status: 'active', target: gatewayEnvironmentReadTarget() },
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
  };
}

contractDescribe('workspace edge Sites snapshot and Consuelo Sites Gateway integration', () => {
  it('should keep the integrated route fixture aligned with the authenticated launcher and GTM contract', () => {
    const record = integratedRouteRecord();

    expect(record.routes.find((route) => route.pathPrefix === '/')).toMatchObject({
      surface: 'sites',
      auth: 'workspace-session',
      target: {
        kind: 'site-snapshot',
        siteId: 'launcher',
        cachePolicy: 'private-preview',
      },
    });
    expect(record.routes.find((route) => route.pathPrefix === '/gtm')).toMatchObject({
      surface: 'os',
      auth: 'workspace-session',
      target: {
        kind: 'os-connector',
        connectorId: 'connector_internal',
      },
    });
    expect(
      record.routes.findIndex((route) => route.pathPrefix === '/gtm'),
    ).toBeLessThan(record.routes.findIndex((route) => route.pathPrefix === '/'));
  });

  it('should seed workspace routes with Trace as a Site shell and Gateway as the data boundary when connector inputs exist', async () => {
    const seed = await importModule<EdgeRouteSeedContract>('scripts/lib/workspace-edge-route-seed.ts');

    const record = seed.createWorkspaceEdgeRouteSeedRecord({
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      hostname: 'internal.consuelohq.com',
      baseDomain: 'consuelohq.com',
      connectorId: 'connector_internal',
      tunnelOriginUrl: 'https://c-97c89262e0970bc466db457d4484f366.consuelohq.com',
      publishedSiteIds: [
        'launcher',
        'artifacts',
        'traces',
        'diffs',
        'docs',
        'configuration',
        'tools',
        'environments',
        'secrets',
      ],
    });

    const traceRoute = record.routes.find((route) => route.pathPrefix === '/observability');
    const gtmRoute = record.routes.find((route) => route.pathPrefix === '/gtm');
    const mcpRoute = record.routes.find((route) => route.pathPrefix === '/mcp');
    const gatewayRoutes = record.routes.filter((route) => route.target.kind === 'consuelo-gateway-service');

    expect(record.routes.find((route) => route.pathPrefix === '/')).toMatchObject({
      surface: 'sites',
      auth: 'workspace-session',
      target: { kind: 'site-snapshot', cachePolicy: 'private-preview' },
    });
    expect(traceRoute).toMatchObject({
      surface: 'sites',
      auth: 'workspace-session',
      target: { kind: 'site-snapshot', siteId: 'traces' },
    });
    expect(record.routes.filter((route) => route.target.kind === 'site-snapshot').map((route) => route.pathPrefix)).toEqual([
      '/',
      '/artifacts',
      '/observability',
      '/observability/traces',
      '/traces',
      '/tracing',
      '/trace-burn-intelligence',
      '/diffs',
      '/docs',
      '/configuration',
      '/tools',
      '/environments',
      '/secrets',
    ]);
    expect(mcpRoute).toMatchObject({
      surface: 'os',
      target: { kind: 'os-connector', connectorId: 'connector_internal' },
    });
    expect(gtmRoute).toMatchObject({
      surface: 'os',
      auth: 'workspace-session',
      target: { kind: 'os-connector', connectorId: 'connector_internal' },
    });
    expect(record.routes.indexOf(gtmRoute!)).toBeLessThan(record.routes.findIndex((route) => route.pathPrefix === '/'));
    expect(record.routes.some((route) => route.pathPrefix === '/observability' && route.target.kind === 'os-connector')).toBe(false);
    expect(record.routes.some((route) => route.pathPrefix === '/traces' && route.target.kind === 'os-connector')).toBe(false);
    expect(gatewayRoutes.map((route) => route.target).filter((target): target is ConsueloGatewayServiceTarget => target.kind === 'consuelo-gateway-service')).toEqual(expect.arrayContaining([
      expect.objectContaining(gatewayReadTarget()),
      expect.objectContaining(gatewayLiveTarget()),
      expect.objectContaining(gatewayConfigurationReadTarget()),
      expect.objectContaining(gatewayConfigurationWriteTarget()),
      expect.objectContaining(gatewayLegacySettingsReadTarget()),
      expect.objectContaining(gatewayLegacySettingsWriteTarget()),
      expect.objectContaining(gatewayEnvironmentReadTarget()),
      expect.objectContaining(gatewayEnvironmentWriteTarget()),
    ]));
    expect(JSON.stringify(record.routes.filter((route) => route.target.kind !== 'os-connector'))).not.toMatch(forbiddenBrowserLeakPattern);
  });

  it('should serve GET /traces from the published Site snapshot shell instead of the OS connector', async () => {
    const d1 = await importModule<D1RegistryContract>('scripts/lib/workspace-cloudflare-d1-route-registry.ts');
    const edge = await importModule<EdgeRouterContract>('scripts/lib/workspace-cloudflare-edge-router.ts');
    const db = d1.createInMemoryWorkspaceRouteD1();
    await d1.migrateWorkspaceRouteD1(db);
    await d1.upsertWorkspaceHostnameInD1(db, integratedRouteRecord());
    const r2Reads: string[] = [];
    const upstreamRequests: Request[] = [];
    const router = edge.createWorkspaceCloudflareEdgeRouter({
      registry: d1.createWorkspaceCloudflareD1RouteRegistry(db),
      internalSigningSecret: 'edge-test-secret',
      siteSnapshots: {
        cache: { async match() { return null; }, async put() {} },
        r2: { async get(key) { r2Reads.push(key); return { text: async () => '<!doctype html><title>Trace shell</title><main>Hosted Trace Site shell</main>' }; } },
      },
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return new Response('unexpected connector route', { status: 599 });
      },
    });

    const response = await router.fetch(new Request('https://internal.consuelohq.com/traces'));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('Hosted Trace Site shell');
    expect(response.headers.get('x-consuelo-edge-cache-authority')).toBe('sites-snapshot');
    expect(response.headers.get('x-consuelo-site-version')).toBe('version_trace_shell');
    expect(r2Reads).toEqual(['sites/workspace_internal/traces/version_trace_shell/index.html']);
    expect(upstreamRequests).toHaveLength(0);
    expect(`${body}\n${JSON.stringify([...response.headers])}`).not.toMatch(forbiddenBrowserLeakPattern);
  });

  it('should reject unauthenticated GET /gateway/traces/* requests before contacting the node', async () => {
    const d1 = await importModule<D1RegistryContract>('scripts/lib/workspace-cloudflare-d1-route-registry.ts');
    const edge = await importModule<EdgeRouterContract>('scripts/lib/workspace-cloudflare-edge-router.ts');
    const db = d1.createInMemoryWorkspaceRouteD1();
    await d1.migrateWorkspaceRouteD1(db);
    await d1.upsertWorkspaceHostnameInD1(db, integratedRouteRecord());
    const upstreamRequests: Request[] = [];
    const router = edge.createWorkspaceCloudflareEdgeRouter({
      registry: d1.createWorkspaceCloudflareD1RouteRegistry(db),
      internalSigningSecret: 'edge-test-secret',
      authorizeWorkspaceSession: async () => false,
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return new Response('unexpected raw service route', { status: 599 });
      },
    });

    const readResponse = await router.fetch(new Request('https://internal.consuelohq.com/gateway/traces/recent?cursor=00000000'));
    const readBody = (await readResponse.json()) as { error: string };
    const liveResponse = await router.fetch(new Request('https://internal.consuelohq.com/gateway/traces/events?cursor=00000000'));
    const liveBody = (await liveResponse.json()) as { error: string };

    expect(readResponse.status).toBe(401);
    expect(readBody.error).toBe('workspace_session_required');
    expect(liveResponse.status).toBe(401);
    expect(liveBody.error).toBe('workspace_session_required');
    expect(upstreamRequests).toHaveLength(0);
  });

  it('proxies authenticated GET /gateway/traces/* requests to the selected node', async () => {
    const d1 = await importModule<D1RegistryContract>('scripts/lib/workspace-cloudflare-d1-route-registry.ts');
    const edge = await importModule<EdgeRouterContract>('scripts/lib/workspace-cloudflare-edge-router.ts');
    const db = d1.createInMemoryWorkspaceRouteD1();
    await d1.migrateWorkspaceRouteD1(db);
    await d1.upsertWorkspaceHostnameInD1(db, integratedRouteRecord());
    const upstreamRequests: Request[] = [];
    const router = edge.createWorkspaceCloudflareEdgeRouter({
      registry: d1.createWorkspaceCloudflareD1RouteRegistry(db),
      internalSigningSecret: 'edge-test-secret',
      authorizeWorkspaceSession: async () => true,
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        if (new URL(request.url).pathname.endsWith('/events')) {
          return new Response('event: trace\ndata: {"id":"trace-live"}\n\n', {
            headers: { 'content-type': 'text/event-stream' },
          });
        }
        return Response.json({ ok: true, data: { rows: [{ id: 'trace-read' }] } });
      },
    });

    const readPath = '/gateway/traces/recent?cursor=00000000';
    const livePath = '/gateway/traces/events?cursor=00000000';
    const readResponse = await router.fetch(new Request(`https://internal.consuelohq.com${readPath}`, {
      headers: { cookie: 'consuelo_workspace_session=session-internal' },
    }));
    const readBody = (await readResponse.json()) as Record<string, unknown>;
    const liveResponse = await router.fetch(new Request(`https://internal.consuelohq.com${livePath}`, {
      headers: { cookie: 'consuelo_workspace_session=session-internal' },
    }));

    expect(readResponse.status).toBe(200);
    expect(readBody).toMatchObject({ ok: true, data: { rows: [{ id: 'trace-read' }] } });
    expect(liveResponse.status).toBe(200);
    expect(liveResponse.headers.get('content-type')).toBe('text/event-stream');
    expect(await liveResponse.text()).toContain('trace-live');
    expect(upstreamRequests.map((request) => request.url)).toEqual([
      'https://c-97c89262e0970bc466db457d4484f366.consuelohq.com' + readPath,
      'https://c-97c89262e0970bc466db457d4484f366.consuelohq.com' + livePath,
    ]);
    for (const request of upstreamRequests) {
      expect(request.headers.get('x-consuelo-workspace-id')).toBe('workspace_internal');
      expect(request.headers.get('x-consuelo-connector-id')).toBe('connector_internal');
      expect(request.headers.get('x-consuelo-edge-signature')).toMatch(/^sha256=[0-9a-f]{64}$/);
    }
    expect(JSON.stringify(readBody)).not.toMatch(forbiddenBrowserLeakPattern);
  });

  it('rejects unauthenticated /gateway/configuration/* requests before contacting the node', async () => {
    const d1 = await importModule<D1RegistryContract>('scripts/lib/workspace-cloudflare-d1-route-registry.ts');
    const edge = await importModule<EdgeRouterContract>('scripts/lib/workspace-cloudflare-edge-router.ts');
    const db = d1.createInMemoryWorkspaceRouteD1();
    await d1.migrateWorkspaceRouteD1(db);
    await d1.upsertWorkspaceHostnameInD1(db, integratedRouteRecord());
    const upstreamRequests: Request[] = [];
    const router = edge.createWorkspaceCloudflareEdgeRouter({
      registry: d1.createWorkspaceCloudflareD1RouteRegistry(db),
      internalSigningSecret: 'edge-test-secret',
      authorizeWorkspaceSession: async () => false,
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return new Response('unexpected raw service route', { status: 599 });
      },
    });

    const snapshotResponse = await router.fetch(new Request('https://internal.consuelohq.com/gateway/configuration/snapshot'));
    const snapshotBody = (await snapshotResponse.json()) as { error: string };
    const overlayResponse = await router.fetch(new Request('https://internal.consuelohq.com/gateway/configuration/overlay', { method: 'POST' }));
    const overlayBody = (await overlayResponse.json()) as { error: string };

    expect(snapshotResponse.status).toBe(401);
    expect(snapshotBody.error).toBe('workspace_session_required');
    expect(overlayResponse.status).toBe(401);
    expect(overlayBody.error).toBe('workspace_session_required');
    expect(upstreamRequests).toHaveLength(0);
  });

  it('proxies authenticated /gateway/configuration/* requests to the selected node', async () => {
    const d1 = await importModule<D1RegistryContract>('scripts/lib/workspace-cloudflare-d1-route-registry.ts');
    const edge = await importModule<EdgeRouterContract>('scripts/lib/workspace-cloudflare-edge-router.ts');
    const db = d1.createInMemoryWorkspaceRouteD1();
    await d1.migrateWorkspaceRouteD1(db);
    await d1.upsertWorkspaceHostnameInD1(db, integratedRouteRecord());
    const upstreamRequests: Request[] = [];
    const router = edge.createWorkspaceCloudflareEdgeRouter({
      registry: d1.createWorkspaceCloudflareD1RouteRegistry(db),
      internalSigningSecret: 'edge-test-secret',
      authorizeWorkspaceSession: async () => true,
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return Response.json({ ok: true, snapshot: { workspace: { workspaceSlug: 'internal' } } });
      },
    });

    const snapshotPath = '/gateway/configuration/snapshot';
    const overlayPath = '/gateway/configuration/overlay';
    const snapshotResponse = await router.fetch(new Request(`https://internal.consuelohq.com${snapshotPath}`, {
      headers: { cookie: 'consuelo_workspace_session=session-internal' },
    }));
    const snapshotBody = (await snapshotResponse.json()) as Record<string, unknown>;
    const overlayResponse = await router.fetch(new Request(`https://internal.consuelohq.com${overlayPath}`, {
      method: 'POST',
      headers: {
        cookie: 'consuelo_workspace_session=session-internal',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ kind: 'tool', name: 'example', enabled: true }),
    }));
    const overlayBody = (await overlayResponse.json()) as Record<string, unknown>;

    expect(snapshotResponse.status).toBe(200);
    expect(snapshotBody).toMatchObject({ ok: true, snapshot: { workspace: { workspaceSlug: 'internal' } } });
    expect(overlayResponse.status).toBe(200);
    expect(overlayBody).toMatchObject({ ok: true });
    expect(upstreamRequests.map((request) => request.url)).toEqual([
      'https://c-97c89262e0970bc466db457d4484f366.consuelohq.com' + snapshotPath,
      'https://c-97c89262e0970bc466db457d4484f366.consuelohq.com' + overlayPath,
    ]);
    expect(await upstreamRequests[1].text()).toBe('{"kind":"tool","name":"example","enabled":true}');
    expect(JSON.stringify([snapshotBody, overlayBody])).not.toMatch(forbiddenBrowserLeakPattern);
  });

  it('protects and proxies /gateway/environments/* through the selected node', async () => {
    const d1 = await importModule<D1RegistryContract>('scripts/lib/workspace-cloudflare-d1-route-registry.ts');
    const edge = await importModule<EdgeRouterContract>('scripts/lib/workspace-cloudflare-edge-router.ts');
    const db = d1.createInMemoryWorkspaceRouteD1();
    await d1.migrateWorkspaceRouteD1(db);
    await d1.upsertWorkspaceHostnameInD1(db, integratedRouteRecord());
    const upstreamRequests: Request[] = [];
    let authorized = false;
    const router = edge.createWorkspaceCloudflareEdgeRouter({
      registry: d1.createWorkspaceCloudflareD1RouteRegistry(db),
      internalSigningSecret: 'edge-test-secret',
      authorizeWorkspaceSession: async () => authorized,
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return Response.json({ ok: true, snapshot: { environments: [] } });
      },
    });

    const unauthenticated = await router.fetch(new Request('https://internal.consuelohq.com/gateway/environments/snapshot'));
    expect(unauthenticated.status).toBe(401);
    await expect(unauthenticated.json()).resolves.toEqual({ error: 'workspace_session_required' });

    authorized = true;
    const cases = [
      { method: 'GET', path: '/gateway/environments/snapshot' },
      { method: 'POST', path: '/gateway/environments/upsert' },
      { method: 'POST', path: '/gateway/environments/delete' },
    ] as const;

    for (const item of cases) {
      const response = await router.fetch(new Request(`https://internal.consuelohq.com${item.path}`, {
        method: item.method,
        headers: { cookie: 'consuelo_workspace_session=session-internal' },
      }));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        snapshot: { environments: [] },
      });
    }
    expect(upstreamRequests.map((request) => new URL(request.url).pathname)).toEqual([
      '/gateway/environments/snapshot',
      '/gateway/environments/upsert',
      '/gateway/environments/delete',
    ]);
  });

  it('should serve first-class Configuration routes from their published Site snapshots instead of the OS connector', async () => {
    const d1 = await importModule<D1RegistryContract>('scripts/lib/workspace-cloudflare-d1-route-registry.ts');
    const edge = await importModule<EdgeRouterContract>('scripts/lib/workspace-cloudflare-edge-router.ts');
    const db = d1.createInMemoryWorkspaceRouteD1();
    await d1.migrateWorkspaceRouteD1(db);
    await d1.upsertWorkspaceHostnameInD1(db, integratedRouteRecord());
    const r2Reads: string[] = [];
    const upstreamRequests: Request[] = [];
    const router = edge.createWorkspaceCloudflareEdgeRouter({
      registry: d1.createWorkspaceCloudflareD1RouteRegistry(db),
      internalSigningSecret: 'edge-test-secret',
      siteSnapshots: {
        cache: { async match() { return null; }, async put() {} },
        r2: { async get(key) { r2Reads.push(key); return { text: async () => `<!doctype html><title>${key}</title><main>Hosted Configuration Site shell</main>` }; } },
      },
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return new Response('unexpected connector route', { status: 599 });
      },
    });

    for (const route of ['configuration', 'tools', 'environments', 'secrets'] as const) {
      const response = await router.fetch(new Request(`https://internal.consuelohq.com/${route}`));
      const body = await response.text();
      expect(response.status).toBe(200);
      expect(body).toContain('Hosted Configuration Site shell');
      expect(`${body}
${JSON.stringify([...response.headers])}`).not.toMatch(forbiddenBrowserLeakPattern);
    }

    expect(r2Reads).toEqual([
      'sites/workspace_internal/configuration/version_trace_shell/index.html',
      'sites/workspace_internal/tools/version_trace_shell/index.html',
      'sites/workspace_internal/environments/version_trace_shell/index.html',
      'sites/workspace_internal/secrets/version_trace_shell/index.html',
    ]);
    expect(upstreamRequests).toHaveLength(0);
  });

  it('should align Trace adapter descriptors with edge gateway route records', async () => {
    const adapter = await importModule<TraceAdapterContract>('scripts/lib/consuelo-sites-trace-adapter.ts');
    const seed = await importModule<EdgeRouteSeedContract>('scripts/lib/workspace-edge-route-seed.ts');

    const record = seed.createWorkspaceEdgeRouteSeedRecord({
      connectorId: 'connector_internal',
      tunnelOriginUrl: 'https://c-97c89262e0970bc466db457d4484f366.consuelohq.com',
    });
    const edgeGatewayTargets = record.routes
      .map((route) => route.target)
      .filter((target): target is ConsueloGatewayServiceTarget => target.kind === 'consuelo-gateway-service');
    const traceDescriptors = adapter.CONSUELO_TRACE_SITE_SERVICE_REGISTRATIONS.filter((registration) => registration.site === 'trace');

    expect(traceDescriptors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        publicSiteRouteFamily: '/observability/*',
        gatewayRouteFamily: '/gateway/traces/*',
        gatewayServiceName: 'trace-sites-read-layer',
        publicBoundary: 'consuelo-gateway',
      }),
      expect.objectContaining({
        publicSiteRouteFamily: '/observability/*',
        gatewayRouteFamily: '/gateway/traces/*',
        gatewayServiceName: 'trace-sites-live-endpoints',
        publicBoundary: 'consuelo-gateway',
      }),
    ]));
    for (const descriptor of traceDescriptors) {
      expect(edgeGatewayTargets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          serviceName: descriptor.gatewayServiceName,
          gatewayRouteFamily: descriptor.gatewayRouteFamily,
          publicSiteRouteFamily: descriptor.publicSiteRouteFamily,
        }),
      ]));
    }
  });

  it('should align Configuration adapter descriptors with edge gateway route records', async () => {
    const adapter = await importModule<ConfigurationAdapterContract>('scripts/lib/consuelo-sites-settings-adapter.ts');
    const seed = await importModule<EdgeRouteSeedContract>('scripts/lib/workspace-edge-route-seed.ts');

    const record = seed.createWorkspaceEdgeRouteSeedRecord({
      connectorId: 'connector_internal',
      tunnelOriginUrl: 'https://connector-internal.os-origin.consuelohq.com',
    });
    const edgeGatewayTargets = record.routes
      .map((route) => route.target)
      .filter((target): target is ConsueloGatewayServiceTarget => target.kind === 'consuelo-gateway-service');
    const configurationDescriptors = adapter.CONSUELO_CONFIGURATION_SITE_SERVICE_REGISTRATIONS;

    expect(configurationDescriptors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        publicSiteRouteFamily: '/configuration/*',
        gatewayRouteFamily: '/gateway/configuration/*',
        gatewayServiceName: 'configuration-sites-read-endpoints',
        publicBoundary: 'consuelo-gateway',
      }),
      expect.objectContaining({
        publicSiteRouteFamily: '/configuration/*',
        gatewayRouteFamily: '/gateway/configuration/*',
        gatewayServiceName: 'configuration-sites-write-endpoints',
        publicBoundary: 'consuelo-gateway',
      }),
    ]));
    for (const descriptor of configurationDescriptors) {
      expect(edgeGatewayTargets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          serviceName: descriptor.gatewayServiceName,
          gatewayRouteFamily: descriptor.gatewayRouteFamily,
          publicSiteRouteFamily: descriptor.publicSiteRouteFamily,
        }),
      ]));
    }
  });

  it('should align Environment adapter descriptors with edge gateway route records', async () => {
    const adapter = await importModule<EnvironmentAdapterContract>('scripts/lib/consuelo-sites-environment-adapter.ts');
    const seed = await importModule<EdgeRouteSeedContract>('scripts/lib/workspace-edge-route-seed.ts');
    const record = seed.createWorkspaceEdgeRouteSeedRecord({
      connectorId: 'connector_internal',
      tunnelOriginUrl: 'https://connector-internal.os-origin.consuelohq.com',
    });
    const edgeGatewayTargets = record.routes
      .map((route) => route.target)
      .filter((target): target is ConsueloGatewayServiceTarget => target.kind === 'consuelo-gateway-service');
    const environmentDescriptors = adapter.CONSUELO_ENVIRONMENT_SITE_SERVICE_REGISTRATIONS;

    expect(environmentDescriptors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        site: 'environments',
        capability: 'environments-read',
        gatewayServiceName: 'environment-sites-read-endpoints',
        publicSiteRouteFamily: '/environments/*',
        gatewayRouteFamily: '/gateway/environments/*',
        publicBoundary: 'consuelo-gateway',
      }),
      expect.objectContaining({
        site: 'environments',
        capability: 'environments-write',
        gatewayServiceName: 'environment-sites-write-endpoints',
        publicSiteRouteFamily: '/environments/*',
        gatewayRouteFamily: '/gateway/environments/*',
        publicBoundary: 'consuelo-gateway',
      }),
    ]));
    for (const descriptor of environmentDescriptors) {
      expect(edgeGatewayTargets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          serviceName: descriptor.gatewayServiceName,
          gatewayRouteFamily: descriptor.gatewayRouteFamily,
          publicSiteRouteFamily: descriptor.publicSiteRouteFamily,
        }),
      ]));
    }
  });

  it('should make install edge publish verify every launcher route with the published snapshot version', async () => {
    const publisher = await importModule<InstallPublisherContract>('scripts/lib/install-edge-site-publisher.ts');
    const home = makeHome();
    const expectedPlan = publisher.createWorkspaceEdgeSnapshotPlan({
      home,
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      workspaceHost: 'internal.consuelohq.com',
      now: '2026-06-14T00:00:00.000Z',
    });
    const verificationUrls: string[] = [];

    const result = await publisher.publishWorkspaceEdgeSnapshot({
      home,
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      workspaceHost: 'internal.consuelohq.com',
      commandRunner: async () => ({ exitCode: 0, stdout: 'ok', stderr: '' }),
      fetchImpl: async (url) => {
        verificationUrls.push(url);
        const snapshot = expectedPlan.snapshots.find(
          (candidate) => candidate.verifyUrl === url,
        );
        if (!snapshot) throw new Error(`unexpected verification URL: ${url}`);
        if (snapshot.siteId === 'launcher' || snapshot.siteId === 'traces') {
          return Response.json(
            { error: 'workspace_session_required' },
            { status: 401 },
          );
        }
        return new Response('<!doctype html><title>Trace shell</title><main>Hosted Trace Site shell</main>', {
          status: 200,
          headers: {
            'x-consuelo-edge-cache-authority': 'sites-snapshot',
            'x-consuelo-sites-cache': 'miss',
            'x-consuelo-site-content-hash': snapshot.contentHash,
            'x-consuelo-site-version': expectedPlan.versionId,
          },
        });
      },
      now: '2026-06-14T00:00:00.000Z',
    });

    expect(expectedPlan.verifyUrl).toBe('https://internal.consuelohq.com/');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/artifacts"');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/observability"');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/observability/traces"');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/traces"');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/tracing"');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/trace-burn-intelligence"');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/diffs"');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/docs"');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/configuration"');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/tools"');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/environments"');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/secrets"');
    expect(expectedPlan.routeSql).toContain('"kind":"consuelo-gateway-service"');
    expect(verificationUrls).toEqual([
      'https://internal.consuelohq.com/',
      'https://internal.consuelohq.com/artifacts',
      'https://internal.consuelohq.com/observability',
      'https://internal.consuelohq.com/observability/traces',
      'https://internal.consuelohq.com/traces',
      'https://internal.consuelohq.com/tracing',
      'https://internal.consuelohq.com/trace-burn-intelligence',
      'https://internal.consuelohq.com/diffs',
      'https://internal.consuelohq.com/docs',
      'https://internal.consuelohq.com/configuration',
      'https://internal.consuelohq.com/tools',
      'https://internal.consuelohq.com/environments',
      'https://internal.consuelohq.com/secrets',
    ]);
    expect(result).toMatchObject({
      status: 'succeeded',
      verifyUrl: 'https://internal.consuelohq.com/',
      verifiedUrls: [
        'https://internal.consuelohq.com/',
        'https://internal.consuelohq.com/artifacts',
        'https://internal.consuelohq.com/observability',
        'https://internal.consuelohq.com/observability/traces',
        'https://internal.consuelohq.com/traces',
        'https://internal.consuelohq.com/tracing',
        'https://internal.consuelohq.com/trace-burn-intelligence',
        'https://internal.consuelohq.com/diffs',
        'https://internal.consuelohq.com/docs',
        'https://internal.consuelohq.com/configuration',
        'https://internal.consuelohq.com/tools',
        'https://internal.consuelohq.com/environments',
        'https://internal.consuelohq.com/secrets',
      ],
      versionId: expectedPlan.versionId,
    });
  });

  it('should keep platform safety reserved hosts ahead of cache and D1 lookup', async () => {
    const edge = await importModule<EdgeRouterContract>('scripts/lib/workspace-cloudflare-edge-router.ts');
    let resolveCount = 0;
    let cacheCount = 0;
    const router = edge.createWorkspaceCloudflareEdgeRouter({
      registry: {
        async resolve() {
          resolveCount += 1;
          return { allowed: false, status: 404, errorCode: 'UNEXPECTED_D1_LOOKUP', auditEvent: 'workspace.hostname.route.denied' };
        },
      },
      siteSnapshots: {
        cache: { async match() { cacheCount += 1; return null; }, async put() {} },
      },
    });

    const response = await router.fetch(new Request('https://app.consuelohq.com/traces', { headers: { accept: 'text/html' } }));
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(body).toContain('WORKSPACE_HOSTNAME_RESERVED');
    expect(resolveCount).toBe(0);
    expect(cacheCount).toBe(0);
    expect(body).not.toContain('UNEXPECTED_D1_LOOKUP');
    expect(body).not.toMatch(forbiddenBrowserLeakPattern);
  });
});
