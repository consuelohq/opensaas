import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DiffsLocalCache } from '../scripts/server/services/diffs-local-cache';

const roots: string[] = [];

function cacheRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'consuelo-diffs-cache-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

describe('DiffsLocalCache', () => {
  it('persists fresh snapshots across cache instances with the same ETag', async () => {
    let now = 1_000;
    let loads = 0;
    const root = cacheRoot();
    const firstCache = new DiffsLocalCache({ root, now: () => now, maxEntries: 8 });

    const first = await firstCache.getFresh('workspace:repo:pulls', 30_000, async () => {
      loads += 1;
      return { pulls: [{ number: 2491, updatedAt: '2026-09-21T02:24:28Z' }] };
    });

    const coldCache = new DiffsLocalCache({ root, now: () => now, maxEntries: 8 });
    const persisted = coldCache.peek<{ pulls: Array<{ number: number }> }>('workspace:repo:pulls');
    const second = await coldCache.getFresh('workspace:repo:pulls', 30_000, async () => {
      loads += 1;
      return { pulls: [{ number: 9999 }] };
    });

    expect(first.source).toBe('fresh');
    expect(persisted?.source).toBe('disk');
    expect(persisted?.etag).toBe(first.etag);
    expect(persisted?.value.pulls[0]?.number).toBe(2491);
    expect(second.etag).toBe(first.etag);
    expect(loads).toBe(1);
  });

  it('single-flights an expired refresh and replaces the persisted snapshot', async () => {
    let now = 1_000;
    let loads = 0;
    const root = cacheRoot();
    const cache = new DiffsLocalCache({ root, now: () => now, maxEntries: 8 });

    const initial = await cache.getFresh('workspace:repo:pull:1991', 500, async () => {
      loads += 1;
      return { pull: { number: 1991, headSha: 'old' } };
    });
    now = 2_000;

    const loader = async () => {
      loads += 1;
      await Promise.resolve();
      return { pull: { number: 1991, headSha: 'new' } };
    };
    const [left, right] = await Promise.all([
      cache.getFresh('workspace:repo:pull:1991', 500, loader),
      cache.getFresh('workspace:repo:pull:1991', 500, loader),
    ]);

    expect(initial.value.pull.headSha).toBe('old');
    expect(left.value.pull.headSha).toBe('new');
    expect(right.value.pull.headSha).toBe('new');
    expect(left.etag).toBe(right.etag);
    expect(left.etag).not.toBe(initial.etag);
    expect(loads).toBe(2);
  });

  it('serves an expired persisted snapshot immediately while coalescing a background refresh', async () => {
    let now = 1_000;
    let refreshCount = 0;
    let releaseRefresh: ((value: { revision: number }) => void) | undefined;
    const root = cacheRoot();
    const writer = new DiffsLocalCache({ root, now: () => now, maxEntries: 8 });
    await writer.getFresh('repo:pulls', 100, async () => ({ revision: 1 }));
    now = 1_200;
    const cache = new DiffsLocalCache({ root, now: () => now, maxEntries: 8 });
    const loader = () => {
      refreshCount += 1;
      return new Promise<{ revision: number }>((resolve) => { releaseRefresh = resolve; });
    };

    const first = await cache.getStaleWhileRevalidate('repo:pulls', 100, 86_400_000, loader);
    const second = await cache.getStaleWhileRevalidate('repo:pulls', 100, 86_400_000, loader);
    expect(first.value.revision).toBe(1);
    expect(first.source).toBe('stale');
    expect(second.etag).toBe(first.etag);
    expect(refreshCount).toBe(1);

    expect(releaseRefresh).toBeDefined();
    releaseRefresh?.({ revision: 2 });
    const updated = await cache.getFresh('repo:pulls', 100, loader);
    expect(updated.value.revision).toBe(2);
    expect(updated.etag).not.toBe(first.etag);
    expect(refreshCount).toBe(1);
  });

  it('keeps stale data on background errors without retrying on every request', async () => {
    let now = 1_000;
    const cache = new DiffsLocalCache({ root: cacheRoot(), now: () => now, maxEntries: 8 });
    await cache.getFresh('repo:pull:42', 100, async () => ({ revision: 1 }));
    now = 2_000;
    let calls = 0;
    const failing = async () => {
      calls += 1;
      throw new Error('GitHub unavailable');
    };

    const first = await cache.getStaleWhileRevalidate('repo:pull:42', 100, 86_400_000, failing);
    await Promise.resolve();
    await Promise.resolve();
    const second = await cache.getStaleWhileRevalidate('repo:pull:42', 100, 86_400_000, failing);
    expect(first.source).toBe('stale');
    expect(second.value.revision).toBe(1);
    expect(calls).toBe(1);

    now += 61_000;
    await cache.getStaleWhileRevalidate('repo:pull:42', 100, 86_400_000, failing);
    expect(calls).toBe(2);
  });
});
