import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { publishArtifact } from '../scripts/lib/artifacts';
import {
  createGatewaySecurityConfig,
  issueAgentAppToken,
  signMachineRequest,
  type AgentAppToken,
  type GatewaySecurityConfig,
} from '../scripts/lib/security-gateway';
import { createArtifactRoutes } from '../scripts/server/routes/artifacts';

let home = '';
let config: GatewaySecurityConfig;
let token: AgentAppToken;
let nowMs = Date.parse('2026-09-21T04:00:00.000Z');

function signedRequest(path: string, method: 'GET' | 'POST' | 'DELETE', nonce: string, body = ''): Request {
  const signed = signMachineRequest({
    config,
    token,
    method,
    path,
    body,
    timestamp: new Date().toISOString(),
    nonce,
  });
  return new Request(`http://127.0.0.1:46321${path}`, {
    method,
    headers: {
      ...signed.headers,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body || undefined,
  });
}

function cookieValue(setCookie: string): string {
  return setCookie.split(';', 1)[0] ?? '';
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'consuelo-artifact-share-'));
  writeFileSync(
    join(home, 'artifact.html'),
    '<!doctype html><html><body><h1>Shared with Mom</h1><a href="https://example.com">outside</a></body></html>',
  );
  publishArtifact({
    home,
    target: join(home, 'artifact.html'),
    path: '/guides/shared-with-mom',
    title: 'Shared with Mom',
    category: 'guides',
    template: 'guide',
    now: '2026-09-21T03:59:00.000Z',
  });
  config = createGatewaySecurityConfig({
    home,
    workspaceId: 'workspace_artifact_share',
    workspaceSlug: 'artifact-share',
    workspaceHost: 'artifact-share.consuelohq.com',
  });
  token = issueAgentAppToken({
    config,
    callerId: 'caller_artifact_share',
    appId: 'app_artifact_share',
    subjectId: 'subject_artifact_share',
    deviceId: 'device_artifact_share',
    connectorId: 'connector_artifact_share',
    connectionId: 'connection_artifact_share',
    scopes: ['route:/gateway/artifacts:read', 'route:/gateway/artifacts:write'],
    expiresInSeconds: 300,
  });
  process.env.CONSUELO_HOME = home;
  process.env.CONSUELO_OS_HOME = home;
  process.env.CONSUELO_OS_AUTH_CONFIG = config.generatedAuthPath;
  nowMs = Date.parse('2026-09-21T04:00:00.000Z');
});

afterEach(() => {
  delete process.env.CONSUELO_HOME;
  delete process.env.CONSUELO_OS_HOME;
  delete process.env.CONSUELO_OS_AUTH_CONFIG;
  if (home) rmSync(home, { recursive: true, force: true });
  home = '';
});

describe('artifact private share links', () => {
  it('creates a private link whose secret stays in the URL fragment and can be claimed without sign-in', async () => {
    const app = createArtifactRoutes({ now: () => nowMs });
    const catalog = await app.fetch(signedRequest('/gateway/artifacts', 'GET', 'share-catalog'));
    const artifactId = ((await catalog.json()) as { artifacts: Array<{ id: string }> }).artifacts[0]!.id;

    const createPath = `/gateway/artifacts/${artifactId}/shares`;
    const created = await app.fetch(signedRequest(
      createPath,
      'POST',
      'share-create',
      JSON.stringify({ expiresInSeconds: 7 * 24 * 60 * 60 }),
    ));

    expect(created.status).toBe(201);
    const createdBody = await created.json() as {
      share: { id: string; artifactId: string; expiresAt: string; url: string };
    };
    expect(createdBody.share.artifactId).toBe(artifactId);
    expect(createdBody.share.url).toMatch(/^https:\/\/artifact-share\.consuelohq\.com\/share\/artifacts\/share-[A-Za-z0-9_-]+#[A-Za-z0-9_-]{32,}$/);
    expect(createdBody.share.url).not.toContain('?token=');

    const createdUrl = new URL(createdBody.share.url);
    const publicPath = createdUrl.pathname;
    const secret = createdUrl.hash.slice(1);
    expect(publicPath).toBeTruthy();
    expect(secret).toBeTruthy();
    const persistedShares = readFileSync(join(home, 'artifacts', 'shares.json'), 'utf8');
    expect(persistedShares).not.toContain(secret);

    const landing = await app.fetch(new Request(`http://127.0.0.1:46321${publicPath}`, {
      headers: { accept: 'text/html' },
    }));
    expect(landing.status).toBe(200);
    expect(landing.headers.get('cache-control')).toContain('no-store');
    expect(landing.headers.get('x-robots-tag')).toContain('noindex');
    expect(landing.headers.get('referrer-policy')).toBe('no-referrer');
    await expect(landing.text()).resolves.toContain('Opening private artifact');

    const claim = await app.fetch(new Request(
      `http://127.0.0.1:46321${publicPath}/claim`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret }),
      },
    ));
    expect(claim.status).toBe(200);
    const setCookie = claim.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).not.toContain(secret);

    const viewer = await app.fetch(new Request(`http://127.0.0.1:46321${publicPath}`, {
      headers: { cookie: cookieValue(setCookie) },
    }));
    expect(viewer.status).toBe(200);
    expect(viewer.headers.get('referrer-policy')).toBe('no-referrer');
    await expect(viewer.text()).resolves.toContain('Shared with Mom');
  });

  it('keeps pre-upgrade loopback Artifacts pages compatible while enforcing same-origin sharing', async () => {
    const app = createArtifactRoutes({ now: () => nowMs });
    const page = await app.fetch(new Request('http://127.0.0.1:46321/artifacts', {
      headers: { accept: 'text/html' },
    }));
    expect(page.status).toBe(200);
    const html = await page.text();
    const localCsrf = html.match(/name="consuelo-local-artifact-share-csrf" content="([^"]+)"/)?.[1] ?? '';
    expect(localCsrf).toMatch(/^[A-Za-z0-9_-]{32,}$/);

    const remotePage = await app.fetch(new Request('https://artifact-share.consuelohq.com/artifacts', {
      headers: { accept: 'text/html' },
    }));
    expect(remotePage.status).toBe(200);
    const remoteHtml = await remotePage.text();
    expect(remoteHtml).not.toContain(localCsrf);
    expect(remoteHtml).not.toContain('__CONSUELO_LOCAL_ARTIFACT_SHARE_CSRF__');

    const catalog = await app.fetch(signedRequest('/gateway/artifacts', 'GET', 'local-share-catalog'));
    const artifactId = ((await catalog.json()) as { artifacts: Array<{ id: string }> }).artifacts[0]!.id;
    const createPath = `/gateway/artifacts/${artifactId}/shares`;

    const legacyCreated = await app.fetch(new Request(`http://127.0.0.1:46321${createPath}`, {
      method: 'POST',
      headers: {
        origin: 'http://127.0.0.1:46321',
        'content-type': 'application/json',
      },
      body: '{}',
    }));
    expect(legacyCreated.status).toBe(201);
    const legacyBody = await legacyCreated.json() as { share: { url: string } };
    expect(legacyBody.share.url).toMatch(/^https:\/\/artifact-share\.consuelohq\.com\/share\/artifacts\//);

    const wrongOrigin = await app.fetch(new Request(`http://127.0.0.1:46321${createPath}`, {
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
        'content-type': 'application/json',
        'x-consuelo-artifact-share-csrf': localCsrf,
      },
      body: '{}',
    }));
    expect(wrongOrigin.status).toBe(403);

    const wrongCsrf = await app.fetch(new Request(`http://127.0.0.1:46321${createPath}`, {
      method: 'POST',
      headers: {
        origin: 'http://127.0.0.1:46321',
        'content-type': 'application/json',
        'x-consuelo-artifact-share-csrf': 'definitely-not-the-current-capability',
      },
      body: '{}',
    }));
    expect(wrongCsrf.status).toBe(403);

    const created = await app.fetch(new Request(`http://127.0.0.1:46321${createPath}`, {
      method: 'POST',
      headers: {
        origin: 'http://127.0.0.1:46321',
        'content-type': 'application/json',
        'x-consuelo-artifact-share-csrf': localCsrf,
      },
      body: '{}',
    }));
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { share: { id: string; url: string } };
    expect(createdBody.share.url).toMatch(/^https:\/\/artifact-share\.consuelohq\.com\/share\/artifacts\//);

    const revoked = await app.fetch(new Request(
      `http://127.0.0.1:46321${createPath}/${createdBody.share.id}`,
      {
        method: 'DELETE',
        headers: {
          origin: 'http://127.0.0.1:46321',
          'x-consuelo-artifact-share-csrf': localCsrf,
        },
      },
    ));
    expect(revoked.status).toBe(200);
  });

  it('lists shares without secrets, revokes them immediately, and expires them', async () => {
    const app = createArtifactRoutes({ now: () => nowMs });
    const catalog = await app.fetch(signedRequest('/gateway/artifacts', 'GET', 'share-catalog-2'));
    const artifactId = ((await catalog.json()) as { artifacts: Array<{ id: string }> }).artifacts[0]!.id;
    const createPath = `/gateway/artifacts/${artifactId}/shares`;

    const created = await app.fetch(signedRequest(
      createPath,
      'POST',
      'share-create-2',
      JSON.stringify({ expiresInSeconds: 60 }),
    ));
    const createdBody = await created.json() as { share: { id: string; url: string } };
    const createdUrl = new URL(createdBody.share.url);
    const publicPath = createdUrl.pathname;
    const secret = createdUrl.hash.slice(1);

    const listed = await app.fetch(signedRequest(createPath, 'GET', 'share-list'));
    expect(listed.status).toBe(200);
    const listedText = await listed.text();
    expect(listedText).toContain(createdBody.share.id);
    expect(listedText).not.toContain(secret);

    const claim = await app.fetch(new Request(`http://127.0.0.1:46321${publicPath}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret }),
    }));
    const cookie = cookieValue(claim.headers.get('set-cookie') ?? '');

    const revokePath = `${createPath}/${createdBody.share.id}`;
    const revoked = await app.fetch(signedRequest(revokePath, 'DELETE', 'share-revoke'));
    expect(revoked.status).toBe(200);

    const afterRevoke = await app.fetch(new Request(`http://127.0.0.1:46321${publicPath}`, {
      headers: { cookie },
    }));
    expect(afterRevoke.status).toBe(410);

    const second = await app.fetch(signedRequest(
      createPath,
      'POST',
      'share-create-3',
      JSON.stringify({ expiresInSeconds: 60 }),
    ));
    const secondBody = await second.json() as { share: { url: string } };
    const secondUrl = new URL(secondBody.share.url);
    const secondPath = secondUrl.pathname;
    const secondSecret = secondUrl.hash.slice(1);
    nowMs += 61_000;
    const expiredClaim = await app.fetch(new Request(`http://127.0.0.1:46321${secondPath}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: secondSecret }),
    }));
    expect(expiredClaim.status).toBe(410);
  });
});
