import { createHash } from 'node:crypto';

import { Effect } from 'effect';

import { MediaError } from './errors';
import { liveMediaProcess } from './process';

export const probeCommandSpec = 'ffprobe -v error -print_format json -show_streams -show_format <input>';

type ProbeContext = {
  inputPath: string;
  provenance?: unknown;
};

type FfprobeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
};

type FfprobeJson = {
  streams?: FfprobeStream[];
  format?: { duration?: string; size?: string; bit_rate?: string };
};

function parseFps(value: string | undefined): number {
  if (!value || value === '0/0') return 0;
  const [left, right] = value.split('/');
  const numerator = Number(left);
  const denominator = right === undefined ? 1 : Number(right);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

function parseDuration(value: string | undefined): number {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return duration;
}

function ffprobeArgs(inputPath: string): string[] {
  return ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', inputPath];
}

function stableId(prefix: string, value: string): string {
  return prefix + '_' + createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export function normalizeFfprobeJson(value: unknown, context: ProbeContext): unknown {
  const data = value as FfprobeJson;
  const streams = Array.isArray(data.streams) ? data.streams : [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  const audio = streams.find((stream) => stream.codec_type === 'audio');
  if (!video) {
    throw new MediaError('MEDIA_VALIDATION_ERROR', 'ffprobe output did not include a video stream', { inputPath: context.inputPath });
  }
  const fps = parseFps(video.avg_frame_rate) || parseFps(video.r_frame_rate) || 30;
  const durationSeconds = parseDuration(data.format?.duration);
  return {
    schema: 'media.asset.v1',
    id: stableId('asset', context.inputPath),
    source: {
      path: context.inputPath,
      provenance: typeof context.provenance === 'object' && context.provenance !== null ? context.provenance : { status: 'needs-review' },
      rights: { status: 'needs-review' },
    },
    probe: {
      durationSeconds,
      width: video.width ?? 0,
      height: video.height ?? 0,
      fps,
      videoCodec: video.codec_name ?? 'unknown',
      audioCodec: audio?.codec_name,
      streams,
    },
    toolVersions: { ffprobe: 'ffprobe' },
  };
}

export type ProbeInput = {
  inputPath: string;
  provenance?: unknown;
};

export const probeEffect = (input: ProbeInput) => Effect.flatMap(
  liveMediaProcess.run({ command: 'ffprobe', args: ffprobeArgs(input.inputPath) }),
  (result) => Effect.try({
    try: () => {
      if (result.exitCode !== 0) {
        throw new MediaError('MEDIA_VALIDATION_ERROR', 'ffprobe failed for input', { inputPath: input.inputPath, stderr: result.stderr });
      }
      const parsed = JSON.parse(result.stdout) as unknown;
      return normalizeFfprobeJson(parsed, { inputPath: input.inputPath, provenance: input.provenance });
    },
    catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)),
  }),
);

export function probeForCli(input: ProbeInput) {
  return probeEffect(input);
}
