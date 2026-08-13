import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type WorkspaceEdgeRouteSeedInput = {
  workspaceId?: string;
  workspaceSlug?: string;
  hostname?: string;
  baseDomain?: string;
};

type WorkspaceEdgeRouteSeedContract = {
  createWorkspaceEdgeRouteSeedRecord: (
    input?: WorkspaceEdgeRouteSeedInput,
  ) => unknown;
  createWorkspaceEdgeRouteSeedSql: (
    input?: WorkspaceEdgeRouteSeedInput,
  ) => string;
};

async function loadWorkspaceEdgeRouteSeedContract(): Promise<WorkspaceEdgeRouteSeedContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'workspace-edge-route-seed.ts'),
  ).href;
  const module = (await import(modulePath)) as Partial<WorkspaceEdgeRouteSeedContract>;

  if (
    typeof module.createWorkspaceEdgeRouteSeedRecord !== 'function' ||
    typeof module.createWorkspaceEdgeRouteSeedSql !== 'function'
  ) {
    throw new Error('workspace edge route seed contract exports are missing');
  }

  return module as WorkspaceEdgeRouteSeedContract;
}

describe('workspace edge route seed identity', () => {
  it('fails closed when authoritative workspace identity is omitted or blank', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();

    expect(() => seed.createWorkspaceEdgeRouteSeedRecord()).toThrow(
      /workspace identity/i,
    );
    expect(() => seed.createWorkspaceEdgeRouteSeedSql()).toThrow(
      /workspace identity/i,
    );
    expect(() =>
      seed.createWorkspaceEdgeRouteSeedRecord({
        workspaceId: '   ',
        workspaceSlug: '   ',
        hostname: '   ',
        baseDomain: '   ',
      }),
    ).toThrow(/workspace identity/i);
  });

  it('accepts a fully explicit generic tenant without internal defaults', async () => {
    const seed = await loadWorkspaceEdgeRouteSeedContract();
    const record = seed.createWorkspaceEdgeRouteSeedRecord({
      workspaceId: 'workspace_acme',
      workspaceSlug: 'acme',
      hostname: 'acme.example.test',
      baseDomain: 'example.test',
    }) as {
      workspaceId: string;
      workspaceSlug: string;
      hostname: string;
      baseDomain: string;
    };

    expect(record).toMatchObject({
      workspaceId: 'workspace_acme',
      workspaceSlug: 'acme',
      hostname: 'acme.example.test',
      baseDomain: 'example.test',
    });
    expect(JSON.stringify(record)).not.toContain('workspace_internal');
    expect(JSON.stringify(record)).not.toContain('internal.consuelohq.com');
  });
});
