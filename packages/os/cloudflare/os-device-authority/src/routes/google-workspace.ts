import type { Hono } from 'hono';

import { json } from '../http';
import type { DeviceAuthorityRuntime } from '../types';
import { authenticateSignedNodeRequest } from './github-source-control';

function unavailable(message: string): Response {
  return json(
    { error: { code: 'GOOGLE_WORKSPACE_OAUTH_UNAVAILABLE', message } },
    { status: 503, headers: { 'cache-control': 'no-store' } },
  );
}

async function handleOAuthClient(request: Request, runtime: DeviceAuthorityRuntime): Promise<Response> {
  let auth;
  try {
    auth = await authenticateSignedNodeRequest(request, runtime);
  } catch {
    return json(
      {
        error: {
          code: 'GOOGLE_WORKSPACE_NODE_AUTH_FAILED',
          message: 'Consuelo could not verify this node for Google authorization.',
        },
      },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
  if (auth instanceof Response) return auth;
  const clientId = runtime.googleWorkspaceOAuthClientId?.trim() ?? '';
  const clientSecret = runtime.googleWorkspaceOAuthClientSecret?.trim() ?? '';
  if (!clientId || !clientSecret) {
    return unavailable('Google Workspace authorization is not configured for this Consuelo environment.');
  }
  return json(
    {
      credentials: {
        installed: {
          client_id: clientId,
          client_secret: clientSecret,
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
          redirect_uris: ['http://localhost'],
        },
      },
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export function registerGoogleWorkspaceRoutes(app: Hono, runtime: DeviceAuthorityRuntime): void {
  app.post('/workspace/google/oauth-client', (context) =>
    handleOAuthClient(context.req.raw, runtime));
}
