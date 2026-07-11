import type { GatewaySecurityConfig } from '../../lib/security-gateway';

import { jsonResponse, unauthorized } from '../middleware/errors';

function scopeAllowed(scopes: string[], requiredScope: string): boolean {
  if (scopes.includes(requiredScope)) return true;
  const parts = requiredScope.split(':');
  return parts.length === 3 && parts[0] === 'tool' && (
    scopes.includes(`tool:*:${parts[2]}`) || scopes.includes('tool:*:*')
  );
}

export async function authorizeConsueloOAuthMcpRequest(input: {
  config: GatewaySecurityConfig;
  bearerToken: string;
  requiredScope: string;
}): Promise<Response | null> {
  const endpoint = process.env.CONSUELO_OS_OAUTH_INTROSPECTION_URL ??
    'https://os.consuelohq.com/oauth/introspect';
  const resource = `https://${input.config.workspaceHost}/mcp`;

  let response: Response;
  try {
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
    return unauthorized(
      'OAUTH_INTROSPECTION_UNAVAILABLE',
      'Consuelo OAuth introspection is unavailable.',
    );
  }

  const payload = await response.json().catch(() => null) as
    | Record<string, unknown>
    | null;
  if (!response.ok || !payload || payload.active !== true) {
    return unauthorized(
      'UNKNOWN_TOKEN',
      'Gateway bearer token is not recognized.',
    );
  }

  const workspaceHost = typeof payload.workspace_host === 'string'
    ? payload.workspace_host
    : '';
  if (workspaceHost !== input.config.workspaceHost) {
    return jsonResponse({
      error: {
        code: 'WORKSPACE_MISMATCH',
        message: 'OAuth token is not bound to this workspace.',
      },
    }, 403);
  }

  const scopes = Array.isArray(payload.scopes)
    ? payload.scopes.filter((scope): scope is string => typeof scope === 'string')
    : typeof payload.scope === 'string'
      ? payload.scope.split(/\s+/).filter(Boolean)
      : [];
  if (!scopeAllowed(scopes, input.requiredScope)) {
    return jsonResponse({
      error: {
        code: 'MISSING_SCOPE',
        message: 'OAuth token does not grant the required scope.',
      },
    }, 403);
  }

  return null;
}
