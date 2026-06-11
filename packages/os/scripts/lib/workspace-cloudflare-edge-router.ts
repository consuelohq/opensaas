import { createHmac } from 'node:crypto';

export type WorkspaceCloudflareEdgeRouteTarget =
  | {
      kind: 'service-upstream';
      service: 'dialer' | 'app' | 'sites' | 'twenty';
      upstreamUrl: string;
    }
  | {
      kind: 'os-connector';
      connectorId: string;
      connectorStatus: 'connected' | 'disconnected';
      tunnelOriginUrl: string;
    };

export type WorkspaceCloudflareEdgeRouteResolution =
  | {
      allowed: true;
      workspaceId: string;
      hostname: string;
      route: string;
      surface: 'os' | 'dialer' | 'app' | 'sites' | 'twenty';
      auth: 'required';
      auditEvent: 'workspace.hostname.route.allowed';
      target: WorkspaceCloudflareEdgeRouteTarget;
    }
  | {
      allowed: false;
      status: 404 | 503;
      errorCode: string;
      auditEvent: 'workspace.hostname.route.denied';
    };

export type WorkspaceCloudflareEdgeRouteRegistry = {
  resolve: (input: {
    host: string;
    path: string;
    method: string;
  }) => Promise<WorkspaceCloudflareEdgeRouteResolution>;
};

export type WorkspaceCloudflareEdgeRouter = {
  fetch: (request: Request) => Promise<Response>;
};

export type WorkspaceCloudflareEdgeRouterInput = {
  registry: WorkspaceCloudflareEdgeRouteRegistry;
  internalSigningSecret?: string;
  fetchUpstream?: (request: Request) => Promise<Response>;
};

const SAFE_ERROR_MESSAGES: Record<string, string> = {
  WORKSPACE_HOSTNAME_NOT_FOUND: 'Workspace hostname was not found',
  WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND: 'Workspace route was not found',
  WORKSPACE_HOSTNAME_OS_CONNECTOR_OFFLINE: 'Workspace route is temporarily unavailable',
  WORKSPACE_EDGE_ROUTER_ERROR: 'Workspace route is temporarily unavailable',
  WORKSPACE_EDGE_AUTH_REQUIRED: 'Workspace route is temporarily unavailable',
};

const createSafeErrorResponse = (input: {
  status: 404 | 503;
  code: string;
}): Response => {
  const message = SAFE_ERROR_MESSAGES[input.code] ?? 'Workspace route denied';

  return Response.json(
    {
      error: {
        code: input.code,
        message,
      },
    },
    {
      status: input.status,
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
};

const buildUpstreamUrl = (input: {
  upstreamBaseUrl: string;
  inboundUrl: URL;
}): string => {
  const upstreamUrl = new URL(input.upstreamBaseUrl);
  const basePath = upstreamUrl.pathname.replace(/\/$/, '');
  upstreamUrl.pathname = `${basePath}${input.inboundUrl.pathname}`;
  upstreamUrl.search = input.inboundUrl.search;

  return upstreamUrl.toString();
};

const signEdgeRequest = (input: {
  secret: string;
  method: string;
  pathWithSearch: string;
  workspaceId: string;
  surface: string;
}): string => {
  const canonical = [
    input.method.toUpperCase(),
    input.pathWithSearch,
    input.workspaceId,
    input.surface,
  ].join('\n');

  return `sha256=${createHmac('sha256', input.secret)
    .update(canonical)
    .digest('hex')}`;
};

const buildProxyRequest = (input: {
  request: Request;
  resolution: Extract<WorkspaceCloudflareEdgeRouteResolution, { allowed: true }>;
  upstreamUrl: string;
  internalSigningSecret: string;
}): Request => {
  const inboundUrl = new URL(input.request.url);
  const headers = new Headers(input.request.headers);
  headers.delete('x-consuelo-workspace-id');
  headers.delete('x-consuelo-hostname');
  headers.delete('x-consuelo-route');
  headers.delete('x-consuelo-surface');
  headers.delete('x-consuelo-edge-signature');

  headers.delete('x-consuelo-connector-id');


  headers.set('x-consuelo-workspace-id', input.resolution.workspaceId);
  headers.set('x-consuelo-hostname', input.resolution.hostname);
  headers.set('x-consuelo-route', input.resolution.route);
  headers.set('x-consuelo-surface', input.resolution.surface);

  if (input.resolution.target.kind === 'os-connector') {
    headers.set('x-consuelo-connector-id', input.resolution.target.connectorId);
  }

  headers.set(
    'x-consuelo-edge-signature',
    signEdgeRequest({
      secret: input.internalSigningSecret,
      method: input.request.method,
      pathWithSearch: `${inboundUrl.pathname}${inboundUrl.search}`,
      workspaceId: input.resolution.workspaceId,
      surface: input.resolution.surface,
    }),
  );

  const init: RequestInit & { duplex?: 'half' } = {
    headers,
    method: input.request.method,
  };

  if (input.request.method !== 'GET' && input.request.method !== 'HEAD') {
    init.body = input.request.body;
    init.duplex = 'half';
  }

  return new Request(input.upstreamUrl, init);
};

export const createWorkspaceCloudflareEdgeRouter = (
  input: WorkspaceCloudflareEdgeRouterInput,
): WorkspaceCloudflareEdgeRouter => {
  const fetchUpstream = input.fetchUpstream ?? globalThis.fetch;

  return {
    async fetch(request: Request): Promise<Response> {
      try {
        const inboundUrl = new URL(request.url);
        const resolution = await input.registry.resolve({
          host: inboundUrl.hostname,
          path: inboundUrl.pathname,
          method: request.method,
        });

        if (!resolution.allowed) {
          return createSafeErrorResponse({
            status: resolution.status,
            code: resolution.errorCode,
          });
        }

        // Fail closed with offline 503 for stale connector status from alternate registries.
        if (
          resolution.target.kind === 'os-connector' &&
          resolution.target.connectorStatus !== 'connected'
        ) {
          return createSafeErrorResponse({
            status: 503,
            code: 'WORKSPACE_HOSTNAME_OS_CONNECTOR_OFFLINE',
          });
        }

        const internalSigningSecret = input.internalSigningSecret?.trim();

        if (!internalSigningSecret) {
          return createSafeErrorResponse({
            status: 503,
            code: 'WORKSPACE_EDGE_AUTH_REQUIRED',
          });
        }

        const upstreamBaseUrl =
          resolution.target.kind === 'service-upstream'
            ? resolution.target.upstreamUrl
            : resolution.target.tunnelOriginUrl;
        const upstreamUrl = buildUpstreamUrl({ upstreamBaseUrl, inboundUrl });
        const proxyRequest = buildProxyRequest({
          request,
          resolution,
          upstreamUrl,
          internalSigningSecret,
        });

        return await fetchUpstream(proxyRequest);
      } catch (error: unknown) {
        return createSafeErrorResponse({
          status: 503,
          code: 'WORKSPACE_EDGE_ROUTER_ERROR',
        });
      }
    },
  };
};
