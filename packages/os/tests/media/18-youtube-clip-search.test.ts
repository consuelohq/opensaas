import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule } from './helpers';

const youtubeSearchFixture = {
  items: [
    {
      id: { videoId: 'abc123' },
      snippet: {
        title: 'Fixture dunk breakdown',
        channelTitle: 'Sports Lab',
        publishedAt: '2026-06-20T00:00:00Z',
      },
      statistics: { viewCount: '250000' },
      contentDetails: { duration: 'PT42S' },
    },
  ],
};

describe('media.clip.search YouTube discovery', () => {
  it('should satisfy media contract when it uses fixture-driven search normalization with no live network in unit tests', async () => {
    const module = await importMediaModule('scripts/lib/media/youtube.ts');
    expectFunctionExport(module, 'normalizeYouTubeSearchFixture');
    expectFunctionExport(module, 'scoreClipCandidates');

    const normalize = module.normalizeYouTubeSearchFixture as (fixture: unknown) => Array<Record<string, unknown>>;
    const candidates = normalize(youtubeSearchFixture);

    expect(candidates[0]).toMatchObject({ id: 'abc123', title: 'Fixture dunk breakdown', channel: 'Sports Lab' });
    expect(candidates[0].url).toBe('https://www.youtube.com/watch?v=abc123');
  });

  it('should satisfy media contract when it scores clips by views, velocity, recency, sport, duration, and breakdown potential', async () => {
    const module = await importMediaModule('scripts/lib/media/youtube.ts');
    const scoringFields = module.clipScoringFields;

    expect(scoringFields).toEqual(expect.arrayContaining(['views', 'velocity', 'recency', 'sport', 'duration', 'breakdownPotential', 'rightsStatus']));
    expect(scoringFields).not.toContain('vibes');
  });

  it('should satisfy media contract when it requires yt-dlp only for media-youtube, not media-core', async () => {
    const module = await importMediaModule('scripts/lib/media/youtube.ts');
    expect(module.requiredProfiles).toEqual(['media-youtube']);
    expect(module.requiredCommands).toEqual(['yt-dlp']);
  });
});
