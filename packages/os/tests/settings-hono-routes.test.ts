import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createDefaultWorkspaceYamlConfig,
  resolveConsueloHomeLayout,
  writeYamlConfig,
} from '../scripts/lib/consuelo-home';
import { readFullToolManifest } from '../scripts/lib/manifest';
import { generateWorkspaceDeviceKeyPair } from '../scripts/lib/workspace-device-login-client';
import {
  createGatewaySecurityConfig,
  issueAgentAppToken,
  signMachineRequest,
  type AgentAppToken,
  type GatewaySecurityConfig,
} from '../scripts/lib/security-gateway';
import { handleRequest } from '../scripts/server/app';

let home = '';
let config: GatewaySecurityConfig;
let token: AgentAppToken;
const workspaceId = 'workspace_configuration_hono';

function writeMinimalOsConfig(): void {
  writeFileSync(join(home, 'config.json'), JSON.stringify({
    version: 1,
    mode: 'local',
    home,
    port: 46321,
    artifactStorage: 'local',
    agents: [],
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
  }), 'utf8');
}

function signedRequest(input: {
  method: 'GET' | 'POST';
  path: string;
  body?: string;
  nonce: string;
}): Request {
  const body = input.body ?? '';
  const signed = signMachineRequest({
    config,
    token,
    method: input.method,
    path: input.path,
    body,
    timestamp: new Date().toISOString(),
    nonce: input.nonce,
  });
  return new Request(`http://127.0.0.1:46321${input.path}`, {
    method: input.method,
    headers: signed.headers,
    body: input.method === 'POST' ? body : undefined,
  });
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'consuelo-configuration-hono-'));
  writeMinimalOsConfig();
  config = createGatewaySecurityConfig({
    home,
    workspaceId,
    workspaceSlug: 'configuration-hono',
    workspaceHost: 'configuration-hono.consuelohq.com',
  });
  writeYamlConfig(
    resolveConsueloHomeLayout(home).workspaceConfigPath(workspaceId),
    createDefaultWorkspaceYamlConfig({
      workspaceId,
      workspaceName: 'Configuration Hono',
      workspaceSlug: 'configuration-hono',
      workspaceHost: 'configuration-hono.consuelohq.com',
    }),
    false,
  );
  const nodeKeys = generateWorkspaceDeviceKeyPair();
  const heartbeatPath = join(
    resolveConsueloHomeLayout(home).nodeDir,
    'security',
    'generated',
    'workspace-node-heartbeat.json',
  );
  mkdirSync(join(resolveConsueloHomeLayout(home).nodeDir, 'security', 'generated'), { recursive: true });
  writeFileSync(heartbeatPath, JSON.stringify({
    authorityOrigin: 'https://os.consuelohq.com',
    workspaceId,
    nodeId: 'node_configuration_hono',
    connectorStatus: 'connected',
    capabilities: [],
    publicKeyJwk: nodeKeys.publicKeyJwk,
    signingKeyJwk: nodeKeys.signingKeyJwk,
  }), 'utf8');
  token = issueAgentAppToken({
    config,
    callerId: 'caller_configuration_hono',
    appId: 'app_configuration_hono',
    subjectId: 'subject_configuration_hono',
    deviceId: 'device_configuration_hono',
    connectorId: 'connector_configuration_hono',
    connectionId: 'connection_configuration_hono',
    scopes: [
      'route:/gateway/configuration:read',
      'route:/gateway/configuration:write',
      'route:/gateway/settings:read',
      'route:/gateway/settings:write',
    ],
    expiresInSeconds: 300,
  });
  process.env.CONSUELO_HOME = home;
  process.env.CONSUELO_OS_HOME = home;
  process.env.CONSUELO_OS_AUTH_CONFIG = config.generatedAuthPath;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CONSUELO_HOME;
  delete process.env.CONSUELO_OS_HOME;
  delete process.env.CONSUELO_OS_AUTH_CONFIG;
  if (home) rmSync(home, { recursive: true, force: true });
  home = '';
});

describe('Hono Configuration routes', () => {
  it('serves a signed canonical configuration snapshot', async () => {
    const response = await handleRequest(signedRequest({
      method: 'GET',
      path: '/gateway/configuration/snapshot',
      nonce: 'configuration-snapshot-nonce',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      snapshot: {
        version: 1,
        overlay: { path: join(home, 'security', 'overrides', 'manifest.overlay.json') },
      },
    });
  });

  it('applies a signed canonical configuration overlay patch', async () => {
    const tool = readFullToolManifest().tools.find((entry) => entry.kind === 'facade-tool');
    expect(tool).toBeTruthy();
    const body = JSON.stringify({ kind: 'tool', name: tool!.name, enabled: false });

    const response = await handleRequest(signedRequest({
      method: 'POST',
      path: '/gateway/configuration/overlay',
      body,
      nonce: 'configuration-overlay-nonce',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      snapshot: { overlay: { disabledTools: expect.arrayContaining([tool!.name]) } },
    });
  });


  it('reads and writes source-control repositories through Configuration without secret values', async () => {
    const initial = await handleRequest(signedRequest({
      method: 'GET',
      path: '/gateway/configuration/source-control',
      nonce: 'configuration-source-control-read-nonce',
    }));
    expect(initial.status).toBe(200);
    await expect(initial.json()).resolves.toMatchObject({
      ok: true,
      snapshot: { configured: false, repositories: [] },
    });

    const body = JSON.stringify({
      defaultRepositoryId: 'app',
      repositories: [{
        id: 'app',
        name: 'App',
        provider: 'github',
        nameWithOwner: 'acme/app',
        defaultBranch: 'main',
        connectionRef: 'github-app:primary',
        codeRoots: ['src'],
      }],
    });
    const updated = await handleRequest(signedRequest({
      method: 'POST',
      path: '/gateway/configuration/source-control',
      body,
      nonce: 'configuration-source-control-write-nonce',
    }));
    expect(updated.status).toBe(200);
    const serialized = await updated.text();
    expect(serialized).not.toContain('credentialValue');
    expect(serialized).not.toContain('token');
    expect(JSON.parse(serialized)).toMatchObject({
      ok: true,
      snapshot: {
        configured: true,
        defaultRepositoryId: 'app',
        repositories: [{
          id: 'app',
          provider: 'github',
          nameWithOwner: 'acme/app',
          connectionRef: 'github-app:primary',
          codeRoots: ['src'],
          ready: true,
        }],
      },
    });
  });

  it('starts GitHub installation from Configuration without asking for connection bindings', async () => {
    const authorityCalls: Request[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      authorityCalls.push(request.clone());
      return Response.json({
        installUrl: 'https://github.com/apps/consuelo-os/installations/new?state=ghs_test',
      });
    });

    const path = '/gateway/configuration/source-control/github/connect?return_to=%2Fdiffs';
    const response = await handleRequest(signedRequest({
      method: 'GET',
      path,
      nonce: 'configuration-github-connect-nonce',
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const html = await response.text();
    expect(html).toContain('Opening GitHub…');
    expect(html).toContain('https://github.com/apps/consuelo-os/installations/new?state=ghs_test');
    expect(html).toContain('href="/diffs"');
    expect(html).toContain('requestAnimationFrame');
    expect(html).toContain('window.location.replace');
    expect(html).not.toContain('Live trace activity');
    expect(html).not.toContain('Workspace readiness');
    expect(authorityCalls).toHaveLength(1);
    expect(new URL(authorityCalls[0]!.url).pathname).toBe(
      '/workspace/source-control/github/install/start',
    );
    expect(authorityCalls[0]!.headers.get('x-consuelo-node-signature')).toBeTruthy();
    const authorityBody = await authorityCalls[0]!.json() as Record<string, unknown>;
    expect(authorityBody).toMatchObject({
      workspaceId,
      nodeId: 'node_configuration_hono',
      returnPath: '/diffs',
    });
  });

  it('claims a GitHub installation handoff and derives repository configuration', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      expect(new URL(request.url).pathname).toBe(
        '/workspace/source-control/github/install/claim',
      );
      expect(request.headers.get('x-consuelo-node-signature')).toBeTruthy();
      return Response.json({
        connectionId: 'ghc_primary',
        accountLogin: 'consuelohq',
        repositorySelection: 'selected',
        returnPath: '/diffs',
        repositories: [
          { id: 101, nameWithOwner: 'consuelohq/opensaas', defaultBranch: 'main' },
          { id: 202, nameWithOwner: 'consuelohq/docs', defaultBranch: 'main' },
        ],
      });
    });

    const body = JSON.stringify({ handoff: 'ghh_test' });
    const response = await handleRequest(signedRequest({
      method: 'POST',
      path: '/gateway/configuration/source-control/github/complete',
      body,
      nonce: 'configuration-github-complete-nonce',
    }));

    expect(response.status).toBe(200);
    const serialized = await response.text();
    expect(serialized).not.toContain('github-installation-token');
    expect(JSON.parse(serialized)).toMatchObject({
      ok: true,
      returnPath: '/diffs',
      snapshot: {
        configured: true,
        defaultRepositoryId: 'github-101',
        repositories: [
          {
            id: 'github-101',
            provider: 'github',
            nameWithOwner: 'consuelohq/opensaas',
            defaultBranch: 'main',
            connectionRef: 'github-installation:ghc_primary',
            ready: true,
          },
          {
            id: 'github-202',
            provider: 'github',
            nameWithOwner: 'consuelohq/docs',
            defaultBranch: 'main',
            connectionRef: 'github-installation:ghc_primary',
            ready: true,
          },
        ],
      },
    });
  });

  it('rejects unsafe source-control code roots before writing workspace configuration', async () => {
    const body = JSON.stringify({
      defaultRepositoryId: 'app',
      repositories: [{
        id: 'app',
        provider: 'github',
        nameWithOwner: 'acme/app',
        defaultBranch: 'main',
        connectionRef: 'github-app:primary',
        codeRoots: ['../private'],
      }],
    });
    const response = await handleRequest(signedRequest({
      method: 'POST',
      path: '/gateway/configuration/source-control',
      body,
      nonce: 'configuration-source-control-unsafe-root-nonce',
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_SOURCE_CONTROL_CONFIGURATION' },
    });
  });

  it('keeps the signed settings snapshot route as a compatibility alias', async () => {
    const response = await handleRequest(signedRequest({
      method: 'GET',
      path: '/gateway/settings/snapshot',
      nonce: 'legacy-settings-snapshot-nonce',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, snapshot: { version: 1 } });
  });

  it('authorizes before disclosing missing OS-home configuration', async () => {
    delete process.env.CONSUELO_HOME;
    delete process.env.CONSUELO_OS_HOME;
    process.env.CONSUELO_OS_AUTH_CONFIG = join(home, 'missing-auth.json');

    const response = await handleRequest(new Request(
      'http://127.0.0.1:46321/gateway/configuration/snapshot',
    ));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'AUTH_CONFIG_REQUIRED' } });
  });

  it.each([
    ['POST', '/gateway/configuration/snapshot'],
    ['GET', '/gateway/configuration/overlay'],
    ['POST', '/gateway/settings/snapshot'],
    ['GET', '/gateway/settings/overlay'],
  ] as const)('returns not found for unsupported %s %s', async (method, path) => {
    const response = await handleRequest(new Request(`http://127.0.0.1:46321${path}`, { method }));
    expect(response.status).toBe(404);
  });
});
