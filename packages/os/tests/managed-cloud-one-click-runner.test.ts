import { describe, expect, it } from 'bun:test';

import { runManagedCloudNodeEnrollment } from '../scripts/lib/managed-cloud-node-enrollment';
import { runManagedCloudProvisioningOnce } from '../scripts/lib/managed-cloud-provisioning-runner';
import type { ManagedCloudNodeReleaseBootstrap } from '../scripts/lib/managed-cloud-node';

const release = {
  channel: 'dev',
  baseUrl: 'gs://consuelo-release-test/dev',
  bootstrapBundleUrl: 'gs://consuelo-release-test/dev/bootstrap.tgz',
  bootstrapBundleDigest: 'sha256:' + 'a'.repeat(64),
  bootstrapBundleId: 'sha256:' + 'b'.repeat(64),
  bootstrapBundleVersion: '0.1.0-test',
  cloudflaredBinaryUrl: 'https://example.com/cloudflared',
  cloudflaredBinaryDigest: 'sha256:' + 'c'.repeat(64),
  cloudflaredVersion: 'test',
  caddyArchiveUrl: 'https://example.com/caddy.tgz',
  caddyArchiveDigest: 'sha256:' + 'd'.repeat(64),
  caddyVersion: 'test',
  trustedPublicKeys: { test: 'public-key' },
} satisfies ManagedCloudNodeReleaseBootstrap;

describe('managed cloud one-click provisioning runner', () => {
  it('maps the public plan to the private machine profile and passes one-time enrollment to the existing provisioner', async () => {
    const updates: Array<Record<string, unknown>> = [];
    const provisionCalls: Array<Record<string, unknown>> = [];
    const result = await runManagedCloudProvisioningOnce({
      projectId: 'consuelo-managed-cloud',
      release,
      authority: {
        claim: async () => ({
          job: {
            jobId: 'mcpj_test',
            nodeId: 'node_test',
            nodeName: 'Cloud',
            planId: 'standard',
            region: 'us-east1',
            pricingVersion: 'pricing-v1',
            monthlyPriceCents: 9900,
            currency: 'USD',
            status: 'provisioning',
            createdAt: 1,
            updatedAt: 1,
          },
          workspace: {
            workspaceId: 'workspace_test',
            workspaceSlug: 'test',
            workspaceHost: 'test.consuelohq.com',
          },
          leaseId: 'lease_test',
          enrollmentToken: 'enrollment_token_test',
        }),
        update: async (input) => {
          updates.push(input);
        },
      },
      provision: async (input) => {
        provisionCalls.push(input as unknown as Record<string, unknown>);
        return { status: 'provisioned', plan: {} as never, operations: [] };
      },
    });

    expect(result).toEqual({ status: 'provisioned', jobId: 'mcpj_test', nodeId: 'node_test' });
    expect(provisionCalls).toHaveLength(1);
    expect(provisionCalls[0]).toMatchObject({
      projectId: 'consuelo-managed-cloud',
      workspaceId: 'workspace_test',
      workspaceSlug: 'test',
      workspaceHost: 'test.consuelohq.com',
      nodeId: 'node_test',
      nodeName: 'Cloud',
      region: 'us-east1',
      machineType: 'e2-standard-2',
      provisioningEnrollment: {
        jobId: 'mcpj_test',
        enrollmentToken: 'enrollment_token_test',
      },
    });
    expect(updates).toEqual([
      { jobId: 'mcpj_test', leaseId: 'lease_test', status: 'booting' },
    ]);
  });

  it('uses the one-click credential path without requesting an interactive device code', async () => {
    let requestedDeviceCode = false;
    const provisions: Array<Record<string, unknown>> = [];
    const activations: Array<Record<string, unknown>> = [];
    const statuses: Array<Record<string, unknown>> = [];
    const deviceKeyPair = {
      algorithm: 'Ed25519' as const,
      publicKeyJwk: '{"kty":"OKP","crv":"Ed25519","x":"public"}',
      signingKeyJwk: '{"kty":"OKP","crv":"Ed25519","x":"public","d":"private"}',
    };

    const result = await runManagedCloudNodeEnrollment({
      home: '/var/lib/consuelo',
      onboarding: {
        workspaceId: 'workspace_test',
        workspaceSlug: 'test',
        workspaceHost: 'test.consuelohq.com',
        nodeId: 'node_test',
        nodeName: 'Cloud',
        authorityOrigin: 'https://os.consuelohq.com',
        provisioningJobId: 'mcpj_test',
        provisioningEnrollmentToken: 'enrollment_token_test',
      },
      dependencies: {
        loadOrCreateDeviceKeyPair: () => deviceKeyPair,
        enrollProvisioningCredential: async (input) => {
          expect(input.deviceKeyPair).toEqual(deviceKeyPair);
          expect(input.onboarding.provisioningJobId).toBe('mcpj_test');
          return {
            workspaceId: 'workspace_test',
            workspaceSlug: 'test',
            workspaceHost: 'test.consuelohq.com',
            nodeId: 'node_test',
            nodeName: 'Cloud',
            nodeRole: 'home',
            nodeStatus: 'created',
            nodePublicKeyJwk: deviceKeyPair.publicKeyJwk,
            nodeSigningKeyJwk: deviceKeyPair.signingKeyJwk,
            nodeCapabilities: ['mcp', 'tools'],
            authorityOrigin: 'https://os.consuelohq.com',
            connectorId: 'connector_node_test',
            connectorTransport: 'cloudflare-tunnel',
            connectorBootstrapToken: 'connector-bootstrap',
            edgeRequestSigningSecret: 'edge-secret',
            cloudflareTunnelToken: 'tunnel-token',
          };
        },
        requestDeviceCode: async () => {
          requestedDeviceCode = true;
          throw new Error('interactive device code should not be requested');
        },
        pollAccessToken: async () => {
          throw new Error('interactive device polling should not run');
        },
        provision: (input) => {
          provisions.push(input as unknown as Record<string, unknown>);
          return {};
        },
        activateHeartbeat: async (input) => {
          activations.push(input);
        },
        now: () => 1,
        sleep: async () => {},
        writeStatus: (status) => statuses.push(status as unknown as Record<string, unknown>),
      },
    });

    expect(requestedDeviceCode).toBe(false);
    expect(result).toEqual({
      status: 'enrolled',
      workspaceId: 'workspace_test',
      nodeId: 'node_test',
      connectorId: 'connector_node_test',
    });
    expect(provisions[0]).toMatchObject({
      home: '/var/lib/consuelo',
      mode: 'cloud',
      platform: 'linux',
      workspaceBootstrap: { connectorId: 'connector_node_test' },
    });
    expect(activations).toEqual([{ home: '/var/lib/consuelo', connectorId: 'connector_node_test' }]);
    expect(statuses.at(-1)).toMatchObject({ phase: 'enrolled', nodeId: 'node_test' });
  });
});
