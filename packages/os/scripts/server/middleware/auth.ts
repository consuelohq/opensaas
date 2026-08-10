import fs from 'node:fs';
import path from 'node:path';

import { resolveConsueloHomeLayout } from '../../lib/consuelo-home';
import {
  loadGatewaySecurityConfig,
  verifyBearerMcpRequest,
  verifyMachineRequest,
  verifyWorkspaceEdgeProxyRequest,
  type GatewaySecurityConfig,
} from '../../lib/security-gateway';
import { hasAnyWorkspaceEdgeNodeHeaders } from '../../lib/workspace-edge-node-auth';
import {
  createAuthenticatedMcpPrincipal,
  type AuthenticatedMcpPrincipal,
} from '../security/authenticated-principal';
import {
  authenticateConsueloOAuthMcpRequest,
  authorizeConsueloOAuthMcpRequest,
} from '../services/oauth-introspection';
import { unauthorized, verificationResponse } from './errors';

export type McpAuthenticationResult =
  | { ok: true; principal: AuthenticatedMcpPrincipal }
  | { ok: false; response: Response };

function candidateHomeAuthPaths(): string[] {
  const explicitHomes = [process.env.CONSUELO_HOME, process.env.CONSUELO_OS_HOME]
    .filter((home): home is string => Boolean(home));
  const layouts = [
    resolveConsueloHomeLayout(),
    ...explicitHomes.map((home) => resolveConsueloHomeLayout(home)),
  ];
  const candidates = layouts.flatMap((layout) => [
    path.join(layout.nodeSecurityGeneratedDir, 'auth.json'),
    path.join(layout.home, 'security', 'generated', 'auth.json'),
    path.join(layout.legacyOsHome, 'security', 'generated', 'auth.json'),
  ]);
  return [...new Set(candidates)];
}

export function resolveAuthConfigPath(): string | null {
  const authConfigEnv = process.env.CONSUELO_OS_AUTH_CONFIG ?? '';
  if (authConfigEnv) return authConfigEnv;
  for (const candidate of candidateHomeAuthPaths()) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function hasGeneratedAuthConfig(): boolean {
  return resolveAuthConfigPath() !== null;
}

export function loadAuthConfigForRequest(): GatewaySecurityConfig {
  const authConfigPath = resolveAuthConfigPath();
  if (!authConfigPath) {
    throw new Error('Generated Consuelo OS auth config is required.');
  }
  return loadGatewaySecurityConfig({ authConfigPath });
}

export function requestHeaders(request: Request): Record<string, string> {
  return Object.fromEntries(request.headers.entries());
}

export function hasSignedGatewayHeaders(
  headers: Record<string, string>,
): boolean {
  return Boolean(
    (headers['x-consuelo-token-id'] ||
      headers.authorization?.replace(/^Bearer\s+/i, '')) &&
    headers['x-consuelo-timestamp'] &&
    headers['x-consuelo-nonce'] &&
    headers['x-consuelo-signature'],
  );
}

export function authPreflight(request: Request): Response | null {
  if (!hasGeneratedAuthConfig()) {
    return unauthorized(
      'CONSUELO_AUTH_REQUIRED',
      'Generated Consuelo OS auth is required.',
    );
  }
  const headers = requestHeaders(request);
  if (!hasSignedGatewayHeaders(headers) && !hasAnyWorkspaceEdgeNodeHeaders(headers)) {
    return unauthorized(
      'MISSING_SIGNATURE',
      'Signed gateway headers are required.',
    );
  }
  return null;
}

export async function authorizeSignedRequest(input: {
  request: Request;
  path: string;
  body: string;
  requiredScope: string;
  now?: Date;
}): Promise<Response | null> {
  if (!hasGeneratedAuthConfig()) {
    return unauthorized(
      'CONSUELO_AUTH_REQUIRED',
      'Generated Consuelo OS auth is required.',
    );
  }

  let config: GatewaySecurityConfig;
  try {
    config = loadAuthConfigForRequest();
  } catch {
    return unauthorized(
      'AUTH_CONFIG_REQUIRED',
      'Generated Consuelo OS auth config is required.',
    );
  }

  const headers = requestHeaders(input.request);
  const now = (input.now ?? new Date()).toISOString();
  const result = hasAnyWorkspaceEdgeNodeHeaders(headers)
    ? verifyWorkspaceEdgeProxyRequest({
        config,
        method: input.request.method,
        pathWithSearch: `${new URL(input.request.url).pathname}${new URL(input.request.url).search}`,
        body: input.body,
        headers,
        now,
      })
    : verifyMachineRequest({
        config,
        method: input.request.method,
        path: input.path,
        body: input.body,
        headers,
        workspaceId: headers['x-consuelo-workspace-id'] ?? '',
        requiredScope: input.requiredScope,
        now,
      });

  return result.ok ? null : verificationResponse(result);
}

export async function authenticateSignedRequest(input: {
  request: Request;
  path: string;
  body: string;
  requiredScope: string;
  now?: Date;
}): Promise<McpAuthenticationResult> {
  if (!hasGeneratedAuthConfig()) {
    return {
      ok: false,
      response: unauthorized(
        'CONSUELO_AUTH_REQUIRED',
        'Generated Consuelo OS auth is required.',
      ),
    };
  }

  let config: GatewaySecurityConfig;
  try {
    config = loadAuthConfigForRequest();
  } catch {
    return {
      ok: false,
      response: unauthorized(
        'AUTH_CONFIG_REQUIRED',
        'Generated Consuelo OS auth config is required.',
      ),
    };
  }

  const headers = requestHeaders(input.request);
  const workspaceEdge = hasAnyWorkspaceEdgeNodeHeaders(headers);
  const now = (input.now ?? new Date()).toISOString();
  const result = workspaceEdge
    ? verifyWorkspaceEdgeProxyRequest({
        config,
        method: input.request.method,
        pathWithSearch: `${new URL(input.request.url).pathname}${new URL(input.request.url).search}`,
        body: input.body,
        headers,
        now,
      })
    : verifyMachineRequest({
        config,
        method: input.request.method,
        path: input.path,
        body: input.body,
        headers,
        workspaceId: headers['x-consuelo-workspace-id'] ?? '',
        requiredScope: input.requiredScope,
        now,
      });
  if (!result.ok) {
    return { ok: false, response: verificationResponse(result) };
  }

  return {
    ok: true,
    principal: createAuthenticatedMcpPrincipal({
      authMode: workspaceEdge ? 'workspace-edge' : 'machine',
      workspaceId: result.caller.workspaceId,
      workspaceHost: config.workspaceHost,
      subjectId: result.caller.subjectId,
      callerId: result.caller.callerId,
      appId: result.caller.appId,
      deviceId: result.caller.deviceId,
      connectorId: result.caller.connectorId,
      connectionId: result.caller.connectionId,
      scopes: result.caller.scopes,
    }),
  };
}

function bearerTokenFromRequest(request: Request): string | null {
  const value = request.headers.get('authorization') ?? '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function isLoopbackRequest(request: Request): boolean {
  try {
    const hostname = new URL(request.url).hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

function workspaceHostFromRequest(
  request: Request,
  config?: GatewaySecurityConfig,
): string {
  const explicit = request.headers.get('x-consuelo-hostname')?.trim();
  if (explicit) return explicit.toLowerCase();
  if (config?.workspaceHost) return config.workspaceHost;
  const host = request.headers.get('host')?.trim();
  return host ? host.toLowerCase() : 'localhost';
}

function protectedResourceMetadataUrl(
  request: Request,
  config?: GatewaySecurityConfig,
): string {
  const workspaceHost = workspaceHostFromRequest(request, config);
  if (workspaceHost === 'localhost' || workspaceHost.startsWith('127.')) {
    return 'https://os.consuelohq.com/.well-known/oauth-protected-resource';
  }
  return `https://${workspaceHost}/.well-known/oauth-protected-resource`;
}

function oauthDiscoveryChallenge(
  request: Request,
  config?: GatewaySecurityConfig,
): string {
  return `Bearer realm="Consuelo OS MCP", resource_metadata="${protectedResourceMetadataUrl(request, config)}"`;
}

export async function authorizeBearerMcpRequest(input: {
  request: Request;
  path: string;
  requiredScope: string;
  now?: Date;
}): Promise<Response | null> {
  const bearerToken = bearerTokenFromRequest(input.request);
  if (!bearerToken) {
    let config: GatewaySecurityConfig | undefined;
    try {
      config = loadAuthConfigForRequest();
    } catch {
      config = undefined;
    }
    return unauthorized('MISSING_BEARER', 'Bearer token is required.', {
      'www-authenticate': oauthDiscoveryChallenge(input.request, config),
    });
  }

  let config: GatewaySecurityConfig;
  try {
    config = loadAuthConfigForRequest();
  } catch {
    return unauthorized(
      'AUTH_CONFIG_REQUIRED',
      'Generated Consuelo OS auth config is required.',
    );
  }

  if (isLoopbackRequest(input.request)) {
    const result = verifyBearerMcpRequest({
      config,
      bearerToken,
      path: input.path,
      requiredScope: input.requiredScope,
      now: new Date().toISOString(),
    });
    if (result.ok) return null;
    if (result.error.code !== 'UNKNOWN_TOKEN') {
      return verificationResponse(result);
    }
  }

  return authorizeConsueloOAuthMcpRequest({
    config,
    bearerToken,
    requiredScope: input.requiredScope,
  });
}

export async function authenticateBearerMcpRequest(input: {
  request: Request;
  path: string;
  requiredScope: string;
  now?: Date;
}): Promise<McpAuthenticationResult> {
  const bearerToken = bearerTokenFromRequest(input.request);
  if (!bearerToken) {
    let config: GatewaySecurityConfig | undefined;
    try {
      config = loadAuthConfigForRequest();
    } catch {
      config = undefined;
    }
    return {
      ok: false,
      response: unauthorized('MISSING_BEARER', 'Bearer token is required.', {
        'www-authenticate': oauthDiscoveryChallenge(input.request, config),
      }),
    };
  }

  let config: GatewaySecurityConfig;
  try {
    config = loadAuthConfigForRequest();
  } catch {
    return {
      ok: false,
      response: unauthorized(
        'AUTH_CONFIG_REQUIRED',
        'Generated Consuelo OS auth config is required.',
      ),
    };
  }

  if (isLoopbackRequest(input.request)) {
    const result = verifyBearerMcpRequest({
      config,
      bearerToken,
      path: input.path,
      requiredScope: input.requiredScope,
      now: (input.now ?? new Date()).toISOString(),
    });
    if (result.ok) {
      return {
        ok: true,
        principal: createAuthenticatedMcpPrincipal({
          authMode: 'local-bearer',
          workspaceId: result.caller.workspaceId,
          workspaceHost: config.workspaceHost,
          subjectId: result.caller.subjectId,
          callerId: result.caller.callerId,
          appId: result.caller.appId,
          deviceId: result.caller.deviceId,
          connectorId: result.caller.connectorId,
          connectionId: result.caller.connectionId,
          scopes: result.caller.scopes,
        }),
      };
    }
    if (result.error.code !== 'UNKNOWN_TOKEN') {
      return { ok: false, response: verificationResponse(result) };
    }
  }

  return authenticateConsueloOAuthMcpRequest({
    config,
    bearerToken,
    requiredScope: input.requiredScope,
  });
}
