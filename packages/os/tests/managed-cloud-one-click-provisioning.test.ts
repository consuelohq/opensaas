import { describe, expect, it } from 'bun:test';

import { createOsDeviceAuthorityHandler } from '../cloudflare/os-device-authority/src/app';
import { createMemoryDeviceGrantStore } from '../cloudflare/os-device-authority/src/stores';
import { devicePublicKeyThumbprint } from '../cloudflare/os-device-authority/src/utils';
import { generateWorkspaceDeviceKeyPair } from '../scripts/lib/workspace-device-login-client';
import {
  createInMemoryWorkspaceRouteD1,
  migrateWorkspaceRouteD1,
  resolveWorkspaceRouteFromD1,
} from '../scripts/lib/workspace-cloudflare-d1-route-registry';
import type { ManagedCloudProvisioningJob } from '../scripts/lib/managed-cloud-provisioning';

const nowMs = Date.parse('2026-08-13T12:00:00.000Z');
const accountId = 'account_cloud_first';
const workspaceId = 'workspace_cloud_first';
const workspaceSlug = 'cloud-first';
const workspaceHost = 'cloud-first.consuelohq.com';
const provisionerSecret = 'provisioner-secret-test';
const enrollmentSecret = 'enrollment-secret-test';

async function fixture() {
  const store = createMemoryDeviceGrantStore();
  const routeDb = createInMemoryWorkspaceRouteD1();
  await migrateWorkspaceRouteD1(routeDb);
  await store.putAccountWorkspace({
    accountId,
    workspaceId,
    workspaceSlug,
    workspaceHost,
    updatedAt: nowMs,
  });
  const job: ManagedCloudProvisioningJob = {
    jobId: 'mcpj_cloud_first',
    accountId,
    workspaceId,
    workspaceSlug,
    workspaceHost,
    nodeId: 'node_cloud_first',
    nodeName: 'Cloud',
    planId: 'standard',
    region: 'us-east1',
    pricingVersion: 'pricing-test',
    monthlyPriceCents: 9900,
    currency: 'USD',
    idempotencyKey: 'cloud-first-create',
    status: 'requested',
    createdAt: nowMs,
    updatedAt: nowMs,
  };
  await store.createManagedCloudProvisioningJob(job);
  const handler = createOsDeviceAuthorityHandler({
    store,
    origin: 'https://os.consuelohq.com',
    now: () => nowMs,
    workspaceRouteRegistry: routeDb,
    workspaceEdgeInternalSigningSecret: 'edge-signing-secret',
    managedCloudProvisionerSecret: provisionerSecret,
    managedCloudEnrollmentSecret: enrollmentSecret,
    workspaceConnectorProvisioner: async (input) => ({
      connectorId: input.connectorId,
      cloudflareTunnelToken: 'cloudflare-tunnel-token-test',
      tunnelOriginUrl: 'https://' + input.connectorId + '.connectors.consuelohq.com',
      localServiceUrl: 'http://127.0.0.1:46321',
    }),
  });
  return { store, routeDb, handler, job };
}

async function claim(handler: (request: Request) => Promise<Response>) {
  return handler(new Request('https://os.consuelohq.com/internal/managed-cloud/provisioning/claim', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + provisionerSecret },
  }));
}

describe('managed cloud one-click provisioning', () => {
  it('requires trusted provisioner auth and atomically claims a job once', async () => {
    const { handler } = await fixture();
    const denied = await handler(new Request('https://os.consuelohq.com/internal/managed-cloud/provisioning/claim', { method: 'POST' }));
    expect(denied.status).toBe(401);

    const first = await claim(handler);
    expect(first.status).toBe(200);
    const payload = await first.json() as {
      job: { jobId: string; nodeId: string; planId: string; region: string; status: string };
      leaseId: string;
      enrollmentToken: string;
    };
    expect(payload.job).toMatchObject({
      jobId: 'mcpj_cloud_first',
      nodeId: 'node_cloud_first',
      planId: 'standard',
      region: 'us-east1',
      status: 'provisioning',
    });
    expect(payload.leaseId.length).toBeGreaterThan(12);
    expect(payload.enrollmentToken.length).toBeGreaterThan(20);
    expect(JSON.stringify(payload)).not.toMatch(/machineType|providerCost|landedCost|grossMargin/i);

    const second = await claim(handler);
    expect(second.status).toBe(204);
  });

  it('does not reclaim a job once provisioning has advanced to booting', async () => {
    const { handler } = await fixture();
    const first = await claim(handler);
    expect(first.status).toBe(200);
    const claimed = await first.json() as { job: { jobId: string }; leaseId: string };
    const booting = await handler(new Request('https://os.consuelohq.com/internal/managed-cloud/provisioning/state', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + provisionerSecret, 'content-type': 'application/json' },
      body: JSON.stringify({ jobId: claimed.job.jobId, leaseId: claimed.leaseId, status: 'booting' }),
    }));
    expect(booting.status).toBe(200);

    const second = await claim(handler);
    expect(second.status).toBe(204);
  });

  it('auto-enrolls the VM key once and makes the first cloud node home/default', async () => {
    const { handler, store, routeDb } = await fixture();
    const claimResponse = await claim(handler);
    const claimPayload = await claimResponse.json() as { enrollmentToken: string };
    const keyPair = generateWorkspaceDeviceKeyPair();

    const enroll = () => handler(new Request('https://os.consuelohq.com/managed-cloud/provisioning/enroll', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jobId: 'mcpj_cloud_first',
        enrollmentToken: claimPayload.enrollmentToken,
        devicePublicKeyJwk: keyPair.publicKeyJwk,
        platform: 'linux',
        architecture: 'x64',
        channel: 'stable',
        capabilities: ['mcp', 'tools'],
      }),
    }));

    const response = await enroll();
    expect(response.status).toBe(200);
    const bootstrap = await response.json() as Record<string, unknown>;
    expect(bootstrap).toMatchObject({
      workspace_id: workspaceId,
      workspace_slug: workspaceSlug,
      workspace_host: workspaceHost,
      node_id: 'node_cloud_first',
      node_name: 'Cloud',
      node_role: 'home',
      connector_id: 'connector_node_cloud_first',
      cloudflare_tunnel_token: 'cloudflare-tunnel-token-test',
      device_public_key_bound: true,
    });
    expect(bootstrap).toHaveProperty('connector_bootstrap_token');
    expect(bootstrap).toHaveProperty('edge_request_signing_secret');

    const thumbprint = await devicePublicKeyThumbprint(keyPair.publicKeyJwk);
    const node = await store.byWorkspaceNode(accountId, 'node_cloud_first');
    expect(node).toMatchObject({
      role: 'home',
      devicePublicKeyThumbprint: thumbprint,
      platform: 'linux',
      architecture: 'x64',
      connectorId: 'connector_node_cloud_first',
    });
    const workspace = await store.byAccountWorkspace(accountId);
    expect(workspace).toMatchObject({ homeNodeId: 'node_cloud_first', defaultNodeId: 'node_cloud_first' });
    const route = await resolveWorkspaceRouteFromD1(routeDb, {
      host: workspaceHost,
      path: '/mcp',
      requireOnlineNode: false,
      nowMs,
    });
    expect(route.allowed).toBe(true);
    if (route.allowed) expect(route.nodeId).toBe('node_cloud_first');

    const job = await store.byManagedCloudProvisioningJob('mcpj_cloud_first');
    expect(job?.status).toBe('connecting');
    expect(job?.enrollmentConsumedAt).toBe(nowMs);

    const replay = await enroll();
    expect(replay.status).toBe(409);
  });

  it('marks the provisioning job ready from the node identity without changing an existing default', async () => {
    const { store } = await fixture();
    await store.putAccountWorkspace({
      accountId,
      workspaceId,
      workspaceSlug,
      workspaceHost,
      homeNodeId: 'node_existing',
      defaultNodeId: 'node_existing',
      updatedAt: nowMs,
    });
    const ready = await store.markManagedCloudProvisioningReadyByNode({
      nodeId: 'node_cloud_first',
      nowMs: nowMs + 5_000,
    });
    expect(ready?.status).toBe('ready');
    const workspace = await store.byAccountWorkspace(accountId);
    expect(workspace?.defaultNodeId).toBe('node_existing');
  });
});
