import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createInMemoryWorkspaceRouteD1,
  createWorkspaceCloudflareD1RouteRegistry,
  migrateWorkspaceRouteD1,
  upsertWorkspaceHostnameInD1,
  type WorkspaceRouteD1RecordInput,
} from '../scripts/lib/workspace-cloudflare-d1-route-registry';
import { createWorkspaceCloudflareEdgeRouter } from '../scripts/lib/workspace-cloudflare-edge-router';
import { deriveWorkspaceEdgeNodeSecret } from '../scripts/lib/workspace-edge-node-auth';
import { sealCredential } from '../scripts/lib/node-credential-sealing';
import { ensureNodeEncryptionKey } from '../scripts/lib/node-encryption-key-file';
import { createGatewaySecurityConfig } from '../scripts/lib/security-gateway';
import { createLocalOsApp } from '../scripts/server/app';

const workspaceId = 'workspace_edge_e2e';
const workspaceHost = 'edge-e2e.consuelohq.com';
const nodeId = 'node_edge_e2e';
const connectorId = 'connector_edge_e2e';
const connectorOrigin = 'https://c-edge-e2e.consuelohq.com';
const masterSecret = 'workspace-edge-e2e-master-secret';
const temporaryHomes: string[] = [];

function gatewayRoute(
  pathPrefix: string,
  serviceName: string,
  gatewayRouteFamily: string,
  publicSiteRouteFamily: string,
): WorkspaceRouteD1RecordInput['routes'][number] {
  return {
    surface: 'sites',
    pathPrefix,
    auth: 'workspace-session',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName,
      gatewayRouteFamily,
      publicSiteRouteFamily,
    },
  };
}

function workspaceRecord(now: number): WorkspaceRouteD1RecordInput {
  return {
    workspaceId,
    workspaceSlug: 'edge-e2e',
    hostname: workspaceHost,
    baseDomain: 'consuelohq.com',
    provider: 'cloudflare',
    owner: 'consuelo-os-cloud',
    status: 'active',
    defaultNodeId: nodeId,
    nodeTargets: [
      {
        nodeId,
        connectorId,
        connectorStatus: 'connected',
        tunnelOriginUrl: connectorOrigin,
        state: 'active',
        lastSeenAt: now,
        heartbeatTtlMs: 60_000,
      },
    ],
    routes: [
      gatewayRoute('/gateway/traces/events', 'trace-sites-live-endpoints', '/gateway/traces/*', '/observability/*'),
      gatewayRoute('/gateway/traces', 'trace-sites-read-layer', '/gateway/traces/*', '/observability/*'),
      gatewayRoute('/gateway/environments', 'environment-sites-read-endpoints', '/gateway/environments/*', '/environments/*'),
      gatewayRoute('/gateway/secrets/install', 'secrets-sites-write-endpoints', '/gateway/secrets/*', '/secrets/*'),
      gatewayRoute('/gateway/secrets', 'secrets-sites-read-endpoints', '/gateway/secrets/*', '/secrets/*'),
    ],
  };
}

afterEach(() => {
  delete process.env.CONSUELO_HOME;
  delete process.env.CONSUELO_OS_HOME;
  delete process.env.CONSUELO_OS_AUTH_CONFIG;
  for (const home of temporaryHomes.splice(0)) {
    rmSync(home, { recursive: true, force: true });
  }
});

describe('authenticated workspace edge to local OS node', () => {
  it('carries environments, sealed secret writes, and traces through the full signed bridge', async () => {
    const now = Date.now();
    const home = mkdtempSync(join(tmpdir(), 'consuelo-gateway-node-e2e-'));
    temporaryHomes.push(home);
    const nodeSigningSecret = deriveWorkspaceEdgeNodeSecret({
      masterSecret,
      workspaceId,
      nodeId,
      connectorId,
    });
    const security = createGatewaySecurityConfig({
      home,
      workspaceId,
      workspaceSlug: 'edge-e2e',
      workspaceHost,
      edgeProxy: {
        nodeId,
        connectorId,
        signingSecret: nodeSigningSecret,
      },
    });
    process.env.CONSUELO_HOME = home;
    process.env.CONSUELO_OS_HOME = home;
    process.env.CONSUELO_OS_AUTH_CONFIG = security.generatedAuthPath;
    const nodeEncryption = ensureNodeEncryptionKey({
      nodeHome: join(home, 'node'),
      workspaceId,
      nodeId,
    });

    const localApp = createLocalOsApp();
    const db = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(db);
    await upsertWorkspaceHostnameInD1(db, workspaceRecord(now));
    const upstreamRequests: Request[] = [];
    let nonce = 0;
    const edge = createWorkspaceCloudflareEdgeRouter({
      registry: createWorkspaceCloudflareD1RouteRegistry(db),
      internalSigningSecret: 'legacy-edge-signing-secret',
      nodeSigningMasterSecret: masterSecret,
      now: () => now + nonce,
      createNonce: () => 'edge-e2e-nonce-' + String(++nonce).padStart(4, '0'),
      authorizeWorkspaceSession: async () => true,
      fetchUpstream: async (request) => {
        upstreamRequests.push(request.clone());
        return localApp.fetch(request);
      },
    });
    const browserRequest = (path: string, init: RequestInit = {}) =>
      edge.fetch(new Request('https://' + workspaceHost + path, {
        ...init,
        headers: {
          cookie: 'consuelo_workspace_session=edge-e2e-session',
          ...(init.headers ?? {}),
        },
      }));

    const createBody = JSON.stringify({
      name: 'Production',
      scope: { kind: 'workspace' },
      metadata: { REGION: 'iad1' },
    });
    const createEnvironment = await browserRequest('/gateway/environments/upsert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: createBody,
    });
    expect(createEnvironment.status).toBe(200);
    await expect(createEnvironment.json()).resolves.toMatchObject({
      ok: true,
      environment: { name: 'Production' },
    });

    const environments = await browserRequest('/gateway/environments/snapshot');
    expect(environments.status).toBe(200);
    await expect(environments.json()).resolves.toMatchObject({
      ok: true,
      snapshot: {
        workspaceId,
        environments: [{ name: 'Production' }],
      },
    });

    const secrets = await browserRequest('/gateway/secrets/bindings');
    expect(secrets.status).toBe(200);
    await expect(secrets.json()).resolves.toEqual({ ok: true, bindings: [] });

    const secretSetup = await browserRequest('/gateway/secrets/setup');
    expect(secretSetup.status).toBe(200);
    await expect(secretSetup.clone().json()).resolves.toMatchObject({
      ok: true,
      workspaceId,
      nodeId,
      algorithm: 'X25519',
      publicKeyJwk: nodeEncryption.publicKeyJwk,
    });

    const bindingId = 'EDGE_E2E_SECRET';
    const envelope = sealCredential({
      recipientPublicKeyJwk: nodeEncryption.publicKeyJwk,
      recipient: { workspaceId, nodeId, bindingId },
      plaintext: 'edge-e2e-secret-value',
    });
    const installSecret = await browserRequest('/gateway/secrets/install', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bindingId, envelope }),
    });
    expect(installSecret.status).toBe(200);
    await expect(installSecret.json()).resolves.toMatchObject({
      ok: true,
      binding: { workspaceId, nodeId, bindingId, status: 'set' },
    });

    const secretsAfterInstall = await browserRequest('/gateway/secrets/bindings');
    expect(secretsAfterInstall.status).toBe(200);
    await expect(secretsAfterInstall.json()).resolves.toMatchObject({
      ok: true,
      bindings: [{ workspaceId, nodeId, bindingId, status: 'set' }],
    });

    const traces = await browserRequest('/gateway/traces/recent?cursor=latest');
    expect(traces.status).toBe(200);
    await expect(traces.json()).resolves.toMatchObject({ ok: true });

    expect(upstreamRequests).toHaveLength(7);
    for (const request of upstreamRequests) {
      expect(request.url).toMatch(new RegExp('^' + connectorOrigin.replace(/[.*+?^$\{\}()|[\]\\]/g, '\$&') + '/gateway/'));
      expect(request.headers.get('x-consuelo-workspace-id')).toBe(workspaceId);
      expect(request.headers.get('x-consuelo-node-id')).toBe(nodeId);
      expect(request.headers.get('x-consuelo-device-id')).toBe(nodeId);
      expect(request.headers.get('x-consuelo-connector-id')).toBe(connectorId);
      expect(request.headers.get('x-consuelo-edge-auth-version')).toBe('consuelo-edge-node-v1');
      expect(request.headers.has('cookie')).toBe(false);
    }
  });
});
