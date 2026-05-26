import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  beginReviewRun,
  finishReviewRun,
  makeReviewRunIdentity,
  pathsForIdentity,
} = require('../scripts/lib/review-run-state.js');

function git(repoRoot, args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function createRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-review-run-state-'));
  git(repoRoot, ['init', '-b', 'main']);
  git(repoRoot, ['config', 'user.email', 'test@example.com']);
  git(repoRoot, ['config', 'user.name', 'Workspace Test']);
  fs.writeFileSync(path.join(repoRoot, 'file.txt'), 'hello\n');
  git(repoRoot, ['add', 'file.txt']);
  git(repoRoot, ['commit', '-m', 'init']);
  return repoRoot;
}

function identity(repoRoot, overrides = {}) {
  return makeReviewRunIdentity({
    repoRoot,
    branch: 'task/workspace-agents/example',
    base: 'origin/stream/workspace-agents',
    verificationState: {
      headSha: 'abc123',
      changeHash: 'def456',
    },
    args: {
      summaryJson: true,
      quiet: true,
      noTests: true,
      ...overrides.args,
    },
    ...overrides,
  });
}

test('completed structured review result is replayed for the same identity', () => {
  const repoRoot = createRepo();
  const reviewIdentity = identity(repoRoot);

  const run = beginReviewRun(repoRoot, reviewIdentity, { waitMs: 50 });
  expect(run.mode).toBe('run');

  finishReviewRun(run, {
    stdout: '{"schema":"review.summary.v1"}\n',
    stderr: 'review stderr\n',
    exitCode: 0,
  });

  const replay = beginReviewRun(repoRoot, reviewIdentity, { waitMs: 50 });
  expect(replay.mode).toBe('replay');
  expect(replay.result.stdout).toBe('{"schema":"review.summary.v1"}\n');
  expect(replay.result.stderr).toBe('review stderr\n');
  expect(replay.result.exitCode).toBe(0);
});

test('stale running lock is orphaned before acquiring a new run', () => {
  const repoRoot = createRepo();
  const reviewIdentity = identity(repoRoot);
  const paths = pathsForIdentity(repoRoot, reviewIdentity);

  fs.mkdirSync(paths.dir, { recursive: true });
  fs.writeFileSync(paths.lockPath, 'stale\n');
  fs.writeFileSync(paths.recordPath, JSON.stringify({
    status: 'running',
    pid: 99999999,
    startedAt: new Date(0).toISOString(),
  }, null, 2));

  const run = beginReviewRun(repoRoot, reviewIdentity, { waitMs: 50 });
  expect(run.mode).toBe('run');
  finishReviewRun(run, { stdout: '{}\n', stderr: '', exitCode: 0 });
});

test('review identity changes when output contract changes', () => {
  const repoRoot = createRepo();
  const summaryIdentity = identity(repoRoot, { args: { summaryJson: true, json: false } });
  const fullIdentity = identity(repoRoot, { args: { summaryJson: false, json: true } });

  expect(summaryIdentity.key).not.toBe(fullIdentity.key);
});


test('review identity changes when the base ref moves', () => {
  const repoRoot = createRepo();
  git(repoRoot, ['branch', 'base']);
  const before = identity(repoRoot, { base: 'base' });

  fs.writeFileSync(path.join(repoRoot, 'file.txt'), 'changed\n');
  git(repoRoot, ['add', 'file.txt']);
  git(repoRoot, ['commit', '-m', 'change']);
  git(repoRoot, ['update-ref', 'refs/heads/base', 'HEAD']);

  const after = identity(repoRoot, { base: 'base' });
  expect(before.baseSha).not.toBe(after.baseSha);
  expect(before.key).not.toBe(after.key);
});

test('live lock without record is not removed while waiting', () => {
  const repoRoot = createRepo();
  const reviewIdentity = identity(repoRoot);
  const paths = pathsForIdentity(repoRoot, reviewIdentity);

  fs.mkdirSync(paths.dir, { recursive: true });
  fs.writeFileSync(paths.lockPath, 'creating\n');

  expect(() => beginReviewRun(repoRoot, reviewIdentity, { waitMs: 10 })).toThrow(/still running/);
  expect(fs.existsSync(paths.lockPath)).toBe(true);
});

test('stale lock without record is removed before acquiring a new run', () => {
  const repoRoot = createRepo();
  const reviewIdentity = identity(repoRoot);
  const paths = pathsForIdentity(repoRoot, reviewIdentity);

  fs.mkdirSync(paths.dir, { recursive: true });
  fs.writeFileSync(paths.lockPath, 'stale\n');
  const old = new Date(Date.now() - 60 * 60 * 1000);
  fs.utimesSync(paths.lockPath, old, old);

  const run = beginReviewRun(repoRoot, reviewIdentity, { waitMs: 50 });
  expect(run.mode).toBe('run');
  finishReviewRun(run, { stdout: '{}\n', stderr: '', exitCode: 0 });
});
