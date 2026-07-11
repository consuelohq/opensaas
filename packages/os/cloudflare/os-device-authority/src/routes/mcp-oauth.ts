import type { Hono } from 'hono';

import { methodNotAllowed } from '../http';
import type { DeviceAuthorityRuntime } from '../types';
import { googleConfig } from '../services/google-oauth';
import {
  exchangeMcpOAuthToken,
  finishMcpOAuthGoogleCallback,
  introspectMcpOAuthToken,
  invalidOauthRequest,
  startMcpOAuthAuthorization,
} from '../services/mcp-oauth';

async function handleMcpOAuthRequest(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const input = runtime;
    const origin = runtime.origin;
    const now = runtime.now;
    const fetchImpl = runtime.fetchImpl;

    if (url.pathname === '/oauth/authorize') {
      if (request.method !== 'GET') return methodNotAllowed('GET');
      const google = googleConfig({
        clientId: input.googleOAuthClientId,
        clientSecret: input.googleOAuthClientSecret,
      });
      if (!google)
        return invalidOauthRequest(
          'temporarily_unavailable',
          'Google approval is not configured yet.',
          503,
        );
      return await startMcpOAuthAuthorization({
        request,
        store: input.store,
        origin,
        googleClientId: google.clientId,
        nowMs: now(),
      });
    }
    if (url.pathname === '/oauth/google/callback') {
      if (request.method !== 'GET') return methodNotAllowed('GET');
      const google = googleConfig({
        clientId: input.googleOAuthClientId,
        clientSecret: input.googleOAuthClientSecret,
      });
      if (!google)
        return invalidOauthRequest(
          'temporarily_unavailable',
          'Google approval is not configured yet.',
          503,
        );
      return await finishMcpOAuthGoogleCallback({
        request,
        store: input.store,
        origin,
        googleClientId: google.clientId,
        googleClientSecret: google.clientSecret,
        fetchImpl,
        googleRedirectUri: new URL('/oauth/google/callback', origin).toString(),
        nowMs: now(),
      });
    }
    if (url.pathname === '/oauth/token') {
      if (request.method !== 'POST') return methodNotAllowed('POST');
      return await exchangeMcpOAuthToken({
        request,
        store: input.store,
        nowMs: now(),
      });
    }
    if (url.pathname === '/oauth/introspect') {
      if (request.method !== 'POST') return methodNotAllowed('POST');
      return await introspectMcpOAuthToken({
        request,
        store: input.store,
        nowMs: now(),
      });
    }
    return new Response('Not found\n', { status: 404 });
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('MCP OAuth request failed');
  }
}

export function registerMcpOAuthRoutes(
  app: Hono,
  runtime: DeviceAuthorityRuntime,
): void {
  const handle = (request: Request) => handleMcpOAuthRequest(request, runtime);
  app.all('/oauth/authorize', (context) => handle(context.req.raw));
  app.all('/oauth/google/callback', (context) => handle(context.req.raw));
  app.all('/oauth/token', (context) => handle(context.req.raw));
  app.all('/oauth/introspect', (context) => handle(context.req.raw));
}
