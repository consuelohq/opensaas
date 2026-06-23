import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule } from './helpers';

describe('media.probe core tool', () => {
  it('exposes Effect and CLI probe surfaces', async () => {
    const module = await importMediaModule('scripts/lib/media/probe.ts');
    expectFunctionExport(module, 'probeEffect');
    expectFunctionExport(module, 'probeForCli');
  });

  it('uses ffprobe as the machine-readable source of stream metadata', async () => {
    const module = await importMediaModule('scripts/lib/media/probe.ts');
    const source = String(module.probeCommandSpec ?? '');

    expect(source).toContain('ffprobe');
    expect(source).toContain('-print_format');
    expect(source).toContain('json');
    expect(source).toContain('-show_streams');
    expect(source).toContain('-show_format');
  });

  it('normalizes ffprobe output into media.asset.v1 fields', async () => {
    const module = await importMediaModule('scripts/lib/media/probe.ts');
    expectFunctionExport(module, 'normalizeFfprobeJson');

    const normalize = module.normalizeFfprobeJson as (value: unknown, context: { inputPath: string; provenance: unknown }) => unknown;
    const result = normalize({
      streams: [
        { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, avg_frame_rate: '30000/1001' },
        { codec_type: 'audio', codec_name: 'aac' },
      ],
      format: { duration: '45.5' },
    }, { inputPath: 'assets/source.mp4', provenance: { status: 'needs-review' } });

    expect(result).toMatchObject({
      schema: 'media.asset.v1',
      source: { path: 'assets/source.mp4' },
      probe: { durationSeconds: expect.any(Number), width: 1920, height: 1080, videoCodec: 'h264', audioCodec: 'aac' },
    });
  });
});
