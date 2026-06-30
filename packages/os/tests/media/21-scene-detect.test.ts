import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule } from './helpers';

describe('media.scene.detect', () => {
  it('should satisfy media contract when it uses the vision-light profile and emits shot boundaries/candidate moments', async () => {
    const module = await importMediaModule('scripts/lib/media/vision.ts');
    expectFunctionExport(module, 'sceneDetectEffect');
    expectFunctionExport(module, 'sceneDetectForCli');
    expectFunctionExport(module, 'buildSceneDetectFixtureResult');
    expect(module.sceneDetectRequiredProfiles).toEqual(['media-vision-light']);
    expect(module.sceneDetectOutputSchema).toBe('media.scene-detect-result.v1');

    const result = (module.buildSceneDetectFixtureResult as (input: Record<string, unknown>) => Record<string, unknown>)({
      sourcePath: 'fixtures/clip.mp4',
      durationSeconds: 8,
      frameSamples: [
        { timeSeconds: 0, frameId: 'f000', differenceScore: 0 },
        { timeSeconds: 2, frameId: 'f002', differenceScore: 0.72 },
        { timeSeconds: 5, frameId: 'f005', differenceScore: 0.18 },
      ],
    });

    expect(result).toMatchObject({
      schema: 'media.scene-detect-result.v1',
      source: { path: 'fixtures/clip.mp4' },
      profile: 'media-vision-light',
      requiredDependencies: ['python3', 'numpy', 'opencv-python-headless'],
    });
    expect(result.shotBoundaries).toEqual([
      { id: 'shot_001', startSeconds: 0, endSeconds: 2, boundaryTimeSeconds: 2, confidence: 0.72, evidenceFrameIds: ['f000', 'f002'] },
      { id: 'shot_002', startSeconds: 2, endSeconds: 8, boundaryTimeSeconds: 8, confidence: 1, evidenceFrameIds: ['f002', 'f005'] },
    ]);
    expect(result.candidateMoments).toEqual([
      { id: 'moment_001', timeSeconds: 2, type: 'shot-boundary', confidence: 0.72, reason: 'OpenCV frame-difference fixture exceeded scene threshold' },
    ]);
  });

  it('should satisfy media contract when it does not require MediaPipe for scene detection', async () => {
    const module = await importMediaModule('scripts/lib/media/vision.ts');
    expect(module.sceneDetectRequiredDependencies).toEqual(expect.arrayContaining(['opencv-python-headless']));
    expect(module.sceneDetectRequiredDependencies).not.toContain('mediapipe');
  });
});
