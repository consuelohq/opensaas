import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule } from './helpers';

describe('media.qa core tool', () => {
  it('exposes Effect and CLI QA surfaces', async () => {
    const module = await importMediaModule('scripts/lib/media/qa.ts');
    expectFunctionExport(module, 'qaEffect');
    expectFunctionExport(module, 'qaForCli');
  });

  it('uses ffprobe to verify output duration, dimensions, codec, and file size', async () => {
    const module = await importMediaModule('scripts/lib/media/qa.ts');
    expectFunctionExport(module, 'buildQaChecks');

    const build = module.buildQaChecks as (input: { inputPath: string; expected: { durationSeconds: number; width: number; height: number; codec: string; maxFileSizeBytes: number } }) => Array<{ name: string; dependency?: string }>;
    const checks = build({ inputPath: 'renders/out.mp4', expected: { durationSeconds: 45, width: 1080, height: 1920, codec: 'h264', maxFileSizeBytes: 50_000_000 } });
    const names = checks.map((check) => check.name);

    expect(names).toEqual(expect.arrayContaining(['exists', 'duration', 'dimensions', 'codec', 'file-size']));
    expect(checks.filter((check) => check.dependency === 'ffprobe').length).toBeGreaterThanOrEqual(3);
  });

  it('emits media.render-result.v1-compatible QA status', async () => {
    const module = await importMediaModule('scripts/lib/media/qa.ts');
    expect(module.QA_RESULT_SCHEMA).toBe('media.render-result.v1');
  });
});
