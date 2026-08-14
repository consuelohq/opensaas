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
  maxOutputBytes?: number;
};

const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024;

const appendBoundedOutput = (
  current: Buffer,
  chunk: Buffer | string,
  maxOutputBytes: number,
): { output: Buffer; truncated: boolean } => {
  const incoming = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  const combined = Buffer.concat([current, incoming]);
  if (combined.byteLength <= maxOutputBytes) {
    return { output: combined, truncated: false };
  }
  return {
    output: combined.subarray(combined.byteLength - maxOutputBytes),
    truncated: true,
  };
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
    stdoutTruncated: false,
    stderrTruncated: false,
    ...overrides,
  };
};

const runNodeProcess = (
  request: ProviderProcessRequest,
  searchPaths: readonly string[],
  maxOutputBytes: number,
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
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let stdoutTruncated = false;
    let stderrTruncated = false;
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
    child.stdin.on('error', () => {
      // The process may exit before consuming stdin; the command result owns the failure.
    });
    child.stdin.end(request.stdin);
    child.stdout.on('data', (chunk: Buffer) => {
      const appended = appendBoundedOutput(stdout, chunk, maxOutputBytes);
      stdout = appended.output;
      stdoutTruncated = stdoutTruncated || appended.truncated;
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const appended = appendBoundedOutput(stderr, chunk, maxOutputBytes);
      stderr = appended.output;
      stderrTruncated = stderrTruncated || appended.truncated;
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      finish(emptyResult({
        stdout: stdout.toString('utf8').trim(),
        stderr: (stderr.toString('utf8') || error.message || String(error)).trim(),
        exitCode: 1,
        runtimeMissing: error.code === 'ENOENT',
        stdoutTruncated,
        stderrTruncated,
      }));
    });
    child.on('close', (code) => {
      finish(emptyResult({
        stdout: stdout.toString('utf8').trim(),
        stderr: stderr.toString('utf8').trim(),
        exitCode: timedOut ? 124 : cancelled ? 130 : (code ?? 1),
        timedOut,
        cancelled,
        stdoutTruncated,
        stderrTruncated,
      }));
    });
  });
};

export const createNodeProviderProcess = (
  options: NodeProviderProcessOptions = {},
): ProviderProcess => {
  const searchPaths = options.searchPaths || [];
  const maxOutputBytes = Math.max(1, options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES);
  return {
    execPath: process.execPath,
    run: (request) => Effect.promise(() => runNodeProcess(request, searchPaths, maxOutputBytes)),
  };
};
