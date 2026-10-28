import { describe, expect, it } from 'vitest';

import {
  migrateWorkspaceRouteD1,
  type WorkspaceRouteD1Database,
  type WorkspaceRouteD1PreparedStatement,
} from '../scripts/lib/workspace-cloudflare-d1-route-registry';

describe('workspace route D1 migration recovery', () => {
  it('rebuilds a legacy record-json table into the current route schema', async () => {
    const executed: string[] = [];
    const prepared: string[] = [];
    const database: WorkspaceRouteD1Database = {
      async exec(sql: string) {
        executed.push(sql);
      },
      prepare(sql: string): WorkspaceRouteD1PreparedStatement {
        prepared.push(sql);
        return {
          bind() {
            return this;
          },
          async first<T = unknown>() {
            if (sql.includes('sqlite_master')) {
              return {
                sql: 'CREATE TABLE workspace_route_registry (hostname TEXT PRIMARY KEY, record_json TEXT NOT NULL)',
              } as T;
            }
            return null;
          },
          async run() {
            return { success: true };
          },
        };
      },
    };

    await migrateWorkspaceRouteD1(database);

    expect(executed).toHaveLength(1);
    expect(executed[0]).toContain(
      "json_extract(record_json, '$.workspaceId')",
    );
    expect(executed[0]).toContain('consuelo-gateway-service');
    expect(executed[0]).toContain('redirect');
    expect(executed[0]).toContain(
      'ALTER TABLE workspace_route_registry_next RENAME TO workspace_route_registry',
    );
    expect(prepared).toContainEqual(
      expect.stringContaining(
        'idx_workspace_route_registry_workspace_connector',
      ),
    );
  });
});
