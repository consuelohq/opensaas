import { describe, expect, it } from 'vitest';

import {
  createWorkspaceNodeHeartbeatClient,
  type WorkspaceNodeHeartbeatConfig,
} from '../scripts/lib/workspace-node-heartbeat-client';
import { generateWorkspaceDeviceKeyPair } from '../scripts/lib/workspace-device-login-client';
import { MODERN_MCP_PROTOCOL_VERSION } from '../scripts/lib/mcp-protocol';
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
          routeReady: true,
          connectorId: 'connector_member',
          edgeRequestSigningSecret: 'wen_heartbeat_reconciled_secret',
          workspace: {
            workspaceId: 'workspace_123',
            workspaceHost: 'workspace-123.consuelohq.com',
            currentNodeId: 'node_member',
            defaultNodeId: 'node_home',
            nodeCount: 2,
            nodes: [
              {
                workspaceId: 'workspace_123',
                nodeId: 'node_home',
                displayName: 'Home Mac',
                role: 'home',
                platform: 'darwin',
                architecture: 'arm64',
                channel: 'canary',
                capabilities: ['mcp'],
                agents: ['codex'],
                createdAt: '2026-07-22T19:00:00.000Z',
                lastSeenAt: '2026-07-22T19:59:45.000Z',
                presence: 'online',
                state: 'active',
              },
              {
                workspaceId: 'workspace_123',
                nodeId: 'node_member',
                displayName: 'Cloud node',
                role: 'member',
                platform: 'linux',
                architecture: 'x64',
                channel: 'canary',
                capabilities: ['mcp', 'tools'],
                agents: null,
                createdAt: '2026-07-22T19:30:00.000Z',
                lastSeenAt: '2026-07-22T20:00:00.000Z',
                presence: 'online',
                state: 'active',
              },
            ],
          },
        });
      },
    });

    const first = await client.send({
      osVersion: '0.1.85',
      bundleId: 'bundle-cloud-ready',
      mcpProtocolVersion: MODERN_MCP_PROTOCOL_VERSION,
      mcpReady: false,
    });
    nowMs += 30_000;
    const second = await client.send({
      osVersion: '0.1.85',
      bundleId: 'bundle-cloud-ready',
      mcpProtocolVersion: MODERN_MCP_PROTOCOL_VERSION,
      mcpReady: true,
    });

    expect(first).toEqual({
      nodeId: 'node_member',
      presence: 'online',
      routeReady: true,
      connectorId: 'connector_member',
      edgeRequestSigningSecret: 'wen_heartbeat_reconciled_secret',
      workspace: {
        workspaceId: 'workspace_123',
        workspaceHost: 'workspace-123.consuelohq.com',
        currentNodeId: 'node_member',
        defaultNodeId: 'node_home',
        nodes: [
          expect.objectContaining({ nodeId: 'node_home', displayName: 'Home Mac' }),
          expect.objectContaining({ nodeId: 'node_member', displayName: 'Cloud node' }),
        ],
      },
    });
    expect(second).toEqual(first);
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
        osVersion: '0.1.85',
        bundleId: 'bundle-cloud-ready',
        mcpProtocolVersion: MODERN_MCP_PROTOCOL_VERSION,
        mcpReady: index === 1,
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

  it('publishes the node encryption public key inside the signed payload', async () => {
    // Without this the control plane never learns the key, so the remote credential ceremony
    // requires hand-carrying the key file between machines.
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    const encryptionPublicKeyJwk = JSON.stringify({
      crv: 'X25519',
      x: 'tUU-1YUcj6RmuQPTUdJSkM66w9VxUSh1TLmg5sI-fDc',
      kty: 'OKP',
    });
    let sent: Request | undefined;
    const client = createWorkspaceNodeHeartbeatClient({
      config: {
        authorityOrigin: 'https://os.consuelohq.com',
        workspaceId: 'workspace_123',
        nodeId: 'node_member',
        connectorStatus: 'connected',
        capabilities: ['tools', 'mcp'],
        publicKeyJwk: deviceKeyPair.publicKeyJwk,
        signingKeyJwk: deviceKeyPair.signingKeyJwk,
        encryptionPublicKeyJwk,
      },
      now: () => baseNow,
      createNonce: () => 'nonce-enc',
      fetchImpl: async (request) => {
        sent = request;
        return Response.json({ nodeId: 'node_member', presence: 'online' });
      },
    });

    await client.send();
    const body = JSON.parse(await sent!.clone().text());
    expect(body.encryptionPublicKeyJwk).toBe(encryptionPublicKeyJwk);
    // Only the public half may travel.
    expect(await sent!.clone().text()).not.toContain(
      JSON.parse(deviceKeyPair.signingKeyJwk).d,
    );
  });

  it('omits the encryption key when a node predates it', async () => {
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    let sent: Request | undefined;
    const client = createWorkspaceNodeHeartbeatClient({
      config: {
        authorityOrigin: 'https://os.consuelohq.com',
        workspaceId: 'workspace_123',
        nodeId: 'node_member',
        connectorStatus: 'connected',
        capabilities: ['tools'],
        publicKeyJwk: deviceKeyPair.publicKeyJwk,
        signingKeyJwk: deviceKeyPair.signingKeyJwk,
      },
      now: () => baseNow,
      createNonce: () => 'nonce-none',
      fetchImpl: async (request) => {
        sent = request;
        return Response.json({ nodeId: 'node_member', presence: 'online' });
      },
    });

    await client.send();
    expect(
      JSON.parse(await sent!.clone().text()).encryptionPublicKeyJwk,
    ).toBeUndefined();
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

  it('rejects capability overflow instead of silently truncating the signed heartbeat', () => {
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    expect(() => createWorkspaceNodeHeartbeatClient({
      config: {
        authorityOrigin: 'https://os.consuelohq.com',
        workspaceId: 'workspace_123',
        nodeId: 'node_member',
        connectorStatus: 'connected',
        capabilities: Array.from({ length: 33 }, (_, index) => `capability-${index}`),
        publicKeyJwk: deviceKeyPair.publicKeyJwk,
        signingKeyJwk: deviceKeyPair.signingKeyJwk,
      },
    })).toThrow(/at most 32/i);
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

describe('workspace heartbeat error diagnostics', () => {
  it.each([
    ['WORKSPACE_ROUTE_QUOTA_EXCEEDED', 'WORKSPACE_ROUTE_QUOTA_EXCEEDED'],
    ['WORKSPACE_ROUTE_RECONCILIATION_FAILED', 'WORKSPACE_ROUTE_RECONCILIATION_FAILED'],
    ['WORKSPACE_ROUTE_NOT_READY', 'WORKSPACE_ROUTE_NOT_READY'],
    ['WORKSPACE_ROUTE_UNKNOWN', undefined],
    ['Bearer unsafe-provider-secret', undefined],
  ])(
    'should expose only recognized authority error codes: %s', async (code, expectedCode) => {
      const keys = generateWorkspaceDeviceKeyPair();
      const client = createWorkspaceNodeHeartbeatClient({
        config: {
          ...keys, authorityOrigin: 'https://os.consuelohq.com',
          workspaceId: 'workspace_test', nodeId: 'node_test',
          connectorStatus: 'connected', capabilities: ['mcp'],
        },
        fetchImpl: async () => Response.json({
          error: { code, message: 'Bearer unsafe-provider-secret' },
        }, { status: 503 }),
      });
      await expect(client.send()).rejects.toMatchObject({
        status: 503,
        code: expectedCode,
      });
      await expect(client.send()).rejects.not.toThrow('unsafe-provider-secret');
    },
  );

  it('should cancel a non-terminating 503 body and preserve the HTTP failure', async () => {
    const keys = generateWorkspaceDeviceKeyPair();
    let cancelled = false;
    let streamController: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
        controller.enqueue(new TextEncoder().encode('{"error":'));
      },
      cancel() { cancelled = true; },
    });
    const client = createWorkspaceNodeHeartbeatClient({
      config: {
        ...keys, authorityOrigin: 'https://os.consuelohq.com',
        workspaceId: 'workspace_test', nodeId: 'node_test',
        connectorStatus: 'connected', capabilities: ['mcp'],
      },
      fetchImpl: async () => new Response(body, { status: 503 }),
    });
    let guard: ReturnType<typeof setTimeout> | undefined;
    try {
      const failure = await Promise.race([
        client.send().catch((error: unknown) => error),
        new Promise((resolve) => {
          guard = setTimeout(() => resolve('body read did not finish'), 2_000);
        }),
      ]);
      expect(failure).toMatchObject({ status: 503, code: undefined });
      expect(cancelled).toBe(true);
    } finally {
      clearTimeout(guard);
      if (!cancelled) streamController!.close();
    }
  });
});
