import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  createWorkspaceNodeClient,
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
    const home = mkdtempSync(join(tmpdir(), 'consuelo-workspace-node-client-'));
    const currentNode = {
      workspaceId: 'workspace_cli',
      nodeId: 'node-home',
      displayName: 'Home Mac',
      role: 'home',
      platform: 'darwin',
      architecture: 'arm64',
      channel: 'stable',
      connectorId: 'connector-home',
      capabilities: ['local-runtime'],
      createdAt: '2026-07-20T00:00:00.000Z',
      lastSeenAt: '2026-07-24T16:00:00.000Z',
      presence: 'online',
      state: 'active',
      publicKeyThumbprint: 'thumb-home',
    };
    const offlineNode = {
      ...currentNode,
      nodeId: 'node-travel',
      displayName: 'Travel Mac',
      role: 'member',
      connectorId: null,
      presence: 'offline',
      publicKeyThumbprint: 'thumb-travel',
    };
    const client = createWorkspaceNodeClient({
      origin: 'https://os.consuelohq.com/',
      accessToken: 'oauth-secret-token',
      home,
      fetchImpl: async (request) => {
        requests.push(request);
        return Response.json({
          workspaceId: 'workspace_cli',
          workspaceHost: 'cli.consuelohq.com',
          currentNodeId: 'node-home',
          currentNode,
          defaultNodeId: 'node-home',
          nodeCount: 2,
          presence: { online: 1, stale: 0, offline: 1 },
          nodes: [currentNode, offlineNode],
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
    expect(existsSync(join(
      home,
      'node',
      'workspaces',
      'workspace_cli',
      'state',
      'workspace-nodes.json',
    ))).toBe(true);
    rmSync(home, { recursive: true, force: true });
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
});
