import { describe, expect, it } from 'vitest';

import { createOsDeviceAuthorityHandler } from '../cloudflare/os-device-authority/src/app';
import { createMemoryDeviceGrantStore } from '../cloudflare/os-device-authority/src/stores';
import type { WorkspaceNode } from '../cloudflare/os-device-authority/src/types';
import {
  createDevicePublicKeyProof,
  devicePublicKeyThumbprint,
  generateWorkspaceDeviceKeyPair,
} from '../scripts/lib/workspace-device-login-client';

const origin = 'https://os.consuelohq.com';
const accountId = 'account_self_revoke_test';
const workspaceId = 'workspace_self_revoke_test';
const workspaceSlug = 'self-revoke-test';
const workspaceHost = 'self-revoke-test.consuelohq.com';
const nowMs = Date.parse('2026-09-22T22:00:00.000Z');

async function setup() {
  const store = createMemoryDeviceGrantStore();
  const key = generateWorkspaceDeviceKeyPair();
  await store.putAccountWorkspace({
    accountId,
    workspaceId,
    workspaceSlug,
    workspaceHost,
    homeNodeId: 'node-home',
    defaultNodeId: 'node-home',
    updatedAt: nowMs,
  });
  await store.putWorkspaceNode({
    accountId,
    workspaceId,
    workspaceSlug,
    workspaceHost,
    nodeId: 'node-home',
    nodeName: 'MacBook',
    displayName: 'MacBook',
    role: 'home',
    platform: 'darwin',
    architecture: 'arm64',
    channel: 'stable',
    connectorId: 'connector_node_home',
    capabilities: ['mcp', 'tools'],
    connectorStatus: 'connected',
    state: 'active',
    devicePublicKeyJwk: key.publicKeyJwk,
    devicePublicKeyThumbprint: await devicePublicKeyThumbprint(key.publicKeyJwk),
    createdAt: nowMs,
    updatedAt: nowMs,
    lastSeenAt: nowMs,
  } satisfies WorkspaceNode);
  return {
    store,
    key,
    handler: createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => nowMs,
    }),
  };
}

describe('workspace node signed self-revocation', () => {
  it('revokes the enrolled node without requiring an operator OAuth token', async () => {
    const { store, key, handler } = await setup();
    const body = JSON.stringify({
      workspaceId,
      nodeId: 'node-home',
      timestamp: nowMs,
      nonce: 'self-revoke-nonce-0001',
    });
    const signature = createDevicePublicKeyProof({
      deviceKeyPair: key,
      payload: body,
    });

    const response = await handler(
      new Request(origin + '/workspace/nodes/self/revoke', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-consuelo-node-signature': signature,
        },
        body,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      node: {
        nodeId: 'node-home',
        state: 'revoked',
      },
    });
    await expect(store.byWorkspaceNodeId('node-home')).resolves.toMatchObject({
      state: 'revoked',
      connectorStatus: 'disconnected',
    });
  });

  it('rejects a forged self-revocation and preserves the node', async () => {
    const { store, handler } = await setup();
    const attackerKey = generateWorkspaceDeviceKeyPair();
    const body = JSON.stringify({
      workspaceId,
      nodeId: 'node-home',
      timestamp: nowMs,
      nonce: 'self-revoke-nonce-forged',
    });
    const signature = createDevicePublicKeyProof({
      deviceKeyPair: attackerKey,
      payload: body,
    });

    const response = await handler(
      new Request(origin + '/workspace/nodes/self/revoke', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-consuelo-node-signature': signature,
        },
        body,
      }),
    );

    expect(response.status).toBe(401);
    await expect(store.byWorkspaceNodeId('node-home')).resolves.toMatchObject({
      state: 'active',
      connectorStatus: 'connected',
    });
  });
});
