import type { Hono } from 'hono';

import { json } from '../http';
import type { DeviceAuthorityRuntime } from '../types';
import {
  authorizationServerMetadata,
  oauthProtectedResourceMetadata,
} from '../services/mcp-oauth';

export function registerHealthRoutes(
  app: Hono,
  runtime: DeviceAuthorityRuntime,
): void {
  app.all('/', () =>
    Response.redirect(new URL('/login/device', runtime.origin), 302),
  );
  app.all('/health', () =>
    json({
      ok: true,
      service: 'consuelo-os-device-authority',
      connector_provisioning_configured: Boolean(
        runtime.workspaceRouteRegistry?.exec &&
        runtime.workspaceConnectorProvisioner,
      ),
    }),
  );
  app.all('/.well-known/oauth-authorization-server', () =>
    json(authorizationServerMetadata(runtime.origin)),
  );
  const protectedResource = () =>
    json(oauthProtectedResourceMetadata(runtime.origin));
  app.all('/.well-known/oauth-protected-resource', protectedResource);
  app.all('/.well-known/oauth-protected-resource/mcp', protectedResource);
}
