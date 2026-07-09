import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

const runContract = process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

type EdgeCommand = {
  argv: string[];
  cwd?: string;
  stdout: string;
  stderr: string;
};

type PublishInput = {
  home: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  commandRunner?: (command: { argv: string[]; cwd?: string }) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  now?: string;
};

type InstallEdgeSitePublisherContract = {
  createWorkspaceEdgeSnapshotPlan: (input: {
    home: string;
    workspaceId: string;
    workspaceSlug: string;
    workspaceHost: string;
    now?: string;
  }) => {
    workspaceId: string;
    workspaceSlug: string;
    workspaceHost: string;
    siteId: string;
    versionId: string;
    snapshotKey: string;
    snapshotPath: string;
    contentHash: string;
    contentType: string;
    routeSql: string;
    verifyUrl: string;
    verifiedUrls: string[];
    snapshots: Array<{ siteId: string; snapshotKey: string; snapshotPath: string; verifyUrl: string; contentHash: string }>;
  };
  publishWorkspaceEdgeSnapshot: (input: PublishInput) => Promise<{
    status: 'succeeded';
    workspaceId: string;
    workspaceHost: string;
    siteId: string;
    versionId: string;
    snapshotKey: string;
    snapshotPath: string;
    verifyUrl: string;
    verifiedUrls: string[];
    snapshots: Array<{ siteId: string; snapshotKey: string; snapshotPath: string; verifyUrl: string; contentHash: string }>;
    logPath: string;
    httpStatus: number;
    cacheAuthority: string | null;
    sitesCache: string | null;
  }>;
};

async function loadPublisher(): Promise<InstallEdgeSitePublisherContract> {
  const href = pathToFileURL(path.join(process.cwd(), 'scripts', 'lib', 'install-edge-site-publisher.ts')).href;
  const module = (await import(href)) as Partial<InstallEdgeSitePublisherContract>;

  if (typeof module.createWorkspaceEdgeSnapshotPlan !== 'function') {
    throw new Error('install edge publisher is missing createWorkspaceEdgeSnapshotPlan');
  }
  if (typeof module.publishWorkspaceEdgeSnapshot !== 'function') {
    throw new Error('install edge publisher is missing publishWorkspaceEdgeSnapshot');
  }

  return module as InstallEdgeSitePublisherContract;
}

function makeHome(html = '<!doctype html><title>Internal workspace</title><main>Internal workspace ready</main>') {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-install-edge-publish-'));
  const sitePaths = [
    ['index.html'],
    ['office', 'index.html'],
    ['traces', 'index.html'],
    ['diffs', 'index.html'],
    ['docs', 'index.html'],
  ];
  for (const sitePath of sitePaths) {
    const filePath = path.join(home, 'sites', ...sitePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, html, 'utf8');
  }
  return home;
}

contractDescribe('install edge site publisher', () => {
  it('creates a deterministic immutable site-snapshot plan for the installed Sites index', async () => {
    const publisher = await loadPublisher();
    const home = makeHome();

    const first = publisher.createWorkspaceEdgeSnapshotPlan({
      home,
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      workspaceHost: 'internal.consuelohq.com',
      now: '2026-06-14T00:00:00.000Z',
    });
    const second = publisher.createWorkspaceEdgeSnapshotPlan({
      home,
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      workspaceHost: 'internal.consuelohq.com',
      now: '2026-06-15T00:00:00.000Z',
    });

    expect(first.versionId).toBe(second.versionId);
    expect(first.snapshotPath).toBe(path.join(home, 'sites', 'index.html'));
    expect(first.snapshotKey).toBe(`sites/workspace_internal/launcher/${first.versionId}/index.html`);
    expect(first.verifyUrl).toBe('https://internal.consuelohq.com/');
    expect(first.verifiedUrls).toEqual([
      'https://internal.consuelohq.com/',
      'https://internal.consuelohq.com/office',
      'https://internal.consuelohq.com/traces',
      'https://internal.consuelohq.com/diffs',
      'https://internal.consuelohq.com/docs',
    ]);
    expect(first.snapshots.map((snapshot) => snapshot.siteId)).toEqual(['launcher', 'office', 'traces', 'diffs', 'docs']);
    expect(first.routeSql).toMatch(/INSERT OR REPLACE INTO workspace_route_registry/i);
    expect(first.routeSql).toMatch(/site-snapshot/);
    expect(first.routeSql).toMatch(/internal\.consuelohq\.com/);
    expect(first.routeSql).toMatch(/r2:\/\/consuelo-sites-snapshots\/sites\/workspace_internal\/launcher\//);
    expect(first.routeSql).toContain('\"pathPrefix\":\"/office\"');
    expect(first.routeSql).toContain('\"pathPrefix\":\"/diffs\"');
    expect(first.routeSql).toContain('\"pathPrefix\":\"/docs\"');
    expect(first.routeSql).toMatch(/static-shell/);
  });

  it('uploads R2, upserts D1, warms the edge route, and returns install-safe metadata', async () => {
    const publisher = await loadPublisher();
    const home = makeHome();
    const commands: EdgeCommand[] = [];
    const expectedPlan = publisher.createWorkspaceEdgeSnapshotPlan({
      home,
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      workspaceHost: 'internal.consuelohq.com',
      now: '2026-06-14T00:00:00.000Z',
    });

    const result = await publisher.publishWorkspaceEdgeSnapshot({
      home,
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      workspaceHost: 'internal.consuelohq.com',
      commandRunner: async (command) => {
        commands.push({ ...command, stdout: 'ok', stderr: '' });
        return { exitCode: 0, stdout: 'ok', stderr: '' };
      },
      fetchImpl: async () => new Response('<!doctype html><title>Internal workspace</title><main>Internal workspace ready</main>', {
        status: 200,
        headers: {
          'x-consuelo-edge-cache-authority': 'sites-snapshot',
          'x-consuelo-sites-cache': 'miss',
          'x-consuelo-site-version': expectedPlan.versionId,
        },
      }),
      now: '2026-06-14T00:00:00.000Z',
    });

    expect(commands.map((command) => command.argv.slice(0, 4).join(' '))).toEqual([
      'wrangler r2 object put',
      'wrangler r2 object put',
      'wrangler r2 object put',
      'wrangler r2 object put',
      'wrangler r2 object put',
      'wrangler d1 execute consuelo-workspace-route-registry',
    ]);
    expect(commands.slice(0, 5).map((command) => command.argv[4])).toEqual(result.snapshots.map((snapshot) => `consuelo-sites-snapshots/${snapshot.snapshotKey}`));
    expect(commands[5].argv).toContain('--file');
    expect(result).toMatchObject({
      status: 'succeeded',
      workspaceId: 'workspace_internal',
      workspaceHost: 'internal.consuelohq.com',
      siteId: 'launcher',
      cacheAuthority: 'sites-snapshot',
      sitesCache: 'miss',
      httpStatus: 200,
      verifyUrl: 'https://internal.consuelohq.com/',
      verifiedUrls: [
        'https://internal.consuelohq.com/',
        'https://internal.consuelohq.com/office',
        'https://internal.consuelohq.com/traces',
        'https://internal.consuelohq.com/diffs',
        'https://internal.consuelohq.com/docs',
      ],
    });
    expect(fs.existsSync(result.logPath)).toBe(true);
    expect(fs.readFileSync(result.logPath, 'utf8')).not.toMatch(/token|secret|credential/i);
  });

  it('fails loudly with a stage log when edge verification does not prove the site-snapshot route', async () => {
    const publisher = await loadPublisher();
    const home = makeHome();

    await expect(publisher.publishWorkspaceEdgeSnapshot({
      home,
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      workspaceHost: 'internal.consuelohq.com',
      commandRunner: async () => ({ exitCode: 0, stdout: 'ok', stderr: '' }),
      fetchImpl: async () => new Response('wrong route', { status: 503 }),
      now: '2026-06-14T00:00:00.000Z',
    })).rejects.toMatchObject({
      code: 'INSTALL_EDGE_PUBLISH_FAILED',
      stage: 'edge_verify',
      workspaceHost: 'internal.consuelohq.com',
    });
  });

  it('should preserve stage diagnostics when edge verification request fails', async () => {
    const publisher = await loadPublisher();
    const home = makeHome();

    await expect(publisher.publishWorkspaceEdgeSnapshot({
      home,
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      workspaceHost: 'internal.consuelohq.com',
      commandRunner: async () => ({ exitCode: 0, stdout: 'ok', stderr: '' }),
      fetchImpl: async () => { throw new Error('network stalled'); },
      now: '2026-06-14T00:00:00.000Z',
    })).rejects.toMatchObject({
      code: 'INSTALL_EDGE_PUBLISH_FAILED',
      stage: 'edge_verify',
      workspaceHost: 'internal.consuelohq.com',
      diagnostics: { error: 'network stalled' },
    });
  });
});
