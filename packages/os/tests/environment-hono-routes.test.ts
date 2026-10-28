import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

function signedRequest(method: 'GET' | 'POST', path: string, body = '', nonce = crypto.randomUUID()): Request {
  const signed = signMachineRequest({
    config,
    token,
    method,
    path,
    body,
    timestamp: new Date().toISOString(),
    nonce,
  });
  return new Request(`http://127.0.0.1:46321${path}`, {
    method,
    headers: signed.headers,
    body: method === 'POST' ? body : undefined,
  });
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'consuelo-environment-hono-'));
  config = createGatewaySecurityConfig({
    home,
    workspaceId: 'wrk_environment_hono',
    workspaceSlug: 'environment-hono',
    workspaceHost: 'environment-hono.consuelohq.com',
  });
  token = issueAgentAppToken({
    config,
    callerId: 'caller_environment_hono',
    appId: 'app_environment_hono',
    subjectId: 'subject_environment_hono',
    deviceId: 'device_environment_hono',
    connectorId: 'connector_environment_hono',
    connectionId: 'connection_environment_hono',
    scopes: ['route:/gateway/environments:read', 'route:/gateway/environments:write'],
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
});

describe('Hono Environment routes', () => {
  it('supports signed create, list, and delete operations', async () => {
    const createBody = JSON.stringify({ name: 'Production', scope: { kind: 'workspace' }, metadata: { REGION: 'iad1' } });
    const createResponse = await handleRequest(signedRequest('POST', '/gateway/environments/upsert', createBody, 'environment-create-nonce'));
    expect(createResponse.status).toBe(200);
    const created = await createResponse.json() as { environment: { environmentId: string } };

    const listResponse = await handleRequest(signedRequest('GET', '/gateway/environments/snapshot', '', 'environment-list-nonce'));
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      ok: true,
      snapshot: { workspaceId: 'wrk_environment_hono', environments: [{ name: 'Production' }] },
    });

    const deleteBody = JSON.stringify({ environmentId: created.environment.environmentId });
    const deleteResponse = await handleRequest(signedRequest('POST', '/gateway/environments/delete', deleteBody, 'environment-delete-nonce'));
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toMatchObject({ ok: true, snapshot: { environments: [] } });
  });

  it('requires signed environment scopes', async () => {
    const response = await handleRequest(new Request('http://127.0.0.1:46321/gateway/environments/snapshot'));
    expect(response.status).toBe(401);
  });

  it('separates environment read and write authorization', async () => {
    const readOnlyToken = issueAgentAppToken({
      config,
      callerId: 'caller_environment_read_only',
      appId: 'app_environment_read_only',
      subjectId: 'subject_environment_read_only',
      deviceId: 'device_environment_read_only',
      connectorId: 'connector_environment_read_only',
      connectionId: 'connection_environment_read_only',
      scopes: ['route:/gateway/environments:read'],
      expiresInSeconds: 300,
    });
    const body = JSON.stringify({ name: 'Denied', scope: { kind: 'workspace' } });
    const signed = signMachineRequest({
      config,
      token: readOnlyToken,
      method: 'POST',
      path: '/gateway/environments/upsert',
      body,
      timestamp: new Date().toISOString(),
      nonce: 'environment-read-only-nonce',
    });
    const response = await handleRequest(new Request('http://127.0.0.1:46321/gateway/environments/upsert', {
      method: 'POST',
      headers: signed.headers,
      body,
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'MISSING_SCOPE' },
    });
  });
});
