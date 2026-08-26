import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  releasePromotionDispatchLockPath,
  withReleasePromotionDispatchLock,
} from '../scripts/lib/release-promotion-dispatch-lock';
import { removeSafeTempDir } from './safe-temp-cleanup';

const homes: string[] = [];

function tempHome(): string {
  const home = fs.mkdtempSync(path.join(tmpdir(), 'consuelo-release-promotion-lock-'));
  homes.push(home);
  return home;
}

afterEach(() => {
  while (homes.length > 0) {
    const home = homes.pop();
    if (home) removeSafeTempDir(home, 'consuelo-release-promotion-lock-');
  }
});

describe('release promotion dispatch lock', () => {
  it('uses one canonical node-runs lock regardless of the repository worktree', () => {
    const home = tempHome();
    expect(releasePromotionDispatchLockPath(home)).toBe(
      path.join(home, 'node', 'runs', 'release-promotion-dispatch.consuelo.lock'),
    );
  });

  it('serializes concurrent dispatch critical sections on the same Consuelo node', async () => {
    const home = tempHome();
    let active = 0;
    let maxActive = 0;
    const order: string[] = [];

    const criticalSection = async (name: string, holdMs: number) => withReleasePromotionDispatchLock({
      home,
      operationId: `release:${name}`,
      waitTimeoutMs: 2_000,
    }, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      order.push(`${name}:enter`);
      await new Promise((resolve) => setTimeout(resolve, holdMs));
      order.push(`${name}:exit`);
      active -= 1;
    });

    const first = criticalSection('first', 60);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = criticalSection('second', 1);
    await Promise.all([first, second]);

    expect(maxActive).toBe(1);
    expect(order).toEqual(['first:enter', 'first:exit', 'second:enter', 'second:exit']);
    expect(fs.existsSync(releasePromotionDispatchLockPath(home))).toBe(false);
  });
});
