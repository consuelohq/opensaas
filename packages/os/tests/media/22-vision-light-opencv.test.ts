import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule } from './helpers';

describe('media vision-light OpenCV profile', () => {
  it('models OpenCV as generic motion/computer vision separate from MediaPipe pose', async () => {
    const module = await importMediaModule('scripts/lib/media/vision.ts');

    expect(module.visionLightProfile).toMatchObject({
      id: 'media-vision-light',
      dependencies: ['python3', 'numpy', 'opencv-python-headless'],
    });
    expect(module.visionLightProfile.dependencies).not.toContain('opencv-python');
    expect(module.visionLightProfile.dependencies).not.toContain('mediapipe');
  });

  it('exposes OpenCV-backed motion/object/camera tools without body landmark semantics', async () => {
    const module = await importMediaModule('scripts/lib/media/vision.ts');
    for (const exportName of ['motionTrackEffect', 'objectTrackEffect', 'cameraMotionEffect']) {
      expectFunctionExport(module, exportName);
    }
    expect(module.opencvToolRoles).toEqual(expect.arrayContaining(['optical-flow', 'feature-tracking', 'frame-differencing', 'camera-motion']));
    expect(module.opencvToolRoles).not.toContain('pose-landmarks');
  });

  it('returns a structured missing cv2 dependency error', async () => {
    const module = await importMediaModule('scripts/lib/media/vision.ts');
    expectFunctionExport(module, 'missingOpenCvError');

    const error = (module.missingOpenCvError as () => Record<string, unknown>)();
    expect(error).toMatchObject({ schema: 'media.error.v1', dependencyId: 'opencv-python-headless', profile: 'media-vision-light' });
  });
});
