type WorkspaceGatewayProvisioningInput = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceDisplayName: string;
  baseDomain: string;
  cloudflareZoneId: string;
  osConnectorId: string;
};

type WorkspaceGatewayProvisioningPlan = {
  workspaceId: string;
  hostname: string;
  provider: 'cloudflare';
  routeMode: 'workspace-subdomain';
  connectorMode: 'outbound-os-connector';
  cloudflare: {
    zoneId: string;
    customHostname: {
      hostname: string;
      ssl: {
        method: 'txt';
        type: 'dv';
        settings: {
          min_tls_version: '1.2';
          tls_1_3: 'on';
          http2: 'on';
        };
      };
    };
  };
  publicRoutes: Array<{
    path: string;
    auth: 'required';
    workspaceId: string;
    connectorId: string;
  }>;
};

type WorkspaceGatewayRouteInput = {
  host: string;
  method: 'GET' | 'POST';
  path: string;
  gateways: Array<{
    workspaceId: string;
    hostname: string;
    connectorId: string;
    connectorStatus: 'connected' | 'disconnected';
    allowedRoutes: string[];
  }>;
};

type WorkspaceGatewayRouteResolution =
  | {
      allowed: true;
      workspaceId: string;
      connectorId: string;
      route: string;
      targetPath: string;
      auth: 'required';
      auditEvent: 'workspace.gateway.route.allowed';
    }
  | {
      allowed: false;
      status: 401 | 404 | 503;
      errorCode: string;
      auditEvent: 'workspace.gateway.route.denied';
    };

type CloudflareWorkspaceGatewayWebhookInput = {
  allowedZoneIds: string[];
  event: {
    data?: {
      data?: {
        hostname?: string;
        ssl?: { status?: string };
        status?: string;
      };
      metadata?: { zone?: { id?: string } };
    };
  };
  gateways: Array<{
    workspaceId: string;
    hostname: string;
    status: 'pending' | 'active' | 'error';
  }>;
};

type CloudflareWorkspaceGatewayWebhookResult =
  | {
      handled: true;
      workspaceId: string;
      hostname: string;
      status: 'active' | 'pending' | 'error';
      certificateStatus: string;
      auditEvent: 'workspace.gateway.cloudflare.updated';
    }
  | {
      handled: false;
      reason: 'unknown-zone' | 'unknown-hostname' | 'missing-hostname';
    };

type WorkspaceCloudflareGatewayContract = {
  planWorkspaceGatewayProvisioning: (
    input: WorkspaceGatewayProvisioningInput,
  ) =>
    | Promise<WorkspaceGatewayProvisioningPlan>
    | WorkspaceGatewayProvisioningPlan;
  resolveWorkspaceGatewayRoute: (
    input: WorkspaceGatewayRouteInput,
  ) => WorkspaceGatewayRouteResolution;
  applyCloudflareWorkspaceGatewayWebhook: (
    input: CloudflareWorkspaceGatewayWebhookInput,
  ) =>
    | Promise<CloudflareWorkspaceGatewayWebhookResult>
    | CloudflareWorkspaceGatewayWebhookResult;
};

const runContract =
  process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

async function loadWorkspaceGatewayContract(): Promise<WorkspaceCloudflareGatewayContract> {
  const module =
    (await import('src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.service')) as Partial<WorkspaceCloudflareGatewayContract>;
  const requiredExports: Array<keyof WorkspaceCloudflareGatewayContract> = [
    'planWorkspaceGatewayProvisioning',
    'resolveWorkspaceGatewayRoute',
    'applyCloudflareWorkspaceGatewayWebhook',
  ];
  const missingExports = requiredExports.filter(
    (name) => typeof module[name] !== 'function',
  );

  if (missingExports.length > 0) {
    throw new Error(
      `workspace Cloudflare gateway contract module is missing exports: ${missingExports.join(', ')}`,
    );
  }

  return module as WorkspaceCloudflareGatewayContract;
}

contractDescribe('Cloudflare-managed workspace gateway contract', () => {
  it('should plan a Cloudflare custom hostname when a workspace gateway is requested', async () => {
    const gateway = await loadWorkspaceGatewayContract();

    const plan = await gateway.planWorkspaceGatewayProvisioning({
      workspaceId: 'workspace-acme',
      workspaceSlug: 'acme',
      workspaceDisplayName: 'Acme Inc',
      baseDomain: 'consuelohq.com',
      cloudflareZoneId: 'zone_consuelo_public',
      osConnectorId: 'connector-local-os-1',
    });

    expect(plan).toMatchObject({
      workspaceId: 'workspace-acme',
      hostname: 'acme.consuelohq.com',
      provider: 'cloudflare',
      routeMode: 'workspace-subdomain',
      connectorMode: 'outbound-os-connector',
      cloudflare: {
        zoneId: 'zone_consuelo_public',
        customHostname: {
          hostname: 'acme.consuelohq.com',
          ssl: {
            method: 'txt',
            type: 'dv',
            settings: {
              min_tls_version: '1.2',
              tls_1_3: 'on',
              http2: 'on',
            },
          },
        },
      },
    });
    expect(plan.publicRoutes.map((route) => route.path).sort()).toEqual([
      '/api',
      '/apps/chatgpt',
      '/diffs',
      '/mcp',
      '/office',
      '/tools',
      '/traces',
      '/wiki',
    ]);
    expect(plan.publicRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/mcp',
          auth: 'required',
          workspaceId: 'workspace-acme',
          connectorId: 'connector-local-os-1',
        }),
      ]),
    );
  });

  it('should route an approved public workspace path when the local OS connector is online', async () => {
    const gateway = await loadWorkspaceGatewayContract();

    const route = gateway.resolveWorkspaceGatewayRoute({
      host: 'acme.consuelohq.com',
      method: 'POST',
      path: '/mcp/call',
      gateways: [
        {
          workspaceId: 'workspace-acme',
          hostname: 'acme.consuelohq.com',
          connectorId: 'connector-local-os-1',
          connectorStatus: 'connected',
          allowedRoutes: [
            '/office',
            '/diffs',
            '/wiki',
            '/traces',
            '/tools',
            '/api',
            '/mcp',
            '/apps/chatgpt',
          ],
        },
      ],
    });

    expect(route).toEqual({
      allowed: true,
      workspaceId: 'workspace-acme',
      connectorId: 'connector-local-os-1',
      route: '/mcp',
      targetPath: '/mcp/call',
      auth: 'required',
      auditEvent: 'workspace.gateway.route.allowed',
    });
  });

  it('should fail closed when a workspace host or path is unknown', async () => {
    const gateway = await loadWorkspaceGatewayContract();
    const gateways = [
      {
        workspaceId: 'workspace-acme',
        hostname: 'acme.consuelohq.com',
        connectorId: 'connector-local-os-1',
        connectorStatus: 'connected' as const,
        allowedRoutes: [
          '/office',
          '/diffs',
          '/wiki',
          '/traces',
          '/tools',
          '/api',
          '/mcp',
          '/apps/chatgpt',
        ],
      },
    ];

    expect(
      gateway.resolveWorkspaceGatewayRoute({
        host: 'unknown.consuelohq.com',
        method: 'GET',
        path: '/office',
        gateways,
      }),
    ).toMatchObject({
      allowed: false,
      status: 404,
      errorCode: 'WORKSPACE_GATEWAY_NOT_FOUND',
      auditEvent: 'workspace.gateway.route.denied',
    });

    expect(
      gateway.resolveWorkspaceGatewayRoute({
        host: 'acme.consuelohq.com',
        method: 'GET',
        path: '/admin/private',
        gateways,
      }),
    ).toMatchObject({
      allowed: false,
      status: 404,
      errorCode: 'WORKSPACE_GATEWAY_ROUTE_NOT_FOUND',
      auditEvent: 'workspace.gateway.route.denied',
    });
  });

  it('should fail closed when the local OS connector is disconnected', async () => {
    const gateway = await loadWorkspaceGatewayContract();

    expect(
      gateway.resolveWorkspaceGatewayRoute({
        host: 'acme.consuelohq.com',
        method: 'POST',
        path: '/mcp/call',
        gateways: [
          {
            workspaceId: 'workspace-acme',
            hostname: 'acme.consuelohq.com',
            connectorId: 'connector-local-os-1',
            connectorStatus: 'disconnected',
            allowedRoutes: ['/mcp'],
          },
        ],
      }),
    ).toMatchObject({
      allowed: false,
      status: 503,
      errorCode: 'WORKSPACE_GATEWAY_CONNECTOR_OFFLINE',
      auditEvent: 'workspace.gateway.route.denied',
    });
  });

  it('should update only the owning workspace gateway when Cloudflare confirms hostname health', async () => {
    const gateway = await loadWorkspaceGatewayContract();

    await expect(
      Promise.resolve(
        gateway.applyCloudflareWorkspaceGatewayWebhook({
          allowedZoneIds: ['zone_consuelo_public'],
          event: {
            data: {
              metadata: { zone: { id: 'zone_consuelo_public' } },
              data: {
                hostname: 'acme.consuelohq.com',
                status: 'active',
                ssl: { status: 'active' },
              },
            },
          },
          gateways: [
            {
              workspaceId: 'workspace-acme',
              hostname: 'acme.consuelohq.com',
              status: 'pending',
            },
          ],
        }),
      ),
    ).resolves.toEqual({
      handled: true,
      workspaceId: 'workspace-acme',
      hostname: 'acme.consuelohq.com',
      status: 'active',
      certificateStatus: 'active',
      auditEvent: 'workspace.gateway.cloudflare.updated',
    });
  });

  it('should ignore Cloudflare webhooks from unmanaged zones', async () => {
    const gateway = await loadWorkspaceGatewayContract();

    await expect(
      Promise.resolve(
        gateway.applyCloudflareWorkspaceGatewayWebhook({
          allowedZoneIds: ['zone_consuelo_public'],
          event: {
            data: {
              metadata: { zone: { id: 'zone_untrusted' } },
              data: {
                hostname: 'acme.consuelohq.com',
                status: 'active',
                ssl: { status: 'active' },
              },
            },
          },
          gateways: [
            {
              workspaceId: 'workspace-acme',
              hostname: 'acme.consuelohq.com',
              status: 'pending',
            },
          ],
        }),
      ),
    ).resolves.toEqual({
      handled: false,
      reason: 'unknown-zone',
    });
  });
});
