import {
  createWorkspaceCloudflareD1RouteRegistry,
  type WorkspaceRouteD1Database,
} from '../../../scripts/lib/workspace-cloudflare-d1-route-registry';
import { createWorkspaceCloudflareEdgeRouter } from '../../../scripts/lib/workspace-cloudflare-edge-router';

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

type WorkspaceEdgeEnvironment = {
  WORKSPACE_ROUTE_REGISTRY: WorkspaceRouteD1Database;
  CONSUELO_EDGE_SIGNING_SECRET: string;
  WORKSPACE_EDGE_LOGGER?: WorkspaceEdgeLogger;
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

export async function fetch(
  request: Request,
  env: WorkspaceEdgeEnvironment,
): Promise<Response> {
  try {
    const registry = createWorkspaceCloudflareD1RouteRegistry(
      env.WORKSPACE_ROUTE_REGISTRY,
    );
    const router = createWorkspaceCloudflareEdgeRouter({
      registry,
      internalSigningSecret: env.CONSUELO_EDGE_SIGNING_SECRET,
    });

    return await router.fetch(request);
  } catch (error: unknown) {
    reportWorkspaceEdgeError({
      logger: env.WORKSPACE_EDGE_LOGGER,
      request,
      error,
    });
    return new Response('workspace edge routing failed closed', { status: 500 });
  }
}

// NOTE: Cloudflare's module Worker runtime requires a default export object;
// the named fetch export above is the repository-facing handler contract.
export default { fetch };
