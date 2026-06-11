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
    };

type WorkspaceCloudflareEdgeRouteResolution =
  | {
      allowed: true;
      workspaceId: string;
      hostname: string;
      route: string;
      surface: 'os' | 'dialer' | 'app' | 'sites' | 'twenty';
      auth: 'required';
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
  }) => WorkspaceCloudflareEdgeRouter;
};

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
      new Request('https://kokayi.consuelohq.com/dialer/calls?limit=5'),
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
    expect(upstreamRequests[0].headers.get('x-consuelo-edge-signature')).toBe(
      'sha256=e9652e5ea05501c2fe16ca735512b3b24cf4c6850cfe9d43cc59b198b5388333',
    );
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
});
