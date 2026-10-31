import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Effect } from 'effect';

import { resolveAgentBrowserCommand } from './managed-cli';
import type { BrowserProcess, BrowserProcessRequest, BrowserProcessResult } from './types';

// The native agent-browser launcher can leave Chrome's own stderr pipe unread.
// Its Chrome executable override lets OS redirect those fds before Chrome starts.
const CHROME_STDERR_SAFE_LAUNCHER = fileURLToPath(new URL('../../chrome-stderr-safe.sh', import.meta.url));
const MAX_DIAGNOSTIC_BYTES = 65_536;
const PIPE_CLOSE_GRACE_MS = 100;

type AgentBrowserRunnerOptions = {
  command?: string;
  env?: NodeJS.ProcessEnv;
};

function errorMessage(error: NodeJS.ErrnoException): string {
  return error.message || String(error);
}

function browserChildEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (process.platform === 'win32') return env;
  if (env.AGENT_BROWSER_EXECUTABLE_PATH && !env.CONSUELO_BROWSER_CHROME_BINARY) {
    // Explicit user browser executable configuration wins.
    return env;
  }

  const requested = env.CONSUELO_BROWSER_CHROME_BINARY;
  const chrome = requested || (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : undefined);
  if (!chrome || (!requested && !existsSync(chrome))) return env;

  return {
    ...env,
    CONSUELO_BROWSER_CHROME_BINARY: chrome,
    AGENT_BROWSER_EXECUTABLE_PATH: CHROME_STDERR_SAFE_LAUNCHER,
  };
}

function keepTail(current: Buffer, chunk: Buffer, maximum: number): { value: Buffer; truncated: boolean } {
  const overflow = current.byteLength + chunk.byteLength > maximum;
  if (chunk.byteLength >= maximum) {
    return { value: Buffer.from(chunk.subarray(-maximum)), truncated: overflow };
  }
  const tail = overflow ? current.subarray(current.byteLength + chunk.byteLength - maximum) : current;
  return { value: Buffer.concat([tail, chunk]), truncated: overflow };
}

export function runAgentBrowser(
  request: BrowserProcessRequest,
  defaultTimeoutMs: number,
  options: AgentBrowserRunnerOptions = {},
): Promise<BrowserProcessResult> {
  return new Promise((resolve) => {
    const env = options.env ?? process.env;
    const child = spawn(options.command ?? resolveAgentBrowserCommand(env), request.args, {
      env: browserChildEnvironment(env),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = Buffer.alloc(0);
    let stderrTruncated = false;
    let settled = false;
    let timedOut = false;
    let killTimer: NodeJS.Timeout | undefined;
    let closeGraceTimer: NodeJS.Timeout | undefined;

    const stderrText = (): string => {
      const text = stderr.toString('utf8').trim();
      return stderrTruncated ? '[earlier stderr truncated]\n' + text : text;
    };

    const resultForExit = (code: number | null): BrowserProcessResult => ({
      stdout: stdout.trim(),
      stderr: stderrText(),
      exitCode: timedOut ? 124 : (code ?? 1),
      timedOut,
      runtimeMissing: false,
    });

    const finish = (result: BrowserProcessResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      if (closeGraceTimer) clearTimeout(closeGraceTimer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        if (child.exitCode === null) child.kill('SIGKILL');
      }, 250);
    }, request.timeoutMs ?? defaultTimeoutMs);

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: Buffer) => {
      const next = keepTail(stderr, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk), MAX_DIAGNOSTIC_BYTES);
      stderr = next.value;
      stderrTruncated ||= next.truncated;
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      finish({
        stdout: stdout.trim(),
        stderr: stderrText() || errorMessage(error),
        exitCode: 1,
        timedOut: false,
        runtimeMissing: error.code === 'ENOENT',
      });
    });
    child.on('exit', (code) => {
      // A Chrome grandchild may hold the pipe open after the helper exits.
      closeGraceTimer = setTimeout(() => {
        child.stdout.destroy();
        child.stderr.destroy();
        finish(resultForExit(code));
      }, PIPE_CLOSE_GRACE_MS);
    });
    child.on('close', (code) => finish(resultForExit(code)));
  });
}

export function createBrowserProcess(defaultTimeoutMs: number): BrowserProcess {
  return {
    run: (request) => Effect.promise(() => runAgentBrowser(request, defaultTimeoutMs)),
  };
}
