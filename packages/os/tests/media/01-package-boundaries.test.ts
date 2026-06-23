import { describe, expect, it } from 'vitest';

import { listRepoFiles, readIfExistsRepo, readPackageJson } from './helpers';

describe('media package boundaries', () => {
  it('adds OS package scripts for running the media facade and focused media suites', () => {
    const pkg = readPackageJson();
    const scripts = pkg.scripts as Record<string, string> | undefined;

    expect(scripts?.media).toBe('bun ./scripts/media.ts');
    expect(scripts?.['media:doctor']).toBe('bun ./scripts/media.ts doctor --json');
    expect(scripts?.['media:install']).toBe('bun ./scripts/media.ts install');
    expect(scripts?.['media:test']).toBe('vitest run tests/media');
    expect(scripts?.['media:test:manifest']).toBe('vitest run tests/media/00-manifest-taxonomy.test.ts tests/media/01-package-boundaries.test.ts tests/media/02-workflow-intent.test.ts');
    expect(scripts?.['media:test:deps']).toBe('vitest run tests/media/03-runtime-dependency-catalog.test.ts tests/media/04-installer-plan.test.ts tests/media/05-doctor.test.ts');
    expect(scripts?.['media:test:core']).toBe('vitest run tests/media/11-core-probe.test.ts tests/media/12-core-frames-extract.test.ts tests/media/13-core-timeline-validate.test.ts tests/media/14-core-compose.test.ts tests/media/15-core-qa.test.ts');
    expect(scripts?.['media:test:ingest']).toBe('vitest run tests/media/16-source-capture-internal.test.ts tests/media/17-media-ingest-source-capture.test.ts tests/media/18-youtube-clip-search.test.ts tests/media/19-youtube-ingest.test.ts');
    expect(scripts?.['media:test:youtube']).toBe('vitest run tests/media/18-youtube-clip-search.test.ts tests/media/19-youtube-ingest.test.ts');
    expect(scripts?.['media:test:audio']).toBe('vitest run tests/media/20-audio-transcribe.test.ts');
    expect(scripts?.['media:test:vision']).toBe('vitest run tests/media/21-scene-detect.test.ts tests/media/22-vision-light-opencv.test.ts tests/media/23-vision-pose-mediapipe.test.ts tests/media/24-motion-track.test.ts');
    expect(scripts?.['media:test:render']).toBe('vitest run tests/media/25-overlay-render.test.ts tests/media/26-sports-science-breakdown.test.ts tests/media/27-export-package.test.ts');
    expect(scripts?.['media:test:handoff']).toBe('vitest run tests/media/28-artifact-handoff.test.ts tests/media/29-storage-budget.test.ts tests/media/30-fixtures-integration.test.ts');
  });

  it('keeps native runtime tools out of package dependencies', () => {
    const pkg = readPackageJson();
    const dependencies = { ...(pkg.dependencies as Record<string, string> | undefined), ...(pkg.devDependencies as Record<string, string> | undefined) };

    for (const forbidden of ['ffmpeg', 'ffprobe', 'yt-dlp', 'mediainfo', 'exiftool', 'imagemagick', 'opencv-python', 'opencv-python-headless', 'mediapipe', 'sox', 'vlc']) {
      expect(Object.keys(dependencies), 'native/runtime dependency should be modeled by media dependency catalog, not package.json: ' + forbidden).not.toContain(forbidden);
    }
    expect(Object.keys(dependencies)).toContain('effect');
  });

  it('keeps media implementation under packages/os and away from workspace/office ownership', () => {
    const workspaceFiles = listRepoFiles('packages/workspace').filter((file) => !file.includes('node_modules'));
    const officeFiles = listRepoFiles('packages/office').concat(listRepoFiles('packages/consuelo-design'));
    const suspiciousWorkspaceMediaFiles = workspaceFiles.filter((file) => /media|ffmpeg|ffprobe|yt-dlp|mediapipe|opencv/i.test(file));
    const suspiciousOfficeMediaFiles = officeFiles.filter((file) => /media\.compose|media\.probe|ffmpeg|ffprobe|yt-dlp|mediapipe|opencv/i.test(file));

    expect(suspiciousWorkspaceMediaFiles, 'workspace should not own media implementation files').toEqual([]);
    expect(suspiciousOfficeMediaFiles, 'office/design should not own media composition/probe implementation files').toEqual([]);
  });

  it('allows office to consume artifact contracts but forbids media importing office', () => {
    const mediaSource = [
      readIfExistsRepo('packages/os/scripts/media.ts'),
      readIfExistsRepo('packages/os/scripts/lib/media/index.ts'),
      readIfExistsRepo('packages/os/scripts/lib/media/artifacts.ts'),
    ].join('\n');

    expect(mediaSource).not.toMatch(/from ['\"].*(office|consuelo-design)/);
    expect(mediaSource).not.toMatch(/import\(.*(office|consuelo-design)/);
  });
});
