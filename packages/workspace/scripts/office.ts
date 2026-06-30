#!/usr/bin/env bun

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const WORKSPACE_ROOT = path.resolve(path.dirname(CURRENT_FILE), '..');
const REPO_ROOT = path.resolve(WORKSPACE_ROOT, '../..');
const CONSUELO_DESIGN_ROOT = path.join(REPO_ROOT, 'packages/consuelo-design');
const OPEN_DESIGN_ROOT = path.join(CONSUELO_DESIGN_ROOT, 'upstream/open-design');
const OPEN_DESIGN_RELATIVE_ROOT = 'packages/consuelo-design/upstream/open-design';

const CORE_DESIGN_SYSTEM_FILES = [
  { role: 'visual-design', path: 'packages/consuelo-website/DESIGN.md' },
  { role: 'design-tooling-agent-rules', path: 'areas/consuelo-design/AGENTS.md' },
] as const;

const WEBSITE_CONTEXT_FILES = [
  { role: 'website-motion-design', path: 'areas/website/animations.md' },
  { role: 'website-agent-rules', path: 'areas/website/AGENTS.md' },
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

const DIGITAL_EGUIDE_TEMPLATE_IDS = ['spec', 'plan', 'guide'] as const;
type DigitalEguideTemplateId = typeof DIGITAL_EGUIDE_TEMPLATE_IDS[number];
const DIGITAL_EGUIDE_TEMPLATE_DIR = 'packages/consuelo-design/templates/digital-eguides';
const DIGITAL_EGUIDE_READER_SHELL_PATH = `${DIGITAL_EGUIDE_TEMPLATE_DIR}/reader-shell.md`;
const DESIGN_ARCHIVE_ROOT = path.join(OPEN_DESIGN_ROOT, '.od/consuelo/archive');
const DESIGN_ARCHIVE_DATA_PATH = path.join(DESIGN_ARCHIVE_ROOT, 'archive.json');
const DESIGN_ARCHIVE_ROOT_REDIRECT_PATH = path.join(DESIGN_ARCHIVE_ROOT, 'index.html');
const DESIGN_ARCHIVE_OFFICE_INDEX_PATH = path.join(DESIGN_ARCHIVE_ROOT, 'office', 'index.html');
const DESIGN_ARCHIVE_INDEX_PATH = DESIGN_ARCHIVE_OFFICE_INDEX_PATH;
const DESIGN_ARCHIVE_SERVER_PATH = path.join(DESIGN_ARCHIVE_ROOT, 'server.ts');
const DESIGN_ARCHIVE_ARTIFACTS_ROOT = path.join(DESIGN_ARCHIVE_ROOT, 'artifacts');
const DESIGN_ARCHIVE_PAGEFIND_ROOT = path.join(DESIGN_ARCHIVE_ROOT, 'pagefind');
const DESIGN_ARCHIVE_PORT = 53935;
const DESIGN_ARCHIVE_LEGACY_PATH = '/design-wiki';
const DESIGN_ARCHIVE_PATH = '/sites';
const DESIGN_ARCHIVE_OFFICE_PATH = '/office';
const DESIGN_DOCS_URL = 'https://docs.consuelohq.com/';
const DESIGN_DECISION_INFRASTRUCTURE_URL = 'https://consuelohq.com/blog/software-is-becoming-decision-infrastructure/';
const DESIGN_ARCHIVE_PUBLIC_ORIGIN = process.env.CONSUELO_DESIGN_ARCHIVE_PUBLIC_ORIGIN ?? 'https://sites.consuelohq.com';
const DESIGN_ARCHIVE_LEGACY_PUBLIC_ORIGIN = process.env.CONSUELO_DESIGN_ARCHIVE_LEGACY_PUBLIC_ORIGIN ?? 'https://wiki.consuelohq.com';
const DESIGN_WORK_ORDERS_ROOT = path.join(DESIGN_ARCHIVE_ROOT, 'work-orders');
type ParsedArgs = {
  command: string;
  subcommand: string | null;
  json: boolean;
  quiet: boolean;
  dryRun: boolean;
  live: boolean;
  name?: string;
  prompt?: string;
  template?: string;
  target?: string;
  portlessName?: string;
  path?: string;
  category?: string;
  tailscaleBin?: string;
  baseVersion?: string;
  forcePublish: boolean;
  forwarded: string[];
};

type WorkflowId = 'website' | 'demo' | 'image-brief' | 'digital-eguide' | 'email' | 'motion-frame' | 'hyperframes';

type DesignArchivePageVersion = {
  id: string;
  pageId: string;
  versionId: string;
  previousVersionId: string | null;
  title: string;
  url: string;
  directUrl: string;
  path: string;
  target: string;
  sourceTarget: string;
  artifactPath: string | null;
  template: DigitalEguideTemplateId | 'uncategorized';
  category: string;
  publishedAt: string;
  updatedAt: string;
};

type DesignArchivePage = {
  id: string;
  pageId: string;
  title: string;
  path: string;
  currentVersionId: string;
  versions: DesignArchivePageVersion[];
};

type DesignArchiveEntry = {
  id: string;
  pageId: string;
  title: string;
  url: string;
  directUrl: string;
  path: string;
  target: string;
  sourceTarget: string;
  artifactPath: string | null;
  template: DigitalEguideTemplateId | 'uncategorized';
  category: string;
  publishedAt: string;
  updatedAt: string;
  currentVersionId: string;
  versionCount: number;
};

type DesignArchivePayload = {
  version: 2;
  updatedAt: string;
  entries: DesignArchiveEntry[];
  pages: Record<string, DesignArchivePage>;
};


type WorkflowConfig = {
  id: WorkflowId;
  title: string;
  skillId: string;
  fallbackSkillIds: string[];
  description: string;
  projectPrefix: string;
  includeWebsiteContext: boolean;
  promptLead: string;
};

type RuntimeUrls = {
  daemonUrl: string | null;
  webUrl: string | null;
};

type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

const WORKFLOW_CONFIGS: Record<WorkflowId, WorkflowConfig> = {
  website: {
    id: 'website',
    title: 'Website',
    skillId: 'saas-landing',
    fallbackSkillIds: ['web-prototype', 'web-prototype-taste-editorial'],
    description: 'Create a headless website design/build work order using Consuelo visual, motion, and website agent context.',
    projectPrefix: 'Consuelo Website',
    includeWebsiteContext: true,
    promptLead: 'Create or iterate on a Consuelo website artifact. Use this work order, the website design/motion context, and local source files as the source of truth.',
  },
  demo: {
    id: 'demo',
    title: 'Demo',
    skillId: 'web-prototype',
    fallbackSkillIds: ['dashboard', 'mobile-app', 'simple-deck'],
    description: 'Create a headless prototype/demo work order for walkthroughs, product stories, or proof-of-concept screens.',
    projectPrefix: 'Consuelo Demo',
    includeWebsiteContext: false,
    promptLead: 'Create or iterate on a Consuelo demo artifact. Use this work order and Consuelo design context as source of truth.',
  },
  'image-brief': {
    id: 'image-brief',
    title: 'Image Brief',
    skillId: 'image-poster',
    fallbackSkillIds: ['magazine-poster', 'social-carousel', 'video-shortform', 'web-prototype'],
    description: 'Create a headless image/media ideation work order grounded in Consuelo visual rules.',
    projectPrefix: 'Consuelo Image',
    includeWebsiteContext: false,
    promptLead: 'Create or iterate on a Consuelo image-generation brief and previewable visual artifact. Use this work order and Consuelo design context as source of truth.',
  },
  'digital-eguide': {
    id: 'digital-eguide',
    title: 'Digital E-guide',
    skillId: 'digital-eguide',
    fallbackSkillIds: ['web-prototype', 'simple-deck'],
    description: 'Create a headless long-form digital e-guide work order.',
    projectPrefix: 'Consuelo Digital E-guide',
    includeWebsiteContext: false,
    promptLead: 'Create or iterate on a Consuelo digital e-guide artifact. Use this work order, selected template, reader shell, and Consuelo design context as source of truth.',
  },
  email: {
    id: 'email',
    title: 'Email',
    skillId: 'email-marketing',
    fallbackSkillIds: ['web-prototype'],
    description: 'Create a headless email design/content artifact work order.',
    projectPrefix: 'Consuelo Email',
    includeWebsiteContext: false,
    promptLead: 'Create or iterate on a Consuelo email artifact. Use this work order and Consuelo design context as source of truth.',
  },
  'motion-frame': {
    id: 'motion-frame',
    title: 'Motion Frame',
    skillId: 'motion-frames',
    fallbackSkillIds: ['hyperframes', 'web-prototype'],
    description: 'Create a headless motion-frame work order for GSAP, HyperFrames, and video handoff work.',
    projectPrefix: 'Consuelo Motion Frame',
    includeWebsiteContext: true,
    promptLead: 'Create or iterate on a Consuelo motion-frame artifact. Use this work order plus Consuelo design and motion context as source of truth.',
  },
  hyperframes: {
    id: 'hyperframes',
    title: 'HyperFrames Render',
    skillId: 'hyperframes',
    fallbackSkillIds: ['motion-frames'],
    description: 'Create a headless HyperFrames HTML-to-MP4 render work order.',
    projectPrefix: 'Consuelo HyperFrames',
    includeWebsiteContext: true,
    promptLead: 'Create or iterate on a Consuelo HyperFrames motion graphics artifact and prepare it for HTML-to-MP4 rendering. Use this work order plus Consuelo design and motion context as source of truth.',
  },
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
  const positional: string[] = [];
  const forwarded: string[] = [];
  let json = false;
  let quiet = false;
  let dryRun = false;
  let live = false;
  let forcePublish = false;
  let name: string | undefined;
  let prompt: string | undefined;
  let template: string | undefined;
  let target: string | undefined;
  let portlessName: string | undefined;
  let publishPath: string | undefined;
  let category: string | undefined;
  let tailscaleBin: string | undefined;
  let baseVersion: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--quiet') {
      quiet = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--live' || arg === '--ui-session') {
      live = true;
    } else if (arg === '--name') {
      name = argv[index + 1];
      index += 1;
    } else if (arg === '--prompt') {
      prompt = argv[index + 1];
      index += 1;
    } else if (arg === '--template') {
      template = argv[index + 1];
      index += 1;
    } else if (arg === '--target') {
      target = argv[index + 1];
      index += 1;
    } else if (arg === '--portless-name') {
      portlessName = argv[index + 1];
      index += 1;
    } else if (arg === '--path') {
      publishPath = argv[index + 1];
      index += 1;
    } else if (arg === '--category') {
      category = argv[index + 1];
      index += 1;
    } else if (arg === '--tailscale-bin') {
      tailscaleBin = argv[index + 1];
      index += 1;
    } else if (arg === '--base-version' || arg === '--base-revision') {
      baseVersion = argv[index + 1];
      index += 1;
    } else if (arg === '--force-publish') {
      forcePublish = true;
    } else if (arg.startsWith('--')) {
      forwarded.push(arg);
    } else {
      positional.push(arg);
    }
  }

  return {
    command: positional[0] ?? 'help',
    subcommand: positional[1] ?? null,
    json,
    quiet,
    dryRun,
    live,
    name,
    prompt,
    template,
    target,
    portlessName,
    path: publishPath,
    category,
    tailscaleBin,
    baseVersion,
    forcePublish,
    forwarded,
  };
}

function requireOpenDesign(): void {
  if (!existsSync(OPEN_DESIGN_ROOT)) {
    throw new Error(`missing vendored Open Design root: ${path.relative(REPO_ROOT, OPEN_DESIGN_ROOT)}`);
  }
}

function getCoreDesignSystemFiles() {
  return CORE_DESIGN_SYSTEM_FILES.map((file) => ({ ...file, content: readText(file.path) }));
}

function getWorkflowContextFiles(workflow: WorkflowConfig) {
  const files = [...getCoreDesignSystemFiles()];
  if (workflow.includeWebsiteContext) {
    files.push(...WEBSITE_CONTEXT_FILES.map((file) => ({ ...file, content: readText(file.path) })));
  }
  return files;
}

function getDesignSystem(args: ParsedArgs): void {
  const files = getCoreDesignSystemFiles();
  if (args.json) {
    printJson({
      name: 'consuelo',
      policy: 'Base Consuelo design system returns only DESIGN.md and consuelo-design/AGENTS.md. Website-specific animations.md and website AGENTS.md are attached only to website/motion workflow sessions.',
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

function readDirectoryNames(relativePath: string, markerFile: string): string[] {
  const absolutePath = repoPath(relativePath);
  if (!existsSync(absolutePath)) return [];
  return readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(path.join(absolutePath, name, markerFile)))
    .sort((a, b) => a.localeCompare(b));
}

function listSkills(args: ParsedArgs): void {
  const upstreamSkills = readDirectoryNames(`${OPEN_DESIGN_RELATIVE_ROOT}/skills`, 'SKILL.md');
  const workflowMappings = Object.values(WORKFLOW_CONFIGS).map((workflow) => ({
    workflow: workflow.id,
    command: workflow.id === 'hyperframes' ? 'render hyperframes' : `generate ${workflow.id}`,
    primarySkill: workflow.skillId,
    fallbackSkillIds: workflow.fallbackSkillIds,
    description: workflow.description,
  }));
  const result = { upstreamSkills, workflowMappings };

  if (args.json) {
    printJson(result);
    return;
  }

  writeStdout('Consuelo workflow mapping\n');
  for (const mapping of workflowMappings) {
    writeStdout(`- ${mapping.command}: ${mapping.primarySkill}`);
    if (mapping.fallbackSkillIds.length > 0) writeStdout(` (fallback: ${mapping.fallbackSkillIds.join(', ')})`);
    writeStdout('\n');
  }
  writeStdout('\nUpstream skills\n');
  for (const skill of upstreamSkills) writeStdout(`- ${skill}\n`);
}

function listDesignSystems(args: ParsedArgs): void {
  const upstreamDesignSystems = readDirectoryNames(`${OPEN_DESIGN_RELATIVE_ROOT}/design-systems`, 'DESIGN.md');
  const result = {
    defaultDesignSystem: {
      id: 'consuelo',
      role: 'default-internal',
      files: CORE_DESIGN_SYSTEM_FILES.map((file) => file.path),
    },
    upstreamReferenceSystems: upstreamDesignSystems.map((id) => ({ id, role: 'reference-only' })),
    policy: 'Use consuelo as the default design system. Upstream design systems are optional reference skins, not Consuelo truth.',
  };

  if (args.json) {
    printJson(result);
    return;
  }

  writeStdout('Default design system\n');
  writeStdout('- consuelo (internal/default)\n\n');
  writeStdout('Upstream reference systems\n');
  for (const system of upstreamDesignSystems) writeStdout(`- ${system}\n`);
}

function upstreamStatus(args: ParsedArgs): void {
  requireOpenDesign();
  const upstreamPackagePath = `${OPEN_DESIGN_RELATIVE_ROOT}/package.json`;
  const packageJson = JSON.parse(readText(upstreamPackagePath)) as {
    name?: string;
    version?: string;
    license?: string;
    packageManager?: string;
    engines?: { node?: string; pnpm?: string };
  };
  const data = {
    path: OPEN_DESIGN_RELATIVE_ROOT,
    packageName: packageJson.name ?? null,
    version: packageJson.version ?? null,
    license: packageJson.license ?? null,
    packageManager: packageJson.packageManager ?? null,
    nodeEngine: packageJson.engines?.node ?? null,
    pnpmEngine: packageJson.engines?.pnpm ?? null,
    hasLicense: pathExists(`${OPEN_DESIGN_RELATIVE_ROOT}/LICENSE`),
    hasReadme: pathExists(`${OPEN_DESIGN_RELATIVE_ROOT}/README.md`),
    hasGitMetadata: pathExists(`${OPEN_DESIGN_RELATIVE_ROOT}/.git`),
  };

  if (args.json) {
    printJson(data);
    return;
  }

  for (const [key, value] of Object.entries(data)) writeStdout(`${key}: ${String(value)}\n`);
}

function buildRailwayCheckResult() {
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

  return {
    ok: failures.length === 0,
    checkedDockerfiles: DEPLOYMENT_DOCKERFILES,
    checkedPackageManifests: DEPLOYED_PACKAGE_MANIFESTS,
    failures,
  };
}

function railwayCheck(args: ParsedArgs): ReturnType<typeof buildRailwayCheckResult> {
  const result = buildRailwayCheckResult();

  if (args.json) printJson(result);
  else if (result.ok && !args.quiet) writeStdout('Railway exclusion check passed.\n');
  else result.failures.forEach(writeStderr);

  if (!result.ok) process.exit(1);
  return result;
}

function buildBoundaryCheckResult() {
  const requiredPaths = [
    'packages/consuelo-design/package.json',
    'areas/consuelo-design/AGENTS.md',
    'packages/consuelo-design/README.md',
    'packages/consuelo-design/RAILWAY.md',
    'packages/consuelo-design/UPSTREAM.md',
    `${OPEN_DESIGN_RELATIVE_ROOT}/package.json`,
    `${OPEN_DESIGN_RELATIVE_ROOT}/LICENSE`,
    `${OPEN_DESIGN_RELATIVE_ROOT}/skills`,
    `${OPEN_DESIGN_RELATIVE_ROOT}/design-systems`,
    ...CORE_DESIGN_SYSTEM_FILES.map((file) => file.path),
    ...WEBSITE_CONTEXT_FILES.map((file) => file.path),
  ];
  const missingPaths = requiredPaths.filter((relativePath) => !pathExists(relativePath));
  return {
    ok: missingPaths.length === 0 && !pathExists(`${OPEN_DESIGN_RELATIVE_ROOT}/.git`),
    missingPaths,
    hasNestedGitMetadata: pathExists(`${OPEN_DESIGN_RELATIVE_ROOT}/.git`),
    designSystemFiles: CORE_DESIGN_SYSTEM_FILES,
    websiteContextFiles: WEBSITE_CONTEXT_FILES,
    workflows: Object.keys(WORKFLOW_CONFIGS),
  };
}

function check(args: ParsedArgs): ReturnType<typeof buildBoundaryCheckResult> {
  const result = buildBoundaryCheckResult();

  if (args.json) printJson(result);
  else if (result.ok && !args.quiet) writeStdout('consuelo-design check passed.\n');
  else {
    if (result.missingPaths.length > 0) writeStderr(`missing paths:\n${result.missingPaths.join('\n')}`);
    if (result.hasNestedGitMetadata) writeStderr(`${OPEN_DESIGN_RELATIVE_ROOT}/.git should not be committed.`);
  }

  if (!result.ok) process.exit(1);
  return result;
}

async function runCommand(command: string[], cwd: string): Promise<CommandResult> {
  try {
    const child = Bun.spawn(command, {
      cwd,
      stderr: 'pipe',
      stdout: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { stdout, stderr, exitCode };
  } catch (error: unknown) {
    return {
      exitCode: 1,
      stderr: error instanceof Error ? error.message : String(error),
      stdout: '',
    };
  }
}

async function runCommandInherited(command: string[], cwd: string): Promise<number> {
  try {
    const child = Bun.spawn(command, {
      cwd,
      stdin: 'inherit',
      stderr: 'inherit',
      stdout: 'inherit',
    });
    return await child.exited;
  } catch (error: unknown) {
    writeStderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}


function parseJsonFromMixedStdout(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) throw new Error('tools-dev returned empty JSON output');

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char !== '{' && char !== '[') continue;
    try {
      return JSON.parse(trimmed.slice(index)) as unknown;
    } catch {
      // pnpm can print lifecycle banners before the JSON payload. Keep
      // scanning until a valid JSON object/array starts.
    }
  }

  throw new Error(`could not find JSON payload in tools-dev output: ${trimmed.slice(0, 300)}`);
}

function extractRuntimeUrls(value: unknown): RuntimeUrls {
  const record = value != null && typeof value === 'object' ? value as Record<string, unknown> : {};
  const daemon = record.daemon != null && typeof record.daemon === 'object' ? record.daemon as Record<string, unknown> : {};
  const web = record.web != null && typeof record.web === 'object' ? record.web as Record<string, unknown> : {};
  const daemonStatus = daemon.status != null && typeof daemon.status === 'object' ? daemon.status as Record<string, unknown> : {};
  const webStatus = web.status != null && typeof web.status === 'object' ? web.status as Record<string, unknown> : {};
  return {
    daemonUrl: typeof daemonStatus.url === 'string' ? daemonStatus.url : null,
    webUrl: typeof webStatus.url === 'string' ? webStatus.url : null,
  };
}

async function startOpenDesign(args: ParsedArgs): Promise<RuntimeUrls> {
  requireOpenDesign();
  const command = ['corepack', 'pnpm', 'tools-dev', 'start', 'web', '--json', ...args.forwarded];
  if (args.dryRun) {
    if (args.json) printJson({ cwd: OPEN_DESIGN_ROOT, command });
    else writeStdout(`Open Design start: ${command.join(' ')}\ncwd: ${path.relative(REPO_ROOT, OPEN_DESIGN_ROOT)}\n`);
    return { daemonUrl: null, webUrl: null };
  }

  const result = await runCommand(command, OPEN_DESIGN_ROOT);
  if (result.exitCode !== 0) {
    throw new Error(`Open Design failed to start: ${result.stderr || result.stdout || `exit ${result.exitCode}`}`);
  }
  const parsed = parseJsonFromMixedStdout(result.stdout);
  return extractRuntimeUrls(parsed);
}

async function runOpenDesignForeground(args: ParsedArgs): Promise<void> {
  const command = ['corepack', 'pnpm', 'tools-dev', 'run', 'web', ...args.forwarded];
  if (args.dryRun) {
    if (args.json) printJson({ cwd: OPEN_DESIGN_ROOT, command });
    else writeStdout(`Open Design run: ${command.join(' ')}\ncwd: ${path.relative(REPO_ROOT, OPEN_DESIGN_ROOT)}\n`);
    return;
  }
  const exitCode = await runCommandInherited(command, OPEN_DESIGN_ROOT);
  process.exit(exitCode);
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

    const exitCode = await runCommandInherited(command, OPEN_DESIGN_ROOT);
    process.exit(exitCode);
  } catch (error: unknown) {
    writeStderr(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function projectIdForWorkflow(workflow: WorkflowId): string {
  return `consuelo-${workflow}-${crypto.randomUUID()}`;
}

function timestampLabel(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}


function isDigitalEguideTemplateId(value: string): value is DigitalEguideTemplateId {
  return (DIGITAL_EGUIDE_TEMPLATE_IDS as readonly string[]).includes(value);
}

function getDigitalEguideTemplateBlock(workflow: WorkflowConfig, args: ParsedArgs): string {
  if (!args.template) return '';

  if (workflow.id !== 'digital-eguide') {
    throw new Error('--template is only supported for generate digital-eguide');
  }

  if (!isDigitalEguideTemplateId(args.template)) {
    throw new Error(`unknown digital e-guide template: ${args.template}. Use one of: ${DIGITAL_EGUIDE_TEMPLATE_IDS.join(', ')}`);
  }

  const templatePath = `${DIGITAL_EGUIDE_TEMPLATE_DIR}/${args.template}.md`;
  const templateContent = readText(templatePath).trim();
  const readerShellContent = readText(DIGITAL_EGUIDE_READER_SHELL_PATH).trim();
  return [
    `## Open Design template: ${args.template}`,
    'Use this Consuelo-owned Open Design template as the artifact structure. Keep Ko\'s brief and source material as content truth; use the template for layout, hierarchy, and required sections.',
    templateContent,
    readerShellContent,
  ].join('\n\n');
}

function buildWorkflowPrompt(workflow: WorkflowConfig, args: ParsedArgs): string {
  const files = getWorkflowContextFiles(workflow);
  const suppliedPrompt = args.prompt ? `\n\n## Ko's brief\n\n${args.prompt.trim()}\n` : '';
  const templateBlock = getDigitalEguideTemplateBlock(workflow, args);
  const fileBlocks = files.map((file) => [
    `## ${file.role}: ${file.path}`,
    file.content.trim(),
  ].join('\n\n')).join('\n\n---\n\n');
  return [
    workflow.promptLead,
    suppliedPrompt,
    templateBlock,
    'Do not treat upstream Open Design design systems as Consuelo truth unless Ko explicitly asks for a reference skin. Use the attached Consuelo files as the source of truth.',
    'Generated prompt = work order, not chat message. Execute this directly by creating/editing local artifact source, validating in browser, and publishing with design.publish unless Ko explicitly asks for a live Open Design UI session.',
    'Consuelo context follows.',
    fileBlocks,
  ].filter(Boolean).join('\n\n');
}

async function openUrl(url: string, args: ParsedArgs): Promise<void> {
  try {
    if (args.dryRun) return;
    const child = Bun.spawn(['open', url], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
    await child.exited;
  } catch (error: unknown) {
    writeStderr(error instanceof Error ? error.message : String(error));
  }
}

async function createWorkflowProject(workflow: WorkflowConfig, runtime: RuntimeUrls, args: ParsedArgs) {
  if (!runtime.daemonUrl || !runtime.webUrl) {
    throw new Error('Open Design did not return daemon/web URLs. Run `bun run consuelo-design run` and retry.');
  }
  const id = projectIdForWorkflow(workflow.id);
  const name = args.name ?? `${workflow.projectPrefix} ${timestampLabel()}`;
  const pendingPrompt = buildWorkflowPrompt(workflow, args);
  const body = {
    id,
    name,
    skillId: workflow.skillId,
    designSystemId: null,
    pendingPrompt,
    metadata: {
      source: 'consuelo-design',
      workflow: workflow.id,
      primarySkill: workflow.skillId,
      fallbackSkillIds: workflow.fallbackSkillIds,
      template: args.template ?? null,
      designSystem: 'consuelo',
    },
  };
  const response = await fetch(`${runtime.daemonUrl.replace(/\/$/, '')}/api/projects`, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`failed to create Open Design project: ${response.status} ${text}`);
  }
  const projectUrl = `${runtime.webUrl.replace(/\/$/, '')}/projects/${encodeURIComponent(id)}`;
  return { id, name, projectUrl, pendingPrompt, workflow: workflow.id, skillId: workflow.skillId, template: args.template ?? null };
}


function workOrderNameFor(workflow: WorkflowConfig, args: ParsedArgs): string {
  return args.name ?? `${workflow.projectPrefix} ${timestampLabel()}`;
}

function workOrderSlugFor(workflow: WorkflowConfig, name: string): string {
  return `${workflow.id}-${slugify(name)}-${timestampLabel()}`;
}

function writeWorkflowWorkOrder(workflow: WorkflowConfig, args: ParsedArgs, prompt: string, name: string): string {
  const slug = workOrderSlugFor(workflow, name);
  const relativePath = path.join('work-orders', `${slug}.md`);
  const absolutePath = path.join(DESIGN_ARCHIVE_ROOT, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, prompt.endsWith('\n') ? prompt : `${prompt}\n`);
  return absolutePath;
}

function buildWorkflowWorkOrder(workflow: WorkflowConfig, args: ParsedArgs): { ok: true; mode: 'headless-work-order'; workflow: WorkflowId; artifact: { name: string; skillId: string; metadata: Record<string, unknown> }; workOrder: string; workOrderPath: string | null; sourceFiles: string[]; nextSteps: string[]; liveUi: { flag: '--live'; note: string } } {
  const pendingPrompt = buildWorkflowPrompt(workflow, args);
  const name = workOrderNameFor(workflow, args);
  const workOrderPath = args.dryRun ? null : writeWorkflowWorkOrder(workflow, args, pendingPrompt, name);
  const sourceFiles = getWorkflowContextFiles(workflow).map((file) => file.path);
  if (workflow.id === 'digital-eguide' && args.template) {
    sourceFiles.push(`${DIGITAL_EGUIDE_TEMPLATE_DIR}/${args.template}.md`, DIGITAL_EGUIDE_READER_SHELL_PATH);
  }

  return {
    ok: true,
    mode: 'headless-work-order',
    workflow: workflow.id,
    artifact: {
      name,
      skillId: workflow.skillId,
      metadata: {
        source: 'consuelo-design',
        workflow: workflow.id,
        primarySkill: workflow.skillId,
        fallbackSkillIds: workflow.fallbackSkillIds,
        template: args.template ?? null,
        designSystem: 'consuelo',
      },
    },
    workOrder: pendingPrompt,
    workOrderPath,
    sourceFiles,
    nextSteps: [
      'Do not send the generated prompt into Open Design chat by default.',
      'Read the listed source files, then create or edit the local artifact source directly.',
      'Validate the artifact with browser tools.',
      'Publish durable Tailnet links with design.publish.',
      'Verify the artifact URL and /design-wiki entry.',
    ],
    liveUi: {
      flag: '--live',
      note: 'Use --live only when Ko explicitly wants a headed Open Design UI/operator session.',
    },
  };
}

function workflowFromArgs(args: ParsedArgs): WorkflowConfig {
  const workflow = args.subcommand;
  if (!workflow || !(workflow in WORKFLOW_CONFIGS)) {
    const names = Object.keys(WORKFLOW_CONFIGS).filter((name) => name !== 'hyperframes').join('|');
    throw new Error(`expected workflow: ${names}`);
  }
  return WORKFLOW_CONFIGS[workflow as WorkflowId];
}


function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'design-artifact';
}

function normalizeServePath(args: ParsedArgs): string {
  if (args.path) {
    const withSlash = args.path.startsWith('/') ? args.path : `/${args.path}`;
    return withSlash.replace(/\/+/g, '/').replace(/\/$/, '') || '/design';
  }

  const category = slugify(args.category ?? 'design');
  const name = slugify(args.name ?? args.portlessName ?? args.target ?? `artifact-${timestampLabel()}`);
  return `/${category}/${name}`;
}

function normalizeTarget(target: string): string {
  if (/^https?:\/\//.test(target) || target.startsWith('localhost:') || target.startsWith('127.0.0.1:')) return target;
  return path.resolve(target);
}

function trimTrailingDot(value: string): string {
  return value.endsWith('.') ? value.slice(0, -1) : value;
}

type TailscaleSelf = { hostname: string; ip: string };

function parseTailscaleSelf(stdout: string): TailscaleSelf {
  const status = JSON.parse(stdout) as { Self?: { DNSName?: string, TailscaleIPs?: string[] }, CertDomains?: string[] };
  const dnsName = status.Self?.DNSName ?? status.CertDomains?.[0];
  if (!dnsName) throw new Error('tailscale status did not include a DNS name. Is Tailscale running and logged in?');
  const ip = status.Self?.TailscaleIPs?.find((value) => value.includes('.'));
  if (!ip) throw new Error('tailscale status did not include a tailnet IPv4 address. Is Tailscale running and logged in?');
  return { hostname: trimTrailingDot(dnsName), ip };
}

function parseTailscaleHostname(stdout: string): string {
  return parseTailscaleSelf(stdout).hostname;
}

async function getTailscaleSelf(tailscaleBin: string): Promise<TailscaleSelf> {
  try {
    const result = await runCommand([tailscaleBin, 'status', '--json'], REPO_ROOT);
    if (result.exitCode !== 0) {
      throw new Error(`tailscale status failed: ${result.stderr || result.stdout || `exit ${result.exitCode}`}`);
    }
    return parseTailscaleSelf(result.stdout);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to resolve Tailscale self: ${message}`);
  }
}

async function getTailscaleHostname(tailscaleBin: string): Promise<string> {
  try {
    const result = await runCommand([tailscaleBin, 'status', '--json'], REPO_ROOT);
    if (result.exitCode !== 0) {
      throw new Error(`tailscale status failed: ${result.stderr || result.stdout || `exit ${result.exitCode}`}`);
    }
    return parseTailscaleHostname(result.stdout);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to resolve Tailscale hostname: ${message}`);
  }
}

async function resolvePortlessTarget(portlessName: string): Promise<string> {
  try {
    if (portlessName.endsWith('.localhost')) {
      return `https://${portlessName}:1355`;
    }

    const result = await runCommand(['portless', 'get', portlessName], REPO_ROOT);
    if (result.exitCode !== 0) {
      throw new Error(`portless get failed for ${portlessName}: ${result.stderr || result.stdout || `exit ${result.exitCode}`}`);
    }

    const target = result.stdout.trim().split(/\s+/)[0];
    if (!target) throw new Error(`portless get ${portlessName} returned no URL`);
    return target;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to resolve portless target: ${message}`);
  }
}


function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function archiveTitleFromArgs(args: ParsedArgs, servePath: string): string {
  if (args.name) return args.name;
  const slug = servePath.split('/').filter(Boolean).at(-1) ?? 'design artifact';
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

function archiveCategoryFromArgs(args: ParsedArgs, servePath: string): string {
  if (args.category) return slugify(args.category);
  return servePath.split('/').filter(Boolean)[0] ?? 'design';
}

function archiveTemplateFromArgs(args: ParsedArgs): DesignArchiveEntry['template'] {
  return args.template && isDigitalEguideTemplateId(args.template) ? args.template : 'uncategorized';
}

function currentArchiveVersionForPath(payload: DesignArchivePayload, servePath: string): string | null {
  const entry = payload.entries.find((item) => item.path === servePath);
  if (entry?.currentVersionId) return entry.currentVersionId;
  const pageId = entry?.pageId ?? slugify(servePath);
  return payload.pages[pageId]?.currentVersionId ?? null;
}

function assertArchiveRevisionWritable(args: ParsedArgs, payload: DesignArchivePayload, servePath: string): { currentVersionId: string | null; requiredBaseVersion: string | null } {
  const currentVersionId = currentArchiveVersionForPath(payload, servePath);
  if (!currentVersionId) return { currentVersionId: null, requiredBaseVersion: null };
  if (args.forcePublish) return { currentVersionId, requiredBaseVersion: currentVersionId };
  if (!args.baseVersion) {
    throw new Error(`stale design wiki publish rejected for ${servePath}: existing page is at ${currentVersionId}. Re-run with --base-version ${currentVersionId} after reading the latest page, or use --force-publish only for an intentional overwrite.`);
  }
  if (args.baseVersion !== currentVersionId) {
    throw new Error(`stale design wiki publish rejected for ${servePath}: base version ${args.baseVersion} does not match current version ${currentVersionId}. Rebase the typed changes onto the latest page before publishing.`);
  }
  return { currentVersionId, requiredBaseVersion: currentVersionId };
}


function archiveSafeSegments(servePath: string): string[] {
  return servePath.split('/').filter(Boolean).map(slugify);
}

function archiveVersionIdFromDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const iso = Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  return iso.replace(/[:.]/g, '-');
}

function archiveCurrentRelativeArtifactPath(servePath: string, fileName?: string): string {
  const relativePath = path.join('artifacts', 'current', ...archiveSafeSegments(servePath));
  return fileName ? path.join(relativePath, fileName) : relativePath;
}

function archiveVersionRelativeArtifactPath(servePath: string, versionId: string, fileName?: string): string {
  const relativePath = path.join('artifacts', 'versions', ...archiveSafeSegments(servePath), slugify(versionId));
  return fileName ? path.join(relativePath, fileName) : relativePath;
}

function archiveRelativeArtifactPath(servePath: string, fileName = 'index.html'): string {
  return archiveCurrentRelativeArtifactPath(servePath, fileName);
}

function archiveCurrentAbsoluteArtifactDir(servePath: string): string {
  return path.join(DESIGN_ARCHIVE_ARTIFACTS_ROOT, 'current', ...archiveSafeSegments(servePath));
}

function archiveVersionAbsoluteArtifactDir(servePath: string, versionId: string): string {
  return path.join(DESIGN_ARCHIVE_ARTIFACTS_ROOT, 'versions', ...archiveSafeSegments(servePath), slugify(versionId));
}

function archiveAbsoluteArtifactDir(servePath: string): string {
  return archiveCurrentAbsoluteArtifactDir(servePath);
}

function archiveVersionedServePath(servePath: string, versionId: string): string {
  const cleanPath = servePath.endsWith('/') ? servePath.slice(0, -1) : servePath;
  return `${cleanPath}/versions/${encodeURIComponent(versionId)}`;
}

function archiveDirectUrlForPath(tailscaleSelf: TailscaleSelf, servePath: string): string {
  return `http://${tailscaleSelf.ip}:${DESIGN_ARCHIVE_PORT}${servePath}`;
}

function materializeArchiveTarget(target: string, servePath: string, versionId: string): { target: string; artifactPath: string | null; versionArtifactPath: string | null; versionTarget: string | null; sourceTarget: string } {
  if (/^https?:\/\//.test(target)) {
    return { target, artifactPath: null, versionArtifactPath: null, versionTarget: null, sourceTarget: target };
  }

  const sourcePath = path.resolve(target);
  if (!existsSync(sourcePath)) {
    throw new Error(`publish target does not exist: ${target}`);
  }

  const currentTargetDir = archiveCurrentAbsoluteArtifactDir(servePath);
  const versionTargetDir = archiveVersionAbsoluteArtifactDir(servePath, versionId);
  if (existsSync(versionTargetDir)) {
    throw new Error(`archive version already exists for ${servePath}: ${versionId}`);
  }
  mkdirSync(versionTargetDir, { recursive: true });

  const sourceStat = statSync(sourcePath);
  if (sourceStat.isDirectory()) {
    cpSync(sourcePath, versionTargetDir, { recursive: true });
    const indexPath = path.join(versionTargetDir, 'index.html');
    if (!existsSync(indexPath)) {
      throw new Error(`directory publish target must contain index.html: ${target}`);
    }
    rmSync(currentTargetDir, { recursive: true, force: true });
    mkdirSync(path.dirname(currentTargetDir), { recursive: true });
    cpSync(versionTargetDir, currentTargetDir, { recursive: true });
    return {
      target: currentTargetDir,
      artifactPath: archiveCurrentRelativeArtifactPath(servePath),
      versionArtifactPath: archiveVersionRelativeArtifactPath(servePath, versionId),
      versionTarget: versionTargetDir,
      sourceTarget: target,
    };
  }

  const versionIndexPath = path.join(versionTargetDir, 'index.html');
  cpSync(sourcePath, versionIndexPath);
  rmSync(currentTargetDir, { recursive: true, force: true });
  mkdirSync(currentTargetDir, { recursive: true });
  const currentIndexPath = path.join(currentTargetDir, 'index.html');
  cpSync(versionIndexPath, currentIndexPath);
  return {
    target: currentIndexPath,
    artifactPath: archiveCurrentRelativeArtifactPath(servePath, 'index.html'),
    versionArtifactPath: archiveVersionRelativeArtifactPath(servePath, versionId, 'index.html'),
    versionTarget: versionIndexPath,
    sourceTarget: target,
  };
}
async function refreshDesignArchive(args: ParsedArgs): Promise<void> {
  try {
    const tailscaleBin = args.tailscaleBin ?? 'tailscale';
    const tailscaleSelf = args.dryRun ? { hostname: '<tailscale-host>', ip: '<tailscale-ip>' } : await getTailscaleSelf(tailscaleBin);
    const payload = readArchivePayload();
    payload.updatedAt = new Date().toISOString();
    if (!args.dryRun) {
      writeArchivePayload(payload);
      writeArchiveIndex(payload);
    }
    const archiveTarget = args.dryRun ? `http://${tailscaleSelf.ip}:${DESIGN_ARCHIVE_PORT}` : await ensureArchiveServer(tailscaleSelf.ip);
    const tracingTarget = `${archiveTarget}/trace-burn-intelligence`;
    const diffsTarget = `${archiveTarget}/diffs`;
    const launcherCommand = [tailscaleBin, 'serve', '--bg', '--yes', '--set-path', '/', archiveTarget];
    const officeCommand = [tailscaleBin, 'serve', '--bg', '--yes', '--set-path', DESIGN_ARCHIVE_OFFICE_PATH, archiveTarget];
    const command = [tailscaleBin, 'serve', '--bg', '--yes', '--set-path', DESIGN_ARCHIVE_PATH, archiveTarget];
    const legacyCommand = [tailscaleBin, 'serve', '--bg', '--yes', '--set-path', DESIGN_ARCHIVE_LEGACY_PATH, archiveTarget];
    const tracingCommand = [tailscaleBin, 'serve', '--bg', '--yes', '--set-path', '/tracing', tracingTarget];
    const diffsCommand = [tailscaleBin, 'serve', '--bg', '--yes', '--set-path', '/diffs', diffsTarget];
    const url = `https://${tailscaleSelf.hostname}${DESIGN_ARCHIVE_OFFICE_PATH}`;
    const directUrl = `http://${tailscaleSelf.ip}:${DESIGN_ARCHIVE_PORT}${DESIGN_ARCHIVE_OFFICE_PATH}`;
    const legacyUrl = `${DESIGN_ARCHIVE_LEGACY_PUBLIC_ORIGIN}${DESIGN_ARCHIVE_LEGACY_PATH}`;
    const legacyDirectUrl = `http://${tailscaleSelf.ip}:${DESIGN_ARCHIVE_PORT}${DESIGN_ARCHIVE_LEGACY_PATH}`;
    if (args.dryRun) {
      if (args.json) printJson({ ok: true, mode: 'tailscale-serve', path: DESIGN_ARCHIVE_OFFICE_PATH, aliasPath: DESIGN_ARCHIVE_PATH, legacyPath: DESIGN_ARCHIVE_LEGACY_PATH, url, directUrl, legacyUrl, legacyDirectUrl, target: archiveTarget, commands: [launcherCommand, officeCommand, command, legacyCommand, tracingCommand, diffsCommand] });
      else writeStdout(`design archive refresh dry-run\nurl: ${url}\ntarget: ${archiveTarget}\ncommand: ${command.join(' ')}\n`);
      return;
    }
    const result = await setArchiveServePaths(tailscaleBin, archiveTarget);
    if (args.json) printJson({ ok: true, mode: 'tailscale-serve', path: DESIGN_ARCHIVE_OFFICE_PATH, aliasPath: DESIGN_ARCHIVE_PATH, legacyPath: DESIGN_ARCHIVE_LEGACY_PATH, url, directUrl, legacyUrl, legacyDirectUrl, target: archiveTarget, stdout: result.stdout.trim(), stderr: result.stderr.trim(), entries: payload.entries.length });
    else if (!args.quiet) writeStdout(`design archive refreshed\nlauncher: ${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/\noffice: ${url}\nofficeDirect: ${directUrl}\nlegacyWiki: ${legacyUrl}\nlegacyWikiDirect: ${legacyDirectUrl}\ntarget: ${archiveTarget}\nentries: ${payload.entries.length}\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to refresh Consuelo Sites archive: ${message}`);
  }
}

async function archiveServerShowsCurrentWiki(target: string): Promise<boolean> {
  try {
    const response = await fetch(`${target}${DESIGN_ARCHIVE_OFFICE_PATH}`, { cache: 'no-store' });
    if (!response.ok) return false;
    const html = await response.text();
    return html.includes('Recently Updated') && !html.includes('Recent Posts') && !html.includes('<h2>Featured</h2>');
  } catch {
    return false;
  }
}

async function stopArchiveServer(): Promise<void> {
  try {
    const lookup = await runCommand(['lsof', '-ti', `tcp:${DESIGN_ARCHIVE_PORT}`], REPO_ROOT);
    if (lookup.exitCode !== 0) return;
    const pids = lookup.stdout.split(/\s+/).filter(Boolean);
    for (const pid of pids) {
      await runCommand(['kill', pid], REPO_ROOT);
    }
  } catch {
    // Best effort only. If the process is already gone, publish can continue.
  }
}

async function ensureArchiveServer(ip: string): Promise<string> {
  try {
    writeArchiveServer(ip);
    const target = `http://${ip}:${DESIGN_ARCHIVE_PORT}`;
    await stopArchiveServer();

    const child = spawn('bun', [DESIGN_ARCHIVE_SERVER_PATH], {
      cwd: REPO_ROOT,
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    child.unref();

    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      if (await archiveServerShowsCurrentWiki(target)) return target;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return target;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to ensure Consuelo Sites archive server: ${message}`);
  }
}


async function setArchiveServePaths(tailscaleBin: string, target: string): Promise<{ stdout: string; stderr: string }> {
  try {
    let stdout = '';
    let stderr = '';
    const routes = [
      ['/', target],
      [DESIGN_ARCHIVE_OFFICE_PATH, target],
      [DESIGN_ARCHIVE_PATH, target],
      [DESIGN_ARCHIVE_LEGACY_PATH, target],
      ['/tracing', `${target}/trace-burn-intelligence`],
      ['/diffs', `${target}/diffs`],
    ] as const;
    for (const [archivePath, routeTarget] of routes) {
      const result = await runCommand([tailscaleBin, 'serve', '--bg', '--yes', '--set-path', archivePath, routeTarget], REPO_ROOT);
      stdout += result.stdout;
      stderr += result.stderr;
      if (result.exitCode !== 0) {
        throw new Error(`tailscale serve failed for Consuelo Sites at ${archivePath}: ${result.stderr || result.stdout || `exit ${result.exitCode}`}`);
      }
    }
    return { stdout, stderr };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to set Consuelo Sites archive serve paths: ${message}`);
  }
}

function writeArchiveServer(ip: string): void {
  mkdirSync(DESIGN_ARCHIVE_ROOT, { recursive: true });
  const lines = [
    'const archiveRoot = ' + JSON.stringify(DESIGN_ARCHIVE_ROOT) + ';',
    'const indexPath = ' + JSON.stringify(DESIGN_ARCHIVE_INDEX_PATH) + ';',
    'const rootRedirectPath = ' + JSON.stringify(DESIGN_ARCHIVE_ROOT_REDIRECT_PATH) + ';',
    'const dataPath = ' + JSON.stringify(DESIGN_ARCHIVE_DATA_PATH) + ';',
    'const pagefindRoot = ' + JSON.stringify(DESIGN_ARCHIVE_PAGEFIND_ROOT) + ';',
    'const officeArchivePath = ' + JSON.stringify(DESIGN_ARCHIVE_OFFICE_PATH) + ';',
    'const archivePath = ' + JSON.stringify(DESIGN_ARCHIVE_PATH) + ';',
    'const legacyArchivePath = ' + JSON.stringify(DESIGN_ARCHIVE_LEGACY_PATH) + ';',
    'const docsUrl = ' + JSON.stringify(DESIGN_DOCS_URL) + ';',
    'const decisionInfrastructureUrl = ' + JSON.stringify(DESIGN_DECISION_INFRASTRUCTURE_URL) + ';',
    'const archivePaths = Array.from(new Set([officeArchivePath, archivePath, legacyArchivePath]));',
    'const port = ' + JSON.stringify(DESIGN_ARCHIVE_PORT) + ';',
    'const launcherCacheControl = "public, max-age=60, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800";',
    'function h(type, cache){ const base = { "Cache-Control": cache === "launcher" ? launcherCacheControl : "no-store" }; if (type) base["Content-Type"] = type; return base; }',
    'function cleanPath(value){ return decodeURIComponent(value).split("/").filter(Boolean).join("/"); }',
    'function safeJoin(base, value){ const target = Bun.pathToFileURL(base + "/" + cleanPath(value)).pathname; const allowed = Bun.pathToFileURL(base + "/").pathname; return target.startsWith(allowed) ? target : null; }',
    'async function servePath(filePath){ const file = Bun.file(filePath); if (await file.exists()) return new Response(file, { headers: h() }); const index = Bun.file(filePath + "/index.html"); if (await index.exists()) return new Response(index, { headers: h("text/html; charset=utf-8") }); return null; }',
    'async function readPayload(){ try { return JSON.parse(await Bun.file(dataPath).text()); } catch { return { entries: [], pages: {} }; } }',
    'async function readEntries(){ try { const data = await readPayload(); return Array.isArray(data.entries) ? data.entries : []; } catch { return []; } }',
    'async function readPages(){ try { const data = await readPayload(); return data && data.pages && typeof data.pages === "object" ? data.pages : {}; } catch { return {}; } }',
    'async function proxyEntry(entry, request, suffix){ if (!entry || !entry.target) return null; if (!entry.target.startsWith("http://") && !entry.target.startsWith("https://")) return null; const target = new URL(entry.target); const requested = new URL(request.url); const base = target.pathname.endsWith("/") ? target.pathname.slice(0, -1) : target.pathname; const extra = suffix ? "/" + suffix.split("/").filter(Boolean).map(encodeURIComponent).join("/") : ""; target.pathname = base + extra; target.search = requested.search; return fetch(target, { method: request.method, headers: request.headers }); }',
    'function pagefindSuffix(pathname){ for (const base of archivePaths){ if (pathname.startsWith(base + "/pagefind/")) return pathname.slice((base + "/pagefind/").length); } if (pathname.startsWith("/pagefind/")) return pathname.slice("/pagefind/".length); return null; }',
    'function stripArtifactAlias(pathname){ const clean = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname; for (const base of archivePaths){ if (clean === base) return "/"; if (clean.startsWith(base + "/")) return clean.slice(base.length) || "/"; } return clean; }',
    'function officePathFor(pathname){ const raw = String(pathname || "/"); const clean = raw.startsWith("/") ? raw : "/" + raw.replace(/^\\/+/, ""); return officeArchivePath + (clean === "/" ? "" : clean); }',
    'function publicRouteAlias(pathname){ const clean = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname; if (clean === "/tracing") return "/trace-burn-intelligence"; return pathname; }',
    'async function proxyDiffsRoute(request){ const url = new URL(request.url); const clean = url.pathname.endsWith("/") && url.pathname !== "/" ? url.pathname.slice(0, -1) : url.pathname; if (clean !== "/diffs" && !url.pathname.startsWith("/diffs/")) return null; const target = new URL("https://diffs.consuelohq.com"); target.pathname = clean === "/diffs" ? "/" : url.pathname.slice("/diffs".length); target.search = url.search; return fetch(target, { method: request.method, headers: request.headers }); }',
    "function latestTraceDb(){ try { const root = `${process.env.HOME || \"/Users/kokayi\"}/Library/Application Support/OpenWorkspace/traces`; const entries = Array.from(new Bun.Glob(\"*/traces.db\").scanSync({ cwd: root, absolute: true })); return entries.map((path) => { try { return { path, mtime: Bun.file(path).lastModified || 0 }; } catch { return null; } }).filter(Boolean).sort((left, right) => right.mtime - left.mtime)[0]?.path || \"\"; } catch { return \"\"; } }",
    "function sqlQuote(value){ return \"'\" + String(value || \"\").replaceAll(\"'\", \"''\") + \"'\"; }",
    "function compactBatchResult(result){ if (!result || typeof result !== \"object\" || Array.isArray(result)) return result; const output = {}; for (const key of [\"apiVersion\",\"ok\",\"code\",\"message\",\"traceId\",\"trace_id\",\"durationMs\",\"duration_ms\",\"totalTokens\",\"total_tokens\",\"inputTokens\",\"input_tokens\",\"outputTokens\",\"output_tokens\",\"exitCode\",\"exit_code\",\"tool\",\"changed\",\"costLabel\"]) if (result[key] !== undefined) output[key] = result[key]; const data = result.data; if (data && typeof data === \"object\" && !Array.isArray(data)){ const compactData = {}; for (const key of [\"language\",\"mode\",\"runtime\",\"cwd\",\"filesChanged\",\"truncated\",\"exitCode\",\"exit_code\",\"durationMs\",\"totalTokens\",\"inputTokens\",\"outputTokens\",\"ok\",\"code\",\"message\"]) if (data[key] !== undefined) compactData[key] = data[key]; for (const key of [\"stderr\",\"stdout\"]){ const value = data[key]; if (typeof value === \"string\" && value) compactData[key] = value.slice(0, 2000); } if (Object.keys(compactData).length) output.data = compactData; } if (typeof result.stderr === \"string\" && result.stderr) output.stderr = result.stderr.slice(0, 2000); return output; }",
    "function enrichTraceRowsWithBatchResults(payload){ try { const rows = Array.isArray(payload) ? payload : Array.isArray(payload.rows) ? payload.rows : Array.isArray(payload.traces) ? payload.traces : []; const ids = rows.filter((row) => row && typeof row === \"object\" && (row.name || row.traceName || row.tool) === \"batch\" && (row.traceId || row.trace_id)).map((row) => String(row.traceId || row.trace_id)); if (!ids.length) return payload; const db = latestTraceDb(); if (!db) return payload; const query = `SELECT trace_id, coalesce(json_extract(result_json, '$.data.results'), json_extract(result_json, '$.data.data.results')) AS batch_results_json FROM tool_traces WHERE tool='batch' AND trace_id IN (${ids.map(sqlQuote).join(\",\")})`; const result = Bun.spawnSync([\"sqlite3\", \"-cmd\", \".timeout 1000\", \"-json\", db, query]); if (result.exitCode !== 0) return payload; const text = new TextDecoder().decode(result.stdout).trim(); if (!text) return payload; const batchRows = JSON.parse(text); const byTrace = new Map(batchRows.map((row) => { try { return [String(row.trace_id), JSON.parse(row.batch_results_json || \"[]\").map(compactBatchResult)]; } catch { return [String(row.trace_id), []]; } })); for (const row of rows){ const traceId = row && typeof row === \"object\" ? String(row.traceId || row.trace_id || \"\") : \"\"; const results = byTrace.get(traceId); if (results && results.length){ row.batchResultsJson = results; row.batchResultsCount = results.length; } } return payload; } catch { return payload; } }",
    "async function liveTracesResponse(filePath){ try { const payload = JSON.parse(await Bun.file(filePath).text()); const enriched = enrichTraceRowsWithBatchResults(payload); return new Response(JSON.stringify(enriched), { headers: h(\"application/json; charset=utf-8\") }); } catch { return new Response(Bun.file(filePath), { headers: h(\"application/json; charset=utf-8\") }); } }",
    'function renderSitesLauncher(){ return ' + JSON.stringify(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Consuelo OS Sites</title>
  <style>
    :root { color-scheme: dark; background: #070708; color: #f2eee6; font-family: "Geist Mono", "Geist", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #070708; color: #f2eee6; font-size: 13px; line-height: 1.35; font-weight: 400; letter-spacing: 0.02em; } @media (max-width: 1024px) { body { font-size: clamp(10.3px, 2.62vw, 12.7px); line-height: 1.34; } main { padding: clamp(28px, 5.4vw, 42px) clamp(10px, 2.5vw, 24px); } .block { margin: 22px 0; } .rule { margin: 22px 0; } li { margin: 2.35px 0; } } @media (max-width: 430px) { body { font-size: clamp(9.9px, 2.42vw, 11.5px); line-height: 1.32; } main { padding: 40px 10px; } li, .blog-item { white-space: nowrap; } }
    main { padding: 32px 30px; max-width: none; }
    h1, p { margin: 0; font: inherit; }
    h1 { margin-bottom: 24px; text-transform: uppercase; }
    .block { margin: 22px 0; }
    .rule { margin: 22px 0; color: inherit; }
    .label { text-transform: uppercase; }
    ul { list-style: none; margin: 0; padding: 0 0 0 18px; }
    li { margin: 2px 0; white-space: nowrap; }
    li::before { content: "- "; }
    a { color: #9aa6ff; text-decoration: underline; text-underline-offset: 2px; } .md-label { color: #f2eee6; } .blog-item { white-space: nowrap; } @media (max-width: 720px) { .blog-item { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.35; } }
  </style>
</head>
<body>
  <main>
    <h1>CONSUELO OS █</h1>
    <p class="rule">~~~</p>
    <section class="block" aria-label="Profile">
      <p><span class="label">CONTACT:</span> SUPPORT@CONSUELOHQ.COM</p>
      <p><span class="label">LOCATION:</span> USA</p>
      <p><span class="label">STATUS:</span> ONLINE</p>
      <p><span class="label">OPEN POSITION:</span></p>
      <ul>
        <li><span class="md-label">[Systems Engineer](</span><a href="https://consuelohq.com/contact/" target="_blank" rel="noopener noreferrer">/careers/systems-engineer</a><span class="md-label">)</span></li>
      </ul>
    </section>
    <p class="rule">~~~</p>
    <section class="block" aria-label="Sites">
      <p class="label">SITES:</p>
      <ul>
        <li><span class="md-label">[GTM](</span><a href="https://app.consuelohq.com/welcome" data-hotkey="1" target="_blank" rel="noopener noreferrer">${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/gtm</a><span class="md-label">)</span></li>
        <li><span class="md-label">[Office](</span><a href="${DESIGN_ARCHIVE_PUBLIC_ORIGIN}${DESIGN_ARCHIVE_OFFICE_PATH}" data-hotkey="2" target="_blank" rel="noopener noreferrer">${DESIGN_ARCHIVE_PUBLIC_ORIGIN}${DESIGN_ARCHIVE_OFFICE_PATH}</a><span class="md-label">)</span></li>
        <li><span class="md-label">[Tracing](</span><a href="${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/tracing" data-hotkey="3" target="_blank" rel="noopener noreferrer">${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/tracing</a><span class="md-label">)</span></li>
        <li><span class="md-label">[Diffs](</span><a href="${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/diffs" data-hotkey="4" target="_blank" rel="noopener noreferrer">${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/diffs</a><span class="md-label">)</span></li>
        <li><span class="md-label">[Documentation](</span><a href="${DESIGN_DOCS_URL}" data-hotkey="5" target="_blank" rel="noopener noreferrer">${DESIGN_DOCS_URL}</a><span class="md-label">)</span></li>
      </ul>
    </section>
    <p class="rule">~~~</p>
    <section class="block" aria-label="Writing">
      <p class="label">WRITING:</p>
      <ul>
        <li class="blog-item"><span class="md-label">[On Decision Loops](</span><a href="${DESIGN_DECISION_INFRASTRUCTURE_URL}" target="_blank" rel="noopener noreferrer">/writing/on-decision-loops</a><span class="md-label">)</span></li>
      </ul>
    </section>
  </main>
  <script>
    const siteHotkeys = {
      "1": "https://app.consuelohq.com/welcome",
      "2": "${DESIGN_ARCHIVE_PUBLIC_ORIGIN}${DESIGN_ARCHIVE_OFFICE_PATH}",
      "3": "${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/tracing",
      "4": "${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/diffs",
      "5": "${DESIGN_DOCS_URL}",
    };

    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target;
      const tagName = target && target.tagName ? target.tagName.toLowerCase() : "";
      if (tagName === "input" || tagName === "textarea" || (target && target.isContentEditable)) return;
      const href = siteHotkeys[event.key];
      if (!href) return;
      event.preventDefault();
      window.location.assign(href);
    });
  </script>
</body>
</html>`) + '; }',
    `function renderVersionHistoryPage(page){ const versions = Array.isArray(page && page.versions) ? page.versions : []; const safe = (value) => String(value || "").replace(/[&<>"]/g, (char) => char === "&" ? "&amp;" : char === "<" ? "&lt;" : char === ">" ? "&gt;" : "&quot;"); const items = versions.map((version) => '<li><a href="' + safe(officePathFor(version.path)) + '">' + safe(version.versionId || "version") + '</a><span>' + safe(version.updatedAt || version.publishedAt || "") + '</span></li>').join(""); return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Archived versions - ' + safe(page && page.title ? page.title : "Design artifact") + '</title></head><body data-version-count="' + versions.length + '"><main><p><a href="' + safe(page && page.path ? officePathFor(page.path) : officeArchivePath) + '">Current version</a></p><h1>Archived versions</h1><ol>' + items + '</ol><p><a href="' + safe(officeArchivePath) + '">Open Consuelo Sites</a></p></main></body></html>'; }`,
    'function entryForVersionRoute(pages, pathname){ const pageList = Object.values(pages || {}); for (const page of pageList){ if (!page || !page.path) continue; const base = page.path.endsWith("/") ? page.path.slice(0, -1) : page.path; const historyPath = base + "/versions"; if (pathname === historyPath || pathname === historyPath + "/") return { kind: "history", page }; if (pathname.startsWith(historyPath + "/")){ const parts = pathname.slice((historyPath + "/").length).split("/").filter(Boolean); const versionId = parts.shift(); const version = Array.isArray(page.versions) ? page.versions.find((item) => item && item.versionId === versionId) : null; if (version) return { kind: "version", page, version, suffix: parts.join("/") }; } } return null; }',
    'Bun.serve({ hostname: ' + JSON.stringify(ip) + ', port, async fetch(request){ try { const url = new URL(request.url); const cleanArchivePath = url.pathname.endsWith("/") && url.pathname !== "/" ? url.pathname.slice(0, -1) : url.pathname; if (url.pathname === "/") return new Response(renderSitesLauncher(), { headers: h("text/html; charset=utf-8", "launcher") }); if (archivePaths.includes(url.pathname) || archivePaths.includes(cleanArchivePath)) return new Response(Bun.file(indexPath), { headers: h("text/html; charset=utf-8") }); const diffs = await proxyDiffsRoute(request); if (diffs) return diffs; const routePathname = publicRouteAlias(url.pathname); const pagefind = pagefindSuffix(routePathname); if (pagefind !== null){ const p = safeJoin(pagefindRoot, pagefind); if (p){ const response = await servePath(p); if (response) return response; } } const canonicalPathname = stripArtifactAlias(routePathname); if (canonicalPathname === "/trace-burn-intelligence/live-traces.json"){ const p = safeJoin(archiveRoot, "artifacts" + canonicalPathname); if (p) return liveTracesResponse(p); } const pages = await readPages(); const versionRoute = entryForVersionRoute(pages, canonicalPathname); if (versionRoute){ if (versionRoute.kind === "history") return new Response(renderVersionHistoryPage(versionRoute.page), { headers: h("text/html; charset=utf-8") }); const suffix = versionRoute.suffix || ""; if (versionRoute.version && versionRoute.version.artifactPath){ const p = safeJoin(archiveRoot, versionRoute.version.artifactPath + (suffix ? "/" + suffix : "")); if (p){ const response = await servePath(p); if (response) return response; } } const proxied = await proxyEntry(versionRoute.version, request, suffix); if (proxied) return proxied; return new Response("version not found", { status: 404, headers: h() }); } const entries = await readEntries(); const entry = entries.find((item) => canonicalPathname === item.path || canonicalPathname.startsWith(item.path + "/")); if (entry){ const raw = canonicalPathname.slice(entry.path.length); const suffix = raw.startsWith("/") ? raw.slice(1) : raw; if (entry.artifactPath){ const p = safeJoin(archiveRoot, entry.artifactPath + (suffix ? "/" + suffix : "")); if (p){ const response = await servePath(p); if (response) return response; } } const proxied = await proxyEntry(entry, request, suffix); if (proxied) return proxied; } const direct = safeJoin(archiveRoot, "artifacts" + canonicalPathname); if (direct){ const response = await servePath(direct); if (response) return response; } return new Response("not found", { status: 404, headers: h() }); } catch { return new Response("archive server error", { status: 500, headers: h() }); } } });',
  ];
  writeFileSync(DESIGN_ARCHIVE_SERVER_PATH, lines.join('\n') + '\n');
}


function normalizeArchivePayload(parsed: Partial<DesignArchivePayload>): DesignArchivePayload {
  const now = new Date().toISOString();
  const rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
  const parsedPages = parsed.pages && typeof parsed.pages === 'object' && !Array.isArray(parsed.pages) ? parsed.pages : {};
  const pages: Record<string, DesignArchivePage> = { ...parsedPages };

  for (const entry of rawEntries) {
    const pageId = entry.pageId ?? entry.id ?? slugify(entry.path);
    const versionId = entry.currentVersionId ?? archiveVersionIdFromDate(entry.updatedAt || entry.publishedAt || now);
    if (!pages[pageId]) {
      const versionPath = archiveVersionedServePath(entry.path, versionId);
      const version: DesignArchivePageVersion = {
        id: `${pageId}-${versionId}`,
        pageId,
        versionId,
        previousVersionId: null,
        title: entry.title,
        url: `${DESIGN_ARCHIVE_PUBLIC_ORIGIN}${officePathForServePath(versionPath)}`,
        directUrl: `${entry.directUrl.replace(/\/$/, '')}/versions/${versionId}`,
        path: versionPath,
        target: entry.target,
        sourceTarget: entry.sourceTarget,
        artifactPath: entry.artifactPath,
        template: entry.template,
        category: entry.category,
        publishedAt: entry.updatedAt || entry.publishedAt || now,
        updatedAt: entry.updatedAt || entry.publishedAt || now,
      };
      pages[pageId] = {
        id: pageId,
        pageId,
        title: entry.title,
        path: entry.path,
        currentVersionId: versionId,
        versions: [version],
      };
    }
  }

  const entries: DesignArchiveEntry[] = rawEntries.map((entry) => {
    const pageId = entry.pageId ?? entry.id ?? slugify(entry.path);
    const page = pages[pageId];
    return {
      ...entry,
      id: pageId,
      pageId,
      currentVersionId: page?.currentVersionId ?? entry.currentVersionId ?? archiveVersionIdFromDate(entry.updatedAt || entry.publishedAt || now),
      versionCount: page?.versions.length ?? entry.versionCount ?? 1,
    };
  });

  return {
    version: 2,
    updatedAt: parsed.updatedAt ?? now,
    entries,
    pages,
  };
}

function readArchivePayload(): DesignArchivePayload {
  try {
    const parsed = JSON.parse(readFileSync(DESIGN_ARCHIVE_DATA_PATH, 'utf8')) as Partial<DesignArchivePayload>;
    return normalizeArchivePayload(parsed);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { version: 2, updatedAt: new Date().toISOString(), entries: [], pages: {} };
    }
    throw error;
  }
}

function writeArchivePayload(payload: DesignArchivePayload): void {
  mkdirSync(DESIGN_ARCHIVE_ROOT, { recursive: true });
  writeFileSync(DESIGN_ARCHIVE_DATA_PATH, `${JSON.stringify(payload, null, 2)}\n`);
}


function displayTitleForArchiveEntry(entry: DesignArchiveEntry): string {
  const rawTitle = entry.title.trim();
  const dailyDeepIdeaPrefix = /^Daily Deep Idea(?::[^—-]+)?\s*[—-]\s*/i;
  const researchPacketPrefix = /^Research Packet:?\s*/i;
  const withoutPrefix = rawTitle.replace(dailyDeepIdeaPrefix, '').replace(researchPacketPrefix, '').trim();
  return withoutPrefix || rawTitle;
}

function archiveEntryTimestamp(entry: DesignArchiveEntry): string {
  return entry.updatedAt || entry.publishedAt;
}

function archiveEntryFilterType(entry: DesignArchiveEntry): string {
  if (entry.path.split('/').filter(Boolean)[0] === 'website') return 'website';
  if (entry.template === 'guide' || entry.category === 'daily-deep-idea' || entry.category === 'research') return 'guide';
  if (entry.template === 'spec') return 'spec';
  if (entry.template === 'plan') return 'plan';
  return 'uncategorized';
}

function pagefindUrlForArchiveEntry(entry: DesignArchiveEntry): string {
  if (!entry.artifactPath) return entry.path;
  const relativePath = entry.artifactPath.split(path.sep).join('/');
  return relativePath.endsWith('/index.html') ? `/${relativePath}` : `/${relativePath}/index.html`;
}

function rootPathForArchiveEntry(entry: DesignArchiveEntry): string {
  return entry.path.startsWith('/') ? entry.path : `/${entry.path}`;
}

function officePathForServePath(servePath: string): string {
  const rootPath = servePath.startsWith('/') ? servePath : `/${servePath}`;
  return `${DESIGN_ARCHIVE_OFFICE_PATH}${rootPath === '/' ? '' : rootPath}`;
}

function officePathForArchiveEntry(entry: DesignArchiveEntry): string {
  return officePathForServePath(rootPathForArchiveEntry(entry));
}

function publicUrlForArchiveEntry(entry: DesignArchiveEntry): string {
  return officePathForArchiveEntry(entry);
}

function renderArchiveIndex(payload: DesignArchivePayload): string {
  const visibleEntries = [...payload.entries]
    .filter((entry) => entry.category !== 'research-packet')
    .sort((left, right) => archiveEntryTimestamp(right).localeCompare(archiveEntryTimestamp(left)));
  const renderItems = (entries: DesignArchiveEntry[]) => entries.map((entry) => {
    const timestamp = archiveEntryTimestamp(entry);
    const filterType = archiveEntryFilterType(entry);
    return `
        <article class="post-item" data-template="${escapeHtml(filterType)}" data-category="${escapeHtml(entry.category)}" data-version-count="${escapeHtml(String(entry.versionCount || 1))}">
          <h3><a href="${escapeHtml(publicUrlForArchiveEntry(entry))}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayTitleForArchiveEntry(entry))}</a></h3>
          <div class="post-meta" aria-label="Updated date">▣ Updated <time datetime="${escapeHtml(timestamp)}">${escapeHtml(new Date(timestamp).toLocaleDateString())}</time></div>
          <p>${escapeHtml(entry.path)}</p>
        </article>`;
  }).join('\n');
  const archiveCards = renderItems(visibleEntries);
  const searchEntries = visibleEntries.map((entry) => ({
    id: entry.id,
    title: displayTitleForArchiveEntry(entry),
    path: entry.path,
    url: publicUrlForArchiveEntry(entry),
    artifactPath: entry.artifactPath ? entry.artifactPath.split(path.sep).join('/') : null,
    pagefindUrl: pagefindUrlForArchiveEntry(entry),
    template: archiveEntryFilterType(entry),
    category: entry.category,
    updatedAt: archiveEntryTimestamp(entry),
    currentVersionId: entry.currentVersionId,
    versionCount: entry.versionCount,
  }));
  const searchDataJson = JSON.stringify(searchEntries)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const emptyState = visibleEntries.length === 0 ? '<p class="empty">No published sites yet.</p>' : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Consuelo Sites</title>
  <style>
    :root { color-scheme: light; --paper:#f6efe4; --surface:#fff9f0; --ink:#251d17; --muted:#6f6256; --quiet:#9b8d7f; --line:#decfbc; --soft:#efe3d2; --accent:#78533d; --accent-strong:#e98262; --accent-soft:#ead5bd; --shadow:0 18px 60px rgba(55, 37, 20, .14); }
    @media (prefers-color-scheme: dark) {
      :root { color-scheme: dark; --paper:#0f0f0d; --surface:#191814; --ink:#f2eee6; --muted:#b5aea2; --quiet:#7e776d; --line:#37322b; --soft:#221f1a; --accent:#f0c66d; --accent-strong:#ff8b68; --accent-soft:#352a1c; --shadow:0 28px 90px rgba(0,0,0,.42); }
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; background:var(--paper); }
    body { margin:0; font-family: "Geist Mono", "Geist", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; color:var(--ink); background:var(--paper); }
    ::selection { background:var(--accent-soft); color:var(--ink); }
    .shell { max-width:720px; margin:0 auto; padding:0 22px 40px; }
    .topbar { position:sticky; top:0; z-index:20; display:flex; align-items:center; justify-content:space-between; gap:18px; min-height:74px; border-bottom:1px solid var(--line); background:color-mix(in srgb, var(--paper) 86%, transparent); backdrop-filter:blur(18px); }
    .brand { color:var(--ink); font-size:20px; font-weight:800; letter-spacing:.01em; text-decoration:none; }
    .nav { display:flex; align-items:center; gap:18px; font-size:13px; }
    .nav a { color:var(--ink); text-decoration:none; }
    .nav a:hover, .brand:hover, .post-item h3 a:hover, .footer-links a:hover, .page-button:hover, .search-button:hover { color:var(--accent-strong); text-decoration-line:underline; text-decoration-style:dotted; text-decoration-thickness:1px; text-underline-offset:4px; }
    .search-mark { font-size:24px; line-height:1; transform:translateY(-1px); }
    .search-button { display:inline-flex; align-items:center; border:0; background:transparent; color:var(--ink); padding:0; font:inherit; cursor:pointer; }
    .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
    header.hero { padding:58px 0 28px; border-bottom:1px solid var(--line); }
    h1 { margin:0 0 20px; font-size:48px; line-height:.98; letter-spacing:-.06em; font-weight:850; }
    .lead { margin:0 0 20px; color:var(--muted); font-size:15px; line-height:1.7; max-width:60ch; }
    .filter-row, .pagination, .search-row { display:flex; align-items:center; gap:9px; flex-wrap:wrap; font-size:14px; }
    .search-row { margin-top:18px; padding:10px 12px; border:1px solid var(--line); border-radius:14px; background:var(--surface); box-shadow:var(--shadow); }
    .search-row[hidden] { display:none; }
    .filter-label { color:var(--muted); }
    .search-input { min-width:0; flex:1 1 220px; border:0; border-bottom:1px solid var(--line); border-radius:0; padding:2px 0 5px; background:transparent; color:var(--ink); font:inherit; outline:none; }
    .search-input::placeholder { color:var(--quiet); }
    .search-input:focus { border-bottom-color:var(--accent-strong); }
    button { appearance:none; border:0; background:transparent; color:var(--ink); padding:0; font:inherit; cursor:pointer; }
    button:hover { color:var(--accent-strong); text-decoration-line:underline; text-decoration-style:dotted; text-decoration-thickness:1px; text-underline-offset:4px; }
    button:focus-visible, a:focus-visible, .search-input:focus-visible { outline:2px solid var(--accent-strong); outline-offset:3px; }
    button.active { color:var(--accent-strong); font-weight:800; }
    button.active::before { content:"["; color:var(--quiet); }
    button.active::after { content:"]"; color:var(--quiet); }
    .section { padding:44px 0 34px; border-bottom:1px solid var(--line); }
    .section[data-empty="true"] { display:none; }
    h2 { margin:0 0 24px; font-size:25px; line-height:1.15; letter-spacing:-.04em; font-weight:850; }
    .post-list { display:grid; gap:26px; }
    .post-item { padding:2px 0; }
    .post-item[hidden] { display:none; }
    .post-item h3 { margin:0 0 6px; font-size:17px; line-height:1.45; letter-spacing:-.02em; font-weight:600; }
    .post-item h3 a { color:inherit; text-decoration:none; }
    .post-meta { color:var(--quiet); font-size:13px; line-height:1.3; margin-bottom:4px; }
    .post-item p { margin:0; color:var(--quiet); font-size:13px; line-height:1.55; overflow-wrap:anywhere; }
    .empty { color:var(--quiet); font-size:14px; }
    mark, .pagefind-ui__result-excerpt mark { background:var(--accent-soft); color:var(--ink); }
    .pagination { margin-top:28px; color:var(--quiet); }
    .page-status { color:var(--quiet); }
    .page-button[disabled] { color:var(--quiet); cursor:default; text-decoration:none; }
    footer { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:24px 0 0; color:var(--muted); font-size:13px; }
    .footer-links { display:flex; gap:10px; }
    .footer-links a { color:var(--ink); text-decoration:none; }
    .palette-backdrop { position:fixed; inset:0; z-index:80; display:flex; align-items:flex-start; justify-content:center; padding:10vh 18px 18px; background:rgba(5,5,4,.68); backdrop-filter:blur(10px); }
    .palette-backdrop[hidden] { display:none; }
    .palette { width:min(720px, 100%); border:1px solid var(--line); border-radius:18px; background:var(--surface); box-shadow:0 30px 100px rgba(0,0,0,.45); overflow:hidden; }
    .palette-head { padding:18px 22px 20px; border-bottom:1px solid var(--line); }
    .palette-kicker { margin:0 0 4px; color:var(--accent); font-size:12px; font-weight:850; letter-spacing:.16em; text-transform:uppercase; }
    .palette h2 { margin:0 0 8px; font-size:31px; }
    .palette p { margin:0; color:var(--muted); font-size:14px; line-height:1.5; }
    .palette-search { width:100%; border:0; border-bottom:1px solid var(--line); padding:14px 22px; background:var(--soft); color:var(--ink); font:inherit; outline:none; }
    .palette-list { max-height:420px; overflow:auto; padding:8px; }
    .command { width:100%; display:grid; grid-template-columns:72px 1fr auto; gap:14px; align-items:center; padding:11px 12px; border-radius:13px; text-align:left; }
    .command:hover, .command.active { background:var(--accent-soft); text-decoration:none; }
    .key { justify-self:start; min-width:48px; padding:7px 10px; border:1px solid var(--line); border-radius:10px; color:var(--accent); background:var(--soft); font-weight:850; text-align:center; }
    .command strong { display:block; margin-bottom:2px; font-size:15px; }
    .command span { color:var(--muted); font-size:13px; line-height:1.35; }
    .kind { color:var(--quiet); font-size:12px; letter-spacing:.12em; text-transform:uppercase; }
    .palette-foot { display:flex; gap:10px; align-items:center; padding:10px 18px; border-top:1px solid var(--line); color:var(--muted); font-size:12px; }
    .kbd { padding:2px 6px; border:1px solid var(--line); border-radius:6px; background:var(--soft); color:var(--accent); font-weight:800; }
    @media (max-width: 680px) {
      .shell { padding-inline:18px; }
      .topbar { align-items:flex-start; flex-direction:column; padding:20px 0; }      .nav { gap:14px; flex-wrap:wrap; }
      header.hero { padding-top:44px; }
      h1 { font-size:42px; }
      footer { flex-direction:column; align-items:flex-start; }
      .command { grid-template-columns:56px 1fr; }
      .kind { display:none; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="topbar" data-pagefind-ignore>
      <a class="brand" href="${escapeHtml(DESIGN_ARCHIVE_OFFICE_PATH)}">Office</a>
      <nav class="nav" aria-label="Primary">
        <a href="#recently-updated">Recently Updated</a>
        <button class="search-button" type="button" data-palette-open aria-label="Open command palette">⌘K</button>
        <button class="search-button" type="button" data-search-toggle aria-controls="sites-search" aria-expanded="false"><span class="search-mark" aria-hidden="true">⌕</span><span class="sr-only">Search</span></button>
      </nav>
    </div>
    <header class="hero" data-pagefind-ignore>
      <h1>Office</h1>
      <p class="lead">Private tailnet sites, guides, and published artifacts from Consuelo.</p>
      <div class="filter-row" aria-label="Filters">
        <span class="filter-label">Filters:</span>
        <button class="active" data-filter="all">All</button>
        <button data-filter="website">Website</button>
        <button data-filter="guide">Guide</button>
        <button data-filter="spec">Spec</button>
        <button data-filter="plan">Plan</button>
        <button data-filter="uncategorized">Uncategorized</button>
      </div>
      <label class="search-row" hidden>
        <span class="filter-label">Search:</span>
        <input id="sites-search" class="search-input" type="search" placeholder="type to filter the sites archive" autocomplete="off" spellcheck="false" />
      </label>
    </header>
    <section class="section" id="recently-updated" data-section="recently-updated" data-empty="${visibleEntries.length === 0}" data-pagefind-ignore>
      <h2 data-results-title>Recently Updated</h2>
      <div class="post-list" data-results-list>${archiveCards}</div>
      <nav class="pagination" aria-label="Recently updated pagination" hidden data-pagefind-ignore>
        <button class="page-button" data-page="prev" type="button">Previous</button>
        <span class="page-status" aria-live="polite"></span>
        <button class="page-button" data-page="next" type="button">Next</button>
      </nav>
    </section>
    ${emptyState}
    <footer data-pagefind-ignore>
      <span>© ${escapeHtml(new Date(payload.updatedAt).getFullYear().toString())} Consuelo. All rights reserved.</span>
    </footer>
  </div>
  <div class="palette-backdrop" data-command-palette hidden data-pagefind-ignore>
    <section class="palette" role="dialog" aria-modal="true" aria-labelledby="command-palette-title">
      <div class="palette-head">
        <p class="palette-kicker">Keyboard Cockpit</p>
        <h2 id="command-palette-title">Jump without hunting.</h2>
        <p>Slash opens this menu. Press G, then a command letter, to jump directly.</p>
      </div>
      <input class="palette-search" data-command-search type="search" placeholder="Search commands, e.g. guides, specs, trace..." autocomplete="off" spellcheck="false" />
      <div class="palette-list" data-command-list></div>
      <div class="palette-foot"><span class="kbd">/</span> open <span class="kbd">Esc</span> close <span class="kbd">G</span> then letter jumps <span class="kbd">Enter</span> run</div>
    </section>
  </div>
  <script type="application/json" id="archive-search-data">${searchDataJson}</script>
  <script>
    const pageSize = 10;
    const archiveEntries = JSON.parse(document.getElementById('archive-search-data').textContent || '[]');
    let activeFilter = 'all';
    let currentPage = 1;
    let activeQuery = '';
    let activeMode = 'archive';
    let pagefind = null;
    let pagefindLoadStarted = false;
    let awaitingGoCommand = false;
    const list = document.querySelector('[data-results-list]');
    const title = document.querySelector('[data-results-title]');
    const originalCardsHtml = list.innerHTML;
    const section = document.querySelector('[data-section="recently-updated"]');
    const pagination = document.querySelector('.pagination');
    const pageStatus = document.querySelector('.page-status');
    const prevButton = document.querySelector('[data-page="prev"]');
    const nextButton = document.querySelector('[data-page="next"]');
    const searchToggle = document.querySelector('[data-search-toggle]');
    const searchRow = document.querySelector('.search-row');
    const searchInput = document.querySelector('#sites-search');
    const palette = document.querySelector('[data-command-palette]');
    const paletteOpen = document.querySelector('[data-palette-open]');
    const commandSearch = document.querySelector('[data-command-search]');
    const commandList = document.querySelector('[data-command-list]');

    const escapeText = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const normalizeUrl = (value) => {
      let normalized = String(value || '');
      try { normalized = new URL(normalized).pathname; } catch { /* keep relative path */ }
      if (normalized.startsWith('${escapeHtml(DESIGN_ARCHIVE_OFFICE_PATH)}')) normalized = normalized.slice('${escapeHtml(DESIGN_ARCHIVE_OFFICE_PATH)}'.length);
      if (normalized.startsWith('${escapeHtml(DESIGN_ARCHIVE_PATH)}')) normalized = normalized.slice('${escapeHtml(DESIGN_ARCHIVE_PATH)}'.length);
      if (normalized.startsWith('${escapeHtml(DESIGN_ARCHIVE_LEGACY_PATH)}')) normalized = normalized.slice('${escapeHtml(DESIGN_ARCHIVE_LEGACY_PATH)}'.length);
      if (normalized.startsWith('${escapeHtml(DESIGN_ARCHIVE_OFFICE_PATH)}')) normalized = normalized.slice('${escapeHtml(DESIGN_ARCHIVE_OFFICE_PATH)}'.length);
      while (normalized.startsWith('/')) normalized = normalized.slice(1);
      if (normalized.endsWith('/index.html')) normalized = normalized.slice(0, -'/index.html'.length);
      if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
      return normalized;
    };
    const entryMatchesFilter = (entry) => activeFilter === 'all' || entry.template === activeFilter;
    const localEntryMatchesQuery = (entry) => {
      const query = activeQuery.trim().toLowerCase();
      if (!query) return true;
      return [entry.title, entry.path, entry.template, entry.category].some((value) => String(value || '').toLowerCase().includes(query));
    };
    const entryForPagefindData = (data) => {
      const normalized = normalizeUrl(data && data.url);
      return archiveEntries.find((entry) => {
        const artifactPath = normalizeUrl(entry.artifactPath || '');
        const pagefindUrl = normalizeUrl(entry.pagefindUrl || '');
        const pathUrl = normalizeUrl(entry.path || '');
        return normalized === artifactPath || normalized === pagefindUrl || normalized === pathUrl || normalized.startsWith(artifactPath + '/') || normalized.startsWith(pagefindUrl + '/');
      }) || null;
    };
    const openLink = (href) => { window.open(href, '_blank', 'noopener,noreferrer'); };
    const renderCard = (entry, fallback) => {
      const updatedAt = entry && entry.updatedAt ? entry.updatedAt : '';
      const date = updatedAt ? new Date(updatedAt).toLocaleDateString() : '';
      const href = entry && entry.url ? entry.url : (fallback && fallback.url ? fallback.url : '#');
      const cardTitle = entry && entry.title ? entry.title : (fallback && fallback.meta && fallback.meta.title ? fallback.meta.title : (fallback && fallback.title ? fallback.title : 'Untitled'));
      const cardPath = entry && entry.path ? entry.path : (fallback && fallback.url ? fallback.url : '');
      const filter = entry && entry.template ? entry.template : 'uncategorized';
      const category = entry && entry.category ? entry.category : '';
      return '<article class="post-item" data-template="' + escapeText(filter) + '" data-category="' + escapeText(category) + '">' +
        '<h3><a href="' + escapeText(href) + '" target="_blank" rel="noopener noreferrer">' + escapeText(cardTitle) + '</a></h3>' +
        '<div class="post-meta" aria-label="Updated date">▣ ' + (date ? escapeText(date) : 'Search result') + '</div>' +
        '<p>' + escapeText(cardPath) + '</p>' +
      '</article>';
    };
    const currentCards = () => Array.from(list.querySelectorAll('.post-item'));
    const filteredCards = () => currentCards().filter((card) => activeFilter === 'all' || card.dataset.template === activeFilter);
    const setArchiveMode = () => {
      if (activeMode !== 'archive') list.innerHTML = originalCardsHtml;
      activeMode = 'archive';
      title.textContent = 'Recently Updated';
    };
    const renderPage = () => {
      const visibleCards = filteredCards();
      const totalPages = Math.max(1, Math.ceil(visibleCards.length / pageSize));
      currentPage = Math.min(currentPage, totalPages);
      const start = (currentPage - 1) * pageSize;
      const end = start + pageSize;
      currentCards().forEach((card) => { card.hidden = true; });
      visibleCards.slice(start, end).forEach((card) => { card.hidden = false; });
      section.hidden = visibleCards.length === 0;
      pagination.hidden = visibleCards.length <= pageSize;
      pageStatus.textContent = visibleCards.length === 0 ? 'No results' : 'Page ' + currentPage + ' of ' + totalPages;
      prevButton.disabled = currentPage === 1;
      nextButton.disabled = currentPage === totalPages;
    };
    const applyFilter = (filter, writeHash = true) => {
      activeFilter = filter || 'all';
      currentPage = 1;
      document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item.dataset.filter === activeFilter));
      if (writeHash) location.hash = activeFilter === 'all' ? '' : activeFilter;
      if (activeQuery.trim()) scheduleSearch();
      else { setArchiveMode(); renderPage(); }
    };
    const renderLocalSearch = () => {
      const entries = archiveEntries.filter((entry) => entryMatchesFilter(entry) && localEntryMatchesQuery(entry));
      activeMode = 'search';
      list.innerHTML = entries.map((entry) => renderCard(entry, null)).join('');
      title.textContent = activeQuery.trim() ? 'Search Results' : 'Recently Updated';
      currentPage = 1;
      renderPage();
    };
    const ensurePagefind = () => {
      if (pagefind) return Promise.resolve(pagefind);
      if (pagefindLoadStarted) return Promise.resolve(null);
      pagefindLoadStarted = true;
      return import('${escapeHtml(DESIGN_ARCHIVE_OFFICE_PATH)}/pagefind/pagefind.js').then((module) => {
        pagefind = module;
        return pagefind;
      }, () => null);
    };
    const runSearch = () => {
      const query = activeQuery.trim();
      if (!query) {
        setArchiveMode();
        renderPage();
        return;
      }
      renderLocalSearch();
      ensurePagefind().then((searcher) => {
        if (!searcher || !searcher.search) return null;
        return searcher.search(query).then((response) => Promise.all(response.results.slice(0, 60).map((result) => result.data())));
      }).then((data) => {
        if (!data) return;
        const seen = new Set();
        const cards = [];
        for (const item of data) {
          const entry = entryForPagefindData(item);
          if (entry && !entryMatchesFilter(entry)) continue;
          const key = entry ? entry.id : item.url;
          if (seen.has(key)) continue;
          seen.add(key);
          cards.push(renderCard(entry, item));
        }
        if (cards.length > 0) {
          activeMode = 'search';
          list.innerHTML = cards.join('');
          title.textContent = 'Search Results';
          currentPage = 1;
          renderPage();
        }
      }, () => undefined);
    };
    let searchTimer = null;
    const scheduleSearch = () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => { runSearch(); }, 120);
    };
    document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => applyFilter(button.dataset.filter)));
    searchToggle.addEventListener('click', () => {
      const shouldOpen = searchRow.hidden;
      searchRow.hidden = !shouldOpen;
      searchToggle.setAttribute('aria-expanded', String(shouldOpen));
      if (shouldOpen) searchInput.focus();
      else {
        searchInput.value = '';
        activeQuery = '';
        setArchiveMode();
        renderPage();
      }
    });
    searchInput.addEventListener('input', () => {
      activeQuery = searchInput.value;
      scheduleSearch();
    });
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        searchInput.value = '';
        activeQuery = '';
        searchRow.hidden = true;
        searchToggle.setAttribute('aria-expanded', 'false');
        setArchiveMode();
        renderPage();
      }
    });
    prevButton.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage -= 1;
        renderPage();
      }
    });
    nextButton.addEventListener('click', () => {
      currentPage += 1;
      renderPage();
    });

    const baseCommands = [
      { key: 'O', title: 'Office', description: 'Open the Office archive.', kind: 'link', url: '${escapeHtml(DESIGN_ARCHIVE_OFFICE_PATH)}' },
      { key: 'D', title: 'Documentation', description: 'Open Consuelo docs.', kind: 'link', url: '${escapeHtml(DESIGN_DOCS_URL)}' },
      { key: 'I', title: 'Software Is Becoming Decision Infrastructure', description: 'Open the decision-making under uncertainty essay.', kind: 'link', url: '${escapeHtml(DESIGN_DECISION_INFRASTRUCTURE_URL)}' },
      { key: 'R', title: 'Recently Updated', description: 'Jump to the recently updated list.', kind: 'jump', url: '#recently-updated' },
      { key: 'W', title: 'Website', description: 'Show website artifacts.', kind: 'filter', filter: 'website' },
      { key: 'G', title: 'Guides', description: 'Show guide artifacts.', kind: 'filter', filter: 'guide' },
      { key: 'E', title: 'Specs', description: 'Show specs.', kind: 'filter', filter: 'spec' },
      { key: 'P', title: 'Plans', description: 'Show plans.', kind: 'filter', filter: 'plan' },
    ];
    const entryCommands = archiveEntries.slice(0, 12).map((entry, index) => ({ key: String((index + 1) % 10), title: entry.title, description: entry.path, kind: 'link', url: entry.url }));
    const commands = [...baseCommands, ...entryCommands];
    const runCommandItem = (command) => {
      if (!command) return;
      if (command.kind === 'filter') applyFilter(command.filter);
      else if (command.kind === 'jump') window.location.hash = command.url;
      else if (command.url) openLink(command.url);
      closePalette();
    };
    const renderCommands = () => {
      const query = commandSearch.value.trim().toLowerCase();
      const visible = commands.filter((command) => !query || [command.title, command.description, command.kind, command.key].some((value) => String(value || '').toLowerCase().includes(query)));
      commandList.innerHTML = visible.map((command, index) => '<button class="command' + (index === 0 ? ' active' : '') + '" type="button" data-command-key="' + escapeText(command.key) + '"><span class="key">G' + escapeText(command.key) + '</span><span><strong>' + escapeText(command.title) + '</strong><span>' + escapeText(command.description) + '</span></span><span class="kind">' + escapeText(command.kind) + '</span></button>').join('');
      commandList.querySelectorAll('[data-command-key]').forEach((item) => item.addEventListener('click', () => runCommandItem(commands.find((command) => command.key === item.dataset.commandKey))));
    };
    const openPalette = () => {
      palette.hidden = false;
      commandSearch.value = '';
      renderCommands();
      commandSearch.focus();
    };
    const closePalette = () => {
      palette.hidden = true;
      awaitingGoCommand = false;
    };
    paletteOpen.addEventListener('click', openPalette);
    commandSearch.addEventListener('input', renderCommands);
    commandSearch.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closePalette();
      if (event.key === 'Enter') runCommandItem(commands.find((command) => command.key === commandList.querySelector('.command.active')?.dataset.commandKey));
    });
    document.addEventListener('keydown', (event) => {
      const tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : '';
      const isTyping = tag === 'input' || tag === 'textarea' || event.target?.isContentEditable;
      if (event.key === 'Escape' && !palette.hidden) closePalette();
      if (event.key === '/' && !isTyping) { event.preventDefault(); openPalette(); }
      if (!isTyping && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openPalette(); }
      if (!isTyping && event.key.toLowerCase() === 'g') { awaitingGoCommand = true; window.setTimeout(() => { awaitingGoCommand = false; }, 1200); return; }
      if (!isTyping && awaitingGoCommand) {
        const command = commands.find((item) => item.key.toLowerCase() === event.key.toLowerCase());
        if (command) { event.preventDefault(); runCommandItem(command); }
        awaitingGoCommand = false;
      }
    });
    applyFilter(location.hash ? location.hash.slice(1) : 'all', false);
    renderPage();
  </script>
</body>
</html>\n`;
}
function renderArchiveRootRedirect(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Consuelo OS Sites</title>
  <style>
    :root { color-scheme: dark; background: #070708; color: #f2eee6; font-family: "Geist Mono", "Geist", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #070708; color: #f2eee6; font-size: 13px; line-height: 1.35; font-weight: 400; letter-spacing: 0.02em; } @media (max-width: 1024px) { body { font-size: clamp(10px, 2.55vw, 12.4px); line-height: 1.36; } main { padding: clamp(20px, 4.8vw, 32px) clamp(10px, 2.5vw, 24px); } .block { margin: 23px 0; } .rule { margin: 23px 0; } li { margin: 2.1px 0; } } @media (max-width: 430px) { body { font-size: clamp(9.6px, 2.35vw, 11.2px); line-height: 1.34; } main { padding: 22px 10px; } li, .blog-item { white-space: nowrap; } }
    main { padding: 32px 30px; max-width: none; }
    h1, p { margin: 0; font: inherit; }
    h1 { margin-bottom: 24px; text-transform: uppercase; }
    .block { margin: 22px 0; }
    .rule { margin: 22px 0; color: inherit; }
    .label { text-transform: uppercase; }
    ul { list-style: none; margin: 0; padding: 0 0 0 18px; }
    li { margin: 2px 0; white-space: nowrap; }
    li::before { content: "- "; }
    a { color: #9aa6ff; text-decoration: underline; text-underline-offset: 2px; } .md-label { color: #f2eee6; } .blog-item { white-space: nowrap; } @media (max-width: 720px) { .blog-item { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.35; } }
  </style>
</head>
<body>
  <main>
    <h1>CONSUELO OS █</h1>
    <p class="rule">~~~</p>
    <section class="block" aria-label="Profile">
      <p><span class="label">CONTACT:</span> SUPPORT@CONSUELOHQ.COM</p>
      <p><span class="label">LOCATION:</span> USA</p>
      <p><span class="label">STATUS:</span> ONLINE</p>
      <p><span class="label">OPEN POSITION:</span></p>
      <ul>
        <li><span class="md-label">[Systems Engineer](</span><a href="https://consuelohq.com/contact/" target="_blank" rel="noopener noreferrer">/careers/systems-engineer</a><span class="md-label">)</span></li>
      </ul>
    </section>
    <p class="rule">~~~</p>
    <section class="block" aria-label="Sites">
      <p class="label">SITES:</p>
      <ul>
        <li><span class="md-label">[GTM](</span><a href="https://app.consuelohq.com/welcome" target="_blank" rel="noopener noreferrer">${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/gtm</a><span class="md-label">)</span></li>
        <li><span class="md-label">[Office](</span><a href="${DESIGN_ARCHIVE_PUBLIC_ORIGIN}${DESIGN_ARCHIVE_OFFICE_PATH}" target="_blank" rel="noopener noreferrer">${DESIGN_ARCHIVE_PUBLIC_ORIGIN}${DESIGN_ARCHIVE_OFFICE_PATH}</a><span class="md-label">)</span></li>
        <li><span class="md-label">[Tracing](</span><a href="${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/tracing" target="_blank" rel="noopener noreferrer">${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/tracing</a><span class="md-label">)</span></li>
        <li><span class="md-label">[Diffs](</span><a href="${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/diffs" target="_blank" rel="noopener noreferrer">${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/diffs</a><span class="md-label">)</span></li>
        <li><span class="md-label">[Documentation](</span><a href="${DESIGN_DOCS_URL}" target="_blank" rel="noopener noreferrer">${DESIGN_DOCS_URL}</a><span class="md-label">)</span></li>
      </ul>
    </section>
    <p class="rule">~~~</p>
    <section class="block" aria-label="Writing">
      <p class="label">WRITING:</p>
      <ul>
        <li class="blog-item"><span class="md-label">[On Decision Loops](</span><a href="${DESIGN_DECISION_INFRASTRUCTURE_URL}" target="_blank" rel="noopener noreferrer">/writing/on-decision-loops</a><span class="md-label">)</span></li>
      </ul>
    </section>
  </main>
</body>
</html>`;
}

function writeArchiveIndex(payload: DesignArchivePayload): void {
  mkdirSync(DESIGN_ARCHIVE_ROOT, { recursive: true });
  mkdirSync(path.dirname(DESIGN_ARCHIVE_INDEX_PATH), { recursive: true });
  writeFileSync(DESIGN_ARCHIVE_ROOT_REDIRECT_PATH, renderArchiveRootRedirect());
  writeFileSync(DESIGN_ARCHIVE_INDEX_PATH, renderArchiveIndex(payload));
}

async function runPagefindIndex(): Promise<void> {
  rmSync(DESIGN_ARCHIVE_PAGEFIND_ROOT, { recursive: true, force: true });
  const result = await runCommand(['bunx', '--bun', 'pagefind', '--site', DESIGN_ARCHIVE_ROOT, '--output-subdir', 'pagefind'], REPO_ROOT);
  if (result.exitCode !== 0) {
    throw new Error(`pagefind indexing failed: ${result.stderr || result.stdout || `exit ${result.exitCode}`}`);
  }
}

async function updateDesignArchive(args: ParsedArgs, servePath: string, url: string, archiveTarget: string, sourceTarget: string, artifactPath: string | null, versionArtifactPath: string | null, versionTarget: string | null, versionId: string, publishedAt: string, tailscaleSelf: TailscaleSelf, tailscaleBin: string): Promise<{ path: string; url: string; directUrl: string; target: string; entries: number }> {
  try {
    const now = publishedAt;
    const payload = readArchivePayload();
    const pageId = slugify(servePath);
    const title = archiveTitleFromArgs(args, servePath);
    const template = archiveTemplateFromArgs(args);
    const category = archiveCategoryFromArgs(args, servePath);
    const existing = payload.entries.find((entry) => entry.path === servePath);
    const previousPage = payload.pages[pageId];
    const previousVersions = previousPage?.versions.filter((item) => item.versionId !== versionId) ?? [];
    const previousVersionId = previousPage?.currentVersionId ?? existing?.currentVersionId ?? null;
    const versionPath = archiveVersionedServePath(servePath, versionId);
    const version: DesignArchivePageVersion = {
      id: `${pageId}-${versionId}`,
      pageId,
      versionId,
      previousVersionId,
      title,
      url: `${DESIGN_ARCHIVE_PUBLIC_ORIGIN}${officePathForServePath(versionPath)}`,
      directUrl: archiveDirectUrlForPath(tailscaleSelf, versionPath),
      path: versionPath,
      target: versionTarget ?? archiveTarget,
      sourceTarget,
      artifactPath: versionArtifactPath,
      template,
      category,
      publishedAt: now,
      updatedAt: now,
    };
    const page: DesignArchivePage = {
      id: pageId,
      pageId,
      title,
      path: servePath,
      currentVersionId: versionId,
      versions: [version, ...previousVersions],
    };
    payload.pages[pageId] = page;
    const entry: DesignArchiveEntry = {
      id: pageId,
      pageId,
      title,
      url,
      directUrl: archiveDirectUrlForPath(tailscaleSelf, officePathForServePath(servePath)),
      path: servePath,
      target: archiveTarget,
      sourceTarget,
      artifactPath,
      template,
      category,
      publishedAt: existing?.publishedAt ?? now,
      updatedAt: now,
      currentVersionId: versionId,
      versionCount: page.versions.length,
    };
    payload.entries = [entry, ...payload.entries.filter((item) => item.path !== servePath)];
    payload.updatedAt = now;
    writeArchivePayload(payload);
    writeArchiveIndex(payload);
    await runPagefindIndex();
    const wikiTarget = await ensureArchiveServer(tailscaleSelf.ip);
    const archiveUrl = `${DESIGN_ARCHIVE_PUBLIC_ORIGIN}${DESIGN_ARCHIVE_OFFICE_PATH}`;
    const archiveDirectUrl = `http://${tailscaleSelf.ip}:${DESIGN_ARCHIVE_PORT}${DESIGN_ARCHIVE_OFFICE_PATH}`;
    const archiveResult = await setArchiveServePaths(tailscaleBin, wikiTarget);
    return { path: DESIGN_ARCHIVE_OFFICE_PATH, url: archiveUrl, directUrl: archiveDirectUrl, target: wikiTarget, entries: payload.entries.length };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to update Consuelo Sites archive: ${message}`);
  }
}

async function publishDesign(args: ParsedArgs): Promise<void> {
  try {
    if (!args.target && !args.portlessName) {
      throw new Error('design publish requires --target <url-or-file-or-directory> or --portless-name <name>');
    }

    const tailscaleBin = args.tailscaleBin ?? 'tailscale';
    const servePath = normalizeServePath(args);
    const resolvedTarget = args.target ?? (args.dryRun ? (args.portlessName?.endsWith('.localhost') ? `https://${args.portlessName}:1355` : `http://${args.portlessName}.localhost:1355`) : await resolvePortlessTarget(args.portlessName as string));
    const normalizedTarget = normalizeTarget(resolvedTarget);
    const tailscaleSelf = args.dryRun ? { hostname: '<tailscale-host>', ip: '<tailscale-ip>' } : await getTailscaleSelf(tailscaleBin);
    const archiveTarget = `http://${tailscaleSelf.ip}:${DESIGN_ARCHIVE_PORT}`;
    const command = [tailscaleBin, 'serve', '--bg', '--yes', '--set-path', servePath, archiveTarget];
    const hostname = tailscaleSelf.hostname;
    const publicServePath = officePathForServePath(servePath);
    const url = `${DESIGN_ARCHIVE_PUBLIC_ORIGIN}${publicServePath}`;
    const directUrl = `http://${tailscaleSelf.ip}:${DESIGN_ARCHIVE_PORT}${publicServePath}`;
    const archivePlan = {
      path: DESIGN_ARCHIVE_PATH,
      url: args.dryRun ? `${DESIGN_ARCHIVE_PUBLIC_ORIGIN}${DESIGN_ARCHIVE_OFFICE_PATH}` : null,
      directUrl: args.dryRun ? `http://${tailscaleSelf.ip}:${DESIGN_ARCHIVE_PORT}${DESIGN_ARCHIVE_OFFICE_PATH}` : null,
      target: `http://${tailscaleSelf.ip}:${DESIGN_ARCHIVE_PORT}`,
    };
    const publishedAt = new Date();
    const versionId = archiveVersionIdFromDate(publishedAt);
    const existingPayload = readArchivePayload();
    const revisionGuard = assertArchiveRevisionWritable(args, existingPayload, servePath);
    const plan = {
      ok: true,
      mode: 'tailscale-serve',
      public: false,
      host: hostname,
      path: servePath,
      url,
      directUrl,
      target: archiveTarget,
      portlessName: args.portlessName ?? null,
      template: archiveTemplateFromArgs(args),
      archive: archivePlan,
      sourceTarget: normalizedTarget,
      versionId,
      currentVersionId: revisionGuard.currentVersionId,
      requiredBaseVersion: revisionGuard.requiredBaseVersion,
      forcePublish: args.forcePublish,
      command,
    };

    if (args.dryRun) {
      if (args.json) printJson(plan);
      else writeStdout(`design publish dry-run\nurl: ${url}\ntarget: ${archiveTarget}\ncommand: ${command.join(' ')}\n`);
      return;
    }

    const materialized = materializeArchiveTarget(normalizedTarget, servePath, versionId);
    const archive = await updateDesignArchive(args, servePath, url, materialized.target, materialized.sourceTarget, materialized.artifactPath, materialized.versionArtifactPath, materialized.versionTarget, versionId, publishedAt.toISOString(), tailscaleSelf, tailscaleBin);
    const publishTarget = archive.target;

    const result = await runCommand([tailscaleBin, 'serve', '--bg', '--yes', '--set-path', servePath, publishTarget], REPO_ROOT);
    if (result.exitCode !== 0) {
      throw new Error(`tailscale serve failed: ${result.stderr || result.stdout || `exit ${result.exitCode}`}`);
    }

    if (args.json) printJson({ ...plan, archive, stdout: result.stdout.trim(), stderr: result.stderr.trim() });
    else if (!args.quiet) writeStdout(`design published\nurl: ${url}\ndirectUrl: ${directUrl}\ntarget: ${archiveTarget}\nsourceTarget: ${normalizedTarget}\nwiki: ${archive.url}\nwikiDirect: ${archive.directUrl}\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to publish design artifact: ${message}`);
  }
}
async function startWorkflowSession(workflow: WorkflowConfig, args: ParsedArgs): Promise<void> {
  try {
    if (!args.live) {
      const workOrder = buildWorkflowWorkOrder(workflow, args);
      if (args.json) {
        printJson(workOrder);
        return;
      }
      writeStdout(`${workflow.title} work order ready\n`);
      writeStdout(`mode: headless-work-order\n`);
      writeStdout(`skill: ${workflow.skillId}\n`);
      writeStdout(`artifact: ${workOrder.artifact.name}\n`);
      if (workOrder.workOrderPath) writeStdout(`workOrder: ${path.relative(REPO_ROOT, workOrder.workOrderPath)}\n`);
      writeStdout('next: create/edit the local artifact source directly, validate in browser, then publish with design.publish. Use --live only for a headed Open Design UI session.\n');
      return;
    }

    if (args.dryRun) {
      const prompt = buildWorkflowPrompt(workflow, args);
      const plan = {
        workflow: workflow.id,
        mode: 'live-open-design-session',
        startCommand: ['corepack', 'pnpm', 'tools-dev', 'start', 'web', '--json'],
        project: {
          name: args.name ?? `${workflow.projectPrefix} ${timestampLabel()}`,
          skillId: workflow.skillId,
          designSystemId: null,
          metadata: {
            source: 'consuelo-design',
            workflow: workflow.id,
            primarySkill: workflow.skillId,
            fallbackSkillIds: workflow.fallbackSkillIds,
            template: args.template ?? null,
            designSystem: 'consuelo',
          },
          pendingPrompt: prompt,
        },
      };
      if (args.json) printJson(plan);
      else writeStdout(`${workflow.title} live session dry-run\nskill: ${workflow.skillId}\nproject: ${plan.project.name}\n`);
      return;
    }

    const runtime = await startOpenDesign({ ...args, json: true, dryRun: false });
    const project = await createWorkflowProject(workflow, runtime, args);
    await openUrl(project.projectUrl, args);
    if (args.json) {
      printJson({ ok: true, mode: 'live-open-design-session', runtime, project });
      return;
    }
    if (!args.quiet) {
      writeStdout(`${workflow.title} live session ready\n`);
      writeStdout(`project: ${project.name}\n`);
      writeStdout(`skill: ${workflow.skillId}\n`);
      writeStdout(`url: ${project.projectUrl}\n`);
    }
  } catch (error: unknown) {
    writeStderr(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function uiCommand(command: string, args: ParsedArgs): Promise<void> {
  switch (command) {
    case 'ui':
    case 'run':
      return runOpenDesignForeground(args);
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
  run                         Start Open Design daemon + web in foreground
  generate website            Create a headless website work order (use --live for UI)
  generate demo               Create a headless demo work order (use --live for UI)
  generate image-brief        Create a headless image/media work order (use --live for UI)
  generate digital-eguide     Create a headless digital e-guide work order (use --live for UI)
  generate email              Create a headless email work order (use --live for UI)
  generate motion-frame       Create a headless motion-frame work order (use --live for UI)
  render hyperframes          Create a headless HyperFrames work order (use --live for UI)
  publish                     Publish a design artifact through private Tailscale Serve
  refresh                     Regenerate the existing design wiki archive
  list-skills                 Show upstream skills and Consuelo workflow mapping
  list-design-systems         Show Consuelo default plus upstream reference systems
  get-design-system           Print base Consuelo DESIGN.md and consuelo-design AGENTS.md only
  check                       Run package boundary and Railway exclusion checks
  ui:bg|ui:status|ui:logs|ui:stop  Manage Open Design background runtime
  od:build                    Build the Open Design daemon CLI

Flags:
  --json                      Print structured JSON where supported
  --quiet                     Suppress success text where supported
  --dry-run                   Print the work order plan without writing files or starting runtimes
  --live                      Start/open a headed Open Design UI session instead of headless work-order mode
  --name <name>               Override generated Open Design project name
  --prompt <brief>            Attach Ko's brief to the generated work order
  --template <spec|plan|guide>  Select/archive a typed reader-shell template for generate/publish
  --target <url|path>          Target URL/file/directory for publish
  --portless-name <name>        Resolve target with portless get <name>
  --path <path>                Unique Tailscale Serve path for publish
  --category <name>            Default publish path category when --path is omitted
  --tailscale-bin <path>       Override tailscale binary
  --base-version <id>          Required when publishing over an existing wiki page
  --base-revision <id>         Alias for --base-version
  --force-publish              Intentional overwrite escape hatch; prefer --base-version for publish

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
      case 'list-skills':
      case 'workflows':
        listSkills(args);
        break;
      case 'list-design-systems':
        listDesignSystems(args);
        break;
      case 'upstream-status':
        upstreamStatus(args);
        break;
      case 'railway:check':
      case 'railway-check':
        railwayCheck(args);
        break;
      case 'check': {
        const boundary = check({ ...args, json: false, quiet: true });
        const railway = railwayCheck({ ...args, json: false, quiet: true });
        const result = { ok: boundary.ok && railway.ok, boundary, railway };
        if (args.json) printJson(result);
        else if (!args.quiet) writeStdout('consuelo-design full check passed.\n');
        break;
      }
      case 'generate':
        await startWorkflowSession(workflowFromArgs(args), args);
        break;
      case 'generate-website':
        await startWorkflowSession(WORKFLOW_CONFIGS.website, args);
        break;
      case 'generate-demo':
        await startWorkflowSession(WORKFLOW_CONFIGS.demo, args);
        break;
      case 'generate-image-brief':
        await startWorkflowSession(WORKFLOW_CONFIGS['image-brief'], args);
        break;
      case 'generate-digital-eguide':
        await startWorkflowSession(WORKFLOW_CONFIGS['digital-eguide'], args);
        break;
      case 'generate-email':
        await startWorkflowSession(WORKFLOW_CONFIGS.email, args);
        break;
      case 'generate-motion-frame':
        await startWorkflowSession(WORKFLOW_CONFIGS['motion-frame'], args);
        break;
      case 'render':
        if (args.subcommand !== 'hyperframes') throw new Error('expected render hyperframes');
        await startWorkflowSession(WORKFLOW_CONFIGS.hyperframes, args);
        break;
      case 'render-hyperframes':
        await startWorkflowSession(WORKFLOW_CONFIGS.hyperframes, args);
        break;
      case 'publish':
        await publishDesign(args);
        break;
      case 'refresh':
        await refreshDesignArchive(args);
        break;
      case 'run':
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

