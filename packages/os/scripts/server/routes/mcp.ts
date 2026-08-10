import { Hono } from 'hono';

import {
  handleMcpGatewayJsonRpc,
  resolveMcpGatewayRequiredScope,
} from '../../lib/mcp-gateway';
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
import { recordGatewayAuthenticationTraceSafely } from '../../lib/trace-persistence';
import { logLocalOsServerError } from '../logger';
import { validateMcpRequestOrigin } from '../security/mcp-origin';
import { executeLocalOsFacadeTool } from '../services/call-service';
import { resolveMcpRequestSession } from '../services/mcp-session';
import { readGuardedLocalOsSteering } from '../services/steering-service';

const MCP_PATH = '/mcp';

type McpRouteDependencies = {
  getSteering: (callerKey: string) => Promise<string>;
  executeFacadeTool: (
    toolName: string,
    toolInput: Record<string, unknown>,
  ) => Promise<unknown>;
};

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
      const authentication = hasSignedGatewayHeaders(headers)
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
      recordGatewayAuthenticationTraceSafely({
        workspaceId: authentication.principal.workspaceId ?? '',
        route: MCP_PATH,
        requiredScope: mcpScope.requiredScope,
        authMode: authentication.principal.authMode,
        principalKey: authentication.principal.principalKey,
      });

      const session = resolveMcpRequestSession(request, body);
      const result = await handleMcpGatewayJsonRpc(body, {
        getSteering: () => dependencies.getSteering(session.callerKey),
        executeFacadeTool: dependencies.executeFacadeTool,
      });
      const response = jsonResponse(result);
      if (session.responseSessionId) {
        response.headers.set('mcp-session-id', session.responseSessionId);
      }
      return response;
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  return app;
}
