import { createHash, randomUUID } from 'node:crypto';
import { Hono } from 'hono';

import {
  handleMcpGatewayJsonRpc,
  resolveMcpGatewayRequiredScope,
} from '../../lib/mcp-gateway';
import { validateModernMcpHttpRequest } from '../../lib/mcp-protocol';
import {
  decodeMcpNodeRoutingContext,
  inspectMcpNodeRoutingBody,
  MCP_NODE_CONTEXT_HEADER,
  MCP_ROUTE_SOURCE_HEADER,
  type McpNodeRoutingContext,
} from '../../lib/mcp-node-routing';
import { hasAnyWorkspaceEdgeNodeHeaders } from '../../lib/workspace-edge-node-auth';
import {
  authenticateBearerMcpRequest,
  authenticateSignedRequest,
  authorizeBearerMcpRequest,
  hasSignedGatewayHeaders,
  loadAuthConfigForRequest,
  requestHeaders,
} from '../middleware/auth';
import {
  admitDecodedMcpBody,
  admitRawMcpBody,
} from '../middleware/dangerous-material';
import { internalError, jsonResponse } from '../middleware/errors';
import { queueGatewayAuthenticationTraceSafely } from '../../lib/trace-persistence';
import type { TraceRoutingContext } from '../../lib/trace-routing-context';
import { logLocalOsServerError, logLocalOsServerEvent } from '../logger';
import { validateMcpRequestOrigin } from '../security/mcp-origin';
import { executeLocalOsFacadeTool } from '../services/call-service';
import { resolveMcpRequestSession } from '../services/mcp-session';
import { readGuardedLocalOsSteering } from '../services/steering-service';

const MCP_PATH = '/mcp';
const MCP_REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;

type McpRouteVariables = {
  requestId: string;
};

function resolveMcpRequestId(request: Request): string {
  const provided = request.headers.get('x-consuelo-request-id')?.trim();
  return provided && MCP_REQUEST_ID_PATTERN.test(provided)
    ? provided
    : randomUUID();
}


type McpRouteDependencies = {
  getSteering: (
    callerKey: string,
    nodeRouting?: McpNodeRoutingContext,
  ) => Promise<string>;
  executeFacadeTool: (
    toolName: string,
    toolInput: Record<string, unknown>,
    routing?: TraceRoutingContext,
  ) => Promise<unknown>;
};

function resolveTraceRoutingContext(input: {
  requestedNodeId?: string;
  resolvedNodeId?: string;
  nodeRouting?: McpNodeRoutingContext;
  routeSource?: string;
}): TraceRoutingContext | undefined {
  const resolvedNodeName = input.resolvedNodeId
    ? input.nodeRouting?.nodes.find((node) => node.nodeId === input.resolvedNodeId)?.displayName
    : undefined;
  const routing: TraceRoutingContext = {
    ...(input.requestedNodeId ? { requestedNodeId: input.requestedNodeId } : {}),
    ...(input.resolvedNodeId ? { resolvedNodeId: input.resolvedNodeId } : {}),
    ...(resolvedNodeName ? { resolvedNodeName } : {}),
    ...(input.nodeRouting?.defaultNodeId
      ? { defaultNodeId: input.nodeRouting.defaultNodeId }
      : {}),
    ...(input.routeSource ? { routeSource: input.routeSource } : {}),
  };
  return Object.keys(routing).length ? routing : undefined;
}

function trustedNodeRoutingContext(input: {
  request: Request;
  workspaceId?: string;
}): McpNodeRoutingContext | undefined {
  const context = decodeMcpNodeRoutingContext(
    input.request.headers.get(MCP_NODE_CONTEXT_HEADER),
  );
  if (!context || !input.workspaceId || context.workspaceId !== input.workspaceId) {
    return undefined;
  }
  const resolvedNodeId = input.request.headers.get('x-consuelo-node-id')?.trim();
  if (!resolvedNodeId || resolvedNodeId !== context.currentNodeId) return undefined;
  const routeSource = input.request.headers.get(MCP_ROUTE_SOURCE_HEADER)?.trim();
  if (routeSource !== context.routeSource) return undefined;
  return context;
}

const defaultDependencies: McpRouteDependencies = {
  getSteering: readGuardedLocalOsSteering,
  executeFacadeTool: async (toolName, toolInput, routing) => {
    try {
      return await executeLocalOsFacadeTool(toolName, toolInput, routing);
    } catch (error: unknown) {
      logLocalOsServerError(
        'local_os.mcp_tool_execution_failed',
        error,
        {
          code: 'OS_EXECUTION_FAILED',
          route: MCP_PATH,
          toolName,
        },
      );
      return {
        ok: false,
        code: 'OS_EXECUTION_FAILED',
        message: 'OS tool execution failed.',
      };
    }
  },
};

function resolveSteeringCallerKey(input: {
  request: Request;
  authMode: 'oauth' | 'local-bearer' | 'machine' | 'workspace-edge';
  principalKey: string;
}): string {
  if (input.authMode !== 'workspace-edge') return input.principalKey;
  const authorization = input.request.headers.get('authorization')?.trim() ?? '';
  const bearerMatch = /^Bearer\s+(\S+)$/i.exec(authorization);
  if (!bearerMatch) return input.principalKey;
  const bearerToken = bearerMatch[1];

  const digest = createHash('sha256')
    .update([
      'workspace-edge-oauth',
      input.principalKey,
      bearerToken,
    ].join('\n'))
    .digest('hex');
  return `prn_${digest.slice(0, 32)}`;
}

export function createMcpRoutes(
  dependencies: McpRouteDependencies = defaultDependencies,
) {
  const app = new Hono<{ Variables: McpRouteVariables }>();

  app.use(MCP_PATH, async (context, next) => {
    const requestId = resolveMcpRequestId(context.req.raw);
    context.set('requestId', requestId);
    logLocalOsServerEvent('local_os.mcp_request_received', {
      requestId,
      route: MCP_PATH,
      method: context.req.method,
    });
    await next();
    context.header('x-consuelo-request-id', requestId);
  });

  app.all(MCP_PATH, async (context) => {
    try {
      const request = context.req.raw;
      const requestId = context.get('requestId');

      try {
        const config = loadAuthConfigForRequest();
        const originValidation = validateMcpRequestOrigin(request, {
          workspaceHost: config.workspaceHost,
        });
        if (!originValidation.ok) {
          return jsonResponse(
            {
              error: {
                code: originValidation.code,
                message: originValidation.message,
              },
            },
            originValidation.status,
          );
        }
      } catch {
        // Authentication below remains authoritative if generated auth is unavailable.
      }

      if (request.method !== 'POST') {
        const denied = await authorizeBearerMcpRequest({
          request,
          path: MCP_PATH,
          requiredScope: 'route:/mcp:read',
        });
        if (denied) return denied;
        return new Response('Method not allowed\n', {
          status: 405,
          headers: {
            allow: 'POST',
            'content-type': 'text/plain; charset=utf-8',
          },
        });
      }

      const body = await request.clone().text();
      const rawMaterialDenied = admitRawMcpBody(body, requestId);
      if (rawMaterialDenied) return rawMaterialDenied;

      const decodedMaterialDenied = admitDecodedMcpBody(body, requestId);
      if (decodedMaterialDenied) return decodedMaterialDenied;

      const mcpScope = resolveMcpGatewayRequiredScope(body);
      if (!mcpScope.ok) {
        return jsonResponse({ ok: false, error: mcpScope.error }, mcpScope.status);
      }

      const headers = requestHeaders(request);
      const signedGatewayRequest =
        hasSignedGatewayHeaders(headers) || hasAnyWorkspaceEdgeNodeHeaders(headers);
      const authentication = signedGatewayRequest
        ? await authenticateSignedRequest({
            request,
            path: MCP_PATH,
            body,
            requiredScope: mcpScope.requiredScope,
          })
        : await authenticateBearerMcpRequest({
            request,
            path: MCP_PATH,
            requiredScope: mcpScope.requiredScope,
          });
      if (!authentication.ok) return authentication.response;
      const routingInspection = inspectMcpNodeRoutingBody(body);
      const nodeRouting = trustedNodeRoutingContext({
        request,
        workspaceId: authentication.principal.workspaceId,
      });
      const routeSourceHeader = request.headers.get(MCP_ROUTE_SOURCE_HEADER)?.trim();
      const routeSource =
        routeSourceHeader === 'default' ||
        routeSourceHeader === 'explicit' ||
        routeSourceHeader === 'task'
          ? routeSourceHeader
          : undefined;
      const resolvedNodeId = request.headers.get('x-consuelo-node-id')?.trim() || undefined;
      const requestedNodeId = routingInspection.ok ? routingInspection.nodeId : undefined;
      const traceRouting = resolveTraceRoutingContext({
        requestedNodeId,
        resolvedNodeId,
        nodeRouting,
        routeSource,
      });
      queueGatewayAuthenticationTraceSafely({
        workspaceId: authentication.principal.workspaceId ?? '',
        route: MCP_PATH,
        requiredScope: mcpScope.requiredScope,
        authMode: authentication.principal.authMode,
        principalKey: authentication.principal.principalKey,
        ...(requestedNodeId
          ? { requestedNodeId }
          : {}),
        ...(resolvedNodeId
          ? { resolvedNodeId }
          : {}),
        ...(traceRouting?.resolvedNodeName
          ? { resolvedNodeName: traceRouting.resolvedNodeName }
          : {}),
        ...(nodeRouting?.defaultNodeId ? { defaultNodeId: nodeRouting.defaultNodeId } : {}),
        ...(routeSource ? { routeSource } : {}),
      });

      const protocol = validateModernMcpHttpRequest(body, request.headers);
      if (!protocol.ok) {
        return jsonResponse(protocol.response, protocol.status);
      }

      const session = protocol.modern
        ? null
        : resolveMcpRequestSession(request, body);
      const steeringCallerKey = resolveSteeringCallerKey({
        request,
        authMode: authentication.principal.authMode,
        principalKey: authentication.principal.principalKey,
      });
      const result = await handleMcpGatewayJsonRpc(body, {
        getSteering: () => dependencies.getSteering(steeringCallerKey, nodeRouting),
        executeFacadeTool: (toolName, toolInput) =>
          dependencies.executeFacadeTool(toolName, toolInput, traceRouting),
      });
      const response = jsonResponse(result);
      if (session?.responseSessionId) {
        response.headers.set('mcp-session-id', session.responseSessionId);
      }
      return response;
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  return app;
}
