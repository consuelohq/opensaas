import { describe, expect, it, vi } from 'vitest';

import { createHealthRoutes } from '../scripts/server/routes/health';
import { runDrainAndExit } from '../scripts/server/main';
import { createWorkerRuntimeState } from '../scripts/server/worker-runtime-state';

describe('local OS health readiness', () => {
  it('should return unavailable when runtime manifests cannot be read', async () => {
    const app = createHealthRoutes(
      { name: 'consuelo-os', port: 46321 },
      {
        assertReady: () => {
          throw new Error('/private/path/tool.manifest.json was not found');
        },
      },
    );

    const response = await app.request('http://127.0.0.1:46321/health');
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(body)).toEqual({
      status: 'unavailable',
      name: 'consuelo-os',
      error: {
        code: 'OS_RUNTIME_NOT_READY',
        message: 'Consuelo OS runtime is not ready.',
      },
    });
    expect(body).not.toContain('/private/path');
  });

  it('should report the active runtime identity for lifecycle acceptance', async () => {
    const app = createHealthRoutes(
      { name: 'consuelo-os', port: 46321 },
      {
        assertReady: () => {},
        runtimeIdentity: () => ({ bundleId: 'bundle-active', version: '2.3.4' }),
      },
    );

    const response = await app.request('http://127.0.0.1:46321/health');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      name: 'consuelo-os',
      bundleId: 'bundle-active',
      version: '2.3.4',
    });
  });

  it('should expose worker readiness and fail closed once draining starts', async () => {
    const workerState = createWorkerRuntimeState({
      workerId: 'worker-1',
      workerInstanceId: 'instance-9',
    });
    const app = createHealthRoutes(
      { name: 'consuelo-os', port: 46322 },
      {
        assertReady: () => {},
        workerState,
      },
    );

    const ready = await app.request('http://127.0.0.1:46322/ready');
    expect(ready.status).toBe(200);
    await expect(ready.json()).resolves.toMatchObject({
      status: 'ready',
      name: 'consuelo-os',
      workerId: 'worker-1',
      workerInstanceId: 'instance-9',
      draining: false,
    });

    workerState.startDraining();
    const draining = await app.request('http://127.0.0.1:46322/ready');
    expect(draining.status).toBe(503);
    await expect(draining.json()).resolves.toMatchObject({
      status: 'unavailable',
      name: 'consuelo-os',
      workerId: 'worker-1',
      workerInstanceId: 'instance-9',
      error: { code: 'OS_WORKER_DRAINING' },
    });
  });

  it('should allow partial dependency overrides and retain default readiness checks', async () => {
    const workerState = createWorkerRuntimeState({
      workerId: 'worker-2',
      workerInstanceId: 'instance-partial',
    });
    const app = createHealthRoutes(
      { name: 'consuelo-os', port: 46323 },
      { workerState },
    );

    const response = await app.request('http://127.0.0.1:46323/ready');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ready',
      workerId: 'worker-2',
      workerInstanceId: 'instance-partial',
    });
  });

  it('should report drain failures and exit nonzero', async () => {
    const exit = vi.fn();
    const report = vi.fn();

    await runDrainAndExit(async () => {
      throw new Error('Invalid OS worker drain timeout');
    }, { exit, report });

    expect(report).toHaveBeenCalledWith(expect.stringContaining('Invalid OS worker drain timeout'));
    expect(exit).toHaveBeenCalledWith(1);
  });
});
