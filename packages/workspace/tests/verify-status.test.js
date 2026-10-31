import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const { makeVerifyRunIdentity, beginVerifyRun, finishVerifyRun, abortVerifyRun, pathsForIdentity } =
  require('../scripts/lib/verify-run-state.js');

const roots = [];
const statusScript = path.resolve(import.meta.dirname, '../scripts/verify-status.js');

afterEach(() => {
  for (const repoRoot of roots.splice(0)) fs.rmSync(repoRoot, { recursive: true, force: true });
});

function createRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-verify-status-'));
  roots.push(repoRoot);
  for (const args of [
    ['init', '-b', 'main'],
    ['config', 'user.email', 'test@example.com'],
    ['config', 'user.name', 'Verify Status Test'],
  ]) execFileSync('git', args, { cwd: repoRoot });
  fs.writeFileSync(path.join(repoRoot, 'test.txt'), 'unchanged\n');
  execFileSync('git', ['add', '.'], { cwd: repoRoot });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: repoRoot });
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const identity = makeVerifyRunIdentity({
    repoRoot, branch: 'main', base: 'HEAD', headSha, changeHash: 'fixture',
    args: { review: true, db: true, stamp: true, reviewArgs: [] },
  });
  return { repoRoot, identity };
}

function runStatus(repoRoot, key, waitSeconds = 0) {
  const result = spawnSync(process.execPath, [statusScript, '--run-key', key, '--wait-seconds', String(waitSeconds), '--json'], {
    cwd: repoRoot,
    env: { ...process.env, TASK_WORKTREE: repoRoot },
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error('verify-status failed ' + result.status + ' ' + result.stderr);
  return JSON.parse(result.stdout);
}

test('status returns truthful pending without launching a second verification worker', () => {
  const { repoRoot, identity } = createRepo();
  const run = beginVerifyRun(repoRoot, identity);
  const before = fs.readFileSync(pathsForIdentity(repoRoot, identity).recordPath, 'utf8');
  const status = runStatus(repoRoot, identity.key);
  expect(status).toMatchObject({
    schema: 'verify.status.v1', status: 'VERIFY_PENDING', pending: true, terminal: false, runKey: identity.key,
    nextAction: expect.stringContaining('verify.status'),
  });
  expect(status.passed).toBeNull();
  expect(status.retryAfterSeconds).toBeGreaterThanOrEqual(30);
  expect(fs.readFileSync(pathsForIdentity(repoRoot, identity).recordPath, 'utf8')).toBe(before);
  abortVerifyRun(run, 'test cleanup');
});

test('status gives compact terminal failure and actionable retry without running verification', () => {
  const { repoRoot, identity } = createRepo();
  const run = beginVerifyRun(repoRoot, identity);
  finishVerifyRun(run, {
    stdout: JSON.stringify({
      passed: false, publishValid: false,
      review: { passed: true },
      testSelection: {
        passed: false, data: {
          failedSuites: [{ name: 'OS browser regression', outputTail: 'Expected smoke test to pass' }],
        },
      }, db: { passed: true },
    }) + '\n',
    stderr: 'suite failed', exitCode: 1,
  });
  const status = runStatus(repoRoot, identity.key);
  expect(status).toMatchObject({
    status: 'VERIFY_FAILED', pending: false, terminal: true,
    publishValid: false, passed: false, exitCode: 1,
    checks: { review: true, tests: false, db: true },
    failedSuites: [expect.objectContaining({ name: 'OS browser regression' })],
  });
  expect(status.nextAction).toContain('retry');
  expect(beginVerifyRun(repoRoot, identity).mode).toBe('replay');
});

test('status shows unknown and stale run keys as safe read-only outcomes', () => {
  const { repoRoot, identity } = createRepo();
  const unknown = runStatus(repoRoot, 'a'.repeat(64));
  expect(unknown.status).toBe('VERIFY_NOT_FOUND');
  expect(fs.existsSync(pathsForIdentity(repoRoot, { key: 'a'.repeat(64) }).dir)).toBe(false);
  const run = beginVerifyRun(repoRoot, identity);
  finishVerifyRun(run, { stdout: '{"passed":true,"publishValid":true}\n', stderr: '', exitCode: 0 });
  // The fixture's changeHash intentionally differs from the current working tree,
  // so the terminal result must never authorize publication.
  expect(runStatus(repoRoot, identity.key)).toMatchObject({ status: 'VERIFY_STALE', publishValid: false });
});

test('status refuses malformed and unbounded waits', () => {
  const { repoRoot } = createRepo();
  for (const args of [['--run-key', '../../etc/passwd'], ['--run-key', 'a'.repeat(64), '--wait-seconds', '999999']]) {
    const result = spawnSync(process.execPath, [statusScript, ...args, '--json'], {
      cwd: repoRoot, env: { ...process.env, TASK_WORKTREE: repoRoot }, encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/run key|wait-seconds/i);
  }
});
