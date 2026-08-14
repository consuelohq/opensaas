import type { Hono } from 'hono';

import {
  setDefaultWorkspaceNodeInD1,
  updateWorkspaceNodeTargetInD1,
} from '../../../../scripts/lib/workspace-cloudflare-d1-route-registry';
import { deriveWorkspaceEdgeNodeSecret } from '../../../../scripts/lib/workspace-edge-node-auth';
import { json } from '../http';
import { normalizeWorkspaceAgentNames } from '../services/agents';
import { reconcileWorkspaceRouteState } from '../services/connectors';
import {
  safeWorkspaceNode,
  WORKSPACE_NODE_HEARTBEAT_TTL_MS,
  WORKSPACE_NODE_SIGNATURE_MAX_AGE_MS,
  workspaceDefaultNodeId,
  workspaceNodeId,
  workspaceNodeListPayload,
} from '../services/nodes';
import type {
  AccountWorkspace,
  DeviceAuthorityRuntime,
  McpOAuthAccessToken,
  WorkspaceNode,
} from '../types';
import { b64Decode, hasGrantedScope, hash } from '../utils';
import { bearerToken } from '../services/mcp-proxy';
import { authenticateInternalWorkspaceSession } from './web-auth';
import { buildManagedCloudPublicCatalog } from '../services/managed-cloud-pricing';

const jsonHeaders = { 'cache-control': 'no-store' } as const;

function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return json({ error: { code, message } }, { status, headers: jsonHeaders });
}

function serviceUnavailableResponse(): Response {
  return errorResponse(
    503,
    'WORKSPACE_NODE_SERVICE_UNAVAILABLE',
    'Workspace node state is temporarily unavailable.',
  );
}

async function readJsonObject(request: Request): Promise<Record<string, unknown> | undefined> {
  try {
    if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
      return undefined;
    }
    const value = await request.json();
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

async function authenticateWorkspaceMember(
  request: Request,
  runtime: DeviceAuthorityRuntime,
  requiredScope = 'workspace:read',
): Promise<
  | { ok: true; token: McpOAuthAccessToken; workspace: AccountWorkspace }
  | { ok: false; response: Response }
> {
  try {
    const tokenValue = bearerToken(request);
    if (!tokenValue) {
      return {
        ok: false,
        response: errorResponse(401, 'UNAUTHORIZED', 'OAuth bearer token is required.'),
      };
    }
    const token = await runtime.store.byMcpOAuthAccessToken(await hash(tokenValue));
    if (!token || runtime.now() >= token.expiresAt) {
      return {
        ok: false,
        response: errorResponse(401, 'UNAUTHORIZED', 'OAuth bearer token is invalid or expired.'),
      };
    }
    if (!hasGrantedScope(token.scopes, requiredScope)) {
      return {
        ok: false,
        response: errorResponse(
          403,
          'MISSING_SCOPE',
          requiredScope === 'workspace:nodes:manage'
            ? 'Workspace node management access is required.'
            : 'Workspace read access is required.',
        ),
      };
    }
    const workspace = await runtime.store.byAccountWorkspace(token.accountId);
    const requestedHost = new URL(request.url).searchParams.get('workspace_host')?.trim().toLowerCase();
    if (
      !workspace ||
      workspace.workspaceHost !== token.workspaceHost ||
      (requestedHost && requestedHost !== workspace.workspaceHost)
    ) {
      return {
        ok: false,
        response: errorResponse(403, 'WORKSPACE_ACCESS_DENIED', 'The workspace is not available to this account.'),
      };
    }
    return { ok: true, token, workspace };
  } catch {
    return { ok: false, response: serviceUnavailableResponse() };
  }
}

export async function persistDefaultNode(input: {
  runtime: DeviceAuthorityRuntime;
  workspace: AccountWorkspace;
  nodeId: string;
}): Promise<void> {
  const previousDefaultNodeId = workspaceDefaultNodeId(input.workspace);
  try {
    if (input.runtime.workspaceRouteRegistry) {
      await setDefaultWorkspaceNodeInD1(input.runtime.workspaceRouteRegistry, {
        hostname: input.workspace.workspaceHost,
        nodeId: input.nodeId,
      });
    }
    try {
      await input.runtime.store.putAccountWorkspace({
        ...input.workspace,
        defaultNodeId: input.nodeId,
        updatedAt: input.runtime.now(),
      });
    } catch (error: unknown) {
      if (input.runtime.workspaceRouteRegistry && previousDefaultNodeId) {
        await setDefaultWorkspaceNodeInD1(input.runtime.workspaceRouteRegistry, {
          hostname: input.workspace.workspaceHost,
          nodeId: previousDefaultNodeId,
        });
      }
      throw error;
    }
  } catch (error: unknown) {
    throw new Error('workspace default node update failed', { cause: error });
  }
}

async function handleList(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  try {
    const auth = await authenticateWorkspaceMember(request, runtime);
    if (!auth.ok) return auth.response;
    const nodes = await runtime.store.listWorkspaceNodes(auth.token.accountId);
    const currentNodeId = new URL(request.url).searchParams.get('current_node_id')?.trim() || undefined;
    if (
      currentNodeId &&
      !nodes.some(
        (node) =>
          node.nodeId === currentNodeId &&
          node.workspaceHost === auth.workspace.workspaceHost,
      )
    ) {
      return errorResponse(404, 'WORKSPACE_NODE_NOT_FOUND', 'The requested node was not found.');
    }
    return json(
      workspaceNodeListPayload({
        workspace: auth.workspace,
        nodes,
        nowMs: runtime.now(),
        ...(currentNodeId ? { currentNodeId } : {}),
      }),
      { headers: jsonHeaders },
    );
  } catch {
    return serviceUnavailableResponse();
  }
}

async function handleRename(
  request: Request,
  runtime: DeviceAuthorityRuntime,
  nodeId: string,
): Promise<Response> {
  try {
    const auth = await authenticateWorkspaceMember(
      request,
      runtime,
      'workspace:nodes:manage',
    );
    if (!auth.ok) return auth.response;
    const body = await readJsonObject(request);
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
    if (!displayName || displayName.length > 80) {
      return errorResponse(400, 'INVALID_NODE_NAME', 'Node display name must be between 1 and 80 characters.');
    }
    const node = await runtime.store.byWorkspaceNode(auth.token.accountId, nodeId);
    if (!node || node.workspaceHost !== auth.workspace.workspaceHost) {
      return errorResponse(404, 'WORKSPACE_NODE_NOT_FOUND', 'The requested node was not found.');
    }
    const updated = {
      ...node,
      nodeName: displayName,
      displayName,
      updatedAt: runtime.now(),
    };
    await runtime.store.putWorkspaceNode(updated);
    return json({ node: safeWorkspaceNode(updated, runtime.now()) }, { headers: jsonHeaders });
  } catch {
    return serviceUnavailableResponse();
  }
}

async function handleSelectDefault(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  try {
    const auth = await authenticateWorkspaceMember(
      request,
      runtime,
      'workspace:nodes:manage',
    );
    if (!auth.ok) return auth.response;
    const body = await readJsonObject(request);
    const nodeId = typeof body?.nodeId === 'string' ? body.nodeId.trim() : '';
    const node = nodeId
      ? await runtime.store.byWorkspaceNode(auth.token.accountId, nodeId)
      : undefined;
    if (
      !node ||
      node.workspaceHost !== auth.workspace.workspaceHost ||
      (node.state ?? 'active') !== 'active'
    ) {
      return errorResponse(404, 'WORKSPACE_NODE_NOT_FOUND', 'The requested active node was not found.');
    }
    await persistDefaultNode({ runtime, workspace: auth.workspace, nodeId });
    return json({ defaultNodeId: nodeId }, { headers: jsonHeaders });
  } catch {
    return serviceUnavailableResponse();
  }
}

async function handleRevoke(
  request: Request,
  runtime: DeviceAuthorityRuntime,
  nodeId: string,
): Promise<Response> {
  try {
    const auth = await authenticateWorkspaceMember(
      request,
      runtime,
      'workspace:nodes:manage',
    );
    if (!auth.ok) return auth.response;
    const node = await runtime.store.byWorkspaceNode(auth.token.accountId, nodeId);
    if (!node || node.workspaceHost !== auth.workspace.workspaceHost) {
      return errorResponse(404, 'WORKSPACE_NODE_NOT_FOUND', 'The requested node was not found.');
    }
    const nowMs = runtime.now();
    const revoked: WorkspaceNode = {
      ...node,
      state: 'revoked',
      connectorStatus: 'disconnected',
      revokedAt: nowMs,
      updatedAt: nowMs,
    };
    if (runtime.workspaceRouteRegistry) {
      await updateWorkspaceNodeTargetInD1(runtime.workspaceRouteRegistry, {
        hostname: auth.workspace.workspaceHost,
        nodeId,
        state: 'revoked',
        connectorStatus: 'disconnected',
      });
    }
    try {
      await runtime.store.putWorkspaceNode(revoked);
    } catch (error: unknown) {
      if (runtime.workspaceRouteRegistry) {
        await updateWorkspaceNodeTargetInD1(runtime.workspaceRouteRegistry, {
          hostname: auth.workspace.workspaceHost,
          nodeId,
          state: node.state ?? 'active',
          connectorStatus: node.connectorStatus,
          lastSeenAt: node.lastSeenAt,
        });
      }
      throw error;
    }

    return json({ node: safeWorkspaceNode(revoked, nowMs) }, { headers: jsonHeaders });
  } catch {
    return serviceUnavailableResponse();
  }
}

async function verifyNodeSignature(
  node: WorkspaceNode,
  payload: string,
  signature: string,
): Promise<boolean> {
  try {
    if (!node.devicePublicKeyJwk || !signature) return false;
    const key = await crypto.subtle.importKey(
      'jwk',
      JSON.parse(node.devicePublicKeyJwk),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      b64Decode(signature),
      new TextEncoder().encode(payload),
    );
  } catch {
    return false;
  }
}

async function handleHeartbeat(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    return errorResponse(400, 'INVALID_HEARTBEAT', 'A signed JSON heartbeat is required.');
  }
  const payload = await request.text();
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    body = parsed as Record<string, unknown>;
  } catch {
    return errorResponse(400, 'INVALID_HEARTBEAT', 'A signed JSON heartbeat is required.');
  }
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '';
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId.trim() : '';
  const timestamp = typeof body.timestamp === 'number' ? body.timestamp : Number.NaN;
  const nonce = typeof body.nonce === 'string' ? body.nonce.trim() : '';
  const connectorStatus =
    body.connectorStatus === 'connected' ||
    body.connectorStatus === 'disconnected'
      ? body.connectorStatus
      : undefined;
  const capabilities = Array.isArray(body.capabilities)
    ? [
        ...new Set(
          body.capabilities
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ].sort()
    : [];
  if (capabilities.length > 32) {
    return errorResponse(
      400,
      'INVALID_HEARTBEAT_CAPABILITIES',
      'Heartbeat capabilities may contain at most 32 unique values.',
    );
  }
  const hasAgents = Object.hasOwn(body, 'agents');
  const agents = hasAgents
    ? normalizeWorkspaceAgentNames(body.agents)
    : undefined;
  if (hasAgents && agents === undefined) {
    return errorResponse(
      400,
      'INVALID_HEARTBEAT_AGENTS',
      'Heartbeat agents must contain only known agent identifiers.',
    );
  }
  const nowMs = runtime.now();
  if (
    !workspaceId ||
    !nodeId ||
    !connectorStatus ||
    !Number.isFinite(timestamp) ||
    nonce.length < 8 ||
    nonce.length > 128 ||
    Math.abs(nowMs - timestamp) > WORKSPACE_NODE_SIGNATURE_MAX_AGE_MS
  ) {
    return errorResponse(400, 'INVALID_HEARTBEAT', 'Heartbeat identity, timestamp, or nonce is invalid.');
  }
  const node = await runtime.store.byWorkspaceNodeId(nodeId);
  if (!node || workspaceNodeId(node) !== workspaceId) {
    return errorResponse(404, 'WORKSPACE_NODE_NOT_FOUND', 'The requested node was not found.');
  }
  if ((node.state ?? 'active') === 'revoked') {
    return errorResponse(403, 'WORKSPACE_NODE_REVOKED', 'The node has been revoked.');
  }
  const signature = request.headers.get('x-consuelo-node-signature')?.trim() ?? '';
  if (!(await verifyNodeSignature(node, payload, signature))) {
    return errorResponse(401, 'INVALID_NODE_SIGNATURE', 'The node heartbeat signature is invalid.');
  }
  const claimed = await runtime.store.claimWorkspaceNodeNonce(
    nodeId,
    nonce,
    nowMs + WORKSPACE_NODE_SIGNATURE_MAX_AGE_MS,
    nowMs,
  );
  if (!claimed) {
    return errorResponse(409, 'HEARTBEAT_REPLAYED', 'The node heartbeat nonce was already used.');
  }
  const updated: WorkspaceNode = {
    ...node,
    capabilities,
    ...(hasAgents ? { agents } : {}),
    connectorStatus,
    lastSeenAt: nowMs,
    updatedAt: nowMs,
  };
  let routeReady = false;
  if (runtime.workspaceRouteRegistry) {
    const workspace = await runtime.store.byAccountWorkspace(node.accountId);
    if (!workspace || workspace.workspaceHost !== node.workspaceHost) {
      return serviceUnavailableResponse();
    }
    const nodes = await runtime.store.listWorkspaceNodes(node.accountId);
    const desiredNodes = nodes.map((candidate) =>
      candidate.nodeId === nodeId ? updated : candidate,
    );
    try {
      routeReady = await reconcileWorkspaceRouteState({
        routeRegistry: runtime.workspaceRouteRegistry,
        workspace,
        nodes: desiredNodes,
        currentNodeId: nodeId,
        nowMs,
        defaultSiteSnapshot: runtime.defaultSiteSnapshot,
      });
    } catch {
      return errorResponse(
        503,
        'WORKSPACE_ROUTE_RECONCILIATION_FAILED',
        'Workspace connector route state could not be reconciled.',
      );
    }
    if (connectorStatus === 'connected' && !routeReady) {
      return errorResponse(
        503,
        'WORKSPACE_ROUTE_NOT_READY',
        'Workspace connector route is not ready for this node.',
      );
    }
  }
  try {
    await runtime.store.putWorkspaceNode(updated);
  } catch (error: unknown) {
    if (runtime.workspaceRouteRegistry) {
      await updateWorkspaceNodeTargetInD1(runtime.workspaceRouteRegistry, {
        hostname: node.workspaceHost,
        nodeId,
        connectorStatus: node.connectorStatus,
        state: node.state ?? 'active',
        lastSeenAt: node.lastSeenAt,
        heartbeatTtlMs: WORKSPACE_NODE_HEARTBEAT_TTL_MS,
      });
    }
    throw error;
  }
  const safeNode = safeWorkspaceNode(updated, nowMs);
  const connectorId = updated.connectorId?.trim();
  return json(
    {
      ...safeNode,
      routeReady,
      ...(runtime.workspaceEdgeInternalSigningSecret?.trim() && connectorId
        ? {
            edgeRequestSigningSecret: deriveWorkspaceEdgeNodeSecret({
              masterSecret: runtime.workspaceEdgeInternalSigningSecret,
              workspaceId,
              nodeId,
              connectorId,
            }),
          }
        : {}),
    },
    { headers: jsonHeaders },
  );
}

function launcherWorkspaceNodeListPayload(input: {
  workspace: AccountWorkspace;
  nodes: WorkspaceNode[];
  nowMs: number;
}) {
  const payload = workspaceNodeListPayload(input);
  const sanitize = (node: typeof payload.nodes[number]) => {
    const { publicKeyThumbprint: _thumbprint, connectorId: _connectorId, ...safe } = node;
    return safe;
  };
  return {
    ...payload,
    currentNode: payload.currentNode ? sanitize(payload.currentNode) : null,
    nodes: payload.nodes.map(sanitize),
  };
}

async function handleInternalNodeList(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  try {
    const auth = await authenticateInternalWorkspaceSession(request, runtime, { requireWorkspaceId: false });
    if (!auth.ok) return auth.response;
    const workspace = await runtime.store.byAccountWorkspace(auth.session.accountId);
    if (!workspace || workspace.workspaceHost !== auth.session.workspaceHost) {
      return errorResponse(403, 'WORKSPACE_ACCESS_DENIED', 'The workspace is not available to this session.');
    }
    const nodes = await runtime.store.listWorkspaceNodes(auth.session.accountId);
    return json(
      launcherWorkspaceNodeListPayload({ workspace, nodes, nowMs: runtime.now() }),
      { headers: jsonHeaders },
    );
  } catch {
    return serviceUnavailableResponse();
  }
}

async function handleInternalNodePricing(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  try {
    const auth = await authenticateInternalWorkspaceSession(request, runtime, { requireWorkspaceId: false });
    if (!auth.ok) return auth.response;
    const workspace = await runtime.store.byAccountWorkspace(auth.session.accountId);
    if (!workspace || workspace.workspaceHost !== auth.session.workspaceHost) {
      return errorResponse(403, 'WORKSPACE_ACCESS_DENIED', 'The workspace is not available to this session.');
    }
    return json(
      buildManagedCloudPublicCatalog(
        runtime.managedCloudPricing,
        new URL(request.url).searchParams.get('region'),
      ),
      { headers: jsonHeaders },
    );
  } catch {
    return serviceUnavailableResponse();
  }
}

async function handleInternalSelectDefault(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  try {
    const auth = await authenticateInternalWorkspaceSession(request, runtime, { requireCsrf: true, requireWorkspaceId: false });
    if (!auth.ok) return auth.response;
    const workspace = await runtime.store.byAccountWorkspace(auth.session.accountId);
    const body = await readJsonObject(request);
    const nodeId = typeof body?.nodeId === 'string' ? body.nodeId.trim() : '';
    const node = workspace && nodeId
      ? await runtime.store.byWorkspaceNode(auth.session.accountId, nodeId)
      : undefined;
    if (
      !workspace ||
      workspace.workspaceHost !== auth.session.workspaceHost ||
      !node ||
      node.workspaceHost !== workspace.workspaceHost ||
      (node.state ?? 'active') !== 'active' ||
      safeWorkspaceNode(node, runtime.now()).presence !== 'online'
    ) {
      return errorResponse(404, 'WORKSPACE_NODE_NOT_AVAILABLE', 'The requested online node was not found.');
    }
    await persistDefaultNode({ runtime, workspace, nodeId });
    return json({ defaultNodeId: nodeId }, { headers: jsonHeaders });
  } catch {
    return serviceUnavailableResponse();
  }
}

export function registerWorkspaceNodeRoutes(
  app: Hono,
  runtime: DeviceAuthorityRuntime,
): void {
  app.get('/workspace/nodes', (context) => handleList(context.req.raw, runtime));
  app.get('/internal/workspace/nodes', (context) => handleInternalNodeList(context.req.raw, runtime));
  app.get('/internal/workspace/nodes/pricing', (context) => handleInternalNodePricing(context.req.raw, runtime));
  app.post('/internal/workspace/nodes/default', (context) => handleInternalSelectDefault(context.req.raw, runtime));
  app.post('/workspace/nodes/default', (context) =>
    handleSelectDefault(context.req.raw, runtime),
  );
  app.post('/workspace/nodes/heartbeat', (context) =>
    handleHeartbeat(context.req.raw, runtime),
  );
  app.patch('/workspace/nodes/:nodeId', (context) =>
    handleRename(context.req.raw, runtime, context.req.param('nodeId')),
  );
  app.post('/workspace/nodes/:nodeId/revoke', (context) =>
    handleRevoke(context.req.raw, runtime, context.req.param('nodeId')),
  );
}
