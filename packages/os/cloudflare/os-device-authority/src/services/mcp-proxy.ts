import {
  createWorkspaceCloudflareD1RouteRegistry,
  type WorkspaceRouteD1Resolution,
} from '../../../../scripts/lib/workspace-cloudflare-d1-route-registry';
import { json } from '../http';
import type { Store, WorkspaceRouteRegistryBinding } from '../types';
import { hasGrantedScope, hash } from '../utils';
import { mcpResourceUrl } from './mcp-oauth';
import {
  createWorkspaceEdgeNodeHeaders,
  deriveWorkspaceEdgeNodeSecret,
} from '../../../../scripts/lib/workspace-edge-node-auth';

export function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || undefined;
}

export function centralMcpUnauthorized(origin: string): Response {
  return json(
    { error: 'unauthorized', message: 'OAuth bearer token is required.' },
    {
      status: 401,
      headers: {
        'www-authenticate':
          'Bearer resource_metadata="' +
          new URL('/.well-known/oauth-protected-resource', origin).toString() +
          '"',
      },
    },
  );
}

export function centralMcpSafeError(input: {
  status: number;
  code: string;
  message?: string;
}): Response {
  return json(
    { error: { code: input.code, message: input.message ?? input.code } },
    { status: input.status },
  );
}

export function centralMcpUpstreamUrl(input: {
  tunnelOriginUrl: string;
  inboundUrl: URL;
}): string {
  const upstreamUrl = new URL(input.tunnelOriginUrl);
  const basePath = upstreamUrl.pathname.replace(/\/$/, '');
  upstreamUrl.pathname = basePath + input.inboundUrl.pathname;
  upstreamUrl.search = input.inboundUrl.search;
  return upstreamUrl.toString();
}

export function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

export async function edgeSignature(input: {
  secret: string;
  method: string;
  pathWithSearch: string;
  workspaceId: string;
  surface: string;
  timestamp: string;
  nonce: string;
}): Promise<string> {
  try {
    const canonical = [
      input.method.toUpperCase(),
      input.pathWithSearch,
      input.workspaceId,
      input.surface,
      input.timestamp,
      input.nonce,
    ].join('\n');
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(input.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(canonical),
    );
    return 'sha256=' + hex(new Uint8Array(signature));
  } catch {
    throw new Error('edge request signing failed');
  }
}

export async function centralMcpProxyRequest(input: {
  request: Request;
  resolution: Extract<WorkspaceRouteD1Resolution, { allowed: true }>;
  upstreamUrl: string;
  internalSigningSecret?: string;
}): Promise<Request> {
  try {
    const inboundUrl = new URL(input.request.url);
    const headers = new Headers(input.request.headers);
    headers.delete('x-consuelo-workspace-id');
    headers.delete('x-consuelo-hostname');
    headers.delete('x-consuelo-route');
    headers.delete('x-consuelo-surface');
    headers.delete('x-consuelo-edge-signature');
    headers.delete('x-consuelo-edge-timestamp');
    headers.delete('x-consuelo-edge-nonce');
    headers.delete('x-consuelo-edge-body-digest');
    headers.delete('x-consuelo-edge-auth-version');
    headers.delete('x-consuelo-connector-id');
    headers.delete('x-consuelo-node-id');
    headers.delete('x-consuelo-device-id');

    headers.set('x-consuelo-workspace-id', input.resolution.workspaceId);
    headers.set('x-consuelo-hostname', input.resolution.hostname);
    headers.set('x-consuelo-route', input.resolution.route);
    headers.set('x-consuelo-surface', input.resolution.surface);

    const connectorId =
      input.resolution.target.kind === 'os-connector'
        ? input.resolution.target.connectorId
        : undefined;
    const nodeId = input.resolution.nodeId?.trim() || undefined;
    if (connectorId) {
      headers.set('x-consuelo-connector-id', connectorId);
    }
    if (nodeId) {
      headers.set('x-consuelo-node-id', nodeId);
      headers.set('x-consuelo-device-id', nodeId);
    }

    const internalSigningSecret = input.internalSigningSecret?.trim();
    const pathWithSearch = inboundUrl.pathname + inboundUrl.search;
    const method = input.request.method;
    const canBufferBody = method !== 'GET' && method !== 'HEAD';
    // Buffer the body so we can both sign a body digest (node-scoped edge auth)
    // and forward a reusable request body to the OS connector tunnel.
    const bodyText = canBufferBody ? await input.request.clone().text() : '';

    if (internalSigningSecret && nodeId && connectorId) {
      // Sign with the *node-scoped* secret the local OS gateway already stores from
      // heartbeat. Master-secret signatures never verified on the node, so ChatGPT
      // traffic relied on a second OAuth introspect that failed mid-session.
      const nodeSigningSecret = deriveWorkspaceEdgeNodeSecret({
        masterSecret: internalSigningSecret,
        workspaceId: input.resolution.workspaceId,
        nodeId,
        connectorId,
      });
      const edgeHeaders = createWorkspaceEdgeNodeHeaders({
        signingSecret: nodeSigningSecret,
        workspaceId: input.resolution.workspaceId,
        nodeId,
        connectorId,
        surface: input.resolution.surface,
        method,
        pathWithSearch,
        body: bodyText,
        timestamp: String(Date.now()),
        nonce: crypto.randomUUID(),
      });
      for (const [name, value] of Object.entries(edgeHeaders)) {
        headers.set(name, value);
      }
    } else if (internalSigningSecret) {
      // Legacy fallback when node identity is incomplete.
      const edgeTimestamp = String(Date.now());
      const edgeNonce = crypto.randomUUID();
      headers.set('x-consuelo-edge-timestamp', edgeTimestamp);
      headers.set('x-consuelo-edge-nonce', edgeNonce);
      headers.set(
        'x-consuelo-edge-signature',
        await edgeSignature({
          secret: internalSigningSecret,
          method,
          pathWithSearch,
          workspaceId: input.resolution.workspaceId,
          surface: input.resolution.surface,
          timestamp: edgeTimestamp,
          nonce: edgeNonce,
        }),
      );
    }

    const init: RequestInit & { duplex?: 'half' } = {
      headers,
      method,
    };

    if (canBufferBody) {
      init.body = bodyText;
    }

    return new Request(input.upstreamUrl, init);
  } catch (error: unknown) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'central MCP proxy request failed',
    );
  }
}

export async function proxyCentralMcpRequest(input: {
  request: Request;
  store: Store;
  origin: string;
  nowMs: number;
  routeRegistry?: WorkspaceRouteRegistryBinding;
  internalSigningSecret?: string;
  fetchImpl: typeof fetch;
}): Promise<Response> {
  try {
    const token = bearerToken(input.request);
    if (!token) return centralMcpUnauthorized(input.origin);

    const stored = await input.store.byMcpOAuthAccessToken(await hash(token));
    if (
      !stored ||
      input.nowMs >= stored.expiresAt ||
      stored.resource !== mcpResourceUrl(input.origin)
    ) {
      return centralMcpUnauthorized(input.origin);
    }
    if (!hasGrantedScope(stored.scopes, 'route:/mcp:read')) {
      return centralMcpSafeError({
        status: 403,
        code: 'MISSING_SCOPE',
        message: 'OAuth token does not grant MCP route access.',
      });
    }
    if (!input.routeRegistry) {
      return centralMcpSafeError({
        status: 503,
        code: 'WORKSPACE_ROUTE_REGISTRY_UNAVAILABLE',
      });
    }

    const inboundUrl = new URL(input.request.url);
    const requestedNodeId =
      input.request.headers.get('x-consuelo-node-id')?.trim() || undefined;
    const resolution = await createWorkspaceCloudflareD1RouteRegistry(
      input.routeRegistry,
    ).resolve({
      host: stored.workspaceHost,
      path: inboundUrl.pathname,
      method: input.request.method,
      ...(requestedNodeId ? { nodeId: requestedNodeId } : {}),
      nowMs: input.nowMs,
    });
    if (resolution.allowed === false) {
      return centralMcpSafeError({
        status: resolution.status,
        code: resolution.errorCode,
        message: resolution.diagnostic?.message,
      });
    }
    if (resolution.target.kind !== 'os-connector') {
      return centralMcpSafeError({
        status: 404,
        code: 'WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND',
      });
    }

    const proxyRequest = await centralMcpProxyRequest({
      request: input.request,
      resolution,
      upstreamUrl: centralMcpUpstreamUrl({
        tunnelOriginUrl: resolution.target.tunnelOriginUrl,
        inboundUrl,
      }),
      internalSigningSecret: input.internalSigningSecret,
    });

    return await input.fetchImpl(proxyRequest);
  } catch {
    return centralMcpSafeError({
      status: 500,
      code: 'CENTRAL_MCP_PROXY_FAILED',
    });
  }
}
