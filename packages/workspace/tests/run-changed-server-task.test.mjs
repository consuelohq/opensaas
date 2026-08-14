import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildEslintArguments,
  buildTypecheckArguments,
  compareEslintDiagnostics,
  compareTypeScriptDiagnostics,
  eslintConfigForFile,
  filterGraphqlGenerationFiles,
  filterServerTaskFiles,
  parseEslintDiagnosticKeys,
  parseTypeScriptDiagnosticKeys,
  parseCliArguments,
  runChangedFileLint,
  runGraphqlGenerationCheck,
  runMigrationGenerationCheck,
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
      migrations: false,
    },
  );
});

test('parseCliArguments selects GraphQL generation mode', () => {
  assert.equal(parseCliArguments(['--graphql'], {}).graphql, true);
});

test('parseCliArguments selects migration generation mode', () => {
  assert.equal(parseCliArguments(['--migrations'], {}).migrations, true);
});

test('filterServerTaskFiles excludes root and config-only triggers', () => {
  assert.deepEqual(
    filterServerTaskFiles([
      'package.json',
      'yarn.lock',
      'packages/twenty-server/project.json',
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
      'packages/twenty-server/project.json',
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

test('buildEslintArguments selects the owning project config and stdin filename', () => {
  assert.deepEqual(
    buildEslintArguments('packages/twenty-server/src/main.ts'),
    [
      '--no-install',
      'eslint',
      '--format',
      'json',
      '--config',
      'packages/twenty-server/eslint.config.mjs',
      '--stdin',
      '--stdin-filename',
      'packages/twenty-server/src/main.ts',
    ],
  );
  assert.equal(
    eslintConfigForFile('packages/twenty-shared/src/utils/phone.ts'),
    'packages/twenty-shared/eslint.config.mjs',
  );
  assert.equal(
    eslintConfigForFile('packages/twenty-front/src/generated/graphql.ts'),
    'packages/twenty-front/eslint.config.mjs',
  );
});

test('ESLint diagnostic comparison tracks new error multiplicity without line numbers', () => {
  const current = parseEslintDiagnosticKeys(
    'warning No cached ProjectGraph is available.\n' +
      JSON.stringify([
      {
        source: 'const first = 1;\nconst second = 2;\nconst third = 3;',
        messages: [
          { severity: 2, ruleId: 'import/order', messageId: 'order', message: 'order', line: 1 },
          { severity: 2, ruleId: 'import/order', messageId: 'order', message: 'order', line: 2 },
          { severity: 1, ruleId: 'example/warning', messageId: 'warning', message: 'warning', line: 3 },
        ],
      },
    ]),
  );
  const baseline = ['import/order:order:order:const first = 1;'];

  assert.deepEqual(current, [
    'import/order:order:order:const first = 1;',
    'import/order:order:order:const second = 2;',
  ]);
  assert.deepEqual(compareEslintDiagnostics(current, baseline), {
    unexpected: ['import/order:order:order:const second = 2;'],
    resolved: [],
  });
});

test('runChangedFileLint accepts base-existing errors and rejects a new changed-file error', () => {
  const file = 'packages/twenty-server/src/main.ts';
  const existing = JSON.stringify([
    {
      messages: [
        { severity: 2, ruleId: 'import/order', messageId: 'order', message: 'order' },
      ],
    },
  ]);
  let index = 0;

  runChangedFileLint([file], {
    base: 'base-sha',
    readBaseFile: () => 'base source',
    readCurrentFile: () => 'current source',
    runCommand: () => ({ status: 1, stdout: [existing, existing][index++], stderr: '' }),
  });

  assert.throws(
    () =>
      runChangedFileLint([file], {
        base: 'base-sha',
        readBaseFile: () => 'base source',
        readCurrentFile: () => 'current source',
        runCommand: (_command, _args, options) => ({
          status: 1,
          stdout: JSON.stringify([
            {
              messages:
                options.input === 'base source'
                  ? []
                  : [
                      { severity: 2, ruleId: 'prettier/prettier', messageId: 'replace', message: 'replace' },
                    ],
            },
          ]),
          stderr: '',
        }),
      }),
    /new ESLint diagnostics.*prettier\/prettier:replace/s,
  );
});

test('runChangedFileLint allows explicit lint baseline debt but rejects diagnostics beyond it', () => {
  const file = 'packages/twenty-server/src/main.ts';
  const baselineKey = 'prettier/prettier:replace:replace:const value = 1;';
  const extraKey = 'import/order:order:order:const other = 2;';
  const outputFor = (messages) =>
    JSON.stringify([{ source: 'const value = 1;\nconst other = 2;', messages }]);
  const baselineMessage = {
    severity: 2,
    ruleId: 'prettier/prettier',
    messageId: 'replace',
    message: 'replace',
    line: 1,
  };
  const extraMessage = {
    severity: 2,
    ruleId: 'import/order',
    messageId: 'order',
    message: 'order',
    line: 2,
  };

  let allowedCall = 0;
  runChangedFileLint([file], {
    base: 'base-sha',
    lintBaseline: { [file]: [baselineKey] },
    readBaseFile: () => 'base source',
    readCurrentFile: () => 'current source',
    runCommand: () => ({
      status: allowedCall++ === 0 ? 0 : 1,
      stdout: allowedCall === 1 ? '[]' : outputFor([baselineMessage]),
      stderr: '',
    }),
  });

  let call = 0;
  assert.throws(
    () =>
      runChangedFileLint([file], {
        base: 'base-sha',
        lintBaseline: { [file]: [baselineKey] },
        readBaseFile: () => 'base',
        readCurrentFile: () => 'current',
        runCommand: () => ({
          status: call++ === 0 ? 0 : 1,
          stdout: call === 1 ? '[]' : outputFor([baselineMessage, extraMessage]),
          stderr: '',
        }),
      }),
    new RegExp(`new ESLint diagnostics.*${extraKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 's'),
  );
});

test('buildTypecheckArguments uses standard TypeScript without emitting', () => {
  assert.deepEqual(buildTypecheckArguments(), [
    '--no-install',
    'tsc',
    '--pretty',
    'false',
    '--noEmit',
    '-p',
    'packages/twenty-server/tsconfig.json',
  ]);
});

test('TypeScript diagnostic baseline comparison rejects only new diagnostic keys', () => {
  const diagnostics = parseTypeScriptDiagnosticKeys(`
packages/twenty-server/src/a.ts(10,2): error TS2322: existing error
packages/twenty-server/src/b.ts(20,4): error TS2345: new error
  details from the compiler
`);

  assert.deepEqual(diagnostics, [
    'packages/twenty-server/src/a.ts:10:2:TS2322',
    'packages/twenty-server/src/b.ts:20:4:TS2345',
  ]);
  assert.deepEqual(
    compareTypeScriptDiagnostics(diagnostics, [
      'packages/twenty-server/src/a.ts:10:2:TS2322',
      'packages/twenty-server/src/old.ts:1:1:TS7006',
    ]),
    {
      unexpected: ['packages/twenty-server/src/b.ts:20:4:TS2345'],
      resolved: ['packages/twenty-server/src/old.ts:1:1:TS7006'],
    },
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

test('runChangedServerTask executes lint and baseline-aware typecheck for server runtime changes', () => {
  const calls = [];
  const lintCalls = [];

  runChangedServerTask(
    ['packages/twenty-server/src/main.ts'],
    (command, args, options) => {
      calls.push({ command, args, options });
      return {
        status: 2,
        stdout:
          'packages/twenty-server/src/existing.ts(1,2): error TS2322: existing',
        stderr: '',
      };
    },
    {
      base: 'base-sha',
      lintRunner: (files, options) => lintCalls.push({ files, options }),
      typecheckBaseline: [
        'packages/twenty-server/src/existing.ts:1:2:TS2322',
      ],
    },
  );

  assert.equal(lintCalls.length, 1);
  assert.equal(lintCalls[0].options.base, 'base-sha');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'npx');
  assert.deepEqual(calls[0].args, buildTypecheckArguments());
});

test('runChangedServerTask rejects a new TypeScript diagnostic outside the baseline', () => {
  assert.throws(
    () =>
      runChangedServerTask(
        ['packages/twenty-server/src/main.ts'],
        () => ({
          status: 2,
          stdout:
            'packages/twenty-server/src/new.ts(3,4): error TS2345: regression',
          stderr: '',
        }),
        { base: 'base-sha', lintRunner: () => {}, typecheckBaseline: [] },
      ),
    /new TypeScript diagnostics.*new\.ts:3:4:TS2345/s,
  );
});

test('server lint configuration resolves the existing workspace rules project', () => {
  const serverEslintConfig = readFileSync(
    new URL('../../twenty-server/eslint.config.mjs', import.meta.url),
    'utf8',
  );
  assert.match(
    serverEslintConfig,
    /loadWorkspaceRules\(\s*'packages\/eslint-rules'/,
  );
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

test('runMigrationGenerationCheck skips generation without server runtime changes', () => {
  let called = false;

  runMigrationGenerationCheck([], {
    runCommand: () => {
      called = true;
      return { status: 0 };
    },
  });

  assert.equal(called, false);
});

test('runMigrationGenerationCheck accepts a no-change TypeORM exit', () => {
  const calls = [];

  runMigrationGenerationCheck(['packages/twenty-server/src/main.ts'], {
    runCommand: (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 1, stdout: 'No changes', stderr: '' };
    },
    listGeneratedFiles: () => [],
  });

  assert.deepEqual(
    calls.map(({ command, args }) => [command, ...args]),
    [
      [
        'npx',
        '--no-install',
        'nx',
        'run',
        'twenty-server:typeorm',
        'migration:generate',
        'core-migration-check',
        '-d',
        'src/database/typeorm/core/core.datasource.ts',
      ],
    ],
  );
});

test('runMigrationGenerationCheck rejects and removes generated drift', () => {
  const removed = [];

  assert.throws(
    () =>
      runMigrationGenerationCheck(['packages/twenty-server/src/main.ts'], {
        runCommand: () => ({ status: 0, stdout: 'generated', stderr: '' }),
        listGeneratedFiles: () => [
          'packages/twenty-server/123-core-migration-check.ts',
        ],
        removeGeneratedFile: (file) => removed.push(file),
      }),
    /Unexpected migration files were generated/,
  );
  assert.deepEqual(removed, [
    'packages/twenty-server/123-core-migration-check.ts',
  ]);
});
