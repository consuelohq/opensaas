import { generateKeyPairSync } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { createOsDeviceAuthorityHandler } from '../cloudflare/os-device-authority/src/app';
import { createMemoryDeviceGrantStore } from '../cloudflare/os-device-authority/src/stores';
import type { Store } from '../cloudflare/os-device-authority/src/types';
import {
  createDevicePublicKeyProof,
  generateWorkspaceDeviceKeyPair,
  type WorkspaceDeviceKeyPair,
} from '../scripts/lib/workspace-device-login-client';

const origin = 'https://os.consuelohq.com';
const workspaceId = 'workspace_github_source_control';
const workspaceHost = 'github-source-control.consuelohq.com';
const nodeId = 'node_github_source_control';
const nowMs = Date.parse('2026-08-26T00:00:00.000Z');

let store: Store;
let deviceKeyPair: WorkspaceDeviceKeyPair;
let nonceCounter = 0;

function githubAppPrivateKey(): string {
  return generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({
    format: 'pem',
    type: 'pkcs8',
  }).toString();
}

async function seedWorkspaceNode(): Promise<void> {
  await store.putWorkspaceNode({
    accountId: 'account_github_source_control',
    workspaceId,
    workspaceSlug: 'github-source-control',
    workspaceHost,
    nodeId,
    nodeName: 'Local',
    role: 'local',
    connectorStatus: 'connected',
    state: 'active',
    devicePublicKeyJwk: deviceKeyPair.publicKeyJwk,
    devicePublicKeyThumbprint: 'dpk_github_source_control',
    createdAt: nowMs - 60_000,
    updatedAt: nowMs - 60_000,
    lastSeenAt: nowMs - 1_000,
  });
}

function signedNodeRequest(
  path: string,
  fields: Record<string, unknown>,
): Request {
  nonceCounter += 1;
  const payload = JSON.stringify({
    workspaceId,
    nodeId,
    timestamp: nowMs,
    nonce: `github-source-control-nonce-${nonceCounter}`,
    ...fields,
  });
  const signature = createDevicePublicKeyProof({ deviceKeyPair, payload });
  return new Request(`${origin}${path}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-consuelo-node-signature': signature,
    },
    body: payload,
  });
}

function configuredHandler(fetchImpl: typeof fetch) {
  return createOsDeviceAuthorityHandler({
    store,
    origin,
    now: () => nowMs,
    fetchImpl,
    githubAppId: '123456',
    githubAppSlug: 'consuelo-os',
    githubAppPrivateKey: githubAppPrivateKey(),
    githubAppClientId: 'Iv1.consuelo-test',
    githubAppClientSecret: 'github-client-secret-test',
  } as Parameters<typeof createOsDeviceAuthorityHandler>[0]);
}

beforeEach(async () => {
  store = createMemoryDeviceGrantStore();
  deviceKeyPair = generateWorkspaceDeviceKeyPair();
  nonceCounter = 0;
  await seedWorkspaceNode();
});

describe('GitHub source-control authority', () => {
  it('fails closed when the GitHub App is not configured', async () => {
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => nowMs,
    });

    const response = await handler(signedNodeRequest(
      '/workspace/source-control/github/install/start',
      { returnPath: '/diffs' },
    ));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'GITHUB_APP_NOT_CONFIGURED',
      },
    });
  });

  it('reports rejected GitHub OAuth client credentials without exposing secrets', async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      if (url.origin === 'https://github.com' && url.pathname === '/login/oauth/access_token') {
        return Response.json({
          error: 'incorrect_client_credentials',
          error_description: 'The client_secret passed was incorrect.',
        });
      }
      return new Response('not found', { status: 404 });
    };
    const handler = configuredHandler(fetchImpl);

    const start = await handler(signedNodeRequest(
      '/workspace/source-control/github/install/start',
      { returnPath: '/diffs' },
    ));
    const state = new URL((await start.json() as { authorizationUrl: string }).authorizationUrl)
      .searchParams.get('state');

    const callback = await handler(new Request(
      `${origin}/workspace/source-control/github/oauth/callback?code=oauth-code&state=${encodeURIComponent(state ?? '')}`,
    ));

    expect(callback.status).toBe(400);
    const body = await callback.json();
    expect(body).toMatchObject({
      error: {
        code: 'GITHUB_USER_AUTHORIZATION_FAILED',
        message: 'GitHub rejected the configured OAuth client credentials.',
      },
    });
    expect(JSON.stringify(body)).not.toContain('oauth-code');
    expect(JSON.stringify(body)).not.toContain('github-client-secret-test');
    expect(JSON.stringify(body)).not.toContain('client_secret passed was incorrect');
  });

  it('authorizes the GitHub user before reusing an existing installation', async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      if (url.origin === 'https://github.com' && url.pathname === '/login/oauth/access_token') {
        return Response.json({ access_token: 'github-existing-user-token', token_type: 'bearer' });
      }
      if (url.pathname === '/user/installations' && request.method === 'GET') {
        expect(request.headers.get('user-agent')).toBe('consuelo-os-device-authority');
        return Response.json({
          total_count: 2,
          installations: [
            { id: 7, account: { login: 'kokayicobb' }, repository_selection: 'all' },
            { id: 42, account: { login: 'consuelohq' }, repository_selection: 'all' },
          ],
        });
      }
      if (url.pathname === '/app/installations/42' && request.method === 'GET') {
        return Response.json({
          id: 42,
          account: { login: 'consuelohq' },
          repository_selection: 'all',
        });
      }
      if (url.pathname === '/app/installations/42/access_tokens' && request.method === 'POST') {
        return Response.json({
          token: 'github-existing-installation-token',
          expires_at: '2026-08-26T00:55:00.000Z',
        });
      }
      if (url.pathname === '/installation/repositories' && request.method === 'GET') {
        expect(request.headers.get('authorization')).toBe('Bearer github-existing-installation-token');
        return Response.json({
          total_count: 1,
          repositories: [{ id: 101, full_name: 'consuelohq/opensaas', default_branch: 'main' }],
        });
      }
      return new Response('not found', { status: 404 });
    };
    const handler = configuredHandler(fetchImpl);

    const start = await handler(signedNodeRequest(
      '/workspace/source-control/github/install/start',
      { returnPath: '/diffs', repositoryOwners: ['consuelohq'] },
    ));

    expect(start.status).toBe(200);
    const startBody = await start.json() as { authorizationUrl: string };
    const authorizationUrl = new URL(startBody.authorizationUrl);
    expect(authorizationUrl.origin).toBe('https://github.com');
    expect(authorizationUrl.pathname).toBe('/login/oauth/authorize');
    expect(authorizationUrl.searchParams.get('client_id')).toBe('Iv1.consuelo-test');
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(
      `${origin}/workspace/source-control/github/oauth/callback`,
    );
    expect(authorizationUrl.searchParams.get('state')).toMatch(/^ghs_/);
    expect(authorizationUrl.searchParams.get('code_challenge')).toBeTruthy();
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');

    const state = authorizationUrl.searchParams.get('state');
    const callback = await handler(new Request(
      `${origin}/workspace/source-control/github/oauth/callback?code=oauth-code&state=${encodeURIComponent(state ?? '')}`,
    ));
    expect(callback.status).toBe(302);
    const callbackLocation = new URL(callback.headers.get('location') ?? '');
    expect(callbackLocation.origin).toBe(`https://${workspaceHost}`);
    expect(callbackLocation.pathname).toBe('/configuration');
    expect(callbackLocation.searchParams.get('return_to')).toBe('/diffs');
    expect(callbackLocation.searchParams.get('github_handoff')).toMatch(/^ghh_/);
    expect(callbackLocation.pathname).not.toContain('/installations/new');

    const claim = await handler(signedNodeRequest(
      '/workspace/source-control/github/install/claim',
      { handoff: callbackLocation.searchParams.get('github_handoff') },
    ));
    expect(claim.status).toBe(200);
    await expect(claim.json()).resolves.toMatchObject({
      accountLogin: 'consuelohq',
      repositorySelection: 'all',
      returnPath: '/diffs',
      repositories: [{ id: 101, nameWithOwner: 'consuelohq/opensaas', defaultBranch: 'main' }],
    });
  });

  it('routes Manage GitHub access through GitHub installation settings instead of auto-reconnecting', async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      if (url.origin === 'https://github.com' && url.pathname === '/login/oauth/access_token') {
        return Response.json({ access_token: 'github-manage-user-token', token_type: 'bearer' });
      }
      if (url.pathname === '/user/installations' && request.method === 'GET') {
        return Response.json({
          total_count: 1,
          installations: [{ id: 42, account: { login: 'consuelohq' }, repository_selection: 'all' }],
        });
      }
      return new Response('not found', { status: 404 });
    };
    const handler = configuredHandler(fetchImpl);

    const start = await handler(signedNodeRequest(
      '/workspace/source-control/github/install/start',
      { returnPath: '/configuration', repositoryOwners: ['consuelohq'], manageAccess: true },
    ));
    const state = new URL((await start.json() as { authorizationUrl: string }).authorizationUrl)
      .searchParams.get('state');

    const callback = await handler(new Request(
      `${origin}/workspace/source-control/github/oauth/callback?code=manage-code&state=${encodeURIComponent(state ?? '')}`,
    ));

    expect(callback.status).toBe(302);
    const location = new URL(callback.headers.get('location') ?? '');
    expect(location.origin).toBe('https://github.com');
    expect(location.pathname).toBe('/apps/consuelo-os/installations/new');
    expect(location.searchParams.get('state')).toBe(state);
    expect(location.searchParams.get('github_handoff')).toBeNull();
  });

  it('persists the OAuth token before installation enumeration so a transient failure can retry', async () => {
    let exchangeCount = 0;
    let installationReads = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      if (url.origin === 'https://github.com' && url.pathname === '/login/oauth/access_token') {
        exchangeCount += 1;
        return Response.json({ access_token: 'github-retry-user-token', token_type: 'bearer' });
      }
      if (url.pathname === '/user/installations' && request.method === 'GET') {
        installationReads += 1;
        if (installationReads === 1) return new Response('temporary failure', { status: 503 });
        return Response.json({
          total_count: 1,
          installations: [{ id: 42, account: { login: 'consuelohq' }, repository_selection: 'all' }],
        });
      }
      if (url.pathname === '/app/installations/42' && request.method === 'GET') {
        return Response.json({ id: 42, account: { login: 'consuelohq' }, repository_selection: 'all' });
      }
      if (url.pathname === '/app/installations/42/access_tokens' && request.method === 'POST') {
        return Response.json({ token: 'github-retry-installation-token', expires_at: '2026-08-26T00:55:00.000Z' });
      }
      if (url.pathname === '/installation/repositories' && request.method === 'GET') {
        return Response.json({
          total_count: 1,
          repositories: [{ id: 101, full_name: 'consuelohq/opensaas', default_branch: 'main' }],
        });
      }
      return new Response('not found', { status: 404 });
    };
    const handler = configuredHandler(fetchImpl);
    const start = await handler(signedNodeRequest(
      '/workspace/source-control/github/install/start',
      { returnPath: '/diffs', repositoryOwners: ['consuelohq'] },
    ));
    const state = new URL((await start.json() as { authorizationUrl: string }).authorizationUrl)
      .searchParams.get('state');
    const callbackUrl = `${origin}/workspace/source-control/github/oauth/callback?code=retry-code&state=${encodeURIComponent(state ?? '')}`;

    const first = await handler(new Request(callbackUrl));
    expect(first.status).toBe(502);
    const second = await handler(new Request(callbackUrl));

    expect(second.status).toBe(302);
    expect(new URL(second.headers.get('location') ?? '').searchParams.get('github_handoff')).toMatch(/^ghh_/);
    expect(exchangeCount).toBe(1);
    expect(installationReads).toBe(2);
  });

  it('retains OAuth state until preferred installation completion succeeds', async () => {
    let exchangeCount = 0;
    let installationReads = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      if (url.origin === 'https://github.com' && url.pathname === '/login/oauth/access_token') {
        exchangeCount += 1;
        return Response.json({ access_token: 'github-completion-retry-user-token', token_type: 'bearer' });
      }
      if (url.pathname === '/user/installations' && request.method === 'GET') {
        return Response.json({
          total_count: 1,
          installations: [{ id: 42, account: { login: 'consuelohq' }, repository_selection: 'all' }],
        });
      }
      if (url.pathname === '/app/installations/42' && request.method === 'GET') {
        installationReads += 1;
        if (installationReads === 1) return new Response('temporary failure', { status: 503 });
        return Response.json({ id: 42, account: { login: 'consuelohq' }, repository_selection: 'all' });
      }
      if (url.pathname === '/app/installations/42/access_tokens' && request.method === 'POST') {
        return Response.json({
          token: 'github-completion-retry-installation-token',
          expires_at: '2026-08-26T00:55:00.000Z',
        });
      }
      if (url.pathname === '/installation/repositories' && request.method === 'GET') {
        return Response.json({
          total_count: 1,
          repositories: [{ id: 101, full_name: 'consuelohq/opensaas', default_branch: 'main' }],
        });
      }
      return new Response('not found', { status: 404 });
    };
    const handler = configuredHandler(fetchImpl);
    const start = await handler(signedNodeRequest(
      '/workspace/source-control/github/install/start',
      { returnPath: '/diffs', repositoryOwners: ['consuelohq'] },
    ));
    const state = new URL((await start.json() as { authorizationUrl: string }).authorizationUrl)
      .searchParams.get('state');
    const callbackUrl = `${origin}/workspace/source-control/github/oauth/callback?code=completion-retry-code&state=${encodeURIComponent(state ?? '')}`;

    const first = await handler(new Request(callbackUrl));
    expect(first.status).toBe(502);
    const second = await handler(new Request(callbackUrl));

    expect(second.status).toBe(302);
    expect(new URL(second.headers.get('location') ?? '').searchParams.get('github_handoff')).toMatch(/^ghh_/);
    expect(exchangeCount).toBe(1);
    expect(installationReads).toBe(2);
  });

  it('retains OAuth state until fresh-install callback completion succeeds', async () => {
    let installationReads = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      if (url.origin === 'https://github.com' && url.pathname === '/login/oauth/access_token') {
        return Response.json({ access_token: 'github-fresh-retry-user-token', token_type: 'bearer' });
      }
      if (url.pathname === '/user/installations' && request.method === 'GET') {
        return Response.json({
          total_count: 1,
          installations: [{ id: 42, account: { login: 'consuelohq' }, repository_selection: 'selected' }],
        });
      }
      if (url.pathname === '/app/installations/42' && request.method === 'GET') {
        installationReads += 1;
        if (installationReads === 1) return new Response('temporary failure', { status: 503 });
        return Response.json({ id: 42, account: { login: 'consuelohq' }, repository_selection: 'selected' });
      }
      if (url.pathname === '/app/installations/42/access_tokens' && request.method === 'POST') {
        return Response.json({ token: 'github-fresh-retry-installation-token', expires_at: '2026-08-26T00:55:00.000Z' });
      }
      if (url.pathname === '/installation/repositories' && request.method === 'GET') {
        return Response.json({
          total_count: 1,
          repositories: [{ id: 101, full_name: 'consuelohq/opensaas', default_branch: 'main' }],
        });
      }
      return new Response('not found', { status: 404 });
    };
    const handler = configuredHandler(fetchImpl);
    const start = await handler(signedNodeRequest(
      '/workspace/source-control/github/install/start',
      { returnPath: '/diffs', manageAccess: true },
    ));
    const state = new URL((await start.json() as { authorizationUrl: string }).authorizationUrl)
      .searchParams.get('state');
    const oauthCallback = await handler(new Request(
      `${origin}/workspace/source-control/github/oauth/callback?code=fresh-retry-code&state=${encodeURIComponent(state ?? '')}`,
    ));
    expect(oauthCallback.status).toBe(302);
    const installCallbackUrl = `${origin}/workspace/source-control/github/install/callback?installation_id=42&setup_action=update&state=${encodeURIComponent(state ?? '')}`;

    const first = await handler(new Request(installCallbackUrl));
    expect(first.status).toBe(502);
    const second = await handler(new Request(installCallbackUrl));

    expect(second.status).toBe(302);
    expect(new URL(second.headers.get('location') ?? '').searchParams.get('github_handoff')).toMatch(/^ghh_/);
    expect(installationReads).toBe(2);
  });

  it('retains OAuth state until explicit installation selection completion succeeds', async () => {
    let installationReads = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      if (url.origin === 'https://github.com' && url.pathname === '/login/oauth/access_token') {
        return Response.json({ access_token: 'github-select-retry-user-token', token_type: 'bearer' });
      }
      if (url.pathname === '/user/installations' && request.method === 'GET') {
        return Response.json({
          total_count: 2,
          installations: [
            { id: 7, account: { login: 'kokayicobb' }, repository_selection: 'all' },
            { id: 42, account: { login: 'consuelohq' }, repository_selection: 'selected' },
          ],
        });
      }
      if (url.pathname === '/app/installations/42' && request.method === 'GET') {
        installationReads += 1;
        if (installationReads === 1) return new Response('temporary failure', { status: 503 });
        return Response.json({ id: 42, account: { login: 'consuelohq' }, repository_selection: 'selected' });
      }
      if (url.pathname === '/app/installations/42/access_tokens' && request.method === 'POST') {
        return Response.json({ token: 'github-select-retry-installation-token', expires_at: '2026-08-26T00:55:00.000Z' });
      }
      if (url.pathname === '/installation/repositories' && request.method === 'GET') {
        return Response.json({
          total_count: 1,
          repositories: [{ id: 101, full_name: 'consuelohq/opensaas', default_branch: 'main' }],
        });
      }
      return new Response('not found', { status: 404 });
    };
    const handler = configuredHandler(fetchImpl);
    const start = await handler(signedNodeRequest(
      '/workspace/source-control/github/install/start',
      { returnPath: '/diffs' },
    ));
    const state = new URL((await start.json() as { authorizationUrl: string }).authorizationUrl)
      .searchParams.get('state');
    const oauthCallback = await handler(new Request(
      `${origin}/workspace/source-control/github/oauth/callback?code=select-retry-code&state=${encodeURIComponent(state ?? '')}`,
    ));
    expect(oauthCallback.status).toBe(200);
    const selectUrl = `${origin}/workspace/source-control/github/install/select?installation_id=42&state=${encodeURIComponent(state ?? '')}`;

    const first = await handler(new Request(selectUrl));
    expect(first.status).toBe(502);
    const second = await handler(new Request(selectUrl));

    expect(second.status).toBe(302);
    expect(new URL(second.headers.get('location') ?? '').searchParams.get('github_handoff')).toMatch(/^ghh_/);
    expect(installationReads).toBe(2);
  });

  it('rejects a post-install installation id the authorized GitHub user cannot access', async () => {
    let userInstallationReads = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      if (url.origin === 'https://github.com' && url.pathname === '/login/oauth/access_token') {
        return Response.json({
          access_token: 'github-user-token-test',
          expires_in: 28_800,
          refresh_token: 'unused-refresh-token',
          refresh_token_expires_in: 15811200,
          token_type: 'bearer',
        });
      }
      if (url.pathname === '/user/installations' && request.method === 'GET') {
        userInstallationReads += 1;
        return Response.json({
          total_count: userInstallationReads === 1 ? 0 : 1,
          installations: userInstallationReads === 1
            ? []
            : [{
                id: 7,
                account: { login: 'kokayicobb' },
                repository_selection: 'all',
              }],
        });
      }
      return new Response('not found', { status: 404 });
    };
    const handler = configuredHandler(fetchImpl);

    const start = await handler(signedNodeRequest(
      '/workspace/source-control/github/install/start',
      { returnPath: '/diffs' },
    ));
    const startBody = await start.json() as { authorizationUrl: string };
    const state = new URL(startBody.authorizationUrl).searchParams.get('state');

    const oauthCallback = await handler(new Request(
      `${origin}/workspace/source-control/github/oauth/callback?code=oauth-code&state=${encodeURIComponent(state ?? '')}`,
    ));
    expect(oauthCallback.status).toBe(302);
    const installUrl = new URL(oauthCallback.headers.get('location') ?? '');
    expect(installUrl.pathname).toBe('/apps/consuelo-os/installations/new');
    expect(installUrl.searchParams.get('state')).toBe(state);

    const spoofedCallback = await handler(new Request(
      `${origin}/workspace/source-control/github/install/callback?installation_id=42&setup_action=install&state=${encodeURIComponent(state ?? '')}`,
    ));
    expect(spoofedCallback.status).toBe(403);
    await expect(spoofedCallback.json()).resolves.toMatchObject({
      error: { code: 'GITHUB_INSTALLATION_NOT_AUTHORIZED' },
    });
  });

  it('uses GitHub installation UI, verifies the installation, and hands repositories back once', async () => {
    const calls: Array<{ url: string; method: string; authorization: string }> = [];
    let installationTokenCount = 0;
    let userInstallationReads = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      calls.push({
        url: url.toString(),
        method: request.method,
        authorization: request.headers.get('authorization') ?? '',
      });

      if (url.origin === 'https://github.com' && url.pathname === '/login/oauth/access_token') {
        return Response.json({
          access_token: 'github-user-token-test',
          expires_in: 28_800,
          token_type: 'bearer',
        });
      }
      if (url.pathname === '/user/installations' && request.method === 'GET') {
        userInstallationReads += 1;
        return Response.json({
          total_count: userInstallationReads === 1 ? 0 : 1,
          installations: userInstallationReads === 1
            ? []
            : [{
                id: 42,
                account: { login: 'consuelohq' },
                repository_selection: 'selected',
              }],
        });
      }
      if (url.pathname === '/app/installations/42' && request.method === 'GET') {
        return Response.json({
          id: 42,
          account: { login: 'consuelohq' },
          repository_selection: 'selected',
        });
      }
      if (url.pathname === '/app/installations/42/access_tokens' && request.method === 'POST') {
        installationTokenCount += 1;
        return Response.json({
          token: `github-installation-token-${installationTokenCount}`,
          expires_at: '2026-08-26T00:55:00.000Z',
        });
      }
      if (url.pathname === '/installation/repositories' && request.method === 'GET') {
        expect(request.headers.get('authorization')).toBe('Bearer github-installation-token-1');
        return Response.json({
          total_count: 2,
          repositories: [
            { id: 101, full_name: 'consuelohq/opensaas', default_branch: 'main' },
            { id: 202, full_name: 'consuelohq/docs', default_branch: 'main' },
          ],
        });
      }
      return new Response('not found', { status: 404 });
    };
    const handler = configuredHandler(fetchImpl);

    const start = await handler(signedNodeRequest(
      '/workspace/source-control/github/install/start',
      { returnPath: '/diffs' },
    ));
    expect(start.status).toBe(200);
    const startBody = await start.json() as { authorizationUrl: string };
    const authorizationUrl = new URL(startBody.authorizationUrl);
    expect(authorizationUrl.origin).toBe('https://github.com');
    expect(authorizationUrl.pathname).toBe('/login/oauth/authorize');
    const state = authorizationUrl.searchParams.get('state');
    expect(state).toMatch(/^ghs_/);

    const oauthCallback = await handler(new Request(
      `${origin}/workspace/source-control/github/oauth/callback?code=oauth-code&state=${encodeURIComponent(state ?? '')}`,
    ));
    expect(oauthCallback.status).toBe(302);
    const installUrl = new URL(oauthCallback.headers.get('location') ?? '');
    expect(installUrl.origin).toBe('https://github.com');
    expect(installUrl.pathname).toBe('/apps/consuelo-os/installations/new');
    expect(installUrl.searchParams.get('state')).toBe(state);

    const callback = await handler(new Request(
      `${origin}/workspace/source-control/github/install/callback?installation_id=42&setup_action=install&state=${encodeURIComponent(state ?? '')}`,
    ));
    expect(callback.status).toBe(302);
    const callbackLocation = new URL(callback.headers.get('location') ?? '');
    expect(callbackLocation.origin).toBe(`https://${workspaceHost}`);
    expect(callbackLocation.pathname).toBe('/configuration');
    expect(callbackLocation.searchParams.get('return_to')).toBe('/diffs');
    const handoff = callbackLocation.searchParams.get('github_handoff');
    expect(handoff).toMatch(/^ghh_/);

    const claim = await handler(signedNodeRequest(
      '/workspace/source-control/github/install/claim',
      { handoff },
    ));
    expect(claim.status).toBe(200);
    const claimBody = await claim.json() as {
      connectionId: string;
      returnPath: string;
      repositories: Array<{ nameWithOwner: string; defaultBranch: string }>;
    };
    expect(claimBody).toMatchObject({
      returnPath: '/diffs',
      accountLogin: 'consuelohq',
      repositorySelection: 'selected',
      repositories: [
        { nameWithOwner: 'consuelohq/opensaas', defaultBranch: 'main' },
        { nameWithOwner: 'consuelohq/docs', defaultBranch: 'main' },
      ],
    });
    expect(claimBody.connectionId).toMatch(/^ghc_/);
    expect(JSON.stringify(claimBody)).not.toContain('github-installation-token-1');

    const replayedClaim = await handler(signedNodeRequest(
      '/workspace/source-control/github/install/claim',
      { handoff },
    ));
    expect(replayedClaim.status).toBe(410);

    const token = await handler(signedNodeRequest(
      '/workspace/source-control/github/token',
      { connectionId: claimBody.connectionId },
    ));
    expect(token.status).toBe(200);
    await expect(token.json()).resolves.toMatchObject({
      token: 'github-installation-token-2',
      expiresAt: '2026-08-26T00:55:00.000Z',
    });

    expect(calls.filter((call) => call.url.includes('/app/installations/42')).length).toBeGreaterThanOrEqual(3);
    expect(calls.find((call) => call.url.endsWith('/app/installations/42'))?.authorization).toMatch(/^Bearer /);
  });
});
