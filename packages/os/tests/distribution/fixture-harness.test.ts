import { describe, expect, it } from 'vitest';

import { FakePlatformService } from '../../scripts/testing/distribution/fake-platform-service';
import {
  DistributionFailureInjector,
  distributionInstallFixtures,
  signFixtureManifest,
  verifyFixtureManifest,
} from '../../scripts/testing/distribution/fixtures';
import { startRuntimeFixtureServer } from '../../scripts/testing/distribution/runtime-fixture-server';

describe('distribution fixture harness', () => {
  it('should expose all required install states as deterministic fixtures', () => {
    expect(Object.keys(distributionInstallFixtures).sort()).toEqual([
      'corrupted-current-link',
      'current-install',
      'interrupted-install',
      'modified-managed-content',
      'n-minus-one-install',
      'no-install',
    ]);
  });

  it('should reject a signed fixture manifest when its payload is changed', async () => {
    const signed = await signFixtureManifest({
      bundleDigest: 'sha256:fixture',
      channel: 'dev',
      schemaVersion: 1,
      version: '0.0.0-fixture.1',
    });

    expect(await verifyFixtureManifest(signed)).toBe(true);
    expect(
      await verifyFixtureManifest({
        ...signed,
        payload: { ...signed.payload, version: '0.0.0-tampered' },
      }),
    ).toBe(false);
  });

  it('should serve manifests and bundles without external network access', async () => {
    const fixture = await startRuntimeFixtureServer();

    try {
      const manifest = await fetch(`${fixture.baseUrl}/channels/dev.json`);
      const bundle = await fetch(`${fixture.baseUrl}/bundles/runtime.tar.gz`);

      expect(manifest.status).toBe(200);
      expect(await manifest.json()).toMatchObject({
        payload: { channel: 'dev', schemaVersion: 1 },
      });
      expect(await bundle.text()).toBe('fixture-runtime');
    } finally {
      await fixture.close();
    }
  });

  it('should inject failures at owned lifecycle boundaries', async () => {
    const injector = new DistributionFailureInjector().failAt('health');
    const service = new FakePlatformService('restart');

    expect(() => injector.throwIfInjected('health')).toThrow(
      'Injected distribution failure at health.',
    );
    await expect(service.run('restart')).rejects.toThrow(
      'Injected platform service failure at restart.',
    );
    expect(service.operations).toEqual(['restart']);
  });
});
