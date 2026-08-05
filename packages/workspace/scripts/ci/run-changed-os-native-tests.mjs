import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), '../../../..');
const osPackageRoot = path.join(repoRoot, 'packages/os');

const ARTIFACT_CLEANUP_FILE = 'packages/os/scripts/artifacts-design.ts';

export const FOCUSED_NATIVE_ARTIFACT_FILES = new Set([
  ARTIFACT_CLEANUP_FILE,
  'packages/os/tests/artifacts-legacy-contract.test.ts',
  '.github/workflows/consuelo-os-distribution-environments.yaml',
  'packages/workspace/scripts/ci/run-changed-os-native-tests.mjs',
  'packages/workspace/tests/run-changed-os-native-tests.test.mjs',
  'packages/workspace/tests/github-workflow-policy.test.js',
]);

const NATIVE_TEST_OWNERSHIP_FILES = new Set([
  '.github/workflows/consuelo-os-distribution-environments.yaml',
  'packages/workspace/scripts/ci/run-changed-os-native-tests.mjs',
  'packages/workspace/tests/run-changed-os-native-tests.test.mjs',
  'packages/workspace/tests/github-workflow-policy.test.js',
]);

const readOption = (args, name) => {
  const index = args.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];

  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
};

const normalizeGitRef = (value) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  if (normalized.length === 0 || /^0+$/.test(normalized)) {
    return undefined;
  }

  return normalized;
};

export const parseCliArguments = (args, env = process.env) => ({
  base:
    normalizeGitRef(readOption(args, '--base')) ??
    normalizeGitRef(env.NATIVE_TEST_BASE) ??
    normalizeGitRef(env.NX_BASE) ??
    normalizeGitRef(
      env.GITHUB_BASE_REF ? `origin/${env.GITHUB_BASE_REF}` : undefined,
    ) ??
    'HEAD^1',
  head:
    normalizeGitRef(readOption(args, '--head')) ??
    normalizeGitRef(env.NATIVE_TEST_HEAD) ??
    normalizeGitRef(env.NX_HEAD) ??
    'HEAD',
  listOnly: args.includes('--list'),
});

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: options.env ?? process.env,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
};

export const filterRelevantNativeFiles = (files) =>
  [
    ...new Set(
      files
        .map((file) => file.trim())
        .filter(Boolean)
        .filter(
          (file) =>
            file.startsWith('packages/os/') ||
            NATIVE_TEST_OWNERSHIP_FILES.has(file),
        ),
    ),
  ].sort();

export const getChangedNativeFiles = ({ base, head }) => {
  if (!base) {
    throw new Error(
      'Unable to resolve the native OS test base. Run nrwl/nx-set-shas first or pass --base.',
    );
  }

  const result = run(
    'git',
    [
      'diff',
      '--name-only',
      '--diff-filter=ACDMRTUXB',
      base,
      head,
    ],
    { capture: true },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    throw new Error(`git diff failed with exit code ${result.status}`);
  }

  return filterRelevantNativeFiles((result.stdout ?? '').split('\n'));
};

export const selectNativeTestPlan = (files) => {
  const relevantFiles = filterRelevantNativeFiles(files);
  const hasArtifactCleanup = relevantFiles.includes(ARTIFACT_CLEANUP_FILE);
  const isExactArtifactCleanup =
    hasArtifactCleanup &&
    relevantFiles.every((file) => FOCUSED_NATIVE_ARTIFACT_FILES.has(file));

  return isExactArtifactCleanup ? 'focused-artifact' : 'full-distribution';
};

export const buildNativeTestInvocation = (plan) => {
  if (plan === 'focused-artifact') {
    return {
      plan,
      command: 'bun',
      args: [
        'x',
        'vitest',
        'run',
        'tests/artifacts-legacy-contract.test.ts',
      ],
      cwd: osPackageRoot,
    };
  }

  return {
    plan: 'full-distribution',
    command: 'bun',
    args: [
      'x',
      'vitest',
      'run',
      'tests/distribution',
      '--testTimeout',
      '15000',
    ],
    cwd: osPackageRoot,
  };
};

export const runSelectedNativeTests = (invocation, runCommand = run) => {
  process.stdout.write(`Running ${invocation.plan} native OS test plan.\n`);

  const result = runCommand(invocation.command, invocation.args, {
    cwd: invocation.cwd,
    env: {
      ...process.env,
      CI: '1',
      NX_DAEMON: 'false',
      NX_SKIP_NX_CACHE: 'true',
    },
  });

  if (result.status !== 0) {
    throw new Error(
      `${invocation.plan} native OS tests failed with exit code ${result.status}`,
    );
  }
};

export const main = () => {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    const files = getChangedNativeFiles(options);
    const plan = selectNativeTestPlan(files);
    const invocation = buildNativeTestInvocation(plan);

    if (options.listOnly) {
      process.stdout.write(
        `${JSON.stringify({ plan, files, command: [invocation.command, ...invocation.args] }, null, 2)}\n`,
      );
      return;
    }

    runSelectedNativeTests(invocation);
  } catch (error) {
    throw new Error(
      `Changed native OS test selection failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === currentFile;

if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
