import { spawn } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';

import { Effect } from 'effect';

import { PROCESS_TERMINATION_GRACE_MS, registerProcessTreeCleanup, shouldUseDetachedProcessGroup, terminateProcessTree } from '../facade/process-tree';

export type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  runtimeMissing: boolean;
  containmentUnavailable: boolean;
};

export type RunRuntimeOptions = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  stdin?: string;
  timeoutMs: number;
  writeBoundaryRoot?: string;
  scratchRoot?: string;
  requireContainment?: boolean;
  allowBoundaryWrites?: boolean;
};

const DARWIN_SANDBOX_EXEC = '/usr/bin/sandbox-exec';
const DARWIN_WRITE_CONTAINMENT_PROFILE = [
  '(version 1)',
  '(deny default)',
  '(allow process*)',
  '(allow file-read*)',
  '(allow file-write* (subpath (param "WRITE_ROOT")) (subpath (param "SCRATCH_ROOT")) (literal "/dev/null"))',
  '(allow network*)',
  '(allow sysctl-read)',
  '(allow mach-lookup)',
  '(allow signal)',
  '(allow ipc-posix*)',
].join('');
const DARWIN_READ_CONTAINMENT_PROFILE = [
  '(version 1)',
  '(deny default)',
  '(allow process*)',
  '(allow file-read*)',
  '(allow file-write* (subpath (param "SCRATCH_ROOT")) (literal "/dev/null"))',
  '(allow network*)',
  '(allow sysctl-read)',
  '(allow mach-lookup)',
  '(allow signal)',
  '(allow ipc-posix*)',
].join('');

function canonicalPath(value: string): string {
  try {
    return realpathSync(value);
  } catch {
    return value;
  }
}

function errorMessage(error: NodeJS.ErrnoException): string {
  return error.message || String(error);
}

export const runRuntimeEffect = (command: string, args: string[], options: RunRuntimeOptions) => Effect.promise<RunResult>(() => new Promise((resolve) => {
  let spawnCommand = command;
  let spawnArgs = args;
  let spawnEnv = options.env;
  if (options.requireContainment === true) {
    if (
      process.platform !== 'darwin'
      || !existsSync(DARWIN_SANDBOX_EXEC)
      || !options.writeBoundaryRoot
      || !options.scratchRoot
    ) {
      resolve({
        stdout: '',
        stderr: 'edit containment is unavailable on this node',
        exitCode: 1,
        timedOut: false,
        runtimeMissing: false,
        containmentUnavailable: true,
      });
      return;
    }

    const writeBoundaryRoot = canonicalPath(options.writeBoundaryRoot);
    const scratchRoot = canonicalPath(options.scratchRoot);
    spawnCommand = DARWIN_SANDBOX_EXEC;
    spawnArgs = [
      '-p',
      options.allowBoundaryWrites === true
        ? DARWIN_WRITE_CONTAINMENT_PROFILE
        : DARWIN_READ_CONTAINMENT_PROFILE,
      '-D',
      `WRITE_ROOT=${writeBoundaryRoot}`,
      '-D',
      `SCRATCH_ROOT=${scratchRoot}`,
      command,
      ...args,
    ];
    spawnEnv = {
      ...options.env,
      TMPDIR: scratchRoot + '/',
      TMP: scratchRoot,
      TEMP: scratchRoot,
      XDG_CACHE_HOME: scratchRoot,
      PYTHONPYCACHEPREFIX: scratchRoot,
    };
  }

  const child = spawn(spawnCommand, spawnArgs, {
    cwd: options.cwd,
    detached: shouldUseDetachedProcessGroup(),
    env: spawnEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let settled = false;
  let timedOut = false;
  let killTimer: NodeJS.Timeout | null = null;
  const cleanupProcessTree = registerProcessTreeCleanup(child);

  const finish = (result: RunResult): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (killTimer) clearTimeout(killTimer);
    cleanupProcessTree();
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
      containmentUnavailable: false,
    });
  });
  child.on('close', (code) => {
    finish({ stdout, stderr, exitCode: code ?? 0, timedOut, runtimeMissing: false, containmentUnavailable: false });
  });
  child.stdin.end(options.stdin || '');
}));
