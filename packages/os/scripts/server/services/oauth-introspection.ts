import type { GatewaySecurityConfig } from '../../lib/security-gateway';
import { recordGatewayAuthorizationTraceSafely } from '../../lib/trace-persistence';

import { jsonResponse, unauthorized } from '../middleware/errors';

function scopeAllowed(scopes: string[], requiredScope: string): boolean {
  if (scopes.includes(requiredScope)) return true;
  const parts = requiredScope.split(':');
  if (parts.length !== 3 || parts[0] !== 'tool') return false;
  const category = parts[2];
  if (scopes.includes(`tool:*:${category}`) || scopes.includes('tool:*:*')) {
    return true;
  }
  return scopes.includes('mcp:call') && (category === 'read' || category === 'write');
}

function authorizationFailure(input: {
  config: GatewaySecurityConfig;
  requiredScope: string;
  status: number;
  code: string;
  message: string;
  response: Response;
}): Response {
  recordGatewayAuthorizationTraceSafely({
    workspaceId: input.config.workspaceId,
    route: '/mcp',
    requiredScope: input.requiredScope,
    status: input.status,
    code: input.code,
    message: input.message,
  });
  return input.response;
}

export async function authorizeConsueloOAuthMcpRequest(input: {
  config: GatewaySecurityConfig;
  bearerToken: string;
  requiredScope: string;
}): Promise<Response | null> {
  const endpoint = process.env.CONSUELO_OS_OAUTH_INTROSPECTION_URL ??
    'https://os.consuelohq.com/oauth/introspect';

  let response: Response;
  try {
    const resource = new URL('/mcp', endpoint).toString();
    response = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(5_000),
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: input.bearerToken,
        resource,
        scope: input.requiredScope,
      }).toString(),
    });
  } catch {
    const code = 'OAUTH_INTROSPECTION_UNAVAILABLE';
    const message = 'Consuelo OAuth introspection is unavailable.';
    return authorizationFailure({
      config: input.config,
      requiredScope: input.requiredScope,
      status: 401,
      code,
      message,
      response: unauthorized(code, message),
    });
  }

  const payload = await response.json().catch(() => null) as
    | Record<string, unknown>
    | null;
  if (!response.ok || !payload || payload.active !== true) {
    const code = 'UNKNOWN_TOKEN';
    const message = 'Gateway bearer token is not recognized.';
    return authorizationFailure({
      config: input.config,
      requiredScope: input.requiredScope,
      status: 401,
      code,
      message,
      response: unauthorized(code, message),
    });
  }

  const workspaceHost = typeof payload.workspace_host === 'string'
    ? payload.workspace_host
    : '';
  if (workspaceHost !== input.config.workspaceHost) {
    const code = 'WORKSPACE_MISMATCH';
    const message = 'OAuth token is not bound to this workspace.';
    const response = jsonResponse({
      error: {
        code,
        message,
      },
    }, 403);
    return authorizationFailure({
      config: input.config,
      requiredScope: input.requiredScope,
      status: 403,
      code,
      message,
      response,
    });
  }

  const scopes = Array.isArray(payload.scopes)
    ? payload.scopes.filter((scope): scope is string => typeof scope === 'string')
    : typeof payload.scope === 'string'
      ? payload.scope.split(/\s+/).filter(Boolean)
      : [];
  if (!scopeAllowed(scopes, input.requiredScope)) {
    const code = 'MISSING_SCOPE';
    const message = 'OAuth token does not grant the required scope.';
    const response = jsonResponse({
      error: {
        code,
        message,
      },
    }, 403);
    return authorizationFailure({
      config: input.config,
      requiredScope: input.requiredScope,
      status: 403,
      code,
      message,
      response,
    });
  }

  return null;
}
