import { setTimeout as delay } from 'node:timers/promises';

export const RELEASE_PROMOTION_LOCK_BRANCH = 'consuelo-release-locks' as const;
export const RELEASE_PROMOTION_LOCK_PATH = '.consuelo-locks/os-runtime-promotion.json' as const;

export const DEFAULT_RELEASE_PROMOTION_LOCK_STALE_MS = 2 * 60_000;
export const DEFAULT_RELEASE_PROMOTION_LOCK_HEARTBEAT_MS = 30_000;
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
  renewLockIfOwned(ownerId: string, renewedAtMs: number): Promise<boolean>;
  deleteLockIfOwned(ownerId: string): Promise<boolean>;
  hasActiveReleaseStateRun(): Promise<boolean>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function withReleasePromotionDispatchLock<T>(
  input: {
    operationId: string;
    waitTimeoutMs?: number;
    staleAfterMs?: number;
    heartbeatIntervalMs?: number;
    pollIntervalMs?: number;
  },
  adapter: ReleasePromotionDispatchLockAdapter,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    const waitTimeoutMs = input.waitTimeoutMs ?? 25 * 60_000;
    const staleAfterMs = input.staleAfterMs ?? DEFAULT_RELEASE_PROMOTION_LOCK_STALE_MS;
    const heartbeatIntervalMs = input.heartbeatIntervalMs ?? Math.min(
      DEFAULT_RELEASE_PROMOTION_LOCK_HEARTBEAT_MS,
      Math.max(1, Math.floor(staleAfterMs / 4)),
    );
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

      const heartbeatController = new AbortController();
      let heartbeatError: Error | null = null;
      const heartbeat = (async () => {
        try {
          while (!heartbeatController.signal.aborted) {
            await delay(heartbeatIntervalMs, undefined, {
              signal: heartbeatController.signal,
            });
            if (heartbeatController.signal.aborted) return;
            const renewed = await adapter.renewLockIfOwned(marker.ownerId, adapter.now());
            if (!renewed) {
              heartbeatError = new Error(
                'release promotion dispatch lock ownership changed during heartbeat',
              );
              return;
            }
          }
        } catch (error: unknown) {
          if (heartbeatController.signal.aborted) return;
          heartbeatError = new Error(
            `release promotion dispatch lock heartbeat failed: ${errorMessage(error)}`,
          );
        }
      })();

      let succeeded = false;
      let operationResult: T | undefined;
      let operationError: unknown;
      try {
        operationResult = await operation();
        succeeded = true;
      } catch (error: unknown) {
        operationError = error;
      } finally {
        heartbeatController.abort();
        await heartbeat;
        const released = await adapter.deleteLockIfOwned(marker.ownerId);
        if (succeeded && !released) {
          throw new Error('release promotion dispatch lock ownership changed before cleanup');
        }
      }

      if (operationError) throw operationError;
      if (heartbeatError) throw heartbeatError;
      return operationResult as T;
    }

    throw new Error('timed out waiting for repository-wide release promotion dispatch lock');
  } catch (error: unknown) {
    throw new Error(`release promotion dispatch lock failed: ${errorMessage(error)}`);
  }
}
