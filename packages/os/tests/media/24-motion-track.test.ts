import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule } from './helpers';

describe('media motion, angle, and sports metrics', () => {
  it('should satisfy media contract when it keeps motion-track generic and pose metrics semantic', async () => {
    const module = await importMediaModule('scripts/lib/media/vision.ts');
    expectFunctionExport(module, 'motionTrackEffect');
    expectFunctionExport(module, 'angleMeasureEffect');
    expectFunctionExport(module, 'sportsScienceMetricsEffect');

    expect(module.motionTrackOutputSchema).toBe('media.motion-track.v1');
    expect(module.angleMeasureInputs).toEqual(expect.arrayContaining(['media.pose-track.v1']));
    expect(module.sportsScienceMetricInputs).toEqual(expect.arrayContaining(['media.pose-track.v1', 'media.motion-track.v1']));
  });

  it('should satisfy media contract when it does not allow joint-angle metrics to consume raw video directly', async () => {
    const module = await importMediaModule('scripts/lib/media/vision.ts');
    expect(module.angleMeasureInputs).not.toContain('video/mp4');
    expect(module.angleMeasureInputs).not.toContain('raw-video');
  });
});
