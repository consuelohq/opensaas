import type { GatewaySecurityConfig } from '../../lib/security-gateway';
import { grantsRequiredScope } from '../../lib/tool-scope-authorization';
import { recordGatewayAuthorizationTraceSafely } from '../../lib/trace-persistence';

import { jsonResponse, unauthorized } from '../middleware/errors';
import {
  createAuthenticatedMcpPrincipal,
  type AuthenticatedMcpPrincipal,
} from '../security/authenticated-principal';

export type OAuthMcpAuthenticationResult =
  | { ok: true; principal: AuthenticatedMcpPrincipal }
  | { ok: false; response: Response };

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

async function introspectConsueloOAuthMcpRequest(input: {
  config: GatewaySecurityConfig;
  bearerToken: string;
  requiredScope: string;
  requirePrincipal: boolean;
}): Promise<OAuthMcpAuthenticationResult | { ok: true; principal: null }> {
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
    return {
      ok: false,
      response: authorizationFailure({
        config: input.config,
        requiredScope: input.requiredScope,
        status: 401,
        code,
        message,
        response: unauthorized(code, message),
      }),
    };
  }

  const payload = await response.json().catch(() => null) as
    | Record<string, unknown>
    | null;
  if (!response.ok || !payload || payload.active !== true) {
    const code = 'UNKNOWN_TOKEN';
    const message = 'Gateway bearer token is not recognized.';
    return {
      ok: false,
      response: authorizationFailure({
        config: input.config,
        requiredScope: input.requiredScope,
        status: 401,
        code,
        message,
        response: unauthorized(code, message),
      }),
    };
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
    return {
      ok: false,
      response: authorizationFailure({
        config: input.config,
        requiredScope: input.requiredScope,
        status: 403,
        code,
        message,
        response,
      }),
    };
  }

  const scopes = Array.isArray(payload.scopes)
    ? payload.scopes.filter((scope): scope is string => typeof scope === 'string')
    : typeof payload.scope === 'string'
      ? payload.scope.split(/\s+/).filter(Boolean)
      : [];
  const subjectId = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  const clientId =
    typeof payload.client_id === 'string' ? payload.client_id.trim() : '';
  const principal =
    subjectId && clientId
      ? createAuthenticatedMcpPrincipal({
          authMode: 'oauth',
          workspaceId: input.config.workspaceId,
          workspaceHost,
          subjectId,
          clientId,
          scopes,
        })
      : null;
  if (input.requirePrincipal && !principal) {
    const code = 'OAUTH_PRINCIPAL_REQUIRED';
    const message = 'OAuth introspection did not return a verified principal.';
    return {
      ok: false,
      response: authorizationFailure({
        config: input.config,
        requiredScope: input.requiredScope,
        status: 401,
        code,
        message,
        response: unauthorized(code, message),
      }),
    };
  }
  if (!grantsRequiredScope(scopes, input.requiredScope)) {
    const code = 'MISSING_SCOPE';
    const message = 'OAuth token does not grant the required scope.';
    const response = jsonResponse({
      error: {
        code,
        message,
      },
    }, 403);
    return {
      ok: false,
      response: authorizationFailure({
        config: input.config,
        requiredScope: input.requiredScope,
        status: 403,
        code,
        message,
        response,
      }),
    };
  }

  return { ok: true, principal };
}

export async function authenticateConsueloOAuthMcpRequest(input: {
  config: GatewaySecurityConfig;
  bearerToken: string;
  requiredScope: string;
}): Promise<OAuthMcpAuthenticationResult> {
  try {
    const result = await introspectConsueloOAuthMcpRequest({
      ...input,
      requirePrincipal: true,
    });
    if (!result.ok) return result;
    if (!result.principal) throw new Error('OAuth principal invariant failed.');
    return { ok: true, principal: result.principal };
  } catch {
    const code = 'OAUTH_INTROSPECTION_UNAVAILABLE';
    const message = 'Consuelo OAuth introspection is unavailable.';
    return {
      ok: false,
      response: authorizationFailure({
        config: input.config,
        requiredScope: input.requiredScope,
        status: 401,
        code,
        message,
        response: unauthorized(code, message),
      }),
    };
  }
}

export async function authorizeConsueloOAuthMcpRequest(input: {
  config: GatewaySecurityConfig;
  bearerToken: string;
  requiredScope: string;
}): Promise<Response | null> {
  try {
    const result = await introspectConsueloOAuthMcpRequest({
      ...input,
      requirePrincipal: false,
    });
    return result.ok ? null : result.response;
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
}
