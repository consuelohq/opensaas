import { spawnSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER_TASK_ROOTS = [
  'packages/twenty-server',
  'packages/twenty-shared',
  'packages/twenty-front/src/generated',
  'packages/twenty-front/src/generated-metadata',
];

export const GRAPHQL_GENERATION_ROOTS = [
  'packages/twenty-server',
  'packages/twenty-front/src/generated',
  'packages/twenty-front/src/generated-metadata',
];

export const SERVER_CONFIG_ONLY_FILES = new Set([
  'packages/twenty-server/project.json',
  'packages/twenty-shared/eslint.config.mjs',
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

export const parseCliArguments = (args, env = process.env) => ({
  base:
    readOption(args, '--base') ??
    env.NX_BASE ??
    (env.GITHUB_BASE_REF ? `origin/${env.GITHUB_BASE_REF}` : undefined),
  head: readOption(args, '--head') ?? env.NX_HEAD ?? 'HEAD',
  listOnly: args.includes('--list'),
  graphql: args.includes('--graphql'),
  migrations: args.includes('--migrations'),
});

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

export const filterServerTaskFiles = (files) =>
  [
    ...new Set(
      files
        .map((file) => file.trim())
        .filter(Boolean)
        .filter((file) =>
          SERVER_TASK_ROOTS.some(
            (root) => file === root || file.startsWith(`${root}/`),
          ),
        )
        .filter((file) => !SERVER_CONFIG_ONLY_FILES.has(file)),
    ),
  ].sort();

export const filterGraphqlGenerationFiles = (files) =>
  [
    ...new Set(
      files
        .map((file) => file.trim())
        .filter(Boolean)
        .filter((file) =>
          GRAPHQL_GENERATION_ROOTS.some(
            (root) => file === root || file.startsWith(`${root}/`),
          ),
        )
        .filter((file) => !SERVER_CONFIG_ONLY_FILES.has(file)),
    ),
  ].sort();

export const getChangedServerTaskFiles = ({ base, head }) => {
  if (!base) {
    throw new Error(
      'Unable to resolve the server task base. Pass --base or provide NX_BASE/GITHUB_BASE_REF.',
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
      ...SERVER_TASK_ROOTS,
    ],
    { capture: true },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    throw new Error(`git diff failed with exit code ${result.status}`);
  }

  return filterServerTaskFiles((result.stdout ?? '').split('\n'));
};

export const getChangedGraphqlGenerationFiles = ({ base, head }) => {
  if (!base) {
    throw new Error(
      'Unable to resolve the GraphQL generation base. Pass --base or provide NX_BASE/GITHUB_BASE_REF.',
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
      ...GRAPHQL_GENERATION_ROOTS,
    ],
    { capture: true },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    throw new Error(`git diff failed with exit code ${result.status}`);
  }

  return filterGraphqlGenerationFiles((result.stdout ?? '').split('\n'));
};

export const buildNxArguments = ({ files }) => [
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
  files.join(','),
];

export const runChangedServerTask = (files, runCommand = run) => {
  if (files.length === 0) {
    process.stdout.write(
      'No changed Twenty server runtime files require lint or typecheck.\n',
    );
    return;
  }

  process.stdout.write(
    `Running server lint and typecheck for ${files.length} directly changed file(s).\n`,
  );

  const result = runCommand('npx', buildNxArguments({ files }), {
    env: {
      ...process.env,
      NX_DAEMON: 'false',
      NX_SKIP_NX_CACHE: 'true',
    },
  });

  if (result.status !== 0) {
    throw new Error(
      `Nx server lint and typecheck failed with exit code ${result.status}`,
    );
  }
};

export const runGraphqlGenerationCheck = (files, runCommand = run) => {
  if (files.length === 0) {
    process.stdout.write(
      'No changed Twenty server schema files require GraphQL generation.\n',
    );
    return;
  }

  const commands = [
    ['npx', ['--no-install', 'nx', 'run', 'twenty-front:graphql:generate']],
    [
      'npx',
      [
        '--no-install',
        'nx',
        'run',
        'twenty-front:graphql:generate',
        '--configuration=metadata',
      ],
    ],
    [
      'git',
      [
        'diff',
        '--quiet',
        '--',
        'packages/twenty-front/src/generated',
        'packages/twenty-front/src/generated-metadata',
      ],
    ],
  ];

  for (const [command, args] of commands) {
    const result = runCommand(command, args, {
      env: {
        ...process.env,
        NX_DAEMON: 'false',
        NX_SKIP_NX_CACHE: 'true',
      },
    });

    if (result.status !== 0) {
      if (command === 'git') {
        runCommand(
          'git',
          [
            'diff',
            '--',
            'packages/twenty-front/src/generated',
            'packages/twenty-front/src/generated-metadata',
          ],
          {},
        );
        throw new Error(
          'GraphQL schema changes detected. Regenerate and commit the GraphQL outputs.',
        );
      }

      throw new Error(
        `GraphQL generation failed with exit code ${result.status}`,
      );
    }
  }
};

const defaultListGeneratedMigrationFiles = () =>
  readdirSync('packages/twenty-server')
    .filter((file) => file.endsWith('-core-migration-check.ts'))
    .map((file) => `packages/twenty-server/${file}`);

export const runMigrationGenerationCheck = (
  files,
  {
    runCommand = run,
    listGeneratedFiles = defaultListGeneratedMigrationFiles,
    removeGeneratedFile = (file) => rmSync(file, { force: true }),
  } = {},
) => {
  if (files.length === 0) {
    process.stdout.write(
      'No changed Twenty server runtime files require migration generation.\n',
    );
    return;
  }

  const result = runCommand(
    'npx',
    [
      '--no-install',
      'nx',
      'run',
      'twenty-server:typeorm',
      'migration:generate',
      'core-migration-check',
      '-d',
      'src/database/typeorm/core/core.datasource.ts',
    ],
    {
      capture: true,
      env: {
        ...process.env,
        NX_DAEMON: 'false',
        NX_SKIP_NX_CACHE: 'true',
      },
    },
  );

  const generatedFiles = listGeneratedFiles();

  if (generatedFiles.length === 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    return;
  }

  for (const file of generatedFiles) {
    removeGeneratedFile(file);
  }

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  throw new Error(
    'Unexpected migration files were generated. Please create a proper migration manually.',
  );
};

export const main = () => {
  const options = parseCliArguments(process.argv.slice(2));
  const files = options.graphql
    ? getChangedGraphqlGenerationFiles(options)
    : getChangedServerTaskFiles(options);

  if (options.listOnly) {
    process.stdout.write(`${JSON.stringify({ files }, null, 2)}\n`);
    return;
  }

  if (options.graphql) {
    runGraphqlGenerationCheck(files);
    return;
  }

  if (options.migrations) {
    runMigrationGenerationCheck(files);
    return;
  }

  runChangedServerTask(files);
};

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `Changed server task failed: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    process.exitCode = 1;
  }
}
