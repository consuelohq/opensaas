import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  preserveFirstTerminationOutcome,
  providerExitCodeForOutcome,
  scheduleProviderProcessEscalation,
  signalProviderProcess,
} from './process-termination.ts';

type LaunchSpec = {
  runId: string;
  ownerToken: string;
  command: string[];
  cwd: string;
  stdinPath: string;
  stdoutLogPath: string;
  stderrLogPath: string;
  ownerMarkerPath: string;
  exitMarkerPath: string;
  timeoutMs: number;
  deadlineAt: number;
};

type ProviderChild = ChildProcess & { pid: number };

const runDirectory = process.argv[2];
if (!runDirectory) process.exit(64);

const launch = JSON.parse(fs.readFileSync(path.join(runDirectory, 'launch.json'), 'utf8')) as LaunchSpec;
let provider: ProviderChild | undefined;
let finished = false;
let requestedOutcome: 'timed_out' | 'cancelled' | undefined;
let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
let cancelTimer: ReturnType<typeof setInterval> | undefined;
let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

function writeMarker(filePath: string, value: unknown): void {
  const temporary = filePath + '.' + process.pid + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, filePath);
}

function finish(
  outcome: 'completed' | 'failed' | 'timed_out' | 'cancelled',
  exitCode: number,
  signal?: NodeJS.Signals | null,
  error?: string,
): void {
  if (finished) return;
  finished = true;
  if (timeoutTimer) clearTimeout(timeoutTimer);
  if (cancelTimer) clearInterval(cancelTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  writeMarker(launch.exitMarkerPath, {
    runId: launch.runId,
    ownerToken: launch.ownerToken,
    runnerPid: process.pid,
    providerPid: provider?.pid,
    outcome,
    exitCode,
    ...(signal ? { signal } : {}),
    ...(error ? { error } : {}),
    endedAt: Date.now(),
  });
  process.exitCode = exitCode;
}

function terminate(outcome: 'timed_out' | 'cancelled'): void {
  const preserved = preserveFirstTerminationOutcome(requestedOutcome, outcome);
  if (requestedOutcome) return;
  requestedOutcome = preserved;
  if (provider) {
    signalProviderProcess(provider, 'SIGTERM');
    scheduleProviderProcessEscalation(provider, 250);
  }
}

function cancellationRequested(): boolean {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(runDirectory, 'cancel.json'), 'utf8')) as {
      runId?: unknown;
      ownerToken?: unknown;
    };
    return value.runId === launch.runId && value.ownerToken === launch.ownerToken;
  } catch {
    return false;
  }
}

process.on('SIGTERM', () => terminate('cancelled'));
process.on('SIGINT', () => terminate('cancelled'));

try {
  const stdoutFd = fs.openSync(launch.stdoutLogPath, 'a', 0o600);
  const stderrFd = fs.openSync(launch.stderrLogPath, 'a', 0o600);
  try {
    provider = spawn(launch.command[0], launch.command.slice(1), {
      cwd: launch.cwd,
      env: process.env,
      detached: true,
      stdio: ['pipe', stdoutFd, stderrFd],
    }) as ProviderChild;
    writeMarker(launch.ownerMarkerPath, {
      runId: launch.runId,
      ownerToken: launch.ownerToken,
      runnerPid: process.pid,
      providerPid: provider.pid,
      startedAt: Date.now(),
      heartbeatAt: Date.now(),
    });
    heartbeatTimer = setInterval(() => {
      try {
        writeMarker(launch.ownerMarkerPath, {
          runId: launch.runId,
          ownerToken: launch.ownerToken,
          runnerPid: process.pid,
          providerPid: provider?.pid,
          startedAt: launch.deadlineAt - launch.timeoutMs,
          heartbeatAt: Date.now(),
        });
      } catch {
        // A transient marker write failure must not orphan the owned provider.
      }
    }, 250);
    timeoutTimer = setTimeout(() => terminate('timed_out'), Math.max(0, launch.deadlineAt - Date.now()));
    cancelTimer = setInterval(() => {
      if (cancellationRequested()) terminate('cancelled');
    }, 25);
    provider.on('error', (error: unknown) => finish(
      requestedOutcome ?? 'failed',
      1,
      null,
      error instanceof Error ? error.message : String(error),
    ));
    provider.on('close', (exitCode, signal) => finish(
      requestedOutcome ?? (exitCode === 0 ? 'completed' : 'failed'),
      providerExitCodeForOutcome(requestedOutcome, exitCode),
      signal,
    ));
    provider.stdin?.end(fs.readFileSync(launch.stdinPath));
  } finally {
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);
  }
} catch (error: unknown) {
  finish('failed', 1, null, error instanceof Error ? error.message : String(error));
}
