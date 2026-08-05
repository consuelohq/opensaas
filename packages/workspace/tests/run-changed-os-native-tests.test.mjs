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
