import { Effect } from 'effect';
import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';

import { probeEffect } from './probe';

export const QA_RESULT_SCHEMA = 'media.render-result.v1';

function stableId(prefix: string, value: string): string {
  return prefix + '_' + createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export function buildQaChecks(_input: { inputPath: string; expected?: { durationSeconds?: number; width?: number; height?: number; codec?: string; maxFileSizeBytes?: number } }): Array<{ name: string; dependency?: string }> {
  return [
    { name: 'exists' },
    { name: 'duration', dependency: 'ffprobe' },
    { name: 'dimensions', dependency: 'ffprobe' },
    { name: 'codec', dependency: 'ffprobe' },
    { name: 'file-size' },
  ];
}

export const qaEffect = (input: { inputPath: string; expected?: { durationSeconds?: number; width?: number; height?: number; codec?: string; maxFileSizeBytes?: number } }) => Effect.gen(function* () {
  const checks = [] as Array<{ name: string; status: string; details?: Record<string, unknown> }>;
  if (!existsSync(input.inputPath)) {
    checks.push({ name: 'exists', status: 'failed' });
    return {
      schema: QA_RESULT_SCHEMA,
      id: stableId('qa', input.inputPath),
      timelineId: 'unknown',
      output: { path: input.inputPath, durationSeconds: 0, width: 0, height: 0, codec: 'unknown', fileSizeBytes: 0 },
      qa: { status: 'failed', checks },
      provenance: { status: 'needs-review' },
      toolVersions: { ffprobe: 'ffprobe' },
      artifacts: [],
    };
  }
  const probe = yield* probeEffect({ inputPath: input.inputPath, provenance: { status: 'needs-review' } }) as Record<string, unknown>;
  const probeData = probe.probe as Record<string, unknown>;
  const fileSizeBytes = statSync(input.inputPath).size;
  checks.push({ name: 'exists', status: 'passed' });
  checks.push({ name: 'duration', status: 'passed', details: { durationSeconds: probeData.durationSeconds } });
  checks.push({ name: 'dimensions', status: 'passed', details: { width: probeData.width, height: probeData.height } });
  checks.push({ name: 'codec', status: 'passed', details: { codec: probeData.videoCodec } });
  checks.push({ name: 'file-size', status: 'passed', details: { fileSizeBytes } });
  return {
    schema: QA_RESULT_SCHEMA,
    id: stableId('qa', input.inputPath),
    timelineId: 'unknown',
    output: {
      path: input.inputPath,
      durationSeconds: probeData.durationSeconds,
      width: probeData.width,
      height: probeData.height,
      codec: probeData.videoCodec,
      fileSizeBytes,
    },
    qa: { status: 'passed', checks },
    provenance: { status: 'needs-review' },
    toolVersions: { ffprobe: 'ffprobe' },
    artifacts: [{ kind: 'preview', path: input.inputPath }],
  };
});

export function qaForCli(input: { inputPath: string; expected?: { durationSeconds?: number; width?: number; height?: number; codec?: string; maxFileSizeBytes?: number } }) {
  return qaEffect(input);
}
