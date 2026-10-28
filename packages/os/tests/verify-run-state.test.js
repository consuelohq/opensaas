import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  abortVerifyRun,
  beginVerifyRun,
  finishVerifyRun,
  makeVerifyRunIdentity,
  pathsForIdentity,
} = require('../scripts/lib/verify-run-state.js');

const repoRoots = [];

afterEach(() => {
  for (const repoRoot of repoRoots.splice(0)) {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

function git(repoRoot, args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function createRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'os-verify-run-state-'));
  repoRoots.push(repoRoot);
  git(repoRoot, ['init', '-b', 'main']);
  git(repoRoot, ['config', 'user.email', 'test@example.com']);
  git(repoRoot, ['config', 'user.name', 'OS Test']);
  fs.writeFileSync(path.join(repoRoot, 'file.txt'), 'hello\n');
  git(repoRoot, ['add', 'file.txt']);
  git(repoRoot, ['commit', '-m', 'init']);
  return repoRoot;
}

function identity(repoRoot, overrides = {}) {
  return makeVerifyRunIdentity({
    repoRoot,
    branch: 'task/os/example',
    base: 'origin/stream/os',
    headSha: 'abc123',
    changeHash: 'def456',
    args: {
      review: true,
      db: true,
      dbWarnOnly: false,
      stamp: true,
      reviewArgs: [],
      ...overrides.args,
    },
    ...overrides,
  });
}

test('should replay completed verify result when identity matches', () => {
  const repoRoot = createRepo();
  const verifyIdentity = identity(repoRoot);

  const run = beginVerifyRun(repoRoot, verifyIdentity, { waitMs: 50 });
  expect(run.mode).toBe('run');

  finishVerifyRun(run, {
    stdout: '{"passed":true}\n',
    stderr: 'verify stderr\n',
    exitCode: 0,
  });

  const replay = beginVerifyRun(repoRoot, verifyIdentity, { waitMs: 50 });
  expect(replay.mode).toBe('replay');
  expect(replay.result.stdout).toBe('{"passed":true}\n');
  expect(replay.result.stderr).toBe('verify stderr\n');
  expect(replay.result.exitCode).toBe(0);
});

test('should return pending immediately for an identical active verify run', () => {
  const repoRoot = createRepo();
  const verifyIdentity = identity(repoRoot);

  const run = beginVerifyRun(repoRoot, verifyIdentity, { waitMs: 500 });
  expect(run.mode).toBe('run');

  const started = Date.now();
  const pending = beginVerifyRun(repoRoot, verifyIdentity, { waitMs: 500 });
  const elapsedMs = Date.now() - started;

  expect(pending.mode).toBe('pending');
  expect(pending.record?.status).toBe('running');
  expect(pending.identity.key).toBe(verifyIdentity.key);
  expect(elapsedMs).toBeLessThan(100);

  abortVerifyRun(run, 'test cleanup');
});

test('should change verify identity when review arguments change', () => {
  const repoRoot = createRepo();
  const first = identity(repoRoot, { args: { reviewArgs: ['--no-tests'] } });
  const second = identity(repoRoot, { args: { reviewArgs: ['--strict'] } });

  expect(first.key).not.toBe(second.key);
});

test('should orphan stale running verify lock when acquiring a new run', () => {
  const repoRoot = createRepo();
  const verifyIdentity = identity(repoRoot);
  const paths = pathsForIdentity(repoRoot, verifyIdentity);

  fs.mkdirSync(paths.dir, { recursive: true });
  fs.writeFileSync(paths.lockPath, 'stale\n');
  fs.writeFileSync(paths.recordPath, JSON.stringify({
    status: 'running',
    pid: 99999999,
    startedAt: new Date(0).toISOString(),
  }, null, 2));

  const run = beginVerifyRun(repoRoot, verifyIdentity, { waitMs: 50 });
  expect(run.mode).toBe('run');
  finishVerifyRun(run, { stdout: '{}\n', stderr: '', exitCode: 0 });
});

test('should change verify identity when committed-only test selection changes', () => {
  const repoRoot = createRepo();
  const first = identity(repoRoot, { args: { committedOnlyTests: false } });
  const second = identity(repoRoot, { args: { committedOnlyTests: true } });

  expect(first.key).not.toBe(second.key);
});

test('should change verify identity when review argument order changes', () => {
  const repoRoot = createRepo();
  const first = identity(repoRoot, { args: { reviewArgs: ['--flag-a', '--flag-b'] } });
  const second = identity(repoRoot, { args: { reviewArgs: ['--flag-b', '--flag-a'] } });

  expect(first.key).not.toBe(second.key);
});

test('should replay completed failed verify result when identity matches', () => {
  const repoRoot = createRepo();
  const verifyIdentity = identity(repoRoot);

  const failedRun = beginVerifyRun(repoRoot, verifyIdentity, { waitMs: 50 });
  expect(failedRun.mode).toBe('run');
  finishVerifyRun(failedRun, {
    stdout: '{"passed":false}\n',
    stderr: 'failed once\n',
    exitCode: 1,
  });

  const replay = beginVerifyRun(repoRoot, verifyIdentity, { waitMs: 50 });
  expect(replay.mode).toBe('replay');
  expect(replay.result.stdout).toBe('{"passed":false}\n');
  expect(replay.result.stderr).toBe('failed once\n');
  expect(replay.result.exitCode).toBe(1);
});

test('should allow a fresh retry after the failed-result replay window expires', () => {
  const repoRoot = createRepo();
  const verifyIdentity = identity(repoRoot);
  const failedRun = beginVerifyRun(repoRoot, verifyIdentity, { waitMs: 50 });
  finishVerifyRun(failedRun, { stdout: '{}\n', stderr: 'failed\n', exitCode: 1 });

  const paths = pathsForIdentity(repoRoot, verifyIdentity);
  const record = JSON.parse(fs.readFileSync(paths.recordPath, 'utf8'));
  fs.writeFileSync(paths.recordPath, JSON.stringify({ ...record, completedAt: new Date(0).toISOString() }, null, 2));

  const retry = beginVerifyRun(repoRoot, verifyIdentity, { waitMs: 50 });
  expect(retry.mode).toBe('run');
  finishVerifyRun(retry, { stdout: '{}\n', stderr: '', exitCode: 0 });
});

test('should remove verify lock when writing the running record fails', () => {
  const repoRoot = createRepo();
  const verifyIdentity = identity(repoRoot);
  const paths = pathsForIdentity(repoRoot, verifyIdentity);
  const originalRenameSync = fs.renameSync;

  fs.renameSync = function renameSyncWithInjectedFailure(from, to) {
    if (to === paths.recordPath) {
      throw new Error('simulated record write failure');
    }
    return originalRenameSync.call(fs, from, to);
  };

  try {
    expect(() => beginVerifyRun(repoRoot, verifyIdentity, { waitMs: 50 })).toThrow('simulated record write failure');
    expect(fs.existsSync(paths.lockPath)).toBe(false);
  } finally {
    fs.renameSync = originalRenameSync;
  }
});

test('should abort acquired verify run when caller fails before finish', () => {
  const repoRoot = createRepo();
  const verifyIdentity = identity(repoRoot);

  const run = beginVerifyRun(repoRoot, verifyIdentity, { waitMs: 50 });
  expect(run.mode).toBe('run');

  abortVerifyRun(run, 'simulated failure before finish');

  const paths = pathsForIdentity(repoRoot, verifyIdentity);
  expect(fs.existsSync(paths.lockPath)).toBe(false);

  const nextRun = beginVerifyRun(repoRoot, verifyIdentity, { waitMs: 50 });
  expect(nextRun.mode).toBe('run');
  finishVerifyRun(nextRun, { stdout: '{}\n', stderr: '', exitCode: 0 });
});

test('OS agent JSON verify uses the same detached resumable boundary', () => {
  const source = fs.readFileSync(
    path.resolve(import.meta.dirname, '../scripts/verify.js'),
    'utf8',
  );

  expect(source).toContain("verifyRun.mode === 'launch'");
  expect(source).toContain("verifyRun.mode === 'pending'");
  expect(source).toContain("'--foreground'");
  expect(source).toContain('detached: true');
  expect(source).toContain('child.unref()');
  expect(source).toContain('VERIFY_PENDING');
});
