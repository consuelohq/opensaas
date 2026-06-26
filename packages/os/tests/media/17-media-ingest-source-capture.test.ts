import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTempDir, expectFunctionExport, expectJsonCliSuccess, importMediaModule, parseJsonStdout, removeTempDir, runMediaCli } from './helpers';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) removeTempDir(dir);
});

describe('media.ingest source-capture contract', () => {
  it('should satisfy media contract when it exports the media ingest planning, Effect, CLI, and mapping boundaries', async () => {
    const module = await importMediaModule('scripts/lib/media/ingest.ts');

    expectFunctionExport(module, 'createMediaIngestPlan');
    expectFunctionExport(module, 'ingestMediaEffect');
    expectFunctionExport(module, 'ingestMediaForCli');
    expectFunctionExport(module, 'mapSourceCaptureResultToMediaIngestManifest');
    expectFunctionExport(module, 'assertSourceCaptureHasMediaAsset');
  });

  it('should satisfy media contract when it plans actual source media capture for video URLs instead of research packet generation', async () => {
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
    expect(JSON.stringify(plan)).toContain('--ignore-errors');
    expect(JSON.stringify(plan)).toContain('--merge-output-format');
    expect(JSON.stringify(plan)).toContain('100M');
    expect(JSON.stringify(plan)).not.toMatch(/packet\.md|context-bundle\.md|research:ingest|research\.ingest/);
  });

  it('should satisfy media contract when it maps a captured source media asset into media-specific manifest and asset contracts', async () => {
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

  it('should satisfy media contract when it rejects transcript-only capture results with a structured media-source-missing error', async () => {
    const module = await importMediaModule('scripts/lib/media/ingest.ts');
    const assertSource = module.assertSourceCaptureHasMediaAsset as (input: unknown) => void;

    expect(() => assertSource({
      source: { kind: 'url', url: 'https://www.youtube.com/watch?v=abc123' },
      transcripts: [{ path: 'transcript.vtt', language: 'en' }],
    })).toThrow(/MEDIA_SOURCE_ASSET_MISSING|source media asset/i);
  });

  it('should satisfy media contract when it declares the media ingest layout without research packet artifacts', async () => {
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

  it('should satisfy media contract when the visible media.ingest CLI routes dry-run URL plans and local file ingest', () => {
    const dir = createTempDir('consuelo-media-test-ingest-cli-');
    tempDirs.push(dir);
    const source = join(dir, 'source.mp4');
    const outDir = join(dir, 'ingest');
    writeFileSync(source, Buffer.from('real media placeholder for copy-path testing'));

    const dryRun = expectJsonCliSuccess([
      'ingest',
      '--source',
      'https://www.youtube.com/watch?v=abc123',
      '--out',
      outDir,
      '--dry-run',
      '--json',
    ]);
    expect(dryRun).toMatchObject({
      schema: 'media.source-capture-plan.v1',
      ok: true,
      data: {
        requiredProfiles: expect.arrayContaining(['media-youtube']),
        requiredCommands: expect.arrayContaining(['yt-dlp']),
      },
    });

    const ingested = expectJsonCliSuccess(['ingest', '--source', source, '--out', outDir, '--json']);
    expect(ingested).toMatchObject({
      schema: 'media.ingest-result.v1',
      ok: true,
      data: {
        manifest: { schema: 'media.ingest-manifest.v1', rights: { status: 'needs-review' } },
        asset: { schema: 'media.asset.v1' },
      },
    });
    expect(existsSync(join(outDir, 'assets/source.mp4'))).toBe(true);
    expect(existsSync(join(outDir, 'source.info.json'))).toBe(true);
    expect(existsSync(join(outDir, 'media-asset.json'))).toBe(true);
    expect(existsSync(join(outDir, 'ingest-manifest.json'))).toBe(true);
  });

  it('should satisfy media contract when CLI ingest preserves structured media errors', () => {
    const dir = createTempDir('consuelo-media-test-ingest-error-');
    tempDirs.push(dir);
    const result = runMediaCli(['ingest', '--source', join(dir, 'missing.mp4'), '--out', join(dir, 'out'), '--json']);
    expect(result.status).toBe(1);
    expect(parseJsonStdout(result.stdout)).toMatchObject({
      schema: 'media.error.v1',
      ok: false,
      error: { code: 'MEDIA_INPUT_MISSING' },
    });
  });

  it('should satisfy media contract when a captured URL output directory is mapped into media ingest artifacts', async () => {
    const module = await importMediaModule('scripts/lib/media/ingest.ts');
    const materialize = module.materializeCapturedSourceDirectory as (input: {
      source: string;
      outDir: string;
      commandPlan: { command: string; args: string[] };
      capturedAt?: string;
    }) => Record<string, unknown>;
    const dir = createTempDir('consuelo-media-test-url-capture-map-');
    tempDirs.push(dir);
    writeFileSync(join(dir, 'source.mp4'), Buffer.from('captured video bytes'));
    writeFileSync(join(dir, 'source.info.json'), JSON.stringify({ title: 'fixture' }));
    writeFileSync(join(dir, 'source.en.vtt'), 'WEBVTT\n');

    const result = materialize({
      source: 'https://www.youtube.com/watch?v=abc123',
      outDir: dir,
      commandPlan: { command: 'yt-dlp', args: ['https://www.youtube.com/watch?v=abc123'] },
      capturedAt: '2026-06-26T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      manifest: {
        schema: 'media.ingest-manifest.v1',
        source: { url: 'https://www.youtube.com/watch?v=abc123', extractor: 'yt-dlp' },
        rights: { status: 'needs-review' },
        mediaAsset: { path: join(dir, 'source.mp4') },
      },
      asset: { schema: 'media.asset.v1' },
    });
    expect(existsSync(join(dir, 'media-asset.json'))).toBe(true);
    expect(existsSync(join(dir, 'ingest-manifest.json'))).toBe(true);
  });
});
