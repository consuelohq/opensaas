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
import type { WorkerRuntimeState } from '../worker-runtime-state';

type HealthRouteDependencies = {
  assertReady?: () => void | Promise<void>;
  runtimeIdentity?: () => { bundleId?: string; version?: string };
  workerState?: WorkerRuntimeState;
};

const defaultDependencies: Required<Pick<HealthRouteDependencies, 'assertReady' | 'runtimeIdentity'>> = {
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
  dependencies: HealthRouteDependencies = {},
): Hono {
  const app = new Hono();
  const resolvedDependencies = {
    ...defaultDependencies,
    ...dependencies,
    assertReady: dependencies.assertReady ?? defaultDependencies.assertReady,
    runtimeIdentity: dependencies.runtimeIdentity ?? defaultDependencies.runtimeIdentity,
  };

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

  app.get('/ready', async () => {
    const worker = resolvedDependencies.workerState?.snapshot();
    const workerIdentity = worker ? {
      workerId: worker.workerId,
      workerInstanceId: worker.workerInstanceId,
      draining: worker.draining,
    } : {};
    if (worker?.draining) {
      return jsonResponse({
        status: 'unavailable',
        name: config.name,
        ...workerIdentity,
        error: {
          code: 'OS_WORKER_DRAINING',
          message: 'Consuelo OS worker is draining.',
        },
      }, 503);
    }
    try {
      await resolvedDependencies.assertReady();
      const runtimeIdentity = resolvedDependencies.runtimeIdentity?.() ?? {};
      return jsonResponse({
        status: 'ready',
        name: config.name,
        port: config.port,
        ...runtimeIdentity,
        ...workerIdentity,
      });
    } catch {
      return jsonResponse({
        status: 'unavailable',
        name: config.name,
        ...workerIdentity,
        error: {
          code: 'OS_RUNTIME_NOT_READY',
          message: 'Consuelo OS runtime is not ready.',
        },
      }, 503);
    }
  });

  return app;
}
