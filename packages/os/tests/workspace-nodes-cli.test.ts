import { describe, expect, it } from 'vitest';

import {
  createWorkspaceNodeClient,
  formatWorkspaceNodeCommandResult,
  parseWorkspaceNodeCommand,
} from '../scripts/lib/workspace-node-client';

describe('workspace node management CLI contract', () => {
  it('parses discoverable list, default, rename, and revoke commands', () => {
    expect(parseWorkspaceNodeCommand(['list', '--current-node', 'node-home'])).toEqual({
      action: 'list',
      currentNodeId: 'node-home',
    });
    expect(parseWorkspaceNodeCommand(['default', 'node-member'])).toEqual({
      action: 'default',
      nodeId: 'node-member',
    });
    expect(parseWorkspaceNodeCommand(['rename', 'node-member', 'Travel Mac'])).toEqual({
      action: 'rename',
      nodeId: 'node-member',
      displayName: 'Travel Mac',
    });
    expect(parseWorkspaceNodeCommand(['revoke', 'node-member'])).toEqual({
      action: 'revoke',
      nodeId: 'node-member',
    });
    expect(() => parseWorkspaceNodeCommand([])).toThrow('usage: workspace:nodes');
  });

  it('calls only the protected workspace node API and never places credentials in URLs or output', async () => {
    const requests: Request[] = [];
    const client = createWorkspaceNodeClient({
      origin: 'https://os.consuelohq.com/',
      accessToken: 'oauth-secret-token',
      fetchImpl: async (request) => {
        requests.push(request);
        return Response.json({
          workspaceId: 'workspace_cli',
          currentNodeId: 'node-home',
          defaultNodeId: 'node-home',
          nodeCount: 2,
          nodes: [],
        });
      },
    });

    const result = await client.execute({
      action: 'list',
      currentNodeId: 'node-home',
    });

    expect(result).toMatchObject({
      workspaceId: 'workspace_cli',
      currentNodeId: 'node-home',
      defaultNodeId: 'node-home',
      nodeCount: 2,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      'https://os.consuelohq.com/workspace/nodes?current_node_id=node-home',
    );
    expect(requests[0]?.headers.get('authorization')).toBe(
      'Bearer oauth-secret-token',
    );
    expect(requests[0]?.url).not.toContain('oauth-secret-token');
    expect(JSON.stringify(result)).not.toContain('oauth-secret-token');
  });

  it('maps administrative commands to their exact authenticated methods and bodies', async () => {
    const requests: Request[] = [];
    const client = createWorkspaceNodeClient({
      origin: 'https://os.consuelohq.com',
      accessToken: 'oauth-secret-token',
      fetchImpl: async (request) => {
        requests.push(request);
        return Response.json({ ok: true });
      },
    });

    await client.execute({ action: 'default', nodeId: 'node-member' });
    await client.execute({
      action: 'rename',
      nodeId: 'node-member',
      displayName: 'Travel Mac',
    });
    await client.execute({ action: 'revoke', nodeId: 'node-member' });

    expect(requests.map((request) => [request.method, request.url])).toEqual([
      ['POST', 'https://os.consuelohq.com/workspace/nodes/default'],
      ['PATCH', 'https://os.consuelohq.com/workspace/nodes/node-member'],
      ['POST', 'https://os.consuelohq.com/workspace/nodes/node-member/revoke'],
    ]);
    await expect(requests[0]?.json()).resolves.toEqual({ nodeId: 'node-member' });
    await expect(requests[1]?.json()).resolves.toEqual({
      displayName: 'Travel Mac',
    });
    expect(await requests[2]?.text()).toBe('');
  });

  it('fails closed with the server error code and without echoing the bearer token', async () => {
    const client = createWorkspaceNodeClient({
      origin: 'https://os.consuelohq.com',
      accessToken: 'oauth-secret-token',
      fetchImpl: async () =>
        Response.json(
          {
            error: {
              code: 'WORKSPACE_NODE_REVOKED',
              message: 'The node has been revoked.',
            },
          },
          { status: 403 },
        ),
    });

    await expect(
      client.execute({ action: 'revoke', nodeId: 'node-member' }),
    ).rejects.toThrow('WORKSPACE_NODE_REVOKED: The node has been revoked.');
    await expect(
      client.execute({ action: 'revoke', nodeId: 'node-member' }),
    ).rejects.not.toThrow('oauth-secret-token');
  });

  it('formats bounded node output without serializing arbitrary authority fields', () => {
    const nodes = Array.from({ length: 80 }, (_, index) => ({
      nodeId: `node-${index}`,
      displayName: `Node ${index} ${'x'.repeat(300)}`,
      role: index === 0 ? 'home' : 'member',
      platform: 'darwin',
      architecture: 'arm64',
      channel: 'stable',
      connectorId: `connector-${index}`,
      capabilities: Array.from({ length: 60 }, (__, capability) => `capability-${capability}`),
      agents: ['codex', 'claude', 'gemini', 'opencode', 'factory', 'cursor', 'pi', 'secret-agent'],
      createdAt: '2026-07-28T00:00:00.000Z',
      lastSeenAt: '2026-07-28T00:00:00.000Z',
      presence: 'online',
      state: 'active',
      publicKeyThumbprint: `thumbprint-${index}`,
      secret: `credential-${index}`,
    }));
    const formatted = formatWorkspaceNodeCommandResult(
      { action: 'list', currentNodeId: 'node-0' },
      {
        workspaceId: 'workspace_cli',
        workspaceHost: 'internal.consuelohq.com',
        currentNodeId: 'node-0',
        defaultNodeId: 'node-0',
        nodeCount: 80,
        presence: { online: 80, stale: 0, offline: 0 },
        nodes,
        secret: 'top-level-secret',
      },
    );
    const output = JSON.parse(formatted) as {
      nodes: Array<{ displayName: string; capabilities: string[]; agents: string[] }>;
      truncated: boolean;
    };

    expect(output.nodes).toHaveLength(50);
    expect(output.truncated).toBe(true);
    expect(output.nodes[0]?.displayName.length).toBeLessThanOrEqual(120);
    expect(output.nodes[0]?.capabilities).toHaveLength(8);
    expect(output.nodes[0]?.agents).toHaveLength(7);
    expect(formatted.length).toBeLessThan(30_000);
    expect(formatted).not.toContain('top-level-secret');
    expect(formatted).not.toContain('credential-');
    expect(formatted).not.toContain('secret-agent');
  });

  it('formats mutation responses through the same safe node projection', () => {
    const formatted = formatWorkspaceNodeCommandResult(
      { action: 'rename', nodeId: 'node-member', displayName: 'Travel Mac' },
      {
        node: {
          nodeId: 'node-member',
          displayName: 'Travel Mac',
          role: 'member',
          capabilities: ['mcp'],
          secret: 'credential-value',
        },
        secret: 'top-level-secret',
      },
    );

    expect(JSON.parse(formatted)).toEqual({
      node: {
        nodeId: 'node-member',
        displayName: 'Travel Mac',
        role: 'member',
        capabilities: ['mcp'],
        agents: [],
      },
    });
    expect(formatted).not.toContain('secret');
    expect(formatted).not.toContain('credential-value');
  });
});
