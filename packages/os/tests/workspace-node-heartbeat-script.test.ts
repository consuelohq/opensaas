import { describe, expect, it } from 'vitest';

import type { LocalAgentDetection } from '../scripts/lib/local-agent-connectivity';
import { verifiedHeartbeatAgentNames } from '../scripts/workspace-node-heartbeat';

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
});
