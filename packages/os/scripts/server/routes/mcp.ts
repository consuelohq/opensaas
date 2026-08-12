import { createHash } from 'node:crypto';
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
import { logLocalOsServerError } from '../logger';
import { validateMcpRequestOrigin } from '../security/mcp-origin';
import { executeLocalOsFacadeTool } from '../services/call-service';
import { resolveMcpRequestSession } from '../services/mcp-session';
import { readGuardedLocalOsSteering } from '../services/steering-service';

const MCP_PATH = '/mcp';

type McpRouteDependencies = {
  getSteering: (
    callerKey: string,
    nodeRouting?: McpNodeRoutingContext,
  ) => Promise<string>;
  executeFacadeTool: (
    toolName: string,
    toolInput: Record<string, unknown>,
  ) => Promise<unknown>;
};

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
  executeFacadeTool: async (toolName, toolInput) => {
    try {
      return await executeLocalOsFacadeTool(toolName, toolInput);
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
): Hono {
  const app = new Hono();

  app.all(MCP_PATH, async (context) => {
    try {
      const request = context.req.raw;

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
      const rawMaterialDenied = admitRawMcpBody(body);
      if (rawMaterialDenied) return rawMaterialDenied;

      const decodedMaterialDenied = admitDecodedMcpBody(body);
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
      const routeSource = routeSourceHeader === 'default' || routeSourceHeader === 'explicit'
        ? routeSourceHeader
        : undefined;
      queueGatewayAuthenticationTraceSafely({
        workspaceId: authentication.principal.workspaceId ?? '',
        route: MCP_PATH,
        requiredScope: mcpScope.requiredScope,
        authMode: authentication.principal.authMode,
        principalKey: authentication.principal.principalKey,
        ...(routingInspection.ok && routingInspection.nodeId
          ? { requestedNodeId: routingInspection.nodeId }
          : {}),
        ...(request.headers.get('x-consuelo-node-id')?.trim()
          ? { resolvedNodeId: request.headers.get('x-consuelo-node-id')!.trim() }
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
        executeFacadeTool: dependencies.executeFacadeTool,
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
