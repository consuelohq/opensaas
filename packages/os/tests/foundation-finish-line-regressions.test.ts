import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { failGrantWorkspaceRouteSetup } from '../cloudflare/os-device-authority/src/services/grants';
import { createMemoryDeviceGrantStore } from '../cloudflare/os-device-authority/src/stores';
import type { Grant } from '../cloudflare/os-device-authority/src/types';
import { createLocalAgentMcpBridge } from '../scripts/lib/local-agent-mcp-bridge';
import { planManagedCloudNode } from '../scripts/lib/managed-cloud-node';
import { runManagedCloudNodeEnrollment } from '../scripts/lib/managed-cloud-node-enrollment';
import { renderCaddyGatewayConfig } from '../scripts/lib/security-gateway';
import { createWorkspaceNodeHeartbeatClient } from '../scripts/lib/workspace-node-heartbeat-client';
import { generateWorkspaceDeviceKeyPair } from '../scripts/lib/workspace-device-login-client';

const temporaryHomes: string[] = [];

afterEach(() => {
  for (const home of temporaryHomes.splice(0)) {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

function credentialHome(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-finish-line-'));
  temporaryHomes.push(home);
  const credentialPath = path.join(
    home,
    'node',
    'security',
    'generated',
    'local-agent-mcp.json',
  );
  fs.mkdirSync(path.dirname(credentialPath), { recursive: true });
  fs.writeFileSync(
    credentialPath,
    JSON.stringify({
      version: 1,
      kind: 'consuelo-local-agent-mcp-credentials',
      localUrl: 'http://127.0.0.1:46321/mcp',
      agents: {
        codex: { tokenId: 'token_codex', bearerToken: 'local-secret' },
      },
    }),
    { mode: 0o600 },
  );
  return home;
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('OS foundation finish-line regressions', () => {
  it('classifies permanent local MCP failures as non-retryable', async () => {
    const bridge = createLocalAgentMcpBridge({
      home: credentialHome(),
      agentId: 'codex',
      fetchImpl: async () => new Response('unauthorized', { status: 401 }),
    });

    const [response] = await bridge.forward(
      '{"jsonrpc":"2.0","id":7,"method":"tools/list"}',
    );
    expect(response).toMatchObject({
      id: 7,
      error: {
        data: {
          code: 'CONSUELO_NODE_UNAVAILABLE',
          retryable: false,
        },
      },
    });
    expect(JSON.stringify(response)).not.toContain('retryAfterSeconds');
  });

  it('keeps valid MCP SSE frames when an adjacent frame is malformed', async () => {
    const bridge = createLocalAgentMcpBridge({
      home: credentialHome(),
      agentId: 'codex',
      fetchImpl: async () =>
        new Response(
          [
            'data: {"jsonrpc":"2.0","id":1,"result":{"first":true}}',
            'data: {not-json}',
            'data: {"jsonrpc":"2.0","id":2,"result":{"second":true}}',
          ].join('\n'),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    });

    await expect(bridge.forward('{}')).resolves.toEqual([
      { jsonrpc: '2.0', id: 1, result: { first: true } },
      { jsonrpc: '2.0', id: 2, result: { second: true } },
    ]);
  });

  it('deduplicates heartbeat capabilities after normalization', async () => {
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    let payload: Record<string, unknown> | undefined;
    const client = createWorkspaceNodeHeartbeatClient({
      config: {
        authorityOrigin: 'https://os.consuelohq.com',
        workspaceId: 'workspace_123',
        nodeId: 'node_123',
        connectorStatus: 'connected',
        capabilities: ['mcp', ' mcp ', 'tools'],
        publicKeyJwk: deviceKeyPair.publicKeyJwk,
        signingKeyJwk: deviceKeyPair.signingKeyJwk,
      },
      fetchImpl: async (request) => {
        payload = JSON.parse(await request.text()) as Record<string, unknown>;
        return Response.json({ nodeId: 'node_123', presence: 'online' });
      },
    });

    await client.send();
    expect(payload?.capabilities).toEqual(['mcp', 'tools']);
  });

  it('rejects a Caddy reverse-proxy loop before materializing config', () => {
    expect(() =>
      renderCaddyGatewayConfig({
        workspaceHost: 'internal.consuelohq.com',
        ingressPort: 46320,
        upstream: { host: '127.0.0.1', port: 46320 },
      }),
    ).toThrow(/must differ|proxy loop/i);
  });

  it('renders authoritative managed-node enrollment and verified Caddy startup', () => {
    const release = {
      channel: 'dev' as const,
      baseUrl: 'https://storage.googleapis.com/consuelo-os-releases-dev',
      bootstrapBundleUrl:
        'https://storage.googleapis.com/consuelo-os-releases-dev/runtime.tar.gz',
      bootstrapBundleDigest: 'sha256:' + '1'.repeat(64),
      bootstrapBundleId: 'sha256:' + '2'.repeat(64),
      bootstrapBundleVersion: '1.2.3',
      cloudflaredBinaryUrl:
        'https://github.com/cloudflare/cloudflared/releases/download/2026.7.3/cloudflared-linux-amd64',
      cloudflaredBinaryDigest: 'sha256:' + '3'.repeat(64),
      cloudflaredVersion: '2026.7.3',
      caddyArchiveUrl:
        'https://github.com/caddyserver/caddy/releases/download/v2.11.4/caddy_2.11.4_linux_amd64.tar.gz',
      caddyArchiveDigest: 'sha256:' + '4'.repeat(64),
      caddyVersion: '2.11.4',
      trustedPublicKeys: { release: 'public-key' },
    };
    const script = planManagedCloudNode({
      projectId: 'project-123',
      workspaceId: 'workspace_123',
      workspaceSlug: 'internal',
      workspaceHost: 'internal.consuelohq.com',
      nodeId: 'node-123',
      nodeName: 'Managed node',
      release,
    }).bootstrap.startupScript;

    expect(script).toContain(release.caddyArchiveUrl);
    expect(script).toContain(
      release.caddyArchiveDigest.slice('sha256:'.length),
    );
    expect(script).toContain('consuelo-caddy.service');
    expect(script).toContain(
      'chown -R consuelo:consuelo "$CONSUELO_HOME/bootstrap"',
    );
    expect(script).not.toContain('nohup "$BUN_BIN"');
    expect(script).not.toContain('enrollment-pending');
    expect(script).toContain('write_status runtime-active enrolled');
  });

  it('expires managed-node device grants locally instead of polling forever', async () => {
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    const statuses: Array<Record<string, unknown>> = [];
    let polls = 0;

    await expect(
      runManagedCloudNodeEnrollment({
        home: '/var/lib/consuelo',
        onboarding: {
          workspaceId: 'workspace_123',
          workspaceSlug: 'internal',
          workspaceHost: 'internal.consuelohq.com',
          nodeId: 'node_123',
          nodeName: 'Managed node',
        },
        dependencies: {
          now: () => Date.parse('2026-07-29T00:00:01.000Z'),
          loadOrCreateDeviceKeyPair: () => deviceKeyPair,
          requestDeviceCode: async () => ({
            status: 'started',
            deviceKeyPair,
            session: {
              deviceCode: 'device-secret',
              userCode: 'ABCD-EFGH',
              verificationUri: 'https://os.consuelohq.com/login/device',
              verificationUriComplete:
                'https://os.consuelohq.com/login/device?user_code=ABCDEFGH',
              expiresAt: '2026-07-29T00:00:00.000Z',
              intervalSeconds: 5,
            },
          }),
          pollAccessToken: async () => {
            polls += 1;
            return { status: 'pending', intervalSeconds: 5 };
          },
          provision: () => undefined,
          activateHeartbeat: async () => undefined,
          sleep: async () => undefined,
          writeStatus: (status) => statuses.push(status),
        },
      }),
    ).rejects.toThrow(/DEVICE_CODE_EXPIRED/);
    expect(polls).toBe(0);
    expect(statuses.at(-1)).toMatchObject({
      phase: 'failed',
      errorCode: 'DEVICE_CODE_EXPIRED',
    });
  });

  it('persists a terminal grant failure before best-effort node rollback', async () => {
    const baseStore = createMemoryDeviceGrantStore();
    let cleanupAttempted = false;
    const store = {
      ...baseStore,
      delWorkspaceNodeIfMatch: async () => {
        cleanupAttempted = true;
        throw new Error('simulated cleanup failure');
      },
    };
    const grant: Grant = {
      hash: 'grant-hash',
      userCode: 'ABCD-EFGH',
      status: 'pending',
      expiresAt: Date.now() + 60_000,
      interval: 5,
      devicePublicKeyJwk: '{"kty":"OKP"}',
      deviceKeyAlgorithm: 'Ed25519',
      devicePublicKeyThumbprint: 'thumbprint',
      accountId: 'account_123',
      nodeId: 'node_123',
      nodeStatus: 'created',
      nodeRegistrationVersion: 7,
      connectorToken: 'connector-secret',
      cloudflareTunnelToken: 'tunnel-secret',
      accessToken: 'access-secret',
    };

    await failGrantWorkspaceRouteSetup({
      store,
      grant,
      error: new Error('connector route failed with sensitive details'),
    });

    expect(cleanupAttempted).toBe(true);
    await expect(baseStore.byHash(grant.hash)).resolves.toMatchObject({
      status: 'failed',
      failureCode: 'workspace_route_setup_failed',
    });
    const persisted = await baseStore.byHash(grant.hash);
    expect(persisted).not.toHaveProperty('connectorToken');
    expect(persisted).not.toHaveProperty('cloudflareTunnelToken');
    expect(persisted).not.toHaveProperty('accessToken');
  });

  it('contains the static fail-closed contracts for lifecycle and ingress', () => {
    const lifecycleErrors = read('scripts/lib/lifecycle/errors.ts');
    const lifecycleEngine = read('scripts/lib/lifecycle/engine.ts');
    const stdio = read('scripts/mcp-stdio.ts');
    const portless = read('scripts/bootstrap.sh');
    const caddyRunner = read('scripts/start-caddy-daemon.sh');
    const grants = read(
      'cloudflare/os-device-authority/src/services/grants.ts',
    );
    const deviceRoute = read(
      'cloudflare/os-device-authority/src/routes/device.ts',
    );
    const registry = read('cloudflare/os-device-authority/src/stores.ts');
    const edgeRouter = read('scripts/lib/workspace-cloudflare-edge-router.ts');
    const edgeWorker = read('cloudflare/workspace-edge/src/index.ts');
    const gcloud = read('scripts/lib/gcloud-managed-cloud-node.ts');

    expect(lifecycleErrors).toContain("'SERVICE_PREFLIGHT_FAILED'");
    expect(lifecycleEngine).not.toMatch(
      /Effect\.promise\(\(\) =>\s*acceptHealth/,
    );
    expect(stdio).toMatch(/MAX_MCP_STDIO_(?:MESSAGE|BODY)_BYTES/);
    expect(portless).toContain('CONSUELO_OS_REQUIRE_PORTLESS');
    expect(portless).toContain('CONSUELO_OS_INSTALL_PORTLESS');
    expect(caddyRunner).toContain('CADDY_ALLOWED_ENV_KEYS');
    expect(grants.indexOf('await input.store.put(input.grant)')).toBeLessThan(
      grants.indexOf('await input.store.delWorkspaceNodeIfMatch'),
    );
    expect(deviceRoute).not.toContain(
      '...(requestedWorkspaceId ? { workspaceId: requestedWorkspaceId } : {})',
    );
    expect(registry).toContain('wnh:');
    expect(edgeRouter).toContain('reportError?:');
    expect(edgeWorker).toContain('reportError:');
    expect(gcloud).toContain('canonicalManagedNodeStartupScript');
  });
});
