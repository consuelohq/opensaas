import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTempDir, expectJsonCliSuccess, hasCommand, removeTempDir } from './helpers';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) removeTempDir(dir);
});

describe('media generated fixture integration', () => {
  it.skipIf(!hasCommand('ffmpeg') || !hasCommand('ffprobe'))('should run core probe, frames, timeline, compose, and qa when using a generated tiny mp4', () => {
    const dir = createTempDir('consuelo-media-test-core-');
    tempDirs.push(dir);
    const input = join(dir, 'tiny.mp4');
    const timeline = join(dir, 'timeline.json');
    const output = join(dir, 'out.mp4');

    const generate = spawnSync('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'testsrc=size=320x180:rate=30:duration=1',
      '-f', 'lavfi',
      '-i', 'sine=frequency=1000:duration=1',
      '-shortest',
      input,
    ], { encoding: 'utf8', timeout: 30_000 });
    expect(generate.status, generate.stderr).toBe(0);

    const probe = expectJsonCliSuccess(['probe', '--input', input, '--json']);
    expect(probe.schema).toBe('media.asset.v1');

    const frames = expectJsonCliSuccess(['frames', 'extract', '--input', input, '--timestamp', '0.1', '--out', join(dir, 'frames'), '--json']);
    expect(frames.schema).toBe('media.frame-manifest.v1');

    writeFileSync(timeline, JSON.stringify({
      schema: 'media.timeline.v1',
      id: 'tiny_timeline',
      source: { path: input },
      render: { width: 1080, height: 1920, fps: 30, format: 'mp4', durationSeconds: 1 },
      beats: [{ id: 'beat_001', startSeconds: 0.1, endSeconds: 0.5, type: 'freeze', label: 'fixture freeze' }],
      overlays: [],
      tracks: { captions: null, voiceover: null, music: null },
      provenance: { status: 'fixture', sourceAssetId: 'tiny' },
    }, null, 2));

    const validated = expectJsonCliSuccess(['timeline', 'validate', '--timeline', timeline, '--json']);
    expect(validated.ok).toBe(true);

    const composed = expectJsonCliSuccess(['compose', '--timeline', timeline, '--out', output, '--json'], 60_000);
    expect(composed.schema).toBe('media.render-result.v1');

    const qa = expectJsonCliSuccess(['qa', '--input', output, '--json']);
    expect(qa.schema).toBe('media.render-result.v1');
    expect(qa.qa).toMatchObject({ status: 'passed' });
  });

  it('should satisfy media contract when it skips optional vision integration with a structured missing-profile reason rather than hard failing', () => {
    const result = expectJsonCliSuccess(['doctor', '--profile', 'media-vision-pose', '--json']);
    const text = JSON.stringify(result);

    expect(text).toContain('media-vision-pose');
    expect(text).toMatch(/satisfied|missing|optional/);
  });
});
