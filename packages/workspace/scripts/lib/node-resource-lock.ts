import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type NodeResourceLockErrorCode = 'LOCK_TIMEOUT' | 'LOCK_IO_FAILED';

export class NodeResourceLockError extends Error {
  readonly code: NodeResourceLockErrorCode;
  readonly lockPath: string;
  readonly operationId: string;

  constructor(
    code: NodeResourceLockErrorCode,
    message: string,
    input: { lockPath: string; operationId: string; cause?: unknown },
  ) {
    super(message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = 'NodeResourceLockError';
    this.code = code;
    this.lockPath = input.lockPath;
    this.operationId = input.operationId;
  }
}

type NodeResourceLockRecord = {
  ownerId: string;
  operationId: string;
  acquiredAt: string;
  pid: number;
};

export type NodeResourceLockRelease = () => Promise<void>;

export type NodeResourceLockInput = {
  lockPath: string;
  operationId: string;
  waitTimeoutMs?: number;
  pollIntervalMs?: number;
  staleAfterMs?: number;
};

const DEFAULT_WAIT_TIMEOUT_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 25;
const DEFAULT_STALE_AFTER_MS = 5_000;

export function nodeResourceLockPath(resourcePath: string): string {
  return `${resourcePath}.consuelo.lock`;
}

function readLockContents(lockPath: string): string | null {
  try {
    return fs.readFileSync(lockPath, 'utf8');
  } catch {
    return null;
  }
}

function parseLock(contents: string | null): NodeResourceLockRecord | null {
  if (contents === null) return null;
  try {
    const value = JSON.parse(contents) as Partial<NodeResourceLockRecord>;
    if (
      typeof value.ownerId !== 'string'
      || typeof value.operationId !== 'string'
      || typeof value.acquiredAt !== 'string'
      || typeof value.pid !== 'number'
    ) {
      return null;
    }
    return value as NodeResourceLockRecord;
  } catch {
    return null;
  }
}

function readLock(lockPath: string): NodeResourceLockRecord | null {
  return parseLock(readLockContents(lockPath));
}

function processIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function invalidLockIsOld(lockPath: string, nowMs: number, staleAfterMs: number): boolean {
  try {
    return nowMs - fs.statSync(lockPath).mtimeMs >= staleAfterMs;
  } catch {
    return true;
  }
}

function isStale(
  lockPath: string,
  record: NodeResourceLockRecord | null,
  nowMs: number,
  staleAfterMs: number,
): boolean {
  if (record) return !processIsAlive(record.pid);
  return invalidLockIsOld(lockPath, nowMs, staleAfterMs);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createRelease(lockPath: string, ownerId: string): NodeResourceLockRelease {
  return async () => {
    const current = readLock(lockPath);
    if (current?.ownerId === ownerId) fs.rmSync(lockPath, { force: true });
  };
}

function tryRecoverStaleLock(input: {
  lockPath: string;
  ownerId: string;
  observedContents: string | null;
}): boolean {
  const quarantinePath = `${input.lockPath}.stale-${input.ownerId}`;
  fs.rmSync(quarantinePath, { force: true });
  try {
    fs.renameSync(input.lockPath, quarantinePath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw error;
  }

  const quarantinedContents = readLockContents(quarantinePath);
  if (input.observedContents !== quarantinedContents) {
    try {
      if (!fs.existsSync(input.lockPath)) fs.renameSync(quarantinePath, input.lockPath);
    } catch {
      // A competing owner may already have acquired the canonical lock path.
    }
    return false;
  }

  fs.rmSync(quarantinePath, { force: true });
  return true;
}

export async function acquireNodeResourceLock(
  input: NodeResourceLockInput,
): Promise<NodeResourceLockRelease> {
  const waitTimeoutMs = input.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  const pollIntervalMs = input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const staleAfterMs = input.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const ownerId = randomUUID();
  const startedAt = Date.now();
  fs.mkdirSync(path.dirname(input.lockPath), { recursive: true });

  while (true) {
    const record: NodeResourceLockRecord = {
      ownerId,
      operationId: input.operationId,
      acquiredAt: new Date().toISOString(),
      pid: process.pid,
    };

    try {
      fs.writeFileSync(input.lockPath, `${JSON.stringify(record)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
      return createRelease(input.lockPath, ownerId);
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') {
        throw new NodeResourceLockError(
          'LOCK_IO_FAILED',
          `failed to acquire node resource lock for ${input.operationId}`,
          { lockPath: input.lockPath, operationId: input.operationId, cause: error },
        );
      }

      const nowMs = Date.now();
      const observedContents = readLockContents(input.lockPath);
      const observed = parseLock(observedContents);
      if (isStale(input.lockPath, observed, nowMs, staleAfterMs)) {
        try {
          if (tryRecoverStaleLock({ lockPath: input.lockPath, ownerId, observedContents })) continue;
        } catch (recoveryError: unknown) {
          throw new NodeResourceLockError(
            'LOCK_IO_FAILED',
            `failed to recover stale node resource lock for ${input.operationId}`,
            { lockPath: input.lockPath, operationId: input.operationId, cause: recoveryError },
          );
        }
      }

      if (nowMs - startedAt >= waitTimeoutMs) {
        throw new NodeResourceLockError(
          'LOCK_TIMEOUT',
          `timed out waiting for node resource lock for ${input.operationId}`,
          { lockPath: input.lockPath, operationId: input.operationId },
        );
      }
      await sleep(Math.max(1, pollIntervalMs));
    }
  }
}

export async function withNodeResourceLock<T>(
  input: NodeResourceLockInput,
  operation: () => Promise<T>,
): Promise<T> {
  const release = await acquireNodeResourceLock(input);
  try {
    return await operation();
  } finally {
    await release();
  }
}
