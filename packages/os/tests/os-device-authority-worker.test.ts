import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createMemoryDeviceGrantStore,
  createOsDeviceAuthorityHandler,
} from '../cloudflare/os-device-authority/src/index';
import {
  CONSUELO_DEVICE_CODE_URL,
  CONSUELO_DEVICE_VERIFICATION_URL,
  CONSUELO_OAUTH_ACCESS_TOKEN_URL,
} from '../scripts/lib/workspace-device-authorization';
import {
  createDevicePublicKeyProof,
  devicePublicKeyProofPayload,
  devicePublicKeyThumbprint,
  generateWorkspaceDeviceKeyPair,
  type WorkspaceDeviceKeyPair,
} from '../scripts/lib/workspace-device-login-client';
import {
  createWorkspaceMcpApprovedConnectorBindingStore,
  type WorkspaceMcpConnectionCredentialKv,
} from '../scripts/lib/workspace-mcp-connection-auth';

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
    expires_at: input.expiresAt ?? '2026-06-13T00:10:00.000Z',
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


function createMemoryKv(): WorkspaceMcpConnectionCredentialKv & { entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return {
    entries,
    async get<T = unknown>(key: string, options?: unknown): Promise<T | null> {
      const value = entries.get(key);
      if (value === undefined) return null;
      const type = typeof options === 'object' && options !== null && 'type' in options
        ? (options as { type?: unknown }).type
        : undefined;
      return (type === 'json' ? JSON.parse(value) : value) as T;
    },
    async put(key: string, value: string): Promise<void> {
      entries.set(key, value);
    },
    async delete(key: string): Promise<void> {
      entries.delete(key);
    },
  };
}

function form(data: Record<string, string>): { body: string; headers: HeadersInit } {
  return {
    body: new URLSearchParams(data).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  };
}

async function startGrant(handler: (request: Request) => Promise<Response>): Promise<{
  codeJson: Record<string, string | number>;
  deviceKeyPair: WorkspaceDeviceKeyPair;
}> {
  const deviceKeyPair = generateWorkspaceDeviceKeyPair();
  const codeResponse = await handler(new Request(CONSUELO_DEVICE_CODE_URL, {
    method: 'POST',
    ...form({
      client_id: 'consuelo-os-installer',
      scope: 'workspace:read os:connector:register',
      workspace_name: 'testing',
      workspace_slug: 'testing',
      workspace_host: 'testing.consuelohq.com',
      device_public_key_jwk: deviceKeyPair.publicKeyJwk,
      device_key_algorithm: 'Ed25519',
    }),
  }));
  expect(codeResponse.status).toBe(200);
  return {
    codeJson: await codeResponse.json() as Record<string, string | number>,
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

const googleFetch: typeof fetch = async (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (url === 'https://oauth2.googleapis.com/token') {
    return new Response(JSON.stringify({ id_token: 'verified-google-id-token' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
    return new Response(JSON.stringify({
      aud: 'test-google-client-id',
      sub: 'google-sub-123',
      email: 'ko@example.com',
      email_verified: 'true',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ error: 'unexpected_google_fetch' }), { status: 500 });
};

const failingGoogleTokenFetch: typeof fetch = async (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (url === 'https://oauth2.googleapis.com/token') {
    return new Response(JSON.stringify({ error: 'invalid_client' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ error: 'unexpected_google_fetch' }), { status: 500 });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('os device authority worker', () => {
  it('should record an approved MCP connector binding when Google approves an OS device', async () => {
    const approvedKv = createMemoryKv();
    const approvedBindings = createWorkspaceMcpApprovedConnectorBindingStore({ kv: approvedKv });
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl: googleFetch,
      approvedBindings,
    });
    const { codeJson } = await startGrant(handler);

    const start = await handler(new Request(`${origin}/login/google/start?user_code=${String(codeJson.user_code).replace('-', '')}`));
    const state = new URL(start.headers.get('location') ?? '').searchParams.get('state');
    const callback = await handler(new Request(`${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(state ?? '')}`));

    expect(callback.status).toBe(200);
    const binding = await approvedBindings.findApprovedBinding({
      workspaceId: 'workspace_testing',
      connectorId: 'connector_testing',
      subjectId: 'google:google-sub-123',
      now: '2026-06-13T00:00:00.000Z',
    });
    expect(binding).toMatchObject({
      workspaceId: 'workspace_testing',
      connectorId: 'connector_testing',
      subjectId: 'google:google-sub-123',
      subjectEmail: 'ko@example.com',
      status: 'active',
      capabilities: ['tools:list', 'tools:call'],
    });
    expect(binding?.deviceId).toMatch(/^device_/);
  });
  it('should approve a pending OS device when Google OAuth callback succeeds', async () => {
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl: googleFetch,
    });
    const { codeJson, deviceKeyPair } = await startGrant(handler);

    const start = await handler(new Request(`${origin}/login/google/start?user_code=${String(codeJson.user_code).replace('-', '')}`));
    expect(start.status).toBe(302);
    const location = start.headers.get('location') ?? '';
    expect(location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location).toContain('client_id=test-google-client-id');
    expect(location).toContain(encodeURIComponent(`${origin}/login/google/callback`));
    const state = new URL(location).searchParams.get('state');
    expect(state).toMatch(/^state_/);

    const callback = await handler(new Request(`${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(state ?? '')}`));
    expect(callback.status).toBe(200);
    await expect(callback.text()).resolves.toContain('Approved for ko@example.com');

    const approved = await handler(new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        device_code: String(codeJson.device_code),
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        ...await proofFields({
          clientId: 'consuelo-os-installer',
          deviceCode: String(codeJson.device_code),
          deviceKeyPair,
        }),
      }),
    }));
    expect(approved.status).toBe(200);
    await expect(approved.json()).resolves.toMatchObject({
      workspace_slug: 'testing',
      workspace_host: 'testing.consuelohq.com',
      device_public_key_bound: true,
    });
  });

  it('should call the default global fetch with the Cloudflare global receiver', async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', async function (this: unknown, input: RequestInfo | URL) {
      expect(this).toBe(globalThis);
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === 'https://oauth2.googleapis.com/token') {
        return new Response(JSON.stringify({ id_token: 'verified-google-id-token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
        return new Response(JSON.stringify({
          aud: 'test-google-client-id',
          sub: 'google-sub-123',
          email: 'ko@example.com',
          email_verified: 'true',
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return originalFetch.call(globalThis, input);
    });

    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
    });
    const { codeJson } = await startGrant(handler);
    const start = await handler(new Request(`${origin}/login/google/start?user_code=${String(codeJson.user_code).replace('-', '')}`));
    const state = new URL(start.headers.get('location') ?? '').searchParams.get('state');

    const callback = await handler(new Request(`${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(state ?? '')}`));
    expect(callback.status).toBe(200);
    await expect(callback.text()).resolves.toContain('Approved for ko@example.com');
  });

  it('should reject Google OAuth callback when state is unknown', async () => {
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl: googleFetch,
    });
    const { codeJson, deviceKeyPair } = await startGrant(handler);

    const callback = await handler(new Request(`${origin}/login/google/callback?code=google-code&state=unknown-state`));
    expect(callback.status).toBe(400);
    await expect(callback.text()).resolves.toContain('Google approval session was not found.');

    const stillPending = await handler(new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        device_code: String(codeJson.device_code),
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        ...await proofFields({
          clientId: 'consuelo-os-installer',
          deviceCode: String(codeJson.device_code),
          deviceKeyPair,
        }),
      }),
    }));
    expect(stillPending.status).toBe(400);
    await expect(stillPending.json()).resolves.toMatchObject({ error: 'authorization_pending' });
  });

  it('should keep the device grant pending when Google token exchange fails', async () => {
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      googleOAuthClientId: ' test-google-client-id ',
      googleOAuthClientSecret: ' test-google-client-secret ',
      fetchImpl: failingGoogleTokenFetch,
    });
    const { codeJson, deviceKeyPair } = await startGrant(handler);

    const start = await handler(new Request(`${origin}/login/google/start?user_code=${String(codeJson.user_code).replace('-', '')}`));
    expect(start.status).toBe(302);
    const state = new URL(start.headers.get('location') ?? '').searchParams.get('state');
    expect(start.headers.get('location')).toContain('client_id=test-google-client-id');

    const callback = await handler(new Request(`${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(state ?? '')}`));
    expect(callback.status).toBe(502);
    await expect(callback.text()).resolves.toContain('Google approval failed during token exchange (invalid_client)');

    const stillPending = await handler(new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        device_code: String(codeJson.device_code),
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        ...await proofFields({
          clientId: 'consuelo-os-installer',
          deviceCode: String(codeJson.device_code),
          deviceKeyPair,
        }),
      }),
    }));
    expect(stillPending.status).toBe(400);
    await expect(stillPending.json()).resolves.toMatchObject({ error: 'authorization_pending' });
  });

  it('should render the Google approval link with the configured origin when viewing the device page', async () => {
    const customOrigin = 'https://preview-os.consuelohq.com';
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin: customOrigin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
    });

    const response = await handler(new Request(`${customOrigin}/login/device?user_code=ABCD1234`));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(`${customOrigin}/login/google/start?user_code=ABCD1234`);
  });

  it('serves hardened GitHub-shaped device auth endpoints on os.consuelohq.com', async () => {
    let currentMs = Date.parse('2026-06-13T00:00:00.000Z');
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => currentMs,
      approvalAssertionSecret,
    });

    const { codeJson, deviceKeyPair } = await startGrant(handler);
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
        ...await proofFields({
          clientId: 'consuelo-os-installer',
          deviceCode: String(codeJson.device_code),
          deviceKeyPair,
        }),
      }),
    }));
    expect(pending.status).toBe(400);
    await expect(pending.json()).resolves.toMatchObject({ error: 'authorization_pending', interval: 5 });

    const page = await handler(new Request(String(codeJson.verification_uri_complete)));
    expect(page.status).toBe(200);
    await expect(page.text()).resolves.toContain('Approve this Mac');

    const forgedApprove = await handler(new Request(`${origin}/login/device/approve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-consuelo-account-id': 'account_google_123',
        'x-consuelo-account-auth-method': 'google',
      },
      body: new URLSearchParams({ user_code: String(codeJson.user_code).replace('-', '') }).toString(),
    }));
    expect(forgedApprove.status).toBe(401);
    await expect(forgedApprove.json()).resolves.toMatchObject({ error: 'account_session_required' });

    currentMs += 6000;
    const stillPending = await handler(new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        device_code: String(codeJson.device_code),
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        ...await proofFields({
          clientId: 'consuelo-os-installer',
          deviceCode: String(codeJson.device_code),
          deviceKeyPair,
        }),
      }),
    }));
    expect(stillPending.status).toBe(400);
    await expect(stillPending.json()).resolves.toMatchObject({ error: 'authorization_pending' });

    const approve = await handler(new Request(`${origin}/login/device/approve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-consuelo-account-assertion': await authAssertion({
          accountId: 'account_google_123',
          authMethod: 'google',
          expiresAt: '2026-06-13T00:20:00.000Z',
        }),
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
    const missingProof = await handler(new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        device_code: String(codeJson.device_code),
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    }));
    expect(missingProof.status).toBe(400);
    await expect(missingProof.json()).resolves.toMatchObject({ error: 'invalid_device_public_key_proof' });

    const approved = await handler(new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        device_code: String(codeJson.device_code),
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        ...await proofFields({
          clientId: 'consuelo-os-installer',
          deviceCode: String(codeJson.device_code),
          deviceKeyPair,
        }),
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
