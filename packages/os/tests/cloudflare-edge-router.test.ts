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

type WorkspaceMcpCredentialValidationResult =
  | {
      allowed: true;
      credentialId: string;
      workspaceId: string;
      connectorId: string;
      subjectId: string;
      scopes: string[];
    }
  | {
      allowed: false;
      status: 401 | 403;
      errorCode: string;
    };

type WorkspaceMcpConnectionCredentialStore = {
  validate: (input: {
    credential: string;
    workspaceId: string;
    connectorId: string;
    requiredScope: string;
    now: string;
  }) => Promise<WorkspaceMcpCredentialValidationResult>;
};

type WorkspaceMcpProviderNetworkPolicy = {
  allowedCidrs: string[];
  sourceIpHeader?: string;
};

type WorkspaceCloudflareEdgeRouterContract = {
  createWorkspaceCloudflareEdgeRouter: (input: {
    registry: WorkspaceCloudflareEdgeRouteRegistry;
    internalSigningSecret?: string;
    fetchUpstream?: (request: Request) => Promise<Response>;
    siteSnapshots?: WorkspaceSitesSnapshotStore;
    mcpConnectionCredentials?: WorkspaceMcpConnectionCredentialStore;
    mcpProviderNetwork?: WorkspaceMcpProviderNetworkPolicy;
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

function createFixtureMcpCredentialStore(records: Record<string, {
  credentialId: string;
  workspaceId: string;
  connectorId: string;
  subjectId: string;
  scopes: string[];
  status: 'active' | 'rotated' | 'revoked';
}>): WorkspaceMcpConnectionCredentialStore & { seen: Array<{ credential: string; workspaceId: string; connectorId: string; requiredScope: string }> } {
  const seen: Array<{ credential: string; workspaceId: string; connectorId: string; requiredScope: string }> = [];

  return {
    seen,
    async validate(input) {
      seen.push({
        credential: input.credential,
        workspaceId: input.workspaceId,
        connectorId: input.connectorId,
        requiredScope: input.requiredScope,
      });
      const record = records[input.credential];
      if (!record) {
        return { allowed: false, status: 401, errorCode: 'WORKSPACE_MCP_CREDENTIAL_INVALID' };
      }
      if (record.status === 'rotated') {
        return { allowed: false, status: 401, errorCode: 'WORKSPACE_MCP_CREDENTIAL_ROTATED' };
      }
      if (record.status === 'revoked') {
        return { allowed: false, status: 401, errorCode: 'WORKSPACE_MCP_CREDENTIAL_REVOKED' };
      }
      if (record.workspaceId !== input.workspaceId) {
        return { allowed: false, status: 403, errorCode: 'WORKSPACE_MCP_CREDENTIAL_WORKSPACE_MISMATCH' };
      }
      if (record.connectorId !== input.connectorId) {
        return { allowed: false, status: 403, errorCode: 'WORKSPACE_MCP_CREDENTIAL_CONNECTOR_MISMATCH' };
      }
      if (!record.scopes.includes(input.requiredScope)) {
        return { allowed: false, status: 403, errorCode: 'WORKSPACE_MCP_CREDENTIAL_MISSING_SCOPE' };
      }
      return {
        allowed: true,
        credentialId: record.credentialId,
        workspaceId: record.workspaceId,
        connectorId: record.connectorId,
        subjectId: record.subjectId,
        scopes: [...record.scopes],
      };
    },
  };
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


  it('should reject MCP connector routes before proxying when credential validation is missing', async () => {
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
        return new Response('unexpected proxy', { status: 200 });
      },
    });

    const response = await router.fetch(
      new Request('https://kokayi.consuelohq.com/mcp/tools/call', {
        headers: { authorization: 'Bearer mcp_live_credential' },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'WORKSPACE_EDGE_AUTH_REQUIRED' },
    });
    expect(upstreamRequests).toHaveLength(0);
  });

  it('should validate persistent MCP credentials before proxying request bodies', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const upstreamRequests: Request[] = [];
    const credentials = createFixtureMcpCredentialStore({
      mcp_live_credential: {
        credentialId: 'mcpcred_123',
        workspaceId: 'workspace_123',
        connectorId: 'connector_123',
        subjectId: 'google:sub_123',
        scopes: ['route:/mcp:access'],
        status: 'active',
      },
    });
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
      mcpConnectionCredentials: credentials,
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return new Response('post ok', { status: 200 });
      },
    });

    const response = await router.fetch(
      new Request('https://kokayi.consuelohq.com/mcp/tools/call', {
        body: JSON.stringify({ tool: 'list' }),
        headers: {
          authorization: 'Bearer mcp_live_credential',
          'content-type': 'application/json',
          'x-consuelo-signature': 'caller-controlled-signature',
          'x-consuelo-token-id': 'caller-controlled-token',
        },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('post ok');
    expect(upstreamRequests).toHaveLength(1);
    expect(upstreamRequests[0].method).toBe('POST');
    expect(await upstreamRequests[0].text()).toBe('{"tool":"list"}');
    expect(credentials.seen).toEqual([
      {
        credential: 'mcp_live_credential',
        workspaceId: 'workspace_123',
        connectorId: 'connector_123',
        requiredScope: 'route:/mcp:access',
      },
    ]);
    expect(upstreamRequests[0].headers.get('authorization')).toBeNull();
    expect(upstreamRequests[0].headers.get('x-consuelo-signature')).not.toBe('caller-controlled-signature');
    expect(upstreamRequests[0].headers.get('x-consuelo-token-id')).toBeNull();
  });

  it('should allow persistent MCP credentials across requests and fail rotated, revoked, or unscoped credentials', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const upstreamRequests: Request[] = [];
    const credentials = createFixtureMcpCredentialStore({
      mcp_active: {
        credentialId: 'mcpcred_active',
        workspaceId: 'workspace_123',
        connectorId: 'connector_123',
        subjectId: 'google:sub_123',
        scopes: ['route:/mcp:access'],
        status: 'active',
      },
      mcp_rotated: {
        credentialId: 'mcpcred_rotated',
        workspaceId: 'workspace_123',
        connectorId: 'connector_123',
        subjectId: 'google:sub_123',
        scopes: ['route:/mcp:access'],
        status: 'rotated',
      },
      mcp_revoked: {
        credentialId: 'mcpcred_revoked',
        workspaceId: 'workspace_123',
        connectorId: 'connector_123',
        subjectId: 'google:sub_123',
        scopes: ['route:/mcp:access'],
        status: 'revoked',
      },
      mcp_missing_scope: {
        credentialId: 'mcpcred_missing_scope',
        workspaceId: 'workspace_123',
        connectorId: 'connector_123',
        subjectId: 'google:sub_123',
        scopes: ['route:/traces:read'],
        status: 'active',
      },
      mcp_wrong_workspace: {
        credentialId: 'mcpcred_wrong_workspace',
        workspaceId: 'workspace_other',
        connectorId: 'connector_123',
        subjectId: 'google:sub_123',
        scopes: ['route:/mcp:access'],
        status: 'active',
      },
    });
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
      mcpConnectionCredentials: credentials,
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return new Response('ok', { status: 200 });
      },
    });
    const call = (credential: string) => router.fetch(new Request('https://kokayi.consuelohq.com/mcp/tools/call', {
      headers: { authorization: `Bearer ${credential}` },
      method: 'POST',
    }));

    await expect(call('mcp_active')).resolves.toMatchObject({ status: 200 });
    await expect(call('mcp_active')).resolves.toMatchObject({ status: 200 });
    await expect((await call('mcp_rotated')).json()).resolves.toMatchObject({ error: { code: 'WORKSPACE_MCP_CREDENTIAL_ROTATED' } });
    await expect((await call('mcp_revoked')).json()).resolves.toMatchObject({ error: { code: 'WORKSPACE_MCP_CREDENTIAL_REVOKED' } });
    await expect((await call('mcp_missing_scope')).json()).resolves.toMatchObject({ error: { code: 'WORKSPACE_MCP_CREDENTIAL_MISSING_SCOPE' } });
    await expect((await call('mcp_wrong_workspace')).json()).resolves.toMatchObject({ error: { code: 'WORKSPACE_MCP_CREDENTIAL_WORKSPACE_MISMATCH' } });
    expect(upstreamRequests).toHaveLength(2);
  });

  it('should apply MCP provider egress IP allowlists as CIDR-only network guardrails', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    const upstreamRequests: Request[] = [];
    const credentials = createFixtureMcpCredentialStore({
      mcp_live_credential: {
        credentialId: 'mcpcred_123',
        workspaceId: 'workspace_123',
        connectorId: 'connector_123',
        subjectId: 'google:sub_123',
        scopes: ['route:/mcp:access'],
        status: 'active',
      },
    });
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
      mcpConnectionCredentials: credentials,
      mcpProviderNetwork: { allowedCidrs: ['203.0.113.0/24', '2001:db8:1234::/48'] },
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return new Response('ok', { status: 200 });
      },
    });

    const blocked = await router.fetch(new Request('https://kokayi.consuelohq.com/mcp/tools/list', {
      headers: {
        accept: 'text/html',
        authorization: 'Bearer mcp_live_credential',
        'cf-connecting-ip': '198.51.100.8',
      },
    }));
    expect(blocked.status).toBe(403);
    await expect(blocked.text()).resolves.toContain('This workspace is protected');

    const allowed = await router.fetch(new Request('https://kokayi.consuelohq.com/mcp/tools/list', {
      headers: {
        authorization: 'Bearer mcp_live_credential',
        'cf-connecting-ip': '203.0.113.42',
      },
    }));
    expect(allowed.status).toBe(200);
    expect(upstreamRequests).toHaveLength(1);
  });

  it('should fail closed when MCP provider network policy contains credentials instead of IP ranges', async () => {
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
      mcpConnectionCredentials: createFixtureMcpCredentialStore({}),
      mcpProviderNetwork: { allowedCidrs: ['api-key-value-not-an-ip-range'] },
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return new Response('unexpected proxy', { status: 200 });
      },
    });

    const response = await router.fetch(new Request('https://kokayi.consuelohq.com/mcp/tools/list', {
      headers: {
        authorization: 'Bearer mcp_live_credential',
        'cf-connecting-ip': '203.0.113.42',
      },
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'WORKSPACE_MCP_PROVIDER_POLICY_INVALID' },
    });
    expect(upstreamRequests).toHaveLength(0);
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
  it('should serve public site snapshots from edge cache before D1 resolution', async () => {
    const { createWorkspaceCloudflareEdgeRouter } =
      await loadWorkspaceCloudflareEdgeRouterContract();
    let resolveCount = 0;
    const cacheKeys: string[] = [];
    const siteCache: WorkspaceSitesEdgeCache = {
      async match(request) {
        cacheKeys.push(request.url);
        return new Response('<!doctype html><title>cached launcher</title>', {
          headers: {
            'cache-control': 'public, max-age=60, s-maxage=2592000, stale-while-revalidate=604800',
            'content-type': 'text/html; charset=utf-8',
            'x-consuelo-edge-cache-authority': 'sites-snapshot',
          },
        });
      },
      async put() {
        throw new Error('cache put should not run on a hit');
      },
    };
    const router = createWorkspaceCloudflareEdgeRouter({
      registry: {
        async resolve() {
          resolveCount += 1;
          throw new Error('D1 should not be consulted for a public cache hit');
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
    expect(resolveCount).toBe(0);
    expect(cacheKeys).toEqual(['https://kokayi.consuelohq.com/']);
  });

  it('should serve D1 site snapshots from R2 and populate the edge cache', async () => {
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
    expect(response.headers.get('cache-control') || '').toContain('s-maxage=2592000');
    expect(response.headers.get('x-consuelo-sites-cache')).toBe('miss');
    expect(response.headers.get('x-consuelo-edge-cache-authority')).toBe('sites-snapshot');
    expect(cachePuts).toEqual([
      {
        url: 'https://kokayi.consuelohq.com/',
        body: '<!doctype html><title>edge launcher</title>',
      },
    ]);
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

