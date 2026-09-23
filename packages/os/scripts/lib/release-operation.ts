import { spawn as spawnNodeProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import type { ReleaseChannel } from './release-orchestrator';

export type ReleaseOperationRequest = {
  repo: string;
  pr: number;
  channel: ReleaseChannel;
  mergeMethod: 'merge' | 'squash' | 'rebase';
  releaseOnly: boolean;
  dryRun?: boolean;
};

export type ReleaseOperationState = {
  schemaVersion: 1;
  operationId: string;
  fingerprint: string;
  phase: 'queued' | 'running' | 'succeeded' | 'failed';
  request: ReleaseOperationRequest;
  createdAt: string;
  updatedAt: string;
  workerPid?: number;
  message?: string;
  result?: unknown;
};

type SpawnedProcess = {
  pid?: number;
  unref(): void;
  once(event: string, listener: (error: Error) => void): unknown;
};

type ReleaseOperationManagerOptions = {
  home: string;
  executable: string;
  scriptPath: string;
  spawnProcess?: (
    command: string,
    args: string[],
    options: { cwd: string; detached: boolean; stdio: 'ignore' | ['ignore', number, number] },
  ) => SpawnedProcess;
  processAlive?: (pid: number) => boolean;
  now?: () => Date;
};

const canonical = (request: ReleaseOperationRequest): string => JSON.stringify({
  channel: request.channel,
  dryRun: Boolean(request.dryRun),
  mergeMethod: request.mergeMethod,
  pr: request.pr,
  releaseOnly: request.releaseOnly,
  repo: request.repo,
});

export function releaseOperationFingerprint(request: ReleaseOperationRequest): string {
  return createHash('sha256').update(canonical(request)).digest('hex');
}

export function releaseOperationId(request: ReleaseOperationRequest): string {
  return `release-${releaseOperationFingerprint(request).slice(0, 24)}`;
}

function defaultProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function createReleaseOperationManager(options: ReleaseOperationManagerOptions) {
  const now = options.now ?? (() => new Date());
  const processAlive = options.processAlive ?? defaultProcessAlive;
  const root = path.join(options.home, 'node', 'runs', 'releases');
  mkdirSync(root, { recursive: true, mode: 0o700 });

  const operationDir = (operationId: string) => path.join(root, operationId);
  const statePath = (operationId: string) => path.join(operationDir(operationId), 'state.json');
  const logPath = (operationId: string) => path.join(operationDir(operationId), 'release.log');
  const lockPath = (operationId: string) => path.join(operationDir(operationId), '.start.lock');

  const readState = (operationId: string): ReleaseOperationState | null => {
    const target = statePath(operationId);
    if (!existsSync(target)) return null;
    return JSON.parse(readFileSync(target, 'utf8')) as ReleaseOperationState;
  };

  const writeState = (state: ReleaseOperationState): void => {
    const dir = operationDir(state.operationId);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const target = statePath(state.operationId);
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    renameSync(temp, target);
  };

  const withStartLock = async <T>(operationId: string, fn: () => Promise<T>): Promise<T> => {
    mkdirSync(operationDir(operationId), { recursive: true, mode: 0o700 });
    let fd: number | undefined;
    try {
      fd = openSync(lockPath(operationId), 'wx', 0o600);
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') throw error;
      for (let attempt = 0; attempt < 50; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (!existsSync(lockPath(operationId))) return withStartLock(operationId, fn);
      }
      throw new Error(`release operation ${operationId} is busy`);
    }
    try {
      return await fn();
    } finally {
      if (fd !== undefined) closeSync(fd);
      rmSync(lockPath(operationId), { force: true });
    }
  };

  const spawnWorker = (state: ReleaseOperationState): ReleaseOperationState => {
    const dir = operationDir(state.operationId);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const openedLog = openSync(logPath(state.operationId), 'a', 0o600);
    let child: SpawnedProcess;
    try {
      child = options.spawnProcess
        ? options.spawnProcess(
          options.executable,
          [options.scriptPath, '--operation-worker', state.operationId],
          { cwd: dir, detached: true, stdio: 'ignore' },
        )
        : spawnNodeProcess(
          options.executable,
          [options.scriptPath, '--operation-worker', state.operationId],
          { cwd: dir, detached: true, stdio: ['ignore', openedLog, openedLog] },
        );
    } finally {
      closeSync(openedLog);
    }
    if (!child.pid) throw new Error('release operation worker did not start');
    child.once('error', () => undefined);
    child.unref();
    const running: ReleaseOperationState = {
      ...state,
      phase: 'running',
      workerPid: child.pid,
      message: 'release worker started',
      updatedAt: now().toISOString(),
    };
    writeState(running);
    return running;
  };

  const start = async (request: ReleaseOperationRequest) => {
    const operationId = releaseOperationId(request);
    return withStartLock(operationId, async () => {
      const existing = readState(operationId);
      if (existing) {
        const alive = existing.workerPid ? processAlive(existing.workerPid) : false;
        if (existing.phase === 'succeeded' || existing.phase === 'queued' || (existing.phase === 'running' && alive)) {
          return { operationId, reused: true, state: existing };
        }
        if (existing.phase === 'failed' || existing.phase === 'running') {
          return { operationId, reused: true, state: existing };
        }
      }
      const timestamp = now().toISOString();
      const queued: ReleaseOperationState = {
        schemaVersion: 1,
        operationId,
        fingerprint: releaseOperationFingerprint(request),
        phase: 'queued',
        request,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      writeState(queued);
      return { operationId, reused: false, state: spawnWorker(queued) };
    });
  };

  const resume = async (operationId: string) => withStartLock(operationId, async () => {
    const existing = readState(operationId);
    if (!existing) throw new Error(`release operation not found: ${operationId}`);
    const alive = existing.workerPid ? processAlive(existing.workerPid) : false;
    if (existing.phase === 'succeeded') {
      return { operationId, resumed: false, reused: true, state: existing };
    }
    if (existing.phase === 'running' && alive) {
      return { operationId, resumed: false, reused: true, state: existing };
    }
    const relaunched = spawnWorker({
      ...existing,
      phase: 'queued',
      workerPid: undefined,
      message: 'release operation resumed',
      updatedAt: now().toISOString(),
    });
    return { operationId, resumed: true, reused: false, state: relaunched };
  });

  const logs = (operationId: string, tailLines = 80) => {
    const target = logPath(operationId);
    const bounded = Math.max(1, Math.min(500, Math.trunc(tailLines)));
    if (!existsSync(target)) return { operationId, lines: [] as string[] };
    const lines = readFileSync(target, 'utf8').split(/\r?\n/).filter(Boolean);
    return { operationId, lines: lines.slice(-bounded) };
  };

  return {
    root,
    statePath,
    logPath,
    status: readState,
    writeState,
    start,
    resume,
    logs,
    appendLog(operationId: string, message: string) {
      mkdirSync(operationDir(operationId), { recursive: true, mode: 0o700 });
      const fd = openSync(logPath(operationId), 'a', 0o600);
      try {
        writeFileSync(fd, `${message.replace(/[\r\n]+/g, ' ').slice(0, 2_000)}\n`);
      } finally {
        closeSync(fd);
      }
    },
  };
}
