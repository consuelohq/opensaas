import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const selectorPath = 'packages/workspace/scripts/ci/run-changed-os-native-tests.mjs';

const git = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};

const shallowMergeFixture = (t) => {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), 'native-selector-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const origin = path.join(dir, 'origin.git');
  const source = path.join(dir, 'source');
  const checkout = path.join(dir, 'checkout');
  git(dir, 'init', '--bare', origin);
  git(dir, 'init', '-b', 'main', source);
  git(source, 'config', 'user.name', 'Native Test');
  git(source, 'config', 'user.email', 'native-test@example.invalid');
  mkdirSync(path.join(source, 'packages/os/scripts'), { recursive: true });
  writeFileSync(path.join(source, 'packages/os/scripts/artifacts-design.ts'), 'before\n');
  git(source, 'add', '.');
  git(source, 'commit', '-m', 'event base');
  const base = git(source, 'rev-parse', 'HEAD');
  git(source, 'checkout', '-b', 'pull-request');
  writeFileSync(path.join(source, 'packages/os/scripts/artifacts-design.ts'), 'after\n');
  git(source, 'commit', '-am', 'native change');
  git(source, 'checkout', 'main');
  writeFileSync(path.join(source, 'unrelated.txt'), 'main moved\n');
  git(source, 'add', '.');
  git(source, 'commit', '-m', 'main moved');
  git(source, 'merge', '--no-ff', '-m', 'merge pull request', 'pull-request');
  git(source, 'remote', 'add', 'origin', origin);
  git(source, 'push', 'origin', 'main');
  git(origin, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(dir, 'clone', '--depth', '2', `file://${origin}`, checkout);
  mkdirSync(path.dirname(path.join(checkout, selectorPath)), { recursive: true });
  copyFileSync(new URL('../scripts/ci/run-changed-os-native-tests.mjs', import.meta.url), path.join(checkout, selectorPath));
  assert.equal(git(checkout, 'rev-parse', '--is-shallow-repository'), 'true');
  assert.notEqual(spawnSync('git', ['cat-file', '-e', `${base}^{commit}`], { cwd: checkout }).status, 0);
  return { dir, checkout, base };
};

const runFixtureSelector = ({ dir, checkout, base }, head = 'HEAD') => {
  const trace = path.join(dir, 'git-trace');
  const result = spawnSync(process.execPath, [path.join(checkout, selectorPath), '--base', base, '--head', head, '--list'], {
    cwd: checkout,
    encoding: 'utf8',
    env: { ...process.env, GIT_TRACE: trace },
  });
  return { ...result, trace: existsSync(trace) ? readFileSync(trace, 'utf8') : '' };
};

test('fetches the exact absent event base in a shallow merge checkout before selecting tests', (t) => {
  const fixture = shallowMergeFixture(t);
  const result = runFixtureSelector(fixture);
  assert.equal(result.status, 0, result.stderr);
  const selection = JSON.parse(result.stdout);
  assert.deepEqual(selection.files, ['packages/os/scripts/artifacts-design.ts']);
  assert.equal(selection.plan, 'focused-artifact');
  assert.match(result.trace, new RegExp(`git fetch --no-tags --depth=1 origin ${fixture.base}`));
  assert.equal(git(fixture.checkout, 'cat-file', '-e', `${fixture.base}^{commit}`), '');
});

test('also fetches an absent immutable head without changing the comparison base', (t) => {
  const fixture = shallowMergeFixture(t);
  const result = runFixtureSelector({ ...fixture, base: 'HEAD' }, fixture.base);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).plan, 'focused-artifact');
  assert.match(result.trace, new RegExp(`git fetch --no-tags --depth=1 origin ${fixture.base}`));
});

test('fails closed when the exact missing base cannot be fetched', (t) => {
  const fixture = shallowMergeFixture(t);
  git(fixture.checkout, 'remote', 'set-url', 'origin', `file://${fixture.dir}/missing.git`);
  const result = runFixtureSelector(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /git fetch failed/);
  assert.equal(result.stdout, '');
  assert.match(result.trace, new RegExp(`git fetch --no-tags --depth=1 origin ${fixture.base}`));
});

test('preserves a genuine diff failure for a symbolic head without fetching it', (t) => {
  const fixture = shallowMergeFixture(t);
  const result = runFixtureSelector({ ...fixture, base: 'HEAD^1' }, 'missing-head');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /git diff failed/);
  assert.equal(result.stdout, '');
  assert.doesNotMatch(result.trace, /git fetch /);
});

import {
  buildNativeTestInvocation,
  filterRelevantNativeFiles,
  parseCliArguments,
  runSelectedNativeTests,
  selectNativeTestPlan,
} from '../scripts/ci/run-changed-os-native-tests.mjs';

test('native selector reserves enough Git output for repository-scale deletion diffs', () => {
  const source = readFileSync(
    new URL('../scripts/ci/run-changed-os-native-tests.mjs', import.meta.url),
    'utf8',
  );

  assert.match(source, /const GIT_OUTPUT_MAX_BUFFER = 64 \* 1024 \* 1024;/);
  assert.match(source, /maxBuffer: GIT_OUTPUT_MAX_BUFFER/);
});

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
