import { spawn } from 'node:child_process';
import { delimiter, dirname, join } from 'node:path';

import { Effect } from 'effect';

import {
  PROCESS_TERMINATION_GRACE_MS,
  registerProcessTreeCleanup,
  shouldUseDetachedProcessGroup,
  terminateProcessTree,
} from '../../scripts/lib/facade/process-tree';
import type {
  ProviderProcess,
  ProviderProcessRequest,
  ProviderProcessResult,
} from './types';

export type NodeProviderProcessOptions = {
  searchPaths?: readonly string[];
};

export const normalizeProviderPath = (
  env: NodeJS.ProcessEnv,
  searchPaths: readonly string[] = [],
): string => {
  const home = env.HOME || env.USERPROFILE || '';
  const existing = (env.PATH || '').split(delimiter).filter(Boolean);
  const candidates = [
    ...searchPaths,
    dirname(process.execPath),
    ...(home ? [join(home, '.bun', 'bin')] : []),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    ...existing,
  ];
  return [...new Set(candidates.filter(Boolean))].join(delimiter);
};

const emptyResult = (overrides: Partial<ProviderProcessResult> = {}): ProviderProcessResult => {
  return {
    stdout: '',
    stderr: '',
    exitCode: 1,
    timedOut: false,
    cancelled: false,
    runtimeMissing: false,
    ...overrides,
  };
};

const runNodeProcess = (
  request: ProviderProcessRequest,
  searchPaths: readonly string[],
): Promise<ProviderProcessResult> => {
  if (request.signal?.aborted) {
    return Promise.resolve(emptyResult({ cancelled: true, exitCode: 130 }));
  }

  return new Promise((resolve) => {
    const env = {
      ...request.env,
      PATH: normalizeProviderPath(request.env, searchPaths),
    };
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      detached: shouldUseDetachedProcessGroup(),
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let cancelled = false;
    let killTimer: NodeJS.Timeout | undefined;
    const cleanupProcessTree = registerProcessTreeCleanup(child);

    const removeAbortListener = (): void => {
      request.signal?.removeEventListener('abort', abort);
    };
    const finish = (result: ProviderProcessResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      removeAbortListener();
      cleanupProcessTree();
      resolve(result);
    };
    const terminate = (): void => {
      terminateProcessTree(child, 'SIGTERM');
      killTimer = setTimeout(() => {
        terminateProcessTree(child, 'SIGKILL');
      }, PROCESS_TERMINATION_GRACE_MS);
    };
    const abort = (): void => {
      cancelled = true;
      terminate();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      terminate();
    }, request.timeoutMs);

    request.signal?.addEventListener('abort', abort, { once: true });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error: NodeJS.ErrnoException) => {
      finish(emptyResult({
        stdout: stdout.trim(),
        stderr: (stderr || error.message || String(error)).trim(),
        exitCode: 1,
        runtimeMissing: error.code === 'ENOENT',
      }));
    });
    child.on('close', (code) => {
      finish(emptyResult({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: timedOut ? 124 : cancelled ? 130 : (code ?? 1),
        timedOut,
        cancelled,
      }));
    });
  });
};

export const createNodeProviderProcess = (
  options: NodeProviderProcessOptions = {},
): ProviderProcess => {
  const searchPaths = options.searchPaths || [];
  return {
    execPath: process.execPath,
    run: (request) => Effect.promise(() => runNodeProcess(request, searchPaths)),
  };
};
