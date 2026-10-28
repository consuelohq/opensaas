import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import {
  createTempDir,
  expectFunctionExport,
  expectJsonCliSuccess,
  expectSchemaAccepts,
  expectSchemaRejects,
  getExport,
  hasCommand,
  importMediaModule,
  removeTempDir,
} from './helpers';

type ScreenshotPlan = {
  command: string;
  args: string[];
  outputPath: string;
  template: {
    width: number;
    height: number;
    theme: string;
    accent: string;
    background: string;
    padding: number;
    fit: string;
    pattern: string;
    dots: boolean;
  };
};

describe('media.screenshot.render', () => {
  it('should satisfy media contract when it exposes Effect, CLI, and deterministic plan surfaces', async () => {
    const module = await importMediaModule('scripts/lib/media/screenshot.ts');
    expectFunctionExport(module, 'buildScreenshotRenderPlan');
    expectFunctionExport(module, 'renderScreenshotEffect');
    expectFunctionExport(module, 'renderScreenshotForCli');

    const build = module.buildScreenshotRenderPlan as (input: Record<string, unknown>) => ScreenshotPlan;
    const plan = build({ inputPath: 'fixtures/chatgpt.png', outPath: 'renders/chatgpt-x.png' });

    expect(plan.command).toBe('ffmpeg');
    expect(plan.outputPath).toBe('renders/chatgpt-x.png');
    expect(plan.template).toMatchObject({
      width: 1600,
      height: 900,
      theme: 'dark',
      accent: '#0000F2',
      background: '#08080A',
      padding: 120,
      fit: 'contain',
      pattern: 'none',
      dots: true,
    });
    expect(plan.args).toEqual(expect.arrayContaining(['-y', '-frames:v', '1']));
    expect(plan.args.join(' ')).toMatch(/scale=.*force_original_aspect_ratio/);
    expect(plan.args.join(' ')).not.toMatch(/drawgrid/);
    expect(plan.args.join(' ')).toContain('cloud-1.png');
    expect(plan.args.join(' ')).toContain('cloud-4.png');
    expect(plan.args.join(' ')).toContain('[dots4]');
    expect(plan.args.join(' ')).not.toContain('pad=iw+8');
    expect(plan.args.join(' ')).not.toMatch(/gblur|shadowblur|withshadow/);
    expect(plan.args.join(' ')).toMatch(/overlay/);
    expect(plan.args.join(' ')).toContain('0x08080A');
  });

  it('should satisfy media contract when it supports light and dark templates without changing screenshot pixels', async () => {
    const module = await importMediaModule('scripts/lib/media/screenshot.ts');
    const build = module.buildScreenshotRenderPlan as (input: Record<string, unknown>) => ScreenshotPlan;
    const plan = build({
      inputPath: 'fixtures/chatgpt.png',
      outPath: 'renders/chatgpt-light.png',
      width: 1200,
      height: 675,
      theme: 'light',
      accent: '#123456',
      background: '#FAFAFA',
      padding: 80,
      fit: 'cover',
      pattern: 'lines',
      dots: false,
    });

    expect(plan.template).toEqual(expect.objectContaining({
      width: 1200,
      height: 675,
      theme: 'light',
      accent: '#123456',
      background: '#FAFAFA',
      padding: 80,
      fit: 'cover',
      pattern: 'lines',
      dots: false,
    }));
    expect(plan.args.join(' ')).toContain('0x123456');
    expect(plan.args.join(' ')).toContain('0xFAFAFA');
    expect(plan.args.join(' ')).toMatch(/crop=/);
    expect(plan.args.join(' ')).not.toContain('cloud-1.png');
    expect(plan.args.join(' ')).not.toMatch(/negate|lutrgb=.*negval/);
  });

  it('should satisfy media contract when it validates colors, geometry, fit, pattern, and image paths', async () => {
    const module = await importMediaModule('scripts/lib/media/screenshot.ts');
    const build = module.buildScreenshotRenderPlan as (input: Record<string, unknown>) => ScreenshotPlan;
    const valid = { inputPath: 'fixtures/chatgpt.png', outPath: 'renders/chatgpt.png' };

    expect(() => build({ ...valid, accent: 'blue' })).toThrow(/accent/i);
    expect(() => build({ ...valid, width: 400 })).toThrow(/width/i);
    expect(() => build({ ...valid, padding: 500 })).toThrow(/padding/i);
    expect(() => build({ ...valid, fit: 'stretch' })).toThrow(/fit/i);
    expect(() => build({ ...valid, pattern: 'waves' })).toThrow(/pattern/i);
    expect(() => build({ ...valid, inputPath: 'fixtures/chatgpt.txt' })).toThrow(/image/i);
    expect(() => build({ ...valid, outPath: 'renders/chatgpt.jpg' })).toThrow(/PNG/i);
  });

  it('should satisfy media contract when it defines a versioned deterministic result schema', async () => {
    const module = await importMediaModule('scripts/lib/media/schema.ts');
    const schema = getExport(module, 'MediaScreenshotResultSchema');
    const fixture = {
      schema: 'media.screenshot-result.v1',
      id: 'screenshot_fixture_001',
      source: { path: 'fixtures/chatgpt.png' },
      output: { path: 'renders/chatgpt-x.png', width: 1600, height: 900, format: 'png', fileSizeBytes: 1024 },
      template: { theme: 'dark', accent: '#0000F2', background: '#08080A', padding: 120, fit: 'contain', pattern: 'none', dots: true },
      toolVersions: { ffmpeg: 'fixture-ffmpeg' },
      deterministic: true,
    };

    expectSchemaAccepts(schema, fixture);
    expectSchemaRejects(schema, { ...fixture, schema: 'media.screenshot.v0' });
    expectSchemaRejects(schema, { ...fixture, template: { ...fixture.template, accent: 'blue' } });
    expectSchemaRejects(schema, { ...fixture, deterministic: false });
  });

  it.runIf(hasCommand('ffmpeg'))('should satisfy media contract when the real CLI renders a valid PNG with FFmpeg only', () => {
    const tempDir = createTempDir('consuelo-media-test-screenshot-');
    try {
      const inputPath = join(tempDir, 'input.png');
      const outputPath = join(tempDir, 'social.png');
      const plainOutputPath = join(tempDir, 'social-plain.png');
      const generated = spawnSync('ffmpeg', [
        '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x202124:s=1280x720',
        '-frames:v', '1', '-update', '1', inputPath,
      ], { encoding: 'utf8' });
      expect(generated.status, generated.stderr).toBe(0);

      const envelope = expectJsonCliSuccess([
        'screenshot', 'render', '--input', inputPath, '--out', outputPath,
        '--background', '#0000F2', '--pattern', 'none', '--dots', '--json',
      ]);

      expect(envelope.schema).toBe('media.screenshot-result.v1');
      expect(envelope.ok).toBe(true);
      expect(envelope.template).toMatchObject({ background: '#0000F2', pattern: 'none', dots: true });
      expect(existsSync(outputPath)).toBe(true);
      expect(statSync(outputPath).size).toBeGreaterThan(0);
      expect(JSON.stringify(envelope)).toContain(outputPath);

      const plainEnvelope = expectJsonCliSuccess([
        'screenshot', 'render', '--input', inputPath, '--out', plainOutputPath,
        '--background', '#123456', '--pattern', 'lines', '--no-dots', '--json',
      ]);
      expect(plainEnvelope.template).toMatchObject({ background: '#123456', pattern: 'lines', dots: false });
      expect(existsSync(plainOutputPath)).toBe(true);
    } finally {
      removeTempDir(tempDir);
    }
  });
});
