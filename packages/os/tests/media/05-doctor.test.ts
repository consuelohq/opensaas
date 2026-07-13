import { describe, expect, it } from 'vitest';

import { expectJsonCliSuccess, importMediaModule } from './helpers';

describe('media doctor', () => {
  it('should satisfy media contract when it checks dependency profiles without installing anything', async () => {
    const module = await importMediaModule('scripts/lib/media/dependencies.ts');
    expect(typeof module.checkMediaDependenciesEffect).toBe('function');
    expect(typeof module.checkMediaDependenciesForCli).toBe('function');
  });

  it('should satisfy media contract when it reports dependency status as media.dependency-report.v1 JSON', () => {
    const json = expectJsonCliSuccess(['doctor', '--profile', 'media-core', '--json']);

    expect(json.schema).toBe('media.dependency-report.v1');
    const profiles = json.profiles as Record<string, unknown>;
    const coreProfile = profiles['media-core'] as { dependencies?: Array<{ id?: string; commands?: Array<{ name?: string }> }> };
    const dependencies = coreProfile.dependencies ?? [];
    const dependencyIds = dependencies.map((dependency) => dependency.id);
    const commandNames = dependencies.flatMap((dependency) => dependency.commands ?? []).map((command) => command.name);

    expect(profiles['media-core']).toBeDefined();
    expect(dependencyIds).toContain('ffmpeg');
    expect(commandNames).toEqual(expect.arrayContaining(['ffmpeg', 'ffprobe']));
    expect(json.estimatedInstalledSizeMb ?? coreProfile).toBeDefined();
    expect(json).not.toHaveProperty('installedDuringDoctor');
  });

  it('should satisfy media contract when it reports optional profile status separately from required core status', () => {
    const json = expectJsonCliSuccess(['doctor', '--all-profiles', '--json']);
    const profiles = json.profiles as Record<string, { optional?: boolean }>;

    expect(Object.keys(profiles)).toEqual(expect.arrayContaining(['media-core', 'media-youtube', 'media-audio', 'media-vision-light', 'media-vision-pose']));
    expect(profiles['media-youtube']?.optional).toBe(true);
    expect(profiles['media-audio']?.optional).toBe(true);
    expect(profiles['media-vision-light']?.optional).toBe(true);
    expect(profiles['media-vision-pose']?.optional).toBe(true);
  });
});
