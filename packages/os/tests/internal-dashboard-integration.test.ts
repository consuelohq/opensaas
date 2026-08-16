import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createOsDeviceAuthorityHandler } from '../cloudflare/os-device-authority/src/app';
import { createMemoryDeviceGrantStore } from '../cloudflare/os-device-authority/src/stores';
import { createWorkspaceEdgeHandler } from '../cloudflare/workspace-edge/src/index';
import {
  createInstallControlPlaneService,
  createMemoryInstallControlPlaneRepository,
} from '../scripts/lib/install-control-plane';
import { createInstallDiagnosticBundleStore } from '../scripts/lib/install-control-plane-r2';
import {
  createInternalUserDashboardPageHandler,
} from '../scripts/lib/internal-user-dashboard';
import {
  installDashboardDiagnosticRoute,
  type InstallTelemetryEvent,
} from '../scripts/lib/install-telemetry-contract';
import {
  createInMemoryWorkspaceRouteD1,
  migrateWorkspaceRouteD1,
} from '../scripts/lib/workspace-cloudflare-d1-route-registry';

const INSTALL_ID = 'ins_66666666-6666-4666-8666-666666666666' as const;
const ASSERTION_SECRET = 'branch-six-user-directory-secret';
const NOW = Date.parse('2026-08-13T19:15:00.000Z');

function installStarted(): InstallTelemetryEvent {
  return {
    schemaVersion: 1,
    eventId: 'evt_66666666-6666-4666-8666-666666666666',
    installId: INSTALL_ID,
    producer: 'installer',
    name: 'install.started',
    stage: 'bootstrap',
    outcome: 'started',
    occurredAt: '2026-08-13T19:00:00.000Z',
    sequence: 1,
    identity: { state: 'anonymous' },
    context: { platform: 'darwin', architecture: 'arm64', channel: 'canary' },
  };
}

function userDirectoryAssertion(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', ASSERTION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

describe('Branch 6 internal dashboard integration', () => {
  it('renders the private dashboard from live control-plane data and derives user detail without a user-detail API', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.upsertUser({
      userId: 'user_ada',
      email: 'ada@consuelo.test',
      displayName: 'Ada Lovelace',
      workspaceIds: ['workspace_ada'],
      createdAt: '2026-08-13T18:00:00.000Z',
      updatedAt: '2026-08-13T18:00:00.000Z',
    });
    await repository.ingestEvent(installStarted(), {
      trust: 'installer',
      ingestedAt: '2026-08-13T19:00:01.000Z',
    });
    const service = createInstallControlPlaneService({ repository });

    const denied = createInternalUserDashboardPageHandler({
      service,
      authorize: async () => false,
      now: () => NOW,
    });
    expect((await denied(new Request('https://internal.consuelohq.com/users'))).status).toBe(403);

    const allowed = createInternalUserDashboardPageHandler({
      service,
      authorize: async () => true,
      now: () => NOW,
    });
    const usersResponse = await allowed(new Request('https://internal.consuelohq.com/users'));
    expect(usersResponse.status).toBe(200);
    expect(usersResponse.headers.get('cache-control')).toBe('no-store');
    const usersHtml = await usersResponse.text();
    expect(usersHtml).toContain('Ada Lovelace');
    expect(usersHtml).toContain('data-data-mode="live"');
    expect(usersHtml).not.toContain('Fixture surface.');

    const detailResponse = await allowed(
      new Request('https://internal.consuelohq.com/users/user_ada'),
    );
    expect(detailResponse.status).toBe(200);
    const detailHtml = await detailResponse.text();
    expect(detailHtml).toContain('Ada Lovelace');
    expect(detailHtml).toContain('Install history');
    expect(detailHtml).not.toContain('/api/internal/os/v1/users/user_ada');
  });

  it('serves dashboard HTML before generic Workspace Edge routing and keeps assets behind the same authorizer', async () => {
    const routeRegistry = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routeRegistry);
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.upsertUser({
      userId: 'user_grace',
      email: 'grace@consuelo.test',
      displayName: 'Grace Hopper',
      workspaceIds: ['workspace_grace'],
      createdAt: '2026-08-13T18:00:00.000Z',
      updatedAt: '2026-08-13T18:00:00.000Z',
    });
    const service = createInstallControlPlaneService({ repository });
    const sessionCookie = '__Host-consuelo_os_session=target-session';
    const env = {
      WORKSPACE_ROUTE_REGISTRY: routeRegistry,
      CONSUELO_EDGE_SIGNING_SECRET: 'edge-secret',
      WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET: 'internal-secret',
      OS_DEVICE_AUTHORITY: {
        idFromName: (name: string) => name,
        get: () => ({
          fetch: async (request: Request) =>
            (request.headers.get('cookie') ?? '').includes(sessionCookie)
              ? new Response(null, { status: 204 })
              : Response.json({ error: 'workspace_session_required' }, { status: 401 }),
        }),
      },
    };

    const deniedHandler = createWorkspaceEdgeHandler(env, {
      internalDashboardService: service,
      authorizeInternalDashboard: async () => false,
      now: () => NOW,
    });
    expect(
      (await deniedHandler(new Request('https://internal.consuelohq.com/users', {
        headers: { cookie: sessionCookie },
      }))).status,
    ).toBe(403);
    expect(
      (
        await deniedHandler(
          new Request('https://internal.consuelohq.com/internal/assets/dashboard.css', {
            headers: { cookie: sessionCookie },
          }),
        )
      ).status,
    ).toBe(403);

    const allowedHandler = createWorkspaceEdgeHandler(env, {
      internalDashboardService: service,
      authorizeInternalDashboard: async () => true,
      now: () => NOW,
    });
    const response = await allowedHandler(new Request('https://internal.consuelohq.com/users', {
      headers: { cookie: sessionCookie },
    }));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Grace Hopper');
    const css = await allowedHandler(
      new Request('https://internal.consuelohq.com/internal/assets/dashboard.css', {
        headers: { cookie: sessionCookie },
      }),
    );
    expect(css.status).toBe(200);
    expect(css.headers.get('cache-control')).toBe('no-store');
    expect(await css.text()).toContain('--dash-bg: #151515');
  });

  it('keeps workspace auth handoff ahead of the internal operator dashboard Access gate', async () => {
    const routeRegistry = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routeRegistry);
    let authorityCalls = 0;
    const edge = createWorkspaceEdgeHandler(
      {
        WORKSPACE_ROUTE_REGISTRY: routeRegistry,
        CONSUELO_EDGE_SIGNING_SECRET: 'edge-secret',
        WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET: 'internal-secret',
        OS_DEVICE_AUTHORITY: {
          idFromName: (name: string) => name,
          get: () => ({
            fetch: async () => {
              authorityCalls += 1;
              return new Response(null, { status: 204 });
            },
          }),
        },
      },
      {
        internalDashboardService: createInstallControlPlaneService({
          repository: createMemoryInstallControlPlaneRepository(),
        }),
        authorizeInternalDashboard: async () => false,
        now: () => NOW,
      },
    );

    const consume = await edge(
      new Request('https://internal.consuelohq.com/auth/consume?handoff=abc'),
    );
    expect(consume.status).toBe(204);
    expect(authorityCalls).toBe(1);

    const users = await edge(
      new Request('https://internal.consuelohq.com/users'),
    );
    expect(users.status).toBe(403);
  });

  it('leaves shared-host paths on normal workspace routing when dashboard Access is disabled', async () => {
    const routeRegistry = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routeRegistry);
    let sessionValidationCalls = 0;
    const edge = createWorkspaceEdgeHandler(
      {
        WORKSPACE_ROUTE_REGISTRY: routeRegistry,
        CONSUELO_EDGE_SIGNING_SECRET: 'edge-secret',
        WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET: 'internal-secret',
        OS_DEVICE_AUTHORITY: {
          idFromName: (name: string) => name,
          get: () => ({
            fetch: async () => {
              sessionValidationCalls += 1;
              return new Response(null, { status: 204 });
            },
          }),
        },
      },
      {
        internalDashboardService: createInstallControlPlaneService({
          repository: createMemoryInstallControlPlaneRepository(),
        }),
        now: () => NOW,
      },
    );

    const response = await edge(
      new Request('https://internal.consuelohq.com/', {
        headers: { accept: 'text/html' },
      }),
    );
    expect(response.status).toBe(404);
    expect(sessionValidationCalls).toBe(0);
  });

  it('fails closed instead of intercepting with a partially configured dashboard', async () => {
    const routeRegistry = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routeRegistry);
    const edge = createWorkspaceEdgeHandler(
      {
        WORKSPACE_ROUTE_REGISTRY: routeRegistry,
        CONSUELO_EDGE_SIGNING_SECRET: 'edge-secret',
        WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET: 'internal-secret',
        OS_INTERNAL_DASHBOARD_ACCESS_TEAM_DOMAIN: 'consuelo.cloudflareaccess.com',
        OS_DEVICE_AUTHORITY: {
          idFromName: (name: string) => name,
          get: () => ({
            fetch: async () => new Response(null, { status: 204 }),
          }),
        },
      },
      {
        internalDashboardService: createInstallControlPlaneService({
          repository: createMemoryInstallControlPlaneRepository(),
        }),
        now: () => NOW,
      },
    );

    const response = await edge(
      new Request('https://internal.consuelohq.com/users'),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'workspace_auth_unavailable',
    });
  });

  it('requires a valid internal-host workspace session before applying the operator dashboard gate', async () => {
    const routeRegistry = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routeRegistry);
    const service = createInstallControlPlaneService({
      repository: createMemoryInstallControlPlaneRepository(),
    });
    let sessionValidationCalls = 0;
    const authorityFetch = async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      if (url.pathname !== '/internal/auth/session/validate') {
        return new Response('not found', { status: 404 });
      }
      sessionValidationCalls += 1;
      expect(request.headers.get('x-consuelo-workspace-host')).toBe('internal.consuelohq.com');
      const cookie = request.headers.get('cookie') ?? '';
      return cookie.includes('__Host-consuelo_os_session=target-session')
        ? new Response(null, { status: 204 })
        : Response.json({ error: 'workspace_session_required' }, { status: 401 });
    };
    const env = {
      WORKSPACE_ROUTE_REGISTRY: routeRegistry,
      CONSUELO_EDGE_SIGNING_SECRET: 'edge-secret',
      WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET: 'internal-secret',
      OS_DEVICE_AUTHORITY: {
        idFromName: (name: string) => name,
        get: () => ({ fetch: authorityFetch }),
      },
    };

    const allowedOperator = createWorkspaceEdgeHandler(env, {
      internalDashboardService: service,
      authorizeInternalDashboard: async () => true,
      now: () => NOW,
    });
    const anonymous = await allowedOperator(new Request(
      'https://internal.consuelohq.com/users?state=active',
      { headers: { accept: 'text/html' } },
    ));
    expect(anonymous.status).toBe(302);
    expect(anonymous.headers.get('location')).toBe(
      'https://os.consuelohq.com/login/google/start?purpose=web&return_to=%2Fusers%3Fstate%3Dactive',
    );
    const anonymousRoot = await allowedOperator(new Request('https://internal.consuelohq.com/', {
      headers: { accept: 'text/html' },
    }));
    expect(anonymousRoot.status).toBe(302);
    expect(anonymousRoot.headers.get('location')).toBe(
      'https://os.consuelohq.com/login/google/start?purpose=web&return_to=%2F',
    );
    const anonymousJson = await allowedOperator(new Request('https://internal.consuelohq.com/users', {
      headers: { accept: 'application/json' },
    }));
    expect(anonymousJson.status).toBe(401);
    await expect(anonymousJson.json()).resolves.toEqual({
      error: 'workspace_session_required',
    });

    const authenticated = await allowedOperator(new Request('https://internal.consuelohq.com/users', {
      headers: { cookie: '__Host-consuelo_os_session=target-session' },
    }));
    expect(authenticated.status).toBe(200);
    const authenticatedRoot = await allowedOperator(new Request('https://internal.consuelohq.com/', {
      headers: { cookie: '__Host-consuelo_os_session=target-session' },
    }));
    expect(authenticatedRoot.status).toBe(200);
    expect(sessionValidationCalls).toBeGreaterThanOrEqual(2);

    const deniedOperator = createWorkspaceEdgeHandler(env, {
      internalDashboardService: service,
      authorizeInternalDashboard: async () => false,
      now: () => NOW,
    });
    const forbidden = await deniedOperator(new Request('https://internal.consuelohq.com/users', {
      headers: { cookie: '__Host-consuelo_os_session=target-session' },
    }));
    expect(forbidden.status).toBe(403);
  });

  it('downloads the current redacted diagnostic through the authenticated dashboard without exposing the R2 object key', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.ingestEvent(installStarted(), {
      trust: 'installer',
      ingestedAt: '2026-08-13T19:00:01.000Z',
    });
    const objects = new Map<string, string>();
    const bundleStore = createInstallDiagnosticBundleStore({
      repository,
      bucket: {
        async put(key, body) {
          objects.set(key, typeof body === 'string' ? body : new TextDecoder().decode(body));
        },
        async get(key) {
          const body = objects.get(key);
          return body === undefined ? null : { text: async () => body };
        },
        async delete(key) {
          objects.delete(key);
        },
      },
      now: () => NOW,
      randomUuid: () => '66666666-6666-4666-8666-666666666666',
    });
    await bundleStore.put({
      installId: INSTALL_ID,
      outcome: 'failed',
      diagnostic: {
        message: 'background agent failed',
        authorization: 'Bearer must-be-redacted',
      },
    });

    const authority = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      installControlPlaneRepository: repository,
      installDiagnosticBundleStore: bundleStore,
      workspaceEdgeInternalSigningSecret: 'edge-secret',
      now: () => NOW,
    });
    const routeRegistry = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routeRegistry);
    const edge = createWorkspaceEdgeHandler(
      {
        WORKSPACE_ROUTE_REGISTRY: routeRegistry,
        CONSUELO_EDGE_SIGNING_SECRET: 'signing-secret',
        WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET: 'edge-secret',
        OS_DEVICE_AUTHORITY: {
          idFromName: (name: string) => name,
          get: () => ({
            fetch: async (request: Request) => {
              if (new URL(request.url).pathname === '/internal/auth/session/validate') {
                return (request.headers.get('cookie') ?? '').includes('__Host-consuelo_os_session=target-session')
                  ? new Response(null, { status: 204 })
                  : Response.json({ error: 'workspace_session_required' }, { status: 401 });
              }
              return authority(request);
            },
          }),
        },
      },
      {
        internalDashboardService: createInstallControlPlaneService({ repository }),
        authorizeInternalDashboard: async () => true,
        now: () => NOW,
      },
    );

    const detail = await edge(
      new Request(`https://internal.consuelohq.com/installs/${INSTALL_ID}`, {
        headers: { cookie: '__Host-consuelo_os_session=target-session' },
      }),
    );
    const detailHtml = await detail.text();
    expect(detail.status).toBe(200);
    expect(detailHtml).toContain(installDashboardDiagnosticRoute(INSTALL_ID));
    expect(detailHtml).not.toContain('install-diagnostics/failed/');

    const download = await edge(
      new Request(`https://internal.consuelohq.com${installDashboardDiagnosticRoute(INSTALL_ID)}`, {
        headers: { cookie: '__Host-consuelo_os_session=target-session' },
      }),
    );
    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')).toContain('application/json');
    expect(download.headers.get('content-disposition')).toContain('attachment');
    const downloaded = await download.text();
    expect(downloaded).toContain('background agent failed');
    expect(downloaded).not.toContain('must-be-redacted');
  });

  it('accepts only short-lived signed canonical user-directory syncs on Device Authority', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    const authority = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      installControlPlaneRepository: repository,
      approvalAssertionSecret: ASSERTION_SECRET,
      now: () => NOW,
    });
    const payload = {
      purpose: 'install-control-plane-user-sync',
      user_id: 'user_katherine',
      email: 'katherine@consuelo.test',
      display_name: 'Katherine Johnson',
      workspace_id: 'workspace_katherine',
      created_at: '2026-08-01T12:00:00.000Z',
      updated_at: '2026-08-13T19:14:00.000Z',
      expires_at: '2026-08-13T19:20:00.000Z',
    };

    const response = await authority(
      new Request('https://os.consuelohq.com/internal/install-control-plane/users', {
        method: 'POST',
        headers: {
          'x-consuelo-user-directory-assertion': userDirectoryAssertion(payload),
        },
      }),
    );
    expect(response.status).toBe(204);
    await expect(repository.listUsers({ nowMs: NOW })).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          userId: 'user_katherine',
          email: 'katherine@consuelo.test',
          displayName: 'Katherine Johnson',
          workspaceIds: ['workspace_katherine'],
        }),
      ],
    });
    await expect(
      repository.findCanonicalUsersByEmail('katherine@consuelo.test'),
    ).resolves.toEqual([
      {
        userId: 'user_katherine',
        email: 'katherine@consuelo.test',
        workspaceMemberships: [
          {
            workspaceId: 'workspace_katherine',
            verifiedAt: new Date(NOW).toISOString(),
          },
        ],
      },
    ]);

    const forged = await authority(
      new Request('https://os.consuelohq.com/internal/install-control-plane/users', {
        method: 'POST',
        headers: {
          'x-consuelo-user-directory-assertion': userDirectoryAssertion({
            ...payload,
            user_id: 'google:legacy-sub',
          }),
        },
      }),
    );
    expect(forged.status).toBe(400);
  });
});
