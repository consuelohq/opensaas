import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  resolveConsueloHomeLayout,
  stringifyYamlConfig,
  type ConsueloWorkspaceYamlConfig,
} from '../scripts/lib/consuelo-home';
import {
  createGatewaySecurityConfig,
  issueAgentAppToken,
  signMachineRequest,
  type AgentAppToken,
  type GatewaySecurityConfig,
} from '../scripts/lib/security-gateway';
import { handleRequest } from '../scripts/server/app';

const workspaceId = 'wrk_diffs_hono';
let home = '';
let config: GatewaySecurityConfig;
let token: AgentAppToken;

function configuredWorkspace(projects: ConsueloWorkspaceYamlConfig['projects'] = [{
  id: 'app',
  name: 'App',
  repo: 'acme/app',
  defaultBranch: 'main',
  provider: 'github',
  connectionRef: 'github-app:primary',
}]): ConsueloWorkspaceYamlConfig {
  return {
    version: 1,
    workspace: {
      id: workspaceId,
      name: 'Diffs Workspace',
      slug: 'diffs-workspace',
      host: 'diffs-workspace.consuelohq.com',
    },
    defaults: { ...(projects.length > 0 ? { project: projects[0]!.id } : {}), node: 'local' },
    projects,
    routing: {},
    policy: { allowedAgents: [] },
    sites: {},
    agents: { defaults: [] },
  };
}

function writeWorkspace(value: ConsueloWorkspaceYamlConfig): void {
  const workspacePath = resolveConsueloHomeLayout(home).workspaceConfigPath(workspaceId);
  mkdirSync(dirname(workspacePath), { recursive: true });
  writeFileSync(workspacePath, stringifyYamlConfig(value), 'utf8');
}

function signedRequest(input: {
  method: 'GET' | 'POST';
  path: string;
  body?: string;
  token?: AgentAppToken;
  nonce?: string;
}): Request {
  const body = input.body ?? '';
  const activeToken = input.token ?? token;
  const signed = signMachineRequest({
    config,
    token: activeToken,
    method: input.method,
    path: input.path,
    body,
    timestamp: new Date().toISOString(),
    nonce: input.nonce ?? crypto.randomUUID(),
  });
  return new Request(`http://127.0.0.1:46321${input.path}`, {
    method: input.method,
    headers: signed.headers,
    body: input.method === 'POST' ? body : undefined,
  });
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'consuelo-diffs-hono-'));
  writeWorkspace(configuredWorkspace());
  config = createGatewaySecurityConfig({
    home,
    workspaceId,
    workspaceSlug: 'diffs-workspace',
    workspaceHost: 'diffs-workspace.consuelohq.com',
  });
  token = issueAgentAppToken({
    config,
    callerId: 'caller_diffs_hono',
    appId: 'app_diffs_hono',
    subjectId: 'subject_diffs_hono',
    deviceId: 'device_diffs_hono',
    connectorId: 'connector_diffs_hono',
    connectionId: 'connection_diffs_hono',
    scopes: ['route:/gateway/diffs:read', 'route:/gateway/diffs:write'],
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

describe('Hono Diffs routes', () => {
  it('serves the signed workspace source-control snapshot without credential values', async () => {
    const response = await handleRequest(signedRequest({
      method: 'GET',
      path: '/gateway/diffs/configuration',
      nonce: 'diffs-config-nonce',
    }));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain('credentialValue');
    expect(text).not.toContain('github-secret');
    expect(JSON.parse(text)).toMatchObject({
      ok: true,
      snapshot: {
        configured: true,
        defaultRepositoryId: 'app',
        repositories: [{
          id: 'app',
          provider: 'github',
          nameWithOwner: 'acme/app',
          connectionRef: 'github-app:primary',
          ready: true,
        }],
      },
    });
  });

  it('rejects repository locators outside the workspace configuration', async () => {
    const allowed = await handleRequest(signedRequest({
      method: 'GET',
      path: '/gateway/diffs/repositories/acme/app',
      nonce: 'diffs-allowed-repo-nonce',
    }));
    expect(allowed.status).toBe(200);

    const denied = await handleRequest(signedRequest({
      method: 'GET',
      path: '/gateway/diffs/repositories/other/private',
      nonce: 'diffs-denied-repo-nonce',
    }));
    expect(denied.status).toBe(404);
    await expect(denied.json()).resolves.toMatchObject({
      ok: false,
      error: { code: 'SOURCE_CONTROL_REPOSITORY_NOT_CONFIGURED' },
    });
  });

  it('serves the existing Diffs UI through the authenticated workspace route', async () => {
    const response = await handleRequest(signedRequest({
      method: 'GET',
      path: '/diffs',
      nonce: 'diffs-page-nonce',
    }));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Consuelo Diffs');
    expect(html).toContain('/gateway/diffs/repositories/acme/app/pulls');
    expect(html).not.toContain('consuelohq/opensaas');
    expect(html).not.toContain('diffs.consuelohq.com');
  });

  it('renders an explicit setup state when source control is not configured', async () => {
    writeWorkspace(configuredWorkspace([]));
    const response = await handleRequest(signedRequest({
      method: 'GET',
      path: '/diffs',
      nonce: 'diffs-unconfigured-page-nonce',
    }));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Connect source control');
    expect(html).toContain('/configuration');
    expect(html).not.toContain('opensaas');
  });

  it('keeps write operations behind the distinct Diffs write scope', async () => {
    const readOnlyToken = issueAgentAppToken({
      config,
      callerId: 'caller_diffs_read_only',
      appId: 'app_diffs_read_only',
      subjectId: 'subject_diffs_read_only',
      deviceId: 'device_diffs_read_only',
      connectorId: 'connector_diffs_read_only',
      connectionId: 'connection_diffs_read_only',
      scopes: ['route:/gateway/diffs:read'],
      expiresInSeconds: 300,
    });
    const response = await handleRequest(signedRequest({
      method: 'POST',
      path: '/gateway/diffs/write/repositories/acme/app/pull/1/merge',
      token: readOnlyToken,
      nonce: 'diffs-read-only-write-nonce',
    }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'MISSING_SCOPE' },
    });
  });

  it('requires signed Diffs access', async () => {
    const response = await handleRequest(new Request('http://127.0.0.1:46321/gateway/diffs/configuration'));
    expect(response.status).toBe(401);
  });
});
