#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';

import { executeCall, getSteering } from './os';
import {
  loadGatewaySecurityConfig,
  verifyMachineRequest,
  type VerificationResult,
} from './lib/security-gateway';
import type { CallInput } from './lib/types';

const DEFAULT_PORT = 8850;
const PORT = Number(process.env.CONSUELO_OS_PORT ?? process.env.PORT ?? DEFAULT_PORT);
const SERVER_NAME = process.env.CONSUELO_OS_SERVER_NAME ?? 'consuelo-os';
const AUTH_CONFIG_ENV = process.env.CONSUELO_OS_AUTH_CONFIG ?? '';

type JsonObject = Record<string, unknown>;
type ToolCategory = 'read' | 'write' | 'dangerous';

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

function verificationResponse(result: Extract<VerificationResult, { ok: false }>): Response {
  return jsonResponse({ error: result.error }, result.status);
}

function candidateHomeAuthPaths(): string[] {
  const homes = [process.env.CONSUELO_OS_HOME, process.env.CONSUELO_HOME].filter((home): home is string => Boolean(home));
  return [...new Set(homes)].map((home) => path.join(home, 'security', 'generated', 'auth.json'));
}

function resolveAuthConfigPath(): string | null {
  if (AUTH_CONFIG_ENV) return AUTH_CONFIG_ENV;
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

function loadAuthConfigForRequest(): ReturnType<typeof loadGatewaySecurityConfig> {
  const authConfigPath = resolveAuthConfigPath();
  if (!authConfigPath) {
    throw new Error('Generated Consuelo OS auth config is required.');
  }
  return loadGatewaySecurityConfig({ authConfigPath });
}

function toolCategory(toolName: string): ToolCategory {
  if (/^(task\.merge|task\.finish|task\.pr|task\.push|delete|trash)/.test(toolName)) return 'dangerous';
  if (/(write|patch|create|update|start|apply|modify|archive|send|forward|run|call)$/.test(toolName)) return 'write';
  if (/(^|\.)(write|patch|trash|delete|create|update|send|archive|forward)(\.|$)/.test(toolName)) return 'write';
  return 'read';
}

function requiredToolScope(toolName: string): string {
  return `tool:${toolName}:${toolCategory(toolName)}`;
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

function healthResponse(): Response {
  return jsonResponse({
    status: 'ok',
    name: SERVER_NAME,
    runtime: 'bun',
    toolNames: ['get_steering', 'call'],
    tools: 2,
    port: PORT,
  });
}

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/health') return healthResponse();

  if (url.pathname === '/get_steering' && (request.method === 'GET' || request.method === 'POST')) {
    const body = request.method === 'GET' ? '' : await request.clone().text();
    const denied = await authorizeSignedRequest({
      request,
      path: '/get_steering',
      body,
      requiredScope: 'route:/get_steering:read',
    });
    if (denied) return denied;
    return textResponse(getSteering());
  }

  if (url.pathname === '/call' && request.method === 'POST') {
    const body = await request.clone().text();
    let input: CallInput;
    try {
      input = parseCallInput(body);
    } catch (error: unknown) {
      return invalidRequest(error);
    }

    const denied = await authorizeSignedRequest({
      request,
      path: '/call',
      body,
      requiredScope: requiredToolScope(input.name),
    });
    if (denied) return denied;

    try {
      const result = await executeCall(input);
      return jsonResponse(result, result.ok ? 200 : 400);
    } catch (error: unknown) {
      return invalidRequest(error);
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

