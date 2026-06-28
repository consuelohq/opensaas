import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule } from './helpers';

describe('media vision-light OpenCV profile', () => {
  it('should satisfy media contract when it models OpenCV as generic motion/computer vision separate from MediaPipe pose', async () => {
    const module = await importMediaModule('scripts/lib/media/vision.ts');

    expect(module.visionLightProfile).toMatchObject({
      id: 'media-vision-light',
      dependencies: ['python3', 'numpy', 'opencv-python-headless'],
    });
    expect(module.visionLightProfile.dependencies).not.toContain('opencv-python');
    expect(module.visionLightProfile.dependencies).not.toContain('mediapipe');
    expect(module.visionLightProfile.semanticLayer).toBe('generic-motion-computer-vision');
  });

  it('should satisfy media contract when it exposes OpenCV-backed motion/object/camera tools without body landmark semantics', async () => {
    const module = await importMediaModule('scripts/lib/media/vision.ts');
    for (const exportName of ['motionTrackEffect', 'objectTrackEffect', 'cameraMotionEffect', 'buildMotionTrackFixtureResult', 'buildObjectTrackFixtureResult', 'buildCameraMotionFixtureResult']) {
      expectFunctionExport(module, exportName);
    }
    expect(module.opencvToolRoles).toEqual(expect.arrayContaining(['optical-flow', 'feature-tracking', 'frame-differencing', 'camera-motion']));
    expect(module.opencvToolRoles).not.toContain('pose-landmarks');

    const motion = (module.buildMotionTrackFixtureResult as (input: Record<string, unknown>) => Record<string, unknown>)({
      sourcePath: 'fixtures/clip.mp4',
      points: [
        { id: 'p1', start: [10, 12], end: [14, 18], startSeconds: 0, endSeconds: 1 },
      ],
    });
    expect(motion).toMatchObject({ schema: 'media.motion-track.v1', method: 'opencv-optical-flow-fixture' });
    expect(motion.tracks).toEqual([
      { id: 'track_001', pointId: 'p1', start: [10, 12], end: [14, 18], vector: [4, 6], startSeconds: 0, endSeconds: 1, magnitudePixels: 7.211 },
    ]);

    const objectTrack = (module.buildObjectTrackFixtureResult as (input: Record<string, unknown>) => Record<string, unknown>)({
      sourcePath: 'fixtures/clip.mp4',
      boxes: [{ id: 'ball', label: 'ball', timeSeconds: 1, box: [100, 80, 24, 24] }],
    });
    expect(objectTrack).toMatchObject({ schema: 'media.object-track.v1', method: 'opencv-feature-tracking-fixture' });
    expect(objectTrack.objects).toHaveLength(1);

    const cameraMotion = (module.buildCameraMotionFixtureResult as (input: Record<string, unknown>) => Record<string, unknown>)({
      sourcePath: 'fixtures/clip.mp4',
      transforms: [{ startSeconds: 0, endSeconds: 1, dx: 3, dy: -2, rotationDegrees: 0.4 }],
    });
    expect(cameraMotion).toMatchObject({ schema: 'media.camera-motion.v1', method: 'opencv-feature-transform-fixture' });
    expect(cameraMotion.segments).toEqual([{ id: 'camera_001', startSeconds: 0, endSeconds: 1, dx: 3, dy: -2, rotationDegrees: 0.4 }]);
  });

  it('should satisfy media contract when it returns a structured missing cv2 dependency error', async () => {
    const module = await importMediaModule('scripts/lib/media/vision.ts');
    expectFunctionExport(module, 'missingOpenCvError');

    const error = (module.missingOpenCvError as () => Record<string, unknown>)();
    expect(error).toMatchObject({ schema: 'media.error.v1', dependencyId: 'opencv-python-headless', profile: 'media-vision-light', importName: 'cv2' });
    expect(error.requiredProfiles).toEqual(['media-vision-light']);
    expect(error.recovery).toContain('media-vision-light');
  });
});
