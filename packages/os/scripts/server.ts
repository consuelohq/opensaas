#!/usr/bin/env bun

import { executeCall, getSteering } from './os';
import type { CallInput } from './lib/types';

const DEFAULT_PORT = 8850;
const PORT = Number(process.env.CONSUELO_OS_PORT ?? process.env.PORT ?? DEFAULT_PORT);
const SERVER_NAME = process.env.CONSUELO_OS_SERVER_NAME ?? 'consuelo-os';
const BEARER_TOKEN = process.env.CONSUELO_OS_BEARER_TOKEN ?? '';
const AUTH_CONFIG_PATH = process.env.CONSUELO_OS_AUTH_CONFIG ?? '';

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

function hasGeneratedAuthConfig(): boolean {
  return Boolean(BEARER_TOKEN || AUTH_CONFIG_PATH);
}

function isAuthorized(request: Request): boolean {
  if (!hasGeneratedAuthConfig()) return false;
  if (!BEARER_TOKEN) return false;
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
  if (!hasGeneratedAuthConfig()) {
    return unauthorized('CONSUELO_AUTH_REQUIRED', 'Generated Consuelo OS auth is required.');
  }
  if (!isAuthorized(request)) return unauthorized();

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

