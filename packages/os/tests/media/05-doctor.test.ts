import { describe, expect, it } from 'vitest';

import { expectJsonCliSuccess, importMediaModule } from './helpers';

describe('media doctor', () => {
  it('checks dependency profiles without installing anything', async () => {
    const module = await importMediaModule('scripts/lib/media/dependencies.ts');
    expect(typeof module.checkMediaDependenciesEffect).toBe('function');
    expect(typeof module.checkMediaDependenciesForCli).toBe('function');
  });

  it('reports dependency status as media.dependency-report.v1 JSON', () => {
    const json = expectJsonCliSuccess(['doctor', '--profile', 'media-core', '--json']);

    expect(json.schema).toBe('media.dependency-report.v1');
    expect(json.profiles).toBeDefined();
    expect(JSON.stringify(json)).toContain('media-core');
    expect(JSON.stringify(json)).toContain('ffmpeg');
    expect(JSON.stringify(json)).toContain('ffprobe');
    expect(JSON.stringify(json)).toContain('estimated');
    expect(JSON.stringify(json)).not.toMatch(/installed .*during doctor/i);
  });

  it('reports optional profile status separately from required core status', () => {
    const json = expectJsonCliSuccess(['doctor', '--all-profiles', '--json']);
    const text = JSON.stringify(json);

    expect(text).toContain('media-core');
    expect(text).toContain('media-youtube');
    expect(text).toContain('media-audio');
    expect(text).toContain('media-vision-light');
    expect(text).toContain('media-vision-pose');
    expect(text).toContain('optional');
  });
});
