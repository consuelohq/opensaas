import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type WorkspaceCloudflareEdgeRouteTarget =
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
      htmlKey?: string;
      contentType?: string;
      cachePolicy: 'static-shell' | 'versioned-asset' | 'mutable-artifact' | 'private-preview';
    };

type WorkspaceSitesEdgeCache = {
  match: (request: Request) => Promise<Response | null>;
  put: (request: Request, response: Response) => Promise<void>;
};

type WorkspaceSitesEdgeR2Object = {
  text: () => Promise<string>;
};

type WorkspaceSitesEdgeR2Bucket = {
  get: (key: string) => Promise<WorkspaceSitesEdgeR2Object | null>;
};

type WorkspaceSitesSnapshotStore = {
  cache?: WorkspaceSitesEdgeCache;
  r2?: WorkspaceSitesEdgeR2Bucket;
};

type WorkspaceCloudflareEdgeRouteResolution =
  | {
      allowed: true;
      workspaceId: string;
      hostname: string;
      route: string;
      surface: 'os' | 'dialer' | 'app' | 'sites' | 'twenty';
      auth: 'public' | 'required' | 'workspace-session' | 'signed-connector';
      auditEvent: 'workspace.hostname.route.allowed';
      target: WorkspaceCloudflareEdgeRouteTarget;
    }
  | {
      allowed: false;
      status: 404 | 503;
      errorCode: string;
      auditEvent: 'workspace.hostname.route.denied';
    };

type WorkspaceCloudflareEdgeRouteRegistry = {
  resolve: (input: {
    host: string;
    path: string;
    method: string;
  }) => Promise<WorkspaceCloudflareEdgeRouteResolution>;
};

type WorkspaceCloudflareEdgeRouter = {
  fetch: (request: Request) => Promise<Response>;
};

type WorkspaceCloudflareEdgeRouterContract = {
  createWorkspaceCloudflareEdgeRouter: (input: {
    registry: WorkspaceCloudflareEdgeRouteRegistry;
    internalSigningSecret?: string;
    fetchUpstream?: (request: Request) => Promise<Response>;
    siteSnapshots?: WorkspaceSitesSnapshotStore;
  }) => WorkspaceCloudflareEdgeRouter;
};

const createAuthoritativeSiteSnapshotCache = (input?: {
  onMatch?: (request: Request) => void;
  versionId?: string;
}): WorkspaceSitesEdgeCache => ({
  async match(request) {
    input?.onMatch?.(request);

    return new Response('<!doctype html><title>cached launcher</title>', {
      headers: {
        'cache-control': 'public, max-age=60, s-maxage=2592000, stale-while-revalidate=604800',
        'content-type': 'text/html; charset=utf-8',
        'x-consuelo-edge-cache-authority': 'sites-snapshot',
        'x-consuelo-site-version': input?.versionId ?? 'version_1',
      },
    });
  },
  async put() {
    throw new Error('cache put should not run on a hit');
  },
});

const runContract =
  process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

async function loadWorkspaceCloudflareEdgeRouterContract(): Promise<WorkspaceCloudflareEdgeRouterContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'workspace-cloudflare-edge-router.ts'),
  ).href;
  const module = (await import(
    modulePath
  )) as Partial<WorkspaceCloudflareEdgeRouterContract>;

  if (typeof module.createWorkspaceCloudflareEdgeRouter !== 'function') {
    throw new Error(
      'workspace Cloudflare edge router contract module is missing export: createWorkspaceCloudflareEdgeRouter',
    );
  }

  return module as WorkspaceCloudflareEdgeRouterContract;
}

contractDescribe('workspace Cloudflare edge router contract', () => {
  it('should fail closed for unknown workspace hostnames without leaking internals', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const registry: WorkspaceCloudflareEdgeRouteRegistry = {
      async resolve() {
        return {
          allowed: false,
          status: 404,
          errorCode: 'WORKSPACE_HOSTNAME_NOT_FOUND',
          auditEvent: 'workspace.hostname.route.denied',
        };
      },
    };

    const router = createWorkspaceCloudflareEdgeRouter({ registry });

    const response = await router.fetch(
      new Request('https://missing.consuelohq.com/traces'),
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(body.error.code).toBe('WORKSPACE_HOSTNAME_NOT_FOUND');
    expect(JSON.stringify(body)).not.toMatch(/token|secret|upstream|tunnel/i);
  });

  it('should return safe 404s for known workspace hosts with unknown paths', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const registry: WorkspaceCloudflareEdgeRouteRegistry = {
      async resolve() {
        return {
          allowed: false,
          status: 404,
          errorCode: 'WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND',
          auditEvent: 'workspace.hostname.route.denied',
        };
      },
    };

    const router = createWorkspaceCloudflareEdgeRouter({ registry });

    const response = await router.fetch(
      new Request('https://kokayi.consuelohq.com/admin/private'),
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(body.error.code).toBe('WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND');
    expect(JSON.stringify(body)).not.toMatch(/connector|token|secret|railway/i);
  });
  it('should fail closed for allowed routes when edge signing config is absent', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const upstreamRequests: Request[] = [];
    const registry: WorkspaceCloudflareEdgeRouteRegistry = {
      async resolve() {
        return {
          allowed: true,
          workspaceId: 'workspace_123',
          hostname: 'kokayi.consuelohq.com',
          route: '/dialer',
          surface: 'dialer',
          auth: 'required',
          auditEvent: 'workspace.hostname.route.allowed',
          target: {
            kind: 'service-upstream',
            service: 'dialer',
            upstreamUrl: 'https://dialer-production.up.railway.app',
          },
        };
      },
    };

    for (const extraInput of [{}, { ['internalSigning' + 'Secret']: '' }]) {
      const router = createWorkspaceCloudflareEdgeRouter({
        registry,
        ...extraInput,
        fetchUpstream: async (request) => {
          upstreamRequests.push(request);
          return new Response('unexpected proxy', { status: 200 });
        },
      });

      const response = await router.fetch(
        new Request('https://kokayi.consuelohq.com/dialer/calls', {
          headers: {
            'x-consuelo-edge-signature': 'sha256=inbound',
          },
        }),
      );

      expect(response.status).toBe(503);
      const body = (await response.json()) as {
        error: { code: string; message: string };
      };
      expect(body.error.code).toBe('WORKSPACE_EDGE_AUTH_REQUIRED');
      expect(JSON.stringify(body)).not.toMatch(/token|upstream|railway/i);
    }

    expect(upstreamRequests).toHaveLength(0);
  });

  it('should route Dialer paths to Railway through signed internal edge headers', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const upstreamRequests: Request[] = [];
    const registry: WorkspaceCloudflareEdgeRouteRegistry = {
      async resolve() {
        return {
          allowed: true,
          workspaceId: 'workspace_123',
          hostname: 'kokayi.consuelohq.com',
          route: '/dialer',
          surface: 'dialer',
          auth: 'required',
          auditEvent: 'workspace.hostname.route.allowed',
          target: {
            kind: 'service-upstream',
            service: 'dialer',
            upstreamUrl: 'https://dialer-production.up.railway.app',
          },
        };
      },
    };

    const router = createWorkspaceCloudflareEdgeRouter({
      registry,
      internalSigningSecret: 'edge-test-secret',
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return new Response('dialer ok', { status: 200 });
      },
    });

    const response = await router.fetch(
      new Request('https://kokayi.consuelohq.com/dialer/calls?limit=5', {
        headers: {
          'x-consuelo-connector-id': 'caller-controlled-connector',
          'x-consuelo-edge-signature': 'sha256=inbound',
          'x-consuelo-hostname': 'caller.example.com',
          'x-consuelo-route': '/caller',
          'x-consuelo-surface': 'os',
          'x-consuelo-workspace-id': 'caller_workspace',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('dialer ok');
    expect(upstreamRequests).toHaveLength(1);
    expect(upstreamRequests[0].url).toBe(
      'https://dialer-production.up.railway.app/dialer/calls?limit=5',
    );
    expect(upstreamRequests[0].headers.get('x-consuelo-workspace-id')).toBe(
      'workspace_123',
    );
    expect(upstreamRequests[0].headers.get('x-consuelo-surface')).toBe(
      'dialer',
    );
    expect(upstreamRequests[0].headers.get('x-consuelo-hostname')).toBe(
      'kokayi.consuelohq.com',
    );
    expect(upstreamRequests[0].headers.get('x-consuelo-route')).toBe('/dialer');
    expect(upstreamRequests[0].headers.get('x-consuelo-connector-id')).toBeNull();
    expect(upstreamRequests[0].headers.get('x-consuelo-edge-signature')).toBe(
      'sha256=e9652e5ea05501c2fe16ca735512b3b24cf4c6850cfe9d43cc59b198b5388333',
    );
  });


  it('should advertise OAuth protected-resource metadata for workspace MCP routes', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const resolvedPaths: string[] = [];
    const dynamicHost = 'fresh-' + crypto.randomUUID().slice(0, 8) + '.consuelohq.com';
    const router = createWorkspaceCloudflareEdgeRouter({
      registry: {
        async resolve(input) {
          resolvedPaths.push(input.path);
          return {
            allowed: true,
            workspaceId: 'workspace_123',
            hostname: dynamicHost,
            route: '/mcp',
            surface: 'os',
            auth: 'required',
            auditEvent: 'workspace.hostname.route.allowed',
            target: {
              kind: 'os-connector',
              connectorId: 'connector_123',
              connectorStatus: 'connected',
              tunnelOriginUrl: 'https://connector-123.os-origin.consuelohq.com',
            },
          };
        },
      },
    });

    const response = await router.fetch(
      new Request('https://' + dynamicHost + '/.well-known/oauth-protected-resource'),
    );
    const body = await response.json() as {
      resource: string;
      authorization_servers: string[];
      scopes_supported: string[];
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body.resource).toBe('https://' + dynamicHost + '/mcp');
    expect(body.authorization_servers).toEqual(['https://os.consuelohq.com']);
    expect(body.scopes_supported).toEqual(expect.arrayContaining(['mcp:read', 'mcp:call', 'tool:*:read']));
    expect(resolvedPaths).toEqual(['/mcp']);
    expect(JSON.stringify(body)).not.toMatch(/connector-123|tunnel|cst_|cbt_|private[_-]?key|secret|127\.0\.0\.1/i);
  });

  it('should expose OAuth authorization-server metadata for dynamic workspace MCP hosts', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const dynamicHost = 'oauth-' + crypto.randomUUID().slice(0, 8) + '.consuelohq.com';
    const resolvedPaths: string[] = [];
    const router = createWorkspaceCloudflareEdgeRouter({
      registry: {
        async resolve(input) {
          resolvedPaths.push(input.path);
          return {
            allowed: true,
            workspaceId: 'workspace_123',
            hostname: dynamicHost,
            route: '/mcp',
            surface: 'os',
            auth: 'required',
            auditEvent: 'workspace.hostname.route.allowed',
            target: {
              kind: 'os-connector',
              connectorId: 'connector_123',
              connectorStatus: 'connected',
              tunnelOriginUrl: 'https://connector-123.os-origin.consuelohq.com',
            },
          };
        },
      },
    });

    const response = await router.fetch(
      new Request('https://' + dynamicHost + '/.well-known/oauth-authorization-server'),
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      issuer: 'https://os.consuelohq.com',
      authorization_endpoint: 'https://os.consuelohq.com/oauth/authorize',
      token_endpoint: 'https://os.consuelohq.com/oauth/token',
      introspection_endpoint: 'https://os.consuelohq.com/oauth/introspect',
      client_id_metadata_document_supported: true,
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
    });
    expect(resolvedPaths).toEqual(['/mcp']);
    expect(JSON.stringify(body)).not.toMatch(/connector-123|tunnel|cst_|cbt_|private[_-]?key|secret|127\.0\.0\.1/i);
  });

  it('should not advertise OAuth protected-resource metadata for hosts without an MCP connector route', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const router = createWorkspaceCloudflareEdgeRouter({
      registry: {
        async resolve() {
          return {
            allowed: false,
            status: 404,
            errorCode: 'WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND',
            auditEvent: 'workspace.hostname.route.denied',
          };
        },
      },
    });

    const response = await router.fetch(
      new Request('https://kokayi.consuelohq.com/.well-known/oauth-protected-resource'),
    );
    const body = await response.json() as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND');
  });

  it('should route OS paths only to connected outbound connector origins', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const upstreamRequests: Request[] = [];
    const registry: WorkspaceCloudflareEdgeRouteRegistry = {
      async resolve() {
        return {
          allowed: true,
          workspaceId: 'workspace_123',
          hostname: 'kokayi.consuelohq.com',
          route: '/traces',
          surface: 'os',
          auth: 'required',
          auditEvent: 'workspace.hostname.route.allowed',
          target: {
            kind: 'os-connector',
            connectorId: 'connector_123',
            connectorStatus: 'connected',
            tunnelOriginUrl: 'https://connector-123.os-origin.consuelohq.com',
          },
        };
      },
    };

    const router = createWorkspaceCloudflareEdgeRouter({
      registry,
      internalSigningSecret: 'edge-test-secret',
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return new Response('os ok', { status: 200 });
      },
    });

    const response = await router.fetch(
      new Request('https://kokayi.consuelohq.com/traces/runs/trc_123'),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('os ok');
    expect(upstreamRequests).toHaveLength(1);
    expect(upstreamRequests[0].url).toBe(
      'https://connector-123.os-origin.consuelohq.com/traces/runs/trc_123',
    );
    expect(upstreamRequests[0].headers.get('x-consuelo-workspace-id')).toBe(
      'workspace_123',
    );
    expect(upstreamRequests[0].headers.get('x-consuelo-connector-id')).toBe(
      'connector_123',
    );
    expect(upstreamRequests[0].headers.get('x-consuelo-edge-signature')).toBe(
      'sha256=be9edfab49ef02523d70ec8d5cfc1597ab3a8fa7ff770d8202aa2902dc4a4bcd',
    );
  });


  it('should proxy POST request bodies without failing under Node-compatible fetch', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const upstreamRequests: Request[] = [];
    const registry: WorkspaceCloudflareEdgeRouteRegistry = {
      async resolve() {
        return {
          allowed: true,
          workspaceId: 'workspace_123',
          hostname: 'kokayi.consuelohq.com',
          route: '/mcp',
          surface: 'os',
          auth: 'required',
          auditEvent: 'workspace.hostname.route.allowed',
          target: {
            kind: 'os-connector',
            connectorId: 'connector_123',
            connectorStatus: 'connected',
            tunnelOriginUrl: 'https://connector-123.os-origin.consuelohq.com',
          },
        };
      },
    };

    const router = createWorkspaceCloudflareEdgeRouter({
      registry,
      internalSigningSecret: 'edge-test-secret',
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return new Response('post ok', { status: 200 });
      },
    });

    const response = await router.fetch(
      new Request('https://kokayi.consuelohq.com/mcp/tools/call', {
        body: JSON.stringify({ tool: 'list' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('post ok');
    expect(upstreamRequests).toHaveLength(1);
    expect(upstreamRequests[0].method).toBe('POST');
    expect(await upstreamRequests[0].text()).toBe('{"tool":"list"}');
  });

  it('should fail closed when an OS connector route is offline', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const registry: WorkspaceCloudflareEdgeRouteRegistry = {
      async resolve() {
        return {
          allowed: false,
          status: 503,
          errorCode: 'WORKSPACE_HOSTNAME_OS_CONNECTOR_OFFLINE',
          auditEvent: 'workspace.hostname.route.denied',
        };
      },
    };

    const router = createWorkspaceCloudflareEdgeRouter({ registry });

    const response = await router.fetch(
      new Request('https://kokayi.consuelohq.com/traces'),
    );

    expect(response.status).toBe(503);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(body.error.code).toBe('WORKSPACE_HOSTNAME_OS_CONNECTOR_OFFLINE');
    expect(JSON.stringify(body)).not.toMatch(/tunnel|token|secret/i);
  });
  it('should resolve D1 route policy before serving public site snapshots from edge cache', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    let resolveCount = 0;
    const cacheKeys: string[] = [];
    const siteCache = createAuthoritativeSiteSnapshotCache({
      onMatch: (request) => cacheKeys.push(request.url),
    });
    const router = createWorkspaceCloudflareEdgeRouter({
      registry: {
        async resolve() {
          resolveCount += 1;
          return {
            allowed: true,
            workspaceId: 'workspace_123',
            hostname: 'kokayi.consuelohq.com',
            route: '/',
            surface: 'sites',
            auth: 'public',
            auditEvent: 'workspace.hostname.route.allowed',
            target: {
              kind: 'site-snapshot',
              siteId: 'launcher',
              versionId: 'version_1',
              manifestKey: 'sites/workspace_123/launcher/version_1/index.html',
              contentType: 'text/html; charset=utf-8',
              cachePolicy: 'versioned-asset',
            },
          };
        },
      },
      siteSnapshots: { cache: siteCache },
    });

    const response = await router.fetch(
      new Request('https://kokayi.consuelohq.com/?utm_source=noise', {
        headers: { cookie: 'noise=1' },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('cached launcher');
    expect(response.headers.get('x-consuelo-sites-cache')).toBe('hit');
    expect(resolveCount).toBe(1);
    expect(cacheKeys).toEqual(['https://kokayi.consuelohq.com/']);
  });


  it('should ignore cached site snapshots when the cached version does not match the current D1 target', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const cacheKeys: string[] = [];
    const r2Reads: string[] = [];
    const cachePuts: Array<{ url: string; body: string }> = [];
    const siteCache: WorkspaceSitesEdgeCache = {
      async match(request) {
        cacheKeys.push(request.url);
        return new Response('<!doctype html><title>old launcher</title>', {
          headers: {
            'cache-control': 'public, max-age=60, s-maxage=2592000',
            'content-type': 'text/html; charset=utf-8',
            'x-consuelo-edge-cache-authority': 'sites-snapshot',
            'x-consuelo-site-version': 'version_0',
          },
        });
      },
      async put(request, response) {
        cachePuts.push({ url: request.url, body: await response.clone().text() });
      },
    };
    const siteR2: WorkspaceSitesEdgeR2Bucket = {
      async get(key) {
        r2Reads.push(key);
        if (key !== 'sites/workspace_123/launcher/version_1/index.html') return null;
        return { text: async () => '<!doctype html><title>new launcher</title>' };
      },
    };
    const router = createWorkspaceCloudflareEdgeRouter({
      registry: {
        async resolve() {
          return {
            allowed: true,
            workspaceId: 'workspace_123',
            hostname: 'kokayi.consuelohq.com',
            route: '/',
            surface: 'sites',
            auth: 'public',
            auditEvent: 'workspace.hostname.route.allowed',
            target: {
              kind: 'site-snapshot',
              siteId: 'launcher',
              versionId: 'version_1',
              manifestKey: 'sites/workspace_123/launcher/version_1/index.html',
              contentType: 'text/html; charset=utf-8',
              cachePolicy: 'versioned-asset',
            },
          };
        },
      },
      siteSnapshots: { cache: siteCache, r2: siteR2 },
    });

    const response = await router.fetch(new Request('https://kokayi.consuelohq.com/'));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('new launcher');
    expect(response.headers.get('x-consuelo-sites-cache')).toBe('miss');
    expect(response.headers.get('x-consuelo-site-version')).toBe('version_1');
    expect(cacheKeys).toEqual(['https://kokayi.consuelohq.com/']);
    expect(r2Reads).toEqual(['sites/workspace_123/launcher/version_1/index.html']);
    expect(cachePuts).toEqual([
      {
        url: 'https://kokayi.consuelohq.com/',
        body: '<!doctype html><title>new launcher</title>',
      },
    ]);
  });

  it('should serve sites.consuelohq.com as a public site snapshot host', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const r2Reads: string[] = [];
    const siteR2: WorkspaceSitesEdgeR2Bucket = {
      async get(key) {
        r2Reads.push(key);
        if (key !== 'sites/workspace_testing/launcher/version_sites/index.html') return null;
        return { text: async () => '<!doctype html><title>Consuelo OS Sites</title>' };
      },
    };
    const router = createWorkspaceCloudflareEdgeRouter({
      registry: {
        async resolve(input) {
          return {
            allowed: true,
            workspaceId: 'workspace_testing',
            hostname: input.host,
            route: '/',
            surface: 'sites',
            auth: 'public',
            auditEvent: 'workspace.hostname.route.allowed',
            target: {
              kind: 'site-snapshot',
              siteId: 'launcher',
              versionId: 'version_sites',
              manifestKey: 'sites/workspace_testing/launcher/version_sites/index.html',
              contentType: 'text/html; charset=utf-8',
              cachePolicy: 'static-shell',
            },
          };
        },
      },
      siteSnapshots: { r2: siteR2 },
    });

    const response = await router.fetch(new Request('https://sites.consuelohq.com/'));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Consuelo OS Sites');
    expect(response.headers.get('x-consuelo-site-version')).toBe('version_sites');
    expect(r2Reads).toEqual(['sites/workspace_testing/launcher/version_sites/index.html']);
  });

  it.each([
    {
      name: 'revoked hostname',
      resolution: {
        allowed: false,
        status: 404,
        errorCode: 'WORKSPACE_HOSTNAME_NOT_FOUND',
        auditEvent: 'workspace.hostname.route.denied',
      },
      expectedStatus: 404,
      expectedErrorCode: 'WORKSPACE_HOSTNAME_NOT_FOUND',
    },
    {
      name: 'disabled site route',
      resolution: {
        allowed: false,
        status: 404,
        errorCode: 'WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND',
        auditEvent: 'workspace.hostname.route.denied',
      },
      expectedStatus: 404,
      expectedErrorCode: 'WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND',
    },
    {
      name: 'missing route',
      resolution: {
        allowed: false,
        status: 404,
        errorCode: 'WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND',
        auditEvent: 'workspace.hostname.route.denied',
      },
      expectedStatus: 404,
      expectedErrorCode: 'WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND',
    },
    {
      name: 'private snapshot route',
      resolution: {
        allowed: true,
        workspaceId: 'workspace_123',
        hostname: 'kokayi.consuelohq.com',
        route: '/',
        surface: 'sites',
        auth: 'required',
        auditEvent: 'workspace.hostname.route.allowed',
        target: {
          kind: 'site-snapshot',
          siteId: 'launcher',
          versionId: 'version_1',
          manifestKey: 'sites/workspace_123/launcher/version_1/index.html',
          cachePolicy: 'private-preview',
        },
      },
      expectedStatus: 503,
      expectedErrorCode: 'WORKSPACE_EDGE_AUTH_REQUIRED',
    },
  ] satisfies Array<{
    name: string;
    resolution: WorkspaceCloudflareEdgeRouteResolution;
    expectedStatus: 404 | 503;
    expectedErrorCode: string;
  }>)('should not serve cached site snapshots when D1 policy returns $name', async ({
    resolution,
    expectedStatus,
    expectedErrorCode,
  }) => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    let resolveCount = 0;
    const cacheKeys: string[] = [];
    const router = createWorkspaceCloudflareEdgeRouter({
      registry: {
        async resolve() {
          resolveCount += 1;

          return resolution;
        },
      },
      siteSnapshots: {
        cache: createAuthoritativeSiteSnapshotCache({
          onMatch: (request) => cacheKeys.push(request.url),
        }),
      },
    });

    const response = await router.fetch(
      new Request('https://kokayi.consuelohq.com/?utm_source=noise'),
    );
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(expectedStatus);
    expect(body.error.code).toBe(expectedErrorCode);
    expect(JSON.stringify(body)).not.toMatch(/cached launcher|manifestKey|bucket|sites\/workspace_123|token|secret/i);
    expect(resolveCount).toBe(1);
    expect(cacheKeys).toEqual([]);
  });

  it('should serve static-shell D1 site snapshots from R2 without populating the edge cache', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const upstreamRequests: Request[] = [];
    const cachePuts: Array<{ url: string; body: string }> = [];
    const siteCache: WorkspaceSitesEdgeCache = {
      async match() {
        return null;
      },
      async put(request, response) {
        cachePuts.push({ url: request.url, body: await response.clone().text() });
      },
    };
    const r2Reads: string[] = [];
    const siteR2: WorkspaceSitesEdgeR2Bucket = {
      async get(key) {
        r2Reads.push(key);
        if (key !== 'sites/workspace_123/launcher/version_1/index.html') return null;
        return { text: async () => '<!doctype html><title>edge launcher</title>' };
      },
    };
    const registry: WorkspaceCloudflareEdgeRouteRegistry = {
      async resolve() {
        return {
          allowed: true,
          workspaceId: 'workspace_123',
          hostname: 'kokayi.consuelohq.com',
          route: '/',
          surface: 'sites',
          auth: 'public',
          auditEvent: 'workspace.hostname.route.allowed',
          target: {
            kind: 'site-snapshot',
            siteId: 'launcher',
            versionId: 'version_1',
            manifestKey: 'sites/workspace_123/launcher/version_1/index.html',
            contentType: 'text/html; charset=utf-8',
            cachePolicy: 'static-shell',
          },
        };
      },
    };
    const router = createWorkspaceCloudflareEdgeRouter({
      registry,
      siteSnapshots: { cache: siteCache, r2: siteR2 },
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return new Response('unexpected upstream', { status: 200 });
      },
    });

    const response = await router.fetch(
      new Request('https://kokayi.consuelohq.com/?utm_source=noise'),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('edge launcher');
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-consuelo-sites-cache')).toBe('miss');
    expect(response.headers.get('x-consuelo-edge-cache-authority')).toBe('sites-snapshot');
    expect(cachePuts).toEqual([]);
    expect(r2Reads).toEqual(['sites/workspace_123/launcher/version_1/index.html']);
    expect(upstreamRequests).toHaveLength(0);
  });

  it('should fail closed when a site snapshot cannot be read', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const registry: WorkspaceCloudflareEdgeRouteRegistry = {
      async resolve() {
        return {
          allowed: true,
          workspaceId: 'workspace_123',
          hostname: 'kokayi.consuelohq.com',
          route: '/',
          surface: 'sites',
          auth: 'public',
          auditEvent: 'workspace.hostname.route.allowed',
          target: {
            kind: 'site-snapshot',
            siteId: 'launcher',
            versionId: 'version_1',
            manifestKey: 'sites/workspace_123/launcher/version_1/index.html',
            cachePolicy: 'static-shell',
          },
        };
      },
    };
    const router = createWorkspaceCloudflareEdgeRouter({
      registry,
      siteSnapshots: { r2: { get: async () => null } },
    });

    const response = await router.fetch(new Request('https://kokayi.consuelohq.com/'));

    expect(response.status).toBe(503);
    const body = JSON.stringify(await response.json());
    expect(body).toContain('WORKSPACE_SITE_SNAPSHOT_UNAVAILABLE');
    expect(body).not.toMatch(/manifestKey|bucket|sites\/workspace_123|secret/i);
  });
});
