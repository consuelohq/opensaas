import { Effect } from 'effect';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

import { probeEffect } from './probe';
import { liveMediaProcess } from './process';
import { validateTimelineJson } from './timeline';

type JsonObject = Record<string, unknown>;

function objectValue(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null ? value as JsonObject : {};
}

function stableId(prefix: string, value: string): string {
  return prefix + '_' + createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function firstSourcePath(timeline: unknown): string {
  const source = objectValue(objectValue(timeline).source);
  if (typeof source.path !== 'string' || source.path.length === 0) throw new Error('timeline source.path is required');
  return source.path;
}

function renderValue(timeline: unknown, key: string, fallback: number): number {
  const value = objectValue(objectValue(timeline).render)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function assertComposableTimeline(timeline: unknown): void {
  const value = objectValue(timeline);
  if (!value.provenance) throw new Error('timeline provenance is required before composition');
  const validation = validateTimelineJson(timeline);
  if (!validation.ok) throw new Error('timeline is not composable: ' + JSON.stringify(validation.errors));
}

export function buildComposePlan(input: { timeline: unknown; outPath: string }): { command: string; args: string[]; outputPath: string } {
  assertComposableTimeline(input.timeline);
  const sourcePath = firstSourcePath(input.timeline);
  const width = renderValue(input.timeline, 'width', 1080);
  const height = renderValue(input.timeline, 'height', 1920);
  const fps = renderValue(input.timeline, 'fps', 30);
  const filter = 'scale=' + width + ':' + height + ':force_original_aspect_ratio=decrease,pad=' + width + ':' + height + ':(ow-iw)/2:(oh-ih)/2';
  return {
    command: 'ffmpeg',
    args: ['-y', '-i', sourcePath, '-vf', filter, '-r', String(fps), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-metadata', 'comment=overlay-plan', '-shortest', input.outPath],
    outputPath: input.outPath,
  };
}

export const composeEffect = (input: { timelinePath: string; outPath: string }) => Effect.gen(function* () {
  const timeline = JSON.parse(readFileSync(input.timelinePath, 'utf8')) as unknown;
  const plan = buildComposePlan({ timeline, outPath: input.outPath });
  const result = yield* liveMediaProcess.run({ command: plan.command, args: plan.args });
  if (result.exitCode !== 0) throw new Error('ffmpeg compose failed: ' + result.stderr);
  const probe = objectValue(yield* probeEffect({ inputPath: input.outPath, provenance: objectValue(timeline).provenance }));
  const probeData = objectValue(probe.probe);
  return {
    schema: 'media.render-result.v1',
    id: stableId('render', input.outPath),
    timelineId: typeof objectValue(timeline).id === 'string' ? objectValue(timeline).id : 'timeline',
    output: {
      path: input.outPath,
      durationSeconds: probeData.durationSeconds,
      width: probeData.width,
      height: probeData.height,
      codec: probeData.videoCodec,
      fileSizeBytes: statSync(input.outPath).size,
    },
    qa: { status: 'passed', checks: [{ name: 'rendered', status: 'passed' }] },
    provenance: objectValue(timeline).provenance,
    toolVersions: { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' },
    artifacts: [{ kind: 'preview', path: input.outPath }],
  };
});

export function composeForCli(input: { timelinePath: string; outPath: string }) {
  return composeEffect(input);
}
