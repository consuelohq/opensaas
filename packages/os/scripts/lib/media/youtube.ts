type YouTubeSearchItem = {
  id?: { videoId?: string } | string;
  snippet?: { title?: string; channelTitle?: string; publishedAt?: string };
  statistics?: { viewCount?: string | number };
  contentDetails?: { duration?: string };
};

type YouTubeCandidate = {
  id: string;
  title: string;
  channel: string;
  url: string;
  publishedAt?: string;
  views: number;
  duration?: string;
  rightsStatus: 'needs-review';
  score?: number;
};

type YtDlpInfo = Record<string, unknown>;

export const requiredProfiles = ['media-youtube'] as const;
export const requiredCommands = ['yt-dlp'] as const;
export const clipScoringFields = ['views', 'velocity', 'recency', 'sport', 'duration', 'breakdownPotential', 'rightsStatus'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberFrom(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function videoIdFrom(item: YouTubeSearchItem): string {
  if (typeof item.id === 'string') return item.id;
  return item.id?.videoId ?? '';
}

export function normalizeYouTubeSearchFixture(fixture: unknown): YouTubeCandidate[] {
  const items = isRecord(fixture) && Array.isArray(fixture.items) ? fixture.items : [];
  return items.filter(isRecord).map((raw) => {
    const item = raw as YouTubeSearchItem;
    const id = videoIdFrom(item);
    return {
      id,
      title: item.snippet?.title ?? '',
      channel: item.snippet?.channelTitle ?? '',
      url: 'https://www.youtube.com/watch?v=' + id,
      publishedAt: item.snippet?.publishedAt,
      views: numberFrom(item.statistics?.viewCount),
      duration: item.contentDetails?.duration,
      rightsStatus: 'needs-review',
    };
  });
}

export function scoreClipCandidates(candidates: YouTubeCandidate[]): YouTubeCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    score: candidate.views + (candidate.duration && candidate.duration.includes('S') ? 1000 : 0),
  })).sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
}

export function normalizeYtDlpInfoJson(info: unknown): Record<string, unknown> {
  const record = isRecord(info) ? info as YtDlpInfo : {};
  return {
    schema: 'media.ingest-manifest.v1',
    source: {
      url: stringValue(record.webpage_url) ?? stringValue(record.original_url),
      id: stringValue(record.id),
      title: stringValue(record.title),
      channel: stringValue(record.channel) ?? stringValue(record.uploader),
      durationSeconds: numberFrom(record.duration),
      uploadDate: stringValue(record.upload_date),
      extractor: 'yt-dlp',
    },
    rights: { status: 'needs-review' },
  };
}

function transcriptRefsForGroup(group: unknown, kind: 'subtitle' | 'auto-subtitle'): Array<Record<string, unknown>> {
  if (!isRecord(group)) return [];
  const refs: Array<Record<string, unknown>> = [];
  for (const [language, entries] of Object.entries(group)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!isRecord(entry)) continue;
      refs.push({
        language,
        kind,
        ext: stringValue(entry.ext),
        url: stringValue(entry.url),
      });
    }
  }
  return refs;
}

export function extractTranscriptRefsFromYtDlpInfo(info: unknown): Array<Record<string, unknown>> {
  const record = isRecord(info) ? info : {};
  return [
    ...transcriptRefsForGroup(record.subtitles, 'subtitle'),
    ...transcriptRefsForGroup(record.automatic_captions, 'auto-subtitle'),
  ];
}
