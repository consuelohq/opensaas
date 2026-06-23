import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule } from './helpers';

describe('media.overlay.render', () => {
  it('uses declarative overlay JSON and rejects arbitrary code execution', async () => {
    const module = await importMediaModule('scripts/lib/media/overlays.ts');
    expectFunctionExport(module, 'renderOverlayEffect');
    expectFunctionExport(module, 'validateOverlaySpec');

    expect(module.overlayPrimitiveTypes).toEqual(expect.arrayContaining(['arrow', 'label', 'zoom-box', 'freeze-frame-callout', 'force-vector', 'joint-angle', 'velocity-trail']));
    expect(module.overlayPrimitiveTypes).not.toContain('javascript');
    expect(module.overlayPrimitiveTypes).not.toContain('eval');
  });

  it('can emit transparent layers or PNG sequences for compose to consume', async () => {
    const module = await importMediaModule('scripts/lib/media/overlays.ts');
    expect(module.overlayOutputFormats).toEqual(expect.arrayContaining(['png-sequence', 'transparent-video', 'svg']));
    expect(module.composeConsumableArtifactSchema).toBe('media.overlay.v1');
  });
});
