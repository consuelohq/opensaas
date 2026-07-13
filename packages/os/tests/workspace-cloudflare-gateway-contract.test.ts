import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import type {
  CloudflareWorkspaceGatewayWebhookInput,
  CloudflareWorkspaceGatewayWebhookResult,
  WorkspaceGatewayProvisioningInput,
  WorkspaceGatewayProvisioningPlan,
  WorkspaceGatewayRouteInput,
  WorkspaceGatewayRouteResolution,
  WorkspaceHostnameRegistryInput,
  WorkspaceHostnameRegistryRecord,
  WorkspaceHostnameRegistryRouteInput,
  WorkspaceHostnameRegistryRouteResolution,
} from '../scripts/lib/workspace-cloudflare-gateway';

type WorkspaceCloudflareGatewayContract = {
  planWorkspaceGatewayProvisioning: (
    input: WorkspaceGatewayProvisioningInput,
  ) => WorkspaceGatewayProvisioningPlan;
  resolveWorkspaceGatewayRoute: (
    input: WorkspaceGatewayRouteInput,
  ) => WorkspaceGatewayRouteResolution;
  applyCloudflareWorkspaceGatewayWebhook: (
    input: CloudflareWorkspaceGatewayWebhookInput,
  ) => CloudflareWorkspaceGatewayWebhookResult;
  createWorkspaceHostnameRegistryRecord: (
    input: WorkspaceHostnameRegistryInput,
  ) => WorkspaceHostnameRegistryRecord;
  resolveWorkspaceHostnameRegistryRoute: (
    input: WorkspaceHostnameRegistryRouteInput,
  ) => WorkspaceHostnameRegistryRouteResolution;
};

const runContract =
  process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

async function loadWorkspaceGatewayContract(): Promise<WorkspaceCloudflareGatewayContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'workspace-cloudflare-gateway.ts'),
  ).href;
  const module = (await import(
    modulePath
  )) as Partial<WorkspaceCloudflareGatewayContract>;
  const requiredExports: Array<keyof WorkspaceCloudflareGatewayContract> = [
    'planWorkspaceGatewayProvisioning',
    'resolveWorkspaceGatewayRoute',
    'applyCloudflareWorkspaceGatewayWebhook',
    'createWorkspaceHostnameRegistryRecord',
    'resolveWorkspaceHostnameRegistryRoute',
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

contractDescribe(
  'OS-owned Cloudflare-managed workspace gateway contract',
  () => {
    it('should plan a Cloudflare custom hostname when a workspace gateway is requested', async () => {
      const gateway = await loadWorkspaceGatewayContract();

      const plan = gateway.planWorkspaceGatewayProvisioning({
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
          method: 'GET',
          path: '/traces',
          gateways: [
            {
              workspaceId: 'workspace-acme',
              hostname: 'acme.consuelohq.com',
              connectorId: 'connector-local-os-1',
              connectorStatus: 'disconnected',
              allowedRoutes: ['/traces'],
            },
          ],
        }),
      ).toEqual({
        allowed: false,
        status: 503,
        errorCode: 'WORKSPACE_GATEWAY_CONNECTOR_OFFLINE',
        auditEvent: 'workspace.gateway.route.denied',
      });
    });

    it('should accept managed Cloudflare hostname webhooks for the Consuelo zone', async () => {
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

    it('should create one OS-owned hostname registry record for OS and Dialer routes', async () => {
      const gateway = await loadWorkspaceGatewayContract();

      const record = gateway.createWorkspaceHostnameRegistryRecord({
        workspaceId: 'workspace-acme',
        workspaceSlug: 'acme',
        baseDomain: 'consuelohq.com',
        osConnectorId: 'connector-local-os-1',
        osConnectorStatus: 'connected',
        dialerUpstreamUrl: 'https://dialer-production.up.railway.app',
      });

      expect(record).toMatchObject({
        workspaceId: 'workspace-acme',
        workspaceSlug: 'acme',
        hostname: 'acme.consuelohq.com',
        baseDomain: 'consuelohq.com',
        provider: 'cloudflare',
        routeMode: 'workspace-subdomain',
        owner: 'consuelo-os-cloud',
      });
      expect(record.routes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            surface: 'os',
            pathPrefix: '/mcp',
            auth: 'required',
            target: {
              kind: 'os-connector',
              connectorId: 'connector-local-os-1',
              connectorStatus: 'connected',
            },
          }),
          expect.objectContaining({
            surface: 'dialer',
            pathPrefix: '/dialer',
            auth: 'required',
            target: {
              kind: 'service-upstream',
              service: 'dialer',
              upstreamUrl: 'https://dialer-production.up.railway.app',
            },
          }),
        ]),
      );
    });

    it('should resolve both OS and Dialer routes from the OS-owned hostname registry', async () => {
      const gateway = await loadWorkspaceGatewayContract();
      const record = gateway.createWorkspaceHostnameRegistryRecord({
        workspaceId: 'workspace-acme',
        workspaceSlug: 'acme',
        baseDomain: 'consuelohq.com',
        osConnectorId: 'connector-local-os-1',
        osConnectorStatus: 'connected',
        dialerUpstreamUrl: 'https://dialer-production.up.railway.app',
      });

      expect(
        gateway.resolveWorkspaceHostnameRegistryRoute({
          host: 'acme.consuelohq.com',
          path: '/mcp/call',
          records: [record],
        }),
      ).toMatchObject({
        allowed: true,
        workspaceId: 'workspace-acme',
        hostname: 'acme.consuelohq.com',
        route: '/mcp',
        surface: 'os',
        auth: 'required',
        auditEvent: 'workspace.hostname.route.allowed',
      });

      expect(
        gateway.resolveWorkspaceHostnameRegistryRoute({
          host: 'acme.consuelohq.com',
          path: '/dialer/calls',
          records: [record],
        }),
      ).toMatchObject({
        allowed: true,
        workspaceId: 'workspace-acme',
        hostname: 'acme.consuelohq.com',
        route: '/dialer',
        surface: 'dialer',
        auth: 'required',
        target: {
          kind: 'service-upstream',
          service: 'dialer',
          upstreamUrl: 'https://dialer-production.up.railway.app',
        },
        auditEvent: 'workspace.hostname.route.allowed',
      });
    });
  },
);
