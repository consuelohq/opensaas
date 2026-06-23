import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule, validTimelineFixture } from './helpers';

describe('media.timeline.validate core tool', () => {
  it('exposes Effect and CLI timeline validation surfaces without native binary requirements', async () => {
    const module = await importMediaModule('scripts/lib/media/timeline.ts');
    expectFunctionExport(module, 'validateTimelineEffect');
    expectFunctionExport(module, 'validateTimelineForCli');
    expect(module.requiredCommands).toEqual([]);
  });

  it('returns field-path validation errors for invalid timelines', async () => {
    const module = await importMediaModule('scripts/lib/media/timeline.ts');
    expectFunctionExport(module, 'validateTimelineJson');

    const validate = module.validateTimelineJson as (value: unknown) => { ok: boolean; errors?: Array<{ path: string; message: string }> };
    const result = validate(validTimelineFixture({ beats: [{ id: 'bad', startSeconds: 20, endSeconds: 10, type: 'freeze' }] }));

    expect(result.ok).toBe(false);
    expect(result.errors?.[0]?.path).toMatch(/beats/);
  });

  it('checks referenced assets, frames, captions, voiceover, and overlays', async () => {
    const module = await importMediaModule('scripts/lib/media/timeline.ts');
    expectFunctionExport(module, 'collectTimelineReferences');

    const collect = module.collectTimelineReferences as (value: unknown) => { assets: string[]; captions: string[]; audio: string[]; overlays: string[] };
    const refs = collect(validTimelineFixture());

    expect(refs.assets).toContain('assets/source.mp4');
    expect(refs.captions).toContain('captions/en.vtt');
    expect(refs.audio).toContain('audio/voiceover.wav');
    expect(refs.overlays).toContain('overlay_001');
  });
});
