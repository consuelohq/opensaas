import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { LocalAgentDetection } from '../scripts/lib/local-agent-connectivity';
import { createGatewaySecurityConfig } from '../scripts/lib/security-gateway';
import { generateWorkspaceDeviceKeyPair } from '../scripts/lib/workspace-device-login-client';
import {
  probeHeartbeatMcpReadiness,
  reconcileHeartbeatEdgeProxyAuth,
  resolveHeartbeatConnectorStatus,
  sendWorkspaceNodeHeartbeatFromConfig,
  verifiedHeartbeatAgentNames,
} from '../scripts/workspace-node-heartbeat';

function detection(name: LocalAgentDetection['name'], status: LocalAgentDetection['status']): LocalAgentDetection {
  return {
    name,
    label: name,
    homePath: '/redacted-agent-home',
    detectionPaths: [],
    configPath: '/redacted-agent-config',
    detected: true,
    support: 'native',
    status,
  };
}

describe('workspace node heartbeat script', () => {
  it('re-inspects verified agents on every one-shot heartbeat run instead of caching install state', () => {
    let invocation = 0;
    const detectAgents = () => {
      invocation += 1;
      return invocation === 1
        ? [detection('opencode', 'verified'), detection('codex', 'verified')]
        : [detection('gemini', 'verified'), detection('codex', 'failed')];
    };
    const input = {
      configPath: '/private/node/security/generated/workspace-node-heartbeat.json',
      config: {
        authorityOrigin: 'https://os.consuelohq.com',
        osHome: '/private/consuelo-home',
        workspaceId: 'workspace_123',
        nodeId: 'node_home',
        connectorStatus: 'connected' as const,
        capabilities: ['mcp'],
        publicKeyJwk: '{}',
        signingKeyJwk: '{}',
      },
      detectAgents,
    };

    expect(verifiedHeartbeatAgentNames(input)).toEqual(['codex', 'opencode']);
    expect(verifiedHeartbeatAgentNames(input)).toEqual(['gemini']);
    expect(invocation).toBe(2);
  });

  it('reconciles a node-scoped edge secret into an already-enrolled node auth file', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-heartbeat-edge-auth-'));
    try {
      const security = createGatewaySecurityConfig({
        home,
        workspaceId: 'workspace_123',
        workspaceSlug: 'workspace-123',
        workspaceHost: 'workspace-123.consuelohq.com',
      });
      const configPath = path.join(
        path.dirname(security.generatedAuthPath),
        'workspace-node-heartbeat.json',
      );
      expect(reconcileHeartbeatEdgeProxyAuth({
        configPath,
        config: {
          authorityOrigin: 'https://os.consuelohq.com',
          workspaceId: 'workspace_123',
          nodeId: 'node_home',
          connectorStatus: 'connected',
          capabilities: ['mcp'],
          publicKeyJwk: '{}',
          signingKeyJwk: '{}',
        },
        result: {
          nodeId: 'node_home',
          presence: 'online',
          routeReady: true,
          connectorId: 'connector_home',
          edgeRequestSigningSecret: 'wen_reconciled_heartbeat_secret',
        },
      })).toBe(true);

      const stored = JSON.parse(fs.readFileSync(security.generatedAuthPath, 'utf8'));
      expect(stored.edgeProxy).toMatchObject({
        version: 1,
        nodeId: 'node_home',
        connectorId: 'connector_home',
        signingSecret: 'wen_reconciled_heartbeat_secret',
      });
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('derives connector status from the assigned health endpoint on every run', async () => {
    const config = {
      authorityOrigin: 'https://os.consuelohq.com',
      workspaceId: 'workspace_123',
      nodeId: 'node_home',
      connectorStatus: 'connected' as const,
      connectorHealthUrl: 'https://c-0123456789abcdef0123456789abcdef.consuelohq.com/health',
      capabilities: ['mcp'],
      publicKeyJwk: '{}',
      signingKeyJwk: '{}',
    };

    await expect(resolveHeartbeatConnectorStatus({
      config,
      fetchImpl: async () => new Response('ok', { status: 200 }),
    })).resolves.toBe('connected');
    await expect(resolveHeartbeatConnectorStatus({
      config,
      fetchImpl: async () => new Response('down', { status: 503 }),
    })).resolves.toBe('disconnected');
    await expect(resolveHeartbeatConnectorStatus({
      config,
      fetchImpl: async () => { throw new Error('network down'); },
    })).resolves.toBe('disconnected');
    await expect(resolveHeartbeatConnectorStatus({
      config: { ...config, connectorHealthUrl: undefined },
    })).resolves.toBe('connected');
  });

  it('skips authority registration when connector health is down instead of reporting disconnected', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-heartbeat-skip-'));
    const configPath = path.join(home, 'workspace-node-heartbeat.json');
    const config = {
      authorityOrigin: 'https://os.consuelohq.com',
      workspaceId: 'workspace_123',
      nodeId: 'node_home',
      connectorStatus: 'connected' as const,
      connectorHealthUrl:
        'https://c-0123456789abcdef0123456789abcdef.consuelohq.com/health',
      capabilities: ['mcp'],
      publicKeyJwk: '{}',
      signingKeyJwk: '{}',
    };
    fs.writeFileSync(configPath, JSON.stringify(config));
    try {
      let fetchCalls = 0;
      const result = await sendWorkspaceNodeHeartbeatFromConfig(configPath, {
        fetchImpl: async () => {
          fetchCalls += 1;
          return new Response('down', { status: 503 });
        },
        detectAgents: () => [],
      });
      expect(result).toMatchObject({
        nodeId: 'node_home',
        presence: 'offline',
        routeReady: false,
        skipped: true,
        reason: 'connector_health_failed',
      });
      expect(fetchCalls).toBe(1);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('signs a tools/list probe through the assigned public connector', async () => {
    let captured: Request | undefined;
    const nonces = ['readiness-request', 'readiness-signature'];
    const ready = await probeHeartbeatMcpReadiness({
      config: {
        authorityOrigin: 'https://os.consuelohq.com',
        workspaceId: 'workspace_123',
        nodeId: 'node_home',
        connectorStatus: 'connected',
        connectorHealthUrl:
          'https://c-0123456789abcdef0123456789abcdef.consuelohq.com/health',
        capabilities: ['mcp'],
        publicKeyJwk: '{}',
        signingKeyJwk: '{}',
      },
      result: {
        nodeId: 'node_home',
        presence: 'online',
        routeReady: true,
        connectorId: 'connector_home',
        edgeRequestSigningSecret: 'wen_heartbeat_readiness_secret',
      },
      now: () => 1_777_777_777_777,
      createNonce: () => nonces.shift() ?? 'unexpected-nonce',
      fetchImpl: async (request) => {
        captured = request instanceof Request ? request : new Request(request);
        return Response.json({
          jsonrpc: '2.0',
          id: 'watchdog-readiness-request',
          result: { tools: [] },
        });
      },
    });

    expect(ready).toBe(true);
    expect(captured?.url).toBe(
      'https://c-0123456789abcdef0123456789abcdef.consuelohq.com/mcp',
    );
    expect(captured?.method).toBe('POST');
    expect(captured?.headers.get('x-consuelo-node-id')).toBe('node_home');
    expect(captured?.headers.get('x-consuelo-connector-id')).toBe('connector_home');
    expect(captured?.headers.get('x-consuelo-edge-signature')).toMatch(/^sha256=/);
    await expect(captured?.json()).resolves.toMatchObject({
      jsonrpc: '2.0',
      method: 'tools/list',
    });
  });

  it('fails closed when the authority route is registered but routed MCP is unavailable', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-heartbeat-mcp-readiness-'));
    try {
      const security = createGatewaySecurityConfig({
        home,
        workspaceId: 'workspace_123',
        workspaceSlug: 'workspace-123',
        workspaceHost: 'workspace-123.consuelohq.com',
      });
      const configPath = path.join(
        path.dirname(security.generatedAuthPath),
        'workspace-node-heartbeat.json',
      );
      const keys = generateWorkspaceDeviceKeyPair();
      fs.writeFileSync(configPath, JSON.stringify({
        authorityOrigin: 'https://os.consuelohq.com',
        workspaceId: 'workspace_123',
        nodeId: 'node_home',
        connectorStatus: 'connected',
        connectorHealthUrl:
          'https://c-0123456789abcdef0123456789abcdef.consuelohq.com/health',
        capabilities: ['mcp'],
        publicKeyJwk: keys.publicKeyJwk,
        signingKeyJwk: keys.signingKeyJwk,
      }));
      const requests: string[] = [];

      const result = await sendWorkspaceNodeHeartbeatFromConfig(configPath, {
        detectAgents: () => [],
        fetchImpl: async (request) => {
          const url = typeof request === 'string' ? request : request.url;
          requests.push(url);
          if (url.endsWith('/health')) return new Response('ok');
          if (url.endsWith('/workspace/nodes/heartbeat')) {
            return Response.json({
              nodeId: 'node_home',
              presence: 'online',
              routeReady: true,
              connectorId: 'connector_home',
              edgeRequestSigningSecret: 'wen_heartbeat_readiness_secret',
            });
          }
          if (url.endsWith('/mcp')) {
            return Response.json(
              { error: { code: 'CONSUELO_NODE_UNAVAILABLE' } },
              { status: 503 },
            );
          }
          throw new Error(`unexpected heartbeat request: ${url}`);
        },
      });

      expect(requests).toEqual([
        'https://c-0123456789abcdef0123456789abcdef.consuelohq.com/health',
        'https://os.consuelohq.com/workspace/nodes/heartbeat',
        'https://c-0123456789abcdef0123456789abcdef.consuelohq.com/mcp',
      ]);
      expect(result).toMatchObject({
        nodeId: 'node_home',
        presence: 'online',
        routeReady: false,
        mcpReady: false,
      });
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('persists the authenticated read-only workspace snapshot for native node discovery', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-heartbeat-snapshot-'));
    const generated = path.join(home, 'node', 'security', 'generated');
    fs.mkdirSync(generated, { recursive: true });
    const configPath = path.join(generated, 'workspace-node-heartbeat.json');
    const keys = generateWorkspaceDeviceKeyPair();
    fs.writeFileSync(configPath, JSON.stringify({
      authorityOrigin: 'https://os.consuelohq.com',
      workspaceId: 'workspace_123',
      nodeId: 'node_home',
      connectorStatus: 'connected',
      capabilities: ['mcp'],
      publicKeyJwk: keys.publicKeyJwk,
      signingKeyJwk: keys.signingKeyJwk,
    }));
    try {
      await sendWorkspaceNodeHeartbeatFromConfig(configPath, {
        detectAgents: () => [],
        fetchImpl: async () => Response.json({
          nodeId: 'node_home',
          presence: 'online',
          routeReady: true,
          workspace: {
            workspaceId: 'workspace_123',
            workspaceHost: 'workspace-123.consuelohq.com',
            currentNodeId: 'node_home',
            defaultNodeId: 'cloud_1',
            nodes: [
              {
                workspaceId: 'workspace_123',
                nodeId: 'node_home',
                displayName: 'Mac Mini',
                role: 'home',
                platform: 'darwin',
                architecture: 'arm64',
                channel: 'canary',
                capabilities: ['mcp'],
                agents: [],
                createdAt: '2026-08-14T20:00:00.000Z',
                lastSeenAt: '2026-08-14T22:00:00.000Z',
                presence: 'online',
                state: 'active',
              },
              {
                workspaceId: 'workspace_123',
                nodeId: 'cloud_1',
                displayName: 'Cloud node',
                role: 'member',
                platform: 'linux',
                architecture: 'x64',
                channel: 'canary',
                capabilities: ['mcp', 'tools'],
                agents: null,
                createdAt: '2026-08-14T20:30:00.000Z',
                lastSeenAt: '2026-08-14T22:00:00.000Z',
                presence: 'online',
                state: 'active',
              },
            ],
          },
        }),
      });

      const snapshotPath = path.join(home, 'node', 'cache', 'workspace-nodes.json');
      const stored = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
      expect(stored).toMatchObject({
        version: 1,
        kind: 'consuelo-workspace-node-snapshot',
        workspaceId: 'workspace_123',
        currentNodeId: 'node_home',
        workspace: {
          defaultNodeId: 'cloud_1',
          nodes: [{ nodeId: 'node_home' }, { nodeId: 'cloud_1' }],
        },
      });
      expect(fs.statSync(snapshotPath).mode & 0o077).toBe(0);
      expect(JSON.stringify(stored)).not.toMatch(/token|secret|connectorId|publicKeyThumbprint/i);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
