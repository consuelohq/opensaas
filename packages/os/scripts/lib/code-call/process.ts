import { spawn } from 'node:child_process';

import { Effect } from 'effect';

import { PROCESS_TERMINATION_GRACE_MS, shouldUseDetachedProcessGroup, terminateProcessTree } from '../facade/process-tree';

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
    detached: shouldUseDetachedProcessGroup(),
    env: options.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let settled = false;
  let timedOut = false;
  let killTimer: NodeJS.Timeout | null = null;

  const finish = (result: RunResult): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (killTimer) clearTimeout(killTimer);
    resolve(result);
  };

  const timer = setTimeout(() => {
    timedOut = true;
    terminateProcessTree(child, 'SIGTERM');
    killTimer = setTimeout(() => {
      terminateProcessTree(child, 'SIGKILL');
    }, PROCESS_TERMINATION_GRACE_MS);
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
