import { Hono } from 'hono';

import {
  loadLocalOsServerConfig,
  type LocalOsServerConfig,
} from './env';
import { internalError, jsonResponse } from './middleware/errors';
import { routeNotFoundResponse } from './middleware/fallback';
import { createArtifactRoutes } from './routes/artifacts';
import { createCallRoutes } from './routes/call';
import { createHealthRoutes } from './routes/health';
import { createMcpRoutes } from './routes/mcp';
import { createConfigurationRoutes } from './routes/settings';
import { createEnvironmentRoutes } from './routes/environments';
import { createSecretRoutes } from './routes/secrets';
import { createSteeringRoutes } from './routes/steering';
import { createTraceRoutes } from './routes/traces';
import {
  createWorkerRuntimeStateFromEnv,
  type WorkerRuntimeState,
} from './worker-runtime-state';

type LocalOsAppOptions = {
  workerState?: WorkerRuntimeState;
};

const isProbePath = (pathname: string): boolean =>
  pathname === '/health' || pathname === '/ready';

export function createLocalOsApp(
  config: LocalOsServerConfig = loadLocalOsServerConfig(),
  options: LocalOsAppOptions = {},
): Hono {
  const app = new Hono();
  const workerState = options.workerState ?? createWorkerRuntimeStateFromEnv();

  app.use('*', async (context, next) => {
    const pathname = new URL(context.req.url).pathname;
    if (isProbePath(pathname)) {
      await next();
      return;
    }
    if (!workerState.beginRequest()) {
      return jsonResponse({
        status: 'unavailable',
        name: config.name,
        ...workerState.snapshot(),
        error: {
          code: 'OS_WORKER_DRAINING',
          message: 'Consuelo OS worker is draining.',
        },
      }, 503);
    }
    try {
      await next();
    } finally {
      workerState.endRequest();
    }
  });

  app.route('/', createHealthRoutes(config, { workerState }));
  app.route('/', createArtifactRoutes());
  app.route('/', createTraceRoutes());
  app.route('/', createConfigurationRoutes());
  app.route('/', createEnvironmentRoutes());
  app.route('/', createSecretRoutes());
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
