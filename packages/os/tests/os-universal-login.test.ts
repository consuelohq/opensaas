import { describe, expect, it } from 'vitest';

import { createOsDeviceAuthorityHandler } from '../cloudflare/os-device-authority/src/app';
import { prepareGrantApproval, commitGrantApproval } from '../cloudflare/os-device-authority/src/services/grants';
import {
  createMemoryDeviceGrantStore,
  DurableStore,
} from '../cloudflare/os-device-authority/src/stores';
import type {
  Grant,
  StorageLike,
  WorkspaceMembership,
} from '../cloudflare/os-device-authority/src/types';
import { createWorkspaceEdgeHandler } from '../cloudflare/workspace-edge/src/index';
import { createMemoryInstallControlPlaneRepository } from '../scripts/lib/install-control-plane';
import {
  createInMemoryWorkspaceRouteD1,
  migrateWorkspaceRouteD1,
  upsertWorkspaceHostnameInD1,
} from '../scripts/lib/workspace-cloudflare-d1-route-registry';
import {
  devicePublicKeyThumbprint,
  generateWorkspaceDeviceKeyPair,
} from '../scripts/lib/workspace-device-login-client';

const origin = 'https://os.consuelohq.com';
const internalSigningSecret = 'test-workspace-edge-internal-secret';
const baseNow = Date.parse('2026-07-24T00:00:00.000Z');

type MemoryStore = ReturnType<typeof createMemoryDeviceGrantStore>;

type AuthorityHandler = (request: Request) => Promise<Response>;

function cookieValue(response: Response, name: string): string {
  const header = response.headers.get('set-cookie') ?? '';
  const match = header.match(new RegExp(`(?:^|,\\s*)${name}=([^;,]+)`));
  if (!match?.[1]) throw new Error(`missing cookie ${name}`);
  return decodeURIComponent(match[1]);
}

function cookieHeader(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('; ');
}

function form(values: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values).toString(),
  };
}

async function seedMembership(
  store: MemoryStore,
  input: Partial<WorkspaceMembership> & Pick<WorkspaceMembership, 'workspaceId' | 'workspaceHost'>,
): Promise<void> {
  await store.putWorkspaceMembership({
    accountId: 'user_canonical_123',
    workspaceId: input.workspaceId,
    workspaceSlug: input.workspaceSlug ?? input.workspaceId.replace(/^workspace_/, '').replace(/_/g, '-'),
    workspaceHost: input.workspaceHost,
    status: input.status ?? 'active',
    createdAt: input.createdAt ?? baseNow,
    updatedAt: input.updatedAt ?? baseNow,
  });
}

function createGoogleFetch(getNonce: () => string): typeof fetch {
  return async (input) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    if (url === 'https://oauth2.googleapis.com/token') {
      return Response.json({ id_token: 'verified-google-id-token' });
    }
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      return Response.json({
        aud: 'test-google-client-id',
        sub: 'google-sub-123',
        email: 'ko@example.com',
        email_verified: 'true',
        nonce: getNonce(),
      });
    }
    return Response.json({ error: 'unexpected_google_fetch' }, { status: 500 });
  };
}

async function createAuthority(input: {
  store: MemoryStore;
  now?: () => number;
}): Promise<{ handler: AuthorityHandler; nonce: { value: string } }> {
  const nonce = { value: '' };
  const repository = createMemoryInstallControlPlaneRepository();
  const nowIso = new Date(input.now?.() ?? baseNow).toISOString();
  await repository.upsertUser({
    userId: 'user_canonical_123',
    email: 'ko@example.com',
    workspaceIds: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  });
  return {
    nonce,
    handler: createOsDeviceAuthorityHandler({
      store: input.store,
      installControlPlaneRepository: repository,
      origin,
      now: input.now ?? (() => baseNow),
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl: createGoogleFetch(() => nonce.value),
      workspaceEdgeInternalSigningSecret: internalSigningSecret,
    }),
  };
}

async function webLogin(input: {
  handler: AuthorityHandler;
  nonce: { value: string };
  returnTo?: string;
  intent?: 'login' | 'signup';
}): Promise<{ authorityCookie: string; callback: Response; state: string }> {
  const start = await input.handler(new Request(
    `${origin}/login/google/start?${new URLSearchParams({
      purpose: 'web',
      intent: input.intent ?? 'login',
      return_to: input.returnTo ?? '/',
    })}`,
  ));
  expect(start.status).toBe(302);
  const googleUrl = new URL(start.headers.get('location') ?? '');
  expect(googleUrl.origin).toBe('https://accounts.google.com');
  const state = googleUrl.searchParams.get('state') ?? '';
  input.nonce.value = googleUrl.searchParams.get('nonce') ?? '';
  expect(state).toMatch(/^web_state_/);
  expect(input.nonce.value).toMatch(/^web_nonce_/);

  const callback = await input.handler(new Request(
    `${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(state)}`,
  ));
  expect(callback.status).toBe(302);
  return {
    authorityCookie: cookieValue(callback, '__Host-consuelo_os_authority'),
    callback,
    state,
  };
}

async function issueSingleMembershipHandoff(input: {
  handler: AuthorityHandler;
  nonce: { value: string };
  returnTo?: string;
}): Promise<{ handoff: string; location: URL; authorityCookie: string }> {
  const login = await webLogin(input);
  const workspaces = await input.handler(new Request(
    `${origin}/auth/workspaces?return_to=${encodeURIComponent(input.returnTo ?? '/')}`,
    { headers: { cookie: cookieHeader({ '__Host-consuelo_os_authority': login.authorityCookie }) } },
  ));
  expect(workspaces.status).toBe(302);
  const location = new URL(workspaces.headers.get('location') ?? '');
  return {
    handoff: location.searchParams.get('handoff') ?? '',
    location,
    authorityCookie: login.authorityCookie,
  };
}

async function createEdge(input: {
  authority: AuthorityHandler;
  workspaceHost?: string;
}): Promise<{
  handler: (request: Request) => Promise<Response>;
  upstreamRequests: Request[];
}> {
  const workspaceHost = input.workspaceHost ?? 'one.consuelohq.com';
  const registry = createInMemoryWorkspaceRouteD1();
  await migrateWorkspaceRouteD1(registry);
  await upsertWorkspaceHostnameInD1(registry, {
    workspaceId: 'workspace_one',
    workspaceSlug: 'one',
    hostname: workspaceHost,
    baseDomain: 'consuelohq.com',
    provider: 'cloudflare',
    owner: 'consuelo-os-cloud',
    status: 'active',
    routes: [{
      surface: 'app',
      pathPrefix: '/agents',
      auth: 'workspace-session',
      status: 'active',
      target: {
        kind: 'service-upstream',
        service: 'app',
        upstreamUrl: 'https://agents.internal.test',
      },
    }],
  });
  const upstreamRequests: Request[] = [];
  const namespace = {
    idFromName: (name: string) => name,
    get: () => ({ fetch: input.authority }),
  };
  return {
    upstreamRequests,
    handler: createWorkspaceEdgeHandler({
      WORKSPACE_ROUTE_REGISTRY: registry,
      CONSUELO_EDGE_SIGNING_SECRET: internalSigningSecret,
      WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET: internalSigningSecret,
      OS_DEVICE_AUTHORITY: namespace,
    }, {
      fetchUpstream: async (request) => {
        upstreamRequests.push(request);
        return new Response('protected app ok', { status: 200 });
      },
      now: () => baseNow,
      createNonce: () => 'edge-nonce-0001',
    }),
  };
}

describe('Consuelo OS universal login', () => {
  it('serves a static sanitized pre-auth launcher without protected workspace data', async () => {
    const { handler } = await createAuthority({ store: createMemoryDeviceGrantStore() });

    const response = await handler(new Request(origin + '/'));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(html).toContain('Log in to Consuelo OS');
    expect(html).toContain('Continue with Google');
    expect(html).toContain('/login/google/start?purpose=web&amp;intent=login');
    expect(html).toContain('/login/google/start?purpose=web&amp;intent=signup');
    expect(html).toContain("Don't have an account?");
    expect(html).toContain('google-mark');
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).toContain(':focus-visible');
    expect(html).toContain('class="brand-logo"');
    expect(html).toContain('src="https://consuelohq.com/favicon.svg"');
    expect(html).toContain('class="auth-main auth-main--login"');
    expect(html).toContain('.auth-main--login .auth-card{width:min(100%,320px)');
    expect(html).toContain('.auth-main--login .provider-button{min-height:40px');
    expect(html).toContain('.auth-main--login .auth-footer a{color:#52a8ff;text-decoration:none}');
    expect(html).not.toContain('brand-monogram');
    expect(html).not.toContain('consuelo-stripes');
    expect(html).not.toContain('Continue to your workspace.');
    expect(html).not.toMatch(/workspace_one|one\.consuelohq\.com|connector_|node_|token|secret/i);
  });

  it('normalizes unsafe returns, validates Google nonce, and renders the zero-membership outcome without enumeration', async () => {
    const store = createMemoryDeviceGrantStore();
    const { handler, nonce } = await createAuthority({ store });
    const login = await webLogin({
      handler,
      nonce,
      returnTo: 'https://evil.example/steal',
    });

    expect(new URL(login.callback.headers.get('location') ?? '', origin).pathname).toBe('/auth/workspaces');
    expect(new URL(login.callback.headers.get('location') ?? '', origin).searchParams.get('return_to')).toBe('/');
    const workspaces = await handler(new Request(origin + '/auth/workspaces?return_to=/', {
      headers: { cookie: cookieHeader({ '__Host-consuelo_os_authority': login.authorityCookie }) },
    }));
    const html = await workspaces.text();

    expect(workspaces.status).toBe(200);
    expect(html).toContain('Name your workspace');
    expect(html).toContain('Create workspace');
    expect(html).not.toMatch(/workspace_|\.consuelohq\.com|google-sub-123|ko@example\.com/);

    const replay = await handler(new Request(
      `${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(login.state)}`,
    ));
    expect(replay.status).toBe(400);
    expect(await replay.text()).not.toMatch(/google-sub-123|ko@example\.com|workspace_/);
  });

  it('auto-selects one active membership, consumes a host-bound handoff once, and gates protected edge routes with a host-only session', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedMembership(store, {
      workspaceId: 'workspace_one',
      workspaceSlug: 'one',
      workspaceHost: 'one.consuelohq.com',
    });
    const { handler: authority, nonce } = await createAuthority({ store });
    const issued = await issueSingleMembershipHandoff({
      handler: authority,
      nonce,
      returnTo: '/agents?view=active',
    });

    expect(issued.location.origin).toBe('https://one.consuelohq.com');
    expect(issued.location.pathname).toBe('/auth/consume');
    expect(issued.handoff).toMatch(/^wlh_/);

    const edge = await createEdge({ authority });
    const wrongAudience = await edge.handler(new Request(
      `https://two.consuelohq.com/auth/consume?handoff=${encodeURIComponent(issued.handoff)}`,
    ));
    expect(wrongAudience.status).toBe(400);
    await expect(wrongAudience.json()).resolves.toEqual({ error: 'invalid_handoff' });

    const consumed = await edge.handler(new Request(issued.location));
    expect(consumed.status).toBe(302);
    expect(consumed.headers.get('location')).toBe('/agents?view=active');
    const setCookie = consumed.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('__Host-consuelo_os_session=');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).not.toContain('Domain=');
    const session = cookieValue(consumed, '__Host-consuelo_os_session');
    const csrf = cookieValue(consumed, '__Host-consuelo_os_csrf');

    const replay = await edge.handler(new Request(issued.location));
    expect(replay.status).toBe(400);
    await expect(replay.json()).resolves.toEqual({ error: 'invalid_handoff' });

    const anonymous = await edge.handler(new Request('https://one.consuelohq.com/agents', {
      headers: { accept: 'text/html' },
    }));
    expect(anonymous.status).toBe(302);
    const loginLocation = new URL(anonymous.headers.get('location') ?? '');
    expect(loginLocation.origin).toBe(origin);
    expect(loginLocation.pathname).toBe('/login/google/start');
    expect(loginLocation.searchParams.get('purpose')).toBe('web');
    expect(loginLocation.searchParams.get('return_to')).toBe('/agents');

    const protectedResponse = await edge.handler(new Request('https://one.consuelohq.com/agents', {
      headers: { cookie: cookieHeader({ '__Host-consuelo_os_session': session }) },
    }));
    expect(protectedResponse.status).toBe(200);
    expect(await protectedResponse.text()).toBe('protected app ok');
    expect(edge.upstreamRequests).toHaveLength(1);
    expect(edge.upstreamRequests[0]?.headers.get('x-consuelo-workspace-id')).toBe('workspace_one');

    const missingCsrf = await edge.handler(new Request(
      'https://one.consuelohq.com/auth/logout',
      {
        method: 'POST',
        headers: {
          origin: 'https://one.consuelohq.com',
          cookie: cookieHeader({
            '__Host-consuelo_os_session': session,
            '__Host-consuelo_os_csrf': csrf,
          }),
        },
      },
    ));
    expect(missingCsrf.status).toBe(403);
    await expect(missingCsrf.json()).resolves.toEqual({ error: 'csrf_failed' });

    const logout = await edge.handler(new Request(
      'https://one.consuelohq.com/auth/logout',
      {
        method: 'POST',
        headers: {
          origin: 'https://one.consuelohq.com',
          'x-consuelo-csrf-token': csrf,
          cookie: cookieHeader({
            '__Host-consuelo_os_session': session,
            '__Host-consuelo_os_csrf': csrf,
          }),
        },
      },
    ));
    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');

    const afterLogout = await edge.handler(new Request(
      'https://one.consuelohq.com/agents',
      {
        headers: {
          accept: 'text/html',
          cookie: cookieHeader({ '__Host-consuelo_os_session': session }),
        },
      },
    ));
    expect(afterLogout.status).toBe(302);
  });

  it('requires an explicit CSRF-protected choice for multiple active memberships and ignores browser-supplied hosts', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedMembership(store, {
      workspaceId: 'workspace_one',
      workspaceHost: 'one.consuelohq.com',
    });
    await seedMembership(store, {
      workspaceId: 'workspace_two',
      workspaceHost: 'two.consuelohq.com',
    });
    await seedMembership(store, {
      workspaceId: 'workspace_revoked',
      workspaceHost: 'revoked.consuelohq.com',
      status: 'revoked',
    });
    const { handler, nonce } = await createAuthority({ store });
    const login = await webLogin({ handler, nonce, returnTo: '/agents' });
    const cookie = cookieHeader({ '__Host-consuelo_os_authority': login.authorityCookie });

    const chooser = await handler(new Request(origin + '/auth/workspaces?return_to=/agents', {
      headers: { cookie },
    }));
    const html = await chooser.text();
    expect(chooser.status).toBe(200);
    expect(html).toContain('one.consuelohq.com');
    expect(html).toContain('two.consuelohq.com');
    expect(html).not.toContain('revoked.consuelohq.com');
    const csrfToken = html.match(/name="csrf_token" value="([^"]+)"/)?.[1] ?? '';
    expect(csrfToken).toMatch(/^csrf_/);

    const missingOrigin = await handler(new Request(origin + '/auth/handoff', {
      ...form({ workspace_id: 'workspace_two', csrf_token: csrfToken, return_to: '/agents' }),
      headers: { ...form({}).headers, cookie },
    }));
    expect(missingOrigin.status).toBe(403);
    await expect(missingOrigin.json()).resolves.toEqual({ error: 'csrf_failed' });

    const selected = await handler(new Request(origin + '/auth/handoff', {
      ...form({
        workspace_id: 'workspace_two',
        workspace_host: 'attacker.example',
        csrf_token: csrfToken,
        return_to: '/agents',
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie,
        origin,
      },
    }));
    expect(selected.status).toBe(302);
    const location = new URL(selected.headers.get('location') ?? '');
    expect(location.origin).toBe('https://two.consuelohq.com');
    expect(location.hostname).not.toBe('attacker.example');

    const revoked = await handler(new Request(origin + '/auth/handoff', {
      ...form({
        workspace_id: 'workspace_revoked',
        csrf_token: csrfToken,
        return_to: '/',
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie,
        origin,
      },
    }));
    expect(revoked.status).toBe(404);
    await expect(revoked.json()).resolves.toEqual({ error: 'membership_not_found' });
  });

  it('fails closed when server-owned membership routing data is not a canonical hostname', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedMembership(store, {
      workspaceId: 'workspace_corrupt',
      workspaceHost: 'one.consuelohq.com@evil.example',
    });
    const { handler, nonce } = await createAuthority({ store });
    const login = await webLogin({ handler, nonce, returnTo: '/agents' });

    const response = await handler(new Request(
      origin + '/auth/workspaces?return_to=/agents',
      {
        headers: {
          cookie: cookieHeader({
            '__Host-consuelo_os_authority': login.authorityCookie,
          }),
        },
      },
    ));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'handoff_unavailable',
    });
    expect(response.headers.get('location')).toBeNull();
  });

  it('fails closed for expired handoffs and atomically permits only one concurrent consume', async () => {
    let nowMs = baseNow;
    const store = createMemoryDeviceGrantStore();
    await seedMembership(store, {
      workspaceId: 'workspace_one',
      workspaceHost: 'one.consuelohq.com',
    });
    const { handler, nonce } = await createAuthority({ store, now: () => nowMs });
    const first = await issueSingleMembershipHandoff({ handler, nonce, returnTo: '/agents' });

    const attempts = await Promise.all([
      handler(new Request(first.location)),
      handler(new Request(first.location)),
    ]);
    expect(attempts.map((response) => response.status).sort()).toEqual([302, 400]);

    const second = await issueSingleMembershipHandoff({ handler, nonce, returnTo: '/agents' });
    nowMs += 60_001;
    const expired = await handler(new Request(second.location));
    expect(expired.status).toBe(400);
    await expect(expired.json()).resolves.toEqual({ error: 'invalid_handoff' });

    const invalid = await handler(new Request(
      'https://one.consuelohq.com/auth/consume?handoff=wlh_not-a-real-capability',
    ));
    expect(invalid.status).toBe(400);
    const invalidText = await invalid.text();
    expect(invalidText).toContain('invalid_handoff');
    expect(invalidText).not.toContain('not-a-real-capability');
  });

  it('uses a durable transaction so concurrent handoff consumers have exactly one winner', async () => {
    const values = new Map<string, unknown>();
    let transactionTail = Promise.resolve();
    let transactionCount = 0;
    const operations = {
      get: async <T>(key: string) => values.get(key) as T | undefined,
      put: async <T>(key: string, value: T) => {
        values.set(key, value);
      },
      delete: async (key: string) => values.delete(key),
    };
    const storage: StorageLike = {
      ...operations,
      transaction: async <T>(closure: (transaction: typeof operations) => Promise<T>) => {
        transactionCount += 1;
        const result = transactionTail.then(() => closure(operations));
        transactionTail = result.then(() => undefined, () => undefined);
        return result;
      },
    };
    const store = new DurableStore(storage);
    await store.putWorkspaceLoginHandoff({
      tokenHash: 'durable-handoff-hash',
      accountId: 'google:google-sub-123',
      workspaceId: 'workspace_one',
      workspaceHost: 'one.consuelohq.com',
      returnPath: '/',
      nonce: 'handoff-nonce',
      issuedAt: baseNow,
      expiresAt: baseNow + 60_000,
    });

    const results = await Promise.all([
      store.consumeWorkspaceLoginHandoff({
        tokenHash: 'durable-handoff-hash',
        audienceHost: 'one.consuelohq.com',
        nowMs: baseNow + 1,
      }),
      store.consumeWorkspaceLoginHandoff({
        tokenHash: 'durable-handoff-hash',
        audienceHost: 'one.consuelohq.com',
        nowMs: baseNow + 1,
      }),
    ]);

    expect(transactionCount).toBe(2);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('preserves the existing home/default node when the same account registers a second machine', async () => {
    const store = createMemoryDeviceGrantStore();
    const homeKey = generateWorkspaceDeviceKeyPair();
    const memberKey = generateWorkspaceDeviceKeyPair();
    await store.putAccountWorkspace({
      accountId: 'google:google-sub-123',
      workspaceId: 'workspace_one',
      workspaceSlug: 'one',
      workspaceHost: 'one.consuelohq.com',
      homeNodeId: 'node-home',
      defaultNodeId: 'node-home',
      updatedAt: baseNow,
    });
    await store.putWorkspaceNode({
      accountId: 'google:google-sub-123',
      workspaceId: 'workspace_one',
      workspaceSlug: 'one',
      workspaceHost: 'one.consuelohq.com',
      nodeId: 'node-home',
      nodeName: 'Mac Mini',
      displayName: 'Mac Mini',
      role: 'home',
      platform: 'darwin',
      architecture: 'arm64',
      channel: 'stable',
      connectorId: 'connector_node_home',
      capabilities: ['mcp'],
      connectorStatus: 'connected',
      state: 'active',
      devicePublicKeyJwk: homeKey.publicKeyJwk,
      devicePublicKeyThumbprint: await devicePublicKeyThumbprint(homeKey.publicKeyJwk),
      createdAt: baseNow,
      updatedAt: baseNow,
      lastSeenAt: baseNow,
    });
    const grant: Grant = {
      hash: 'second-node-grant',
      userCode: 'ABCD-EFGH',
      workspaceSlug: 'one',
      workspaceHost: 'one.consuelohq.com',
      status: 'pending',
      expiresAt: baseNow + 300_000,
      interval: 5,
      nodeName: 'MacBook Air',
      nodePlatform: 'darwin',
      nodeArchitecture: 'arm64',
      nodeChannel: 'stable',
      nodeCapabilities: ['mcp'],
      devicePublicKeyJwk: memberKey.publicKeyJwk,
      deviceKeyAlgorithm: 'Ed25519',
      devicePublicKeyThumbprint: await devicePublicKeyThumbprint(memberKey.publicKeyJwk),
    };

    await prepareGrantApproval({
      store,
      grant,
      accountId: 'google:google-sub-123',
      authMethod: 'google',
      nowMs: baseNow + 1,
    });
    await commitGrantApproval({
      store,
      grant,
      accountId: 'google:google-sub-123',
      nowMs: baseNow + 1,
    });

    await expect(store.byAccountWorkspace('google:google-sub-123')).resolves.toMatchObject({
      workspaceId: 'workspace_one',
      homeNodeId: 'node-home',
      defaultNodeId: 'node-home',
    });
    expect(grant.nodeId).toMatch(/^node_/);
    expect(grant.nodeId).not.toBe('node-home');
    expect(grant.nodeRole).toBe('member');
    await expect(store.byWorkspaceNode('google:google-sub-123', grant.nodeId ?? '')).resolves.toMatchObject({
      role: 'member',
      nodeName: 'MacBook Air',
    });
  });
});
