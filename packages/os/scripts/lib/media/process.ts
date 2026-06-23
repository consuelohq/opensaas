import { Effect } from 'effect';

export type MediaProcessRunInput = {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
};

export type MediaProcessRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type MediaProcessService = {
  run: (input: MediaProcessRunInput) => Effect.Effect<MediaProcessRunResult, Error>;
};

export const MediaProcess = Symbol('MediaProcess');

export const liveMediaProcess: MediaProcessService = {
  run: (input) => Effect.tryPromise({
    try: async () => {
      try {
        const proc = Bun.spawn([input.command, ...input.args], {
          cwd: input.cwd,
          env: input.env ? { ...process.env, ...input.env } : process.env,
          stdout: 'pipe',
          stderr: 'pipe',
        });
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
