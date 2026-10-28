import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createDefaultWorkspaceYamlConfig,
  resolveConsueloHomeLayout,
  writeYamlConfig,
} from '../scripts/lib/consuelo-home';
import { readFullToolManifest } from '../scripts/lib/manifest';
import {
  createSettingsSitesGatewayEndpoints,
  settingsGatewayScopeFromHeaders,
} from '../scripts/lib/settings-sites-gateway-endpoints';

function writeMinimalOsHome(home: string): void {
  fs.writeFileSync(
    path.join(home, 'config.json'),
    JSON.stringify({
      version: 1,
      mode: 'local',
      home,
      port: 8787,
      artifactStorage: 'local',
      agents: [],
      createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
    }),
    'utf8',
  );
  fs.mkdirSync(path.join(home, 'security', 'overrides'), { recursive: true });
  writeYamlConfig(
    resolveConsueloHomeLayout(home).workspaceConfigPath('wrk_configuration'),
    createDefaultWorkspaceYamlConfig({
      workspaceId: 'wrk_configuration',
      workspaceName: 'Configuration Gateway',
      workspaceSlug: 'configuration-gateway',
      workspaceHost: 'testing.consuelohq.com',
    }),
    false,
  );
}

function request(
  pathname: string,
  init: RequestInit = {},
  vocabulary: 'configuration' | 'settings' = 'configuration',
): Request {
  return new Request(`https://testing.consuelohq.com${pathname}`, {
    ...init,
    headers: {
      'x-consuelo-user-id': 'usr_configuration',
      'x-consuelo-workspace-id': 'wrk_configuration',
      'x-consuelo-workspace-host': 'testing.consuelohq.com',
      'x-consuelo-allowed-sites': vocabulary,
      'x-consuelo-capabilities': `${vocabulary}-read,${vocabulary}-write`,
      'x-consuelo-source-modes': 'local-networked,cloud-compute,local-off-network',
      ...(init.headers ?? {}),
    },
  });
}

describe('Configuration Sites gateway endpoints', () => {
  it('serves the canonical configuration snapshot without exposing implementation targets', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-configuration-gateway-endpoints-'));
    writeMinimalOsHome(home);
    const endpoints = createSettingsSitesGatewayEndpoints({ home, resolveScope: settingsGatewayScopeFromHeaders });

    const response = await endpoints.handle(request('/gateway/configuration/snapshot'));
    const body = await response.json() as Record<string, unknown>;
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      publicBoundary: 'consuelo-gateway',
      route: '/gateway/configuration/snapshot',
      workspace: {
        workspaceId: 'wrk_configuration',
        workspaceHost: 'testing.consuelohq.com',
      },
    });
    expect(serialized).toContain('overlay');
    expect(serialized).not.toMatch(/local-trace-db|tunnelOriginUrl|upstreamUrl|implementationPath/i);
  });

  it('applies canonical configuration overlay writes', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-configuration-gateway-endpoints-'));
    writeMinimalOsHome(home);
    const tool = readFullToolManifest().tools.find((entry) => entry.kind === 'facade-tool');
    expect(tool).toBeTruthy();
    const endpoints = createSettingsSitesGatewayEndpoints({ home, resolveScope: settingsGatewayScopeFromHeaders });

    const response = await endpoints.handle(request('/gateway/configuration/overlay', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'tool', name: tool!.name, enabled: false }),
    }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      publicBoundary: 'consuelo-gateway',
      route: '/gateway/configuration/overlay',
    });
    expect(JSON.stringify(body)).toContain(tool!.name);
  });

  it('reads and writes source-control repository configuration through the scoped gateway', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-configuration-gateway-endpoints-'));
    writeMinimalOsHome(home);
    const endpoints = createSettingsSitesGatewayEndpoints({ home, resolveScope: settingsGatewayScopeFromHeaders });

    const initial = await endpoints.handle(request('/gateway/configuration/source-control'));
    expect(initial.status).toBe(200);
    await expect(initial.json()).resolves.toMatchObject({
      ok: true,
      route: '/gateway/configuration/source-control',
      workspace: { workspaceId: 'wrk_configuration' },
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
    const updated = await endpoints.handle(request('/gateway/configuration/source-control', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }));
    expect(updated.status).toBe(200);
    const serialized = await updated.text();
    expect(serialized).not.toContain('credentialValue');
    expect(serialized).not.toContain('token');
    expect(JSON.parse(serialized)).toMatchObject({
      ok: true,
      route: '/gateway/configuration/source-control',
      snapshot: {
        configured: true,
        defaultRepositoryId: 'app',
        repositories: [{ nameWithOwner: 'acme/app', connectionRef: 'github-app:primary' }],
      },
    });
  });

  it('denies source-control writes without configuration-write capability', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-configuration-gateway-endpoints-'));
    writeMinimalOsHome(home);
    const endpoints = createSettingsSitesGatewayEndpoints({ home, resolveScope: settingsGatewayScopeFromHeaders });
    const response = await endpoints.handle(request('/gateway/configuration/source-control', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-consuelo-capabilities': 'configuration-read',
      },
      body: JSON.stringify({ defaultRepositoryId: null, repositories: [] }),
    }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'CAPABILITY_SCOPE_DENIED' },
    });
  });

  it('rejects unsafe source-control paths at the gateway boundary', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-configuration-gateway-endpoints-'));
    writeMinimalOsHome(home);
    const endpoints = createSettingsSitesGatewayEndpoints({ home, resolveScope: settingsGatewayScopeFromHeaders });
    const response = await endpoints.handle(request('/gateway/configuration/source-control', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        defaultRepositoryId: 'app',
        repositories: [{
          id: 'app',
          provider: 'github',
          nameWithOwner: 'acme/app',
          connectionRef: 'github-app:primary',
          codeRoots: ['../private'],
        }],
      }),
    }));
    expect(response.status).toBe(400);
    const errorBody = await response.json() as { error: { code: string; message: string } };
    expect(errorBody).toMatchObject({
      error: {
        code: 'INVALID_SOURCE_CONTROL_CONFIGURATION',
        message: 'Source-control configuration is invalid.',
      },
    });
    expect(JSON.stringify(errorBody)).not.toContain('../private');
    expect(JSON.stringify(errorBody)).not.toContain(home);
  });

  it('keeps legacy settings gateway routes and scopes as compatibility aliases', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-configuration-gateway-endpoints-'));
    writeMinimalOsHome(home);
    const endpoints = createSettingsSitesGatewayEndpoints({ home, resolveScope: settingsGatewayScopeFromHeaders });

    const response = await endpoints.handle(request(
      '/gateway/settings/snapshot',
      {},
      'settings',
    ));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, route: '/gateway/settings/snapshot' });
  });

  it('denies overlay writes when configuration-write capability is missing', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-configuration-gateway-endpoints-'));
    writeMinimalOsHome(home);
    const endpoints = createSettingsSitesGatewayEndpoints({ home, resolveScope: settingsGatewayScopeFromHeaders });

    const response = await endpoints.handle(request('/gateway/configuration/overlay', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-consuelo-capabilities': 'configuration-read',
      },
      body: JSON.stringify({ kind: 'tool', name: 'example-tool', enabled: false }),
    }));
    const body = await response.json() as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('CAPABILITY_SCOPE_DENIED');
  });

  it('fails closed when signed gateway scope headers are missing', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-configuration-gateway-endpoints-'));
    writeMinimalOsHome(home);
    const endpoints = createSettingsSitesGatewayEndpoints({ home, resolveScope: settingsGatewayScopeFromHeaders });

    const response = await endpoints.handle(new Request(
      'https://testing.consuelohq.com/gateway/configuration/snapshot',
    ));
    const body = await response.json() as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('SCOPE_RESOLUTION_FAILED');
  });
});
