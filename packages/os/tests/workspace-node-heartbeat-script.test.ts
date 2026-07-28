import { describe, expect, it } from 'vitest';

import type { LocalAgentDetection } from '../scripts/lib/local-agent-connectivity';
import {
  resolveHeartbeatConnectorStatus,
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
});
