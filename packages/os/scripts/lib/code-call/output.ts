import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { Effect } from 'effect';

import { causeMessage, codeCallServiceError } from './errors';

export type TruncatedOutput = {
  stdout: string;
  stderr: string;
  truncated: boolean;
  stdoutLogPath?: string;
  stderrLogPath?: string;
};

const writeFullLogEffect = (stageDir: string, name: string, value: string) => Effect.try({
  try: () => {
    const logPath = path.join(stageDir, name);
    writeFileSync(logPath, value, 'utf8');
    return logPath;
  },
  catch: (cause) => codeCallServiceError({
    envelopeCode: 'COMMAND_FAILED',
    message: 'failed to write code.call output log: ' + causeMessage(cause),
    detectedMistakeClass: 'output_truncated',
  }),
});

function truncateForEnvelope(value: string, maxResultChars: number): string {
  if (value.length <= maxResultChars) return value;

  let omittedChars = value.length;
  let marker = '';
  let remainingChars = maxResultChars;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    marker = `\n... omitted ${omittedChars} chars ...\n`;
    if (marker.length >= maxResultChars) return value.slice(0, maxResultChars);
    remainingChars = maxResultChars - marker.length;

    const nextOmittedChars = value.length - remainingChars;
    if (nextOmittedChars === omittedChars) break;
    omittedChars = nextOmittedChars;
  }

  marker = `\n... omitted ${omittedChars} chars ...\n`;
  if (marker.length >= maxResultChars) return value.slice(0, maxResultChars);

  const headChars = Math.floor(remainingChars / 2);
  const tailChars = remainingChars - headChars;

  return `${value.slice(0, headChars)}${marker}${value.slice(value.length - tailChars)}`;
}

export const truncateOutputEffect = (stageDir: string, stdout: string, stderr: string, maxResultChars: number) => Effect.gen(function* () {
  const result: TruncatedOutput = {
    stdout,
    stderr,
    truncated: false,
  };

  if (stdout.length > maxResultChars) {
    result.stdoutLogPath = yield* writeFullLogEffect(stageDir, 'stdout.log', stdout);
    result.stdout = truncateForEnvelope(stdout, maxResultChars);
    result.truncated = true;
  }

  if (stderr.length > maxResultChars) {
    result.stderrLogPath = yield* writeFullLogEffect(stageDir, 'stderr.log', stderr);
    result.stderr = truncateForEnvelope(stderr, maxResultChars);
    result.truncated = true;
  }

  return result;
});
