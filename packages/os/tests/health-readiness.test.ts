import { describe, expect, it } from 'vitest';

import { createHealthRoutes } from '../scripts/server/routes/health';

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

});
