import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

import eviction from '../scripts/lib/task-worktree-eviction.js';
import gc from '../scripts/lib/task-worktree-gc.js';
import registry from '../scripts/lib/task-registry.js';

function git(repoRoot: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

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

test('bundle anchors missing task remotes to origin/main and returns null without a fallback', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-anchor-fallback-'));
  const emptyRepoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-anchor-empty-'));
  try {
    git(repoRoot, ['init']);
    git(repoRoot, ['config', 'user.name', 'Consuelo Test']);
    git(repoRoot, ['config', 'user.email', 'test@consuelo.local']);
    fs.writeFileSync(path.join(repoRoot, 'README.md'), 'anchor\n');
    git(repoRoot, ['add', 'README.md']);
    git(repoRoot, ['commit', '-m', 'anchor']);
    const expected = git(repoRoot, ['rev-parse', 'HEAD']);
    git(repoRoot, ['update-ref', 'refs/remotes/origin/main', expected]);
    git(emptyRepoRoot, ['init']);

    expect(eviction.resolveBundleAnchorSha(repoRoot, null)).toBe(expected);
    expect(eviction.resolveBundleAnchorSha(emptyRepoRoot, null)).toBeNull();
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
    fs.rmSync(emptyRepoRoot, { recursive: true, force: true });
  }
});

test('preserves expired recovery archives referenced by durable task metadata', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-archive-reference-'));
  const now = Date.UTC(2026, 7, 30);
  const protectedRoot = path.join(
    home,
    'node',
    'tasks',
    'archives',
    'tsk_protected',
    '2026-01-01T00-00-00-000Z-aaaa',
  );
  const orphanRoot = path.join(
    home,
    'node',
    'tasks',
    'archives',
    'tsk_orphan',
    '2026-01-01T00-00-00-000Z-bbbb',
  );
  fs.mkdirSync(protectedRoot, { recursive: true });
  fs.mkdirSync(orphanRoot, { recursive: true });
  const manifestPath = path.join(protectedRoot, 'manifest.json');
  const bundlePath = path.join(protectedRoot, 'recovery.bundle');
  fs.writeFileSync(manifestPath, '{}');
  fs.writeFileSync(bundlePath, 'protected');
  fs.writeFileSync(path.join(orphanRoot, 'recovery.bundle'), 'orphan');
  const old = new Date(now - 8 * 24 * 60 * 60 * 1000);
  fs.utimesSync(protectedRoot, old, old);
  fs.utimesSync(orphanRoot, old, old);
  registry.writeDurableTaskSessionMetadata({
    taskSession: 'tsk_protected',
    taskBranch: 'task/os/protected',
    worktreePath: path.join(home, 'missing-worktree'),
    status: 'evicted',
    recovery: { manifestPath, bundlePath },
  }, { home, now });

  try {
    const result = gc.runTaskWorktreeGc({ home, now });
    expect(result.prunedArchives).toEqual([orphanRoot]);
    expect(fs.existsSync(protectedRoot)).toBe(true);
    expect(fs.existsSync(orphanRoot)).toBe(false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('keeps archive pruning failures inside the GC result and callback', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-archive-prune-error-'));
  const observed: Array<{ message: string; scope?: string }> = [];
  try {
    const result = gc.runTaskWorktreeGc({
      home,
      prune() {
        throw new Error('archive read failed');
      },
      onError(error: Error, context: { scope?: string }) {
        observed.push({ message: error.message, scope: context.scope });
      },
    });
    expect(result.errors).toEqual([
      {
        taskSession: null,
        taskBranch: null,
        scope: 'archive-pruning',
        message: 'archive read failed',
      },
    ]);
    expect(observed).toEqual([
      { message: 'archive read failed', scope: 'archive-pruning' },
    ]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
