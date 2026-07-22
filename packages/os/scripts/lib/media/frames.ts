import { Effect } from 'effect';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { liveMediaProcess } from './process';

export const FRAME_MANIFEST_SCHEMA = 'media.frame-manifest.v1';

export type FrameExtractionInput = {
  inputPath: string;
  outDir: string;
  timestamps: number[];
  ranges?: Array<{ startSeconds: number; endSeconds: number; fps: number }>;
};

export type FrameExtractionPlan = {
  command: string;
  args: string[];
  manifestPath: string;
  outputs: Array<{ path: string; timestampSeconds?: number; range?: { startSeconds: number; endSeconds: number; fps: number } }>;
};

export function assertSafeFrameOutputPath(path: string): void {
  if (path.startsWith('/') || path === '..' || path.startsWith('../') || path.includes('/../')) {
    throw new Error('unsafe media output path: ' + path);
  }
}

function frameName(index: number): string {
  return 'frame-' + String(index + 1).padStart(4, '0') + '.png';
}

export function buildFrameExtractionPlan(input: FrameExtractionInput): FrameExtractionPlan {
  const outputs: FrameExtractionPlan['outputs'] = [];
  const args = ['-y', '-i', input.inputPath];
  input.timestamps.forEach((timestamp) => {
    const outputPath = join(input.outDir, frameName(outputs.length));
    outputs.push({ path: outputPath, timestampSeconds: timestamp });
    args.push('-ss', String(timestamp), '-frames:v', '1', outputPath);
  });
  for (const range of input.ranges ?? []) {
    const pattern = join(input.outDir, 'range-' + String(outputs.length + 1).padStart(4, '0') + '-%04d.png');
    outputs.push({ path: pattern, range });
    args.push('-ss', String(range.startSeconds), '-to', String(range.endSeconds), '-vf', 'fps=' + String(range.fps), pattern);
  }
  return { command: 'ffmpeg', args, manifestPath: join(input.outDir, 'frame-manifest.json'), outputs };
}

function oneFrameEffect(input: { inputPath: string; outputPath: string; timestamp: number }) {
  return Effect.flatMap(
    liveMediaProcess.run({ command: 'ffmpeg', args: ['-y', '-ss', String(input.timestamp), '-i', input.inputPath, '-frames:v', '1', input.outputPath] }),
    (result) => result.exitCode === 0 ? Effect.succeed(undefined) : Effect.fail(new Error('ffmpeg frame extraction failed: ' + result.stderr)),
  );
}

export const extractFramesEffect = (input: FrameExtractionInput) => Effect.gen(function* () {
  mkdirSync(input.outDir, { recursive: true });
  const outputs: Array<{ path: string; timestampSeconds?: number }> = [];
  for (const [index, timestamp] of input.timestamps.entries()) {
    const outputPath = join(input.outDir, frameName(index));
    yield* oneFrameEffect({ inputPath: input.inputPath, outputPath, timestamp });
    outputs.push({ path: outputPath, timestampSeconds: timestamp });
  }
  const manifest = {
    schema: FRAME_MANIFEST_SCHEMA,
    source: { path: input.inputPath },
    frames: outputs,
  };
  writeFileSync(join(input.outDir, 'frame-manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
});

export function extractFramesForCli(input: FrameExtractionInput) {
  return extractFramesEffect(input);
}
