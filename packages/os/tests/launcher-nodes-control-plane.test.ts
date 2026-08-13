import { describe, expect, it } from 'vitest';

import { createOsDeviceAuthorityHandler } from '../cloudflare/os-device-authority/src/app';
import { createMemoryDeviceGrantStore } from '../cloudflare/os-device-authority/src/stores';
import type { WorkspaceNode } from '../cloudflare/os-device-authority/src/types';
import { createWorkspaceEdgeHandler } from '../cloudflare/workspace-edge/src/index';
import type { ManagedCloudGcpRateCard, ManagedCloudPricingPolicy } from '../scripts/lib/managed-cloud-pricing';
import {
  createInMemoryWorkspaceRouteD1,
  migrateWorkspaceRouteD1,
  resolveWorkspaceRouteFromD1,
  upsertWorkspaceHostnameInD1,
} from '../scripts/lib/workspace-cloudflare-d1-route-registry';
import { hash } from '../cloudflare/os-device-authority/src/utils';

const nowMs = Date.parse('2026-08-12T12:00:00.000Z');
const workspaceHost = 'nodes-ui.consuelohq.com';
const workspaceId = 'workspace_nodes_ui';
const accountId = 'account_nodes_ui';
const sessionToken = 'workspace-session-nodes-ui';
const csrfToken = 'csrf-nodes-ui';
const internalSecret = 'workspace-edge-node-ui-secret';

const node = (input: { nodeId: string; name: string; role: 'home' | 'member' }): WorkspaceNode => ({
  accountId,
  workspaceId,
  workspaceSlug: 'nodes-ui',
  workspaceHost,
  nodeId: input.nodeId,
  nodeName: input.name,
  displayName: input.name,
  role: input.role,
  platform: input.role === 'home' ? 'darwin' : 'linux',
  architecture: input.role === 'home' ? 'arm64' : 'x64',
  channel: 'stable',
  connectorId: input.nodeId === 'node-home' ? 'connector_home' : 'connector_cloud',
  connectorStatus: 'connected',
  capabilities: ['mcp', 'tools'],
  state: 'active',
  devicePublicKeyJwk: '{}',
  devicePublicKeyThumbprint: 'dpk_test',
  createdAt: nowMs,
  updatedAt: nowMs,
  lastSeenAt: nowMs,
});

const rateCard: ManagedCloudGcpRateCard = {
  provider: 'gcp',
  currency: 'USD',
  version: 'gcp-test-2026-08',
  effectiveAt: '2026-08-01T00:00:00.000Z',
  region: 'us-east1',
  rates: {
    computeHourlyMicrosByPlan: { starter: 20_000, standard: 40_000, performance: 80_000, power: 160_000, max: 320_000 },
    balancedDiskGbMonthMicros: 100_000,
    snapshotGbMonthMicros: 20_000,
    natGatewayHourlyMicros: 1_000,
    natDataProcessingGbMicros: 50_000,
    egressGbMicros: 100_000,
  },
};

const pricingPolicy: ManagedCloudPricingPolicy = {
  pricingVersion: 'managed-cloud-ui-test',
  targetGrossMarginBps: 4000,
  providerContingencyBps: 500,
  priceIncrementCents: 500,
  snapshotAllowanceGb: 20,
  includedNatProcessedGb: 10,
  includedEgressGb: 10,
  platformOperationsReserveMicros: 5_000_000,
};

async function fixture(input: { pricing?: boolean } = {}) {
  const store = createMemoryDeviceGrantStore();
  const routeDb = createInMemoryWorkspaceRouteD1();
  await migrateWorkspaceRouteD1(routeDb);
  await store.putAccountWorkspace({
    accountId, workspaceId, workspaceSlug: 'nodes-ui', workspaceHost,
    homeNodeId: 'node-home', defaultNodeId: 'node-home', updatedAt: nowMs,
  });
  await store.putWorkspaceNode(node({ nodeId: 'node-home', name: 'Ko Mac', role: 'home' }));
  await store.putWorkspaceNode(node({ nodeId: 'node-cloud', name: 'Cloud', role: 'member' }));
  await store.putWorkspaceBrowserSession({
    tokenHash: await hash(sessionToken), accountId, workspaceId, workspaceHost, csrfToken,
    issuedAt: nowMs, expiresAt: nowMs + 60_000,
  });
  await upsertWorkspaceHostnameInD1(routeDb, {
    workspaceId, workspaceSlug: 'nodes-ui', hostname: workspaceHost, baseDomain: 'consuelohq.com',
    provider: 'cloudflare', owner: 'consuelo-os-cloud', status: 'active', defaultNodeId: 'node-home',
    nodeTargets: [
      { nodeId: 'node-home', connectorId: 'connector_home', connectorStatus: 'connected', tunnelOriginUrl: 'https://home.connector.test', state: 'active', lastSeenAt: nowMs, heartbeatTtlMs: 60_000 },
      { nodeId: 'node-cloud', connectorId: 'connector_cloud', connectorStatus: 'connected', tunnelOriginUrl: 'https://cloud.connector.test', state: 'active', lastSeenAt: nowMs, heartbeatTtlMs: 60_000 },
    ],
    routes: [{ surface: 'os', pathPrefix: '/mcp', auth: 'required', status: 'active', target: { kind: 'os-connector', connectorId: 'connector_home', connectorStatus: 'connected', tunnelOriginUrl: 'https://home.connector.test' } }],
  } as Parameters<typeof upsertWorkspaceHostnameInD1>[1]);

  const authority = createOsDeviceAuthorityHandler({
    store, origin: 'https://os.consuelohq.com', now: () => nowMs,
    workspaceRouteRegistry: routeDb, workspaceEdgeInternalSigningSecret: internalSecret,
    ...(input.pricing ? { managedCloudPricing: { policy: pricingPolicy, rateCards: { 'us-east1': rateCard } } } : {}),
  });
  const namespace = { idFromName: (name: string) => name, get: () => ({ fetch: authority }) };
  const edge = createWorkspaceEdgeHandler({
    WORKSPACE_ROUTE_REGISTRY: routeDb, CONSUELO_EDGE_SIGNING_SECRET: internalSecret,
    WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET: internalSecret, OS_DEVICE_AUTHORITY: namespace,
  }, { now: () => nowMs });
  const cookie = `__Host-consuelo_os_session=${encodeURIComponent(sessionToken)}; __Host-consuelo_os_csrf=${encodeURIComponent(csrfToken)}`;
  return { store, routeDb, edge, cookie };
}

describe('launcher Nodes workspace-session control plane', () => {
  it('lists only safe node metadata through the workspace edge session', async () => {
    const { edge, cookie } = await fixture();
    const response = await edge(new Request(`https://${workspaceHost}/gateway/nodes/snapshot`, { headers: { cookie } }));
    expect(response.status).toBe(200);
    const payload = await response.json() as Record<string, unknown>;
    expect(payload).toMatchObject({ workspaceId, defaultNodeId: 'node-home', nodeCount: 2 });
    const serialized = JSON.stringify(payload);
    expect(serialized).toContain('Ko Mac');
    expect(serialized).toContain('Cloud');
    expect(serialized).not.toMatch(/devicePublicKey|thumbprint|secret|token|machineType|providerCost/i);
  });

  it('rejects launcher node reads without a valid workspace session', async () => {
    const { edge } = await fixture();
    const response = await edge(new Request(`https://${workspaceHost}/gateway/nodes/snapshot`));
    expect(response.status).toBe(401);
  });

  it('changes the real workspace default only with same-origin CSRF protection', async () => {
    const { edge, cookie, store, routeDb } = await fixture();
    const rejected = await edge(new Request(`https://${workspaceHost}/gateway/nodes/default`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json', origin: `https://${workspaceHost}` },
      body: JSON.stringify({ nodeId: 'node-cloud' }),
    }));
    expect(rejected.status).toBe(403);

    const response = await edge(new Request(`https://${workspaceHost}/gateway/nodes/default`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json', origin: `https://${workspaceHost}`, 'x-consuelo-csrf-token': csrfToken },
      body: JSON.stringify({ nodeId: 'node-cloud' }),
    }));
    expect(response.status).toBe(200);
    await expect(store.byAccountWorkspace(accountId)).resolves.toMatchObject({ defaultNodeId: 'node-cloud' });
    const resolved = await resolveWorkspaceRouteFromD1(routeDb, { host: workspaceHost, path: '/mcp', nowMs });
    expect(resolved).toMatchObject({ allowed: true, nodeId: 'node-cloud' });
  });

  it('returns public cloud plan/region quotes without provider or margin internals', async () => {
    const { edge, cookie } = await fixture({ pricing: true });
    const response = await edge(new Request(`https://${workspaceHost}/gateway/nodes/pricing?region=us-east1`, { headers: { cookie } }));
    expect(response.status).toBe(200);
    const payload = await response.json() as { pricingAvailable: boolean; plans: unknown[]; regions: unknown[]; quotes: unknown[] };
    expect(payload.pricingAvailable).toBe(true);
    expect(payload.plans).toHaveLength(5);
    expect(payload.regions).toHaveLength(5);
    expect(payload.quotes).toHaveLength(5);
    const serialized = JSON.stringify(payload);
    expect(serialized).toContain('Starter');
    expect(serialized).toContain('Standard');
    expect(serialized).toContain('monthlyPriceCents');
    expect(serialized).not.toMatch(/machineType|providerMachine|providerCost|landedCost|grossMargin|contingency|e2-standard|e2-medium/i);
  });

  it('creates an idempotent managed-cloud provisioning job without exposing provider internals', async () => {
    const { edge, cookie } = await fixture({ pricing: true });
    const request = () => new Request(`https://${workspaceHost}/gateway/nodes/provision`, {
      method: 'POST',
      headers: {
        cookie,
        'content-type': 'application/json',
        origin: `https://${workspaceHost}`,
        'x-consuelo-csrf-token': csrfToken,
      },
      body: JSON.stringify({
        planId: 'standard',
        region: 'us-east1',
        pricingVersion: pricingPolicy.pricingVersion,
        idempotencyKey: 'create-cloud-standard-1',
      }),
    });
    const first = await edge(request());
    expect(first.status).toBe(202);
    const firstPayload = await first.json() as { job: { jobId: string; status: string; planId: string; region: string; monthlyPriceCents: number } };
    expect(firstPayload.job).toMatchObject({ status: 'requested', planId: 'standard', region: 'us-east1' });
    expect(firstPayload.job.monthlyPriceCents).toBeGreaterThan(0);
    expect(JSON.stringify(firstPayload)).not.toMatch(/machineType|providerMachine|providerCost|landedCost|grossMargin|enrollment|token|secret/i);

    const duplicate = await edge(request());
    expect(duplicate.status).toBe(200);
    const duplicatePayload = await duplicate.json() as typeof firstPayload;
    expect(duplicatePayload.job.jobId).toBe(firstPayload.job.jobId);

    const status = await edge(new Request(`https://${workspaceHost}/gateway/nodes/provisioning?job_id=${encodeURIComponent(firstPayload.job.jobId)}`, { headers: { cookie } }));
    expect(status.status).toBe(200);
    await expect(status.json()).resolves.toMatchObject({ job: { jobId: firstPayload.job.jobId, status: 'requested' } });
  });

  it('requires same-origin CSRF and a current pricing revision to provision', async () => {
    const { edge, cookie } = await fixture({ pricing: true });
    const missingCsrf = await edge(new Request(`https://${workspaceHost}/gateway/nodes/provision`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', origin: `https://${workspaceHost}` },
      body: JSON.stringify({ planId: 'standard', region: 'us-east1', pricingVersion: pricingPolicy.pricingVersion, idempotencyKey: 'csrf-missing' }),
    }));
    expect(missingCsrf.status).toBe(403);

    const stale = await edge(new Request(`https://${workspaceHost}/gateway/nodes/provision`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', origin: `https://${workspaceHost}`, 'x-consuelo-csrf-token': csrfToken },
      body: JSON.stringify({ planId: 'standard', region: 'us-east1', pricingVersion: 'stale-pricing', idempotencyKey: 'stale-pricing' }),
    }));
    expect(stale.status).toBe(409);
  });

  it('returns the public plan catalog without inventing prices when no rate card is published', async () => {
    const { edge, cookie } = await fixture();
    const response = await edge(new Request(`https://${workspaceHost}/gateway/nodes/pricing?region=us-east1`, { headers: { cookie } }));
    expect(response.status).toBe(200);
    const payload = await response.json() as { pricingAvailable: boolean; plans: unknown[]; quotes: unknown[] };
    expect(payload.pricingAvailable).toBe(false);
    expect(payload.plans).toHaveLength(5);
    expect(payload.quotes).toEqual([]);
  });
});
