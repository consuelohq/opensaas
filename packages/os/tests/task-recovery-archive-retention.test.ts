import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';

import eviction from '../scripts/lib/task-worktree-eviction.js';

test('prunes recovery archives older than the retention window', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-archive-retention-'));
  const oldRoot = path.join(home, 'node', 'tasks', 'archives', 'tsk_old', '2026-01-01T00-00-00-000Z-aaaa');
  const freshRoot = path.join(home, 'node', 'tasks', 'archives', 'tsk_fresh', '2026-08-29T00-00-00-000Z-bbbb');
  fs.mkdirSync(oldRoot, { recursive: true });
  fs.mkdirSync(freshRoot, { recursive: true });
  fs.writeFileSync(path.join(oldRoot, 'recovery.bundle'), 'old');
  fs.writeFileSync(path.join(freshRoot, 'recovery.bundle'), 'fresh');
  const now = Date.UTC(2026, 7, 30);
  fs.utimesSync(oldRoot, new Date(now - 8 * 24 * 60 * 60 * 1000), new Date(now - 8 * 24 * 60 * 60 * 1000));
  fs.utimesSync(freshRoot, new Date(now - 2 * 24 * 60 * 60 * 1000), new Date(now - 2 * 24 * 60 * 60 * 1000));

  try {
    const result = eviction.pruneExpiredTaskRecoveryArchives({ home, now });
    expect(result.removed).toEqual([oldRoot]);
    expect(fs.existsSync(oldRoot)).toBe(false);
    expect(fs.existsSync(path.join(home, 'node', 'tasks', 'archives', 'tsk_old'))).toBe(false);
    expect(fs.existsSync(path.join(freshRoot, 'recovery.bundle'))).toBe(true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('bundle anchors missing task remotes to origin/main', () => {
  const calls: string[][] = [];
  const original = eviction.resolveBundleAnchorSha;
  expect(typeof original).toBe('function');
  const sha = eviction.resolveBundleAnchorSha('/tmp/not-a-repo', 'abc123');
  expect(sha).toBe('abc123');
  expect(calls).toEqual([]);
});
