import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';

import { lifecycleError } from './errors';
import { resolveLifecyclePaths } from './paths';

export type LifecycleLockRelease = (() => Promise<void>) & {
  recoveredStaleLock: boolean;
};

type LockRecord = {
  operationId: string;
  acquiredAt: string;
  pid: number;
};

function readLock(path: string): LockRecord | null {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as Partial<LockRecord>;
    if (
      typeof value.operationId !== 'string' ||
      typeof value.acquiredAt !== 'string' ||
      typeof value.pid !== 'number'
    ) {
      return null;
    }
    return value as LockRecord;
  } catch {
    return null;
  }
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

function recordsMatch(left: LockRecord | null, right: LockRecord | null): boolean {
  return Boolean(
    left
      && right
      && left.operationId === right.operationId
      && left.acquiredAt === right.acquiredAt
      && left.pid === right.pid,
  );
}

function isStale(record: LockRecord | null, now: Date, staleAfterMs: number): boolean {
  if (!record) return true;
  if (processIsAlive(record.pid)) return false;
  const acquired = Date.parse(record.acquiredAt);
  return !Number.isFinite(acquired) || now.getTime() - acquired >= staleAfterMs;
}

export async function acquireLifecycleLock(input: {
  home?: string;
  operationId: string;
  now?: Date;
  staleAfterMs?: number;
}): Promise<LifecycleLockRelease> {
  const paths = resolveLifecyclePaths(input.home);
  const now = input.now ?? new Date();
  const staleAfterMs = input.staleAfterMs ?? 15 * 60 * 1000;
  mkdirSync(paths.runtimeDir, { recursive: true });
  let recoveredStaleLock = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const record: LockRecord = {
        operationId: input.operationId,
        acquiredAt: now.toISOString(),
        pid: process.pid,
      };
      writeFileSync(paths.lockPath, `${JSON.stringify(record)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
      const release = (async () => {
        const current = readLock(paths.lockPath);
        if (current?.operationId === input.operationId) {
          rmSync(paths.lockPath, { force: true });
        }
      }) as LifecycleLockRelease;
      release.recoveredStaleLock = recoveredStaleLock;
      return release;
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') {
        throw lifecycleError('LOCK_IO_FAILED', 'failed to acquire lifecycle lock', { cause: error });
      }
      const existing = readLock(paths.lockPath);
      if (attempt === 0 && isStale(existing, now, staleAfterMs)) {
        const quarantinePath = `${paths.lockPath}.stale-${input.operationId}`;
        rmSync(quarantinePath, { force: true });
        try {
          renameSync(paths.lockPath, quarantinePath);
        } catch (renameError: unknown) {
          if ((renameError as NodeJS.ErrnoException).code === 'ENOENT') continue;
          throw lifecycleError('LOCK_IO_FAILED', 'failed to quarantine stale lifecycle lock', {
            cause: renameError,
          });
        }
        const quarantined = readLock(quarantinePath);
        if (existing ? !recordsMatch(existing, quarantined) : quarantined !== null) {
          try {
            renameSync(quarantinePath, paths.lockPath);
          } catch {
            // A competing owner may already have acquired the canonical lock path.
          }
          throw lifecycleError('LOCK_HELD', 'lifecycle lock owner changed during stale recovery');
        }
        rmSync(quarantinePath, { force: true });
        recoveredStaleLock = true;
        continue;
      }
      throw lifecycleError(
        'LOCK_HELD',
        `lifecycle operation is already in progress${existing?.operationId ? ` (${existing.operationId})` : ''}`,
      );
    }
  }

  throw lifecycleError('LOCK_HELD', 'lifecycle operation is already in progress');
}
