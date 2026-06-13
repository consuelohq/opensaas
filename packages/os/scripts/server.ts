#!/usr/bin/env bun

import path from 'node:path';

import { executeCall, getSteering } from './os';
import type { CallInput } from './lib/types';
import { createTraceSitesGatewayLiveEndpoints, traceGatewayScopeFromHeaders } from './lib/trace-sites-gateway-live-endpoints';
import { createLocalTraceSitesReadBackend } from './lib/trace-sites-local-read-backend';

const DEFAULT_PORT = 8850;
const PORT = Number(process.env.CONSUELO_OS_PORT ?? process.env.PORT ?? DEFAULT_PORT);
const SERVER_NAME = process.env.CONSUELO_OS_SERVER_NAME ?? 'consuelo-os';
const LEGACY_TOKEN_ENV = process.env.MCP_BEARER_TOKEN;
const BEARER_TOKEN = process.env.CONSUELO_OS_BEARER_TOKEN ?? LEGACY_TOKEN_ENV ?? '';
const TRACE_DB_ENV = process.env.CONSUELO_TRACE_DB ?? process.env.TRACE_DB ?? '';

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

function unauthorized(): Response {
  return jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401);
}

function isAuthorized(request: Request): boolean {
  if (!BEARER_TOKEN) return true;
  return request.headers.get('authorization') === `Bearer ${BEARER_TOKEN}`;
}

async function readCallInput(request: Request): Promise<CallInput> {
  const body = await request.json().catch(() => null) as unknown;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object.');
  }
  const input = body as Partial<CallInput>;
  if (!input.name || typeof input.name !== 'string') {
    throw new Error('Request body requires a string name.');
  }
  return input as CallInput;
}

function resolveTraceDbPath(): string {
  if (TRACE_DB_ENV) return TRACE_DB_ENV;
  const home = process.env.CONSUELO_OS_HOME ?? process.env.CONSUELO_HOME ?? '';
  if (home) return path.join(home, 'traces', 'traces.db');
  return path.join(process.env.HOME ?? '', 'Library/Application Support/OpenWorkspace/traces/e8425497c3ee20bf0a28e9da/traces.db');
}

function isTraceGatewayReadRoute(pathname: string): boolean {
  return pathname === '/gateway/traces/recent' ||
    pathname === '/gateway/traces/summary' ||
    pathname === '/gateway/traces/aggregates' ||
    pathname === '/gateway/traces/events';
}

function traceGatewayEndpoints() {
  return createTraceSitesGatewayLiveEndpoints({
    backend: createLocalTraceSitesReadBackend({ dbPath: resolveTraceDbPath() }),
    resolveScope: traceGatewayScopeFromHeaders,
  });
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
  if (!isAuthorized(request)) return unauthorized();

  if (isTraceGatewayReadRoute(url.pathname) && request.method === 'GET') {
    return traceGatewayEndpoints().handle(request);
  }

  if (url.pathname === '/get_steering' && (request.method === 'GET' || request.method === 'POST')) {
    return textResponse(getSteering());
  }

  if (url.pathname === '/call' && request.method === 'POST') {
    try {
      const result = await executeCall(await readCallInput(request));
      return jsonResponse(result, result.ok ? 200 : 400);
    } catch (error: unknown) {
      return jsonResponse({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: error instanceof Error ? error.message.slice(0, 240) : 'Invalid request',
        },
      }, 400);
    }
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
