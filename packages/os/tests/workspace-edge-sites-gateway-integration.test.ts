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

type ConsueloGatewayServiceTarget = {
  kind: 'consuelo-gateway-service';
  serviceName: 'trace-sites-read-layer' | 'trace-sites-live-endpoints' | (string & {});
  gatewayRouteFamily: '/gateway/traces/*' | (string & {});
  publicSiteRouteFamily: '/observability/*' | (string & {});
};

type RouteTarget = SiteSnapshotTarget | OsConnectorTarget | ServiceUpstreamTarget | ConsueloGatewayServiceTarget;

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

type InstallPublisherContract = {
  createWorkspaceEdgeSnapshotPlan: (input: {
    home: string;
    workspaceId: string;
    workspaceSlug: string;
    workspaceHost: string;
    now?: string;
  }) => { versionId: string; routeSql: string; verifyUrl: string; verifiedUrls: string[]; snapshots: Array<{ siteId: string; snapshotKey: string; snapshotPath: string; verifyUrl: string }> };
  publishWorkspaceEdgeSnapshot: (input: {
    home: string;
    workspaceId: string;
    workspaceSlug: string;
    workspaceHost: string;
    now?: string;
    commandRunner?: (command: { argv: string[]; cwd?: string }) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
    fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  }) => Promise<{ status: 'succeeded'; verifyUrl: string; verifiedUrls: string[]; versionId: string; snapshots: Array<{ siteId: string; snapshotKey: string; snapshotPath: string; verifyUrl: string }> }>;
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
}): string {
  const canonical = [
    input.method.toUpperCase(),
    input.pathWithSearch,
    input.workspaceId,
    input.surface,
  ].join('\n');

  return `sha256=${createHmac('sha256', input.secret).update(canonical).digest('hex')}`;
}

function makeHome(html = '<!doctype html><title>Trace shell</title><main>Hosted Trace Site shell</main>') {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-edge-sites-gateway-'));
  const sitePaths = [
    ['index.html'],
    ['office', 'index.html'],
    ['traces', 'index.html'],
    ['diffs', 'index.html'],
    ['docs', 'index.html'],
  ];
  for (const sitePath of sitePaths) {
    const filePath = path.join(home, 'sites', ...sitePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, html, 'utf8');
  }
  return home;
}

function siteSnapshotTarget(siteId: 'launcher' | 'office' | 'traces' | 'diffs' | 'docs' = 'launcher'): SiteSnapshotTarget {
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
      { surface: 'sites', pathPrefix: '/', auth: 'public', status: 'active', target: siteSnapshotTarget('launcher') },
      { surface: 'sites', pathPrefix: '/office', auth: 'public', status: 'active', target: siteSnapshotTarget('office') },
      { surface: 'sites', pathPrefix: '/traces', auth: 'public', status: 'active', target: siteSnapshotTarget('traces') },
      { surface: 'sites', pathPrefix: '/tracing', auth: 'public', status: 'active', target: siteSnapshotTarget('traces') },
      { surface: 'sites', pathPrefix: '/diffs', auth: 'public', status: 'active', target: siteSnapshotTarget('diffs') },
      { surface: 'sites', pathPrefix: '/docs', auth: 'public', status: 'active', target: siteSnapshotTarget('docs') },
      { surface: 'sites', pathPrefix: '/gateway/traces/events', auth: 'required', status: 'active', target: gatewayLiveTarget() },
      { surface: 'sites', pathPrefix: '/gateway/traces', auth: 'required', status: 'active', target: gatewayReadTarget() },
      {
        surface: 'os',
        pathPrefix: '/mcp',
        auth: 'required',
        status: 'active',
        target: {
          kind: 'os-connector',
          connectorId: 'connector_internal',
          connectorStatus: 'connected',
          tunnelOriginUrl: 'https://connector-internal.os-origin.consuelohq.com',
        },
      },
    ],
  };
}

contractDescribe('workspace edge Sites snapshot and Consuelo Sites Gateway integration', () => {
  it('should seed workspace routes with Trace as a Site shell and Gateway as the data boundary when connector inputs exist', async () => {
    const seed = await importModule<EdgeRouteSeedContract>('scripts/lib/workspace-edge-route-seed.ts');

    const record = seed.createWorkspaceEdgeRouteSeedRecord({
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      hostname: 'internal.consuelohq.com',
      baseDomain: 'consuelohq.com',
      connectorId: 'connector_internal',
      tunnelOriginUrl: 'https://connector-internal.os-origin.consuelohq.com',
    });

    const traceRoute = record.routes.find((route) => route.pathPrefix === '/observability');
    const mcpRoute = record.routes.find((route) => route.pathPrefix === '/mcp');
    const gatewayRoutes = record.routes.filter((route) => route.target.kind === 'consuelo-gateway-service');

    expect(record.routes.find((route) => route.pathPrefix === '/')).toMatchObject({
      surface: 'sites',
      auth: 'public',
      target: { kind: 'site-snapshot' },
    });
    expect(traceRoute).toMatchObject({
      surface: 'sites',
      auth: 'public',
      target: { kind: 'site-snapshot', siteId: 'traces' },
    });
    expect(record.routes.filter((route) => route.target.kind === 'site-snapshot').map((route) => route.pathPrefix)).toEqual([
      '/',
      '/office',
      '/observability',
      '/traces',
      '/tracing',
      '/diffs',
      '/docs',
    ]);
    expect(mcpRoute).toMatchObject({
      surface: 'os',
      target: { kind: 'os-connector', connectorId: 'connector_internal' },
    });
    expect(record.routes.some((route) => route.pathPrefix === '/observability' && route.target.kind === 'os-connector')).toBe(false);
    expect(record.routes.some((route) => route.pathPrefix === '/traces' && route.target.kind === 'os-connector')).toBe(false);
    expect(gatewayRoutes.map((route) => route.target).filter((target): target is ConsueloGatewayServiceTarget => target.kind === 'consuelo-gateway-service')).toEqual(expect.arrayContaining([
      expect.objectContaining(gatewayReadTarget()),
      expect.objectContaining(gatewayLiveTarget()),
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

  it('should reject unauthenticated GET /gateway/traces/* requests before returning Gateway service descriptors', async () => {
    const d1 = await importModule<D1RegistryContract>('scripts/lib/workspace-cloudflare-d1-route-registry.ts');
    const edge = await importModule<EdgeRouterContract>('scripts/lib/workspace-cloudflare-edge-router.ts');
    const db = d1.createInMemoryWorkspaceRouteD1();
    await d1.migrateWorkspaceRouteD1(db);
    await d1.upsertWorkspaceHostnameInD1(db, integratedRouteRecord());
    const upstreamRequests: Request[] = [];
    const router = edge.createWorkspaceCloudflareEdgeRouter({
      registry: d1.createWorkspaceCloudflareD1RouteRegistry(db),
      internalSigningSecret: 'edge-test-secret',
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return new Response('unexpected raw service route', { status: 599 });
      },
    });

    const readResponse = await router.fetch(new Request('https://internal.consuelohq.com/gateway/traces/recent?cursor=00000000'));
    const readBody = (await readResponse.json()) as { error: { code: string } };
    const liveResponse = await router.fetch(new Request('https://internal.consuelohq.com/gateway/traces/events?cursor=00000000'));
    const liveBody = (await liveResponse.json()) as { error: { code: string } };

    expect(readResponse.status).toBe(503);
    expect(readBody.error.code).toBe('WORKSPACE_EDGE_AUTH_REQUIRED');
    expect(liveResponse.status).toBe(503);
    expect(liveBody.error.code).toBe('WORKSPACE_EDGE_AUTH_REQUIRED');
    expect(upstreamRequests).toHaveLength(0);
    expect(JSON.stringify([readBody, liveBody])).not.toMatch(forbiddenBrowserLeakPattern);
  });

  it('should resolve internally signed GET /gateway/traces/* requests to Gateway service descriptors without exposing backend targets', async () => {
    const d1 = await importModule<D1RegistryContract>('scripts/lib/workspace-cloudflare-d1-route-registry.ts');
    const edge = await importModule<EdgeRouterContract>('scripts/lib/workspace-cloudflare-edge-router.ts');
    const db = d1.createInMemoryWorkspaceRouteD1();
    await d1.migrateWorkspaceRouteD1(db);
    await d1.upsertWorkspaceHostnameInD1(db, integratedRouteRecord());
    const upstreamRequests: Request[] = [];
    const router = edge.createWorkspaceCloudflareEdgeRouter({
      registry: d1.createWorkspaceCloudflareD1RouteRegistry(db),
      internalSigningSecret: 'edge-test-secret',
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return new Response('unexpected raw service route', { status: 599 });
      },
    });

    const readPath = '/gateway/traces/recent?cursor=00000000';
    const livePath = '/gateway/traces/events?cursor=00000000';
    const readResponse = await router.fetch(new Request(`https://internal.consuelohq.com${readPath}`, {
      headers: {
        'x-consuelo-edge-signature': signInternalEdgeRequest({
          secret: 'edge-test-secret',
          method: 'GET',
          pathWithSearch: readPath,
          workspaceId: 'workspace_internal',
          surface: 'sites',
        }),
      },
    }));
    const readBody = (await readResponse.json()) as Record<string, unknown>;
    const liveResponse = await router.fetch(new Request(`https://internal.consuelohq.com${livePath}`, {
      headers: {
        'x-consuelo-edge-signature': signInternalEdgeRequest({
          secret: 'edge-test-secret',
          method: 'GET',
          pathWithSearch: livePath,
          workspaceId: 'workspace_internal',
          surface: 'sites',
        }),
      },
    }));
    const liveBody = (await liveResponse.json()) as Record<string, unknown>;

    expect(readResponse.status).toBe(200);
    expect(readBody).toMatchObject({
      ok: true,
      publicBoundary: 'consuelo-gateway',
      route: {
        serviceName: 'trace-sites-read-layer',
        gatewayServiceName: 'trace-sites-read-layer',
        gatewayRouteFamily: '/gateway/traces/*',
        publicSiteRouteFamily: '/observability/*',
      },
    });
    expect(liveResponse.status).toBe(200);
    expect(liveBody).toMatchObject({
      ok: true,
      publicBoundary: 'consuelo-gateway',
      route: {
        serviceName: 'trace-sites-live-endpoints',
        gatewayServiceName: 'trace-sites-live-endpoints',
        gatewayRouteFamily: '/gateway/traces/*',
        publicSiteRouteFamily: '/observability/*',
      },
    });
    expect(upstreamRequests).toHaveLength(0);
    expect(JSON.stringify([readBody, liveBody])).not.toMatch(forbiddenBrowserLeakPattern);
  });

  it('should align Trace adapter descriptors with edge gateway route records', async () => {
    const adapter = await importModule<TraceAdapterContract>('scripts/lib/consuelo-sites-trace-adapter.ts');
    const seed = await importModule<EdgeRouteSeedContract>('scripts/lib/workspace-edge-route-seed.ts');

    const record = seed.createWorkspaceEdgeRouteSeedRecord({
      connectorId: 'connector_internal',
      tunnelOriginUrl: 'https://connector-internal.os-origin.consuelohq.com',
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
        return new Response('<!doctype html><title>Trace shell</title><main>Hosted Trace Site shell</main>', {
          status: 200,
          headers: {
            'x-consuelo-edge-cache-authority': 'sites-snapshot',
            'x-consuelo-sites-cache': 'miss',
            'x-consuelo-site-version': expectedPlan.versionId,
          },
        });
      },
      now: '2026-06-14T00:00:00.000Z',
    });

    expect(expectedPlan.verifyUrl).toBe('https://internal.consuelohq.com/');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/office"');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/observability"');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/traces"');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/diffs"');
    expect(expectedPlan.routeSql).toContain('"pathPrefix":"/docs"');
    expect(expectedPlan.routeSql).toContain('"kind":"consuelo-gateway-service"');
    expect(verificationUrls).toEqual([
      'https://internal.consuelohq.com/',
      'https://internal.consuelohq.com/office',
      'https://internal.consuelohq.com/observability',
      'https://internal.consuelohq.com/traces',
      'https://internal.consuelohq.com/diffs',
      'https://internal.consuelohq.com/docs',
    ]);
    expect(result).toMatchObject({
      status: 'succeeded',
      verifyUrl: 'https://internal.consuelohq.com/',
      verifiedUrls: [
        'https://internal.consuelohq.com/',
        'https://internal.consuelohq.com/office',
        'https://internal.consuelohq.com/observability',
        'https://internal.consuelohq.com/traces',
        'https://internal.consuelohq.com/diffs',
        'https://internal.consuelohq.com/docs',
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
