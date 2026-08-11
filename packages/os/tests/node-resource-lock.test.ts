import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  NodeResourceLockError,
  acquireNodeResourceLock,
} from '../scripts/lib/node-resource-lock';
import { removeSafeTempDir } from './safe-temp-cleanup';

const homes: Array<{ home: string; prefix: string }> = [];

function tempHome(prefix: string): string {
  const home = fs.mkdtempSync(path.join(tmpdir(), prefix));
  homes.push({ home, prefix });
  return home;
}

afterEach(() => {
  while (homes.length > 0) {
    const entry = homes.pop();
    if (entry) removeSafeTempDir(entry.home, entry.prefix);
  }
});

describe('node resource lock', () => {
  it('should wait for the current owner when another live operation holds the resource', async () => {
    const home = tempHome('consuelo-node-lock-wait-');
    const lockPath = path.join(home, 'resource.lock');
    const first = await acquireNodeResourceLock({ lockPath, operationId: 'first' });
    let acquiredSecond = false;

    const secondPromise = acquireNodeResourceLock({
      lockPath,
      operationId: 'second',
      waitTimeoutMs: 2_000,
      pollIntervalMs: 10,
    }).then((release) => {
      acquiredSecond = true;
      return release;
    });

    await Bun.sleep(40);
    expect(acquiredSecond).toBe(false);
    await first();

    const second = await secondPromise;
    expect(acquiredSecond).toBe(true);
    await second();
  });

  it('should recover an old lock when its owner process is no longer alive', async () => {
    const home = tempHome('consuelo-node-lock-stale-');
    const lockPath = path.join(home, 'resource.lock');
    fs.writeFileSync(lockPath, `${JSON.stringify({
      ownerId: 'dead-owner',
      operationId: 'dead-operation',
      acquiredAt: new Date(Date.now() - 60_000).toISOString(),
      pid: 2_147_483_647,
    })}\n`, { mode: 0o600 });

    const release = await acquireNodeResourceLock({
      lockPath,
      operationId: 'replacement',
      staleAfterMs: 10,
      waitTimeoutMs: 1_000,
      pollIntervalMs: 10,
    });

    const record = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as { operationId?: string };
    expect(record.operationId).toBe('replacement');
    await release();
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('should recover an old malformed lock without treating it as a live owner', async () => {
    const home = tempHome('consuelo-node-lock-malformed-');
    const lockPath = path.join(home, 'resource.lock');
    fs.writeFileSync(lockPath, 'partial-lock-record\n', { mode: 0o600 });
    const oldTime = new Date(Date.now() - 60_000);
    fs.utimesSync(lockPath, oldTime, oldTime);

    const release = await acquireNodeResourceLock({
      lockPath,
      operationId: 'replacement',
      staleAfterMs: 10,
      waitTimeoutMs: 1_000,
      pollIntervalMs: 10,
    });

    const record = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as { operationId?: string };
    expect(record.operationId).toBe('replacement');
    await release();
  });

  it('should time out without stealing a lock from a live owner', async () => {
    const home = tempHome('consuelo-node-lock-timeout-');
    const lockPath = path.join(home, 'resource.lock');
    const first = await acquireNodeResourceLock({ lockPath, operationId: 'first' });

    const failure = await acquireNodeResourceLock({
      lockPath,
      operationId: 'second',
      waitTimeoutMs: 40,
      pollIntervalMs: 10,
      staleAfterMs: 1,
    }).then(
      () => null,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(NodeResourceLockError);
    expect((failure as NodeResourceLockError).code).toBe('LOCK_TIMEOUT');
    expect(fs.existsSync(lockPath)).toBe(true);
    await first();
  });

  it('should release only when the lock record still belongs to the same owner', async () => {
    const home = tempHome('consuelo-node-lock-owner-');
    const lockPath = path.join(home, 'resource.lock');
    const release = await acquireNodeResourceLock({ lockPath, operationId: 'first' });
    const replacement = {
      ownerId: 'replacement-owner',
      operationId: 'replacement',
      acquiredAt: new Date().toISOString(),
      pid: process.pid,
    };
    fs.writeFileSync(lockPath, `${JSON.stringify(replacement)}\n`, { mode: 0o600 });

    await release();

    expect(JSON.parse(fs.readFileSync(lockPath, 'utf8'))).toMatchObject(replacement);
  });
});
