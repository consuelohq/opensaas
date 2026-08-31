import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNativeTestInvocation,
  filterRelevantNativeFiles,
  parseCliArguments,
  runSelectedNativeTests,
  selectNativeTestPlan,
} from '../scripts/ci/run-changed-os-native-tests.mjs';

test('parseCliArguments resolves comparison SHAs', () => {
  assert.deepEqual(
    parseCliArguments([], {
      NX_BASE: 'base-sha',
      NX_HEAD: 'head-sha',
    }),
    {
      base: 'base-sha',
      head: 'head-sha',
      listOnly: false,
    },
  );
});

test('parseCliArguments uses event SHAs when nx-set-shas leaves the base empty', () => {
  assert.deepEqual(
    parseCliArguments([], {
      NATIVE_TEST_BASE: 'pull-request-base-sha',
      NATIVE_TEST_HEAD: 'pull-request-head-sha',
      NX_BASE: '',
      NX_HEAD: 'merge-commit-sha',
    }),
    {
      base: 'pull-request-base-sha',
      head: 'pull-request-head-sha',
      listOnly: false,
    },
  );
});

test('parseCliArguments ignores zero SHAs and falls back to fetched Git history', () => {
  assert.deepEqual(
    parseCliArguments([], {
      NATIVE_TEST_BASE: '0000000000000000000000000000000000000000',
      NATIVE_TEST_HEAD: '',
      NX_BASE: '',
      NX_HEAD: '',
    }),
    {
      base: 'HEAD^1',
      head: 'HEAD',
      listOnly: false,
    },
  );
});

test('filterRelevantNativeFiles keeps only OS native-test ownership paths', () => {
  assert.deepEqual(
    filterRelevantNativeFiles([
      'package.json',
      'packages/dialer-server/src/main.ts',
      'packages/os/scripts/artifacts-design.ts',
      'packages/os/scripts/artifacts-design.ts',
      'packages/os/tests/artifacts-legacy-contract.test.ts',
      '.github/workflows/consuelo-os-distribution-environments.yaml',
      'packages/workspace/scripts/ci/run-changed-os-native-tests.mjs',
    ]),
    [
      '.github/workflows/consuelo-os-distribution-environments.yaml',
      'packages/os/scripts/artifacts-design.ts',
      'packages/os/tests/artifacts-legacy-contract.test.ts',
      'packages/workspace/scripts/ci/run-changed-os-native-tests.mjs',
    ],
  );
});

test('selectNativeTestPlan uses the focused artifact contract for the exact metering cleanup', () => {
  assert.equal(
    selectNativeTestPlan([
      'packages/os/scripts/artifacts-design.ts',
      'packages/os/tests/artifacts-legacy-contract.test.ts',
      '.github/workflows/consuelo-os-distribution-environments.yaml',
      'packages/workspace/scripts/ci/run-changed-os-native-tests.mjs',
      'packages/workspace/tests/run-changed-os-native-tests.test.mjs',
      'packages/workspace/tests/github-workflow-policy.test.js',
    ]),
    'focused-artifact',
  );
});

test('selectNativeTestPlan retains the full distribution suite for every broader change', () => {
  assert.equal(
    selectNativeTestPlan([
      'packages/os/scripts/artifacts-design.ts',
      'packages/os/scripts/lib/distribution/runtime-bundle.ts',
    ]),
    'full-distribution',
  );
  assert.equal(
    selectNativeTestPlan([
      '.github/workflows/consuelo-os-distribution-environments.yaml',
    ]),
    'full-distribution',
  );
});

test('runSelectedNativeTests executes the selected Bun test command', () => {
  const calls = [];
  const invocation = buildNativeTestInvocation('focused-artifact');

  runSelectedNativeTests(invocation, (command, args, options) => {
    calls.push({ command, args, options });
    return { status: 0 };
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'bun');
  assert.deepEqual(calls[0].args, [
    'x',
    'vitest',
    'run',
    'tests/artifacts-legacy-contract.test.ts',
  ]);
  assert.equal(calls[0].options.cwd.endsWith('packages/os'), true);
  assert.equal(calls[0].options.env.CI, '1');
});
