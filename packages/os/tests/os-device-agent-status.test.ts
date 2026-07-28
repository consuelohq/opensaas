import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createOsDeviceAuthorityHandler } from '../cloudflare/os-device-authority/src/app';
import {
  commitGrantApproval,
  prepareGrantApproval,
} from '../cloudflare/os-device-authority/src/services/grants';
import { createMemoryDeviceGrantStore } from '../cloudflare/os-device-authority/src/stores';
import type { Grant } from '../cloudflare/os-device-authority/src/types';

const origin = 'https://os.consuelohq.com';
const bootstrapToken = 'cbt_test_agent_status_secret';

function tokenHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function grant(): Grant {
  return {
    hash: 'grant-hash',
    userCode: 'ABCD-EFGH',
    workspaceSlug: 'internal',
    workspaceHost: 'internal.consuelohq.com',
    status: 'pending',
    expiresAt: Date.parse('2026-07-19T01:00:00.000Z'),
    interval: 5,
    devicePublicKeyJwk: '{}',
    deviceKeyAlgorithm: 'Ed25519',
    devicePublicKeyThumbprint: 'dpk_agent_status',
    nodeId: 'node-home',
    nodeName: 'Home Mac',
  };
}

describe('OS device-authority workspace agent status', () => {
  it('persists a hashed, expiring bootstrap credential during grant approval', async () => {
    const store = createMemoryDeviceGrantStore();
    const pending = grant();

    await prepareGrantApproval({
      store,
      grant: pending,
      accountId: 'account_internal',
      authMethod: 'google',
      nowMs: Date.parse('2026-07-19T00:00:00.000Z'),
      connectorToken: bootstrapToken,
    });
    await commitGrantApproval({
      store,
      grant: pending,
      accountId: 'account_internal',
      nowMs: Date.parse('2026-07-19T00:00:00.000Z'),
    });

    const credential = await store.byNodeBootstrapCredential(tokenHash(bootstrapToken));
    expect(credential).toMatchObject({
      tokenHash: tokenHash(bootstrapToken),
      accountId: 'account_internal',
      workspaceId: 'workspace_internal',
      workspaceHost: 'internal.consuelohq.com',
      nodeId: 'node-home',
    });
    expect(credential?.expiresAt).toBeGreaterThan(Date.parse('2026-07-19T00:00:00.000Z'));
    expect(JSON.stringify(credential)).not.toContain(bootstrapToken);
  });

  it('accepts a valid node-bound write and exposes only a redacted public aggregate', async () => {
    const store = createMemoryDeviceGrantStore();
    await store.putNodeBootstrapCredential({
      tokenHash: tokenHash(bootstrapToken),
      accountId: 'account_internal',
      workspaceId: 'workspace_internal',
      workspaceHost: 'internal.consuelohq.com',
      nodeId: 'node-home',
      expiresAt: Date.parse('2026-07-19T00:10:00.000Z'),
    });
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => Date.parse('2026-07-19T00:05:00.000Z'),
    });

    const write = await handler(new Request(`${origin}/workspace/agents`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bootstrapToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ agents: ['opencode', 'codex', 'codex'] }),
    }));
    expect(write.status).toBe(200);
    await expect(write.json()).resolves.toMatchObject({
      ok: true,
      state: 'offline',
      connectedAgentCount: 2,
      agents: [
        { name: 'codex', label: 'Codex' },
        { name: 'opencode', label: 'OpenCode' },
      ],
    });

    const read = await handler(new Request(
      `${origin}/workspace/agents?workspace_host=internal.consuelohq.com`,
      { headers: { origin: 'https://internal.consuelohq.com' } },
    ));
    expect(read.status).toBe(200);
    expect(read.headers.get('access-control-allow-origin')).toBe('*');
    expect(read.headers.get('cache-control')).toBe('no-store');
    const body = await read.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      ok: true,
      workspaceHost: 'internal.consuelohq.com',
      connectedAgentCount: 2,
      agents: [
        { name: 'codex', label: 'Codex' },
        { name: 'opencode', label: 'OpenCode' },
      ],
    });
    expect(body).toMatchObject({ state: 'offline' });
    expect(JSON.stringify(body)).not.toMatch(/account_internal|node-home|tokenHash|cbt_|configPath|homePath/i);
  });

  it('seeds the matching node agent set without fabricating heartbeat freshness', async () => {
    const nowMs = Date.parse('2026-07-19T00:05:00.000Z');
    const store = createMemoryDeviceGrantStore();
    await store.putWorkspaceNode({
      accountId: 'account_internal',
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      workspaceHost: 'internal.consuelohq.com',
      nodeId: 'node-home',
      nodeName: 'Home Mac',
      role: 'home',
      connectorStatus: 'connected',
      devicePublicKeyThumbprint: 'thumbprint-home',
      createdAt: nowMs - 1_000,
      updatedAt: nowMs - 1_000,
      lastSeenAt: nowMs - 1_000,
    });
    await store.putNodeBootstrapCredential({
      tokenHash: tokenHash(bootstrapToken),
      accountId: 'account_internal',
      workspaceId: 'workspace_internal',
      workspaceHost: 'internal.consuelohq.com',
      nodeId: 'node-home',
      expiresAt: nowMs + 60_000,
    });
    const handler = createOsDeviceAuthorityHandler({ store, origin, now: () => nowMs });

    const write = await handler(new Request(`${origin}/workspace/agents`, {
      method: 'POST',
      headers: { authorization: `Bearer ${bootstrapToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ agents: ['gemini', 'codex'] }),
    }));

    expect(write.status).toBe(200);
    expect((await store.byWorkspaceNode('account_internal', 'node-home'))).toMatchObject({
      agents: ['codex', 'gemini'],
      lastSeenAt: nowMs - 1_000,
    });
    await expect(write.json()).resolves.toMatchObject({
      state: 'online',
      connectedAgentCount: 2,
    });
  });

  it('replaces one node status, aggregates nodes, and fails closed for invalid writes', async () => {
    const store = createMemoryDeviceGrantStore();
    await store.putNodeBootstrapCredential({
      tokenHash: tokenHash('cbt_node_home_fixture'),
      accountId: 'account_internal',
      workspaceId: 'workspace_internal',
      workspaceHost: 'internal.consuelohq.com',
      nodeId: 'node-home',
      expiresAt: Date.parse('2026-07-19T00:10:00.000Z'),
    });
    await store.putNodeBootstrapCredential({
      tokenHash: tokenHash('cbt_node_member_fixture'),
      accountId: 'account_internal',
      workspaceId: 'workspace_internal',
      workspaceHost: 'internal.consuelohq.com',
      nodeId: 'node-member',
      expiresAt: Date.parse('2026-07-19T00:10:00.000Z'),
    });
    await store.putNodeBootstrapCredential({
      tokenHash: tokenHash('cbt_expired_fixture'),
      accountId: 'account_internal',
      workspaceId: 'workspace_internal',
      workspaceHost: 'internal.consuelohq.com',
      nodeId: 'node-expired',
      expiresAt: Date.parse('2026-07-18T23:59:00.000Z'),
    });
    await store.putNodeBootstrapCredential({
      tokenHash: tokenHash('cbt_cross_workspace_fixture'),
      accountId: 'account_other',
      workspaceId: 'workspace_other',
      workspaceHost: 'other.consuelohq.com',
      nodeId: 'node-other',
      expiresAt: Date.parse('2026-07-19T00:10:00.000Z'),
    });
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => Date.parse('2026-07-19T00:05:00.000Z'),
    });

    const post = (token: string, agents: string[]) => handler(new Request(`${origin}/workspace/agents`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ agents }),
    }));

    expect((await post('cbt_node_home_fixture', ['codex', 'claude'])).status).toBe(200);
    expect((await post('cbt_node_member_fixture', ['gemini', 'codex'])).status).toBe(200);
    expect((await post('cbt_node_home_fixture', ['opencode'])).status).toBe(200);

    const aggregate = await handler(new Request(`${origin}/workspace/agents?workspace_host=internal.consuelohq.com`));
    await expect(aggregate.json()).resolves.toMatchObject({
      connectedAgentCount: 3,
      agents: [
        { name: 'codex', label: 'Codex' },
        { name: 'gemini', label: 'Gemini' },
        { name: 'opencode', label: 'OpenCode' },
      ],
    });

    expect((await post('cbt_expired_fixture', ['codex'])).status).toBe(401);
    expect((await post('unknown-token-fixture', ['codex'])).status).toBe(401);
    expect((await post('cbt_cross_workspace_fixture', ['factory'])).status).toBe(200);
    expect((await post('cbt_node_home_fixture', ['unknown-agent'])).status).toBe(400);
    const malformed = await handler(new Request(`${origin}/workspace/agents`, {
      method: 'POST',
      headers: { authorization: 'Bearer cbt_node_home_fixture', 'content-type': 'application/json' },
      body: JSON.stringify({ agents: [{ name: 'codex', configPath: '/private/config' }] }),
    }));
    expect(malformed.status).toBe(400);

    const internal = await handler(new Request(`${origin}/workspace/agents?workspace_host=internal.consuelohq.com`));
    await expect(internal.json()).resolves.toMatchObject({ connectedAgentCount: 3 });
    const other = await handler(new Request(`${origin}/workspace/agents?workspace_host=other.consuelohq.com`));
    await expect(other.json()).resolves.toMatchObject({
      connectedAgentCount: 1,
      agents: [{ name: 'factory', label: 'Factory' }],
    });
  });
});
