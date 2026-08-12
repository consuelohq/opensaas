import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { LocalAgentDetection } from '../scripts/lib/local-agent-connectivity';
import { createGatewaySecurityConfig } from '../scripts/lib/security-gateway';
import {
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
});
