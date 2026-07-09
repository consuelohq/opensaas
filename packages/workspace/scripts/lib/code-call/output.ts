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

export const truncateOutputEffect = (stageDir: string, stdout: string, stderr: string, maxResultChars: number) => Effect.gen(function* () {
  const result: TruncatedOutput = {
    stdout,
    stderr,
    truncated: false,
  };

  if (stdout.length > maxResultChars) {
    result.stdoutLogPath = yield* writeFullLogEffect(stageDir, 'stdout.log', stdout);
    result.stdout = stdout.slice(0, maxResultChars);
    result.truncated = true;
  }

  if (stderr.length > maxResultChars) {
    result.stderrLogPath = yield* writeFullLogEffect(stageDir, 'stderr.log', stderr);
    result.stderr = stderr.slice(0, maxResultChars);
    result.truncated = true;
  }

  return result;
});
