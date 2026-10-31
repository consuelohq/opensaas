import { afterEach, describe, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const tempDirs = [];
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-modernization-'));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const passingSelection = {
  passed: true,
  level: 'pass',
  zeroSuiteReason: null,
  matchedRules: [{ id: 'os-review', critical: true }],
  selectedSuites: [
    { name: 'OS Bun contract', command: ['bun', 'test', 'packages/os/tests/example.test.ts'] },
    { name: 'Workspace Vitest', command: ['bun', 'x', 'vitest', 'run', 'packages/workspace/tests/example.test.js'] },
  ],
  runResults: [
    { name: 'OS Bun contract', ruleId: 'os-review', status: 'passed', durationMs: 110, outputTail: '' },
    { name: 'Workspace Vitest', ruleId: 'os-review', status: 'passed', durationMs: 120, outputTail: '' },
  ],
};
function stubSelector(selection, status = 0) {
  const calls = [];
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    const outIndex = args.indexOf('--out');
    expect(outIndex).toBeGreaterThan(0);
    fs.writeFileSync(args[outIndex + 1], JSON.stringify(selection));
    return { status, signal: null, error: null, stdout: '', stderr: '' };
  };
  return { spawn, calls };
}

describe('modern review test selection', () => {
  test('delegates mixed Bun and Vitest suites to the same selector as verify', () => {
    const { runSelectedReviewTests } = require('../scripts/lib/review-tests.js');
    const repoRoot = fixture();
    const { spawn, calls } = stubSelector(passingSelection);
    const result = runSelectedReviewTests({ repoRoot, base: 'origin/main', spawn });

    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe('bun');
    expect(calls[0].args.slice(0, 5)).toEqual([
      'packages/workspace/scripts/test-selection.js', 'check', '--base', 'origin/main', '--run',
    ]);
    expect(result.passed).toBe(true);
    expect(result.selectedSuiteCount).toBe(2);
    expect(result.testResults.map((item) => item.pkg)).toEqual(['OS Bun contract', 'Workspace Vitest']);
  });

  test('preserves failed suite output and flags failure even if selector process exits zero', () => {
    const { runSelectedReviewTests } = require('../scripts/lib/review-tests.js');
    const repoRoot = fixture();
    const failure = {
      ...passingSelection,
      passed: false,
      runResults: [
        { name: 'Workspace Vitest', status: 'failed', ruleId: 'os-review', durationMs: 500, error: { code: 'ETIMEDOUT' }, outputTail: 'FAIL tests/example.test.ts: timeout exceeded' },
      ],
    };
    const result = runSelectedReviewTests({ repoRoot, base: 'origin/main', spawn: stubSelector(failure).spawn });

    expect(result.passed).toBe(false);
    expect(result.testResults[0]).toMatchObject({ passed: false, pkg: 'Workspace Vitest' });
    expect(result.testResults[0].failures.join(' ')).toContain('timeout exceeded');
  });

  test('critical zero-suite selection is a blocking failure, rather than silent green', () => {
    const { runSelectedReviewTests } = require('../scripts/lib/review-tests.js');
    const result = runSelectedReviewTests({
      repoRoot: fixture(),
      base: 'origin/main',
      spawn: stubSelector({
        passed: false, level: 'fail', zeroSuiteReason: 'critical changed files matched test-selection rules but selected zero suites',
        selectedSuites: [], matchedRules: [{ id: 'critical', critical: true }], runResults: [],
      }, 1).spawn,
    });

    expect(result.passed).toBe(false);
    expect(result.selectedSuiteCount).toBe(0);
    expect(result.zeroSuiteReason).toContain('critical');
    expect(result.testResults).toEqual([expect.objectContaining({ passed: false, pkg: 'test-selection' })]);
  });

  test('docs-only zero suites report a reason without manufacturing a failure', () => {
    const { runSelectedReviewTests } = require('../scripts/lib/review-tests.js');
    const result = runSelectedReviewTests({
      repoRoot: fixture(), base: 'origin/main',
      spawn: stubSelector({
        passed: true, level: 'pass', zeroSuiteReason: 'changed files are docs or task metadata',
        selectedSuites: [], matchedRules: [], runResults: [],
      }).spawn,
    });
    expect(result.passed).toBe(true);
    expect(result.testResults).toEqual([]);
    expect(result.zeroSuiteReason).toContain('docs');
  });

  test('missing selection output or launch errors fail closed', () => {
    const { runSelectedReviewTests } = require('../scripts/lib/review-tests.js');
    const result = runSelectedReviewTests({
      repoRoot: fixture(), base: 'origin/main',
      spawn: () => ({ status: null, signal: null, error: { code: 'ENOENT', message: 'bun unavailable' }, stderr: '' }),
    });
    expect(result.passed).toBe(false);
    expect(result.testResults).toEqual([expect.objectContaining({ passed: false, pkg: 'test-selection' })]);
    expect(result.testResults[0].failures.join(' ')).toMatch(/bun unavailable|output/i);
  });

  test('a selector that claims success but omits executed suites fails closed', () => {
    const { runSelectedReviewTests } = require('../scripts/lib/review-tests.js');
    const result = runSelectedReviewTests({
      repoRoot: fixture(), base: 'origin/main',
      spawn: stubSelector({
        ...passingSelection,
        runResults: [passingSelection.runResults[0]],
      }).spawn,
    });
    expect(result.passed).toBe(false);
    expect(result.testResults).toContainEqual(expect.objectContaining({
      pkg: 'test-selection', passed: false,
    }));
    expect(result.testResults.at(-1).failures.join(' ')).toMatch(/incomplete|missing/i);
  });

  test('full review forwards all-mode to selected suite discovery', () => {
    const { runSelectedReviewTests } = require('../scripts/lib/review-tests.js');
    const { spawn, calls } = stubSelector(passingSelection);
    runSelectedReviewTests({ repoRoot: fixture(), base: 'origin/main', all: true, spawn });
    expect(calls[0].args).toContain('--all');
  });
});

describe('review CLI wiring', () => {
  const reviewSource = () => fs.readFileSync(path.resolve(import.meta.dirname, '../scripts/review.js'), 'utf8');

  test('never falls back to linting and typechecking the entire tree for docs-only changes', () => {
    const source = reviewSource();
    expect(source).not.toContain('files.length > 0 ? files : getAllTsFiles(root)');
    expect(source).toContain('const eslintFiles = files;');
    expect(source).toContain('const typecheckFiles = files;');
  });

  test('structured review failures propagate a nonzero exit status and cache it', () => {
    const source = reviewSource();
    expect(source).toContain('const structuredExitCode =');
    expect(source).toContain('finishReviewRun(reviewRun, { ...captured, exitCode: structuredExitCode })');
    expect(source).toContain('process.exitCode = structuredExitCode;');
  });

  test('review delegates tests to selection, while --no-tests preserves verify ownership', () => {
    const source = reviewSource();
    expect(source).toContain('runSelectedReviewTests({ repoRoot: root, base, all: args.all })');
    expect(source).toContain('if (!args.noTests)');
    expect(source).not.toContain('jest.config.mjs');
    expect(source).not.toContain("execFileSync('npx', ['jest'");
  });
});

test('review --mine executes the reviewer from the target task worktree, not the source caller', () => {
  const taskRoot = fixture();
  const worktreeScript = path.join(taskRoot, 'packages/workspace/scripts/review.js');
  fs.mkdirSync(path.dirname(worktreeScript), { recursive: true });
  fs.writeFileSync(worktreeScript, "process.stdout.write('TASK_WORKTREE_REVIEW_EXECUTED');");
  const rootScript = path.resolve(import.meta.dirname, '../scripts/review.js');
  const child = spawnSync('bun', [rootScript, '--mine', '--json'], {
    cwd: path.resolve(import.meta.dirname, '../../..'),
    env: { ...process.env, TASK_WORKTREE: taskRoot },
    encoding: 'utf8',
    timeout: 30000,
  });
  expect(child.status, child.stderr).toBe(0);
  expect(child.stdout).toContain('TASK_WORKTREE_REVIEW_EXECUTED');
});

test('review implementation and test changes select the dedicated critical review suite', () => {
  const root = path.resolve(import.meta.dirname, '../../..');
  const rules = JSON.parse(fs.readFileSync(path.join(root, 'packages/workspace/test-selection.rules.json'), 'utf8'));
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'packages/workspace/test-selection.registry.json'), 'utf8'));
  for (const source of [rules.rules, registry.rules]) {
    const review = source.find((rule) => rule.id === 'workspace-review-run-modernization');
    expect(review).toBeDefined();
    expect(review.critical).toBe(true);
    for (const file of [
      'packages/workspace/scripts/review.js',
      'packages/workspace/scripts/lib/review-tests.js',
      'packages/workspace/scripts/lib/nx-projects.js',
      'packages/workspace/tests/review-modernization.test.js',
    ]) {
      expect(review.source).toContain(file);
    }
    expect(review.tests.some((suite) => suite.command.includes('packages/workspace/tests/review-modernization.test.js'))).toBe(true);
  }
});

test('Nx project lookup queries only the affected project, preserving inferred typecheck targets', () => {
  const { getProjectsWithTarget } = require('../scripts/lib/nx-projects.js');
  const root = fixture();
  const bin = path.join(root, 'node_modules', '.bin');
  fs.mkdirSync(bin, { recursive: true });
  for (const name of ['one', 'two']) {
    const pkgRoot = path.join(root, 'packages', name);
    fs.mkdirSync(pkgRoot, { recursive: true });
    fs.writeFileSync(path.join(pkgRoot, 'package.json'), JSON.stringify({ name: `@consuelo/${name}` }));
  }
  const log = path.join(root, 'nx-commands.log');
  const fakeNx = `#!/bin/sh
echo "$*" >> "${log}"
if [ "$1" = "show" ] && [ "$2" = "projects" ]; then
  echo '["@consuelo/one","@consuelo/two"]'
elif [ "$1" = "show" ] && [ "$2" = "project" ]; then
  case "$3" in
    "@consuelo/one") echo '{"name":"@consuelo/one","root":"packages/one","targets":{"typecheck":{}}}' ;;
    "@consuelo/two") echo '{"name":"@consuelo/two","root":"packages/two","targets":{"typecheck":{}}}' ;;
  esac
fi
`;
  fs.writeFileSync(path.join(bin, 'nx'), fakeNx, { mode: 0o755 });
  const projects = getProjectsWithTarget(root, ['packages/one/src/new.ts'], 'typecheck');

  expect(projects.map((project) => project.name)).toEqual(['@consuelo/one']);
  const commands = fs.readFileSync(log, 'utf8');
  expect(commands).toContain('show projects --json');
  expect(commands).toContain('show project @consuelo/one --json');
  expect(commands).not.toContain('show project @consuelo/two --json');
});

test('test selector all-mode selects unchanged code across packages, rather than diff-only tests', () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, 'packages', 'dialer', 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'packages', 'dialer', 'src', 'runtime.ts'), 'export const ready = true;\n');
  fs.writeFileSync(path.join(root, 'selection.json'), JSON.stringify({
    rules: [{
      id: 'dialer-selected',
      origin: 'explicit',
      critical: true,
      source: ['packages/dialer/**'],
      tests: [{ name: 'dialer Bun test', command: ['bun', 'test', 'packages/dialer/tests/runtime.test.ts'] }],
    }],
  }));
  const selector = path.resolve(import.meta.dirname, '../scripts/test-selection.js');
  const child = spawnSync('bun', [selector, 'check', '--all', '--registry', 'selection.json', '--json'], {
    cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024,
  });
  expect(child.status).toBe(0);
  const report = JSON.parse(child.stdout);
  expect(report.changedFiles).toContain('packages/dialer/src/runtime.ts');
  expect(report.selectedSuites.map((suite) => suite.name)).toEqual(['dialer Bun test']);
});
