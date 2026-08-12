import {
  createWorkspaceCloudflareD1RouteRegistry,
  type WorkspaceRouteD1Resolution,
} from '../../../../scripts/lib/workspace-cloudflare-d1-route-registry';
import { resolveCentralMcpFacadeScope } from '../../../../scripts/lib/tool-scope-authorization';
import {
  encodeMcpNodeRoutingContext,
  inspectMcpNodeRoutingBody,
  normalizeMcpTaskSession,
  MCP_NODE_CONTEXT_HEADER,
  MCP_ROUTE_SOURCE_HEADER,
  type McpNodeRoutingContext,
  type McpNodeRouteSource,
} from '../../../../scripts/lib/mcp-node-routing';
import { json } from '../http';
import type {
  DeviceAuthorityLogger,
  Store,
  WorkspaceRouteRegistryBinding,
} from '../types';
import { hasGrantedScope, hash } from '../utils';
import { mcpResourceUrl } from './mcp-oauth';
import { workspaceDefaultNodeId, workspaceNodePresence } from './nodes';

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

export async function centralMcpOperationScope(request: Request): Promise<string | null> {
  if (request.method !== 'POST') return null;
  let payload: unknown;
  try {
    payload = await request.clone().json();
  } catch {
    return 'mcp:call';
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'mcp:call';
  }
  const record = payload as Record<string, unknown>;
  if (record.method !== 'tools/call') return null;
  const requestParams = record.params;
  if (
    !requestParams ||
    typeof requestParams !== 'object' ||
    Array.isArray(requestParams)
  ) {
    return 'mcp:call';
  }
  const params = requestParams as Record<string, unknown>;
  if (params.name === 'get_steering') return 'route:/mcp:read';
  if (params.name !== 'call') return 'mcp:call';
  const args = params.arguments;
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return 'mcp:call';
  }
  const facadeArgs = args as Record<string, unknown>;
  const toolName = facadeArgs.tool;
  return typeof toolName === 'string' && toolName.trim()
    ? resolveCentralMcpFacadeScope(toolName, facadeArgs.input)
    : 'mcp:call';
}

type CentralMcpFacadeOutcome = {
  ok: boolean;
  taskSession?: string;
};

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function centralMcpFacadeOutcome(response: Response): Promise<CentralMcpFacadeOutcome> {
  if (!response.ok) return { ok: false };
  try {
    const envelope = await response.clone().json() as unknown;
    if (!isJsonObject(envelope) || 'error' in envelope) return { ok: false };
    const result = envelope.result;
    if (!isJsonObject(result) || result.isError === true || !Array.isArray(result.content)) {
      return { ok: false };
    }
    const textItem = result.content.find(
      (item) => isJsonObject(item) && item.type === 'text' && typeof item.text === 'string',
    );
    if (!isJsonObject(textItem) || typeof textItem.text !== 'string') return { ok: false };
    const facade = JSON.parse(textItem.text) as unknown;
    if (!isJsonObject(facade) || facade.ok !== true) return { ok: false };
    const data = facade.data;
    const taskSession = isJsonObject(data)
      ? normalizeMcpTaskSession(data.taskSession)
      : undefined;
    return {
      ok: true,
      ...(taskSession ? { taskSession } : {}),
    };
  } catch {
    return { ok: false };
  }
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
  routeSource?: McpNodeRouteSource;
  nodeRoutingContext?: McpNodeRoutingContext;
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
    headers.delete('x-consuelo-connector-id');
    headers.delete('x-consuelo-node-id');
    headers.delete(MCP_NODE_CONTEXT_HEADER);
    headers.delete(MCP_ROUTE_SOURCE_HEADER);

    headers.set('x-consuelo-workspace-id', input.resolution.workspaceId);
    headers.set('x-consuelo-hostname', input.resolution.hostname);
    headers.set('x-consuelo-route', input.resolution.route);
    headers.set('x-consuelo-surface', input.resolution.surface);

    if (input.resolution.target.kind === 'os-connector') {
      headers.set(
        'x-consuelo-connector-id',
        input.resolution.target.connectorId,
      );
      if (input.resolution.nodeId) {
        headers.set('x-consuelo-node-id', input.resolution.nodeId);
      }
    }
    if (input.routeSource) headers.set(MCP_ROUTE_SOURCE_HEADER, input.routeSource);
    if (input.nodeRoutingContext) {
      headers.set(
        MCP_NODE_CONTEXT_HEADER,
        encodeMcpNodeRoutingContext(input.nodeRoutingContext),
      );
    }

    const internalSigningSecret = input.internalSigningSecret?.trim();
    if (internalSigningSecret) {
      const edgeTimestamp = String(Date.now());
      const edgeNonce = crypto.randomUUID();
      headers.set('x-consuelo-edge-timestamp', edgeTimestamp);
      headers.set('x-consuelo-edge-nonce', edgeNonce);
      headers.set(
        'x-consuelo-edge-signature',
        await edgeSignature({
          secret: internalSigningSecret,
          method: input.request.method,
          pathWithSearch: inboundUrl.pathname + inboundUrl.search,
          workspaceId: input.resolution.workspaceId,
          surface: input.resolution.surface,
          timestamp: edgeTimestamp,
          nonce: edgeNonce,
        }),
      );
    }

    const init: RequestInit & { duplex?: 'half' } = {
      headers,
      method: input.request.method,
    };

    if (input.request.method !== 'GET' && input.request.method !== 'HEAD') {
      init.body = input.request.body;
      init.duplex = 'half';
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

async function centralMcpNodeRoutingContext(input: {
  store: Store;
  accountId: string;
  workspaceId: string;
  workspaceHost: string;
  currentNodeId: string;
  routeSource: McpNodeRouteSource;
  nowMs: number;
  operationalLogger?: DeviceAuthorityLogger;
}): Promise<McpNodeRoutingContext | undefined> {
  try {
    const workspace = await input.store.byAccountWorkspace(input.accountId);
    if (!workspace || workspace.workspaceHost !== input.workspaceHost) return undefined;
    const defaultNodeId = workspaceDefaultNodeId(workspace);
    const nodes = (await input.store.listWorkspaceNodes(input.accountId))
      .filter(
        (node) =>
          node.workspaceHost === input.workspaceHost &&
          (node.state ?? 'active') !== 'revoked',
      )
      .sort((left, right) => {
        const leftPriority = left.nodeId === input.currentNodeId
          ? 0
          : left.nodeId === defaultNodeId
            ? 1
            : 2;
        const rightPriority = right.nodeId === input.currentNodeId
          ? 0
          : right.nodeId === defaultNodeId
            ? 1
            : 2;
        return leftPriority - rightPriority || left.createdAt - right.createdAt;
      })
      .slice(0, 32)
      .map((node) => ({
        nodeId: node.nodeId,
        displayName: (node.displayName ?? node.nodeName).trim().slice(0, 120),
        role: node.role,
        platform: (node.platform ?? 'unknown').trim().slice(0, 40),
        presence: workspaceNodePresence(node, input.nowMs),
        state: (node.state ?? 'active').trim().slice(0, 40),
      }));
    return {
      version: 1,
      workspaceId: input.workspaceId,
      currentNodeId: input.currentNodeId,
      ...(defaultNodeId ? { defaultNodeId } : {}),
      routeSource: input.routeSource,
      nodes,
    };
  } catch (error: unknown) {
    try {
      input.operationalLogger?.warn(
        '[OsDeviceAuthority] MCP node directory unavailable',
        {
          component: 'os-device-authority',
          operation: 'mcp-node-directory',
          accountId: input.accountId,
          workspaceId: input.workspaceId,
          workspaceHost: input.workspaceHost,
          failure: error instanceof Error ? error.name : 'UnknownError',
        },
      );
    } catch {
      // Logging must never turn the steering directory's fail-open path into a request failure.
    }
    return undefined;
  }
}

export async function proxyCentralMcpRequest(input: {
  request: Request;
  store: Store;
  origin: string;
  nowMs: number;
  routeRegistry?: WorkspaceRouteRegistryBinding;
  internalSigningSecret?: string;
  operationalLogger?: DeviceAuthorityLogger;
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
    const operationScope = await centralMcpOperationScope(input.request);
    if (operationScope && !hasGrantedScope(stored.scopes, operationScope)) {
      return centralMcpSafeError({
        status: 403,
        code: 'MISSING_SCOPE',
        message: 'OAuth token does not grant the requested MCP operation.',
      });
    }
    if (!input.routeRegistry) {
      return centralMcpSafeError({
        status: 503,
        code: 'WORKSPACE_ROUTE_REGISTRY_UNAVAILABLE',
      });
    }

    const inboundUrl = new URL(input.request.url);
    const routingInspection = inspectMcpNodeRoutingBody(
      input.request.method === 'POST' ? await input.request.clone().text() : '',
    );
    if (!routingInspection.ok) {
      return centralMcpSafeError({
        status: 400,
        code: routingInspection.code,
        message: routingInspection.message,
      });
    }
    const headerNodeId =
      input.request.headers.get('x-consuelo-node-id')?.trim() || undefined;
    if (
      routingInspection.nodeId &&
      headerNodeId &&
      routingInspection.nodeId !== headerNodeId
    ) {
      return centralMcpSafeError({
        status: 400,
        code: 'NODE_ROUTE_MISMATCH',
        message: 'MCP body nodeId does not match the explicit node routing header.',
      });
    }
    const requestedNodeId = routingInspection.nodeId ?? headerNodeId;
    const taskAffinity = routingInspection.taskSession
      ? await input.store.byWorkspaceTaskAffinity({
          accountId: stored.accountId,
          workspaceHost: stored.workspaceHost,
          taskSession: routingInspection.taskSession,
        })
      : undefined;
    if (
      taskAffinity &&
      requestedNodeId &&
      requestedNodeId !== taskAffinity.ownerNodeId
    ) {
      return centralMcpSafeError({
        status: 409,
        code: 'TASK_NODE_MISMATCH',
        message: 'The requested node does not own this task session.',
      });
    }
    const resolvedNodeId = taskAffinity?.ownerNodeId ?? requestedNodeId;
    const routeSource: McpNodeRouteSource = taskAffinity
      ? 'task'
      : requestedNodeId
        ? 'explicit'
        : 'default';
    const resolution = await createWorkspaceCloudflareD1RouteRegistry(
      input.routeRegistry,
    ).resolve({
      host: stored.workspaceHost,
      path: inboundUrl.pathname,
      method: input.request.method,
      ...(resolvedNodeId ? { nodeId: resolvedNodeId } : {}),
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

    if (
      taskAffinity?.workspaceId &&
      taskAffinity.workspaceId !== resolution.workspaceId
    ) {
      return centralMcpSafeError({
        status: 409,
        code: 'TASK_WORKSPACE_MISMATCH',
        message: 'Task affinity does not belong to the resolved workspace.',
      });
    }

    const nodeRoutingContext = routingInspection.getSteering && resolution.nodeId
      ? await centralMcpNodeRoutingContext({
          store: input.store,
          accountId: stored.accountId,
          workspaceId: resolution.workspaceId,
          workspaceHost: stored.workspaceHost,
          currentNodeId: resolution.nodeId,
          routeSource,
          nowMs: input.nowMs,
          operationalLogger: input.operationalLogger,
        })
      : undefined;

    const proxyRequest = await centralMcpProxyRequest({
      request: input.request,
      resolution,
      upstreamUrl: centralMcpUpstreamUrl({
        tunnelOriginUrl: resolution.target.tunnelOriginUrl,
        inboundUrl,
      }),
      routeSource,
      nodeRoutingContext,
      internalSigningSecret: input.internalSigningSecret,
    });

    const upstreamResponse = await input.fetchImpl(proxyRequest);
    if (
      resolution.nodeId &&
      routingInspection.facadeTool &&
      input.request.method === 'POST'
    ) {
      const outcome = await centralMcpFacadeOutcome(upstreamResponse);
      if (outcome.ok) {
        const taskSession = routingInspection.facadeTool === 'task.start'
          ? outcome.taskSession
          : routingInspection.taskSession;
        if (taskSession && routingInspection.facadeTool === 'task.finish') {
          await input.store.releaseWorkspaceTaskAffinity({
            accountId: stored.accountId,
            workspaceHost: stored.workspaceHost,
            taskSession,
            ownerNodeId: resolution.nodeId,
          });
        } else if (taskSession && (!taskAffinity || routingInspection.facadeTool === 'task.start')) {
          const claimed = await input.store.claimWorkspaceTaskAffinity({
            accountId: stored.accountId,
            workspaceId: resolution.workspaceId,
            workspaceHost: stored.workspaceHost,
            taskSession,
            ownerNodeId: resolution.nodeId,
            createdAt: input.nowMs,
            updatedAt: input.nowMs,
          });
          if (claimed.status === 'conflict') {
            return centralMcpSafeError({
              status: 409,
              code: 'TASK_AFFINITY_CONFLICT',
              message: 'Task session is already owned by another node.',
            });
          }
        }
      }
    }

    return upstreamResponse;
  } catch {
    return centralMcpSafeError({
      status: 500,
      code: 'CENTRAL_MCP_PROXY_FAILED',
    });
  }
}
