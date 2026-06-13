import { describe, expect, it } from 'vitest';

import {
  createMemoryDeviceGrantStore,
  createOsDeviceAuthorityHandler,
} from '../cloudflare/os-device-authority/src/index';
import {
  CONSUELO_DEVICE_CODE_URL,
  CONSUELO_OAUTH_ACCESS_TOKEN_URL,
} from '../scripts/lib/workspace-device-authorization';

const runHardeningContracts =
  process.env.CONSUELO_RUN_OS_DEVICE_AUTH_HARDENING_CONTRACTS === '1';
const contractDescribe = runHardeningContracts ? describe : describe.skip;

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

function deviceCodeRequestBody(extra: Record<string, string> = {}): Record<string, string> {
  return {
    client_id: 'consuelo-os-installer',
    scope: 'workspace:read os:connector:register',
    workspace_name: 'testing',
    workspace_slug: 'testing',
    workspace_host: 'testing.consuelohq.com',
    ...extra,
  };
}

async function startDeviceGrant(input: {
  handler: (request: Request) => Promise<Response>;
  devicePublicKey?: string;
}): Promise<Record<string, string | number>> {
  const response = await input.handler(new Request(CONSUELO_DEVICE_CODE_URL, {
    method: 'POST',
    ...form(deviceCodeRequestBody(
      input.devicePublicKey
        ? { device_public_key_jwk: input.devicePublicKey, device_key_algorithm: 'Ed25519' }
        : {},
    )),
  }));

  return await response.json() as Record<string, string | number>;
}

async function pollDeviceGrant(input: {
  handler: (request: Request) => Promise<Response>;
  deviceCode: string;
}): Promise<Response> {
  return input.handler(new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
    method: 'POST',
    ...form({
      client_id: 'consuelo-os-installer',
      device_code: input.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  }));
}

contractDescribe('os device approval auth hardening contract', () => {
  it('should reject device-code creation without a local device public key', async () => {
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
    });

    const response = await handler(new Request(CONSUELO_DEVICE_CODE_URL, {
      method: 'POST',
      ...form(deviceCodeRequestBody()),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'device_public_key_required',
    });
  });

  it('should keep the grant pending after an anonymous browser approval attempt', async () => {
    let currentMs = Date.parse('2026-06-13T00:00:00.000Z');
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => currentMs,
    });
    const start = await startDeviceGrant({ handler, devicePublicKey: devicePublicKeyJwk });

    const anonymousApproval = await handler(new Request(`${origin}/login/device/approve`, {
      method: 'POST',
      ...form({ user_code: String(start.user_code).replace('-', '') }),
    }));

    expect([401, 403]).toContain(anonymousApproval.status);
    await expect(anonymousApproval.json()).resolves.toMatchObject({
      error: 'account_session_required',
    });

    currentMs += 6000;
    const poll = await pollDeviceGrant({ handler, deviceCode: String(start.device_code) });
    expect(poll.status).toBe(400);
    await expect(poll.json()).resolves.toMatchObject({
      error: 'authorization_pending',
    });
  });

  it('should approve with an allowed account auth method and bind bootstrap to the device public key', async () => {
    let currentMs = Date.parse('2026-06-13T00:00:00.000Z');
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => currentMs,
    });
    const start = await startDeviceGrant({ handler, devicePublicKey: devicePublicKeyJwk });

    const approval = await handler(new Request(`${origin}/login/device/approve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-consuelo-account-id': 'account_google_123',
        'x-consuelo-account-auth-method': 'google',
      },
      body: new URLSearchParams({ user_code: String(start.user_code).replace('-', '') }).toString(),
    }));

    expect(approval.status).toBe(200);
    await expect(approval.json()).resolves.toMatchObject({
      status: 'approved',
      account_id: 'account_google_123',
      account_auth_method: 'google',
      device_public_key_bound: true,
    });

    currentMs += 6000;
    const poll = await pollDeviceGrant({ handler, deviceCode: String(start.device_code) });
    expect(poll.status).toBe(200);
    const bootstrap = await poll.json() as Record<string, unknown>;
    expect(bootstrap.workspace_slug).toBe('testing');
    expect(bootstrap.workspace_host).toBe('testing.consuelohq.com');
    expect(bootstrap.device_public_key_thumbprint).toMatch(/^dpk_/);
    expect(bootstrap.device_public_key_bound).toBe(true);
    expect(JSON.stringify(bootstrap)).not.toMatch(/password|username|basic_auth/i);
  });

  it('should reject username/password as the approval auth method', async () => {
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
    });
    const start = await startDeviceGrant({ handler, devicePublicKey: devicePublicKeyJwk });

    const response = await handler(new Request(`${origin}/login/device/approve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-consuelo-account-id': 'account_password_123',
        'x-consuelo-account-auth-method': 'password',
      },
      body: new URLSearchParams({ user_code: String(start.user_code).replace('-', '') }).toString(),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: 'stronger_auth_required',
      allowed_auth_methods: ['google', 'passkey', 'magic_link', 'hardware_key', 'admin_invite'],
    });
  });
});
