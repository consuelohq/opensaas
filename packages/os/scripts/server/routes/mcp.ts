import { Hono } from 'hono';

import {
  handleMcpGatewayJsonRpc,
  resolveMcpGatewayRequiredScope,
} from '../../lib/mcp-gateway';
import {
  authorizeBearerMcpRequest,
  authorizeSignedRequest,
  hasSignedGatewayHeaders,
  requestHeaders,
} from '../middleware/auth';
import {
  admitDecodedMcpBody,
  admitRawMcpBody,
} from '../middleware/dangerous-material';
import { internalError, jsonResponse } from '../middleware/errors';
import { logLocalOsServerError } from '../logger';
import { executeLocalOsCall } from '../services/call-service';

const MCP_PATH = '/mcp';

export function createMcpRoutes(): Hono {
  const app = new Hono();

  app.all(MCP_PATH, async (context) => {
    try {
      const request = context.req.raw;

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
      const denied = hasSignedGatewayHeaders(headers)
        ? await authorizeSignedRequest({
            request,
            path: MCP_PATH,
            body,
            requiredScope: mcpScope.requiredScope,
          })
        : await authorizeBearerMcpRequest({
            request,
            path: MCP_PATH,
            requiredScope: mcpScope.requiredScope,
          });
      if (denied) return denied;

      const result = await handleMcpGatewayJsonRpc(body, {
        executeCall: async (input) => {
          try {
            return await executeLocalOsCall(input);
          } catch (error: unknown) {
            logLocalOsServerError(
              'local_os.mcp_tool_execution_failed',
              error,
              {
                code: 'OS_EXECUTION_FAILED',
                route: MCP_PATH,
                toolName: input.name,
              },
            );
            return {
              ok: false,
              name: input.name,
              permission: 'execute',
              error: {
                code: 'OS_EXECUTION_FAILED',
                message: 'OS tool execution failed.',
              },
            };
          }
        },
      });
      return jsonResponse(result);
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  return app;
}
