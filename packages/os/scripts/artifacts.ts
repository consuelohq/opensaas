#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Effect } from 'effect';

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
import { publishDailyScheduleBundle } from './lib/daily-schedules-publisher';

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

const OPERATION_COMMANDS: Record<string, string> = {
  'generate.demo': 'generate-demo',
  'generate.digital-eguide': 'generate-digital-eguide',
  'generate.email': 'generate-email',
  'generate.image-brief': 'generate-image-brief',
  'generate.motion-frame': 'generate-motion-frame',
  'generate.website': 'generate-website',
  'design-system.get': 'get-design-system',
  'design-systems.list': 'list-design-systems',
  'skills.list': 'list-skills',
  'open-design.build': 'od:build',
  'railway.check': 'railway:check',
  'render.hyperframes': 'render-hyperframes',
  'ui.background': 'ui:bg',
  'ui.logs': 'ui:logs',
  'ui.status': 'ui:status',
  'ui.stop': 'ui:stop',
  'upstream.status': 'upstream-status',
};

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

function normalizeOperationArgs(args: ParsedArgs): ParsedArgs {
  const command = OPERATION_COMMANDS[args.command] ?? args.command;
  if (command === args.command) return args;
  return {
    ...args,
    command,
    raw: [command, ...args.raw.slice(1)],
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

type StoredTaskMeta = {
  taskSession?: string;
  taskBranch?: string;
  branch?: string;
  area?: string;
  worktreePath?: string;
  worktree?: string;
};

function taskWorkpadPath(meta: StoredTaskMeta): string | undefined {
  const worktree = meta.worktreePath ?? meta.worktree;
  const branch = meta.taskBranch ?? meta.branch;
  if (!worktree || !branch) return undefined;
  const parts = branch.split('/');
  if (parts[0] !== 'task' || !parts[1] || !parts[2]) return undefined;
  const area = String(meta.area ?? parts[1]).split('/').filter(Boolean).join('-');
  const slug = parts.slice(2).join('-');
  return path.join(worktree, '.task', area, slug, 'workpad.md');
}

function workpadForTaskSession(taskSession: string): string {
  const memoryDir = path.join(os.homedir(), '.kiro', 'workspace-tasks');
  if (!existsSync(memoryDir)) throw new Error(`task metadata directory is unavailable: ${memoryDir}`);
  for (const fileName of readdirSync(memoryDir)) {
    if (!fileName.endsWith('.json')) continue;
    try {
      const meta = JSON.parse(readFileSync(path.join(memoryDir, fileName), 'utf8')) as StoredTaskMeta;
      if (meta.taskSession !== taskSession) continue;
      const workpad = taskWorkpadPath(meta);
      if (!workpad || !existsSync(workpad) || !statSync(workpad).isFile()) {
        throw new Error(`generated task workpad is unavailable for ${taskSession}`);
      }
      return workpad;
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes(taskSession)) throw error;
    }
  }
  throw new Error(`no task metadata found for task session ${taskSession}`);
}

function resolveScheduleWorkpad(args: ParsedArgs): string {
  const explicit = value(args, '--workpad-file');
  if (explicit) return explicit;
  const taskSession = value(args, '--task-session');
  if (!taskSession) throw new Error('schedule.publish requires --task-session or --workpad-file');
  return workpadForTaskSession(taskSession);
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
    case 'schedule.publish': {
      const schedule = required(args, '--schedule');
      if (schedule !== 'security' && schedule !== 'self-healing') {
        throw new Error('--schedule must be security or self-healing');
      }
      const result = publishDailyScheduleBundle({
        home: args.home,
        schedule,
        reportFile: required(args, '--report-file'),
        workpadFile: resolveScheduleWorkpad(args),
        date: value(args, '--date'),
      });
      return {
        ok: true,
        output: result,
        text: `daily schedule published\nschedule: ${result.schedule}\ndate: ${result.date}\nindex: ${result.indexUrl}\n`,
      };
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
  const args = normalizeOperationArgs(parseArgs(argv));
  if (DESIGN_COMMANDS.has(args.command)) {
    const exitCode = await runDesignCommand(args.raw);
    return { ok: exitCode === 0, output: { exitCode }, text: '' };
  }
  return runDomainCommand(args);
}

export function runArtifactsEffect(argv: string[]) {
  return Effect.tryPromise({
    try: () => runArtifactsCli(argv),
    catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)),
  });
}

async function main(): Promise<void> {
  const args = normalizeOperationArgs(parseArgs(process.argv.slice(2)));
  try {
    const result = await Effect.runPromise(runArtifactsEffect(process.argv.slice(2)));
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
