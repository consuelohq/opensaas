import { Hono } from 'hono';

import {
  readCoreToolManifest,
  readFullToolManifest,
} from '../../lib/manifest';
import type { LocalOsServerConfig } from '../env';
import { jsonResponse } from '../middleware/errors';

type HealthRouteDependencies = {
  assertReady: () => void | Promise<void>;
};

const defaultDependencies: HealthRouteDependencies = {
  assertReady: () => {
    readFullToolManifest();
    readCoreToolManifest();
  },
};

export function createHealthRoutes(
  config: LocalOsServerConfig,
  dependencies: HealthRouteDependencies = defaultDependencies,
): Hono {
  const app = new Hono();

  app.all('/health', async () => {
    try {
      await dependencies.assertReady();
      return jsonResponse({
        status: 'ok',
        name: config.name,
        runtime: 'bun',
        toolNames: ['get_steering', 'call'],
        tools: 2,
        protocols: ['mcp'],
        endpoints: ['/mcp'],
        port: config.port,
      });
    } catch {
      return jsonResponse({
        status: 'unavailable',
        name: config.name,
        error: {
          code: 'OS_RUNTIME_NOT_READY',
          message: 'Consuelo OS runtime is not ready.',
        },
      }, 503);
    }
  });

  return app;
}
