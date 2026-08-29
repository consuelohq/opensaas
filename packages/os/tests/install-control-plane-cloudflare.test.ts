import { describe, expect, it } from 'vitest';

import { createOsDeviceAuthorityHandler } from '../cloudflare/os-device-authority/src/app';
import { createMemoryDeviceGrantStore } from '../cloudflare/os-device-authority/src/stores';
import { createWorkspaceEdgeHandler } from '../cloudflare/workspace-edge/src/index';
import {
  createInMemoryWorkspaceRouteD1,
  migrateWorkspaceRouteD1,
} from '../scripts/lib/workspace-cloudflare-d1-route-registry';
import {
  createInstallControlPlaneService,
  createMemoryInstallControlPlaneRepository,
} from '../scripts/lib/install-control-plane';
import {
  INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH,
} from '../scripts/lib/install-control-plane-http';
import {
  INSTALL_DASHBOARD_API_ROUTES,
  INSTALL_ID_HEADER,
  type InstallTelemetryEvent,
} from '../scripts/lib/install-telemetry-contract';
import {
  createDevicePublicKeyProof,
  devicePublicKeyProofPayload,
  devicePublicKeyThumbprint,
  generateWorkspaceDeviceKeyPair,
} from '../scripts/lib/workspace-device-login-client';
import {
  CONSUELO_DEVICE_CODE_URL,
  CONSUELO_OAUTH_ACCESS_TOKEN_URL,
} from '../scripts/lib/workspace-device-authorization';

const INSTALL_ID = 'ins_11111111-1111-4111-8111-111111111111' as const;
const EVENT_ID = 'evt_11111111-1111-4111-8111-111111111111' as const;
const APPROVAL_ASSERTION_SECRET = 'install-control-plane-approval-secret';

function b64(bytes: Uint8Array): string {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function approvalAssertion(input: {
  accountId: string;
  workspaceId: string;
}): Promise<string> {
  const payload = b64(
    new TextEncoder().encode(
      JSON.stringify({
        account_id: input.accountId,
        workspace_id: input.workspaceId,
        auth_method: 'google',
        expires_at: '2026-08-13T17:10:00.000Z',
      }),
    ),
  );
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(APPROVAL_ASSERTION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = b64(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)),
    ),
  );
  return `${payload}.${signature}`;
}

function installStarted(): InstallTelemetryEvent {
  return {
    schemaVersion: 1,
    eventId: EVENT_ID,
    installId: INSTALL_ID,
    producer: 'installer',
    name: 'install.started',
    stage: 'bootstrap',
    outcome: 'started',
    occurredAt: '2026-08-13T16:00:00.000Z',
    sequence: 1,
    identity: { state: 'anonymous' },
    context: { platform: 'darwin', channel: 'canary' },
  };
}

describe('Device Authority install control-plane routes', () => {
  it('ingests anonymous install events and exposes only safe fleet projection to the edge internal secret', async () => {
    const store = createMemoryDeviceGrantStore();
    await store.putWorkspaceNode({
      accountId: 'user_123',
      workspaceId: 'workspace_123',
      workspaceSlug: 'workspace',
      workspaceHost: 'workspace.consuelohq.com',
      nodeId: 'node_123',
      nodeName: 'MacBook Pro',
      displayName: 'MacBook Pro',
      role: 'home',
      platform: 'darwin',
      architecture: 'arm64',
      channel: 'canary',
      connectorStatus: 'connected',
      agents: ['codex'],
      state: 'active',
      devicePublicKeyJwk: '{"private":"must-not-leak"}',
      devicePublicKeyThumbprint: 'private-thumbprint',
      createdAt: Date.parse('2026-08-13T16:00:00.000Z'),
      updatedAt: Date.parse('2026-08-13T16:59:00.000Z'),
      lastSeenAt: Date.parse('2026-08-13T16:59:30.000Z'),
    });
    await store.putWorkspaceNode({
      accountId: 'google:legacy-sub',
      workspaceId: 'workspace_legacy',
      workspaceSlug: 'legacy',
      workspaceHost: 'legacy.consuelohq.com',
      nodeId: 'node_legacy',
      nodeName: 'Legacy Mac',
      role: 'home',
      state: 'active',
      devicePublicKeyThumbprint: 'legacy-thumbprint',
      createdAt: Date.parse('2026-08-12T16:00:00.000Z'),
      updatedAt: Date.parse('2026-08-12T16:00:00.000Z'),
      lastSeenAt: Date.parse('2026-08-12T16:00:00.000Z'),
    });
    const repository = createMemoryInstallControlPlaneRepository();
    const handler = createOsDeviceAuthorityHandler({
      store,
      installControlPlaneRepository: repository,
      workspaceEdgeInternalSigningSecret: 'edge-secret',
      now: () => Date.parse('2026-08-13T17:00:00.000Z'),
    });

    const ingest = await handler(
      new Request(`https://os.consuelohq.com${INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [INSTALL_ID_HEADER]: INSTALL_ID,
        },
        body: JSON.stringify(installStarted()),
      }),
    );
    expect(ingest.status).toBe(202);

    const denied = await handler(
      new Request('https://os.consuelohq.com/internal/install-control-plane/devices'),
    );
    expect(denied.status).toBe(403);

    const allowed = await handler(
      new Request('https://os.consuelohq.com/internal/install-control-plane/devices', {
        headers: { 'x-consuelo-internal-auth-secret': 'edge-secret' },
      }),
    );
    expect(allowed.status).toBe(200);
    const payload = (await allowed.json()) as { devices: Array<Record<string, unknown>> };
    expect(payload.devices).toHaveLength(2);
    expect(payload.devices[0]).toMatchObject({
      nodeId: 'node_123',
      userId: 'user_123',
      workspaceId: 'workspace_123',
      state: 'active',
    });
    expect(payload.devices[1]).not.toHaveProperty('userId');
    expect(JSON.stringify(payload)).not.toContain('private-thumbprint');
    expect(JSON.stringify(payload)).not.toContain('devicePublicKey');
    expect(JSON.stringify(payload)).not.toContain('legacy-sub');
  });

  it('carries install correlation in trusted grant state and binds canonical app identity after approval', async () => {
    const store = createMemoryDeviceGrantStore();
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.ingestEvent(installStarted(), {
      trust: 'installer',
      ingestedAt: '2026-08-13T16:00:01.000Z',
    });
    const routeRegistry = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routeRegistry);
    const handler = createOsDeviceAuthorityHandler({
      store,
      installControlPlaneRepository: repository,
      origin: 'https://os.consuelohq.com',
      now: () => Date.parse('2026-08-13T17:00:00.000Z'),
      approvalAssertionSecret: APPROVAL_ASSERTION_SECRET,
      workspaceRouteRegistry: routeRegistry,
      workspaceConnectorProvisioner: async (input) => ({
        connectorId: input.connectorId,
        cloudflareTunnelToken: 'cloudflare_tunnel_token_fixture',
        tunnelOriginUrl: `https://${input.connectorId}.consuelohq.com`,
        localServiceUrl: 'http://127.0.0.1:46320',
      }),
    });
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    const codeResponse = await handler(
      new Request(CONSUELO_DEVICE_CODE_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          [INSTALL_ID_HEADER]: INSTALL_ID,
        },
        body: new URLSearchParams({
          client_id: 'consuelo-os-installer',
          scope: 'workspace:read os:connector:register',
          workspace_name: 'testing',
          workspace_slug: 'testing',
          workspace_host: 'testing.consuelohq.com',
          device_public_key_jwk: deviceKeyPair.publicKeyJwk,
          device_key_algorithm: 'Ed25519',
        }),
      }),
    );
    expect(codeResponse.status).toBe(200);
    const code = (await codeResponse.json()) as Record<string, string>;
    expect(code.verification_uri_complete).not.toContain(INSTALL_ID);
    const correlatedGrant = await store.byUserCode(code.user_code);
    expect((correlatedGrant as { installId?: string } | undefined)?.installId).toBe(INSTALL_ID);

    const malformedResponse = await handler(
      new Request(CONSUELO_DEVICE_CODE_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          [INSTALL_ID_HEADER]: 'not-an-install-id',
        },
        body: new URLSearchParams({
          client_id: 'consuelo-os-installer',
          scope: 'workspace:read',
          device_public_key_jwk: deviceKeyPair.publicKeyJwk,
          device_key_algorithm: 'Ed25519',
        }),
      }),
    );
    expect(malformedResponse.status).toBe(200);
    const malformedCode = (await malformedResponse.json()) as Record<string, string>;
    const uncorrelatedGrant = await store.byUserCode(malformedCode.user_code);
    expect((uncorrelatedGrant as { installId?: string } | undefined)?.installId).toBeUndefined();

    const approve = await handler(
      new Request('https://os.consuelohq.com/login/device/approve', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-consuelo-account-assertion': await approvalAssertion({
            accountId: 'user_123',
            workspaceId: 'workspace_123',
          }),
        },
        body: new URLSearchParams({ user_code: code.user_code.replace('-', '') }),
      }),
    );
    expect(approve.status).toBe(200);

    const detail = await repository.getInstallDetail(INSTALL_ID, {
      nowMs: Date.parse('2026-08-13T17:01:00.000Z'),
    });
    expect(detail?.install).toMatchObject({
      userId: 'user_123',
      workspaceId: 'workspace_123',
    });
    expect(detail?.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          producer: 'device_authority',
          name: 'install.identity.bound',
          identity: expect.objectContaining({
            state: 'canonical',
            userId: 'user_123',
            workspaceId: 'workspace_123',
          }),
        }),
      ]),
    );

    const thumbprint = await devicePublicKeyThumbprint(deviceKeyPair.publicKeyJwk);
    const proofPayload = devicePublicKeyProofPayload({
      clientId: 'consuelo-os-installer',
      deviceCode: code.device_code,
      devicePublicKeyThumbprint: thumbprint,
    });
    const poll = await handler(
      new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: 'consuelo-os-installer',
          device_code: code.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_public_key_proof_payload: proofPayload,
          device_public_key_proof: createDevicePublicKeyProof({
            deviceKeyPair,
            payload: proofPayload,
          }),
        }),
      }),
    );
    expect(poll.status).toBe(200);
    await expect(poll.json()).resolves.toMatchObject({
      user_id: 'user_123',
      workspace_id: 'workspace_123',
    });
  });
});

describe('workspace edge private dashboard interception', () => {
  it('serves the internal dashboard API before generic workspace routing and requires the injected operator authorizer', async () => {
    const routeRegistry = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routeRegistry);
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.ingestEvent(installStarted(), {
      trust: 'installer',
      ingestedAt: '2026-08-13T16:00:01.000Z',
    });
    const service = createInstallControlPlaneService({ repository });
    const sessionCookie = '__Host-consuelo_os_session=target-session';
    const env = {
      WORKSPACE_ROUTE_REGISTRY: routeRegistry,
      CONSUELO_EDGE_SIGNING_SECRET: 'edge-signing-secret',
      WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET: 'internal-secret',
      OS_DEVICE_AUTHORITY: {
        idFromName: (name: string) => name,
        get: () => ({
          fetch: async (request: Request) =>
            (request.headers.get('cookie') ?? '').includes(sessionCookie)
              ? new Response(null, { status: 204 })
              : Response.json({ error: 'workspace_session_required' }, { status: 401 }),
        }),
      },
    };

    const denied = createWorkspaceEdgeHandler(env, {
      internalDashboardService: service,
      authorizeInternalDashboard: async () => false,
      now: () => Date.parse('2026-08-13T17:00:00.000Z'),
    });
    const deniedResponse = await denied(
      new Request(`https://internal.consuelohq.com${INSTALL_DASHBOARD_API_ROUTES.overview}`, {
        headers: { cookie: sessionCookie },
      }),
    );
    expect(deniedResponse.status).toBe(403);

    const allowed = createWorkspaceEdgeHandler(env, {
      internalDashboardService: service,
      authorizeInternalDashboard: async () => true,
      now: () => Date.parse('2026-08-13T17:00:00.000Z'),
    });
    const response = await allowed(
      new Request(`https://internal.consuelohq.com${INSTALL_DASHBOARD_API_ROUTES.overview}?window=30d`, {
        headers: { cookie: sessionCookie },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ installs: { started: 1 } });
  });
});
