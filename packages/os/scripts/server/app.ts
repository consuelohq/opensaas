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
import { createDiffsRoutes } from './routes/diffs';
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

function trackResponseCompletion(
  response: Response,
  onSettled: () => void,
): Response {
  if (!response.body) {
    onSettled();
    return response;
  }

  const reader = response.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          controller.close();
          onSettled();
          return;
        }
        controller.enqueue(result.value);
      } catch (error: unknown) {
        onSettled();
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        onSettled();
      }
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

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
    let released = false;
    const releaseRequest = (): void => {
      if (released) return;
      released = true;
      workerState.endRequest();
    };
    try {
      await next();
      if (context.req.raw.method === 'HEAD') {
        releaseRequest();
        return;
      }
      context.res = trackResponseCompletion(context.res, releaseRequest);
    } catch (error: unknown) {
      releaseRequest();
      throw error;
    }
  });

  app.route('/', createHealthRoutes(config, { workerState }));
  app.route('/', createArtifactRoutes());
  app.route('/', createTraceRoutes());
  app.route('/', createConfigurationRoutes());
  app.route('/', createEnvironmentRoutes());
  app.route('/', createDiffsRoutes());
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
