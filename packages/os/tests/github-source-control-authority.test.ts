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
    githubAppSlug: 'consuelo-source-control',
    githubAppPrivateKey: githubAppPrivateKey(),
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

  it('uses GitHub installation UI, verifies the installation, and hands repositories back once', async () => {
    const calls: Array<{ url: string; method: string; authorization: string }> = [];
    let installationTokenCount = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      calls.push({
        url: url.toString(),
        method: request.method,
        authorization: request.headers.get('authorization') ?? '',
      });

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
    const startBody = await start.json() as { installUrl: string };
    const installUrl = new URL(startBody.installUrl);
    expect(installUrl.origin).toBe('https://github.com');
    expect(installUrl.pathname).toBe('/apps/consuelo-source-control/installations/new');
    const state = installUrl.searchParams.get('state');
    expect(state).toMatch(/^ghs_/);

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
