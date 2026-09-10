import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveLifecyclePaths } from '../lifecycle/paths';
import { scheduleProviderProcessEscalation, signalProviderProcess } from './process-termination';

export type DurableSubagentStatus =
  | 'starting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out'
  | 'completion_unknown';

export type DurableSubagentRun = {
  runId: string;
  requestId?: string;
  traceId?: string;
  fingerprint: string;
  provider: string;
  model?: string;
  reasoningEffort?: string;
  bundle?: string;
  outputFormat?: string;
  policy: string;
  workspaceOnly?: string | false;
  taskSession?: string;
  branch?: string;
  rawShellUsed?: boolean;
  cwd: string;
  instructionPath: string;
  command: string[];
  pid?: number;
  ownerToken?: string;
  ownerMarkerPath?: string;
  exitMarkerPath?: string;
  status: DurableSubagentStatus;
  exitCode?: number;
  timeoutMs: number;
  deadlineAt?: number;
  startedAt: number;
  updatedAt: number;
  stdoutLogPath: string;
  stderrLogPath: string;
  stdoutChars?: number;
  stderrChars?: number;
  finalMessage?: string;
  summary?: unknown;
  usage?: Record<string, number>;
  error?: string;
};

export type DurableSubagentParser = (stdout: string, stderr: string) => {
  completed: boolean;
  failure?: string;
  finalMessage?: string;
  summary?: unknown;
  usage?: Record<string, number>;
  stdoutChars?: number;
  stderrChars?: number;
};

export type DurableSubagentStartInput = {
  requestId?: string;
  fingerprint: string;
  provider: string;
  model?: string;
  reasoningEffort?: string;
  bundle?: string;
  outputFormat?: string;
  policy: string;
  workspaceOnly?: string | false;
  taskSession?: string;
  branch?: string;
  rawShellUsed?: boolean;
  cwd: string;
  instructionPath: string;
  command: string[];
  env: NodeJS.ProcessEnv;
  stdin: string;
  artifacts?: Array<{
    path: string;
    content: string;
    mode?: number;
  }>;
  timeoutMs: number;
  traceId: string;
};

export type DurableSubagentClaimHooks = {
  beforeInitialClaim?: () => void;
  beforeRunnerSpawn?: (run: DurableSubagentRun) => void;
  afterRunnerSpawn?: (run: DurableSubagentRun) => void;
};

export type DurableSubagentStartResult =
  | { ok: true; run: DurableSubagentRun; reused: boolean }
  | { ok: false; code: 'IDEMPOTENCY_CONFLICT' | 'COMMAND_FAILED'; message: string; run?: DurableSubagentRun };

export type DurableSubagentReadResult =
  | { ok: true; run: DurableSubagentRun }
  | { ok: false; code: 'RUN_NOT_FOUND' | 'COMMAND_FAILED'; message: string };

const RUN_ID_PATTERN = /^run_[a-f0-9]{24}$/;
const MAX_PERSISTED_LOG_CHARS = 8_000;
const STARTUP_GRACE_MS = 2_000;
const RUNNER_PATH = fileURLToPath(new URL('./runner.ts', import.meta.url));

export function deriveSubagentRunId(requestId: string | undefined, fallback: string): string {
  const basis = requestId ? `request:${requestId}` : `trace:${fallback}`;
  return `run_${createHash('sha256').update(basis).digest('hex').slice(0, 24)}`;
}

export function resolveSubagentRunDirectory(runId: string, env: NodeJS.ProcessEnv): string {
  if (!RUN_ID_PATTERN.test(runId)) throw new Error('invalid subagent runId');
  const home = env.CONSUELO_HOME || env.CONSUELO_OS_HOME;
  return path.join(resolveLifecyclePaths(home).nodeRunsDir, runId);
}

export function stageSubagentRunDirectory(runId: string, env: NodeJS.ProcessEnv): string {
  const runDir = resolveSubagentRunDirectory(runId, env);
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(runDir, 0o700); } catch { /* Best effort on non-POSIX filesystems. */ }
  return runDir;
}

export function startDurableSubagentRun(
  input: DurableSubagentStartInput,
  hooks: DurableSubagentClaimHooks = {},
): DurableSubagentStartResult {
  const runId = deriveSubagentRunId(input.requestId, input.traceId);
  const runDir = stageSubagentRunDirectory(runId, input.env);
  const statePath = path.join(runDir, 'state.json');
  const existing = readState(statePath);
  if (existing) {
    if (input.requestId && existing.requestId === input.requestId && existing.fingerprint !== input.fingerprint) {
      return {
        ok: false,
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'requestId is already associated with a different subagent run specification',
        run: existing,
      };
    }
    return { ok: true, run: existing, reused: true };
  }

  const now = Date.now();
  const stdoutLogPath = path.join(runDir, 'stdout.log');
  const stderrLogPath = path.join(runDir, 'stderr.log');
  const ownerToken = randomUUID();
  const starting: DurableSubagentRun = {
    runId,
    ...(input.requestId ? { requestId: input.requestId } : {}),
    traceId: input.traceId,
    fingerprint: input.fingerprint,
    provider: input.provider,
    ...(input.model ? { model: input.model } : {}),
    ...(input.reasoningEffort ? { reasoningEffort: input.reasoningEffort } : {}),
    ...(input.bundle ? { bundle: input.bundle } : {}),
    ...(input.outputFormat ? { outputFormat: input.outputFormat } : {}),
    policy: input.policy,
    ...(input.workspaceOnly !== undefined ? { workspaceOnly: input.workspaceOnly } : {}),
    ...(input.taskSession ? { taskSession: input.taskSession } : {}),
    ...(input.branch ? { branch: input.branch } : {}),
    ...(input.rawShellUsed !== undefined ? { rawShellUsed: input.rawShellUsed } : {}),
    cwd: input.cwd,
    instructionPath: input.instructionPath,
    command: input.command,
    ownerToken,
    ownerMarkerPath: path.join(runDir, 'owner.json'),
    exitMarkerPath: path.join(runDir, 'exit.json'),
    status: 'starting',
    timeoutMs: input.timeoutMs,
    deadlineAt: now + Math.max(0, input.timeoutMs),
    startedAt: now,
    updatedAt: now,
    stdoutLogPath,
    stderrLogPath,
  };
  const claim = claimInitialState(statePath, starting, input.fingerprint, hooks);
  if (!claim.claimed) return claim.result;

  if (input.artifacts?.length) {
    try {
      for (const artifact of input.artifacts) {
        const artifactPath = path.resolve(artifact.path);
        const relative = path.relative(runDir, artifactPath);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
          throw new Error('subagent run artifact path must stay inside the run directory');
        }
        fs.mkdirSync(path.dirname(artifactPath), { recursive: true, mode: 0o700 });
        fs.writeFileSync(artifactPath, artifact.content, { encoding: 'utf8', mode: artifact.mode ?? 0o600 });
        try { fs.chmodSync(artifactPath, artifact.mode ?? 0o600); } catch { /* Best effort on non-POSIX filesystems. */ }
      }
    } catch (error: unknown) {
      const failed: DurableSubagentRun = {
        ...starting,
        status: 'failed',
        updatedAt: Date.now(),
        exitCode: 1,
        error: error instanceof Error ? error.message : String(error),
      };
      writeState(statePath, failed);
      return { ok: false, code: 'COMMAND_FAILED', message: failed.error || 'subagent run artifact staging failed', run: failed };
    }
  }
  hooks.beforeRunnerSpawn?.(starting);

  let child: ReturnType<typeof spawn> | undefined;
  try {
    fs.writeFileSync(path.join(runDir, 'stdin.txt'), input.stdin, { encoding: 'utf8', mode: 0o600 });
    writeJsonFile(path.join(runDir, 'launch.json'), {
      runId,
      ownerToken,
      command: input.command,
      cwd: input.cwd,
      stdinPath: path.join(runDir, 'stdin.txt'),
      stdoutLogPath,
      stderrLogPath,
      ownerMarkerPath: starting.ownerMarkerPath,
      exitMarkerPath: starting.exitMarkerPath,
      timeoutMs: input.timeoutMs,
      deadlineAt: starting.deadlineAt,
    });
    child = spawn(process.execPath, [RUNNER_PATH, runDir], {
      cwd: input.cwd,
      env: input.env,
      detached: true,
      stdio: 'ignore',
    });
    child.on('error', () => undefined);
    child.unref();
    const running: DurableSubagentRun = {
      ...starting,
      pid: child.pid,
      status: 'running',
      updatedAt: Date.now(),
    };
    hooks.afterRunnerSpawn?.(running);
    writeState(statePath, running);
    return { ok: true, run: running, reused: false };
  } catch (error: unknown) {
    if (child) {
      signalProviderProcess(child, 'SIGTERM');
      scheduleProviderProcessEscalation(child, 250);
    }
    const failed: DurableSubagentRun = {
      ...starting,
      status: 'failed',
      updatedAt: Date.now(),
      exitCode: 1,
      error: error instanceof Error ? error.message : String(error),
    };
    writeState(statePath, failed);
    return { ok: false, code: 'COMMAND_FAILED', message: failed.error || 'subagent failed to start', run: failed };
  }
}

type InitialClaimResult =
  | { claimed: true }
  | { claimed: false; result: DurableSubagentStartResult };

function claimInitialState(
  statePath: string,
  starting: DurableSubagentRun,
  fingerprint: string,
  hooks: DurableSubagentClaimHooks,
): InitialClaimResult {
  hooks.beforeInitialClaim?.();
  try {
    const fd = fs.openSync(statePath, 'wx', 0o600);
    try {
      fs.writeSync(fd, JSON.stringify(starting, null, 2), undefined, 'utf8');
    } finally {
      fs.closeSync(fd);
    }
    return { claimed: true };
  } catch (error: unknown) {
    if (!isAlreadyExistsError(error)) {
      const message = error instanceof Error ? error.message : String(error);
      return { claimed: false, result: { ok: false, code: 'COMMAND_FAILED', message } };
    }
  }

  const winner = readStateWithRetry(statePath);
  if (!winner) {
    return {
      claimed: false,
      result: { ok: false, code: 'COMMAND_FAILED', message: 'subagent claim exists but its state is unreadable' },
    };
  }
  if (winner.fingerprint !== fingerprint) {
    return {
      claimed: false,
      result: {
        ok: false,
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'requestId is already associated with a different subagent run specification',
        run: winner,
      },
    };
  }
  return { claimed: false, result: { ok: true, run: winner, reused: true } };
}

export function readDurableSubagentRun(runId: string, env: NodeJS.ProcessEnv): DurableSubagentReadResult {
  try {
    const run = readState(path.join(resolveSubagentRunDirectory(runId, env), 'state.json'));
    return run
      ? { ok: true, run }
      : { ok: false, code: 'RUN_NOT_FOUND', message: `subagent run not found: ${runId}` };
  } catch (error: unknown) {
    return { ok: false, code: 'COMMAND_FAILED', message: error instanceof Error ? error.message : String(error) };
  }
}

export function reconcileDurableSubagentRun(
  run: DurableSubagentRun,
  env: NodeJS.ProcessEnv,
  parser: DurableSubagentParser,
): DurableSubagentRun {
  const statePath = path.join(resolveSubagentRunDirectory(run.runId, env), 'state.json');
  if (run.status === 'cancelled') return run;
  if (isTerminal(run.status)) {
    if (run.status === 'completion_unknown') {
      return recoverCompletionUnknownFromExitMarker(statePath, run, parser);
    }
    return run;
  }
  const persisted = readState(statePath);
  if (persisted?.runId === run.runId) {
    if (persisted.status === 'cancelled') return persisted;
    if (isTerminal(persisted.status)) {
      if (persisted.status === 'completion_unknown') {
        return recoverCompletionUnknownFromExitMarker(statePath, persisted, parser);
      }
      return persisted;
    }
    if (persisted.updatedAt > run.updatedAt) run = persisted;
  }
  const now = Date.now();
  const exit = readExitMarker(run);

  if (exit && isOwnedExitMarker(run, exit)) {
    return reconcileOwnedExitMarker(statePath, run, exit, parseDurableRunOutput(run, parser), now);
  }

  if (!run.pid && now - run.startedAt < STARTUP_GRACE_MS) {
    const updated: DurableSubagentRun = { ...run, status: 'starting', updatedAt: now };
    return persistReconciledState(statePath, run, updated);
  }

  const runnerAlive = run.pid ? isProcessAlive(run.pid) : false;
  const owner = readOwnerMarker(run);
  const ownerIsCurrent = Boolean(
    runnerAlive &&
      owner &&
      owner.runId === run.runId &&
      owner.ownerToken === run.ownerToken &&
      owner.runnerPid === run.pid &&
      now - owner.heartbeatAt <= 2_000,
  );
  if (ownerIsCurrent) {
    if (run.status === 'running') return run;
    const updated: DurableSubagentRun = { ...run, status: 'running', updatedAt: now };
    return persistReconciledState(statePath, run, updated);
  }

  if (now - run.startedAt < STARTUP_GRACE_MS) {
    const updated: DurableSubagentRun = { ...run, status: 'starting', updatedAt: now };
    return persistReconciledState(statePath, run, updated);
  }

  const lateExit = readExitMarker(run);
  if (lateExit && isOwnedExitMarker(run, lateExit)) {
    return reconcileOwnedExitMarker(statePath, run, lateExit, parseDurableRunOutput(run, parser), now);
  }

  const updated = withParsed(
    run,
    'completion_unknown',
    parseDurableRunOutput(run, parser),
    now,
    !run.pid
      ? 'runner startup ownership was never published before startup grace expired; no provider was respawned'
      : runnerAlive
        ? 'runner ownership marker is missing or stale; no process was terminated'
        : 'runner exited without a durable exit marker; no provider was respawned',
  );
  return persistReconciledState(statePath, run, updated);
}

export async function waitForDurableSubagentRun(
  run: DurableSubagentRun,
  env: NodeJS.ProcessEnv,
  waitMs: number,
  parser: DurableSubagentParser,
): Promise<{ run: DurableSubagentRun; timedOut: boolean }> {
  const deadline = Date.now() + Math.max(0, waitMs);
  let current = reconcileDurableSubagentRun(run, env, parser);
  while (!isSettledForWait(current.status) && current.status !== 'cancelled' && Date.now() < deadline) {
    try {
      await new Promise((resolve) => setTimeout(resolve, Math.min(50, Math.max(1, deadline - Date.now()))));
      const read = readDurableSubagentRun(current.runId, env);
      if (!read.ok) return { run: current, timedOut: false };
      current = reconcileDurableSubagentRun(read.run, env, parser);
    } catch (error: unknown) {
      const unknown: DurableSubagentRun = {
        ...current,
        status: 'completion_unknown',
        updatedAt: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      };
      try {
        writeState(path.join(resolveSubagentRunDirectory(current.runId, env), 'state.json'), unknown);
      } catch {
        // Preserve the in-memory recovery result when durable reconciliation is unavailable.
      }
      return { run: unknown, timedOut: false };
    }
  }
  return { run: current, timedOut: !isSettledForWait(current.status) && current.status !== 'cancelled' };
}

export function cancelDurableSubagentRun(
  run: DurableSubagentRun,
  env: NodeJS.ProcessEnv,
  parser: DurableSubagentParser = () => ({ completed: false }),
): DurableSubagentRun {
  if (run.status === 'cancelled' || (isTerminal(run.status) && run.status !== 'completion_unknown')) return run;
  if (!run.ownerToken) {
    const unknown = {
      ...run,
      status: 'completion_unknown' as const,
      updatedAt: Date.now(),
      error: 'runner ownership cannot be proven; cancellation was not sent',
    };
    writeState(path.join(resolveSubagentRunDirectory(run.runId, env), 'state.json'), unknown);
    return unknown;
  }
  const runDirectory = resolveSubagentRunDirectory(run.runId, env);
  writeJsonFile(path.join(runDirectory, 'cancel.json'), {
    runId: run.runId,
    ownerToken: run.ownerToken,
    requestedAt: Date.now(),
  });
  if (!run.pid) return { ...run, status: 'starting', updatedAt: Date.now() };
  const deadline = Date.now() + 1_000;
  let current = run;
  const signal = new Int32Array(new SharedArrayBuffer(4));
  while (Date.now() <= deadline) {
    current = reconcileDurableSubagentRun(current, env, parser);
    if (current.status === 'cancelled' || (isTerminal(current.status) && current.status !== 'completion_unknown')) return current;
    Atomics.wait(signal, 0, 0, 20);
    const read = readDurableSubagentRun(run.runId, env);
    if (!read.ok) break;
    current = read.run;
  }
  return reconcileDurableSubagentRun(current, env, parser);
}

export function readDurableSubagentLogs(
  run: DurableSubagentRun,
  options: { full?: boolean } = {},
): { stdout: string; stderr: string } {
  const readLog = options.full ? readFullLog : readBoundedLog;
  return { stdout: readLog(run.stdoutLogPath), stderr: readLog(run.stderrLogPath) };
}

function persistReconciledState(
  statePath: string,
  previous: DurableSubagentRun,
  candidate: DurableSubagentRun,
  authoritativeTerminal = false,
): DurableSubagentRun {
  const current = readState(statePath);
  if (current?.runId === previous.runId) {
    if (current.status === 'cancelled') return current;
    if (isTerminal(current.status)) {
      if (!(authoritativeTerminal && current.status === 'completion_unknown')) return current;
    }
    if (!authoritativeTerminal && current.updatedAt > previous.updatedAt) return current;
  }
  writeState(statePath, candidate);
  return candidate;
}

function recoverCompletionUnknownFromExitMarker(
  statePath: string,
  run: DurableSubagentRun,
  parser: DurableSubagentParser,
): DurableSubagentRun {
  const exit = readExitMarker(run);
  if (!exit || !isOwnedExitMarker(run, exit)) return run;
  const parsed = parseDurableRunOutput(run, parser);
  return reconcileOwnedExitMarker(statePath, run, exit, parsed, Date.now());
}

function parseDurableRunOutput(
  run: DurableSubagentRun,
  parser: DurableSubagentParser,
): ReturnType<DurableSubagentParser> {
  const stdout = readFullLog(run.stdoutLogPath);
  const stderr = readFullLog(run.stderrLogPath);
  return {
    ...parser(stdout, stderr),
    stdoutChars: stdout.length,
    stderrChars: stderr.length,
  };
}

function withParsed(
  run: DurableSubagentRun,
  status: DurableSubagentStatus,
  parsed: ReturnType<DurableSubagentParser>,
  updatedAt: number,
  error?: string,
): DurableSubagentRun {
  return {
    ...run,
    status,
    updatedAt,
    ...(parsed.finalMessage ? { finalMessage: parsed.finalMessage } : {}),
    ...(parsed.summary !== undefined ? { summary: parsed.summary } : {}),
    ...(parsed.usage ? { usage: parsed.usage } : {}),
    ...(typeof parsed.stdoutChars === 'number' ? { stdoutChars: parsed.stdoutChars } : {}),
    ...(typeof parsed.stderrChars === 'number' ? { stderrChars: parsed.stderrChars } : {}),
    ...(error ? { error } : {}),
  };
}

function isTerminal(status: DurableSubagentStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'timed_out' || status === 'completion_unknown';
}

function isSettledForWait(status: DurableSubagentStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'timed_out';
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch { return false; }
}

function readBoundedLog(filePath: string): string {
  try {
    const size = fs.statSync(filePath).size;
    const offset = Math.max(0, size - MAX_PERSISTED_LOG_CHARS);
    const fd = fs.openSync(filePath, 'r');
    try {
      const buffer = Buffer.alloc(MAX_PERSISTED_LOG_CHARS);
      const bytes = fs.readSync(fd, buffer, 0, buffer.length, offset);
      return buffer.subarray(0, bytes).toString('utf8');
    } finally { fs.closeSync(fd); }
  } catch { return ''; }
}

function readFullLog(filePath: string): string {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

function readState(filePath: string): DurableSubagentRun | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<DurableSubagentRun>;
    if (typeof parsed.runId !== 'string' || typeof parsed.status !== 'string' || typeof parsed.fingerprint !== 'string') return null;
    return parsed as DurableSubagentRun;
  } catch {
    return null;
  }
}

function readOwnerMarker(run: DurableSubagentRun): {
  runId: string;
  ownerToken: string;
  runnerPid: number;
  providerPid: number;
  heartbeatAt: number;
} | null {
  if (!run.ownerMarkerPath) return null;
  const value = readJsonObject(run.ownerMarkerPath);
  if (
    !value ||
    typeof value.runId !== 'string' ||
    typeof value.ownerToken !== 'string' ||
    typeof value.runnerPid !== 'number' ||
    typeof value.providerPid !== 'number' ||
    typeof value.heartbeatAt !== 'number'
  ) return null;
  return value as unknown as {
    runId: string;
    ownerToken: string;
    runnerPid: number;
    providerPid: number;
    heartbeatAt: number;
  };
}

function readExitMarker(run: DurableSubagentRun): {
  runId: string;
  ownerToken: string;
  runnerPid: number;
  outcome: 'completed' | 'failed' | 'timed_out' | 'cancelled';
  exitCode?: number;
  error?: string;
} | null {
  if (!run.exitMarkerPath) return null;
  const value = readJsonObject(run.exitMarkerPath);
  if (
    !value ||
    typeof value.runId !== 'string' ||
    typeof value.ownerToken !== 'string' ||
    typeof value.runnerPid !== 'number' ||
    typeof value.outcome !== 'string'
  ) return null;
  if (!['completed', 'failed', 'timed_out', 'cancelled'].includes(value.outcome)) return null;
  return value as unknown as {
    runId: string;
    ownerToken: string;
    runnerPid: number;
    outcome: 'completed' | 'failed' | 'timed_out' | 'cancelled';
    exitCode?: number;
    error?: string;
  };
}

function reconcileOwnedExitMarker(
  statePath: string,
  run: DurableSubagentRun,
  exit: NonNullable<ReturnType<typeof readExitMarker>>,
  parsed: ReturnType<DurableSubagentParser>,
  now: number,
): DurableSubagentRun {
  const providerFailure = exit.outcome === 'completed' ? parsed.failure : undefined;
  const updated: DurableSubagentRun = {
    ...run,
    status: providerFailure ? 'failed' : exit.outcome,
    ...(providerFailure
      ? { exitCode: 1 }
      : exit.exitCode !== undefined
        ? { exitCode: exit.exitCode }
        : {}),
    updatedAt: now,
    ...(parsed.finalMessage ? { finalMessage: parsed.finalMessage } : {}),
    ...(parsed.summary !== undefined ? { summary: parsed.summary } : {}),
    ...(parsed.usage ? { usage: parsed.usage } : {}),
    ...(typeof parsed.stdoutChars === 'number' ? { stdoutChars: parsed.stdoutChars } : {}),
    ...(typeof parsed.stderrChars === 'number' ? { stderrChars: parsed.stderrChars } : {}),
    ...(providerFailure || exit.error ? { error: providerFailure || exit.error } : {}),
  };
  return persistReconciledState(statePath, run, updated, true);
}

function isOwnedExitMarker(
  run: DurableSubagentRun,
  marker: {
    runId: string;
    ownerToken: string;
    runnerPid: number;
  },
): boolean {
  return marker.runId === run.runId && marker.ownerToken === run.ownerToken && marker.runnerPid === run.pid;
}

function readJsonObject(filePath: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, value: unknown): void {
  const temporary = filePath + '.' + process.pid + '.' + randomUUID() + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, filePath);
}

function readStateWithRetry(filePath: string): DurableSubagentRun | null {
  const deadline = Date.now() + 1_000;
  const signal = new Int32Array(new SharedArrayBuffer(4));
  while (Date.now() <= deadline) {
    const state = readState(filePath);
    if (state) return state;
    Atomics.wait(signal, 0, 0, 5);
  }
  return null;
}

function isAlreadyExistsError(error: unknown): boolean {
  return error instanceof Error && (error as Error & { code?: string }).code === 'EEXIST';
}

function writeState(filePath: string, value: DurableSubagentRun): void {
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, filePath);
}
