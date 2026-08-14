import { describe, expect, it } from 'vitest';

import { createOsDeviceAuthorityHandler } from '../cloudflare/os-device-authority/src/app';
import { createMemoryDeviceGrantStore } from '../cloudflare/os-device-authority/src/stores';
import { createMemoryInstallControlPlaneRepository } from '../scripts/lib/install-control-plane';
import { CONSUELO_DEVICE_CODE_URL } from '../scripts/lib/workspace-device-authorization';
import { generateWorkspaceDeviceKeyPair } from '../scripts/lib/workspace-device-login-client';

const ORIGIN = 'https://os.consuelohq.com';
const NOW = Date.parse('2026-08-14T00:30:00.000-04:00');

function form(data: Record<string, string>): {
  body: string;
  headers: HeadersInit;
} {
  return {
    body: new URLSearchParams(data).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  };
}

const googleFetch: typeof fetch = async (input) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  if (url === 'https://oauth2.googleapis.com/token') {
    return new Response(JSON.stringify({ id_token: 'verified-google-id-token' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
    return new Response(
      JSON.stringify({
        aud: 'test-google-client-id',
        sub: 'google-sub-123',
        email: 'ko@example.com',
        email_verified: 'true',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  return new Response(JSON.stringify({ error: 'unexpected_google_fetch' }), {
    status: 500,
  });
};

async function startDeviceApproval(handler: (request: Request) => Promise<Response>) {
  const deviceKeyPair = generateWorkspaceDeviceKeyPair();
  const codeResponse = await handler(
    new Request(CONSUELO_DEVICE_CODE_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        scope: 'workspace:read os:connector:register',
        device_public_key_jwk: deviceKeyPair.publicKeyJwk,
        device_key_algorithm: 'Ed25519',
      }),
    }),
  );
  expect(codeResponse.status).toBe(200);
  const code = (await codeResponse.json()) as Record<string, string | number>;
  const userCode = String(code.user_code);
  const start = await handler(
    new Request(`${ORIGIN}/login/google/start?user_code=${userCode.replace('-', '')}`),
  );
  expect(start.status).toBe(302);
  const state = new URL(start.headers.get('location') ?? '').searchParams.get('state');
  expect(state).toMatch(/^state_/);
  return { userCode, state: state ?? '' };
}

describe('native Google OS device approval', () => {
  it('binds the verified Google email to existing canonical Consuelo user and workspace IDs', async () => {
    const store = createMemoryDeviceGrantStore();
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.upsertUser({
      userId: 'user_canonical_123',
      email: 'ko@example.com',
      workspaceIds: ['workspace_canonical_123'],
      workspaceMembershipVerifiedAt: new Date(NOW - 60_000).toISOString(),
      createdAt: '2026-08-01T12:00:00.000Z',
      updatedAt: new Date(NOW - 60_000).toISOString(),
    });
    const handler = createOsDeviceAuthorityHandler({
      store,
      installControlPlaneRepository: repository,
      origin: ORIGIN,
      now: () => NOW,
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl: googleFetch,
    });
    const { userCode, state } = await startDeviceApproval(handler);

    const callback = await handler(
      new Request(
        `${ORIGIN}/login/google/callback?code=google-code&state=${encodeURIComponent(state)}`,
      ),
    );
    expect(callback.status).toBe(200);
    await expect(callback.text()).resolves.toContain(
      'Return to your terminal to name this workspace',
    );

    await expect(store.byUserCode(userCode)).resolves.toMatchObject({
      accountId: 'user_canonical_123',
      accountAuthMethod: 'google',
      canonicalUserId: 'user_canonical_123',
      canonicalWorkspaceId: 'workspace_canonical_123',
      workspaceId: 'workspace_canonical_123',
    });
    const grant = await store.byUserCode(userCode);
    expect(grant?.accountId).not.toBe('google:google-sub-123');
  });

  it('fails closed and leaves the grant unbound when the Google account has no fresh canonical directory proof', async () => {
    const store = createMemoryDeviceGrantStore();
    const handler = createOsDeviceAuthorityHandler({
      store,
      installControlPlaneRepository: createMemoryInstallControlPlaneRepository(),
      origin: ORIGIN,
      now: () => NOW,
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl: googleFetch,
    });
    const { userCode, state } = await startDeviceApproval(handler);

    const callback = await handler(
      new Request(
        `${ORIGIN}/login/google/callback?code=google-code&state=${encodeURIComponent(state)}`,
      ),
    );
    expect(callback.status).toBe(403);
    await expect(callback.text()).resolves.toContain(
      'Sign in to Consuelo first, then retry device approval',
    );

    const grant = await store.byUserCode(userCode);
    expect(grant?.accountId).toBeUndefined();
    expect(grant?.canonicalUserId).toBeUndefined();
    expect(grant?.canonicalWorkspaceId).toBeUndefined();
    expect(grant?.approvedAt).toBeUndefined();
  });
});
