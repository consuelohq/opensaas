import { describe, expect, it } from 'vitest';

import {
  applyWorkspaceCloudflareProvisioning,
  planWorkspaceCloudflareProvisioning,
  type WorkspaceCloudflareProvisioningClient,
} from '../scripts/lib/workspace-cloudflare-provisioning';

describe('workspace Cloudflare provisioning contract', () => {
  it('should plan one workspace hostname with hidden OS tunnel origin and Dialer routes', () => {
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
