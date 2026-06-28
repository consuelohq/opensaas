import { Effect } from 'effect';

export type SourceCaptureProcessService = {
  run: (command: string, args: string[]) => Effect.Effect<{ exitCode: number; stdout: string; stderr: string }, Error>;
};

export const SourceCaptureProcess = Symbol('SourceCaptureProcess');

export const liveSourceCaptureProcess: SourceCaptureProcessService = {
  run: (command, args) => Effect.tryPromise({
    try: async () => {
      try {
        const proc = Bun.spawn([command, ...args], { stdout: 'pipe', stderr: 'pipe' });
        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
          proc.exited,
        ]);
        return { exitCode, stdout, stderr };
      } catch (error: unknown) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    },
    catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)),
  }),
};
