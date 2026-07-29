import {
  createWorkspaceCloudflareD1RouteRegistry,
  type WorkspaceRouteD1Database,
} from '../../../scripts/lib/workspace-cloudflare-d1-route-registry';
import {
  createWorkspaceCloudflareEdgeRouter,
  type WorkspaceSitesEdgeR2Bucket,
} from '../../../scripts/lib/workspace-cloudflare-edge-router';

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
};

export type WorkspaceEdgeHandlerOptions = {
  fetchUpstream?: (request: Request) => Promise<Response>;
  now?: () => number;
  createNonce?: () => string;
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

export function createWorkspaceEdgeHandler(
  env: WorkspaceEdgeEnvironment,
  options: WorkspaceEdgeHandlerOptions = {},
): (request: Request) => Promise<Response> {
  const registry = createWorkspaceCloudflareD1RouteRegistry(
    env.WORKSPACE_ROUTE_REGISTRY,
  );
  const stub = authorityStub(env);
  const router = createWorkspaceCloudflareEdgeRouter({
    registry,
    internalSigningSecret: env.CONSUELO_EDGE_SIGNING_SECRET,
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
        (url.pathname === '/auth/consume' && request.method === 'GET') ||
        (url.pathname === '/auth/logout' && request.method === 'POST')
      ) {
        if (!stub) return closedAuthResponse();
        return await stub.fetch(request);
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
