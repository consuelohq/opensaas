import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readFullToolManifest } from '../scripts/lib/manifest';
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
  home = mkdtempSync(join(tmpdir(), 'consuelo-settings-hono-'));
  writeMinimalOsConfig();
  config = createGatewaySecurityConfig({
    home,
    workspaceId: 'workspace_settings_hono',
    workspaceSlug: 'settings-hono',
    workspaceHost: 'settings-hono.consuelohq.com',
  });
  token = issueAgentAppToken({
    config,
    callerId: 'caller_settings_hono',
    appId: 'app_settings_hono',
    subjectId: 'subject_settings_hono',
    deviceId: 'device_settings_hono',
    connectorId: 'connector_settings_hono',
    connectionId: 'connection_settings_hono',
    scopes: [
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
  delete process.env.CONSUELO_HOME;
  delete process.env.CONSUELO_OS_HOME;
  delete process.env.CONSUELO_OS_AUTH_CONFIG;
  if (home) rmSync(home, { recursive: true, force: true });
  home = '';
});

describe('Hono Settings routes', () => {
  it('serves a signed Settings snapshot', async () => {
    const response = await handleRequest(signedRequest({
      method: 'GET',
      path: '/gateway/settings/snapshot',
      nonce: 'settings-snapshot-nonce',
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

  it('applies a signed Settings overlay patch', async () => {
    const tool = readFullToolManifest().tools.find((entry) => entry.kind === 'facade-tool');
    expect(tool).toBeTruthy();
    const body = JSON.stringify({ kind: 'tool', name: tool!.name, enabled: false });

    const response = await handleRequest(signedRequest({
      method: 'POST',
      path: '/gateway/settings/overlay',
      body,
      nonce: 'settings-overlay-nonce',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      snapshot: {
        overlay: { disabledTools: expect.arrayContaining([tool!.name]) },
      },
    });
  });

  it('authorizes before disclosing missing OS-home configuration', async () => {
    delete process.env.CONSUELO_HOME;
    delete process.env.CONSUELO_OS_HOME;
    process.env.CONSUELO_OS_AUTH_CONFIG = join(home, 'missing-auth.json');

    const response = await handleRequest(new Request(
      'http://127.0.0.1:46321/gateway/settings/snapshot',
    ));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'AUTH_CONFIG_REQUIRED' },
    });
  });

  it.each([
    ['POST', '/gateway/settings/snapshot'],
    ['GET', '/gateway/settings/overlay'],
  ] as const)('returns not found for unsupported %s %s', async (method, path) => {
    const response = await handleRequest(new Request(
      `http://127.0.0.1:46321${path}`,
      { method },
    ));
    expect(response.status).toBe(404);
  });
});
