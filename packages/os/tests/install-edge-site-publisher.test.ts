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
    ['traces', 'index.html'],
    ['docs', 'index.html'],
    ['configuration', 'index.html'],
    ['tools', 'index.html'],
    ['nodes', 'index.html'],
    ['environments', 'index.html'],
    ['secrets', 'index.html'],
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
      'https://internal.consuelohq.com/observability',
      'https://internal.consuelohq.com/observability/traces',
      'https://internal.consuelohq.com/traces',
      'https://internal.consuelohq.com/tracing',
      'https://internal.consuelohq.com/trace-burn-intelligence',
      'https://internal.consuelohq.com/docs',
      'https://internal.consuelohq.com/configuration',
      'https://internal.consuelohq.com/tools',
      'https://internal.consuelohq.com/nodes',
      'https://internal.consuelohq.com/environments',
      'https://internal.consuelohq.com/secrets',
    ]);
    expect(first.snapshots.map((snapshot) => snapshot.siteId)).toEqual(['launcher', 'traces', 'traces', 'traces', 'traces', 'traces', 'docs', 'configuration', 'tools', 'nodes', 'environments', 'secrets']);
    expect(first.snapshots.some((snapshot) => snapshot.siteId === 'artifacts')).toBe(false);
    expect(first.routeSql).toContain('\"pathPrefix\":\"/artifacts\"');
    expect(first.routeSql).toContain('\"serviceName\":\"artifacts-sites-read-layer\"');
    expect(new Set(first.snapshots.map((snapshot) => snapshot.versionId))).toEqual(
      new Set([first.versionId]),
    );
    expect(first.routeSql).toMatch(/INSERT INTO workspace_route_registry/i);
    expect(first.routeSql).toMatch(/ON CONFLICT\(hostname\) DO UPDATE/i);
    expect(first.routeSql).not.toMatch(/INSERT OR REPLACE INTO workspace_route_registry/i);
    expect(first.routeSql).toContain("'$.target.kind') = 'os-connector'");
    expect(first.routeSql).toContain("'$.nodeTargets'");
    expect(first.routeSql).toMatch(/site-snapshot/);
    expect(first.routeSql).toMatch(/internal\.consuelohq\.com/);
    expect(first.routeSql).toMatch(/r2:\/\/consuelo-sites-snapshots\/sites\/workspace_internal\/launcher\//);
    expect(first.routeSql).toContain('\"pathPrefix\":\"/office\"');
    expect(first.routeSql).toContain('\"pathPrefix\":\"/diffs\"');
    expect(first.snapshots.some((snapshot) => snapshot.siteId === 'diffs')).toBe(false);
    expect(first.routeSql).toContain('\"pathPrefix\":\"/docs\"');
    expect(first.routeSql).toContain('\"pathPrefix\":\"/configuration\"');
    expect(first.routeSql).toContain('\"pathPrefix\":\"/tools\"');
    expect(first.routeSql).toContain('\"pathPrefix\":\"/nodes\"');
    expect(first.routeSql).toContain('\"pathPrefix\":\"/environments\"');
    expect(first.routeSql).toContain('\"pathPrefix\":\"/secrets\"');
    expect(first.routeSql).toContain('\"location\":\"/configuration\"');
    expect(first.routeSql).toMatch(/static-shell/);
    for (const snapshot of first.snapshots) {
      expect(first.routeSql).toContain(snapshot.contentHash);
    }
  });

  it('uploads R2, upserts D1, warms the edge route, and returns install-safe metadata', async () => {
    const publisher = await loadPublisher();
    const home = makeHome();
    const commands: EdgeCommand[] = [];
    const verificationRequests: Array<{
      url: string;
      accept: string | null;
    }> = [];
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
      fetchImpl: async (url, init) => {
        const headers = new Headers(init?.headers);
        verificationRequests.push({
          url,
          accept: headers.get('accept'),
        });
        const snapshot = expectedPlan.snapshots.find(
          (candidate) => candidate.verifyUrl === url,
        );
        if (!snapshot) throw new Error(`unexpected verification URL: ${url}`);
        if (
          ['launcher', 'traces', 'configuration', 'tools', 'nodes', 'environments', 'secrets'].includes(
            snapshot.siteId,
          )
        ) {
          return Response.json(
            { error: 'workspace_session_required' },
            {
              status: 401,
              headers: { 'cache-control': 'no-store' },
            },
          );
        }
        const sourceHtml = fs.readFileSync(snapshot.snapshotPath, 'utf8');
        return new Response(`${sourceHtml}\n<script>downstream edge transform</script>`, {
          status: 200,
          headers: {
            'x-consuelo-edge-cache-authority': 'sites-snapshot',
            'x-consuelo-sites-cache': 'miss',
            'x-consuelo-site-content-hash': snapshot.contentHash,
            'x-consuelo-site-version': expectedPlan.versionId,
          },
        });
      },
      now: '2026-06-14T00:00:00.000Z',
    });

    const uniqueSnapshotKeys = [...new Set(result.snapshots.map((snapshot) => snapshot.snapshotKey))];
    expect(commands.map((command) => command.argv.slice(0, 4).join(' '))).toEqual([
      ...uniqueSnapshotKeys.map(() => 'wrangler r2 object put'),
      'wrangler d1 execute consuelo-workspace-route-registry',
    ]);
    expect(commands.slice(0, uniqueSnapshotKeys.length).map((command) => command.argv[4])).toEqual(uniqueSnapshotKeys.map((snapshotKey) => `consuelo-sites-snapshots/${snapshotKey}`));
    expect(commands[uniqueSnapshotKeys.length].argv).toContain('--file');
    expect(verificationRequests[0]).toEqual({
      url: 'https://internal.consuelohq.com/',
      accept: 'application/json',
    });
    expect(verificationRequests.slice(1).every(
      (request) => request.accept === 'application/json',
    )).toBe(true);
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
        'https://internal.consuelohq.com/observability',
        'https://internal.consuelohq.com/observability/traces',
        'https://internal.consuelohq.com/traces',
        'https://internal.consuelohq.com/tracing',
        'https://internal.consuelohq.com/trace-burn-intelligence',
          'https://internal.consuelohq.com/docs',
        'https://internal.consuelohq.com/configuration',
        'https://internal.consuelohq.com/tools',
        'https://internal.consuelohq.com/nodes',
        'https://internal.consuelohq.com/environments',
        'https://internal.consuelohq.com/secrets',
      ],
    });
    expect(fs.existsSync(result.logPath)).toBe(true);
    expect(fs.readFileSync(result.logPath, 'utf8')).not.toMatch(/token|secret|credential/i);
  });

  it('fails closed when the private launcher is publicly readable without a workspace session', async () => {
    const publisher = await loadPublisher();
    const home = makeHome();
    const expectedPlan = publisher.createWorkspaceEdgeSnapshotPlan({
      home,
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      workspaceHost: 'internal.consuelohq.com',
      now: '2026-06-14T00:00:00.000Z',
    });

    await expect(publisher.publishWorkspaceEdgeSnapshot({
      home,
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      workspaceHost: 'internal.consuelohq.com',
      commandRunner: async () => ({ exitCode: 0, stdout: 'ok', stderr: '' }),
      fetchImpl: async (url) => {
        const snapshot = expectedPlan.snapshots.find(
          (candidate) => candidate.verifyUrl === url,
        );
        if (!snapshot) throw new Error(`unexpected verification URL: ${url}`);
        return new Response(fs.readFileSync(snapshot.snapshotPath, 'utf8'), {
          status: 200,
          headers: {
            'x-consuelo-edge-cache-authority': 'sites-snapshot',
            'x-consuelo-sites-cache': 'miss',
            'x-consuelo-site-version': expectedPlan.versionId,
          },
        });
      },
      now: '2026-06-14T00:00:00.000Z',
    })).rejects.toMatchObject({
      code: 'INSTALL_EDGE_PUBLISH_FAILED',
      stage: 'edge_verify',
      workspaceHost: 'internal.consuelohq.com',
    });
  });

  it('rejects launcher authorization responses that do not match the exact public contract', async () => {
    const publisher = await loadPublisher();
    const home = makeHome();

    await expect(publisher.publishWorkspaceEdgeSnapshot({
      home,
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      workspaceHost: 'internal.consuelohq.com',
      commandRunner: async () => ({ exitCode: 0, stdout: 'ok', stderr: '' }),
      fetchImpl: async (url) => {
        if (url.endsWith('/')) {
          return Response.json(
            { error: 'workspace_session_required', redirect: '/login' },
            { status: 401 },
          );
        }
        return new Response('unreachable', { status: 500 });
      },
      now: '2026-06-14T00:00:00.000Z',
    })).rejects.toMatchObject({
      code: 'INSTALL_EDGE_PUBLISH_FAILED',
      stage: 'edge_verify',
      workspaceHost: 'internal.consuelohq.com',
    });
  });

  it('fails when a public snapshot source hash does not match the uploaded bytes', async () => {
    const publisher = await loadPublisher();
    const home = makeHome();
    const expectedPlan = publisher.createWorkspaceEdgeSnapshotPlan({
      home,
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      workspaceHost: 'internal.consuelohq.com',
      now: '2026-06-14T00:00:00.000Z',
    });

    await expect(publisher.publishWorkspaceEdgeSnapshot({
      home,
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      workspaceHost: 'internal.consuelohq.com',
      commandRunner: async () => ({ exitCode: 0, stdout: 'ok', stderr: '' }),
      fetchImpl: async (url) => {
        if (url === expectedPlan.verifyUrl) {
          return Response.json({ error: 'workspace_session_required' }, { status: 401 });
        }
        const snapshot = expectedPlan.snapshots.find(
          (candidate) => candidate.verifyUrl === url,
        );
        if (!snapshot) throw new Error(`unexpected verification URL: ${url}`);
        return new Response(fs.readFileSync(snapshot.snapshotPath, 'utf8'), {
          status: 200,
          headers: {
            'x-consuelo-edge-cache-authority': 'sites-snapshot',
            'x-consuelo-sites-cache': 'miss',
            'x-consuelo-site-content-hash': 'incorrect-source-hash',
            'x-consuelo-site-version': expectedPlan.versionId,
          },
        });
      },
      now: '2026-06-14T00:00:00.000Z',
    })).rejects.toMatchObject({
      code: 'INSTALL_EDGE_PUBLISH_FAILED',
      stage: 'edge_verify',
      workspaceHost: 'internal.consuelohq.com',
    });
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
