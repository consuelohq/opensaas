import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule } from './helpers';

describe('media vision-pose MediaPipe profile', () => {
  it('should satisfy media contract when it models MediaPipe as semantic pose/body-landmark tooling on top of vision-light', async () => {
    const module = await importMediaModule('scripts/lib/media/vision.ts');

    expect(module.visionPoseProfile).toMatchObject({
      id: 'media-vision-pose',
      dependencies: ['python3', 'numpy', 'opencv-python-headless', 'mediapipe'],
    });
    expect(module.visionPoseProfile.dependencies).toContain('mediapipe');
  });

  it('should satisfy media contract when it emits pose tracks with 33 landmark slots per detected pose frame', async () => {
    const module = await importMediaModule('scripts/lib/media/vision.ts');
    expectFunctionExport(module, 'poseEstimateEffect');
    expect(module.poseTrackLandmarkCount).toBe(33);
    expect(module.poseTrackOutputSchema).toBe('media.pose-track.v1');
  });

  it('should satisfy media contract when it requires explicit model bundles and structured missing-model errors', async () => {
    const module = await importMediaModule('scripts/lib/media/vision.ts');
    expect(module.mediapipeModelBundles?.length).toBeGreaterThan(0);
    expect(module.implicitModelDownloads).toBe(false);
    expectFunctionExport(module, 'missingMediapipeModelError');

    const error = (module.missingMediapipeModelError as () => Record<string, unknown>)();
    expect(error).toMatchObject({ schema: 'media.error.v1', dependencyId: 'mediapipe', profile: 'media-vision-pose' });
  });
});
