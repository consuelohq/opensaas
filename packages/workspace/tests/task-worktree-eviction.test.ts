import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';

import taskEviction from '../scripts/lib/task-worktree-eviction.js';
import taskGc from '../scripts/lib/task-worktree-gc.js';
import taskRegistry from '../scripts/lib/task-registry.js';
import taskSession from '../scripts/lib/task-session.js';

const {
  createVerifiedTaskRecoveryArchive,
  evictDurableTaskWorktree,
  getTaskInactivityAgeMs,
  removeDurableTaskRecoveryState,
  restoreEvictedTaskWorktree,
} = taskEviction;
const { runTaskWorktreeGc } = taskGc;

const roots: string[] = [];

function git(cwd: string, args: string[], input?: string): string {
  return childProcess.execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function createTaskFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'task-eviction-'));
  roots.push(root);
  const home = path.join(root, 'home');
  const remote = path.join(root, 'remote.git');
  const repoRoot = path.join(root, 'repo');
  const worktreePath = path.join(root, 'task-worktree');
  const taskBranch = 'task/workspace-agent/eviction-fixture';

  fs.mkdirSync(home, { recursive: true });
  git(root, ['init', '--bare', remote]);
  git(root, ['init', '-b', 'main', repoRoot]);
  git(repoRoot, ['config', 'user.email', 'tests@consuelo.local']);
  git(repoRoot, ['config', 'user.name', 'Consuelo Tests']);
  fs.writeFileSync(path.join(repoRoot, 'README.md'), 'base\n');
  git(repoRoot, ['add', 'README.md']);
  git(repoRoot, ['commit', '-m', 'base']);
  git(repoRoot, ['remote', 'add', 'origin', remote]);
  git(repoRoot, ['push', '-u', 'origin', 'main']);

  git(repoRoot, ['checkout', '-b', taskBranch]);
  fs.writeFileSync(path.join(repoRoot, 'task.txt'), 'task base\n');
  git(repoRoot, ['add', 'task.txt']);
  git(repoRoot, ['commit', '-m', 'task bootstrap']);
  git(repoRoot, ['push', '-u', 'origin', taskBranch]);
  git(repoRoot, ['checkout', 'main']);
  git(repoRoot, ['worktree', 'add', worktreePath, taskBranch]);

  const handle = taskSession.getTaskSessionHandle(taskBranch);
  taskRegistry.writeDurableTaskSessionMetadata({
    area: 'workspace-agent',
    stream: 'stream/workspace-agent',
    taskBranch,
    taskSession: handle,
    tmuxSession: 'fixture-tmux',
    worktreePath,
    repoRoot,
    createdAt: '2026-08-10T00:00:00.000Z',
    lastActiveAt: '2026-08-10T01:00:00.000Z',
    status: 'active',
  }, { home });

  return { root, home, remote, repoRoot, worktreePath, taskBranch, taskSession: handle };
}

afterEach(() => {
  delete process.env.CONSUELO_HOME;
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('durable activity lease updates lastActiveAt without rewriting task creation time', () => {
  const fixture = createTaskFixture();
  const touched = taskRegistry.touchDurableTaskSessionMetadata(fixture.taskSession, {
    home: fixture.home,
    now: () => Date.parse('2026-08-12T12:00:00.000Z'),
  });

  expect(touched.createdAt).toBe('2026-08-10T00:00:00.000Z');
  expect(touched.lastActiveAt).toBe('2026-08-12T12:00:00.000Z');
  expect(getTaskInactivityAgeMs(touched, Date.parse('2026-08-13T12:00:00.000Z'))).toBe(86_400_000);
});

test('recovery archive captures dirty, untracked, and locally-ahead state without changing the real branch or index', () => {
  const fixture = createTaskFixture();
  fs.writeFileSync(path.join(fixture.worktreePath, 'local-commit.txt'), 'local commit\n');
  git(fixture.worktreePath, ['add', 'local-commit.txt']);
  git(fixture.worktreePath, ['commit', '-m', 'local only']);

  fs.writeFileSync(path.join(fixture.worktreePath, 'task.txt'), 'staged value\n');
  git(fixture.worktreePath, ['add', 'task.txt']);
  fs.writeFileSync(path.join(fixture.worktreePath, 'task.txt'), 'latest value\n');
  fs.writeFileSync(path.join(fixture.worktreePath, 'untracked.txt'), 'untracked value\n');

  const headBefore = git(fixture.worktreePath, ['rev-parse', 'HEAD']);
  const cachedBefore = git(fixture.worktreePath, ['diff', '--cached', '--binary']);
  const statusBefore = git(fixture.worktreePath, ['status', '--porcelain=v1', '-uall']);

  const archive = createVerifiedTaskRecoveryArchive({
    ...fixture,
    now: () => Date.parse('2026-08-13T12:00:00.000Z'),
  });

  expect(fs.existsSync(archive.bundlePath)).toBe(true);
  expect(fs.existsSync(archive.manifestPath)).toBe(true);
  expect(archive.headSha).toBe(headBefore);
  expect(archive.anchorSha).toBe(git(fixture.repoRoot, ['rev-parse', `refs/remotes/origin/${fixture.taskBranch}`]));
  expect(archive.localAheadCount).toBeGreaterThan(0);
  expect(git(fixture.repoRoot, ['bundle', 'verify', archive.bundlePath])).toContain(archive.exportedRef);
  expect(git(fixture.worktreePath, ['rev-parse', 'HEAD'])).toBe(headBefore);
  expect(git(fixture.worktreePath, ['diff', '--cached', '--binary'])).toBe(cachedBefore);
  expect(git(fixture.worktreePath, ['status', '--porcelain=v1', '-uall'])).toBe(statusBefore);
});

test('dirty task eviction archives unique state, removes the worktree, and restores the exact file contents', () => {
  const fixture = createTaskFixture();
  fs.writeFileSync(path.join(fixture.worktreePath, 'task.txt'), 'dirty restored value\n');
  fs.writeFileSync(path.join(fixture.worktreePath, 'untracked.txt'), 'restore me\n');

  const evicted = evictDurableTaskWorktree({
    taskSession: fixture.taskSession,
    home: fixture.home,
    terminateTmux: () => ({ status: 'not-found', terminated: false }),
    now: () => Date.parse('2026-08-13T12:00:00.000Z'),
  });

  expect(fs.existsSync(fixture.worktreePath)).toBe(false);
  expect(evicted.status).toBe('evicted');
  expect(evicted.recovery?.bundlePath && fs.existsSync(evicted.recovery.bundlePath)).toBe(true);
  expect(taskRegistry.readDurableTaskSessionMetadata(fixture.taskSession, { home: fixture.home })).toMatchObject({
    status: 'evicted',
    worktreePath: fixture.worktreePath,
  });

  const restored = restoreEvictedTaskWorktree(fixture.taskSession, { home: fixture.home });
  expect(restored.status).toBe('active');
  expect(fs.readFileSync(path.join(fixture.worktreePath, 'task.txt'), 'utf8')).toBe('dirty restored value\n');
  expect(fs.readFileSync(path.join(fixture.worktreePath, 'untracked.txt'), 'utf8')).toBe('restore me\n');
  expect(git(fixture.worktreePath, ['branch', '--show-current'])).toBe(fixture.taskBranch);
});

test('clean remote-backed task eviction needs no recovery bundle and keeps the branch recoverable', () => {
  const fixture = createTaskFixture();
  const evicted = evictDurableTaskWorktree({
    taskSession: fixture.taskSession,
    home: fixture.home,
    terminateTmux: () => ({ status: 'not-found', terminated: false }),
    now: () => Date.parse('2026-08-13T12:00:00.000Z'),
  });

  expect(evicted.recovery).toBeNull();
  expect(fs.existsSync(fixture.worktreePath)).toBe(false);
  expect(git(fixture.repoRoot, ['show-ref', '--verify', `refs/heads/${fixture.taskBranch}`])).toContain(fixture.taskBranch);

  const restored = restoreEvictedTaskWorktree(fixture.taskSession, { home: fixture.home });
  expect(restored.status).toBe('active');
  expect(fs.existsSync(path.join(fixture.worktreePath, 'task.txt'))).toBe(true);
});

test('archive failure is fail-closed and never removes the worktree', () => {
  const fixture = createTaskFixture();
  fs.writeFileSync(path.join(fixture.worktreePath, 'task.txt'), 'dirty\n');

  expect(() => evictDurableTaskWorktree({
    taskSession: fixture.taskSession,
    home: fixture.home,
    createRecoveryArchive: () => { throw new Error('archive failed'); },
    terminateTmux: () => ({ status: 'not-found', terminated: false }),
  })).toThrow(/archive failed/);

  expect(fs.existsSync(fixture.worktreePath)).toBe(true);
  expect(taskRegistry.readDurableTaskSessionMetadata(fixture.taskSession, { home: fixture.home })?.status).toBe('active');
});

test('tampered recovery bundle is rejected before restore and the archive remains available', () => {
  const fixture = createTaskFixture();
  fs.writeFileSync(path.join(fixture.worktreePath, 'untracked.txt'), 'recoverable\n');
  const evicted = evictDurableTaskWorktree({
    taskSession: fixture.taskSession,
    home: fixture.home,
    terminateTmux: () => ({ status: 'not-found', terminated: false }),
  });
  const bundlePath = evicted.recovery?.bundlePath;
  expect(bundlePath).toBeTruthy();
  fs.appendFileSync(bundlePath!, 'tamper');

  expect(() => restoreEvictedTaskWorktree(fixture.taskSession, { home: fixture.home }))
    .toThrow(/recovery bundle digest/i);
  expect(fs.existsSync(bundlePath!)).toBe(true);
  expect(fs.existsSync(fixture.worktreePath)).toBe(false);
});

test('an evicting task with its worktree still present rejects recovery instead of racing eviction', () => {
  const fixture = createTaskFixture();
  taskRegistry.writeDurableTaskSessionMetadata({
    ...taskRegistry.readDurableTaskSessionMetadata(fixture.taskSession, { home: fixture.home }),
    status: 'evicting',
    repoRoot: fixture.repoRoot,
  }, { home: fixture.home });

  expect(() => restoreEvictedTaskWorktree(fixture.taskSession, { home: fixture.home }))
    .toThrow(/eviction is in progress/i);
  expect(fs.existsSync(fixture.worktreePath)).toBe(true);
});

test('final recovery cleanup deletes only task-owned archive and registry state', () => {
  const fixture = createTaskFixture();
  fs.writeFileSync(path.join(fixture.worktreePath, 'untracked.txt'), 'recoverable\n');
  const evicted = evictDurableTaskWorktree({
    taskSession: fixture.taskSession,
    home: fixture.home,
    terminateTmux: () => ({ status: 'not-found', terminated: false }),
  });
  const bundlePath = evicted.recovery?.bundlePath;
  expect(bundlePath && fs.existsSync(bundlePath)).toBe(true);

  removeDurableTaskRecoveryState(fixture.taskSession, { home: fixture.home });
  expect(taskRegistry.readDurableTaskSessionMetadata(fixture.taskSession, { home: fixture.home })).toBeNull();
  expect(bundlePath && fs.existsSync(bundlePath)).toBe(false);
});

test('inactivity GC evicts only active worktrees whose last activity exceeds the lease', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'task-gc-'));
  roots.push(root);
  const home = path.join(root, 'home');
  const now = Date.parse('2026-08-15T12:00:00.000Z');
  const records = [
    { id: 'tsk_old1', branch: 'task/workspace-agent/old', ageHours: 25, status: 'active', exists: true },
    { id: 'tsk_new1', branch: 'task/workspace-agent/recent', ageHours: 2, status: 'active', exists: true },
    { id: 'tsk_evct', branch: 'task/workspace-agent/evicted', ageHours: 48, status: 'evicted', exists: false },
    { id: 'tsk_gone', branch: 'task/workspace-agent/missing', ageHours: 48, status: 'active', exists: false },
  ];
  for (const record of records) {
    const worktreePath = path.join(root, record.id);
    if (record.exists) fs.mkdirSync(worktreePath, { recursive: true });
    taskRegistry.writeDurableTaskSessionMetadata({
      taskSession: record.id,
      taskBranch: record.branch,
      worktreePath,
      status: record.status,
      createdAt: new Date(now - 72 * 3_600_000).toISOString(),
      lastActiveAt: new Date(now - record.ageHours * 3_600_000).toISOString(),
    }, { home, now: () => now });
  }

  const evicted: string[] = [];
  const result = runTaskWorktreeGc({
    home,
    idleMs: 24 * 3_600_000,
    now: () => now,
    evict: ({ taskSession: handle }: { taskSession: string }) => {
      evicted.push(handle);
      return { taskSession: handle, status: 'evicted' };
    },
  });

  expect(evicted).toEqual(['tsk_old1']);
  expect(result.evicted.map((entry: { taskSession: string }) => entry.taskSession)).toEqual(['tsk_old1']);
  expect(result.skipped.some((entry: { taskSession: string; reason: string }) => entry.taskSession === 'tsk_new1' && entry.reason === 'recent')).toBe(true);
  expect(result.skipped.some((entry: { taskSession: string; reason: string }) => entry.taskSession === 'tsk_evct' && entry.reason === 'not-active')).toBe(true);
  expect(result.skipped.some((entry: { taskSession: string; reason: string }) => entry.taskSession === 'tsk_gone' && entry.reason === 'worktree-missing')).toBe(true);
});
