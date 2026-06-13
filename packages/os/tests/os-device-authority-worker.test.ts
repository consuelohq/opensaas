import { describe, expect, it } from 'vitest';

import {
  createMemoryDeviceGrantStore,
  createOsDeviceAuthorityHandler,
} from '../cloudflare/os-device-authority/src/index';
import {
  CONSUELO_DEVICE_CODE_URL,
  CONSUELO_DEVICE_VERIFICATION_URL,
  CONSUELO_OAUTH_ACCESS_TOKEN_URL,
} from '../scripts/lib/workspace-device-authorization';

const origin = 'https://os.consuelohq.com';
const devicePublicKeyJwk = JSON.stringify({
  kty: 'OKP',
  crv: 'Ed25519',
  x: '8Jt6QxQYJkVd4Zg7mWkH3mQ5b7Y2nLz7YdN3wB2p9aA',
});

function form(data: Record<string, string>): { body: string; headers: HeadersInit } {
  return {
    body: new URLSearchParams(data).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  };
}

describe('os device authority worker', () => {
  it('serves hardened GitHub-shaped device auth endpoints on os.consuelohq.com', async () => {
    let currentMs = Date.parse('2026-06-13T00:00:00.000Z');
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => currentMs,
    });

    const codeResponse = await handler(new Request(CONSUELO_DEVICE_CODE_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        scope: 'workspace:read os:connector:register',
        workspace_name: 'testing',
        workspace_slug: 'testing',
        workspace_host: 'testing.consuelohq.com',
        device_public_key_jwk: devicePublicKeyJwk,
        device_key_algorithm: 'Ed25519',
      }),
    }));
    expect(codeResponse.status).toBe(200);
    const codeJson = await codeResponse.json() as Record<string, string | number>;
    expect(codeJson.device_code).toMatch(/^dev_/);
    expect(codeJson.user_code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(codeJson.verification_uri).toBe(CONSUELO_DEVICE_VERIFICATION_URL);
    expect(codeJson.verification_uri_complete).toContain('https://os.consuelohq.com/login/device?user_code=');
    expect(codeJson.expires_in).toBe(900);
    expect(codeJson.interval).toBe(5);

    const pending = await handler(new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        device_code: String(codeJson.device_code),
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    }));
    expect(pending.status).toBe(400);
    await expect(pending.json()).resolves.toMatchObject({ error: 'authorization_pending', interval: 5 });

    const page = await handler(new Request(String(codeJson.verification_uri_complete)));
    expect(page.status).toBe(200);
    await expect(page.text()).resolves.toContain('Approve this Mac');

    const anonymousApprove = await handler(new Request(`${origin}/login/device/approve`, {
      method: 'POST',
      ...form({ user_code: String(codeJson.user_code).replace('-', '') }),
    }));
    expect(anonymousApprove.status).toBe(401);
    await expect(anonymousApprove.json()).resolves.toMatchObject({ error: 'account_session_required' });

    const approve = await handler(new Request(`${origin}/login/device/approve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-consuelo-account-id': 'account_google_123',
        'x-consuelo-account-auth-method': 'google',
      },
      body: new URLSearchParams({ user_code: String(codeJson.user_code).replace('-', '') }).toString(),
    }));
    expect(approve.status).toBe(200);
    await expect(approve.json()).resolves.toMatchObject({
      status: 'approved',
      account_id: 'account_google_123',
      account_auth_method: 'google',
      device_public_key_bound: true,
    });

    currentMs += 6000;
    const approved = await handler(new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        device_code: String(codeJson.device_code),
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    }));
    expect(approved.status).toBe(200);
    const approvedJson = await approved.json() as Record<string, string | boolean>;
    expect(approvedJson.workspace_slug).toBe('testing');
    expect(approvedJson.workspace_host).toBe('testing.consuelohq.com');
    expect(approvedJson.connector_id).toBe('connector_testing');
    expect(approvedJson.connector_bootstrap_token).toMatch(/^cbt_/);
    expect(approvedJson.access_token).toMatch(/^osat_/);
    expect(approvedJson.device_public_key_thumbprint).toMatch(/^dpk_/);
    expect(approvedJson.device_public_key_bound).toBe(true);
    expect(JSON.stringify(approvedJson)).not.toMatch(/password|username|basic_auth/i);
  });
});
