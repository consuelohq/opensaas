import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule } from './helpers';

const ytDlpInfoFixture = {
  id: 'abc123',
  webpage_url: 'https://youtube.com/watch?v=abc123',
  title: 'Fixture',
  channel: 'Sports Lab',
  duration: 42,
  upload_date: '20260620',
};

const ytDlpTranscriptFixture = {
  subtitles: {
    en: [{ ext: 'vtt', url: 'https://example.test/subs.vtt' }],
  },
  automatic_captions: {},
};

describe('media.ingest YouTube provenance', () => {
  it('should satisfy media contract when it normalizes yt-dlp info JSON into a provenance-first ingest manifest', async () => {
    const module = await importMediaModule('scripts/lib/media/youtube.ts');
    expectFunctionExport(module, 'normalizeYtDlpInfoJson');

    const normalize = module.normalizeYtDlpInfoJson as (info: unknown) => Record<string, unknown>;
    const manifest = normalize(ytDlpInfoFixture);

    expect(manifest).toMatchObject({
      schema: 'media.ingest-manifest.v1',
      source: { url: 'https://youtube.com/watch?v=abc123', title: 'Fixture', channel: 'Sports Lab' },
      rights: { status: 'needs-review' },
    });
  });

  it('should satisfy media contract when it keeps the visible YouTube ingest layout under media.ingest, not research ingest', async () => {
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
    expect(JSON.stringify(module)).not.toMatch(/packet\.md|context-bundle\.md|research:ingest|rights.*safe/i);
  });

  it('should satisfy media contract when it supports subtitles and auto-subtitle metadata without making network calls in tests', async () => {
    const module = await importMediaModule('scripts/lib/media/youtube.ts');
    expectFunctionExport(module, 'extractTranscriptRefsFromYtDlpInfo');

    const extract = module.extractTranscriptRefsFromYtDlpInfo as (info: unknown) => unknown;
    expect(extract(ytDlpTranscriptFixture)).toEqual(
      expect.arrayContaining([expect.objectContaining({ language: 'en', ext: 'vtt' })]),
    );
  });
});
