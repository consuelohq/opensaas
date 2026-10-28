import type { VerificationResult } from '../../lib/security-gateway';
import { logLocalOsServerError } from '../logger';

type JsonObject = Record<string, unknown>;

export function jsonResponse(body: JsonObject, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

export function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
    },
  });
}

export function unauthorized(
  code = 'UNAUTHORIZED',
  message = 'Unauthorized',
  headers: HeadersInit = {},
): Response {
  const response = jsonResponse({ error: { code, message } }, 401);
  for (const [key, value] of new Headers(headers).entries()) {
    response.headers.set(key, value);
  }
  return response;
}

export function verificationResponse(
  result: Extract<VerificationResult, { ok: false }>,
): Response {
  return jsonResponse({ error: result.error }, result.status);
}

export function internalError(error: unknown): Response {
  logLocalOsServerError('local_os.internal_error', error, {
    code: 'INTERNAL_SERVER_ERROR',
    status: 500,
  });
  return jsonResponse({
    ok: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'OS request failed.',
    },
  }, 500);
}

export function invalidRequest(error: unknown): Response {
  logLocalOsServerError('local_os.invalid_request', error, {
    code: 'INVALID_REQUEST',
    status: 400,
  });
  return jsonResponse({
    ok: false,
    error: {
      code: 'INVALID_REQUEST',
      message: 'Invalid request.',
    },
  }, 400);
}
