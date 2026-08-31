import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNxArguments,
  filterFrontendTaskFiles,
  parseCliArguments,
  runChangedFrontendTask,
} from '../scripts/ci/run-changed-frontend-task.mjs';

test('parseCliArguments resolves the task and comparison SHAs', () => {
  assert.deepEqual(
    parseCliArguments(['--task', 'typecheck'], {
      NX_BASE: 'base-sha',
      NX_HEAD: 'head-sha',
    }),
    {
      task: 'typecheck',
      base: 'base-sha',
      head: 'head-sha',
      listOnly: false,
    },
  );
});

test('parseCliArguments rejects unsupported tasks', () => {
  assert.throws(
    () => parseCliArguments(['--task', 'build'], {}),
    /Pass --task test or --task typecheck/,
  );
});

test('filterFrontendTaskFiles excludes only ESLint config contract files', () => {
  assert.deepEqual(
    filterFrontendTaskFiles([
      'package.json',
      'yarn.lock',
      'packages/twenty-front/eslint.config.mjs',
      'packages/twenty-front/src/modules/dialer/useDialer.ts',
      'packages/twenty-shared/src/utils/phone.ts',
      'packages/twenty-ui/src/deleted-component.tsx',
      'packages/twenty-ui/src/deleted-component.tsx',
      'packages/dialer-server/src/main.ts',
    ]),
    [
      'packages/twenty-front/src/modules/dialer/useDialer.ts',
      'packages/twenty-shared/src/utils/phone.ts',
      'packages/twenty-ui/src/deleted-component.tsx',
    ],
  );
});

test('buildNxArguments preserves Nx dependency propagation through --files', () => {
  assert.deepEqual(
    buildNxArguments({
      task: 'test',
      files: ['packages/twenty-shared/src/utils/phone.ts'],
    }),
    [
      '--no-install',
      'nx',
      'affected',
      '--nxBail',
      '--configuration=ci',
      '-t=test',
      '--parallel=3',
      '--exclude=*,!tag:scope:frontend',
      '--skip-nx-cache',
      '--files',
      'packages/twenty-shared/src/utils/phone.ts',
    ],
  );
});

test('runChangedFrontendTask skips Nx when only config files changed', () => {
  let called = false;

  runChangedFrontendTask(
    { task: 'typecheck', files: [] },
    () => {
      called = true;
      return { status: 0 };
    },
  );

  assert.equal(called, false);
});

test('runChangedFrontendTask executes Nx for real frontend source changes', () => {
  const calls = [];

  runChangedFrontendTask(
    {
      task: 'typecheck',
      files: ['packages/twenty-front/src/modules/dialer/useDialer.ts'],
    },
    (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0 };
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'npx');
  assert.ok(calls[0].args.includes('-t=typecheck'));
  assert.ok(calls[0].args.includes('--files'));
  assert.equal(calls[0].options.env.NX_DAEMON, 'false');
});
