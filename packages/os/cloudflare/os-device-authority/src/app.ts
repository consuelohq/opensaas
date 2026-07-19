import { Hono } from 'hono';

import { ORIGIN } from './constants';
import { json } from './http';
import { registerDeviceRoutes } from './routes/device';
import { registerGoogleOAuthRoutes } from './routes/google-oauth';
import { registerHealthRoutes } from './routes/health';
import { registerMcpOAuthRoutes } from './routes/mcp-oauth';
import { registerMcpProxyRoutes } from './routes/mcp-proxy';
import { registerWorkspaceAgentRoutes } from './routes/workspace-agents';
import type {
  DefaultSiteSnapshot,
  DeviceAuthorityRuntime,
  Store,
  WorkspaceConnectorProvisioner,
  WorkspaceRouteRegistryBinding,
} from './types';

export type CreateDeviceAuthorityHandlerInput = {
  store: Store;
  origin?: string;
  now?: () => number;
  approvalAssertionSecret?: string;
  googleOAuthClientId?: string;
  googleOAuthClientSecret?: string;
  fetchImpl?: typeof fetch;
  workspaceRouteRegistry?: WorkspaceRouteRegistryBinding;
  workspaceConnectorProvisioner?: WorkspaceConnectorProvisioner;
  workspaceEdgeInternalSigningSecret?: string;
  defaultSiteSnapshot?: DefaultSiteSnapshot;
};

export function createOsDeviceAuthorityApp(
  input: CreateDeviceAuthorityHandlerInput,
): Hono {
  const runtime: DeviceAuthorityRuntime = {
    ...input,
    origin: input.origin ?? ORIGIN,
    now: input.now ?? Date.now,
    fetchImpl: input.fetchImpl ?? ((url, init) => globalThis.fetch(url, init)),
  };
  const app = new Hono();

  registerHealthRoutes(app, runtime);
  registerMcpProxyRoutes(app, runtime);
  registerMcpOAuthRoutes(app, runtime);
  registerGoogleOAuthRoutes(app, runtime);
  registerDeviceRoutes(app, runtime);
  registerWorkspaceAgentRoutes(app, runtime);

  app.notFound(() => new Response('Not found\n', { status: 404 }));
  app.onError(() => json({ error: 'server_error' }, { status: 500 }));

  return app;
}

export function createOsDeviceAuthorityHandler(
  input: CreateDeviceAuthorityHandlerInput,
): (request: Request) => Promise<Response> {
  const app = createOsDeviceAuthorityApp(input);
  return (request) => app.fetch(request);
}
