import { describe, expect, it } from 'vitest';

import { expectJsonCliSuccess, importMediaModule } from './helpers';

describe('media storage budget', () => {
  it('declares size estimates for every dependency and computed profile budget', async () => {
    const module = await importMediaModule('scripts/lib/media/dependency-catalog.ts');
    const dependencies = module.mediaRuntimeDependencies as Array<{ id: string; estimatedInstalledSizeMb?: number }>;
    const profiles = module.mediaDependencyProfiles as Array<{ id: string; estimatedInstalledSizeMb?: number }>;

    for (const dependency of dependencies) {
      expect(typeof dependency.estimatedInstalledSizeMb, dependency.id + ' should estimate installed size').toBe('number');
      expect(dependency.estimatedInstalledSizeMb).toBeGreaterThanOrEqual(0);
    }
    for (const profile of profiles) {
      expect(typeof profile.estimatedInstalledSizeMb, profile.id + ' should compute installed size').toBe('number');
    }
  });

  it('keeps default profiles small and warns when selected profiles exceed budget', async () => {
    const module = await importMediaModule('scripts/lib/media/dependency-catalog.ts');
    const profiles = module.mediaDependencyProfiles as Array<{ id: string; estimatedInstalledSizeMb: number }>;
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));

    expect(byId.get('media-core')?.estimatedInstalledSizeMb).toBeLessThanOrEqual(600);
    expect((byId.get('media-core')?.estimatedInstalledSizeMb ?? 0) + (byId.get('media-youtube')?.estimatedInstalledSizeMb ?? 0)).toBeLessThanOrEqual(800);
    expect((byId.get('media-core')?.estimatedInstalledSizeMb ?? 0) + (byId.get('media-vision-light')?.estimatedInstalledSizeMb ?? 0)).toBeLessThanOrEqual(1536);

    const json = expectJsonCliSuccess(['install', '--profile', 'media-core', '--profile', 'media-vision-pose', '--dry-run', '--json', '--max-estimated-size-mb', '500']);
    expect(json.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/budget|size|estimate/i)]));
  });

  it('counts model bundles separately from package installs', async () => {
    const module = await importMediaModule('scripts/lib/media/dependency-catalog.ts');
    const bundles = module.mediaModelBundles as Array<{ id: string; dependencyId: string; estimatedInstalledSizeMb: number; implicit: boolean }>;

    expect(bundles.length).toBeGreaterThan(0);
    for (const bundle of bundles) {
      expect(bundle.implicit, bundle.id + ' model bundle should never be implicit').toBe(false);
      expect(bundle.estimatedInstalledSizeMb).toBeGreaterThan(0);
    }
  });
});
