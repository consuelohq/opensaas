import { createHash, randomUUID } from 'node:crypto';
import { Hono } from 'hono';

import {
  handleMcpGatewayJsonRpc,
  resolveMcpGatewayRequiredScope,
  type McpFacadeExecutionOptions,
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
import { getToolManifestEntry } from '../../lib/facade/executor';
import type { TraceRoutingContext } from '../../lib/trace-routing-context';
import { logLocalOsServerError, logLocalOsServerEvent } from '../logger';
import {
  appendMcpRequestReceipt,
  inspectMcpRequestReceiptBody,
} from '../mcp-request-receipts';
import { createMcpRequestRecoveryStore } from '../mcp-request-recovery';
import { validateMcpRequestOrigin } from '../security/mcp-origin';
import { executeLocalOsFacadeTool } from '../services/call-service';
import { resolveMcpRequestSession } from '../services/mcp-session';
import { readGuardedLocalOsSteering } from '../services/steering-service';

const MCP_PATH = '/mcp';
const MCP_REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;
const MAX_MCP_HTTP_BODY_BYTES = 4 * 1024 * 1024;

type McpRouteVariables = {
  requestId: string;
};

async function readBoundedMcpBody(request: Request): Promise<{ ok: true; body: string } | { ok: false }> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MCP_HTTP_BODY_BYTES) return { ok: false };
  if (!request.body) return { ok: true, body: '' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_MCP_HTTP_BODY_BYTES) {
        void reader.cancel().catch(() => undefined);
        return { ok: false };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, body: new TextDecoder().decode(bytes) };
}

function resolveMcpRequestId(request: Request): string {
  const provided = request.headers.get('x-consuelo-request-id')?.trim();
  return provided && MCP_REQUEST_ID_PATTERN.test(provided)
    ? provided
    : randomUUID();
}

function resolveOpenAiSessionReceiptKey(request: Request): string | undefined {
  const raw = request.headers.get('x-openai-session')?.trim();
  if (!raw) return undefined;
  return createHash('sha256')
    .update(['openai-session', raw].join('\n'))
    .digest('hex')
    .slice(0, 16);
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
    execution?: McpFacadeExecutionOptions,
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
  executeFacadeTool: async (toolName, toolInput, routing, execution) => {
    try {
      return await executeLocalOsFacadeTool(toolName, toolInput, routing, execution);
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
  const requestRecovery = createMcpRequestRecoveryStore();

  app.use(MCP_PATH, async (context, next) => {
    const startedAt = Date.now();
    const requestId = resolveMcpRequestId(context.req.raw);
    const connectorKey = resolveOpenAiSessionReceiptKey(context.req.raw);
    let receiptMetadata = {};
    if (context.req.method === 'POST') {
      try {
        const boundedBody = await readBoundedMcpBody(context.req.raw.clone());
        if (!boundedBody.ok) {
          return jsonResponse({
            error: {
              code: 'MCP_BODY_TOO_LARGE',
              message: `MCP request body exceeds ${MAX_MCP_HTTP_BODY_BYTES} bytes.`,
            },
          }, 413);
        }
        receiptMetadata = inspectMcpRequestReceiptBody(boundedBody.body);
      } catch {
        return jsonResponse({
          error: {
            code: 'MCP_BODY_READ_FAILED',
            message: 'MCP request body could not be read safely.',
          },
        }, 400);
      }
    }
    context.set('requestId', requestId);
    logLocalOsServerEvent('local_os.mcp_request_received', {
      requestId,
      route: MCP_PATH,
      method: context.req.method,
      ...(connectorKey ? { connectorKey } : {}),
      ...receiptMetadata,
    });
    appendMcpRequestReceipt({
      phase: 'received',
      requestId,
      ...(connectorKey ? { connectorKey } : {}),
      ...receiptMetadata,
      ts: new Date(startedAt).toISOString(),
    });
    let failed = false;
    try {
      await next();
    } catch (error: unknown) {
      failed = true;
      throw error;
    } finally {
      const finishedAt = Date.now();
      const status = failed ? 500 : context.res.status;
      const responseFailed = failed || status >= 500;
      appendMcpRequestReceipt({
        phase: responseFailed ? 'failed' : 'response_ready',
        requestId,
        ...(connectorKey ? { connectorKey } : {}),
        ...receiptMetadata,
        status,
        durationMs: Math.max(0, finishedAt - startedAt),
        ts: new Date(finishedAt).toISOString(),
      });
      logLocalOsServerEvent(
        responseFailed ? 'local_os.mcp_request_failed' : 'local_os.mcp_response_ready',
        {
          requestId,
          route: MCP_PATH,
          method: context.req.method,
          status,
          durationMs: Math.max(0, finishedAt - startedAt),
          ...(connectorKey ? { connectorKey } : {}),
          ...receiptMetadata,
        },
        responseFailed ? 'warn' : 'info',
      );
      context.header('x-consuelo-request-id', requestId);
    }
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
        executeFacadeTool: async (toolName, toolInput, execution) => {
          const explicitRequestId = typeof toolInput.requestId === 'string'
            && MCP_REQUEST_ID_PATTERN.test(toolInput.requestId.trim())
            ? toolInput.requestId.trim()
            : undefined;
          const correlatedToolInput = explicitRequestId
            ? { ...toolInput, requestId: explicitRequestId }
            : { ...toolInput, requestId };
          const execute = () => execution
            ? dependencies.executeFacadeTool(toolName, correlatedToolInput, traceRouting, execution)
            : dependencies.executeFacadeTool(toolName, correlatedToolInput, traceRouting);

          if (!explicitRequestId) return execute();

          let mutating = false;
          try {
            mutating = getToolManifestEntry(toolName)?.capabilities.mutating === true;
          } catch {
            return {
              ok: false,
              code: 'REQUEST_RECOVERY_UNAVAILABLE',
              message: 'Mutating request recovery could not resolve the tool contract. Execution was not started.',
              data: { requestId: explicitRequestId },
              autoRetry: false,
            };
          }
          if (!mutating) return execute();

          return requestRecovery.execute({
            requestId: explicitRequestId,
            toolName,
            toolInput: correlatedToolInput,
            scope: steeringCallerKey,
            execute,
          });
        },
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
