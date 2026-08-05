import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNxArguments,
  filterGraphqlGenerationFiles,
  filterServerTaskFiles,
  parseCliArguments,
  runGraphqlGenerationCheck,
  runChangedServerTask,
} from '../scripts/ci/run-changed-server-task.mjs';

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
      graphql: false,
    },
  );
});

test('parseCliArguments selects GraphQL generation mode', () => {
  assert.equal(parseCliArguments(['--graphql'], {}).graphql, true);
});

test('filterServerTaskFiles excludes root and config-only triggers', () => {
  assert.deepEqual(
    filterServerTaskFiles([
      'package.json',
      'yarn.lock',
      'packages/twenty-shared/eslint.config.mjs',
      'packages/twenty-server/src/engine/core-modules/health/health.controller.ts',
      'packages/twenty-shared/src/utils/phone.ts',
      'packages/twenty-front/src/generated/graphql.ts',
      'packages/dialer-server/src/main.ts',
    ]),
    [
      'packages/twenty-front/src/generated/graphql.ts',
      'packages/twenty-server/src/engine/core-modules/health/health.controller.ts',
      'packages/twenty-shared/src/utils/phone.ts',
    ],
  );
});

test('filterGraphqlGenerationFiles keeps only server schema and generated files', () => {
  assert.deepEqual(
    filterGraphqlGenerationFiles([
      'package.json',
      'packages/twenty-shared/src/utils/phone.ts',
      'packages/twenty-server/src/engine/api/graphql/schema.ts',
      'packages/twenty-front/src/generated/graphql.ts',
      'packages/twenty-front/src/generated-metadata/graphql.ts',
    ]),
    [
      'packages/twenty-front/src/generated-metadata/graphql.ts',
      'packages/twenty-front/src/generated/graphql.ts',
      'packages/twenty-server/src/engine/api/graphql/schema.ts',
    ],
  );
});

test('buildNxArguments scopes lint and typecheck through changed files', () => {
  assert.deepEqual(
    buildNxArguments({
      files: ['packages/twenty-server/src/main.ts'],
    }),
    [
      '--no-install',
      'nx',
      'affected',
      '--nxBail',
      '--configuration=ci',
      '-t=lint,typecheck',
      '--parallel=3',
      '--exclude=*,!tag:scope:backend',
      '--skip-nx-cache',
      '--files',
      'packages/twenty-server/src/main.ts',
    ],
  );
});

test('runChangedServerTask skips Nx for config-only changes', () => {
  let called = false;

  runChangedServerTask([], () => {
    called = true;
    return { status: 0 };
  });

  assert.equal(called, false);
});

test('runChangedServerTask executes Nx for server runtime changes', () => {
  const calls = [];

  runChangedServerTask(
    ['packages/twenty-server/src/main.ts'],
    (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0 };
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'npx');
  assert.ok(calls[0].args.includes('-t=lint,typecheck'));
  assert.ok(calls[0].args.includes('--files'));
  assert.equal(calls[0].options.env.NX_DAEMON, 'false');
});

test('runGraphqlGenerationCheck skips generation without schema changes', () => {
  let called = false;

  runGraphqlGenerationCheck([], () => {
    called = true;
    return { status: 0 };
  });

  assert.equal(called, false);
});

test('runGraphqlGenerationCheck generates and verifies committed outputs', () => {
  const calls = [];

  runGraphqlGenerationCheck(
    ['packages/twenty-server/src/engine/api/graphql/schema.ts'],
    (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0 };
    },
  );

  assert.deepEqual(
    calls.map(({ command, args }) => [command, ...args]),
    [
      ['npx', '--no-install', 'nx', 'run', 'twenty-front:graphql:generate'],
      [
        'npx',
        '--no-install',
        'nx',
        'run',
        'twenty-front:graphql:generate',
        '--configuration=metadata',
      ],
      [
        'git',
        'diff',
        '--quiet',
        '--',
        'packages/twenty-front/src/generated',
        'packages/twenty-front/src/generated-metadata',
      ],
    ],
  );
});
