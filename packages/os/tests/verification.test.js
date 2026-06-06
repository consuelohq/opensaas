import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';

import verification from '../scripts/lib/verification.js';

const {
  getVerifyStampMismatch,
  getVerifyStampPath,
  readVerifyStamp,
  writeVerifyStamp,
} = verification;

const tempRoots = [];

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-test-'));
  tempRoots.push(root);
  return root;
}

const taskMeta = {
  area: 'os-skills',
  taskBranch: 'task/os-skills/example-task',
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test('getVerifyStampPath uses scoped task metadata when available', () => {
  const repoRoot = makeRepo();

  expect(path.relative(repoRoot, getVerifyStampPath(repoRoot, taskMeta))).toBe(
    '.task/os-skills/example-task/verify.json',
  );
});

test('writeVerifyStamp and readVerifyStamp round-trip scoped task verify reports', () => {
  const repoRoot = makeRepo();
  const stamp = {
    result: 'fail',
    branch: 'task/os-skills/example-task',
    headSha: 'abc123',
    changeHash: 'change',
  };

  writeVerifyStamp(repoRoot, stamp, taskMeta);

  expect(readVerifyStamp(repoRoot, taskMeta)).toMatchObject(stamp);
  expect(fs.existsSync(path.join(repoRoot, '.task', 'verify.json'))).toBe(false);
});

test('getVerifyStampMismatch reports scoped missing verify path', () => {
  const repoRoot = makeRepo();

  expect(getVerifyStampMismatch(repoRoot, 'task/os-skills/example-task', taskMeta)).toBe(
    'missing .task/os-skills/example-task/verify.json stamp',
  );
});

test('getVerifyStampMismatch rejects pass stamps without publishValid', () => {
  const repoRoot = makeRepo();
  writeVerifyStamp(repoRoot, {
    result: 'pass',
    branch: 'task/os-skills/example-task',
    headSha: 'abc123',
    changeHash: 'change',
  }, taskMeta);

  expect(getVerifyStampMismatch(repoRoot, 'task/os-skills/example-task', taskMeta)).toBe(
    'last verify stamp is not publish-valid',
  );
});
