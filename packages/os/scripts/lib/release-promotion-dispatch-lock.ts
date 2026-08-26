export const RELEASE_PROMOTION_LOCK_BRANCH = 'consuelo-release-locks' as const;
export const RELEASE_PROMOTION_LOCK_PATH = '.consuelo-locks/os-runtime-promotion.json' as const;

export const DEFAULT_RELEASE_PROMOTION_LOCK_STALE_MS = 2 * 60_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;

export type ReleasePromotionLockMarker = {
  ownerId: string;
  operationId: string;
  acquiredAtMs: number;
};

export type ReleasePromotionDispatchLockAdapter = {
  now(): number;
  sleep(ms: number): Promise<void>;
  createMarker(input: {
    operationId: string;
    acquiredAtMs: number;
  }): Promise<ReleasePromotionLockMarker>;
  tryCreateLock(marker: ReleasePromotionLockMarker): Promise<boolean>;
  readLock(): Promise<ReleasePromotionLockMarker | null>;
  deleteLockIfOwned(ownerId: string): Promise<boolean>;
  hasActiveReleaseStateRun(): Promise<boolean>;
};

export async function withReleasePromotionDispatchLock<T>(
  input: {
    operationId: string;
    waitTimeoutMs?: number;
    staleAfterMs?: number;
    pollIntervalMs?: number;
  },
  adapter: ReleasePromotionDispatchLockAdapter,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    const waitTimeoutMs = input.waitTimeoutMs ?? 25 * 60_000;
    const staleAfterMs = input.staleAfterMs ?? DEFAULT_RELEASE_PROMOTION_LOCK_STALE_MS;
    const pollIntervalMs = input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const deadline = adapter.now() + waitTimeoutMs;

    while (adapter.now() < deadline) {
      const current = await adapter.readLock();
      if (current) {
        const ageMs = Math.max(0, adapter.now() - current.acquiredAtMs);
        if (ageMs >= staleAfterMs && !(await adapter.hasActiveReleaseStateRun())) {
          await adapter.deleteLockIfOwned(current.ownerId);
          continue;
        }
        await adapter.sleep(Math.min(pollIntervalMs, Math.max(1, deadline - adapter.now())));
        continue;
      }

      const marker = await adapter.createMarker({
        operationId: input.operationId,
        acquiredAtMs: adapter.now(),
      });
      if (!(await adapter.tryCreateLock(marker))) {
        await adapter.sleep(Math.min(pollIntervalMs, Math.max(1, deadline - adapter.now())));
        continue;
      }

      let succeeded = false;
      try {
        const result = await operation();
        succeeded = true;
        return result;
      } finally {
        const released = await adapter.deleteLockIfOwned(marker.ownerId);
        if (succeeded && !released) {
          throw new Error('release promotion dispatch lock ownership changed before cleanup');
        }
      }
    }

    throw new Error('timed out waiting for repository-wide release promotion dispatch lock');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`release promotion dispatch lock failed: ${message}`);
  }
}
