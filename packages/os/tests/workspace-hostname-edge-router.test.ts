import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type RouteTarget =
  | { kind: 'service-upstream'; service: 'dialer' | 'app' | 'sites' | 'twenty'; upstreamUrl: string }
  | { kind: 'os-connector'; connectorId: string; connectorStatus: 'connected' | 'disconnected'; tunnelOriginUrl: string }
  | { kind: 'site-snapshot'; siteId: string; versionId: string; manifestKey: string; htmlKey?: string; contentType?: string; cachePolicy: 'static-shell' | 'versioned-asset' | 'mutable-artifact' | 'private-preview' };

type Resolution =
  | { allowed: true; workspaceId: string; hostname: string; route: string; surface: 'os' | 'dialer' | 'app' | 'sites' | 'twenty'; auth: 'public' | 'required' | 'workspace-session' | 'signed-connector'; auditEvent: 'workspace.hostname.route.allowed'; target: RouteTarget }
  | { allowed: false; status: 404 | 503; errorCode: string; auditEvent: 'workspace.hostname.route.denied' };

type CacheLike = { match: (request: Request) => Promise<Response | null>; put: (request: Request, response: Response) => Promise<void> };
type R2Like = { get: (key: string) => Promise<{ text: () => Promise<string> } | null> };
type RouterContract = {
  createWorkspaceCloudflareEdgeRouter: (input: {
    registry: { resolve: (input: { host: string; path: string; method: string }) => Promise<Resolution> };
    siteSnapshots?: { cache?: CacheLike; r2?: R2Like };
    internalSigningSecret?: string;
    fetchUpstream?: (request: Request) => Promise<Response>;
    workspaceBaseDomains?: string[];
    reservedHostnames?: string[];
  }) => { fetch: (request: Request) => Promise<Response> };
};

const runContract = process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

async function loadContract(): Promise<RouterContract> {
  const href = pathToFileURL(join(process.cwd(), 'scripts', 'lib', 'workspace-cloudflare-edge-router.ts')).href;
  return (await import(href)) as RouterContract;
}

contractDescribe('workspace hostname edge routing contract', () => {
  it('protects reserved platform hosts before cache and D1 resolution', async () => {
    const { createWorkspaceCloudflareEdgeRouter } = await loadContract();
    let resolveCount = 0;
    let cacheMatchCount = 0;
    const router = createWorkspaceCloudflareEdgeRouter({
      registry: {
        async resolve() {
          resolveCount += 1;
          return { allowed: false, status: 404, errorCode: 'UNEXPECTED_D1_LOOKUP', auditEvent: 'workspace.hostname.route.denied' };
        },
      },
      siteSnapshots: { cache: { async match() { cacheMatchCount += 1; return null; }, async put() {} } },
    });
    for (const host of ['app.consuelohq.com', 'docs.consuelohq.com', 'diffs.consuelohq.com', 'install.consuelohq.com']) {
      const response = await router.fetch(new Request('https://' + host + '/'));
      const body = (await response.json()) as { error: { code: string; message: string; request_id: string; help_url: string } };
      expect(response.status).toBe(404);
      expect(body.error.code).toBe('WORKSPACE_HOSTNAME_RESERVED');
      expect(body.error.message).toBe('This workspace is protected by Consuelo platform safety.');
      expect(body.error.request_id).toBeTruthy();
      expect(body.error.help_url).toBe('https://os.consuelohq.com/help/workspace-access');
    }
    expect(resolveCount).toBe(0);
    expect(cacheMatchCount).toBe(0);
  });

  it('should render a Cloudflare-style platform safety page when the request prefers HTML', async () => {
    const { createWorkspaceCloudflareEdgeRouter } = await loadContract();
    const router = createWorkspaceCloudflareEdgeRouter({
      registry: {
        async resolve() {
          return { allowed: false, status: 404, errorCode: 'UNEXPECTED_D1_LOOKUP', auditEvent: 'workspace.hostname.route.denied' };
        },
      },
    });

    const response = await router.fetch(new Request('https://diffs.consuelohq.com/', {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'cf-ray': 'test-ray-IAD',
        'cf-connecting-ip': 'redacted-test-ip',
      },
    }));
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('This workspace is protected');
    expect(body).toContain('Consuelo platform safety');
    expect(body).toContain('WORKSPACE_HOSTNAME_RESERVED');
    expect(body).toContain('test-ray-IAD');
    expect(body).toContain('diffs.consuelohq.com');
    expect(body).toContain('Click to reveal IP');
    expect(body).not.toContain('UNEXPECTED_D1_LOOKUP');
  });
  it('serves public workspace root snapshots for personal and business hostnames', async () => {
    const { createWorkspaceCloudflareEdgeRouter } = await loadContract();
    const cachePuts: Array<{ url: string; body: string }> = [];
    const r2Reads: string[] = [];
    const router = createWorkspaceCloudflareEdgeRouter({
      registry: {
        async resolve({ host }) {
          const workspaceId = host.startsWith('openai.') ? 'workspace_openai' : 'workspace_kokayi';
          const siteId = host.startsWith('openai.') ? 'openai-home' : 'kokayi-home';
          return {
            allowed: true,
            workspaceId,
            hostname: host,
            route: '/',
            surface: 'sites',
            auth: 'public',
            auditEvent: 'workspace.hostname.route.allowed',
            target: {
              kind: 'site-snapshot',
              siteId,
              versionId: 'version_1',
              manifestKey: 'sites/' + workspaceId + '/' + siteId + '/version_1/index.html',
              cachePolicy: 'static-shell',
            },
          };
        },
      },
      siteSnapshots: {
        cache: { async match() { return null; }, async put(request, response) { cachePuts.push({ url: request.url, body: await response.clone().text() }); } },
        r2: { async get(key) { r2Reads.push(key); return { text: async () => '<!doctype html><title>' + key + '</title>' }; } },
      },
    });

    const personal = await router.fetch(new Request('https://kokayi.consuelohq.com/?utm=noise'));
    const business = await router.fetch(new Request('https://openai.consuelohq.com/'));

    expect(personal.status).toBe(200);
    expect(await personal.text()).toContain('sites/workspace_kokayi/kokayi-home/version_1/index.html');
    expect(business.status).toBe(200);
    expect(await business.text()).toContain('sites/workspace_openai/openai-home/version_1/index.html');
    expect(cachePuts.map((entry) => entry.url)).toEqual([]);
    expect(r2Reads).toEqual(['sites/workspace_kokayi/kokayi-home/version_1/index.html', 'sites/workspace_openai/openai-home/version_1/index.html']);
  });

  it('does not use public snapshot cache or R2 for private workspace routes', async () => {
    const { createWorkspaceCloudflareEdgeRouter } = await loadContract();
    let cacheMatchCount = 0;
    let cachePutCount = 0;
    let r2ReadCount = 0;
    const router = createWorkspaceCloudflareEdgeRouter({
      registry: {
        async resolve() {
          return {
            allowed: true,
            workspaceId: 'workspace_kokayi',
            hostname: 'kokayi.consuelohq.com',
            route: '/private',
            surface: 'sites',
            auth: 'workspace-session',
            auditEvent: 'workspace.hostname.route.allowed',
            target: { kind: 'site-snapshot', siteId: 'private-page', versionId: 'version_private', manifestKey: 'sites/workspace_kokayi/private-page/version_private/index.html', cachePolicy: 'private-preview' },
          };
        },
      },
      siteSnapshots: {
        cache: { async match() { cacheMatchCount += 1; return null; }, async put() { cachePutCount += 1; } },
        r2: { async get() { r2ReadCount += 1; return { text: async () => '<!doctype html><title>private</title>' }; } },
      },
    });

    const response = await router.fetch(new Request('https://kokayi.consuelohq.com/private'));
    const body = (await response.json()) as { error: { code: string } };
    expect(response.status).toBe(503);
    expect(body.error.code).toBe('WORKSPACE_EDGE_AUTH_REQUIRED');
    expect(cacheMatchCount).toBe(0);
    expect(cachePutCount).toBe(0);
    expect(r2ReadCount).toBe(0);
  });
});
