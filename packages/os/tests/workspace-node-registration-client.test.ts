import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { generateWorkspaceDeviceKeyPair } from '../scripts/lib/workspace-device-login-client';
import { revokeCurrentWorkspaceNode } from '../scripts/lib/workspace-node-registration-client';

function writeConfig(home: string) {
  const key = generateWorkspaceDeviceKeyPair();
  const directory = join(home, 'node', 'security', 'generated');
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'workspace-node-heartbeat.json'),
    JSON.stringify({
      authorityOrigin: 'https://os.consuelohq.com',
      workspaceId: 'workspace_test',
      nodeId: 'node_test',
      connectorStatus: 'connected',
      capabilities: ['mcp'],
      publicKeyJwk: key.publicKeyJwk,
      signingKeyJwk: key.signingKeyJwk,
    }),
    { mode: 0o600 },
  );
}

describe('workspace node registration lifecycle client', () => {
  it('returns not-enrolled when there is no local node identity', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-node-registration-'));
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      revokeCurrentWorkspaceNode({ home, fetchImpl }),
    ).resolves.toBe('not-enrolled');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends a signed self-revocation before local identity is deleted', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-node-registration-'));
    writeConfig(home);
    const fetchImpl = vi.fn<typeof fetch>(async (request) => {
      const raw = request instanceof Request ? request : new Request(request);
      expect(raw.url).toBe('https://os.consuelohq.com/workspace/nodes/self/revoke');
      expect(raw.method).toBe('POST');
      expect(raw.headers.get('x-consuelo-node-signature')).toBeTruthy();
      const payload = await raw.clone().json() as Record<string, unknown>;
      expect(payload).toMatchObject({
        workspaceId: 'workspace_test',
        nodeId: 'node_test',
      });
      expect(typeof payload.timestamp).toBe('number');
      expect(typeof payload.nonce).toBe('string');
      return new Response(JSON.stringify({ node: { nodeId: 'node_test', state: 'revoked' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    await expect(
      revokeCurrentWorkspaceNode({
        home,
        fetchImpl,
        now: () => 1_795_000_000_000,
        createNonce: () => 'revoke-nonce-0001',
      }),
    ).resolves.toBe('revoked');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails closed on authority errors so uninstall can preserve the signing key', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-node-registration-'));
    writeConfig(home);
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ error: { code: 'WORKSPACE_NODE_SERVICE_UNAVAILABLE' } }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      revokeCurrentWorkspaceNode({
        home,
        fetchImpl,
        now: () => 1_795_000_000_000,
        createNonce: () => 'revoke-nonce-0002',
      }),
    ).rejects.toThrow(/HTTP 503/);
  });
});
