import { Hono } from 'hono';

import {
  loadLocalOsServerConfig,
  type LocalOsServerConfig,
} from './env';
import { internalError } from './middleware/errors';
import { routeNotFoundResponse } from './middleware/fallback';
import { createCallRoutes } from './routes/call';
import { createHealthRoutes } from './routes/health';
import { createMcpRoutes } from './routes/mcp';
import { createSettingsRoutes } from './routes/settings';
import { createSteeringRoutes } from './routes/steering';
import { createTraceRoutes } from './routes/traces';

export function createLocalOsApp(
  config: LocalOsServerConfig = loadLocalOsServerConfig(),
): Hono {
  const app = new Hono();

  app.route('/', createHealthRoutes(config));
  app.route('/', createTraceRoutes());
  app.route('/', createSettingsRoutes());
  app.route('/', createMcpRoutes());
  app.route('/', createSteeringRoutes());
  app.route('/', createCallRoutes());

  app.notFound(() => routeNotFoundResponse());

  app.onError((error) => internalError(error));
  return app;
}

const defaultApp = createLocalOsApp();

export function handleRequest(request: Request): Promise<Response> {
  return defaultApp.fetch(request);
}
