import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule } from './helpers';

describe('media.frames.extract core tool', () => {
  it('exposes Effect and CLI frame extraction surfaces', async () => {
    const module = await importMediaModule('scripts/lib/media/frames.ts');
    expectFunctionExport(module, 'extractFramesEffect');
    expectFunctionExport(module, 'extractFramesForCli');
  });

  it('builds ffmpeg arguments for exact timestamp and range extraction', async () => {
    const module = await importMediaModule('scripts/lib/media/frames.ts');
    expectFunctionExport(module, 'buildFrameExtractionPlan');

    const build = module.buildFrameExtractionPlan as (input: { inputPath: string; outDir: string; timestamps: number[]; ranges?: Array<{ startSeconds: number; endSeconds: number; fps: number }> }) => { command: string; args: string[]; manifestPath: string };
    const plan = build({ inputPath: 'assets/source.mp4', outDir: 'frames', timestamps: [0.1, 12.4], ranges: [{ startSeconds: 20, endSeconds: 21, fps: 5 }] });

    expect(plan.command).toBe('ffmpeg');
    expect(plan.args).toEqual(expect.arrayContaining(['-i', 'assets/source.mp4']));
    expect(plan.args.join(' ')).toContain('0.1');
    expect(plan.args.join(' ')).toContain('12.4');
    expect(plan.manifestPath).toBe('frames/frame-manifest.json');
  });

  it('writes media.frame-manifest.v1 and rejects unsafe output paths', async () => {
    const module = await importMediaModule('scripts/lib/media/frames.ts');
    expect(module.FRAME_MANIFEST_SCHEMA).toBe('media.frame-manifest.v1');
    expectFunctionExport(module, 'assertSafeFrameOutputPath');

    const assertSafe = module.assertSafeFrameOutputPath as (path: string) => void;
    expect(() => assertSafe('frames')).not.toThrow();
    expect(() => assertSafe('../outside')).toThrow();
    expect(() => assertSafe('/tmp/outside')).toThrow();
  });
});
