import { describe, expect, it } from 'vitest';

import {
  RELEASE_PROMOTION_LOCK_BRANCH,
  RELEASE_PROMOTION_LOCK_PATH,
  withReleasePromotionDispatchLock,
  type ReleasePromotionDispatchLockAdapter,
  type ReleasePromotionLockMarker,
} from '../scripts/lib/release-promotion-dispatch-lock';

type SharedRemote = {
  activePromotion: boolean;
  lock: ReleasePromotionLockMarker | null;
  sequence: number;
};

function createAdapter(shared: SharedRemote): ReleasePromotionDispatchLockAdapter {
  return {
    now: () => Date.now(),
    sleep: async (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    createMarker: async ({ operationId, acquiredAtMs }) => ({
      ownerId: `marker-${++shared.sequence}`,
      operationId,
      acquiredAtMs,
    }),
    tryCreateLock: async (marker) => {
      if (shared.lock) return false;
      shared.lock = marker;
      return true;
    },
    readLock: async () => shared.lock,
    deleteLockIfOwned: async (ownerId) => {
      if (shared.lock?.ownerId !== ownerId) return false;
      shared.lock = null;
      return true;
    },
    hasActivePromotion: async () => shared.activePromotion,
  };
}

describe('release promotion dispatch lock', () => {
  it('uses one repository-wide coordination branch and lock path', () => {
    expect(RELEASE_PROMOTION_LOCK_BRANCH).toBe('consuelo-release-locks');
    expect(RELEASE_PROMOTION_LOCK_PATH).toBe('.consuelo-locks/os-runtime-promotion.json');
  });

  it('serializes concurrent critical sections across independent operator adapters', async () => {
    const shared: SharedRemote = { activePromotion: false, lock: null, sequence: 0 };
    const firstOperator = createAdapter(shared);
    const secondOperator = createAdapter(shared);
    let active = 0;
    let maxActive = 0;
    const order: string[] = [];

    const criticalSection = async (
      name: string,
      adapter: ReleasePromotionDispatchLockAdapter,
      holdMs: number,
    ) => withReleasePromotionDispatchLock({
      operationId: `release:${name}`,
      waitTimeoutMs: 2_000,
      pollIntervalMs: 5,
    }, adapter, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      order.push(`${name}:enter`);
      await new Promise((resolve) => setTimeout(resolve, holdMs));
      order.push(`${name}:exit`);
      active -= 1;
    });

    const first = criticalSection('first', firstOperator, 60);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = criticalSection('second', secondOperator, 1);
    await Promise.all([first, second]);

    expect(maxActive).toBe(1);
    expect(order).toEqual(['first:enter', 'first:exit', 'second:enter', 'second:exit']);
    expect(shared.lock).toBeNull();
  });

  it('recovers a stale repository lock only when no protected promotion is active', async () => {
    const shared: SharedRemote = {
      activePromotion: false,
      lock: {
        ownerId: 'stale-owner',
        operationId: 'release:stale',
        acquiredAtMs: Date.now() - 60_000,
      },
      sequence: 0,
    };
    const adapter = createAdapter(shared);

    const value = await withReleasePromotionDispatchLock({
      operationId: 'release:recovery',
      waitTimeoutMs: 500,
      staleAfterMs: 1_000,
      pollIntervalMs: 5,
    }, adapter, async () => 'acquired');

    expect(value).toBe('acquired');
    expect(shared.lock).toBeNull();
  });

  it('does not steal a stale-looking repository lock while a protected promotion is active', async () => {
    const staleLock = {
      ownerId: 'active-owner',
      operationId: 'release:active',
      acquiredAtMs: Date.now() - 60_000,
    };
    const shared: SharedRemote = {
      activePromotion: true,
      lock: staleLock,
      sequence: 0,
    };
    const adapter = createAdapter(shared);

    await expect(withReleasePromotionDispatchLock({
      operationId: 'release:blocked',
      waitTimeoutMs: 30,
      staleAfterMs: 1,
      pollIntervalMs: 5,
    }, adapter, async () => 'unexpected')).rejects.toThrow(/timed out/i);

    expect(shared.lock).toEqual(staleLock);
  });

  it('never deletes a newer owner when compare-and-swap cleanup loses ownership', async () => {
    const shared: SharedRemote = { activePromotion: false, lock: null, sequence: 0 };
    const adapter = createAdapter(shared);
    const newerOwner = {
      ownerId: 'newer-owner',
      operationId: 'release:newer',
      acquiredAtMs: Date.now(),
    };

    await expect(withReleasePromotionDispatchLock({
      operationId: 'release:old-owner',
      waitTimeoutMs: 500,
      pollIntervalMs: 5,
    }, adapter, async () => {
      shared.lock = newerOwner;
      return 'done';
    })).rejects.toThrow(/ownership/i);

    expect(shared.lock).toEqual(newerOwner);
  });
});
