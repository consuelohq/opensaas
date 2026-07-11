import type { VerificationResult } from '../../lib/security-gateway';

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
  const message = error instanceof Error
    ? error.message.slice(0, 240)
    : 'OS call failed.';
  return jsonResponse({
    ok: false,
    error: { code: 'INTERNAL_SERVER_ERROR', message },
  }, 500);
}

export function invalidRequest(error: unknown): Response {
  return jsonResponse({
    ok: false,
    error: {
      code: 'INVALID_REQUEST',
      message: error instanceof Error
        ? error.message.slice(0, 240)
        : 'Invalid request',
    },
  }, 400);
}
