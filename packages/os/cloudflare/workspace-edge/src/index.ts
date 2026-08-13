import {
  createWorkspaceCloudflareD1RouteRegistry,
  type WorkspaceRouteD1Database,
} from '../../../scripts/lib/workspace-cloudflare-d1-route-registry';
import {
  createWorkspaceCloudflareEdgeRouter,
  type WorkspaceSitesEdgeR2Bucket,
} from '../../../scripts/lib/workspace-cloudflare-edge-router';
import {
  createInstallControlPlaneService,
  type InstallControlPlaneDeviceSource,
  type InstallControlPlaneService,
} from '../../../scripts/lib/install-control-plane';
import {
  createCloudflareD1InstallControlPlaneRepository,
  type InstallControlPlaneD1Database,
} from '../../../scripts/lib/install-control-plane-d1';
import {
  INSTALL_INTERNAL_DASHBOARD_HOST,
  createCloudflareAccessDashboardAuthorizer,
  createInstallDashboardApiHandler,
  type InstallDashboardAuthorizer,
} from '../../../scripts/lib/install-control-plane-http';
import { INSTALL_DASHBOARD_API_PREFIX } from '../../../scripts/lib/install-telemetry-contract';

type WorkspaceEdgeLogContext = {
  component: 'workspace-edge';
  hostname: string;
  path: string;
  error: string;
  stack?: string;
};

type WorkspaceEdgeLogger = {
  error: (message: string, context: WorkspaceEdgeLogContext) => void;
};

type AuthorityStub = {
  fetch(request: Request): Promise<Response>;
};

type AuthorityNamespace = {
  idFromName(name: string): unknown;
  get(id: unknown): AuthorityStub;
};

export type WorkspaceEdgeEnvironment = {
  WORKSPACE_ROUTE_REGISTRY: WorkspaceRouteD1Database;
  CONSUELO_EDGE_SIGNING_SECRET: string;
  WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET?: string;
  OS_DEVICE_AUTHORITY?: AuthorityNamespace;
  SITES_SNAPSHOTS?: WorkspaceSitesEdgeR2Bucket;
  WORKSPACE_EDGE_LOGGER?: WorkspaceEdgeLogger;
  OS_INTERNAL_DASHBOARD_ACCESS_TEAM_DOMAIN?: string;
  OS_INTERNAL_DASHBOARD_ACCESS_AUD?: string;
  OS_INTERNAL_DASHBOARD_ALLOWED_EMAILS?: string;
};

export type WorkspaceEdgeHandlerOptions = {
  fetchUpstream?: (request: Request) => Promise<Response>;
  now?: () => number;
  createNonce?: () => string;
  internalDashboardService?: InstallControlPlaneService;
  authorizeInternalDashboard?: InstallDashboardAuthorizer;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const errorStack = (error: unknown): string | undefined =>
  error instanceof Error ? error.stack : undefined;

const reportWorkspaceEdgeError = (input: {
  logger?: WorkspaceEdgeLogger;
  request: Request;
  error: unknown;
}): void => {
  const url = new URL(input.request.url);

  input.logger?.error('[WorkspaceEdge] routing failed closed', {
    component: 'workspace-edge',
    hostname: url.hostname,
    path: url.pathname,
    error: errorMessage(input.error),
    stack: errorStack(input.error),
  });
};

function authorityStub(
  env: WorkspaceEdgeEnvironment,
): AuthorityStub | undefined {
  const namespace = env.OS_DEVICE_AUTHORITY;
  return namespace?.get(namespace.idFromName('global'));
}

function internalDashboardAllowedEmails(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function createAuthorityInstallDeviceSource(input: {
  stub?: AuthorityStub;
  internalAuthSecret?: string;
}): InstallControlPlaneDeviceSource {
  return {
    async listDevices() {
      try {
        const secret = input.internalAuthSecret?.trim();
        if (!input.stub || !secret) {
          throw new Error('install device directory is unavailable');
        }
        const response = await input.stub.fetch(
          new Request('https://os.consuelohq.com/internal/install-control-plane/devices', {
            method: 'GET',
            headers: {
              accept: 'application/json',
              'x-consuelo-internal-auth-secret': secret,
            },
          }),
        );
        if (!response.ok) throw new Error('install device directory request failed');
        const body = (await response.json()) as { devices?: unknown };
        if (!Array.isArray(body.devices)) {
          throw new Error('install device directory response is invalid');
        }
        return body.devices as Awaited<ReturnType<InstallControlPlaneDeviceSource['listDevices']>>;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`install device directory read failed: ${message}`);
      }
    },
  };
}

function closedAuthResponse(): Response {
  return new Response(JSON.stringify({ error: 'workspace_auth_unavailable' }), {
    status: 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

const NODE_CONTROL_PATHS = new Map<string, { authorityPath: string; method: 'GET' | 'POST' }>([
  ['/gateway/nodes/snapshot', { authorityPath: '/internal/workspace/nodes', method: 'GET' }],
  ['/gateway/nodes/default', { authorityPath: '/internal/workspace/nodes/default', method: 'POST' }],
  ['/gateway/nodes/pricing', { authorityPath: '/internal/workspace/nodes/pricing', method: 'GET' }],
]);

async function proxyNodeControlRequest(input: {
  request: Request;
  stub: AuthorityStub;
  internalAuthSecret: string;
}): Promise<Response | undefined> {
  try {
    const incoming = new URL(input.request.url);
    const route = NODE_CONTROL_PATHS.get(incoming.pathname);
    if (!route) return undefined;
    if (input.request.method !== route.method) {
      return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
        status: 405,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          allow: route.method,
        },
      });
    }
    const target = new URL('https://os.consuelohq.com' + route.authorityPath);
    target.search = incoming.search;
    const headers = new Headers({
      'x-consuelo-internal-auth-secret': input.internalAuthSecret,
      'x-consuelo-workspace-host': incoming.hostname.toLowerCase(),
      accept: 'application/json',
    });
    for (const name of ['cookie', 'origin', 'x-consuelo-csrf-token', 'content-type']) {
      const value = input.request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const body = route.method === 'POST' ? await input.request.clone().arrayBuffer() : undefined;
    return input.stub.fetch(
      new Request(target, {
        method: route.method,
        headers,
        ...(body ? { body } : {}),
      }),
    );

  } catch {
    return closedAuthResponse();
  }
}

export function createWorkspaceEdgeHandler(
  env: WorkspaceEdgeEnvironment,
  options: WorkspaceEdgeHandlerOptions = {},
): (request: Request) => Promise<Response> {
  const registry = createWorkspaceCloudflareD1RouteRegistry(
    env.WORKSPACE_ROUTE_REGISTRY,
  );
  const stub = authorityStub(env);
  const now = options.now ?? (() => Date.now());
  const internalDashboardService =
    options.internalDashboardService ??
    (typeof env.WORKSPACE_ROUTE_REGISTRY.prepare === 'function'
      ? createInstallControlPlaneService({
          repository: createCloudflareD1InstallControlPlaneRepository(
            env.WORKSPACE_ROUTE_REGISTRY as unknown as InstallControlPlaneD1Database,
          ),
          devices: createAuthorityInstallDeviceSource({
            stub,
            internalAuthSecret: env.WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET,
          }),
        })
      : undefined);
  const authorizeInternalDashboard =
    options.authorizeInternalDashboard ??
    createCloudflareAccessDashboardAuthorizer({
      teamDomain: env.OS_INTERNAL_DASHBOARD_ACCESS_TEAM_DOMAIN ?? '',
      audience: env.OS_INTERNAL_DASHBOARD_ACCESS_AUD ?? '',
      allowedEmails: internalDashboardAllowedEmails(
        env.OS_INTERNAL_DASHBOARD_ALLOWED_EMAILS,
      ),
      now,
    });
  const internalDashboardHandler = internalDashboardService
    ? createInstallDashboardApiHandler({
        service: internalDashboardService,
        authorize: authorizeInternalDashboard,
        now,
      })
    : undefined;
  const router = createWorkspaceCloudflareEdgeRouter({
    registry,
    internalSigningSecret: env.CONSUELO_EDGE_SIGNING_SECRET,
    nodeSigningMasterSecret: env.WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET,
    siteSnapshots: { r2: env.SITES_SNAPSHOTS },
    ...(options.fetchUpstream ? { fetchUpstream: options.fetchUpstream } : {}),
    ...(options.now ? { now: options.now } : {}),
    ...(options.createNonce ? { createNonce: options.createNonce } : {}),
    reportError: ({ request, error }) =>
      reportWorkspaceEdgeError({
        logger: env.WORKSPACE_EDGE_LOGGER,
        request,
        error,
      }),
    authorizeWorkspaceSession: async ({
      request,
      workspaceId,
      workspaceHost,
    }) => {
      const internalAuthSecret =
        env.WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET?.trim();
      if (!stub || !internalAuthSecret) return false;
      const headers = new Headers({
        'x-consuelo-internal-auth-secret': internalAuthSecret,
        'x-consuelo-workspace-id': workspaceId,
        'x-consuelo-workspace-host': workspaceHost,
      });
      const cookie = request.headers.get('cookie');
      if (cookie) headers.set('cookie', cookie);
      const response = await stub.fetch(
        new Request(
          'https://os.consuelohq.com/internal/auth/session/validate',
          { method: 'POST', headers },
        ),
      );
      return response.status === 204;
    },
  });

  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      if (
        url.hostname.toLowerCase() === INSTALL_INTERNAL_DASHBOARD_HOST &&
        (url.pathname === INSTALL_DASHBOARD_API_PREFIX ||
          url.pathname.startsWith(`${INSTALL_DASHBOARD_API_PREFIX}/`))
      ) {
        if (!internalDashboardHandler) return closedAuthResponse();
        return await internalDashboardHandler(request);
      }
      if (
        (url.pathname === '/auth/consume' && request.method === 'GET') ||
        (url.pathname === '/auth/logout' && request.method === 'POST')
      ) {
        if (!stub) return closedAuthResponse();
        return await stub.fetch(request);
      }
      if (url.pathname.startsWith('/gateway/nodes/')) {
        const internalAuthSecret = env.WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET?.trim();
        if (!stub || !internalAuthSecret) return closedAuthResponse();
        const response = await proxyNodeControlRequest({ request, stub, internalAuthSecret });
        if (response) return response;
      }
      return await router.fetch(request);
    } catch (error: unknown) {
      reportWorkspaceEdgeError({
        logger: env.WORKSPACE_EDGE_LOGGER,
        request,
        error,
      });
      return new Response('workspace edge routing failed closed', {
        status: 500,
      });
    }
  };
}

export async function fetch(
  request: Request,
  env: WorkspaceEdgeEnvironment,
): Promise<Response> {
  return createWorkspaceEdgeHandler(env)(request);
}

// NOTE: Cloudflare's module Worker runtime requires a default export object;
// the named fetch export above is the repository-facing handler contract.
export default { fetch };
