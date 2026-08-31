import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRONTEND_TASK_ROOTS = [
  'packages/twenty-front',
  'packages/twenty-ui',
  'packages/twenty-shared',
  'packages/twenty-sdk',
];

export const FRONTEND_CONFIG_ONLY_FILES = new Set([
  'packages/twenty-front/eslint.config.mjs',
  'packages/twenty-ui/eslint.config.mjs',
  'packages/twenty-shared/eslint.config.mjs',
  'packages/twenty-sdk/eslint.config.mjs',
]);

const SUPPORTED_TASKS = new Set(['test', 'typecheck']);

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

export const parseCliArguments = (args, env = process.env) => {
  const task = readOption(args, '--task');

  if (!task || !SUPPORTED_TASKS.has(task)) {
    throw new Error('Pass --task test or --task typecheck.');
  }

  return {
    task,
    base:
      readOption(args, '--base') ??
      env.NX_BASE ??
      (env.GITHUB_BASE_REF ? `origin/${env.GITHUB_BASE_REF}` : undefined),
    head: readOption(args, '--head') ?? env.NX_HEAD ?? 'HEAD',
    listOnly: args.includes('--list'),
  };
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: options.env ?? process.env,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
};

export const filterFrontendTaskFiles = (files) =>
  [
    ...new Set(
      files
        .map((file) => file.trim())
        .filter(Boolean)
        .filter((file) =>
          FRONTEND_TASK_ROOTS.some(
            (root) => file === root || file.startsWith(`${root}/`),
          ),
        )
        .filter((file) => !FRONTEND_CONFIG_ONLY_FILES.has(file)),
    ),
  ].sort();

export const getChangedFrontendTaskFiles = ({ base, head }) => {
  if (!base) {
    throw new Error(
      'Unable to resolve the frontend task base. Run nrwl/nx-set-shas first or pass --base.',
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
      '--',
      ...FRONTEND_TASK_ROOTS,
    ],
    { capture: true },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    throw new Error(`git diff failed with exit code ${result.status}`);
  }

  return filterFrontendTaskFiles((result.stdout ?? '').split('\n'));
};

export const buildNxArguments = ({ task, files }) => [
  '--no-install',
  'nx',
  'affected',
  '--nxBail',
  '--configuration=ci',
  `-t=${task}`,
  '--parallel=3',
  '--exclude=*,!tag:scope:frontend',
  '--skip-nx-cache',
  '--files',
  files.join(','),
];

export const runChangedFrontendTask = ({ task, files }, runCommand = run) => {
  if (files.length === 0) {
    process.stdout.write(
      `No changed frontend runtime files require ${task}.\n`,
    );
    return;
  }

  process.stdout.write(
    `Running frontend ${task} for ${files.length} directly changed file(s).\n`,
  );

  const result = runCommand('npx', buildNxArguments({ task, files }), {
    env: {
      ...process.env,
      NX_DAEMON: 'false',
      NX_SKIP_NX_CACHE: 'true',
    },
  });

  if (result.status !== 0) {
    throw new Error(
      `Nx frontend ${task} failed with exit code ${result.status}`,
    );
  }
};

export const main = () => {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    const files = getChangedFrontendTaskFiles(options);

    if (options.listOnly) {
      process.stdout.write(
        `${JSON.stringify({ task: options.task, files }, null, 2)}\n`,
      );
      return;
    }

    runChangedFrontendTask({ task: options.task, files });
  } catch (error) {
    throw new Error(
      `Changed frontend task failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

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
