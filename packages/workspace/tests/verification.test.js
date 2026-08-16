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

test('verify human output identifies failed registry suites', () => {
  const source = fs.readFileSync(
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '../scripts/verify.js'),
    'utf8',
  );
  expect(source).toContain('registry failure:');
  expect(source).toContain('selection.failedSuites');
  expect(source).toContain('failure.outputTail');
  expect(source).toContain('compactRegistryFailureOutput');
  expect(source).toContain('registry runner failure:');
  expect(source).toContain('result.testSelection.error');
});


test('verify keeps review semantic-only because selected suites own test execution', () => {
  const verifySource = fs.readFileSync(
    path.resolve('packages/workspace/scripts/verify.js'),
    'utf8',
  );
  const runTestSelectionSource = verifySource.slice(
    verifySource.indexOf('function runTestSelection'),
    verifySource.indexOf('function createDbResult'),
  );

  expect(verifySource).toContain(
    "'--summary-json', '--quiet', '--no-tests', ...args.reviewArgs",
  );
  expect(verifySource).toContain(
    "const selectionArgs = ['packages/workspace/scripts/test-selection.js', 'check', '--base', base];",
  );
  expect(runTestSelectionSource).toContain('selectionResultPath');
  expect(runTestSelectionSource).toContain(
    "selectionArgs.push('--run', '--json', '--out', selectionResultPath);",
  );
  expect(runTestSelectionSource).toContain(
    "JSON.parse(fs.readFileSync(selectionResultPath, 'utf8'))",
  );
  expect(runTestSelectionSource).toContain(
    'maxBuffer: TEST_SELECTION_OUTPUT_MAX_BUFFER',
  );
});
