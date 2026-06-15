import {
  createWorkspaceCloudflareD1RouteRegistry,
  type WorkspaceRouteD1Database,
} from '../../../scripts/lib/workspace-cloudflare-d1-route-registry';
import {
  createWorkspaceCloudflareEdgeRouter,
  type WorkspaceSitesEdgeR2Bucket,
} from '../../../scripts/lib/workspace-cloudflare-edge-router';
import {
  createWorkspaceMcpApprovedConnectorBindingStore,
  createWorkspaceMcpConnectionAuthHandler,
  createWorkspaceMcpConnectionCredentialStore,
  type WorkspaceMcpConnectionCredentialKv,
} from '../../../scripts/lib/workspace-mcp-connection-auth';

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
  MCP_CONNECTION_CREDENTIALS?: WorkspaceMcpConnectionCredentialKv;
  MCP_CONNECTION_STATES?: WorkspaceMcpConnectionCredentialKv;
  MCP_APPROVED_CONNECTOR_BINDINGS?: WorkspaceMcpConnectionCredentialKv;
  MCP_GOOGLE_OAUTH_CLIENT_ID?: string;
  MCP_GOOGLE_OAUTH_CLIENT_SECRET?: string;
  MCP_ALLOWED_PROVIDER_CIDRS?: string;
  SITES_SNAPSHOTS?: WorkspaceSitesEdgeR2Bucket;
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

const cidrsFromEnv = (value: string | undefined): string[] =>
  (value ?? '')
    .split(/[\s,]+/)
    .map((cidr) => cidr.trim())
    .filter((cidr) => cidr.length > 0);

export async function fetch(
  request: Request,
  env: WorkspaceEdgeEnvironment,
): Promise<Response> {
  try {
    const registry = createWorkspaceCloudflareD1RouteRegistry(
      env.WORKSPACE_ROUTE_REGISTRY,
    );
    const mcpConnectionCredentials = env.MCP_CONNECTION_CREDENTIALS
      ? createWorkspaceMcpConnectionCredentialStore({
          kv: env.MCP_CONNECTION_CREDENTIALS,
        })
      : undefined;
    const mcpConnectionAuth = mcpConnectionCredentials &&
      env.MCP_CONNECTION_STATES &&
      env.MCP_APPROVED_CONNECTOR_BINDINGS &&
      env.MCP_GOOGLE_OAUTH_CLIENT_ID &&
      env.MCP_GOOGLE_OAUTH_CLIENT_SECRET
      ? createWorkspaceMcpConnectionAuthHandler({
          approvedBindings: createWorkspaceMcpApprovedConnectorBindingStore({
            kv: env.MCP_APPROVED_CONNECTOR_BINDINGS,
          }),
          credentials: mcpConnectionCredentials,
          oauthStateKv: env.MCP_CONNECTION_STATES,
          googleOAuthClientId: env.MCP_GOOGLE_OAUTH_CLIENT_ID,
          googleOAuthClientSecret: env.MCP_GOOGLE_OAUTH_CLIENT_SECRET,
        })
      : undefined;
    const router = createWorkspaceCloudflareEdgeRouter({
      registry,
      internalSigningSecret: env.CONSUELO_EDGE_SIGNING_SECRET,
      ...(mcpConnectionCredentials ? { mcpConnectionCredentials } : {}),
      ...(mcpConnectionAuth ? { mcpConnectionAuth } : {}),
      ...(env.MCP_ALLOWED_PROVIDER_CIDRS
        ? { mcpProviderNetwork: { allowedCidrs: cidrsFromEnv(env.MCP_ALLOWED_PROVIDER_CIDRS) } }
        : {}),
      siteSnapshots: { r2: env.SITES_SNAPSHOTS },
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
