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
});
