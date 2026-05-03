#!/usr/bin/env bun

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const WORKSPACE_ROOT = path.resolve(path.dirname(CURRENT_FILE), '..');
const REPO_ROOT = path.resolve(WORKSPACE_ROOT, '../..');
const CONSUELO_DESIGN_ROOT = path.join(REPO_ROOT, 'packages/consuelo-design');
const OPEN_DESIGN_ROOT = path.join(CONSUELO_DESIGN_ROOT, 'upstream/open-design');

const DESIGN_SYSTEM_FILES = [
  { role: 'visual-design', path: 'packages/consuelo-website/DESIGN.md' },
  { role: 'motion-design', path: 'packages/consuelo-website/animations.md' },
  { role: 'website-agent-rules', path: 'packages/consuelo-website/AGENTS.md' },
  { role: 'design-tooling-agent-rules', path: 'packages/consuelo-design/AGENTS.md' },
] as const;

const WORKFLOWS = [
  { name: 'website', description: 'Website design and implementation work grounded in Consuelo DESIGN.md and GSAP animation rules.' },
  { name: 'demo', description: 'Demo artifact planning and design prompts for product walkthroughs and prototypes.' },
  { name: 'image', description: 'Image-generation briefs using Consuelo typography, color, spacing, and art-direction rules.' },
  { name: 'digital-eguide', description: 'Long-form digital e-guide structure, visual language, and production prompts.' },
  { name: 'email', description: 'Email design and content artifacts grounded in Consuelo design rules.' },
  { name: 'motion-frame', description: 'Motion frame briefs for GSAP, HyperFrames, and future video workflows.' },
] as const;

const DEPLOYMENT_DOCKERFILES = [
  'Dockerfile',
  'packages/twenty-docker/twenty/Dockerfile',
] as const;

const DEPLOYED_PACKAGE_MANIFESTS = [
  'packages/twenty-server/package.json',
  'packages/twenty-front/package.json',
  'packages/api/package.json',
  'packages/agent/package.json',
  'packages/coaching/package.json',
  'packages/contacts/package.json',
  'packages/dialer/package.json',
  'packages/logger/package.json',
  'packages/metering/package.json',
  'packages/sdk/package.json',
] as const;

type ParsedArgs = {
  command: string;
  json: boolean;
  quiet: boolean;
  dryRun: boolean;
  forwarded: string[];
};

function writeStdout(value: string): void {
  process.stdout.write(value);
}

function writeStderr(value: string): void {
  process.stderr.write(`${value}\n`);
}

function printJson(value: unknown): void {
  writeStdout(`${JSON.stringify(value, null, 2)}\n`);
}

function repoPath(relativePath: string): string {
  return path.join(REPO_ROOT, relativePath);
}

function readText(relativePath: string): string {
  return readFileSync(repoPath(relativePath), 'utf8');
}

function pathExists(relativePath: string): boolean {
  try {
    statSync(repoPath(relativePath));
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const forwarded: string[] = [];
  let command = 'help';
  let json = false;
  let quiet = false;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === '--json') {
      json = true;
    } else if (arg === '--quiet') {
      quiet = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--')) {
      forwarded.push(arg);
    } else if (command === 'help') {
      command = arg;
    } else {
      forwarded.push(arg);
    }
  }

  return { command, json, quiet, dryRun, forwarded };
}

function requireOpenDesign(): void {
  if (!existsSync(OPEN_DESIGN_ROOT)) {
    throw new Error(`missing vendored Open Design root: ${path.relative(REPO_ROOT, OPEN_DESIGN_ROOT)}`);
  }
}

function getDesignSystem(args: ParsedArgs): void {
  const files = DESIGN_SYSTEM_FILES.map((file) => ({ ...file, content: readText(file.path) }));
  if (args.json) {
    printJson({
      name: 'consuelo-design-system',
      policy: 'Consuelo uses repo-local DESIGN.md, animations.md, and AGENTS.md files as the design system. Upstream Open Design design-system registries are vendored reference material, not Consuelo truth.',
      files,
    });
    return;
  }

  for (const file of files) {
    writeStdout('\n---\n');
    writeStdout(`# ${file.role}: ${file.path}\n\n`);
    writeStdout(file.content);
    if (!file.content.endsWith('\n')) writeStdout('\n');
  }
}

function workflows(args: ParsedArgs): void {
  if (args.json) {
    printJson({ workflows: WORKFLOWS });
    return;
  }

  for (const workflow of WORKFLOWS) {
    writeStdout(`${workflow.name}: ${workflow.description}\n`);
  }
}

function upstreamStatus(args: ParsedArgs): void {
  requireOpenDesign();
  const upstreamPackagePath = 'packages/consuelo-design/upstream/open-design/package.json';
  const packageJson = JSON.parse(readText(upstreamPackagePath)) as {
    name?: string;
    version?: string;
    license?: string;
    packageManager?: string;
    engines?: { node?: string; pnpm?: string };
  };
  const data = {
    path: 'packages/consuelo-design/upstream/open-design',
    packageName: packageJson.name ?? null,
    version: packageJson.version ?? null,
    license: packageJson.license ?? null,
    packageManager: packageJson.packageManager ?? null,
    nodeEngine: packageJson.engines?.node ?? null,
    pnpmEngine: packageJson.engines?.pnpm ?? null,
    hasLicense: pathExists('packages/consuelo-design/upstream/open-design/LICENSE'),
    hasReadme: pathExists('packages/consuelo-design/upstream/open-design/README.md'),
    hasGitMetadata: pathExists('packages/consuelo-design/upstream/open-design/.git'),
  };

  if (args.json) {
    printJson(data);
    return;
  }

  for (const [key, value] of Object.entries(data)) writeStdout(`${key}: ${String(value)}\n`);
}

function railwayCheck(args: ParsedArgs): void {
  const failures: string[] = [];

  for (const dockerfile of DEPLOYMENT_DOCKERFILES) {
    const content = readText(dockerfile);
    if (content.includes('consuelo-design')) failures.push(`${dockerfile} references consuelo-design`);
  }

  for (const manifestPath of DEPLOYED_PACKAGE_MANIFESTS) {
    if (!pathExists(manifestPath)) continue;
    const manifest = JSON.parse(readText(manifestPath)) as Record<string, Record<string, string> | undefined>;
    for (const group of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      const dependencies = manifest[group];
      if (dependencies?.['consuelo-design'] || dependencies?.['@consuelo/design']) {
        failures.push(`${manifestPath} ${group} references consuelo-design`);
      }
    }
  }

  const result = {
    ok: failures.length === 0,
    checkedDockerfiles: DEPLOYMENT_DOCKERFILES,
    checkedPackageManifests: DEPLOYED_PACKAGE_MANIFESTS,
    failures,
  };

  if (args.json) printJson(result);
  else if (result.ok && !args.quiet) writeStdout('Railway exclusion check passed.\n');
  else failures.forEach(writeStderr);

  if (!result.ok) process.exit(1);
}

function check(args: ParsedArgs): void {
  const requiredPaths = [
    'packages/consuelo-design/package.json',
    'packages/consuelo-design/AGENTS.md',
    'packages/consuelo-design/README.md',
    'packages/consuelo-design/RAILWAY.md',
    'packages/consuelo-design/UPSTREAM.md',
    'packages/consuelo-design/upstream/open-design/package.json',
    'packages/consuelo-design/upstream/open-design/LICENSE',
    ...DESIGN_SYSTEM_FILES.map((file) => file.path),
  ];
  const missingPaths = requiredPaths.filter((relativePath) => !pathExists(relativePath));
  const result = {
    ok: missingPaths.length === 0 && !pathExists('packages/consuelo-design/upstream/open-design/.git'),
    missingPaths,
    hasNestedGitMetadata: pathExists('packages/consuelo-design/upstream/open-design/.git'),
    designSystemFiles: DESIGN_SYSTEM_FILES,
    workflows: WORKFLOWS.map((workflow) => workflow.name),
  };

  if (args.json) printJson(result);
  else if (result.ok && !args.quiet) writeStdout('consuelo-design check passed.\n');
  else {
    if (result.missingPaths.length > 0) writeStderr(`missing paths:\n${result.missingPaths.join('\n')}`);
    if (result.hasNestedGitMetadata) writeStderr('packages/consuelo-design/upstream/open-design/.git should not be committed.');
  }

  if (!result.ok) process.exit(1);
}

async function runUpstream(label: string, command: string[], args: ParsedArgs): Promise<void> {
  try {
    requireOpenDesign();
    if (args.dryRun) {
      const plan = { cwd: OPEN_DESIGN_ROOT, command };
      if (args.json) printJson(plan);
      else writeStdout(`${label}: ${command.join(' ')}\ncwd: ${path.relative(REPO_ROOT, OPEN_DESIGN_ROOT)}\n`);
      return;
    }

    const processResult = Bun.spawn(command, {
      cwd: OPEN_DESIGN_ROOT,
      stdout: 'inherit',
      stderr: 'inherit',
      stdin: 'inherit',
    });
    const exitCode = await processResult.exited;
    process.exit(exitCode);
  } catch (error: unknown) {
    writeStderr(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function uiCommand(command: string, args: ParsedArgs): Promise<void> {
  switch (command) {
    case 'ui':
      return runUpstream('Open Design UI foreground', ['corepack', 'pnpm', 'tools-dev', 'run', 'web', ...args.forwarded], args);
    case 'ui:bg':
      return runUpstream('Open Design UI background', ['corepack', 'pnpm', 'tools-dev', ...args.forwarded], args);
    case 'ui:stop':
      return runUpstream('Open Design UI stop', ['corepack', 'pnpm', 'tools-dev', 'stop', ...args.forwarded], args);
    case 'ui:status':
      return runUpstream('Open Design UI status', ['corepack', 'pnpm', 'tools-dev', 'status', ...args.forwarded], args);
    case 'ui:logs':
      return runUpstream('Open Design UI logs', ['corepack', 'pnpm', 'tools-dev', 'logs', ...args.forwarded], args);
    case 'od:build':
      return runUpstream('Open Design daemon CLI build', ['corepack', 'pnpm', '--filter', '@open-design/daemon', 'build', ...args.forwarded], args);
    default:
      throw new Error(`unknown ui command: ${command}`);
  }
}

function help(): void {
  writeStdout(`consuelo-design

Bun-first Consuelo facade over vendored Open Design.

Commands:
  get-design-system   Print Consuelo DESIGN.md, animations.md, and AGENTS.md design context
  workflows           List Consuelo design workflow names
  upstream-status     Show vendored Open Design metadata
  railway:check       Verify consuelo-design is excluded from Railway deploy paths
  check               Run package boundary checks
  ui                  Start Open Design daemon + web in foreground
  ui:bg               Start Open Design managed runtimes in background
  ui:stop             Stop Open Design managed runtimes
  ui:status           Show Open Design managed runtime status
  ui:logs             Show Open Design managed runtime logs
  od:build            Build the Open Design daemon CLI

Flags:
  --json              Print structured JSON where supported
  --quiet             Suppress success text where supported
  --dry-run           Print the upstream command instead of running it

Notes:
  The Consuelo facade is Bun-native and lives in packages/workspace/scripts.
  pnpm is only used behind this facade because upstream Open Design pins pnpm@10.33.2.
`);
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    switch (args.command) {
      case 'get-design-system':
        getDesignSystem(args);
        break;
      case 'workflows':
        workflows(args);
        break;
      case 'upstream-status':
        upstreamStatus(args);
        break;
      case 'railway:check':
      case 'railway-check':
        railwayCheck(args);
        break;
      case 'check':
        check(args);
        break;
      case 'ui':
      case 'ui:bg':
      case 'ui:stop':
      case 'ui:status':
      case 'ui:logs':
      case 'od:build':
        await uiCommand(args.command, args);
        break;
      case 'help':
      case '-h':
      case '--help':
        help();
        break;
      default:
        writeStderr(`unknown command: ${args.command}`);
        help();
        process.exit(1);
    }
  } catch (error: unknown) {
    writeStderr(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  writeStderr(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
