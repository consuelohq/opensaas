import fs from 'node:fs';

import { Hono } from 'hono';

import {
  readCoreToolManifest,
  readFullToolManifest,
} from '../../lib/manifest';
import { resolveConsueloHomeLayout } from '../../lib/consuelo-home';
import type { RuntimeBundleManifest } from '../../lib/distribution/runtime-bundle';
import type { LocalOsServerConfig } from '../env';
import { jsonResponse } from '../middleware/errors';

type HealthRouteDependencies = {
  assertReady: () => void | Promise<void>;
  runtimeIdentity?: () => { bundleId?: string; version?: string };
};

const defaultDependencies: HealthRouteDependencies = {
  assertReady: () => {
    readFullToolManifest();
    readCoreToolManifest();
  },
  runtimeIdentity: () => {
    try {
      const manifestPath = `${resolveConsueloHomeLayout().runtimeCurrentDir}/runtime-bundle.manifest.json`;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as RuntimeBundleManifest;
      return { bundleId: manifest.bundleId, version: manifest.version };
    } catch {
      return {};
    }
  },
};

export function createHealthRoutes(
  config: LocalOsServerConfig,
  dependencies: HealthRouteDependencies = defaultDependencies,
): Hono {
  const app = new Hono();
  const resolvedDependencies = { ...defaultDependencies, ...dependencies };

  app.all('/health', async () => {
    try {
      await resolvedDependencies.assertReady();
      const runtimeIdentity = resolvedDependencies.runtimeIdentity?.() ?? {};
      return jsonResponse({
        status: 'ok',
        name: config.name,
        runtime: 'bun',
        toolNames: ['get_steering', 'call'],
        tools: 2,
        protocols: ['mcp'],
        endpoints: ['/mcp'],
        port: config.port,
        ...runtimeIdentity,
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
