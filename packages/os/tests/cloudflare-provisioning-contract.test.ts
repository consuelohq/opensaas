import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type WorkspaceCloudflareProvisioningInput = {
  workspaceId: string;
  workspaceSlug: string;
  baseDomain: string;
  cloudflareZoneId: string;
  connectorId: string;
  dialerUpstreamUrl?: string;
};

type WorkspaceCloudflareProvisioningClient = {
  createOrReuseTunnel: (input: {
    name: string;
    connectorId: string;
  }) => Promise<{
    tunnelId: string;
    tunnelCredential: string;
    connectorCredentialId: string;
  }>;
  putTunnelConfig: (input: {
    tunnelId: string;
    hostname: string;
    localServiceUrl: string;
  }) => Promise<void>;
  createOrReuseDnsRecord: (input: {
    zoneId: string;
    name: string;
    type: 'CNAME';
    content: string;
    proxied: boolean;
  }) => Promise<{ recordId: string }>;
};

type WorkspaceCloudflareProvisioningPlan = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceHostname: string;
  osTunnelHostname: string;
  provider: 'cloudflare';
  owner: 'consuelo-os-cloud';
  cloudflare: {
    zoneId: string;
    tunnelName: string;
    workspaceDnsRecord: { name: string };
    osTunnelDnsRecord: { name: string };
  };
  routes: Array<{
    surface: 'os' | 'dialer' | 'app' | 'sites' | 'twenty';
    pathPrefix: string;
    auth: 'required';
    target: Record<string, unknown>;
  }>;
};

type WorkspaceCloudflareProvisioningResult = {
  workspaceHostname: string;
  osTunnelHostname: string;
  connectorBootstrap: {
    connectorId: string;
    tunnelId: string;
    tunnelCredential: string;
  };
  registryRecord: Record<string, unknown>;
};

type WorkspaceCloudflareProvisioningContract = {
  planWorkspaceCloudflareProvisioning: (
    input: WorkspaceCloudflareProvisioningInput,
  ) => WorkspaceCloudflareProvisioningPlan;
  applyWorkspaceCloudflareProvisioning: (input: {
    cloudflare: WorkspaceCloudflareProvisioningClient;
    input: WorkspaceCloudflareProvisioningInput;
  }) => Promise<WorkspaceCloudflareProvisioningResult>;
};

const runContract =
  process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

async function loadWorkspaceCloudflareProvisioningContract(): Promise<WorkspaceCloudflareProvisioningContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'workspace-cloudflare-provisioning.ts'),
  ).href;
  const module = (await import(
    modulePath
  )) as Partial<WorkspaceCloudflareProvisioningContract>;
  const requiredExports: Array<keyof WorkspaceCloudflareProvisioningContract> = [
    'planWorkspaceCloudflareProvisioning',
    'applyWorkspaceCloudflareProvisioning',
  ];
  const missingExports = requiredExports.filter(
    (name) => typeof module[name] !== 'function',
  );

  if (missingExports.length > 0) {
    throw new Error(
      `workspace Cloudflare provisioning contract module is missing exports: ${missingExports.join(', ')}`,
    );
  }

  return module as WorkspaceCloudflareProvisioningContract;
}

contractDescribe('workspace Cloudflare provisioning contract', () => {
  it('should plan one workspace hostname with hidden OS tunnel origin and Dialer routes', async () => {
    const { planWorkspaceCloudflareProvisioning } =
      await loadWorkspaceCloudflareProvisioningContract();
    const plan = planWorkspaceCloudflareProvisioning({
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      baseDomain: 'consuelohq.com',
      cloudflareZoneId: 'zone_123',
      connectorId: 'connector_123',
      dialerUpstreamUrl: 'https://dialer-production.up.railway.app',
    });

    expect(plan).toMatchObject({
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      workspaceHostname: 'kokayi.consuelohq.com',
      osTunnelHostname: 'connector-123.os-origin.consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      cloudflare: {
        zoneId: 'zone_123',
      },
    });

    expect(plan.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          surface: 'os',
          pathPrefix: '/mcp',
          auth: 'required',
          target: expect.objectContaining({
            kind: 'os-connector',
            connectorId: 'connector_123',
          }),
        }),
        expect.objectContaining({
          surface: 'os',
          pathPrefix: '/traces',
          auth: 'required',
          target: expect.objectContaining({
            kind: 'os-connector',
            connectorId: 'connector_123',
          }),
        }),
        expect.objectContaining({
          surface: 'dialer',
          pathPrefix: '/dialer',
          auth: 'required',
          target: expect.objectContaining({
            kind: 'service-upstream',
            service: 'dialer',
            upstreamUrl: 'https://dialer-production.up.railway.app',
          }),
        }),
      ]),
    );
  });

  it('should apply Cloudflare tunnel and DNS operations without Railway DNS provisioning', async () => {
    const { applyWorkspaceCloudflareProvisioning } =
      await loadWorkspaceCloudflareProvisioningContract();
    const calls: Array<{ operation: string; key: string; body?: unknown }> = [];
    const cloudflare: WorkspaceCloudflareProvisioningClient = {
      async createOrReuseTunnel(input) {
        calls.push({ operation: 'createOrReuseTunnel', key: input.name, body: input });
        return {
          tunnelId: 'tunnel_123',
          tunnelCredential: 'credential_fixture',
          connectorCredentialId: 'connector_credential_123',
        };
      },
      async putTunnelConfig(input) {
        calls.push({ operation: 'putTunnelConfig', key: input.tunnelId, body: input });
      },
      async createOrReuseDnsRecord(input) {
        calls.push({ operation: 'createOrReuseDnsRecord', key: input.name, body: input });
        return { recordId: `dns_${input.name}` };
      },
    };

    const result = await applyWorkspaceCloudflareProvisioning({
      cloudflare,
      input: {
        workspaceId: 'workspace_123',
        workspaceSlug: 'kokayi',
        baseDomain: 'consuelohq.com',
        cloudflareZoneId: 'zone_123',
        connectorId: 'connector_123',
        dialerUpstreamUrl: 'https://dialer-production.up.railway.app',
      },
    });

    expect(calls.map((call) => call.operation)).toEqual([
      'createOrReuseTunnel',
      'putTunnelConfig',
      'createOrReuseDnsRecord',
      'createOrReuseDnsRecord',
    ]);
    expect(calls.some((call) => /railway/i.test(call.operation))).toBe(false);
    expect(result.workspaceHostname).toBe('kokayi.consuelohq.com');
    expect(result.osTunnelHostname).toBe('connector-123.os-origin.consuelohq.com');
    expect(result.connectorBootstrap).toMatchObject({
      connectorId: 'connector_123',
      tunnelId: 'tunnel_123',
      tunnelCredential: 'credential_fixture',
    });
    expect(JSON.stringify(result.registryRecord)).not.toContain('credential_fixture');
  });

  it('should keep client bootstrap credentials separate from durable registry data', async () => {
    const { applyWorkspaceCloudflareProvisioning } =
      await loadWorkspaceCloudflareProvisioningContract();
    const cloudflare: WorkspaceCloudflareProvisioningClient = {
      async createOrReuseTunnel() {
        return {
          tunnelId: 'tunnel_123',
          tunnelCredential: 'credential_fixture',
          connectorCredentialId: 'connector_credential_123',
        };
      },
      async putTunnelConfig() {},
      async createOrReuseDnsRecord(input) {
        return { recordId: `dns_${input.name}` };
      },
    };

    const result = await applyWorkspaceCloudflareProvisioning({
      cloudflare,
      input: {
        workspaceId: 'workspace_123',
        workspaceSlug: 'kokayi',
        baseDomain: 'consuelohq.com',
        cloudflareZoneId: 'zone_123',
        connectorId: 'connector_123',
        dialerUpstreamUrl: 'https://dialer-production.up.railway.app',
      },
    });

    expect(result.connectorBootstrap).toMatchObject({
      connectorId: 'connector_123',
      tunnelId: 'tunnel_123',
      tunnelCredential: 'credential_fixture',
    });
    expect(result.registryRecord).toMatchObject({
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      hostname: 'kokayi.consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
    });
    expect(JSON.stringify(result.registryRecord)).not.toMatch(/credential/i);
  });

  it('should produce idempotent Cloudflare keys for retries', async () => {
    const { planWorkspaceCloudflareProvisioning } =
      await loadWorkspaceCloudflareProvisioningContract();
    const first = planWorkspaceCloudflareProvisioning({
      workspaceId: 'workspace_123',
      workspaceSlug: 'Kokayi',
      baseDomain: 'https://consuelohq.com/',
      cloudflareZoneId: 'zone_123',
      connectorId: 'connector_123',
    });
    const second = planWorkspaceCloudflareProvisioning({
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      baseDomain: 'consuelohq.com',
      cloudflareZoneId: 'zone_123',
      connectorId: 'connector_123',
    });

    expect(first.workspaceHostname).toBe(second.workspaceHostname);
    expect(first.osTunnelHostname).toBe(second.osTunnelHostname);
    expect(first.cloudflare.tunnelName).toBe(second.cloudflare.tunnelName);
    expect(first.cloudflare.workspaceDnsRecord.name).toBe(
      second.cloudflare.workspaceDnsRecord.name,
    );
    expect(first.cloudflare.osTunnelDnsRecord.name).toBe(
      second.cloudflare.osTunnelDnsRecord.name,
    );
  });
});
