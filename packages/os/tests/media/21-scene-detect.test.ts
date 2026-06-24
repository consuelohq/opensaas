import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule } from './helpers';

describe('media.scene.detect', () => {
  it('should satisfy media contract when it uses the vision-light profile and emits shot boundaries/candidate moments', async () => {
    const module = await importMediaModule('scripts/lib/media/vision.ts');
    expectFunctionExport(module, 'sceneDetectEffect');
    expectFunctionExport(module, 'sceneDetectForCli');
    expect(module.sceneDetectRequiredProfiles).toEqual(['media-vision-light']);
    expect(module.sceneDetectOutputSchema).toBe('media.scene-detect-result.v1');
  });

  it('should satisfy media contract when it does not require MediaPipe for scene detection', async () => {
    const module = await importMediaModule('scripts/lib/media/vision.ts');
    expect(module.sceneDetectRequiredDependencies).toEqual(expect.arrayContaining(['opencv-python-headless']));
    expect(module.sceneDetectRequiredDependencies).not.toContain('mediapipe');
  });
});
