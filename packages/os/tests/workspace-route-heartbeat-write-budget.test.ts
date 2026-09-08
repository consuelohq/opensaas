import { describe, expect, it } from 'vitest';

import { reconcileWorkspaceRouteState } from '../cloudflare/os-device-authority/src/services/connectors';
import type { AccountWorkspace, WorkspaceNode } from '../cloudflare/os-device-authority/src/types';
import {
  migrateWorkspaceRouteD1,
  resolveWorkspaceRouteFromD1,
  type WorkspaceRouteD1Database,
  type WorkspaceRouteD1PreparedStatement,
} from '../scripts/lib/workspace-cloudflare-d1-route-registry';
import { openTraceDatabase } from '../scripts/lib/trace-database-schema';

const nowMs = Date.parse('2026-09-07T12:00:00Z');
const workspace: AccountWorkspace = {
  accountId: 'account_write_budget',
  workspaceId: 'workspace_write_budget',
  workspaceSlug: 'write-budget',
  workspaceHost: 'write-budget.consuelohq.com',
  homeNodeId: 'node_0',
  defaultNodeId: 'node_0',
  updatedAt: nowMs,
};

function createFixture() {
  const sqlite = openTraceDatabase(':memory:');
  const writes: Array<{ sql: string; changes: number; indexed: boolean }> = [];
  const db: WorkspaceRouteD1Database = {
    async exec(sql) { sqlite.exec(sql); },
    prepare(sql): WorkspaceRouteD1PreparedStatement {
      let bindings: unknown[] = [];
      return {
        bind(...values) { bindings = values; return this; },
        async first<T>() { return sqlite.query(sql).get(...bindings) as T | null; },
        async run() {
          const result = sqlite.query(sql).run(...bindings) as { changes?: number | bigint };
          const changes = Number(result.changes ?? 0);
          if (/^(INSERT|UPDATE)/i.test(sql) && changes > 0) {
            const instructions = sqlite.query('EXPLAIN ' + sql).all(...bindings) as Array<{ opcode: string }>;
            writes.push({
              sql,
              changes,
              indexed: instructions.some(({ opcode }) => opcode === 'IdxInsert' || opcode === 'IdxDelete'),
            });
          }
          return { success: true, meta: { changes: result.changes } };
        },
      };
    },
  };
  return { sqlite, db, writes };
}

function nodes(count: number): WorkspaceNode[] {
  return Array.from({ length: count }, (_, index) => ({
    ...workspace,
    nodeId: 'node_' + index,
    nodeName: 'Test node ' + index,
    displayName: 'Test node ' + index,
    role: index === 0 ? 'home' : 'member',
    platform: 'darwin',
    architecture: 'arm64',
    channel: 'canary',
    osVersion: '0.1.107',
    bundleId: 'test-bundle',
    mcpProtocolVersion: '2026-07-28',
    mcpReady: true,
    connectorId: 'connector_' + index,
    capabilities: ['mcp', 'tools'],
    connectorStatus: 'connected',
    state: 'active',
    devicePublicKeyJwk: '{}',
    devicePublicKeyThumbprint: 'test-thumbprint',
    createdAt: nowMs + index,
    updatedAt: nowMs,
    lastSeenAt: nowMs,
  }));
}

describe('workspace heartbeat D1 write budget', () => {
  it.each([1, 8, 32])('should write one unindexed row per changed heartbeat with %i registered nodes', async (count) => {
    const fixture = createFixture();
    try {
      await migrateWorkspaceRouteD1(fixture.db);
      const registered = nodes(count);
      const reconcile = (time: number) => reconcileWorkspaceRouteState({
        routeRegistry: fixture.db,
        workspace,
        nodes: registered,
        currentNodeId: 'node_0',
        nowMs: time,
      });
      await reconcile(nowMs);
      fixture.writes.length = 0;
      registered[0] = { ...registered[0], lastSeenAt: nowMs + 30_000 };
      expect((await reconcile(nowMs + 30_000)).routeReady).toBe(true);
      expect(fixture.writes.map(({ changes, indexed }) => ({ changes, indexed })))
        .toEqual([{ changes: 1, indexed: false }]);

      fixture.writes.length = 0;
      await reconcile(nowMs + 30_000);
      expect(fixture.writes).toEqual([]);

      await expect(resolveWorkspaceRouteFromD1(fixture.db, {
        host: workspace.workspaceHost, path: '/mcp', nowMs: nowMs + 90_001,
      })).resolves.toMatchObject({ allowed: false, errorCode: 'WORKSPACE_NODE_OFFLINE' });
    } finally { fixture.sqlite.close(); }
  });

  it('should persist connector changes and keep published site routes during reconciliation', async () => {
    const fixture = createFixture();
    try {
      await migrateWorkspaceRouteD1(fixture.db);
      const registered = nodes(2);
      const reconcile = () => reconcileWorkspaceRouteState({
        routeRegistry: fixture.db, workspace, nodes: registered,
        currentNodeId: 'node_0', nowMs,
      });
      await reconcile();
      const before = fixture.sqlite.query('SELECT record_json FROM workspace_route_registry').get() as { record_json: string };
      const record = JSON.parse(before.record_json);
      record.routes.push({
        surface: 'sites', pathPrefix: '/published', auth: 'public', status: 'active',
        target: { kind: 'site-snapshot', siteId: 'published', versionId: 'v1', manifestKey: 'published.json', cachePolicy: 'static-shell' },
      });
      fixture.sqlite.query('UPDATE workspace_route_registry SET record_json = ?').run(JSON.stringify(record));
      registered[0] = { ...registered[0], connectorStatus: 'disconnected' };
      expect((await reconcile()).routeReady).toBe(false);
      expect(fixture.sqlite.query('SELECT connector_status FROM workspace_connectors WHERE connector_id = ?').get('connector_0'))
        .toEqual({ connector_status: 'disconnected' });
      await expect(resolveWorkspaceRouteFromD1(fixture.db, {
        host: workspace.workspaceHost, path: '/published', nowMs,
      })).resolves.toMatchObject({ allowed: true, target: { siteId: 'published' } });
      registered[0] = { ...registered[0], connectorStatus: 'connected' };
      expect((await reconcile()).routeReady).toBe(true);
    } finally { fixture.sqlite.close(); }
  });
});
