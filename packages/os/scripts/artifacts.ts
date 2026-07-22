#!/usr/bin/env bun

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getArtifact,
  importLegacyArtifactArchive,
  listArtifactVersions,
  publishArtifact,
  readArtifactCatalog,
  refreshArtifactsSite,
  rollbackArtifact,
} from './lib/artifacts';
import { resolveConsueloHome } from './lib/consuelo-home';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DESIGN_SCRIPT = path.join(SCRIPT_DIR, 'artifacts-design.ts');
const DESIGN_COMMANDS = new Set([
  'run',
  'ui',
  'ui:bg',
  'ui:stop',
  'ui:status',
  'ui:logs',
  'od:build',
  'generate',
  'generate-website',
  'generate-demo',
  'generate-image-brief',
  'generate-digital-eguide',
  'generate-email',
  'generate-motion-frame',
  'render',
  'render-hyperframes',
  'get-design-system',
  'list-skills',
  'workflows',
  'list-design-systems',
  'upstream-status',
  'railway:check',
  'railway-check',
]);

type ParsedArgs = {
  command: string;
  json: boolean;
  quiet: boolean;
  home: string;
  values: Map<string, string>;
  flags: Set<string>;
  raw: string[];
};

type CommandResult = {
  ok: boolean;
  output: unknown;
  text: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument.startsWith('--')) {
      const next = argv[index + 1];
      if (next && !next.startsWith('--')) {
        values.set(argument, next);
        index += 1;
      } else {
        flags.add(argument);
      }
    } else {
      positional.push(argument);
    }
  }
  return {
    command: positional[0] ?? 'help',
    json: flags.has('--json'),
    quiet: flags.has('--quiet'),
    home: resolveConsueloHome(values.get('--home')),
    values,
    flags,
    raw: argv,
  };
}

function value(args: ParsedArgs, name: string): string | undefined {
  return args.values.get(name);
}

function required(args: ParsedArgs, name: string): string {
  const result = value(args, name);
  if (!result) throw new Error(`${name} is required`);
  return result;
}

function title(args: ParsedArgs): string {
  return value(args, '--title') ?? value(args, '--name') ?? required(args, '--title');
}

function safeJson(valueToRender: unknown): string {
  return `${JSON.stringify(valueToRender, null, 2)}\n`;
}

function usage(): string {
  return [
    'artifacts',
    '',
    'Canonical Consuelo artifact generation, publishing, catalog, and history CLI.',
    '',
    'Commands:',
    '  publish --target <file|dir> --path <route> --title <title> [--category <name>] [--template <name>]',
    '  refresh',
    '  list',
    '  get --id <artifact-id>',
    '  history --id <artifact-id>',
    '  rollback --id <artifact-id> --version-id <version-id> [--reason <text>]',
    '  migrate-legacy-archive --source <legacy-archive-root>',
    '  check',
    '  generate-website|generate-digital-eguide|generate-email|generate-motion-frame [design flags]',
    '  run|ui:bg|ui:status|ui:logs|ui:stop|od:build',
    '',
    'Common flags:',
    '  --home <path>            Override Consuelo home',
    '  --json                   Print JSON',
    '  --quiet                  Suppress success text',
    '',
  ].join('\n');
}

function runDomainCommand(args: ParsedArgs): CommandResult {
  switch (args.command) {
    case 'publish': {
      const result = publishArtifact({
        home: args.home,
        target: required(args, '--target'),
        path: required(args, '--path'),
        title: title(args),
        category: value(args, '--category'),
        template: value(args, '--template'),
        baseVersion: value(args, '--base-version') ?? value(args, '--base-revision'),
        forcePublish: args.flags.has('--force-publish'),
        traceId: value(args, '--trace-id'),
        skillName: value(args, '--skill-name'),
        reason: value(args, '--reason'),
      });
      return {
        ok: true,
        output: result,
        text: `artifact published\nid: ${result.artifact.id}\npath: /artifacts${result.artifact.path}\nversion: ${result.version.versionId}\n`,
      };
    }
    case 'refresh': {
      const catalog = readArtifactCatalog(args.home);
      const siteIndexPath = refreshArtifactsSite(args.home, catalog);
      return {
        ok: true,
        output: { catalog, siteIndexPath },
        text: `artifacts refreshed\nindex: ${siteIndexPath}\nentries: ${catalog.entries.length}\n`,
      };
    }
    case 'list': {
      const catalog = readArtifactCatalog(args.home);
      return {
        ok: true,
        output: { updatedAt: catalog.updatedAt, artifacts: catalog.entries },
        text: catalog.entries.length > 0
          ? `${catalog.entries.map((entry) => `${entry.id} ${entry.path} ${entry.title}`).join('\n')}\n`
          : 'No artifacts published.\n',
      };
    }
    case 'get': {
      const artifactId = required(args, '--id');
      const artifact = getArtifact(args.home, artifactId);
      if (!artifact) throw new Error(`artifact not found: ${artifactId}`);
      return { ok: true, output: { artifact }, text: `${artifact.id} ${artifact.path} ${artifact.currentVersionId}\n` };
    }
    case 'history': {
      const artifactId = required(args, '--id');
      const versions = listArtifactVersions(args.home, artifactId);
      const artifact = getArtifact(args.home, artifactId);
      const lines = [`artifact ${artifactId}`, 'version current updated reason sha path'];
      for (const version of versions) {
        lines.push([
          version.versionId,
          version.versionId === artifact?.currentVersionId ? '*' : '-',
          version.updatedAt,
          version.reason,
          version.contentSha256.slice(0, 12),
          version.storageKey,
        ].join(' '));
      }
      return { ok: true, output: { artifactId, versions }, text: `${lines.join('\n')}\n` };
    }
    case 'rollback': {
      const result = rollbackArtifact({
        home: args.home,
        artifactId: required(args, '--id'),
        versionId: required(args, '--version-id'),
        reason: value(args, '--reason'),
        traceId: value(args, '--trace-id'),
        skillName: value(args, '--skill-name'),
      });
      return {
        ok: true,
        output: result,
        text: `artifact rolled back\nid: ${result.artifact.id}\nversion: ${result.version.versionId}\nrestoredFrom: ${result.version.restoredFromVersionId}\n`,
      };
    }
    case 'migrate-legacy-archive': {
      const result = importLegacyArtifactArchive({
        home: args.home,
        sourceRoot: required(args, '--source'),
      });
      return {
        ok: true,
        output: result,
        text: `legacy artifact archive imported\nartifacts: ${result.artifacts}\nversions: ${result.versions}\nfiles: ${result.files}\n`,
      };
    }
    case 'check': {
      const catalog = readArtifactCatalog(args.home);
      const missing = Object.values(catalog.artifacts).flatMap((artifact) => artifact.versions
        .filter((version) => !existsSync(version.localPath) || !statSync(version.localPath).isFile())
        .map((version) => version.localPath));
      const output = { ok: missing.length === 0, artifacts: catalog.entries.length, missing };
      if (missing.length > 0) throw new Error(`artifact files missing: ${missing.join(', ')}`);
      return { ok: true, output, text: `artifacts check passed\nartifacts: ${catalog.entries.length}\n` };
    }
    case 'help':
    case '-h':
    case '--help':
      return { ok: true, output: null, text: usage() };
    default:
      throw new Error(`unknown artifacts command: ${args.command}`);
  }
}

async function runDesignCommand(rawArgs: string[]): Promise<number> {
  const child = Bun.spawn(['bun', DESIGN_SCRIPT, ...rawArgs], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });
  return await child.exited;
}

export async function runArtifactsCli(argv: string[]): Promise<CommandResult> {
  const args = parseArgs(argv);
  if (DESIGN_COMMANDS.has(args.command)) {
    const exitCode = await runDesignCommand(argv);
    return { ok: exitCode === 0, output: { exitCode }, text: '' };
  }
  return runDomainCommand(args);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  try {
    if (DESIGN_COMMANDS.has(args.command)) {
      process.exitCode = await runDesignCommand(args.raw);
      return;
    }
    const result = runDomainCommand(args);
    if (args.json) process.stdout.write(safeJson(result.output));
    else if (!args.quiet) process.stdout.write(result.text);
    if (!result.ok) process.exitCode = 1;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (args.json) process.stdout.write(safeJson({ ok: false, error: { code: 'ARTIFACTS_COMMAND_FAILED', message } }));
    else process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await main();
}
