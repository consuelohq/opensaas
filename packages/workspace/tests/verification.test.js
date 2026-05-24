import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  computeVerificationState,
  getVerifyStampMismatch,
  writeVerifyStamp,
} = require('../scripts/lib/verification.js');

const tempRoots = [];

function git(repoRoot, args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function createRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-verification-'));
  tempRoots.push(repoRoot);
  git(repoRoot, ['init', '-b', 'main']);
  git(repoRoot, ['config', 'user.email', 'test@example.com']);
  git(repoRoot, ['config', 'user.name', 'Workspace Test']);
  fs.writeFileSync(path.join(repoRoot, 'file.txt'), 'hello\n');
  git(repoRoot, ['add', 'file.txt']);
  git(repoRoot, ['commit', '-m', 'init']);
  return repoRoot;
}

function validStamp(repoRoot, overrides = {}) {
  const state = computeVerificationState(repoRoot, 'main');
  return {
    result: 'pass',
    publishValid: true,
    mode: 'full',
    branch: state.branch,
    base: 'origin/main',
    headSha: state.headSha,
    changeHash: state.changeHash,
    changedFiles: [],
    verifiedAt: new Date().toISOString(),
    review: { skipped: false, passed: true, status: 0 },
    db: { skipped: false, passed: true, warnOnly: false, risks: [], findings: [] },
    commandVersion: 2,
    ...overrides,
  };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('publish-valid full verify stamp satisfies task push verification', () => {
  const repoRoot = createRepo();
  writeVerifyStamp(repoRoot, validStamp(repoRoot));

  expect(getVerifyStampMismatch(repoRoot, 'main')).toBeNull();
});

test('verify stamp without publishValid is rejected', () => {
  const repoRoot = createRepo();
  writeVerifyStamp(repoRoot, validStamp(repoRoot, { publishValid: false }));

  expect(getVerifyStampMismatch(repoRoot, 'main')).toContain('not publish-valid');
});

test('partial or skipped gates are rejected', () => {
  const repoRoot = createRepo();

  writeVerifyStamp(repoRoot, validStamp(repoRoot, { mode: 'partial' }));
  expect(getVerifyStampMismatch(repoRoot, 'main')).toContain('not full');

  writeVerifyStamp(repoRoot, validStamp(repoRoot, { review: { skipped: true, passed: true } }));
  expect(getVerifyStampMismatch(repoRoot, 'main')).toContain('review');

  writeVerifyStamp(repoRoot, validStamp(repoRoot, { db: { skipped: false, passed: true, warnOnly: true, risks: [], findings: [] } }));
  expect(getVerifyStampMismatch(repoRoot, 'main')).toContain('db');
});
