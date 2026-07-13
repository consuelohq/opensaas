import { spawn } from 'node:child_process';

import { Effect } from 'effect';

export type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  runtimeMissing: boolean;
};

export type RunRuntimeOptions = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  stdin?: string;
  timeoutMs: number;
};

function errorMessage(error: NodeJS.ErrnoException): string {
  return error.message || String(error);
}

export const runRuntimeEffect = (command: string, args: string[], options: RunRuntimeOptions) => Effect.promise<RunResult>(() => new Promise((resolve) => {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let settled = false;
  let timedOut = false;

  const finish = (result: RunResult): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    resolve(result);
  };

  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
  }, options.timeoutMs);

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', (error: NodeJS.ErrnoException) => {
    finish({
      stdout,
      stderr: stderr || errorMessage(error),
      exitCode: 1,
      timedOut: false,
      runtimeMissing: error.code === 'ENOENT',
    });
  });
  child.on('close', (code) => {
    finish({ stdout, stderr, exitCode: code ?? 0, timedOut, runtimeMissing: false });
  });
  child.stdin.end(options.stdin || '');
}));
