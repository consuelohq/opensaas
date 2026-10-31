import { spawn } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

import { Effect } from 'effect';

import { PROCESS_TERMINATION_GRACE_MS, registerProcessTreeCleanup, shouldUseDetachedProcessGroup, terminateProcessTree } from '../facade/process-tree';
import { resolveConsueloHomeLayout } from '../consuelo-home';
import { BUBBLEWRAP_EXECUTABLE, buildContainedRuntimeEnv, planLinuxWorkSessionContainment } from './linux-containment';

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
  '(deny file-read* (subpath (param "CONSUELO_KEYS_ROOT")) (subpath (param "CONSUELO_SECURITY_ROOT")) (subpath (param "CONSUELO_TUNNELS_ROOT")))',
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
  '(deny file-read* (subpath (param "CONSUELO_KEYS_ROOT")) (subpath (param "CONSUELO_SECURITY_ROOT")) (subpath (param "CONSUELO_TUNNELS_ROOT")))',
  '(allow file-write* (subpath (param "SCRATCH_ROOT")) (literal "/dev/null"))',
  '(allow network*)',
  '(allow sysctl-read)',
  '(allow mach-lookup)',
  '(allow signal)',
  '(allow ipc-posix*)',
].join('');

function canonicalPath(value: string): string {
  return Effect.runSync(
    Effect.try({
      try: () => realpathSync(value),
      catch: () => value,
    }).pipe(Effect.catchAll((fallback) => Effect.succeed(fallback))),
  );
}

function errorMessage(error: NodeJS.ErrnoException): string {
  return error.message || String(error);
}

export const runRuntimeEffect = (command: string, args: string[], options: RunRuntimeOptions) => Effect.promise<RunResult>(() => new Promise((resolve) => {
  let spawnCommand = command;
  let spawnArgs = args;
  let spawnEnv = options.env;
  let linuxContainment = false;
  if (options.requireContainment === true) {
    if (!options.writeBoundaryRoot || !options.scratchRoot) {
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
    const consueloHome = resolveConsueloHomeLayout(
      options.env.CONSUELO_HOME
        ?? options.env.WORKSPACE_DAEMON_CONSUELO_HOME
        ?? options.env.CONSUELO_OS_HOME,
    ).home;
    const keysRoot = canonicalPath(join(consueloHome, 'node', 'keys'));
    const securityRoot = canonicalPath(join(consueloHome, 'node', 'security', 'generated'));
    const tunnelsRoot = canonicalPath(join(consueloHome, 'node', 'tunnels'));
    if (process.platform === 'darwin' && existsSync(DARWIN_SANDBOX_EXEC)) {
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
        '-D',
        `CONSUELO_KEYS_ROOT=${keysRoot}`,
        '-D',
        `CONSUELO_SECURITY_ROOT=${securityRoot}`,
        '-D',
        `CONSUELO_TUNNELS_ROOT=${tunnelsRoot}`,
        command,
        ...args,
      ];
    } else if (process.platform === 'linux' && existsSync(BUBBLEWRAP_EXECUTABLE)) {
      // Mask OS identity and common local CLI credential stores. Work-session
      // commands must use authorized typed tools for credentialed operations.
      const userHome = options.env.HOME;
      const protectedRoots = [
        keysRoot,
        securityRoot,
        tunnelsRoot,
        ...(userHome
          ? [
              join(userHome, '.ssh'),
              join(userHome, '.codex'),
              join(userHome, '.aws'),
              join(userHome, '.config', 'gh'),
              join(userHome, '.config', 'gcloud'),
              join(userHome, '.config', 'google-cloud-sdk'),
            ]
          : []),
      ].filter((root) => existsSync(root)).map(canonicalPath);
      try {
        const planned = planLinuxWorkSessionContainment({
          command,
          args,
          writeBoundaryRoot,
          scratchRoot,
          protectedReadRoots: protectedRoots,
          allowBoundaryWrites: options.allowBoundaryWrites === true,
        });
        spawnCommand = planned.command;
        spawnArgs = planned.args;
        linuxContainment = true;
      } catch {
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
    } else {
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
    // Preserve the established Darwin sandbox environment. Linux sessions
    // additionally strip daemon credentials before launching Bubblewrap.
    spawnEnv = linuxContainment
      ? buildContainedRuntimeEnv(options.env, scratchRoot)
      : {
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
  let stdinFailure: string | null = null;
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
  child.stdin.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE' || error.code === 'ERR_STREAM_DESTROYED' || settled) return;
    stdinFailure = errorMessage(error);
    stderr += `${stderr ? '\n' : ''}${stdinFailure}`;
    clearTimeout(timer);
    terminateProcessTree(child, 'SIGTERM');
    if (!killTimer) {
      killTimer = setTimeout(() => {
        terminateProcessTree(child, 'SIGKILL');
      }, PROCESS_TERMINATION_GRACE_MS);
      killTimer.unref?.();
    }
  });
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', (error: NodeJS.ErrnoException) => {
    finish({
      stdout,
      stderr: stderr || errorMessage(error),
      exitCode: 1,
      timedOut: false,
      runtimeMissing: error.code === 'ENOENT',
      containmentUnavailable: linuxContainment && error.code === 'ENOENT',
    });
  });
  child.on('close', (code) => {
    finish({
      stdout,
      stderr,
      exitCode: timedOut || stdinFailure ? 1 : code ?? 0,
      timedOut,
      runtimeMissing: false,
      containmentUnavailable: linuxContainment && code !== 0 && /^bwrap:/mu.test(stderr.trimStart()),
    });
  });
  const stdinEndError = Effect.runSync(
    Effect.try({
      try: () => {
        child.stdin.end(options.stdin || '');
        return null;
      },
      catch: (error) => error as NodeJS.ErrnoException,
    }).pipe(Effect.catchAll((error) => Effect.succeed(error))),
  );
  if (stdinEndError) {
    const code = stdinEndError.code;
    if (code !== 'EPIPE' && code !== 'ERR_STREAM_DESTROYED') throw stdinEndError;
  }
}));
