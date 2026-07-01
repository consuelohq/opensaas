import { describe, expect, it } from 'vitest';

import {
  createMemoryDeviceGrantStore,
  createOsDeviceAuthorityHandler,
} from '../cloudflare/os-device-authority/src/index';
import {
  CONSUELO_DEVICE_CODE_URL,
  CONSUELO_OAUTH_ACCESS_TOKEN_URL,
} from '../scripts/lib/workspace-device-authorization';
import {
  createDevicePublicKeyProof,
  devicePublicKeyProofPayload,
  devicePublicKeyThumbprint,
  generateWorkspaceDeviceKeyPair,
  type WorkspaceDeviceKeyPair,
} from '../scripts/lib/workspace-device-login-client';

const runHardeningContracts =
  process.env.CONSUELO_RUN_OS_DEVICE_AUTH_HARDENING_CONTRACTS === '1';
const contractDescribe = runHardeningContracts ? describe : describe.skip;

const origin = 'https://os.consuelohq.com';
const approvalAssertionSecret = 'test-approval-assertion-secret';

function b64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function authAssertion(input: {
  accountId: string;
  authMethod: string;
  expiresAt?: string;
}): Promise<string> {
  const payload = b64(new TextEncoder().encode(JSON.stringify({
    account_id: input.accountId,
    auth_method: input.authMethod,
    expires_at: input.expiresAt ?? '2026-06-13T00:20:00.000Z',
  })));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(approvalAssertionSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))));
  return `${payload}.${signature}`;
}

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
  deviceKeyPair?: WorkspaceDeviceKeyPair;
}): Promise<{ start: Record<string, string | number>; deviceKeyPair: WorkspaceDeviceKeyPair }> {
  const deviceKeyPair = input.deviceKeyPair ?? generateWorkspaceDeviceKeyPair();
  const response = await input.handler(new Request(CONSUELO_DEVICE_CODE_URL, {
    method: 'POST',
    ...form(deviceCodeRequestBody({
      device_public_key_jwk: deviceKeyPair.publicKeyJwk,
      device_key_algorithm: 'Ed25519',
    })),
  }));

  return {
    start: await response.json() as Record<string, string | number>,
    deviceKeyPair,
  };
}

async function proofFields(input: {
  clientId: string;
  deviceCode: string;
  deviceKeyPair: WorkspaceDeviceKeyPair;
}): Promise<Record<string, string>> {
  const thumbprint = await devicePublicKeyThumbprint(input.deviceKeyPair.publicKeyJwk);
  const payload = devicePublicKeyProofPayload({
    clientId: input.clientId,
    deviceCode: input.deviceCode,
    devicePublicKeyThumbprint: thumbprint,
  });
  return {
    device_public_key_proof_payload: payload,
    device_public_key_proof: createDevicePublicKeyProof({ deviceKeyPair: input.deviceKeyPair, payload }),
  };
}

async function pollDeviceGrant(input: {
  handler: (request: Request) => Promise<Response>;
  deviceCode: string;
  deviceKeyPair: WorkspaceDeviceKeyPair;
}): Promise<Response> {
  return input.handler(new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
    method: 'POST',
    ...form({
      client_id: 'consuelo-os-installer',
      device_code: input.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      ...await proofFields({
        clientId: 'consuelo-os-installer',
        deviceCode: input.deviceCode,
        deviceKeyPair: input.deviceKeyPair,
      }),
    }),
  }));
}

contractDescribe('os device approval auth hardening contract', () => {
  it('should reject device-code creation without a local device public key', async () => {
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      approvalAssertionSecret,
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

  it('should keep the grant pending after an anonymous or forged browser approval attempt', async () => {
    let currentMs = Date.parse('2026-06-13T00:00:00.000Z');
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => currentMs,
      approvalAssertionSecret,
    });
    const { start, deviceKeyPair } = await startDeviceGrant({ handler });

    const anonymousApproval = await handler(new Request(`${origin}/login/device/approve`, {
      method: 'POST',
      ...form({ user_code: String(start.user_code).replace('-', '') }),
    }));

    expect(anonymousApproval.status).toBe(401);
    await expect(anonymousApproval.json()).resolves.toMatchObject({
      error: 'account_session_required',
    });

    const forgedApproval = await handler(new Request(`${origin}/login/device/approve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-consuelo-account-id': 'account_google_123',
        'x-consuelo-account-auth-method': 'google',
      },
      body: new URLSearchParams({ user_code: String(start.user_code).replace('-', '') }).toString(),
    }));

    expect(forgedApproval.status).toBe(401);
    await expect(forgedApproval.json()).resolves.toMatchObject({
      error: 'account_session_required',
    });

    currentMs += 6000;
    const poll = await pollDeviceGrant({ handler, deviceCode: String(start.device_code), deviceKeyPair });
    expect(poll.status).toBe(400);
    await expect(poll.json()).resolves.toMatchObject({
      error: 'authorization_pending',
    });
  });

  it('should reject approved device-code redemption without the matching local device proof', async () => {
    let currentMs = Date.parse('2026-06-13T00:00:00.000Z');
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => currentMs,
      approvalAssertionSecret,
    });
    const { start } = await startDeviceGrant({ handler });

    const approval = await handler(new Request(`${origin}/login/device/approve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-consuelo-account-assertion': await authAssertion({
          accountId: 'account_google_123',
          authMethod: 'google',
        }),
      },
      body: new URLSearchParams({ user_code: String(start.user_code).replace('-', '') }).toString(),
    }));
    expect(approval.status).toBe(200);

    currentMs += 6000;
    const response = await handler(new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        device_code: String(start.device_code),
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'invalid_device_public_key_proof',
    });
  });

  it('should approve with a signed stronger-auth assertion and bind bootstrap to the device public key', async () => {
    let currentMs = Date.parse('2026-06-13T00:00:00.000Z');
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => currentMs,
      approvalAssertionSecret,
    });
    const { start, deviceKeyPair } = await startDeviceGrant({ handler });

    const approval = await handler(new Request(`${origin}/login/device/approve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-consuelo-account-assertion': await authAssertion({
          accountId: 'account_google_123',
          authMethod: 'google',
        }),
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
    const poll = await pollDeviceGrant({ handler, deviceCode: String(start.device_code), deviceKeyPair });
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
      approvalAssertionSecret,
    });
    const { start } = await startDeviceGrant({ handler });

    const response = await handler(new Request(`${origin}/login/device/approve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-consuelo-account-assertion': await authAssertion({
          accountId: 'account_password_123',
          authMethod: 'password',
        }),
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
