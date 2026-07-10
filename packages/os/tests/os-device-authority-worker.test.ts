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
  createInMemoryWorkspaceRouteD1,
  migrateWorkspaceRouteD1,
  upsertWorkspaceHostnameInD1,
} from '../scripts/lib/workspace-cloudflare-d1-route-registry';
import {
  createDevicePublicKeyProof,
  devicePublicKeyProofPayload,
  devicePublicKeyThumbprint,
  generateWorkspaceDeviceKeyPair,
  type WorkspaceDeviceKeyPair,
} from '../scripts/lib/workspace-device-login-client';

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


type CapturedRouteRegistry = {
  statements: string[];
  binding: {
    exec(sql: string): Promise<unknown>;
  };
};

type CapturedWorkspaceConnectorProvisioner = {
  calls: Array<{
    workspaceId: string;
    workspaceSlug: string;
    workspaceHost: string;
    connectorId: string;
  }>;
  provisioner(input: {
    workspaceId: string;
    workspaceSlug: string;
    workspaceHost: string;
    connectorId: string;
  }): Promise<{
    connectorId: string;
    cloudflareTunnelToken: string;
    tunnelOriginUrl: string;
    localServiceUrl: string;
  }>;
};

function createCapturedRouteRegistry(): CapturedRouteRegistry {
  const statements: string[] = [];
  return {
    statements,
    binding: {
      async exec(sql: string): Promise<unknown> {
        statements.push(sql);
        return { success: true };
      },
    },
  };
}

function createCapturedWorkspaceConnectorProvisioner(): CapturedWorkspaceConnectorProvisioner {
  const calls: CapturedWorkspaceConnectorProvisioner['calls'] = [];
  return {
    calls,
    async provisioner(input) {
      calls.push(input);
      const connectorLabel = input.connectorId.replace(/_/g, '-');
      return {
        connectorId: input.connectorId,
        cloudflareTunnelToken: `cloudflare_tunnel_token_fixture_${connectorLabel}`,
        tunnelOriginUrl: `https://${connectorLabel}.os-origin.consuelohq.com`,
        localServiceUrl: 'http://127.0.0.1:8960',
      };
    },
  };
}

async function seedGoogleAccountWorkspace(
  store: ReturnType<typeof createMemoryDeviceGrantStore>,
  input: { workspaceSlug: string; workspaceHost: string; homeNodeId?: string },
): Promise<void> {
  await store.putAccountWorkspace({
    accountId: 'google:google-sub-123',
    workspaceSlug: input.workspaceSlug,
    workspaceHost: input.workspaceHost,
    ...(input.homeNodeId ? { homeNodeId: input.homeNodeId } : {}),
    updatedAt: Date.parse('2026-06-13T00:00:00.000Z'),
  });
}

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

  it('should expose first-party OAuth authorization server metadata for ChatGPT MCP', async () => {
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
    });

    const metadata = await handler(new Request(`${origin}/.well-known/oauth-authorization-server`));
    const body = await metadata.json() as Record<string, unknown>;

    expect(metadata.status).toBe(200);
    expect(body).toMatchObject({
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      introspection_endpoint: `${origin}/oauth/introspect`,
      client_id_metadata_document_supported: true,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    });
    expect(body).not.toHaveProperty('registration_endpoint');
  });



  it('should advertise central OAuth protected resource metadata for os.consuelohq.com MCP', async () => {
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
    });

    const metadata = await handler(new Request(origin + '/.well-known/oauth-protected-resource'));
    const body = await metadata.json() as Record<string, unknown>;

    expect(metadata.status).toBe(200);
    expect(body).toMatchObject({
      resource: origin + '/mcp',
      authorization_servers: [origin],
      bearer_methods_supported: ['header'],
    });
    expect(body.scopes_supported).toEqual(expect.arrayContaining(['mcp:call', 'route:/mcp:read', 'tool:*:read']));
  });

  it('should require a bearer token on central MCP and advertise OAuth resource metadata', async () => {
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
    });

    const response = await handler(new Request(origin + '/mcp'));

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(
      'Bearer resource_metadata="' + origin + '/.well-known/oauth-protected-resource"',
    );
  });

  it('should deny central MCP OAuth when the Google account has no workspace membership', async () => {
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl: googleFetch,
    });
    const verifier = 'test-central-pkce-verifier';
    const challenge = b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    const authorize = await handler(new Request(origin + '/oauth/authorize?' + new URLSearchParams({
      response_type: 'code',
      client_id: 'chatgpt-consuelo-os',
      redirect_uri: 'https://chatgpt.com/connector/oauth/callback',
      scope: 'mcp:read mcp:call tool:*:read',
      resource: origin + '/mcp',
      state: 'chatgpt-state',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })));
    const state = new URL(authorize.headers.get('location') ?? '').searchParams.get('state');

    const callback = await handler(new Request(origin + '/login/google/callback?code=google-code&state=' + encodeURIComponent(state ?? '')));

    expect(callback.status).toBe(403);
    await expect(callback.json()).resolves.toMatchObject({
      error: 'access_denied',
      error_description: 'No Consuelo OS workspace is connected for this Google account.',
    });
  });

  it('should resolve central MCP OAuth to the verified account workspace and proxy through the signed connector route', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedGoogleAccountWorkspace(store, {
      workspaceSlug: 'macbook-air-test',
      workspaceHost: 'macbook-air-test.consuelohq.com',
      homeNodeId: 'home-mac-mini',
    });

    const routeRegistry = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routeRegistry);
    await upsertWorkspaceHostnameInD1(routeRegistry, {
      workspaceId: 'workspace_macbook_air_test',
      workspaceSlug: 'macbook-air-test',
      hostname: 'macbook-air-test.consuelohq.com',
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      routes: [
        {
          surface: 'os',
          pathPrefix: '/mcp',
          auth: 'signed-connector',
          status: 'active',
          target: {
            kind: 'os-connector',
            connectorId: 'connector_home_mac_mini',
            connectorStatus: 'connected',
            tunnelOriginUrl: 'https://connector-origin.consuelohq.test',
          },
        },
      ],
    });

    const fetchImpl: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      if (request.url.startsWith('https://connector-origin.consuelohq.test/mcp')) {
        return new Response(JSON.stringify({
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
          body: await request.text(),
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return await googleFetch(input, init);
    };

    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl,
      workspaceRouteRegistry: routeRegistry,
      workspaceEdgeInternalSigningSecret: 'test-edge-secret',
    });
    const verifier = 'test-central-proxy-pkce-verifier';
    const challenge = b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    const authorize = await handler(new Request(origin + '/oauth/authorize?' + new URLSearchParams({
      response_type: 'code',
      client_id: 'chatgpt-consuelo-os',
      redirect_uri: 'https://chatgpt.com/connector/oauth/callback',
      scope: 'mcp:read mcp:call tool:*:read',
      resource: origin + '/mcp',
      state: 'chatgpt-state',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })));
    const state = new URL(authorize.headers.get('location') ?? '').searchParams.get('state');
    const callback = await handler(new Request(origin + '/login/google/callback?code=google-code&state=' + encodeURIComponent(state ?? '')));
    const callbackLocation = new URL(callback.headers.get('location') ?? '');
    const code = callbackLocation.searchParams.get('code') ?? '';

    const tokenResponse = await handler(new Request(origin + '/oauth/token', {
      method: 'POST',
      ...form({
        grant_type: 'authorization_code',
        client_id: 'chatgpt-consuelo-os',
        redirect_uri: 'https://chatgpt.com/connector/oauth/callback',
        code,
        code_verifier: verifier,
        resource: origin + '/mcp',
      }),
    }));
    const tokenJson = await tokenResponse.json() as Record<string, unknown>;
    expect(tokenResponse.status).toBe(200);
    expect(tokenJson.access_token).toMatch(/^coa_/);

    const proxy = await handler(new Request(origin + '/mcp', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + String(tokenJson.access_token),
        'content-type': 'application/json',
        'x-consuelo-workspace-id': 'attacker-controlled',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }));
    const proxied = await proxy.json() as {
      url: string;
      method: string;
      headers: Record<string, string>;
      body: string;
    };

    expect(proxy.status).toBe(200);
    expect(proxied.url).toBe('https://connector-origin.consuelohq.test/mcp');
    expect(proxied.method).toBe('POST');
    expect(proxied.headers['x-consuelo-workspace-id']).toBe('workspace_macbook_air_test');
    expect(proxied.headers['x-consuelo-hostname']).toBe('macbook-air-test.consuelohq.com');
    expect(proxied.headers['x-consuelo-route']).toBe('/mcp');
    expect(proxied.headers['x-consuelo-surface']).toBe('os');
    expect(proxied.headers['x-consuelo-connector-id']).toBe('connector_home_mac_mini');
    expect(proxied.headers['x-consuelo-edge-timestamp']).toMatch(/^\d+$/);
    expect(proxied.headers['x-consuelo-edge-nonce']).toMatch(/^[-A-Za-z0-9_:.]+$/);
    expect(proxied.headers['x-consuelo-edge-signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(proxied.body).toContain('tools/list');
  });

  it('should support ChatGPT CIMD clients and enforce resource echo during MCP OAuth token exchange', async () => {
    const store = createMemoryDeviceGrantStore();
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl: googleFetch,
    });
    const verifier = 'test-cimd-pkce-verifier';
    const challenge = b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    const clientId = 'https://chatgpt.com/oauth/consuelo-os/dynamic-workspace/client.json';
    const redirectUri = 'https://chatgpt.com/connector/oauth/callback';
    const workspaceSlug = 'dynamic-' + crypto.randomUUID().slice(0, 8);
    const workspaceHost = workspaceSlug + '.consuelohq.com';
    const resource = 'https://' + workspaceHost + '/mcp';
    await seedGoogleAccountWorkspace(store, { workspaceSlug, workspaceHost });

    const authorize = await handler(new Request(`${origin}/oauth/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'mcp:read mcp:call tool:*:read',
      resource,
      state: 'chatgpt-state',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })}`));

    expect(authorize.status).toBe(302);
    const googleLocation = authorize.headers.get('location') ?? '';
    expect(googleLocation).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    const googleUrl = new URL(googleLocation);
    expect(googleUrl.searchParams.get('redirect_uri')).toBe(`${origin}/login/google/callback`);
    const state = googleUrl.searchParams.get('state');
    expect(state).toMatch(/^mcp_oauth_state_/);

    const callback = await handler(new Request(`${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(state ?? '')}`));
    expect(callback.status).toBe(302);
    const callbackLocation = new URL(callback.headers.get('location') ?? '');
    expect(callbackLocation.origin + callbackLocation.pathname).toBe(redirectUri);
    const code = callbackLocation.searchParams.get('code') ?? '';
    expect(code).toMatch(/^coa_code_/);

    const mismatchedTokenResponse = await handler(new Request(`${origin}/oauth/token`, {
      method: 'POST',
      ...form({
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: verifier,
        resource: 'https://other-workspace.consuelohq.com/mcp',
      }),
    }));
    await expect(mismatchedTokenResponse.json()).resolves.toMatchObject({
      error: 'invalid_grant',
    });

    const tokenResponse = await handler(new Request(`${origin}/oauth/token`, {
      method: 'POST',
      ...form({
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: verifier,
        resource,
      }),
    }));
    const tokenJson = await tokenResponse.json() as Record<string, unknown>;
    expect(tokenResponse.status).toBe(200);
    expect(tokenJson).toMatchObject({ token_type: 'Bearer', scope: 'mcp:read mcp:call tool:*:read route:/mcp:read' });
    expect(tokenJson.access_token).toMatch(/^coa_/);

    const introspection = await handler(new Request(`${origin}/oauth/introspect`, {
      method: 'POST',
      ...form({
        token: String(tokenJson.access_token),
        resource,
        scope: 'tool:get_raw_steering:read',
      }),
    }));
    await expect(introspection.json()).resolves.toMatchObject({
      active: true,
      client_id: clientId,
      workspace_host: workspaceHost,
      resource,
      scopes: ['mcp:read', 'mcp:call', 'tool:*:read', 'route:/mcp:read'],
      sub: 'google:google-sub-123',
    });
  });

  it('should issue and introspect OAuth access tokens for workspace MCP resources through Google approval', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedGoogleAccountWorkspace(store, { workspaceSlug: 'macbook-air-test', workspaceHost: 'macbook-air-test.consuelohq.com' });
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl: googleFetch,
    });
    const verifier = 'test-pkce-verifier';
    const challenge = b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    const authorize = await handler(new Request(`${origin}/oauth/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: 'chatgpt-consuelo-os',
      redirect_uri: 'https://chatgpt.com/connector/oauth/callback',
      scope: 'mcp:read mcp:call tool:*:read',
      resource: 'https://macbook-air-test.consuelohq.com/mcp',
      state: 'chatgpt-state',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })}`));

    expect(authorize.status).toBe(302);
    const googleLocation = authorize.headers.get('location') ?? '';
    expect(googleLocation).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    const googleUrl = new URL(googleLocation);
    expect(googleUrl.searchParams.get('redirect_uri')).toBe(`${origin}/login/google/callback`);
    const state = googleUrl.searchParams.get('state');
    expect(state).toMatch(/^mcp_oauth_state_/);

    const callback = await handler(new Request(`${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(state ?? '')}`));
    expect(callback.status).toBe(302);
    const callbackLocation = new URL(callback.headers.get('location') ?? '');
    expect(callbackLocation.origin + callbackLocation.pathname).toBe('https://chatgpt.com/connector/oauth/callback');
    expect(callbackLocation.searchParams.get('state')).toBe('chatgpt-state');
    const code = callbackLocation.searchParams.get('code') ?? '';
    expect(code).toMatch(/^coa_code_/);

    const tokenResponse = await handler(new Request(`${origin}/oauth/token`, {
      method: 'POST',
      ...form({
        grant_type: 'authorization_code',
        client_id: 'chatgpt-consuelo-os',
        redirect_uri: 'https://chatgpt.com/connector/oauth/callback',
        code,
        code_verifier: verifier,
      }),
    }));
    const tokenJson = await tokenResponse.json() as Record<string, unknown>;
    expect(tokenResponse.status).toBe(200);
    expect(tokenJson).toMatchObject({ token_type: 'Bearer', scope: 'mcp:read mcp:call tool:*:read route:/mcp:read' });
    expect(tokenJson.access_token).toMatch(/^coa_/);

    const introspection = await handler(new Request(`${origin}/oauth/introspect`, {
      method: 'POST',
      ...form({
        token: String(tokenJson.access_token),
        resource: 'https://macbook-air-test.consuelohq.com/mcp',
        scope: 'tool:get_raw_steering:read',
      }),
    }));
    await expect(introspection.json()).resolves.toMatchObject({
      active: true,
      client_id: 'chatgpt-consuelo-os',
      workspace_host: 'macbook-air-test.consuelohq.com',
      scope: 'mcp:read mcp:call tool:*:read route:/mcp:read',
      scopes: ['mcp:read', 'mcp:call', 'tool:*:read', 'route:/mcp:read'],
      sub: 'google:google-sub-123',
    });
  });

  it('should require workspace selection after Google approval when no pre-auth workspace was supplied', async () => {
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl: googleFetch,
    });
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    const codeResponse = await handler(new Request(CONSUELO_DEVICE_CODE_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        scope: 'workspace:read os:connector:register',
        device_public_key_jwk: deviceKeyPair.publicKeyJwk,
        device_key_algorithm: 'Ed25519',
      }),
    }));
    expect(codeResponse.status).toBe(200);
    const codeJson = await codeResponse.json() as Record<string, string | number>;

    const start = await handler(new Request(`${origin}/login/google/start?user_code=${String(codeJson.user_code).replace('-', '')}`));
    const state = new URL(start.headers.get('location') ?? '').searchParams.get('state');
    const callback = await handler(new Request(`${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(state ?? '')}`));
    expect(callback.status).toBe(200);
    await expect(callback.text()).resolves.toContain('Return to your terminal to name this workspace');

    const poll = await handler(new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
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
    expect(poll.status).toBe(400);
    await expect(poll.json()).resolves.toMatchObject({ error: 'workspace_required', interval: 5 });
  });


  it('should register home, member, and reconnecting nodes for one account workspace', async () => {
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      approvalAssertionSecret,
    });

    const startNodeGrant = async (input: { nodeId?: string; nodeName?: string }) => {
      const deviceKeyPair = generateWorkspaceDeviceKeyPair();
      const formFields: Record<string, string> = {
        client_id: 'consuelo-os-installer',
        scope: 'workspace:read os:connector:register',
        device_public_key_jwk: deviceKeyPair.publicKeyJwk,
        device_key_algorithm: 'Ed25519',
      };
      if (input.nodeId) formFields.node_id = input.nodeId;
      if (input.nodeName) formFields.node_name = input.nodeName;
      const codeResponse = await handler(new Request(CONSUELO_DEVICE_CODE_URL, {
        method: 'POST',
        ...form(formFields),
      }));
      expect(codeResponse.status).toBe(200);
      return {
        codeJson: await codeResponse.json() as Record<string, string | number>,
        deviceKeyPair,
      };
    };

    const approveWithAccount = async (userCode: string) => {
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
        body: new URLSearchParams({ user_code: userCode.replace('-', '') }).toString(),
      }));
      expect(approve.status).toBe(200);
      return approve;
    };

    const pollApproved = async (input: {
      codeJson: Record<string, string | number>;
      deviceKeyPair: WorkspaceDeviceKeyPair;
    }) => {
      const poll = await handler(new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
        method: 'POST',
        ...form({
          client_id: 'consuelo-os-installer',
          device_code: String(input.codeJson.device_code),
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          ...await proofFields({
            clientId: 'consuelo-os-installer',
            deviceCode: String(input.codeJson.device_code),
            deviceKeyPair: input.deviceKeyPair,
          }),
        }),
      }));
      expect(poll.status).toBe(200);
      return await poll.json() as Record<string, unknown>;
    };

    const first = await startNodeGrant({ nodeId: 'node-home', nodeName: 'Mac Mini' });
    await approveWithAccount(String(first.codeJson.user_code));
    const firstSelected = await handler(new Request(`${origin}/login/device/workspace`, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        device_code: String(first.codeJson.device_code),
        workspace_name: 'MacBook Air Test',
        workspace_slug: 'macbook-air-test',
        workspace_host: 'macbook-air-test.consuelohq.com',
        ...await proofFields({
          clientId: 'consuelo-os-installer',
          deviceCode: String(first.codeJson.device_code),
          deviceKeyPair: first.deviceKeyPair,
        }),
      }),
    }));
    expect(firstSelected.status).toBe(200);
    await expect(firstSelected.json()).resolves.toMatchObject({
      node_id: 'node-home',
      node_name: 'Mac Mini',
      node_role: 'home',
      node_status: 'created',
      connector_id: 'connector_node_home',
    });

    const second = await startNodeGrant({ nodeName: 'MacBook Air' });
    await expect((await approveWithAccount(String(second.codeJson.user_code))).json()).resolves.toMatchObject({
      status: 'approved',
    });
    const secondApproved = await pollApproved(second);
    expect(secondApproved).toMatchObject({
      workspace_slug: 'macbook-air-test',
      workspace_host: 'macbook-air-test.consuelohq.com',
      node_name: 'MacBook Air',
      node_role: 'member',
      node_status: 'created',
    });
    expect(secondApproved.node_id).toMatch(/^node_/);
    expect(secondApproved.node_id).not.toBe('node-home');

    const third = await startNodeGrant({
      nodeId: String(secondApproved.node_id),
      nodeName: 'MacBook Air',
    });
    await expect((await approveWithAccount(String(third.codeJson.user_code))).json()).resolves.toMatchObject({
      status: 'approved',
    });
    await expect(pollApproved(third)).resolves.toMatchObject({
      node_id: secondApproved.node_id,
      node_name: 'MacBook Air',
      node_role: 'member',
      node_status: 'reconnected',
    });
  });

  it('should require workspace selection after app-backed approval when no pre-auth workspace was supplied', async () => {
    const routeRegistry = createCapturedRouteRegistry();
    const connectorProvisioner = createCapturedWorkspaceConnectorProvisioner();
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      approvalAssertionSecret,
      workspaceRouteRegistry: routeRegistry.binding,
      workspaceConnectorProvisioner: connectorProvisioner.provisioner,
    });
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    const codeResponse = await handler(new Request(CONSUELO_DEVICE_CODE_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        scope: 'workspace:read os:connector:register',
        device_public_key_jwk: deviceKeyPair.publicKeyJwk,
        device_key_algorithm: 'Ed25519',
      }),
    }));
    expect(codeResponse.status).toBe(200);
    const codeJson = await codeResponse.json() as Record<string, string | number>;

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
      status: 'workspace_required',
      account_id: 'account_google_123',
      account_auth_method: 'google',
      device_public_key_bound: true,
    });
    expect(routeRegistry.statements).toHaveLength(0);

    const poll = await handler(new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
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
    expect(poll.status).toBe(400);
    await expect(poll.json()).resolves.toMatchObject({ error: 'workspace_required', interval: 5 });

    const selected = await handler(new Request(`${origin}/login/device/workspace`, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        device_code: String(codeJson.device_code),
        workspace_name: 'MacBook Air Test',
        workspace_slug: 'macbook-air-test',
        workspace_host: 'macbook-air-test.consuelohq.com',
        ...await proofFields({
          clientId: 'consuelo-os-installer',
          deviceCode: String(codeJson.device_code),
          deviceKeyPair,
        }),
      }),
    }));
    expect(selected.status).toBe(200);
    const selectedJson = await selected.json() as Record<string, unknown>;
    expect(selectedJson).toMatchObject({
      workspace_slug: 'macbook-air-test',
      workspace_host: 'macbook-air-test.consuelohq.com',
      connector_id: 'connector_macbook_air_test',
      cloudflare_tunnel_token: 'cloudflare_tunnel_token_fixture_connector-macbook-air-test',
    });
    expect(connectorProvisioner.calls).toEqual([
      {
        workspaceId: 'workspace_macbook_air_test',
        workspaceSlug: 'macbook-air-test',
        workspaceHost: 'macbook-air-test.consuelohq.com',
        connectorId: 'connector_macbook_air_test',
      },
    ]);
    expect(routeRegistry.statements).toHaveLength(1);
    expect(routeRegistry.statements[0]).toContain('macbook-air-test.consuelohq.com');
    expect(routeRegistry.statements[0]).toContain('workspace_connectors');
    expect(routeRegistry.statements[0]).toContain('connector_macbook_air_test');
    expect(routeRegistry.statements[0]).toContain('/mcp');
    expect(routeRegistry.statements[0]).toContain('os-connector');
    expect(routeRegistry.statements[0]).toContain('https://connector-macbook-air-test.os-origin.consuelohq.com');
    expect(routeRegistry.statements[0]).not.toContain('cloudflare_tunnel_token_fixture');
    expect(routeRegistry.statements[0]).not.toContain('workspace.consuelohq.com');

    const secondKeyPair = generateWorkspaceDeviceKeyPair();
    const secondCodeResponse = await handler(new Request(CONSUELO_DEVICE_CODE_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        scope: 'workspace:read os:connector:register',
        device_public_key_jwk: secondKeyPair.publicKeyJwk,
        device_key_algorithm: 'Ed25519',
      }),
    }));
    expect(secondCodeResponse.status).toBe(200);
    const secondCodeJson = await secondCodeResponse.json() as Record<string, string | number>;
    const secondApprove = await handler(new Request(`${origin}/login/device/approve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-consuelo-account-assertion': await authAssertion({
          accountId: 'account_google_123',
          authMethod: 'google',
          expiresAt: '2026-06-13T00:20:00.000Z',
        }),
      },
      body: new URLSearchParams({ user_code: String(secondCodeJson.user_code).replace('-', '') }).toString(),
    }));
    expect(secondApprove.status).toBe(200);
    await expect(secondApprove.json()).resolves.toMatchObject({
      status: 'approved',
      account_id: 'account_google_123',
      account_auth_method: 'google',
      device_public_key_bound: true,
    });
    expect(routeRegistry.statements).toHaveLength(2);
    expect(routeRegistry.statements[1]).toContain('macbook-air-test.consuelohq.com');
    expect(routeRegistry.statements[1]).not.toContain('workspace.consuelohq.com');
  });

  it('should register the approved workspace host route after auth-first workspace selection', async () => {
    const routeRegistry = createCapturedRouteRegistry();
    const connectorProvisioner = createCapturedWorkspaceConnectorProvisioner();
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl: googleFetch,
      workspaceRouteRegistry: routeRegistry.binding,
      workspaceConnectorProvisioner: connectorProvisioner.provisioner,
      defaultSiteSnapshot: {
        key: 'sites/platform/launcher/sha256-test/index.html',
        versionId: 'sha256-test',
      },
    });
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    const codeResponse = await handler(new Request(CONSUELO_DEVICE_CODE_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        scope: 'workspace:read os:connector:register',
        device_public_key_jwk: deviceKeyPair.publicKeyJwk,
        device_key_algorithm: 'Ed25519',
      }),
    }));
    expect(codeResponse.status).toBe(200);
    const codeJson = await codeResponse.json() as Record<string, string | number>;
    const start = await handler(new Request(`${origin}/login/google/start?user_code=${String(codeJson.user_code).replace('-', '')}`));
    const state = new URL(start.headers.get('location') ?? '').searchParams.get('state');
    const callback = await handler(new Request(`${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(state ?? '')}`));
    expect(callback.status).toBe(200);

    const selected = await handler(new Request(`${origin}/login/device/workspace`, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        device_code: String(codeJson.device_code),
        workspace_name: 'MacBook Air Test',
        workspace_slug: 'macbook-air-test',
        workspace_host: 'macbook-air-test.consuelohq.com',
        ...await proofFields({
          clientId: 'consuelo-os-installer',
          deviceCode: String(codeJson.device_code),
          deviceKeyPair,
        }),
      }),
    }));
    expect(selected.status).toBe(200);
    const selectedJson = await selected.json() as Record<string, unknown>;
    expect(selectedJson).toMatchObject({
      workspace_slug: 'macbook-air-test',
      workspace_host: 'macbook-air-test.consuelohq.com',
      connector_id: 'connector_macbook_air_test',
      cloudflare_tunnel_token: 'cloudflare_tunnel_token_fixture_connector-macbook-air-test',
    });
    expect(routeRegistry.statements).toHaveLength(1);
    expect(routeRegistry.statements[0]).toContain('macbook-air-test.consuelohq.com');
    expect(routeRegistry.statements[0]).toContain('workspace_connectors');
    expect(routeRegistry.statements[0]).toContain('connector_macbook_air_test');
    expect(routeRegistry.statements[0]).toContain('/mcp');
    expect(routeRegistry.statements[0]).toContain('os-connector');
    expect(routeRegistry.statements[0]).not.toContain('cloudflare_tunnel_token_fixture');
    expect(routeRegistry.statements[0]).not.toContain('workspace.consuelohq.com');
  });

  it('should report connector provisioning readiness when required bindings exist', async () => {
    const routeRegistry = createCapturedRouteRegistry();
    const connectorProvisioner = createCapturedWorkspaceConnectorProvisioner();
    const cases = [
      {
        name: 'both bindings',
        workspaceRouteRegistry: routeRegistry.binding,
        workspaceConnectorProvisioner: connectorProvisioner.provisioner,
        expected: true,
      },
      {
        name: 'missing route registry',
        workspaceRouteRegistry: undefined,
        workspaceConnectorProvisioner: connectorProvisioner.provisioner,
        expected: false,
      },
      {
        name: 'missing connector provisioner',
        workspaceRouteRegistry: routeRegistry.binding,
        workspaceConnectorProvisioner: undefined,
        expected: false,
      },
    ];

    for (const testCase of cases) {
      const handler = createOsDeviceAuthorityHandler({
        store: createMemoryDeviceGrantStore(),
        origin,
        now: () => Date.parse('2026-06-13T00:00:00.000Z'),
        workspaceRouteRegistry: testCase.workspaceRouteRegistry,
        workspaceConnectorProvisioner: testCase.workspaceConnectorProvisioner,
      });

      const response = await handler(new Request(`${origin}/health`));

      expect(response.status, testCase.name).toBe(200);
      await expect(response.json(), testCase.name).resolves.toMatchObject({
        ok: true,
        connector_provisioning_configured: testCase.expected,
      });
    }
  });

  it('should return a terminal failure when workspace connector provisioning fails', async () => {
    const entryPoints = ['Google OAuth callback', 'workspace-selection POST', 'direct approval'] as const;

    for (const entryPoint of entryPoints) {
      const store = createMemoryDeviceGrantStore();
      const routeRegistry = createCapturedRouteRegistry();
      const deviceKeyPair = generateWorkspaceDeviceKeyPair();
      const handler = createOsDeviceAuthorityHandler({
        store,
        origin,
        now: () => Date.parse('2026-06-13T00:00:00.000Z'),
        approvalAssertionSecret,
        googleOAuthClientId: 'test-google-client-id',
        googleOAuthClientSecret: 'test-google-client-secret',
        fetchImpl: googleFetch,
        workspaceRouteRegistry: routeRegistry.binding,
        workspaceConnectorProvisioner: async () => {
          throw new Error('controlled connector provisioning failure\nCLOUDFLARE_API_TOKEN=fixture-secret');
        },
      });
      const codeResponse = await handler(new Request(CONSUELO_DEVICE_CODE_URL, {
        method: 'POST',
        ...form({
          client_id: 'consuelo-os-installer',
          scope: 'workspace:read os:connector:register',
          ...(entryPoint === 'workspace-selection POST'
            ? {}
            : {
                workspace_name: 'MacBook Air Test',
                workspace_slug: 'macbook-air-test',
                workspace_host: 'macbook-air-test.consuelohq.com',
              }),
          device_public_key_jwk: deviceKeyPair.publicKeyJwk,
          device_key_algorithm: 'Ed25519',
        }),
      }));
      expect(codeResponse.status, entryPoint).toBe(200);
      const codeJson = await codeResponse.json() as Record<string, string | number>;

      let failureResponse: Response;
      if (entryPoint === 'Google OAuth callback') {
        const start = await handler(new Request(
          `${origin}/login/google/start?user_code=${String(codeJson.user_code).replace('-', '')}`,
        ));
        const state = new URL(start.headers.get('location') ?? '').searchParams.get('state');
        failureResponse = await handler(new Request(
          `${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(state ?? '')}`,
        ));
      } else {
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
          body: new URLSearchParams({
            user_code: String(codeJson.user_code).replace('-', ''),
          }).toString(),
        }));
        if (entryPoint === 'direct approval') {
          failureResponse = approve;
        } else {
          expect(approve.status, entryPoint).toBe(200);
          await expect(approve.json(), entryPoint).resolves.toMatchObject({
            status: 'workspace_required',
          });
          failureResponse = await handler(new Request(`${origin}/login/device/workspace`, {
            method: 'POST',
            ...form({
              client_id: 'consuelo-os-installer',
              device_code: String(codeJson.device_code),
              workspace_name: 'MacBook Air Test',
              workspace_slug: 'macbook-air-test',
              workspace_host: 'macbook-air-test.consuelohq.com',
              ...await proofFields({
                clientId: 'consuelo-os-installer',
                deviceCode: String(codeJson.device_code),
                deviceKeyPair,
              }),
            }),
          }));
        }
      }

      expect(failureResponse.status, entryPoint).toBe(502);
      const failureContentType = failureResponse.headers.get('content-type') ?? '';
      let failureText: string;
      if (failureContentType.includes('application/json')) {
        const failureBody = await failureResponse.json() as Record<string, unknown>;
        expect(failureBody, entryPoint).toMatchObject({
          error: 'workspace_route_setup_failed',
        });
        failureText = JSON.stringify(failureBody);
      } else {
        failureText = await failureResponse.text();
        expect(failureText, entryPoint).toContain('Workspace route setup failed');
      }
      expect(failureText, entryPoint).toContain('controlled connector provisioning failure');
      expect(failureText, entryPoint).not.toContain('fixture-secret');

      const poll = async () => handler(new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
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

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await poll();
        const body = await response.json() as Record<string, unknown>;
        expect(response.status, `${entryPoint} poll ${attempt + 1}`).toBe(400);
        expect(body, `${entryPoint} poll ${attempt + 1}`).toMatchObject({
          error: 'workspace_route_setup_failed',
          error_description: expect.stringContaining('controlled connector provisioning failure'),
        });
        expect(body.error, entryPoint).not.toBe('authorization_pending');
        expect(JSON.stringify(body), entryPoint).not.toContain('fixture-secret');
      }

      const persisted = await store.byUserCode(String(codeJson.user_code));
      expect(persisted, entryPoint).toMatchObject({
        status: 'failed',
        failureCode: 'workspace_route_setup_failed',
        failureMessage: expect.stringContaining('controlled connector provisioning failure'),
      });
      expect(persisted, entryPoint).not.toHaveProperty('connectorToken');
      expect(persisted, entryPoint).not.toHaveProperty('cloudflareTunnelToken');
      expect(persisted, entryPoint).not.toHaveProperty('accessToken');
      expect(JSON.stringify(persisted), entryPoint).not.toContain('fixture-secret');
      expect(routeRegistry.statements, entryPoint).toEqual([]);
    }
  });

  it('should fail closed when route registry is configured without connector provisioning', async () => {
    const routeRegistry = createCapturedRouteRegistry();
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      approvalAssertionSecret,
      workspaceRouteRegistry: routeRegistry.binding,
    });
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    const codeResponse = await handler(new Request(CONSUELO_DEVICE_CODE_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        scope: 'workspace:read os:connector:register',
        workspace_name: 'MacBook Air Test',
        workspace_slug: 'macbook-air-test',
        workspace_host: 'macbook-air-test.consuelohq.com',
        device_public_key_jwk: deviceKeyPair.publicKeyJwk,
        device_key_algorithm: 'Ed25519',
      }),
    }));
    expect(codeResponse.status).toBe(200);
    const codeJson = await codeResponse.json() as Record<string, string | number>;

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

    expect(approve.status).toBe(502);
    await expect(approve.json()).resolves.toMatchObject({
      error: 'workspace_route_setup_failed',
      message: expect.stringContaining('workspace connector provisioning is not configured'),
    });
    expect(routeRegistry.statements).toEqual([]);
  });

  it('should reuse an existing Google account workspace during later auth-first installs', async () => {
    const routeRegistry = createCapturedRouteRegistry();
    const connectorProvisioner = createCapturedWorkspaceConnectorProvisioner();
    const store = createMemoryDeviceGrantStore();
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl: googleFetch,
      workspaceRouteRegistry: routeRegistry.binding,
      workspaceConnectorProvisioner: connectorProvisioner.provisioner,
    });

    const firstKeyPair = generateWorkspaceDeviceKeyPair();
    const firstCodeResponse = await handler(new Request(CONSUELO_DEVICE_CODE_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        scope: 'workspace:read os:connector:register',
        device_public_key_jwk: firstKeyPair.publicKeyJwk,
        device_key_algorithm: 'Ed25519',
      }),
    }));
    const firstCodeJson = await firstCodeResponse.json() as Record<string, string | number>;
    const firstStart = await handler(new Request(`${origin}/login/google/start?user_code=${String(firstCodeJson.user_code).replace('-', '')}`));
    const firstState = new URL(firstStart.headers.get('location') ?? '').searchParams.get('state');
    await handler(new Request(`${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(firstState ?? '')}`));
    await handler(new Request(`${origin}/login/device/workspace`, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        device_code: String(firstCodeJson.device_code),
        workspace_name: 'MacBook Air Test',
        workspace_slug: 'macbook-air-test',
        workspace_host: 'macbook-air-test.consuelohq.com',
        ...await proofFields({
          clientId: 'consuelo-os-installer',
          deviceCode: String(firstCodeJson.device_code),
          deviceKeyPair: firstKeyPair,
        }),
      }),
    }));

    const secondKeyPair = generateWorkspaceDeviceKeyPair();
    const secondCodeResponse = await handler(new Request(CONSUELO_DEVICE_CODE_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        scope: 'workspace:read os:connector:register',
        device_public_key_jwk: secondKeyPair.publicKeyJwk,
        device_key_algorithm: 'Ed25519',
      }),
    }));
    const secondCodeJson = await secondCodeResponse.json() as Record<string, string | number>;
    const secondStart = await handler(new Request(`${origin}/login/google/start?user_code=${String(secondCodeJson.user_code).replace('-', '')}`));
    const secondState = new URL(secondStart.headers.get('location') ?? '').searchParams.get('state');
    const secondCallback = await handler(new Request(`${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(secondState ?? '')}`));
    expect(secondCallback.status).toBe(200);

    const approved = await handler(new Request(CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        device_code: String(secondCodeJson.device_code),
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        ...await proofFields({
          clientId: 'consuelo-os-installer',
          deviceCode: String(secondCodeJson.device_code),
          deviceKeyPair: secondKeyPair,
        }),
      }),
    }));
    expect(approved.status).toBe(200);
    await expect(approved.json()).resolves.toMatchObject({
      workspace_slug: 'macbook-air-test',
      workspace_host: 'macbook-air-test.consuelohq.com',
      cloudflare_tunnel_token: expect.stringMatching(/^cloudflare_tunnel_token_fixture_/),
    });
  });
  it('should register the approved workspace host route dynamically during Google approval', async () => {
    const routeRegistry = createCapturedRouteRegistry();
    const connectorProvisioner = createCapturedWorkspaceConnectorProvisioner();
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl: googleFetch,
      workspaceRouteRegistry: routeRegistry.binding,
      workspaceConnectorProvisioner: connectorProvisioner.provisioner,
      defaultSiteSnapshot: {
        key: 'sites/platform/launcher/sha256-test/index.html',
        versionId: 'sha256-test',
      },
    });
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    const codeResponse = await handler(new Request(CONSUELO_DEVICE_CODE_URL, {
      method: 'POST',
      ...form({
        client_id: 'consuelo-os-installer',
        scope: 'workspace:read os:connector:register',
        workspace_name: 'MacBook Air Test',
        workspace_slug: 'macbook-air-test',
        workspace_host: 'macbook-air-test.consuelohq.com',
        device_public_key_jwk: deviceKeyPair.publicKeyJwk,
        device_key_algorithm: 'Ed25519',
      }),
    }));
    expect(codeResponse.status).toBe(200);
    const codeJson = await codeResponse.json() as Record<string, string | number>;

    const start = await handler(new Request(`${origin}/login/google/start?user_code=${String(codeJson.user_code).replace('-', '')}`));
    const state = new URL(start.headers.get('location') ?? '').searchParams.get('state');

    const callback = await handler(new Request(`${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(state ?? '')}`));
    expect(callback.status).toBe(200);

    expect(routeRegistry.statements).toHaveLength(1);
    const routeSql = routeRegistry.statements[0];
    expect(routeSql).toContain('macbook-air-test.consuelohq.com');
    expect(routeSql).toContain('workspace_macbook_air_test');
    expect(routeSql).toContain('site-snapshot');
    expect(routeSql).toContain('workspace_connectors');
    expect(routeSql).toContain('connector_macbook_air_test');
    expect(routeSql).toContain('/mcp');
    expect(routeSql).toContain('os-connector');
    expect(routeSql).not.toContain('cloudflare_tunnel_token_fixture');
    expect(routeSql).toContain('sites/platform/launcher/sha256-test/index.html');
    expect(routeSql).not.toContain('testing.consuelohq.com');
    expect(routeSql).not.toContain('mac-air-test.consuelohq.com');

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
      workspace_slug: 'macbook-air-test',
      workspace_host: 'macbook-air-test.consuelohq.com',
      cloudflare_tunnel_token: 'cloudflare_tunnel_token_fixture_connector-macbook-air-test',
    });
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
    await expect(callback.text()).resolves.toContain('Device authorized');

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


  it('should hide the device code box when terminal-return pages are rendered', async () => {
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin,
      now: () => Date.parse('2026-06-13T00:00:00.000Z'),
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl: googleFetch,
    });
    const { codeJson } = await startGrant(handler);

    const start = await handler(
      new Request(
        `${origin}/login/google/start?user_code=${String(codeJson.user_code).replace('-', '')}`,
      ),
    );
    const state = new URL(start.headers.get('location') ?? '').searchParams.get('state');
    const callback = await handler(
      new Request(
        `${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(state ?? '')}`,
      ),
    );
    const html = await callback.text();

    expect(html).toContain('Device authorized');
    expect(html).toContain('return to your terminal');
    expect(html).not.toContain('data-device-code');
    expect(html).not.toContain(String(codeJson.user_code));
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
    await expect(callback.text()).resolves.toContain('Device authorized');
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
    await expect(page.text()).resolves.toContain('Sign in to Consuelo OS');

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
