import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  beginVerifyRun,
  finishVerifyRun,
  makeVerifyRunIdentity,
  pathsForIdentity,
} = require('../scripts/lib/verify-run-state.js');

function git(repoRoot, args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function createRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'os-verify-run-state-'));
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

test('completed verify result is replayed for the same identity', () => {
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

test('verify identity changes when review arguments change', () => {
  const repoRoot = createRepo();
  const first = identity(repoRoot, { args: { reviewArgs: ['--no-tests'] } });
  const second = identity(repoRoot, { args: { reviewArgs: ['--strict'] } });

  expect(first.key).not.toBe(second.key);
});

test('stale running verify lock is orphaned before acquiring a new run', () => {
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
