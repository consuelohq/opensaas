import { spawn } from 'node:child_process';

import { Effect } from 'effect';

import type { BrowserProcess, BrowserProcessRequest, BrowserProcessResult } from './types';

function errorMessage(error: NodeJS.ErrnoException): string {
  return error.message || String(error);
}

function runAgentBrowser(request: BrowserProcessRequest, defaultTimeoutMs: number): Promise<BrowserProcessResult> {
  return new Promise((resolve) => {
    const child = spawn('agent-browser', request.args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    const finish = (result: BrowserProcessResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, request.timeoutMs ?? defaultTimeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error: NodeJS.ErrnoException) => {
      finish({
        stdout: stdout.trim(),
        stderr: (stderr || errorMessage(error)).trim(),
        exitCode: 1,
        timedOut: false,
        runtimeMissing: error.code === 'ENOENT',
      });
    });
    child.on('close', (code) => {
      finish({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 0,
        timedOut,
        runtimeMissing: false,
      });
    });
  });
}

export function createBrowserProcess(defaultTimeoutMs: number): BrowserProcess {
  return {
    run: (request) => Effect.promise(() => runAgentBrowser(request, defaultTimeoutMs)),
  };
}
