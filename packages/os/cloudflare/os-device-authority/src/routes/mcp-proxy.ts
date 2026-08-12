import type { Hono } from 'hono';

import type { DeviceAuthorityRuntime } from '../types';
import { proxyCentralMcpRequest } from '../services/mcp-proxy';

export function registerMcpProxyRoutes(
  app: Hono,
  runtime: DeviceAuthorityRuntime,
): void {
  const proxy = (request: Request) =>
    proxyCentralMcpRequest({
      request,
      store: runtime.store,
      origin: runtime.origin,
      nowMs: runtime.now(),
      routeRegistry: runtime.workspaceRouteRegistry,
      internalSigningSecret: runtime.workspaceEdgeInternalSigningSecret,
      operationalLogger: runtime.operationalLogger,
      fetchImpl: runtime.fetchImpl,
    });
  app.all('/mcp', (context) => proxy(context.req.raw));
  app.all('/mcp/*', (context) => proxy(context.req.raw));
}
