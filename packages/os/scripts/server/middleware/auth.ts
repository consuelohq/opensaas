import fs from 'node:fs';
import path from 'node:path';

import { resolveConsueloHomeLayout } from '../../lib/consuelo-home';
import {
  loadGatewaySecurityConfig,
  verifyBearerMcpRequest,
  verifyMachineRequest,
  type GatewaySecurityConfig,
} from '../../lib/security-gateway';
import { authorizeConsueloOAuthMcpRequest } from '../services/oauth-introspection';
import { unauthorized, verificationResponse } from './errors';

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
  if (!hasSignedGatewayHeaders(requestHeaders(request))) {
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
  const result = verifyMachineRequest({
    config,
    method: input.request.method,
    path: input.path,
    body: input.body,
    headers,
    workspaceId: headers['x-consuelo-workspace-id'] ?? '',
    requiredScope: input.requiredScope,
    now: new Date().toISOString(),
  });

  return result.ok ? null : verificationResponse(result);
}

function bearerTokenFromRequest(request: Request): string | null {
  const value = request.headers.get('authorization') ?? '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
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

  return authorizeConsueloOAuthMcpRequest({
    config,
    bearerToken,
    requiredScope: input.requiredScope,
  });
}
