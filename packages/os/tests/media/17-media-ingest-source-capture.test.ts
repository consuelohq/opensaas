import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule } from './helpers';

describe('media.ingest source-capture contract', () => {
  it('exports the media ingest planning, Effect, CLI, and mapping boundaries', async () => {
    const module = await importMediaModule('scripts/lib/media/ingest.ts');

    expectFunctionExport(module, 'createMediaIngestPlan');
    expectFunctionExport(module, 'ingestMediaEffect');
    expectFunctionExport(module, 'ingestMediaForCli');
    expectFunctionExport(module, 'mapSourceCaptureResultToMediaIngestManifest');
    expectFunctionExport(module, 'assertSourceCaptureHasMediaAsset');
  });

  it('plans actual source media capture for video URLs instead of research packet generation', async () => {
    const module = await importMediaModule('scripts/lib/media/ingest.ts');
    const createPlan = module.createMediaIngestPlan as (input: unknown) => Record<string, unknown>;
    const plan = createPlan({ source: 'https://www.youtube.com/watch?v=abc123', outDir: '/tmp/media-fixture', dryRun: true });

    expect(plan).toMatchObject({
      schema: 'media.source-capture-plan.v1',
      requiredProfiles: expect.arrayContaining(['media-youtube']),
      requiredCommands: expect.arrayContaining(['yt-dlp']),
    });
    expect(JSON.stringify(plan)).toContain('assets/source.mp4');
    expect(JSON.stringify(plan)).toContain('source.info.json');
    expect(JSON.stringify(plan)).not.toMatch(/packet\.md|context-bundle\.md|research:ingest|research\.ingest/);
  });

  it('maps a captured source media asset into media-specific manifest and asset contracts', async () => {
    const module = await importMediaModule('scripts/lib/media/ingest.ts');
    const mapResult = module.mapSourceCaptureResultToMediaIngestManifest as (input: unknown) => Record<string, unknown>;

    const result = mapResult({
      source: { kind: 'url', url: 'https://www.youtube.com/watch?v=abc123', extractor: 'yt-dlp' },
      capturedAt: '2026-06-23T00:00:00.000Z',
      commandPlan: { command: 'yt-dlp', args: ['--write-info-json'] },
      mediaAsset: { path: 'assets/source.mp4', sha256: 'a'.repeat(64), bytes: 123456, mime: 'video/mp4' },
      infoJson: { path: 'source.info.json', sha256: 'b'.repeat(64), bytes: 2048 },
      transcripts: [{ path: 'transcript.vtt', language: 'en', kind: 'subtitle' }],
      thumbnails: [{ path: 'thumbnails/thumb.jpg', sha256: 'c'.repeat(64), bytes: 1024 }],
    });

    expect(result).toMatchObject({
      manifest: {
        schema: 'media.ingest-manifest.v1',
        source: { url: 'https://www.youtube.com/watch?v=abc123', extractor: 'yt-dlp' },
        rights: { status: 'needs-review' },
      },
      asset: {
        schema: 'media.asset.v1',
        path: 'assets/source.mp4',
        provenance: expect.objectContaining({ captureTool: 'media.ingest' }),
      },
    });
  });

  it('rejects transcript-only capture results with a structured media-source-missing error', async () => {
    const module = await importMediaModule('scripts/lib/media/ingest.ts');
    const assertSource = module.assertSourceCaptureHasMediaAsset as (input: unknown) => void;

    expect(() => assertSource({
      source: { kind: 'url', url: 'https://www.youtube.com/watch?v=abc123' },
      transcripts: [{ path: 'transcript.vtt', language: 'en' }],
    })).toThrow(/MEDIA_SOURCE_ASSET_MISSING|source media asset/i);
  });

  it('declares the media ingest layout without research packet artifacts', async () => {
    const module = await importMediaModule('scripts/lib/media/ingest.ts');

    expect(module.expectedMediaIngestLayout).toEqual([
      'assets/source.mp4',
      'source.info.json',
      'transcript.vtt',
      'transcript.json',
      'thumbnails/',
      'media-asset.json',
      'ingest-manifest.json',
    ]);
    expect(module.expectedMediaIngestLayout).not.toEqual(expect.arrayContaining(['packet.md', 'context-bundle.md']));
  });
});
