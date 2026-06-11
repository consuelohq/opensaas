import { createWorkspaceCloudflareD1RouteRegistry } from '../../../scripts/lib/workspace-cloudflare-d1-route-registry';
import { createWorkspaceCloudflareEdgeRouter } from '../../../scripts/lib/workspace-cloudflare-edge-router';

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  first: <T = unknown>(columnName?: string) => Promise<T | null>;
  run: () => Promise<unknown>;
};

type D1Database = {
  prepare: (sql: string) => D1PreparedStatement;
};

type WorkspaceEdgeEnvironment = {
  WORKSPACE_ROUTE_REGISTRY: D1Database;
  CONSUELO_EDGE_SIGNING_SECRET: string;
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
    return new Response('workspace edge routing failed closed', { status: 500 });
  }
}

export default { fetch };
