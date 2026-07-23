import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

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

function isStale(record: LockRecord | null, now: Date, staleAfterMs: number): boolean {
  if (!record) return true;
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
        rmSync(paths.lockPath, { force: true });
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
