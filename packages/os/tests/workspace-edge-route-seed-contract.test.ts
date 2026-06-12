import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

const runContract =
  process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

type WorkspaceEdgeRouteSeedContract = {
  createWorkspaceEdgeRouteSeedRecord: (input?: {
    workspaceId?: string;
    workspaceSlug?: string;
    hostname?: string;
    baseDomain?: string;
    appUpstreamUrl?: string;
    connectorId?: string;
    tunnelOriginUrl?: string;
    localServiceUrl?: string;
  }) => unknown;
  createWorkspaceEdgeRouteSeedSql: (input?: {
    workspaceId?: string;
    workspaceSlug?: string;
    hostname?: string;
    baseDomain?: string;
    appUpstreamUrl?: string;
    connectorId?: string;
    tunnelOriginUrl?: string;
    localServiceUrl?: string;
  }) => string;
};

async function loadWorkspaceEdgeRouteSeedContract(): Promise<WorkspaceEdgeRouteSeedContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'workspace-edge-route-seed.ts'),
  ).href;
  const module = (await import(modulePath)) as Partial<WorkspaceEdgeRouteSeedContract>;
  const missingExports = [
    'createWorkspaceEdgeRouteSeedRecord',
    'createWorkspaceEdgeRouteSeedSql',
  ].filter((name) => typeof module[name as keyof WorkspaceEdgeRouteSeedContract] !== 'function');

  if (missingExports.length > 0) {
    throw new Error(
      `workspace edge route seed module is missing exports: ${missingExports.join(', ')}`,
    );
  }

  return module as WorkspaceEdgeRouteSeedContract;
}

contractDescribe('workspace edge route seed contract', () => {
  it('should default the migration host to internal.consuelohq.com and route app traffic to the Railway-backed app', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();
    const record = seed.createWorkspaceEdgeRouteSeedRecord();

    expect(record).toMatchObject({
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      hostname: 'internal.consuelohq.com',
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      routes: [
        {
          surface: 'app',
          pathPrefix: '/',
          auth: 'required',
          status: 'active',
          target: {
            kind: 'service-upstream',
            service: 'app',
            upstreamUrl: 'https://app.consuelohq.com',
          },
        },
      ],
    });
  });

  it('should emit D1-safe SQL without secrets and include connector rows only when OS route inputs are provided', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();
    const appOnlySql = seed.createWorkspaceEdgeRouteSeedSql();

    expect(appOnlySql).toMatch(/INSERT OR REPLACE INTO workspace_route_registry/i);
    expect(appOnlySql).toMatch(/internal\.consuelohq\.com/);
    expect(appOnlySql).not.toMatch(/workspace_connectors/i);
    expect(appOnlySql).not.toMatch(/token|credential|secret/i);

    const osSql = seed.createWorkspaceEdgeRouteSeedSql({
      connectorId: 'connector_internal',
      tunnelOriginUrl: 'https://connector-internal.os-origin.consuelohq.com',
      localServiceUrl: 'http://127.0.0.1:8787',
    });

    expect(osSql).toMatch(/INSERT OR REPLACE INTO workspace_connectors/i);
    expect(osSql).toMatch(/connector_internal/);
    expect(osSql).toMatch(/\/mcp/);
    expect(osSql).toMatch(/\/traces/);
    expect(osSql).not.toMatch(/token|credential|secret/i);
  });
});
