import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ESLINT_BASELINE_PATH = path.join(
  SCRIPT_DIR,
  'twenty-server-eslint-baseline.json',
);
const TYPECHECK_BASELINE_PATH = path.join(
  SCRIPT_DIR,
  'twenty-server-typecheck-baseline.json',
);
const MIGRATION_BASELINE_PATH = path.join(
  SCRIPT_DIR,
  'twenty-server-migration-baseline.json',
);

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
    input: options.input,
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

export const eslintConfigForFile = (file) => {
  if (file.startsWith('packages/twenty-server/')) {
    return 'packages/twenty-server/eslint.config.mjs';
  }
  if (file.startsWith('packages/twenty-shared/')) {
    return 'packages/twenty-shared/eslint.config.mjs';
  }
  if (file.startsWith('packages/twenty-front/')) {
    return 'packages/twenty-front/eslint.config.mjs';
  }
  return undefined;
};

const isLintableFile = (file) => /\.(?:c|m)?[jt]sx?$/.test(file);

export const buildEslintArguments = (file) => [
  '--no-install',
  'eslint',
  '--format',
  'json',
  '--config',
  eslintConfigForFile(file),
  '--stdin',
  '--stdin-filename',
  file,
];

const processOutput = (result) =>
  [result.stdout ?? '', result.stderr ?? ''].filter(Boolean).join('\n');

export const parseEslintDiagnosticKeys = (output) => {
  const jsonStart = output.indexOf('[');
  const results = JSON.parse(jsonStart === -1 ? '[]' : output.slice(jsonStart));
  const diagnostics = [];

  for (const result of results) {
    const sourceLines = String(result.source ?? '').split('\n');
    for (const message of result.messages ?? []) {
      if (message.severity !== 2) continue;
      const normalizedMessage = String(message.message ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      const sourceLine = Number.isInteger(message.line)
        ? String(sourceLines[message.line - 1] ?? '')
            .replace(/\s+/g, ' ')
            .trim()
        : '';
      diagnostics.push(
        `${message.ruleId ?? 'fatal'}:${message.messageId ?? 'message'}:${normalizedMessage}:${sourceLine}`,
      );
    }
  }

  return diagnostics.sort();
};

const compareDiagnosticMultisets = (current, baseline) => {
  const remaining = new Map();
  for (const diagnostic of baseline) {
    remaining.set(diagnostic, (remaining.get(diagnostic) ?? 0) + 1);
  }

  const unexpected = [];
  for (const diagnostic of current) {
    const count = remaining.get(diagnostic) ?? 0;
    if (count > 0) {
      remaining.set(diagnostic, count - 1);
    } else {
      unexpected.push(diagnostic);
    }
  }

  const resolved = [];
  for (const [diagnostic, count] of remaining) {
    for (let index = 0; index < count; index += 1) {
      resolved.push(diagnostic);
    }
  }

  return { unexpected: unexpected.sort(), resolved: resolved.sort() };
};

export const compareEslintDiagnostics = (diagnostics, baseline) =>
  compareDiagnosticMultisets(diagnostics, baseline);

export const loadEslintBaseline = () => {
  const parsed = JSON.parse(readFileSync(ESLINT_BASELINE_PATH, 'utf8'));

  if (
    parsed?.version !== 1 ||
    !parsed.files ||
    typeof parsed.files !== 'object' ||
    Array.isArray(parsed.files) ||
    Object.values(parsed.files).some(
      (diagnostics) =>
        !Array.isArray(diagnostics) ||
        diagnostics.some((diagnostic) => typeof diagnostic !== 'string'),
    )
  ) {
    throw new Error('Twenty server ESLint baseline is invalid');
  }

  return Object.fromEntries(
    Object.entries(parsed.files).map(([file, diagnostics]) => [
      file,
      [...diagnostics].sort(),
    ]),
  );
};

const lintText = ({ file, source, runCommand }) => {
  const result = runCommand('npx', buildEslintArguments(file), {
    capture: true,
    input: source,
    env: {
      ...process.env,
      NX_DAEMON: 'false',
      NX_SKIP_NX_CACHE: 'true',
    },
  });
  const output = processOutput(result);
  let diagnostics;

  try {
    diagnostics = parseEslintDiagnosticKeys(result.stdout ?? '');
  } catch {
    throw new Error(
      `ESLint did not return JSON for ${file} (exit ${result.status}): ${output
        .trim()
        .slice(-2000)}`,
    );
  }

  if ((result.status ?? 0) > 1) {
    throw new Error(
      `ESLint failed to evaluate ${file} (exit ${result.status}): ${output
        .trim()
        .slice(-2000)}`,
    );
  }

  return diagnostics;
};

const readBaseFileFromGit = (file, base, runCommand) => {
  const result = runCommand('git', ['show', `${base}:${file}`], {
    capture: true,
  });
  return result.status === 0 ? result.stdout ?? '' : null;
};

export const runChangedFileLint = (
  files,
  {
    base,
    runCommand = run,
    readBaseFile = (file) => readBaseFileFromGit(file, base, runCommand),
    readCurrentFile = (file) => readFileSync(file, 'utf8'),
    lintBaseline,
  } = {},
) => {
  if (!base) {
    throw new Error('Server lint comparison requires a base revision');
  }

  const baselineByFile = lintBaseline ?? loadEslintBaseline();
  const regressions = [];
  for (const file of files) {
    if (!isLintableFile(file) || !eslintConfigForFile(file) || !existsSync(file)) {
      continue;
    }

    const baseSource = readBaseFile(file);
    const baselineDiagnostics =
      baseSource === null
        ? []
        : lintText({ file, source: baseSource, runCommand });
    const currentDiagnostics = lintText({
      file,
      source: readCurrentFile(file),
      runCommand,
    });
    const { unexpected: deltaDiagnostics } = compareEslintDiagnostics(
      currentDiagnostics,
      baselineDiagnostics,
    );
    const { unexpected } = compareEslintDiagnostics(
      deltaDiagnostics,
      baselineByFile[file] ?? [],
    );

    for (const diagnostic of unexpected) {
      regressions.push(`${file}:${diagnostic}`);
    }
  }

  if (regressions.length > 0) {
    throw new Error(
      `Changed server files introduced ${regressions.length} new ESLint diagnostics:\n${regressions
        .slice(0, 50)
        .join('\n')}`,
    );
  }
};

export const buildTypecheckArguments = () => [
  '--no-install',
  'tsc',
  '--pretty',
  'false',
  '--noEmit',
  '-p',
  'packages/twenty-server/tsconfig.json',
];

export const parseTypeScriptDiagnosticKeys = (output) => {
  const diagnostics = [];
  const pattern = /^(.+?)\((\d+),(\d+)\): error (TS\d+):/gm;

  for (const match of output.matchAll(pattern)) {
    const filePath = match[1].replaceAll('\\', '/').replace(/^\.\//, '');
    diagnostics.push(`${filePath}:${match[2]}:${match[3]}:${match[4]}`);
  }

  return [...new Set(diagnostics)].sort();
};

export const compareTypeScriptDiagnostics = (diagnostics, baseline) => {
  const current = new Set(diagnostics);
  const expected = new Set(baseline);

  return {
    unexpected: diagnostics.filter((diagnostic) => !expected.has(diagnostic)),
    resolved: baseline.filter((diagnostic) => !current.has(diagnostic)),
  };
};

export const loadTypecheckBaseline = () => {
  const parsed = JSON.parse(readFileSync(TYPECHECK_BASELINE_PATH, 'utf8'));

  if (
    parsed?.version !== 1 ||
    !Array.isArray(parsed.diagnostics) ||
    parsed.diagnostics.some((diagnostic) => typeof diagnostic !== 'string')
  ) {
    throw new Error('Twenty server TypeScript baseline is invalid');
  }

  return [...new Set(parsed.diagnostics)].sort();
};

export const runChangedServerTask = (
  files,
  runCommand = run,
  { base, lintRunner = runChangedFileLint, typecheckBaseline } = {},
) => {
  if (files.length === 0) {
    process.stdout.write(
      'No changed Twenty server runtime files require lint or typecheck.\n',
    );
    return;
  }

  process.stdout.write(
    `Running server lint and baseline-aware typecheck for ${files.length} directly changed file(s).\n`,
  );

  lintRunner(files, { base, runCommand });

  const typecheckResult = runCommand('npx', buildTypecheckArguments(), {
    capture: true,
    env: process.env,
  });
  const output = processOutput(typecheckResult);
  const diagnostics = parseTypeScriptDiagnosticKeys(output);
  const baseline = typecheckBaseline ?? loadTypecheckBaseline();
  const { unexpected, resolved } = compareTypeScriptDiagnostics(
    diagnostics,
    baseline,
  );

  if (unexpected.length > 0) {
    throw new Error(
      `Twenty server typecheck introduced ${unexpected.length} new TypeScript diagnostics:\n${unexpected
        .slice(0, 25)
        .join('\n')}`,
    );
  }

  if (typecheckResult.status !== 0 && diagnostics.length === 0) {
    throw new Error(
      `Twenty server typecheck failed without parseable diagnostics (exit ${typecheckResult.status}): ${output
        .trim()
        .slice(-2000)}`,
    );
  }

  if (diagnostics.length > 0) {
    process.stdout.write(
      `Twenty server typecheck matched ${diagnostics.length} known baseline diagnostic(s).\n`,
    );
  }
  if (resolved.length > 0) {
    process.stdout.write(
      `Twenty server typecheck baseline has ${resolved.length} resolved diagnostic(s) that can be removed.\n`,
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

export const parseMigrationUpQueries = (source) => {
  const upStart = source.indexOf('public async up(');
  const downStart = source.indexOf('public async down(', upStart);

  if (upStart === -1 || downStart === -1) {
    throw new Error('Generated migration does not contain recognizable up/down methods');
  }

  const upSource = source.slice(upStart, downStart);
  const queries = [];
  const queryPattern = /queryRunner\.query\(`([\s\S]*?)`\);/g;

  for (const match of upSource.matchAll(queryPattern)) {
    queries.push(match[1].replace(/\s+/g, ' ').trim());
  }

  return queries;
};

export const loadMigrationBaseline = () => {
  const parsed = JSON.parse(readFileSync(MIGRATION_BASELINE_PATH, 'utf8'));

  if (
    parsed?.version !== 1 ||
    !Array.isArray(parsed.queries) ||
    parsed.queries.some((query) => typeof query !== 'string')
  ) {
    throw new Error('Twenty server migration baseline is invalid');
  }

  return [...parsed.queries];
};

const migrationQueriesMatch = (current, baseline) => {
  if (current.length !== baseline.length) {
    return false;
  }

  const sortedCurrent = [...current].sort();
  const sortedBaseline = [...baseline].sort();

  return sortedCurrent.every(
    (query, index) => query === sortedBaseline[index],
  );
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
    readGeneratedFile = (file) => readFileSync(file, 'utf8'),
    migrationBaselineQueries,
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

  const generatedQueries = generatedFiles.flatMap((file) =>
    parseMigrationUpQueries(readGeneratedFile(file)),
  );
  const baselineQueries = migrationBaselineQueries ?? loadMigrationBaseline();
  const matchesBaseline = migrationQueriesMatch(generatedQueries, baselineQueries);

  for (const file of generatedFiles) {
    removeGeneratedFile(file);
  }

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (matchesBaseline) {
    process.stdout.write(
      `Twenty server migration drift matched ${generatedQueries.length} known baseline operation(s).\n`,
    );
    return;
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

  runChangedServerTask(files, run, { base: options.base });
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
