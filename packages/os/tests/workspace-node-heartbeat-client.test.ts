import { describe, expect, it } from 'vitest';

import {
  createWorkspaceNodeHeartbeatClient,
  type WorkspaceNodeHeartbeatConfig,
} from '../scripts/lib/workspace-node-heartbeat-client';
import { generateWorkspaceDeviceKeyPair } from '../scripts/lib/workspace-device-login-client';
import { b64Decode } from '../cloudflare/os-device-authority/src/utils';

const baseNow = Date.parse('2026-07-22T20:00:00.000Z');

async function verifiesSignature(input: {
  publicKeyJwk: string;
  payload: string;
  signature: string;
}): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(input.publicKeyJwk),
    { name: 'Ed25519' },
    false,
    ['verify'],
  );
  return await crypto.subtle.verify(
    { name: 'Ed25519' },
    key,
    b64Decode(input.signature),
    new TextEncoder().encode(input.payload),
  );
}

describe('workspace node heartbeat client', () => {
  it('emits recurring signed heartbeats inside the server TTL without leaking the signing key', async () => {
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    let nowMs = baseNow;
    let nonce = 0;
    const requests: Request[] = [];
    const config: WorkspaceNodeHeartbeatConfig = {
      authorityOrigin: 'https://os.consuelohq.com',
      workspaceId: 'workspace_123',
      nodeId: 'node_member',
      connectorStatus: 'connected',
      capabilities: ['tools', 'mcp'],
      publicKeyJwk: deviceKeyPair.publicKeyJwk,
      signingKeyJwk: deviceKeyPair.signingKeyJwk,
    };
    const client = createWorkspaceNodeHeartbeatClient({
      config,
      agents: ['opencode', 'codex', 'codex'],
      now: () => nowMs,
      createNonce: () => `heartbeat-nonce-${++nonce}`,
      fetchImpl: async (request) => {
        requests.push(request);
        return Response.json({
          nodeId: 'node_member',
          presence: 'online',
        });
      },
    });

    const first = await client.send();
    nowMs += 30_000;
    const second = await client.send();

    expect(first).toEqual({ nodeId: 'node_member', presence: 'online' });
    expect(second).toEqual({ nodeId: 'node_member', presence: 'online' });
    expect(requests).toHaveLength(2);
    for (const [index, request] of requests.entries()) {
      expect(request.url).toBe('https://os.consuelohq.com/workspace/nodes/heartbeat');
      expect(request.method).toBe('POST');
      const payload = await request.clone().text();
      const body = JSON.parse(payload) as Record<string, unknown>;
      expect(body).toMatchObject({
        workspaceId: 'workspace_123',
        nodeId: 'node_member',
        timestamp: baseNow + index * 30_000,
        nonce: `heartbeat-nonce-${index + 1}`,
        connectorStatus: 'connected',
        capabilities: ['mcp', 'tools'],
        agents: ['codex', 'opencode'],
      });
      const signature = request.headers.get('x-consuelo-node-signature');
      expect(signature).toBeTruthy();
      await expect(
        verifiesSignature({
          publicKeyJwk: deviceKeyPair.publicKeyJwk,
          payload,
          signature: signature!,
        }),
      ).resolves.toBe(true);
      expect(payload).not.toContain(deviceKeyPair.signingKeyJwk);
      expect(payload).not.toMatch(/configPath|homePath|osHome|\/Users\//i);
    }
    expect(JSON.stringify(first)).not.toContain(deviceKeyPair.signingKeyJwk);
  });

  it('rejects unknown agent identifiers before signing or sending a heartbeat', () => {
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    const config: WorkspaceNodeHeartbeatConfig = {
      authorityOrigin: 'https://os.consuelohq.com',
      workspaceId: 'workspace_123',
      nodeId: 'node_member',
      connectorStatus: 'connected',
      capabilities: ['mcp'],
      publicKeyJwk: deviceKeyPair.publicKeyJwk,
      signingKeyJwk: deviceKeyPair.signingKeyJwk,
    };

    expect(() => createWorkspaceNodeHeartbeatClient({
      config,
      agents: ['codex', 'unknown-agent'] as never,
    })).toThrow(/known agent/i);
  });

  it('fails closed on non-JSON and non-success authority responses without echoing the key', async () => {
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    const config: WorkspaceNodeHeartbeatConfig = {
      authorityOrigin: 'https://os.consuelohq.com',
      workspaceId: 'workspace_123',
      nodeId: 'node_member',
      connectorStatus: 'connected',
      capabilities: ['mcp'],
      publicKeyJwk: deviceKeyPair.publicKeyJwk,
      signingKeyJwk: deviceKeyPair.signingKeyJwk,
    };
    const client = createWorkspaceNodeHeartbeatClient({
      config,
      fetchImpl: async () => new Response('upstream failed', { status: 503 }),
    });

    await expect(client.send()).rejects.toThrow(
      'workspace node heartbeat failed with HTTP 503',
    );
    await expect(client.send()).rejects.not.toThrow(deviceKeyPair.signingKeyJwk);
  });
});
