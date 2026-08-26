import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  sealCredential,
} from '../scripts/lib/node-credential-sealing';
import {
  ensureNodeEncryptionKey,
  loadNodeEncryptionPrivateKey,
} from '../scripts/lib/node-encryption-key-file';
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
let publicKeyJwk = '';

function signedRequest(input: {
  path: string;
  nonce: string;
  method?: 'GET' | 'POST';
  body?: string;
  activeToken?: AgentAppToken;
}): Request {
  const method = input.method ?? 'GET';
  const body = input.body ?? '';
  const signed = signMachineRequest({
    config,
    token: input.activeToken ?? token,
    method,
    path: input.path,
    body,
    timestamp: new Date().toISOString(),
    nonce: input.nonce,
  });
  return new Request('http://127.0.0.1:46321' + input.path, {
    method,
    headers: {
      ...signed.headers,
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
    },
    ...(method === 'POST' ? { body } : {}),
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
    scopes: ['route:/gateway/secrets:read', 'route:/gateway/secrets:write'],
    expiresInSeconds: 300,
  });
  process.env.CONSUELO_HOME = home;
  process.env.CONSUELO_OS_HOME = home;
  process.env.CONSUELO_OS_AUTH_CONFIG = config.generatedAuthPath;

  const nodeHome = join(home, 'node');
  const published = ensureNodeEncryptionKey({ nodeHome, workspaceId, nodeId });
  publicKeyJwk = published.publicKeyJwk;
  const privateKeyJwk = loadNodeEncryptionPrivateKey({ nodeHome, workspaceId, nodeId });
  for (const recipient of [
    { workspaceId, nodeId, bindingId: 'GITHUB_TOKEN' },
    { workspaceId, nodeId, bindingId: 'TWILIO_AUTH_TOKEN' },
    { workspaceId: 'workspace_other', nodeId, bindingId: 'OTHER_WORKSPACE_TOKEN' },
    { workspaceId, nodeId: 'node_other', bindingId: 'OTHER_NODE_TOKEN' },
  ]) {
    installSealedCredential({
      home,
      nodePrivateKeyJwk: privateKeyJwk,
      recipient,
      envelope: sealCredential({
        recipientPublicKeyJwk: publicKeyJwk,
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
    const response = await handleRequest(signedRequest({
      path: '/gateway/secrets/bindings',
      nonce: 'secrets-list-metadata-nonce',
    }));
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

  it('returns only the public X25519 setup material for the signed node', async () => {
    const response = await handleRequest(signedRequest({
      path: '/gateway/secrets/setup',
      nonce: 'secrets-setup-public-key-nonce',
    }));
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      workspaceId: string;
      nodeId: string;
      algorithm: string;
      publicKeyJwk: string;
    };
    expect(payload).toMatchObject({
      ok: true,
      workspaceId,
      nodeId,
      algorithm: 'X25519',
      publicKeyJwk,
    });
    expect(JSON.parse(payload.publicKeyJwk)).toMatchObject({ kty: 'OKP', crv: 'X25519' });
    expect(JSON.parse(payload.publicKeyJwk).d).toBeUndefined();
    expect(JSON.stringify(payload)).not.toMatch(/private|plaintext|ciphertext|authTag|secret-value/i);
  });

  it('installs a browser-sealed envelope and returns metadata only', async () => {
    const bindingId = 'STRIPE_SECRET_KEY';
    const recipient = { workspaceId, nodeId, bindingId };
    const envelope = sealCredential({
      recipientPublicKeyJwk: publicKeyJwk,
      recipient,
      plaintext,
    });
    const body = JSON.stringify({ bindingId, envelope });
    const response = await handleRequest(signedRequest({
      path: '/gateway/secrets/install',
      nonce: 'secrets-install-envelope-nonce',
      method: 'POST',
      body,
    }));
    expect(response.status).toBe(200);
    const payload = await response.json() as Record<string, unknown>;
    expect(payload).toMatchObject({
      ok: true,
      binding: {
        workspaceId,
        nodeId,
        bindingId,
        status: 'set',
      },
    });
    expect(JSON.stringify(payload)).not.toContain(plaintext);

    const listed = await handleRequest(signedRequest({
      path: '/gateway/secrets/bindings',
      nonce: 'secrets-list-after-install-nonce',
    }));
    const listedPayload = await listed.json() as { bindings: Array<{ bindingId: string }> };
    expect(listedPayload.bindings.map((binding) => binding.bindingId)).toContain(bindingId);
  });

  it('rejects plaintext writes and recipient mismatches without echoing the value', async () => {
    const plaintextBody = JSON.stringify({ bindingId: 'LEAK_ATTEMPT', value: plaintext });
    const plaintextResponse = await handleRequest(signedRequest({
      path: '/gateway/secrets/install',
      nonce: 'secrets-reject-plaintext-nonce',
      method: 'POST',
      body: plaintextBody,
    }));
    expect(plaintextResponse.status).toBe(400);
    expect(await plaintextResponse.text()).not.toContain(plaintext);

    const bodyBinding = 'EXPECTED_BINDING';
    const envelopeRecipient = { workspaceId, nodeId, bindingId: 'DIFFERENT_BINDING' };
    const mismatchBody = JSON.stringify({
      bindingId: bodyBinding,
      envelope: sealCredential({
        recipientPublicKeyJwk: publicKeyJwk,
        recipient: envelopeRecipient,
        plaintext,
      }),
    });
    const mismatchResponse = await handleRequest(signedRequest({
      path: '/gateway/secrets/install',
      nonce: 'secrets-reject-recipient-mismatch-nonce',
      method: 'POST',
      body: mismatchBody,
    }));
    expect(mismatchResponse.status).toBe(400);
    expect(await mismatchResponse.text()).not.toContain(plaintext);

    const occupiedBindingId = 'OTHER_WORKSPACE_TOKEN';
    const occupiedRecipient = { workspaceId, nodeId, bindingId: occupiedBindingId };
    const occupiedResponse = await handleRequest(signedRequest({
      path: '/gateway/secrets/install',
      nonce: 'secrets-reject-cross-workspace-overwrite-nonce',
      method: 'POST',
      body: JSON.stringify({
        bindingId: occupiedBindingId,
        envelope: sealCredential({
          recipientPublicKeyJwk: publicKeyJwk,
          recipient: occupiedRecipient,
          plaintext,
        }),
      }),
    }));
    expect(occupiedResponse.status).toBe(400);
    expect(await occupiedResponse.text()).not.toContain(plaintext);
  });

  it('requires read/write scopes and still exposes no reveal endpoint', async () => {
    const unsigned = await handleRequest(
      new Request('http://127.0.0.1:46321/gateway/secrets/bindings'),
    );
    expect(unsigned.status).toBe(401);

    const readOnlyToken = issueAgentAppToken({
      config,
      callerId: 'caller_read_only_secret_scope',
      appId: 'app_read_only_secret_scope',
      subjectId: 'subject_read_only_secret_scope',
      deviceId: nodeId,
      connectorId: 'connector_read_only_secret_scope',
      connectionId: 'connection_read_only_secret_scope',
      scopes: ['route:/gateway/secrets:read'],
      expiresInSeconds: 300,
    });
    const bindingId = 'WRITE_SCOPE_REQUIRED';
    const recipient = { workspaceId, nodeId, bindingId };
    const denied = await handleRequest(signedRequest({
      path: '/gateway/secrets/install',
      nonce: 'secrets-missing-write-scope-nonce',
      method: 'POST',
      activeToken: readOnlyToken,
      body: JSON.stringify({
        bindingId,
        envelope: sealCredential({
          recipientPublicKeyJwk: publicKeyJwk,
          recipient,
          plaintext,
        }),
      }),
    }));
    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toMatchObject({
      error: { code: 'MISSING_SCOPE' },
    });

    for (const path of ['/gateway/secrets/reveal', '/gateway/secrets/value']) {
      const write = await handleRequest(new Request('http://127.0.0.1:46321' + path, {
        method: 'POST',
      }));
      expect(write.status).toBe(404);
    }
  });
});
