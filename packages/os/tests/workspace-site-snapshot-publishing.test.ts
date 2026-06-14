import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

const runContract = process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

async function loadRegistry() {
  const href = pathToFileURL(path.join(process.cwd(), 'scripts', 'lib', 'workspace-cloudflare-d1-route-registry.ts')).href;
  return await import(href) as {
    createInMemoryWorkspaceRouteD1: () => unknown;
    migrateWorkspaceRouteD1: (db: unknown) => Promise<void>;
    upsertWorkspaceHostnameInD1: (db: unknown, input: unknown) => Promise<void>;
    resolveWorkspaceRouteFromD1: (db: unknown, input: { host: string; path: string }) => Promise<unknown>;
  };
}

contractDescribe('workspace site snapshot publishing contract', () => {
  it('ships a D1 migration that allows site-snapshot route targets', () => {
    const migrationPath = path.join(process.cwd(), 'cloudflare', 'workspace-edge', 'migrations', '0002_site_snapshot_route_targets.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    expect(migration).toMatch(/site-snapshot/);
    expect(migration).toMatch(/ALTER\s+TABLE\s+workspace_route_registry\s+RENAME\s+TO/i);
    expect(migration).toMatch(/INSERT\s+INTO\s+workspace_route_registry/i);
  });

  it('stores and resolves public site-snapshot routes from the D1 registry', async () => {
    const registry = await loadRegistry();
    const db = registry.createInMemoryWorkspaceRouteD1();
    await registry.migrateWorkspaceRouteD1(db);
    await registry.upsertWorkspaceHostnameInD1(db, {
      workspaceId: 'workspace_kokayi',
      workspaceSlug: 'kokayi',
      hostname: 'kokayi.consuelohq.com',
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      routes: [{
        surface: 'sites',
        pathPrefix: '/',
        auth: 'public',
        status: 'active',
        target: {
          kind: 'site-snapshot',
          siteId: 'launcher',
          versionId: '2026-06-14-69e267c',
          manifestKey: 'sites/workspace_kokayi/launcher/2026-06-14-69e267c/index.html',
          contentType: 'text/html; charset=utf-8',
          cachePolicy: 'static-shell',
        },
      }],
    });
    await expect(registry.resolveWorkspaceRouteFromD1(db, { host: 'kokayi.consuelohq.com', path: '/' })).resolves.toMatchObject({
      allowed: true,
      workspaceId: 'workspace_kokayi',
      route: '/',
      surface: 'sites',
      auth: 'public',
      target: { kind: 'site-snapshot', manifestKey: 'sites/workspace_kokayi/launcher/2026-06-14-69e267c/index.html' },
    });
  });
});
