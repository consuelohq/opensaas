import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  generateNodeEncryptionKeyPair,
  sealCredential,
} from '../scripts/lib/node-credential-sealing';
import { installSealedCredential } from '../scripts/lib/node-sealed-credential-store';
import {
  createGatewaySecurityConfig,
  issueAgentAppToken,
  signMachineRequest,
  type AgentAppToken,
  type GatewaySecurityConfig,
} from '../scripts/lib/security-gateway';
import { handleRequest } from '../scripts/server/app';

const workspaceId = 'workspace_secrets_hono';
const nodeId = 'node_secrets_home';
const plaintext = 'credential-value-that-must-never-leave-the-node';
let home = '';
let config: GatewaySecurityConfig;
let token: AgentAppToken;

function signedGet(nonce: string, activeToken = token): Request {
  const route = '/gateway/secrets/bindings';
  const signed = signMachineRequest({
    config,
    token: activeToken,
    method: 'GET',
    path: route,
    body: '',
    timestamp: new Date().toISOString(),
    nonce,
  });
  return new Request('http://127.0.0.1:46321' + route, {
    headers: signed.headers,
  });
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'consuelo-secrets-hono-'));
  config = createGatewaySecurityConfig({
    home,
    workspaceId,
    workspaceSlug: 'secrets-hono',
    workspaceHost: 'secrets-hono.consuelohq.com',
  });
  token = issueAgentAppToken({
    config,
    callerId: 'caller_secrets_hono',
    appId: 'app_secrets_hono',
    subjectId: 'subject_secrets_hono',
    deviceId: nodeId,
    connectorId: 'connector_secrets_hono',
    connectionId: 'connection_secrets_hono',
    scopes: ['route:/gateway/secrets:read'],
    expiresInSeconds: 300,
  });
  process.env.CONSUELO_HOME = home;
  process.env.CONSUELO_OS_HOME = home;
  process.env.CONSUELO_OS_AUTH_CONFIG = config.generatedAuthPath;

  const keyPair = generateNodeEncryptionKeyPair();
  for (const recipient of [
    { workspaceId, nodeId, bindingId: 'GITHUB_TOKEN' },
    { workspaceId, nodeId, bindingId: 'TWILIO_AUTH_TOKEN' },
    { workspaceId: 'workspace_other', nodeId, bindingId: 'OTHER_WORKSPACE_TOKEN' },
    { workspaceId, nodeId: 'node_other', bindingId: 'OTHER_NODE_TOKEN' },
  ]) {
    installSealedCredential({
      home,
      nodePrivateKeyJwk: keyPair.privateKeyJwk,
      recipient,
      envelope: sealCredential({
        recipientPublicKeyJwk: keyPair.publicKeyJwk,
        recipient,
        plaintext,
      }),
    });
  }
});

afterEach(() => {
  delete process.env.CONSUELO_HOME;
  delete process.env.CONSUELO_OS_HOME;
  delete process.env.CONSUELO_OS_AUTH_CONFIG;
  if (home) rmSync(home, { recursive: true, force: true });
});

describe('Hono Secrets route', () => {
  it('returns metadata only for the signed workspace and node', async () => {
    const response = await handleRequest(signedGet('secrets-list-metadata-nonce'));
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      bindings: Array<Record<string, unknown>>;
    };

    expect(payload.ok).toBe(true);
    expect(payload.bindings.map((binding) => binding.bindingId)).toEqual([
      'GITHUB_TOKEN',
      'TWILIO_AUTH_TOKEN',
    ]);
    for (const binding of payload.bindings) {
      expect(binding).toEqual({
        workspaceId,
        nodeId,
        bindingId: expect.any(String),
        status: 'set',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    }
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(plaintext);
    for (const binding of payload.bindings) {
      expect(Object.keys(binding)).not.toEqual(
        expect.arrayContaining(['ciphertext', 'authTag', 'iv', 'secret', 'value', 'fingerprint']),
      );
    }
  });

  it('requires the read scope and has no write or reveal endpoint', async () => {
    const unsigned = await handleRequest(
      new Request('http://127.0.0.1:46321/gateway/secrets/bindings'),
    );
    expect(unsigned.status).toBe(401);

    const missingScopeToken = issueAgentAppToken({
      config,
      callerId: 'caller_no_secret_scope',
      appId: 'app_no_secret_scope',
      subjectId: 'subject_no_secret_scope',
      deviceId: nodeId,
      connectorId: 'connector_no_secret_scope',
      connectionId: 'connection_no_secret_scope',
      scopes: ['route:/gateway/environments:read'],
      expiresInSeconds: 300,
    });
    const denied = await handleRequest(
      signedGet('secrets-missing-scope-nonce', missingScopeToken),
    );
    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toMatchObject({
      error: { code: 'MISSING_SCOPE' },
    });

    for (const path of [
      '/gateway/secrets/bindings',
      '/gateway/secrets/reveal',
      '/gateway/secrets/value',
    ]) {
      const write = await handleRequest(new Request('http://127.0.0.1:46321' + path, {
        method: 'POST',
      }));
      expect(write.status).toBe(404);
    }
  });
});
