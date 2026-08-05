import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LINTABLE_EXTENSIONS = new Set([
  '.cjs',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.ts',
  '.tsx',
]);

export const FRONTEND_LINT_PROJECTS = [
  {
    project: 'twenty-front',
    root: 'packages/twenty-front',
    config: 'packages/twenty-front/eslint.config.mjs',
    maxWarnings: 0,
  },
  {
    project: 'twenty-ui',
    root: 'packages/twenty-ui',
    config: 'packages/twenty-ui/eslint.config.mjs',
  },
  {
    project: 'twenty-shared',
    root: 'packages/twenty-shared',
    config: 'packages/twenty-shared/eslint.config.mjs',
  },
  {
    project: 'twenty-sdk',
    root: 'packages/twenty-sdk',
    config: 'packages/twenty-sdk/eslint.config.mjs',
    maxWarnings: 0,
  },
];

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

export const parseCliArguments = (args, env = process.env) => ({
  base:
    readOption(args, '--base') ??
    env.NX_BASE ??
    (env.GITHUB_BASE_REF ? `origin/${env.GITHUB_BASE_REF}` : undefined),
  head: readOption(args, '--head') ?? env.NX_HEAD ?? 'HEAD',
  listOnly: args.includes('--list'),
});

const isLintableFile = (file) => LINTABLE_EXTENSIONS.has(path.extname(file));

export const groupChangedFrontendFiles = (
  files,
  fileExists = existsSync,
) =>
  FRONTEND_LINT_PROJECTS.map((project) => ({
    ...project,
    files: files
      .filter(
        (file) =>
          (file === project.root || file.startsWith(`${project.root}/`)) &&
          isLintableFile(file) &&
          fileExists(file),
      )
      .sort(),
  })).filter((project) => project.files.length > 0);

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

export const getChangedFrontendFiles = ({ base, head }) => {
  if (!base) {
    throw new Error(
      'Unable to resolve the lint base. Run nrwl/nx-set-shas first or pass --base.',
    );
  }

  const result = run(
    'git',
    [
      'diff',
      '--name-only',
      '--diff-filter=ACMRTUXB',
      base,
      head,
      '--',
      ...FRONTEND_LINT_PROJECTS.map(({ root }) => root),
    ],
    { capture: true },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    throw new Error(`git diff failed with exit code ${result.status}`);
  }

  return (result.stdout ?? '')
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
};

const chunk = (items, size) => {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

export const validateFrontendLintConfigs = async (
  projects = FRONTEND_LINT_PROJECTS,
) => {
  for (const { config } of projects) {
    try {
      await import(pathToFileURL(path.resolve(config)).href);
    } catch (error) {
      throw new Error(
        `Unable to import frontend ESLint config ${config}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
};

export const lintChangedFrontendFiles = (groups) => {
  for (const group of groups) {
    process.stdout.write(
      `Linting ${group.files.length} changed file(s) in ${group.root}\n`,
    );

    for (const files of chunk(group.files, 100)) {
      const args = [
        '--no-install',
        'nx',
        'run',
        `${group.project}:lint`,
        '--configuration=ci',
        '--skip-nx-cache',
        ...files.map((file) => `--lintFilePatterns=${file}`),
      ];

      const result = run('npx', args, {
        env: {
          ...process.env,
          NX_DAEMON: 'false',
          NX_SKIP_NX_CACHE: 'true',
        },
      });

      if (result.status !== 0) {
        throw new Error(
          `Nx lint failed for ${group.root} with exit code ${result.status}`,
        );
      }
    }
  }
};

export const main = async () => {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    await validateFrontendLintConfigs();
    const files = getChangedFrontendFiles(options);
    const groups = groupChangedFrontendFiles(files);

    if (groups.length === 0) {
      process.stdout.write('No changed frontend files require linting.\n');
      return;
    }

    if (options.listOnly) {
      process.stdout.write(
        `${JSON.stringify(
          groups.map(
            ({ project, root, config, maxWarnings, files: groupFiles }) => ({
              project,
              root,
              config,
              maxWarnings,
              files: groupFiles,
            }),
          ),
          null,
          2,
        )}\n`,
      );
      return;
    }

    lintChangedFrontendFiles(groups);
  } catch (error) {
    throw new Error(
      `Changed frontend lint failed: ${
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
    await main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
