import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FRONTEND_LINT_PROJECTS,
  groupChangedFrontendFiles,
  parseCliArguments,
} from '../scripts/ci/lint-changed-frontend-files.mjs';

test('parseCliArguments prefers explicit SHAs', () => {
  assert.deepEqual(
    parseCliArguments(
      ['--base', 'base-sha', '--head', 'head-sha', '--list'],
      {
        NX_BASE: 'env-base',
        NX_HEAD: 'env-head',
      },
    ),
    {
      base: 'base-sha',
      head: 'head-sha',
      listOnly: true,
    },
  );
});

test('parseCliArguments uses Nx SHAs supplied by nx-set-shas', () => {
  assert.deepEqual(parseCliArguments([], { NX_BASE: 'base', NX_HEAD: 'head' }), {
    base: 'base',
    head: 'head',
    listOnly: false,
  });
});

test('groupChangedFrontendFiles keeps only existing lintable files', () => {
  const existingFiles = new Set([
    'packages/twenty-front/src/App.tsx',
    'packages/twenty-ui/package.json',
    'packages/twenty-sdk/src/index.ts',
  ]);

  const groups = groupChangedFrontendFiles(
    [
      'package.json',
      'packages/twenty-front/src/App.tsx',
      'packages/twenty-front/src/App.test.snap',
      'packages/twenty-front/src/deleted.ts',
      'packages/twenty-ui/package.json',
      'packages/twenty-sdk/src/index.ts',
    ],
    (file) => existingFiles.has(file),
  );

  assert.deepEqual(
    groups.map(({ root, files }) => ({ root, files })),
    [
      {
        root: 'packages/twenty-front',
        files: ['packages/twenty-front/src/App.tsx'],
      },
      {
        root: 'packages/twenty-ui',
        files: ['packages/twenty-ui/package.json'],
      },
      {
        root: 'packages/twenty-sdk',
        files: ['packages/twenty-sdk/src/index.ts'],
      },
    ],
  );
});

test('frontend lint projects have unique roots and configs', () => {
  assert.equal(
    new Set(FRONTEND_LINT_PROJECTS.map(({ project }) => project)).size,
    FRONTEND_LINT_PROJECTS.length,
  );
  assert.equal(
    new Set(FRONTEND_LINT_PROJECTS.map(({ root }) => root)).size,
    FRONTEND_LINT_PROJECTS.length,
  );
  assert.equal(
    new Set(FRONTEND_LINT_PROJECTS.map(({ config }) => config)).size,
    FRONTEND_LINT_PROJECTS.length,
  );
});
