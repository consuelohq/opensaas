import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  readWorkspaceNodeSummaryCache,
  writeWorkspaceNodeSummaryCache,
} from '../scripts/lib/workspace-node-summary';

const homes: string[] = [];

function makeHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'consuelo-node-summary-'));
  homes.push(home);
  return home;
}

function safePayload(): Record<string, unknown> {
  const currentNode = {
    workspaceId: 'workspace-safe',
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
    lastSeenAt: '2026-07-21T16:00:00.000Z',
    presence: 'offline',
    publicKeyThumbprint: 'thumb-travel',
  };
  return {
    workspaceId: 'workspace-safe',
    workspaceHost: 'safe.consuelohq.com',
    currentNodeId: 'node-home',
    currentNode,
    defaultNodeId: 'node-home',
    nodeCount: 2,
    presence: { online: 1, stale: 0, offline: 1 },
    nodes: [currentNode, offlineNode],
  };
}

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

describe('shared authenticated workspace node summary contract', () => {
  it('writes and reads one strict cache shape while retaining offline nodes', () => {
    const home = makeHome();
    const written = writeWorkspaceNodeSummaryCache({
      home,
      summary: safePayload(),
      cachedAt: '2026-07-24T16:05:00.000Z',
    });
    const read = readWorkspaceNodeSummaryCache(home, 'workspace-safe');

    expect(read).toEqual(written);
    expect(read?.summary.nodes).toHaveLength(2);
    expect(read?.summary.nodes[1]).toMatchObject({
      nodeId: 'node-travel',
      presence: 'offline',
    });
    expect(readFileSync(written.path, 'utf8')).not.toContain('authorization');
  });

  it('rejects fields outside Worker 25 safe metadata instead of caching them', () => {
    const home = makeHome();
    const unsafe = {
      ...safePayload(),
      accessToken: 'must-not-be-cached',
    };

    expect(() => writeWorkspaceNodeSummaryCache({
      home,
      summary: unsafe,
      cachedAt: '2026-07-24T16:05:00.000Z',
    })).toThrow('invalid workspace node summary');
  });

  it('rejects workspace identifiers that could escape the node cache directory', () => {
    const home = makeHome();
    const unsafe = {
      ...safePayload(),
      workspaceId: '../outside',
      nodes: (safePayload().nodes as Array<Record<string, unknown>>).map((node) => ({
        ...node,
        workspaceId: '../outside',
      })),
    };

    expect(() => writeWorkspaceNodeSummaryCache({
      home,
      summary: unsafe,
      cachedAt: '2026-07-24T16:05:00.000Z',
    })).toThrow('invalid workspace node summary');
  });
});
