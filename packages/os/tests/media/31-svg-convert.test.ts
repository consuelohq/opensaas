import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import {
  createTempDir,
  expectFunctionExport,
  expectJsonCliSuccess,
  expectSchemaAccepts,
  hasCommand,
  importMediaModule,
  readManifestArray,
  removeTempDir,
} from './helpers';

function writeFixturePng(dir: string): string {
  const path = join(dir, 'fixture.png');
  const result = spawnSync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=white:s=8x8:d=1',
    '-vf',
    'drawbox=x=2:y=2:w=4:h=4:color=black:t=fill',
    '-frames:v',
    '1',
    path,
  ], { encoding: 'utf8' });
  expect(result.status, 'ffmpeg should generate fixture PNG: ' + result.stderr).toBe(0);
  return path;
}

describe('media.svg.convert', () => {
  it('declares a visible media SVG conversion tool', () => {
    const tools = readManifestArray('tooling/media-tool-manifest.json');
    const tool = tools.find((entry) => entry.name === 'media.svg.convert');

    expect(tool).toBeDefined();
    expect(tool?.category).toBe('media');
    expect(tool?.methodPath).toEqual(['media', 'svg', 'convert']);
    expect(tool?.workflowRole).toBe('media.svg.convert');
    expect(tool?.inputSchema).toBe('MediaSvgConvertInput');
    expect(tool?.outputSchema).toBe('MediaSvgResult');
    expect(tool?.requiredProfiles).toEqual(expect.arrayContaining(['media-render-advanced']));
    expect(tool?.requiredCommands).toEqual(expect.arrayContaining(['ffmpeg', 'potrace']));
    expect(tool?.capabilities?.mutating).toBe(true);
  });

  it('exports SVG conversion APIs and schema validation', async () => {
    const module = await importMediaModule('scripts/lib/media/svg.ts');
    const schemaModule = await importMediaModule('scripts/lib/media/schema.ts');

    expectFunctionExport(module, 'convertSvgEffect');
    expectFunctionExport(module, 'convertSvgForCli');
    expectFunctionExport(module, 'buildWrapperSvg');
    expect(module.svgConvertStrategies).toEqual(expect.arrayContaining(['wrapper', 'trace', 'both', 'auto']));
    expectSchemaAccepts(schemaModule.MediaSvgResultSchema, {
      schema: 'media.svg-result.v1',
      id: 'svg_fixture_001',
      input: { path: 'fixture.png', mimeType: 'image/png', width: 8, height: 8 },
      strategy: 'wrapper',
      outputs: { svg: 'fixture.svg', wrapperSvg: 'fixture.svg' },
      toolVersions: {},
      deterministic: true,
    });
  });

  it('writes an exact SVG image wrapper', async () => {
    const tmp = createTempDir('consuelo-media-test-svg-wrapper-');
    try {
      const input = writeFixturePng(tmp);
      const out = join(tmp, 'wrapped.svg');
      const json = expectJsonCliSuccess(['svg', 'convert', '--input', input, '--out', out, '--strategy', 'wrapper', '--json']);

      expect(json.schema).toBe('media.svg-result.v1');
      expect(json.ok).toBe(true);
      expect(existsSync(out)).toBe(true);
      const svg = readFileSync(out, 'utf8');
      expect(svg).toContain('<svg');
      expect(svg).toContain('<image');
      expect(svg).toContain('data:image/png;base64,');
      expect(svg).toContain('width="8"');
      expect(svg).toContain('height="8"');
    } finally {
      removeTempDir(tmp);
    }
  });

  it('writes a path-based vector SVG in trace mode', async () => {
    if (!hasCommand('potrace') || !hasCommand('ffmpeg')) return;
    const tmp = createTempDir('consuelo-media-test-svg-trace-');
    try {
      const input = writeFixturePng(tmp);
      const out = join(tmp, 'traced.svg');
      const json = expectJsonCliSuccess(['svg', 'convert', '--input', input, '--out', out, '--strategy', 'trace', '--json'], 60_000);

      expect(json.schema).toBe('media.svg-result.v1');
      expect(json.ok).toBe(true);
      expect(existsSync(out)).toBe(true);
      const svg = readFileSync(out, 'utf8');
      expect(svg).toContain('<svg');
      expect(svg).toMatch(/<path\b/);
      expect(svg).not.toContain('data:image/png;base64');
    } finally {
      removeTempDir(tmp);
    }
  });

  it('returns wrapper and traced outputs in both mode', async () => {
    if (!hasCommand('potrace') || !hasCommand('ffmpeg')) return;
    const tmp = createTempDir('consuelo-media-test-svg-both-');
    try {
      const input = writeFixturePng(tmp);
      const out = join(tmp, 'asset.svg');
      const json = expectJsonCliSuccess(['svg', 'convert', '--input', input, '--out', out, '--strategy', 'both', '--json'], 60_000);
      const data = json.data as { outputs?: Record<string, string> };

      expect(existsSync(data.outputs?.wrapperSvg ?? '')).toBe(true);
      expect(existsSync(data.outputs?.tracedSvg ?? '')).toBe(true);
    } finally {
      removeTempDir(tmp);
    }
  });
});
