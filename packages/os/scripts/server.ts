#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';

import {
  loadGatewaySecurityConfig,
  resolveToolScope,
  verifyMachineRequest,
  type VerificationResult,
} from './lib/security-gateway';
import {
  assessDangerousMaterial,
  dangerousMaterialError,
  type DangerousMaterialDecision,
} from './lib/dangerous-material-policy';
import type { CallInput } from './lib/types';
import {
  createTraceSitesGatewayLiveEndpoints,
  traceGatewayScopeFromHeaders,
  type TraceSitesGatewayLiveEndpoints,
} from './lib/trace-sites-gateway-live-endpoints';
import { createLocalTraceSitesReadBackend } from './lib/trace-sites-local-read-backend';
import {
  handleMcpGatewayJsonRpc,
  resolveMcpGatewayRequiredScope,
} from './lib/mcp-gateway';

const DEFAULT_PORT = 8960;
const PORT = Number(process.env.CONSUELO_OS_PORT ?? process.env.PORT ?? DEFAULT_PORT);
const SERVER_NAME = process.env.CONSUELO_OS_SERVER_NAME ?? 'consuelo-os';

let traceGatewayEndpointCache: TraceSitesGatewayLiveEndpoints | null = null;
let osRuntimePromise: Promise<typeof import('./os')> | null = null;

type JsonObject = Record<string, unknown>;

function jsonResponse(body: JsonObject, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
    },
  });
}

function unauthorized(code = 'UNAUTHORIZED', message = 'Unauthorized'): Response {
  return jsonResponse({ error: { code, message } }, 401);
}

function loadOsRuntime(): Promise<typeof import('./os')> {
  osRuntimePromise ??= import('./os');
  return osRuntimePromise;
}

function verificationResponse(result: Extract<VerificationResult, { ok: false }>): Response {
  return jsonResponse({ error: result.error }, result.status);
}

function internalError(error: unknown): Response {
  const message = error instanceof Error ? error.message.slice(0, 240) : 'OS call failed.';
  return jsonResponse({ ok: false, error: { code: 'INTERNAL_SERVER_ERROR', message } }, 500);
}

function candidateHomeAuthPaths(): string[] {
  const homes = [process.env.CONSUELO_OS_HOME, process.env.CONSUELO_HOME].filter((home): home is string => Boolean(home));
  return [...new Set(homes)].map((home) => path.join(home, 'security', 'generated', 'auth.json'));
}

function resolveAuthConfigPath(): string | null {
  const authConfigEnv = process.env.CONSUELO_OS_AUTH_CONFIG ?? '';
  if (authConfigEnv) return authConfigEnv;
  for (const candidate of candidateHomeAuthPaths()) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function hasGeneratedAuthConfig(): boolean {
  return resolveAuthConfigPath() !== null;
}

function requestHeaders(request: Request): Record<string, string> {
  return Object.fromEntries(request.headers.entries());
}

function hasSignedGatewayHeaders(headers: Record<string, string>): boolean {
  return Boolean(
    (headers['x-consuelo-token-id'] || headers.authorization?.replace(/^Bearer\s+/i, '')) &&
    headers['x-consuelo-timestamp'] &&
    headers['x-consuelo-nonce'] &&
    headers['x-consuelo-signature']
  );
}

function authPreflight(request: Request): Response | null {
  if (!hasGeneratedAuthConfig()) {
    return unauthorized('CONSUELO_AUTH_REQUIRED', 'Generated Consuelo OS auth is required.');
  }
  if (!hasSignedGatewayHeaders(requestHeaders(request))) {
    return unauthorized('MISSING_SIGNATURE', 'Signed gateway headers are required.');
  }
  return null;
}

function loadAuthConfigForRequest(): ReturnType<typeof loadGatewaySecurityConfig> {
  const authConfigPath = resolveAuthConfigPath();
  if (!authConfigPath) {
    throw new Error('Generated Consuelo OS auth config is required.');
  }
  return loadGatewaySecurityConfig({ authConfigPath });
}

async function authorizeSignedRequest(input: {
  request: Request;
  path: string;
  body: string;
  requiredScope: string;
}): Promise<Response | null> {
  if (!hasGeneratedAuthConfig()) {
    return unauthorized('CONSUELO_AUTH_REQUIRED', 'Generated Consuelo OS auth is required.');
  }

  let config: ReturnType<typeof loadGatewaySecurityConfig>;
  try {
    config = loadAuthConfigForRequest();
  } catch {
    return unauthorized('AUTH_CONFIG_REQUIRED', 'Generated Consuelo OS auth config is required.');
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

function parseCallInput(body: string): CallInput {
  const parsed = JSON.parse(body) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Request body must be a JSON object.');
  }
  const input = parsed as Partial<CallInput>;
  if (!input.name || typeof input.name !== 'string') {
    throw new Error('Request body requires a string name.');
  }
  return input as CallInput;
}

function invalidRequest(error: unknown): Response {
  return jsonResponse({
    ok: false,
    error: {
      code: 'INVALID_REQUEST',
      message: error instanceof Error ? error.message.slice(0, 240) : 'Invalid request',
    },
  }, 400);
}

function dangerousMaterialResponse(decision: Exclude<DangerousMaterialDecision, { allowed: true }>): Response {
  return jsonResponse({
    ok: false,
    error: dangerousMaterialError(decision),
    securityEvent: decision.securityEvent,
  }, 400);
}

function admitRawCallBody(body: string): Response | null {
  const decision = assessDangerousMaterial({
    source: 'server call raw-body',
    rawBody: body,
  });
  return decision.allowed ? null : dangerousMaterialResponse(decision);
}

function admitRawMcpBody(body: string): Response | null {
  const decision = assessDangerousMaterial({
    source: 'server mcp raw-body',
    rawBody: body,
  });
  return decision.allowed ? null : dangerousMaterialResponse(decision);
}

function admitDecodedCallBody(input: CallInput): Response | null {
  const decision = assessDangerousMaterial({
    source: 'server call decoded-json',
    value: input,
  });
  return decision.allowed ? null : dangerousMaterialResponse(decision);
}

function admitDecodedMcpBody(body: string): Response | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return null;
  }

  const decision = assessDangerousMaterial({
    source: 'server mcp decoded-json',
    value: parsed,
  });
  return decision.allowed ? null : dangerousMaterialResponse(decision);
}

function resolveTraceDbPath(): string {
  const traceDbEnv = process.env.CONSUELO_TRACE_DB ?? process.env.TRACE_DB ?? '';
  if (traceDbEnv) return traceDbEnv;
  const home = process.env.CONSUELO_OS_HOME ?? process.env.CONSUELO_HOME ?? '';
  if (home) return path.join(home, 'traces', 'traces.db');
  if (process.platform === 'darwin') return path.join(process.env.HOME ?? '', 'Library', 'Application Support', 'OpenWorkspace', 'traces', 'traces.db');
  if (process.platform === 'win32') return path.join(process.env.APPDATA ?? process.env.HOME ?? '', 'OpenWorkspace', 'traces', 'traces.db');
  const dataHome = process.env.XDG_DATA_HOME ?? path.join(process.env.HOME ?? '', '.local', 'share');
  return path.join(dataHome, 'OpenWorkspace', 'traces', 'traces.db');
}

function isTraceGatewayReadRoute(pathname: string): boolean {
  return pathname === '/gateway/traces/recent' ||
    pathname === '/gateway/traces/summary' ||
    pathname === '/gateway/traces/aggregates' ||
    pathname === '/gateway/traces/events';
}

function traceGatewayEndpoints(): TraceSitesGatewayLiveEndpoints {
  traceGatewayEndpointCache ??= createTraceSitesGatewayLiveEndpoints({
    backend: createLocalTraceSitesReadBackend({ dbPath: resolveTraceDbPath() }),
    resolveScope: (traceRequest) => {
      const scope = traceGatewayScopeFromHeaders(traceRequest);
      const config = loadAuthConfigForRequest();
      return {
        ...scope,
        workspaceId: scope.workspaceId === 'workspace-unknown' ? config.workspaceId : scope.workspaceId,
        workspaceHost: scope.workspaceHost === '127.0.0.1:8960' ? config.workspaceHost : scope.workspaceHost,
      };
    },
  });
  return traceGatewayEndpointCache;
}

function healthResponse(): Response {
  return jsonResponse({
    status: 'ok',
    name: SERVER_NAME,
    runtime: 'bun',
    toolNames: ['get_steering', 'call', 'mcp'],
    tools: 3,
    port: PORT,
  });
}

async function handleRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);

  if (url.pathname === '/health') return healthResponse();

  if (isTraceGatewayReadRoute(url.pathname) && request.method === 'GET') {
    const denied = await authorizeSignedRequest({
      request,
      path: url.pathname,
      body: '',
      requiredScope: 'route:/gateway/traces:read',
    });
    if (denied) return denied;

    return traceGatewayEndpoints().handle(request);
  }

  if (url.pathname === '/mcp' && request.method === 'POST') {
    const body = await request.clone().text();
    const rawMaterialDenied = admitRawMcpBody(body);
    if (rawMaterialDenied) return rawMaterialDenied;

    const preflightDenied = authPreflight(request);
    if (preflightDenied) return preflightDenied;

    const decodedMaterialDenied = admitDecodedMcpBody(body);
    if (decodedMaterialDenied) return decodedMaterialDenied;

    const mcpScope = resolveMcpGatewayRequiredScope(body);
    if (!mcpScope.ok) {
      return jsonResponse({ ok: false, error: mcpScope.error }, mcpScope.status);
    }

    const denied = await authorizeSignedRequest({
      request,
      path: '/mcp',
      body,
      requiredScope: mcpScope.requiredScope,
    });
    if (denied) return denied;

    const result = await handleMcpGatewayJsonRpc(body, {
      executeCall: async (input) => {
        try {
          const { executeCall } = await loadOsRuntime();
          return await executeCall(input);
        } catch {
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
  }

  if (url.pathname === '/get_steering' && (request.method === 'GET' || request.method === 'POST')) {
    const body = request.method === 'GET' ? '' : await request.clone().text();
    const denied = await authorizeSignedRequest({
      request,
      path: '/get_steering',
      body,
      requiredScope: 'route:/get_steering:read',
    });
    if (denied) return denied;
    const { getSteering } = await loadOsRuntime();
    return textResponse(getSteering());
  }

  if (url.pathname === '/call' && request.method === 'POST') {
    const body = await request.clone().text();
    const rawMaterialDenied = admitRawCallBody(body);
    if (rawMaterialDenied) return rawMaterialDenied;

    const preflightDenied = authPreflight(request);
    if (preflightDenied) return preflightDenied;

    let input: CallInput;
    try {
      input = parseCallInput(body);
    } catch (error: unknown) {
      return invalidRequest(error);
    }

    const decodedMaterialDenied = admitDecodedCallBody(input);
    if (decodedMaterialDenied) return decodedMaterialDenied;

    const toolScope = resolveToolScope(input.name);
    if (!toolScope.ok) {
      return jsonResponse({ ok: false, error: toolScope.error }, toolScope.status);
    }

    const denied = await authorizeSignedRequest({
      request,
      path: '/call',
      body,
      requiredScope: toolScope.requiredScope,
    });
    if (denied) return denied;

    try {
      const { executeCall } = await loadOsRuntime();
      const result = await executeCall(input);
      return jsonResponse(result, result.ok ? 200 : 400);
    } catch (error: unknown) {
      return internalError(error);
    }
  }

  if (!hasGeneratedAuthConfig()) {
    return unauthorized('CONSUELO_AUTH_REQUIRED', 'Generated Consuelo OS auth is required.');
  }

    return jsonResponse({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    }, 404);
  } catch (error: unknown) {
    return internalError(error);
  }
}

if (import.meta.main) {
  Bun.serve({
    hostname: '127.0.0.1',
    port: PORT,
    fetch: handleRequest,
  });

  process.stderr.write(`[Consuelo OS] ${SERVER_NAME} listening on 127.0.0.1:${PORT}\n`);
}

export { handleRequest };

