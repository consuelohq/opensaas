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

const DIGITAL_EGUIDE_TEMPLATE_IDS = ['research', 'spec', 'plan'] as const;
type DigitalEguideTemplateId = typeof DIGITAL_EGUIDE_TEMPLATE_IDS[number];
const DIGITAL_EGUIDE_TEMPLATE_DIR = 'packages/consuelo-design/templates/digital-eguides';
const DIGITAL_EGUIDE_READER_SHELL_PATH = `${DIGITAL_EGUIDE_TEMPLATE_DIR}/reader-shell.md`;
const DESIGN_ARCHIVE_ROOT = path.join(OPEN_DESIGN_ROOT, '.od/consuelo/archive');
const DESIGN_ARCHIVE_DATA_PATH = path.join(DESIGN_ARCHIVE_ROOT, 'archive.json');
const DESIGN_ARCHIVE_INDEX_PATH = path.join(DESIGN_ARCHIVE_ROOT, 'index.html');
const DESIGN_ARCHIVE_SERVER_PATH = path.join(DESIGN_ARCHIVE_ROOT, 'server.ts');
const DESIGN_ARCHIVE_ARTIFACTS_ROOT = path.join(DESIGN_ARCHIVE_ROOT, 'artifacts');
const DESIGN_ARCHIVE_PORT = 53935;
const DESIGN_ARCHIVE_PATH = '/design-wiki';

type ParsedArgs = {
  command: string;
  subcommand: string | null;
  json: boolean;
  quiet: boolean;
  dryRun: boolean;
  name?: string;
  prompt?: string;
  template?: string;
  target?: string;
  portlessName?: string;
  path?: string;
  category?: string;
  tailscaleBin?: string;
  forwarded: string[];
};

type WorkflowId = 'website' | 'demo' | 'image-brief' | 'digital-eguide' | 'email' | 'motion-frame' | 'hyperframes';

type DesignArchiveEntry = {
  id: string;
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

type DesignArchivePayload = {
  version: 1;
  updatedAt: string;
  entries: DesignArchiveEntry[];
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
    description: 'Start a live website design/build session using Consuelo visual, motion, and website agent context.',
    projectPrefix: 'Consuelo Website',
    includeWebsiteContext: true,
    promptLead: 'Create or iterate on a Consuelo website artifact. Use the website design, motion, and agent context below as source of truth.',
  },
  demo: {
    id: 'demo',
    title: 'Demo',
    skillId: 'web-prototype',
    fallbackSkillIds: ['dashboard', 'mobile-app', 'simple-deck'],
    description: 'Start a live prototype/demo session for walkthroughs, product stories, or proof-of-concept screens.',
    projectPrefix: 'Consuelo Demo',
    includeWebsiteContext: false,
    promptLead: 'Create or iterate on a Consuelo demo artifact. Use the Consuelo design context below as source of truth.',
  },
  'image-brief': {
    id: 'image-brief',
    title: 'Image Brief',
    skillId: 'image-poster',
    fallbackSkillIds: ['magazine-poster', 'social-carousel', 'video-shortform', 'web-prototype'],
    description: 'Start a live image/media ideation session grounded in Consuelo visual rules.',
    projectPrefix: 'Consuelo Image',
    includeWebsiteContext: false,
    promptLead: 'Create or iterate on a Consuelo image-generation brief and previewable visual artifact. Use the Consuelo design context below as source of truth.',
  },
  'digital-eguide': {
    id: 'digital-eguide',
    title: 'Digital E-guide',
    skillId: 'digital-eguide',
    fallbackSkillIds: ['web-prototype', 'simple-deck'],
    description: 'Start a live long-form digital e-guide artifact session.',
    projectPrefix: 'Consuelo Digital E-guide',
    includeWebsiteContext: false,
    promptLead: 'Create or iterate on a Consuelo digital e-guide artifact. Use the Consuelo design context below as source of truth.',
  },
  email: {
    id: 'email',
    title: 'Email',
    skillId: 'email-marketing',
    fallbackSkillIds: ['web-prototype'],
    description: 'Start a live email design/content artifact session.',
    projectPrefix: 'Consuelo Email',
    includeWebsiteContext: false,
    promptLead: 'Create or iterate on a Consuelo email artifact. Use the Consuelo design context below as source of truth.',
  },
  'motion-frame': {
    id: 'motion-frame',
    title: 'Motion Frame',
    skillId: 'motion-frames',
    fallbackSkillIds: ['hyperframes', 'web-prototype'],
    description: 'Start a live motion-frame session for GSAP, HyperFrames, and video handoff work.',
    projectPrefix: 'Consuelo Motion Frame',
    includeWebsiteContext: true,
    promptLead: 'Create or iterate on a Consuelo motion-frame artifact. Use the Consuelo design and motion context below as source of truth.',
  },
  hyperframes: {
    id: 'hyperframes',
    title: 'HyperFrames Render',
    skillId: 'hyperframes',
    fallbackSkillIds: ['motion-frames'],
    description: 'Start a live HyperFrames HTML-to-MP4 render session.',
    projectPrefix: 'Consuelo HyperFrames',
    includeWebsiteContext: true,
    promptLead: 'Create or iterate on a Consuelo HyperFrames motion graphics artifact and prepare it for HTML-to-MP4 rendering. Use the Consuelo design and motion context below as source of truth.',
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
  let name: string | undefined;
  let prompt: string | undefined;
  let template: string | undefined;
  let target: string | undefined;
  let portlessName: string | undefined;
  let publishPath: string | undefined;
  let category: string | undefined;
  let tailscaleBin: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--quiet') {
      quiet = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
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
    name,
    prompt,
    template,
    target,
    portlessName,
    path: publishPath,
    category,
    tailscaleBin,
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
    'Start with a useful artifact in the Open Design preview, then iterate with Ko in the live workspace.',
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


function archiveRelativeArtifactPath(servePath: string, fileName = 'index.html'): string {
  const safeSegments = servePath.split('/').filter(Boolean).map(slugify);
  return path.join('artifacts', ...safeSegments, fileName);
}

function archiveAbsoluteArtifactDir(servePath: string): string {
  return path.join(DESIGN_ARCHIVE_ARTIFACTS_ROOT, ...servePath.split('/').filter(Boolean).map(slugify));
}

function materializeArchiveTarget(target: string, servePath: string): { target: string; artifactPath: string | null; sourceTarget: string } {
  if (/^https?:\/\//.test(target)) {
    return { target, artifactPath: null, sourceTarget: target };
  }

  const sourcePath = path.resolve(target);
  if (!existsSync(sourcePath)) {
    throw new Error(`publish target does not exist: ${target}`);
  }

  const targetDir = archiveAbsoluteArtifactDir(servePath);
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });

  const sourceStat = statSync(sourcePath);
  if (sourceStat.isDirectory()) {
    cpSync(sourcePath, targetDir, { recursive: true });
    const indexPath = path.join(targetDir, 'index.html');
    if (!existsSync(indexPath)) {
      throw new Error(`directory publish target must contain index.html: ${target}`);
    }
    return { target: targetDir, artifactPath: path.relative(DESIGN_ARCHIVE_ROOT, targetDir), sourceTarget: target };
  }

  const indexPath = path.join(targetDir, 'index.html');
  cpSync(sourcePath, indexPath);
  return { target: indexPath, artifactPath: archiveRelativeArtifactPath(servePath), sourceTarget: target };
}

function readArchivePayload(): DesignArchivePayload {
  try {
    const parsed = JSON.parse(readFileSync(DESIGN_ARCHIVE_DATA_PATH, 'utf8')) as Partial<DesignArchivePayload>;
    return {
      version: 1,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      entries: Array.isArray(parsed.entries) ? parsed.entries as DesignArchiveEntry[] : [],
    };
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
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

function archiveSectionLabel(entry: DesignArchiveEntry): string {
  if (entry.category === 'daily-deep-idea') return 'Featured';
  return 'Recent Posts';
}

function renderArchiveIndex(payload: DesignArchivePayload): string {
  const visibleEntries = [...payload.entries]
    .filter((entry) => entry.category !== 'research-packet')
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  const featuredEntries = visibleEntries.filter((entry) => archiveSectionLabel(entry) === 'Featured');
  const recentEntries = visibleEntries.filter((entry) => archiveSectionLabel(entry) !== 'Featured');
  const renderItems = (entries: DesignArchiveEntry[]) => entries.map((entry) => `
        <article class="post-item" data-template="${escapeHtml(entry.template)}" data-category="${escapeHtml(entry.category)}">
          <h3><a href="${escapeHtml(entry.directUrl ?? entry.url)}">${escapeHtml(displayTitleForArchiveEntry(entry))}</a></h3>
          <div class="post-meta" aria-label="Published date">▣ <time datetime="${escapeHtml(entry.publishedAt)}">${escapeHtml(new Date(entry.publishedAt).toLocaleDateString())}</time></div>
          <p>${escapeHtml(entry.path)}</p>
        </article>`).join('\n');
  const featuredCards = renderItems(featuredEntries);
  const recentCards = renderItems(recentEntries);
  const emptyState = visibleEntries.length === 0 ? '<p class="empty">No published artifacts yet.</p>' : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Consuelo Wiki</title>
  <style>
    :root { color-scheme: light; --ink:#171717; --muted:#666; --quiet:#a3a3a3; --line:#eaeaea; --soft:#fafafa; }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin:0; font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; color:var(--ink); background:#fff; }
    .shell { max-width:680px; margin:0 auto; padding:0 18px 32px; }
    .topbar { display:flex; align-items:center; justify-content:space-between; gap:18px; min-height:74px; border-bottom:1px solid var(--line); }
    .brand { color:var(--ink); font-size:20px; font-weight:700; letter-spacing:.01em; text-decoration:none; }
    .nav { display:flex; align-items:center; gap:22px; font-size:13px; }
    .nav a { color:var(--ink); text-decoration:none; }
    .nav a:hover, .brand:hover, .post-item h3 a:hover, .footer-links a:hover { text-decoration-line:underline; text-decoration-style:dotted; text-decoration-thickness:1px; text-underline-offset:4px; }
    .search-mark { font-size:26px; line-height:1; transform:translateY(-1px); }
    header.hero { padding:58px 0 28px; border-bottom:1px solid var(--line); }
    h1 { margin:0 0 20px; font-size:44px; line-height:1; letter-spacing:-.05em; font-weight:800; }
    .lead { margin:0 0 20px; color:var(--ink); font-size:14px; line-height:1.7; }
    .filter-row { display:flex; align-items:center; gap:9px; flex-wrap:wrap; font-size:14px; }
    .filter-label { color:var(--ink); }
    button { appearance:none; border:0; background:transparent; color:var(--ink); padding:0; font:inherit; cursor:pointer; }
    button:hover { text-decoration-line:underline; text-decoration-style:dotted; text-decoration-thickness:1px; text-underline-offset:4px; }
    button.active { font-weight:700; }
    button.active::before { content:"["; color:var(--quiet); }
    button.active::after { content:"]"; color:var(--quiet); }
    .section { padding:44px 0 34px; border-bottom:1px solid var(--line); }
    .section[data-empty="true"] { display:none; }
    h2 { margin:0 0 24px; font-size:24px; line-height:1.15; letter-spacing:-.04em; font-weight:800; }
    .post-list { display:grid; gap:26px; }
    .post-item h3 { margin:0 0 6px; font-size:17px; line-height:1.45; letter-spacing:-.02em; font-weight:500; }
    .post-item h3 a { color:inherit; text-decoration:none; }
    .post-meta { color:var(--quiet); font-size:13px; line-height:1.3; margin-bottom:4px; }
    .post-item p { margin:0; color:var(--quiet); font-size:13px; line-height:1.55; overflow-wrap:anywhere; }
    .empty { color:var(--quiet); font-size:14px; }
    footer { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:24px 0 0; color:var(--ink); font-size:13px; }
    .footer-links { display:flex; gap:10px; }
    .footer-links a { color:var(--ink); text-decoration:none; }
    @media (max-width: 680px) {
      .topbar { align-items:flex-start; flex-direction:column; padding:20px 0; }
      .nav { gap:14px; flex-wrap:wrap; }
      header.hero { padding-top:44px; }
      h1 { font-size:38px; }
      footer { flex-direction:column; align-items:flex-start; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="topbar">
      <a class="brand" href="${escapeHtml(DESIGN_ARCHIVE_PATH)}">Consuelo Wiki</a>
      <nav class="nav" aria-label="Primary">
        <a href="#featured">Featured</a>
        <a href="#recent">Recent</a>
        <span aria-hidden="true">▣</span>
        <span class="search-mark" aria-hidden="true">⌕</span>
      </nav>
    </div>
    <header class="hero">
      <h1>Wiki</h1>
      <p class="lead">Private tailnet notes, guides, and published artifacts from Consuelo.</p>
      <div class="filter-row" aria-label="Filters">
        <span class="filter-label">Filters:</span>
        <button class="active" data-filter="all">All</button>
        <button data-filter="research">Research</button>
        <button data-filter="spec">Spec</button>
        <button data-filter="plan">Plan</button>
        <button data-filter="uncategorized">Uncategorized</button>
      </div>
    </header>
    <section class="section" id="featured" data-section="featured" data-empty="${featuredEntries.length === 0}">
      <h2>Featured</h2>
      <div class="post-list">${featuredCards}</div>
    </section>
    <section class="section" id="recent" data-section="recent" data-empty="${recentEntries.length === 0}">
      <h2>Recent Posts</h2>
      <div class="post-list">${recentCards}</div>
    </section>
    ${emptyState}
    <footer>
      <span>© ${escapeHtml(new Date(payload.updatedAt).getFullYear().toString())} Consuelo. All rights reserved.</span>
      <div class="footer-links" aria-label="Footer links"><a href="#featured">Featured</a><a href="#recent">Recent</a></div>
    </footer>
  </div>
  <script>
    const sections = Array.from(document.querySelectorAll('[data-section]'));
    const updateSections = () => {
      sections.forEach((section) => {
        const visibleItems = Array.from(section.querySelectorAll('.post-item')).filter((item) => !item.hidden);
        section.hidden = visibleItems.length === 0;
      });
    };
    document.querySelectorAll('[data-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        const filter = button.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
        document.querySelectorAll('.post-item').forEach((card) => {
          card.hidden = filter !== 'all' && card.dataset.template !== filter;
        });
        updateSections();
      });
    });
    updateSections();
  </script>
</body>
</html>\n`;
}
function writeArchiveIndex(payload: DesignArchivePayload): void {
  mkdirSync(DESIGN_ARCHIVE_ROOT, { recursive: true });
  writeFileSync(DESIGN_ARCHIVE_INDEX_PATH, renderArchiveIndex(payload));
}

function writeArchiveServer(): void {
  mkdirSync(DESIGN_ARCHIVE_ROOT, { recursive: true });
  writeFileSync(DESIGN_ARCHIVE_SERVER_PATH, `
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = ${JSON.stringify(DESIGN_ARCHIVE_ROOT)};
const wikiPath = ${JSON.stringify(DESIGN_ARCHIVE_PATH)};
const port = Number(process.env.CONSUELO_DESIGN_ARCHIVE_PORT ?? ${DESIGN_ARCHIVE_PORT});

const contentType = (filePath: string) => filePath.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8';
const archiveDataPath = path.join(root, 'archive.json');
const archiveIndexPath = path.join(root, 'index.html');

function readArchive() {
  if (!existsSync(archiveDataPath)) return { entries: [] };
  return JSON.parse(readFileSync(archiveDataPath, 'utf8')) as { entries?: Array<{ path: string; target: string }> };
}

function readTarget(entry: { path: string; target: string }, request: Request, url: URL) {
  if (/^https?:\\/\\//.test(entry.target)) {
    const targetUrl = new URL(entry.target);
    targetUrl.pathname = url.pathname;
    targetUrl.search = url.search;
    return fetch(targetUrl, { headers: request.headers });
  }

  const targetPath = path.resolve(entry.target);
  if (!existsSync(targetPath)) return new Response('target not found', { status: 404 });
  const stat = statSync(targetPath);
  const filePath = stat.isDirectory() ? path.join(targetPath, 'index.html') : targetPath;
  if (!existsSync(filePath)) return new Response('target index not found', { status: 404 });
  return new Response(readFileSync(filePath), { headers: { 'content-type': contentType(filePath), 'cache-control': 'no-store' } });
}

Bun.serve({
  hostname: process.env.CONSUELO_DESIGN_ARCHIVE_HOST ?? '127.0.0.1',
  port,
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/__health') return new Response('ok', { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
    if (url.pathname === '/' || url.pathname === wikiPath || url.pathname === wikiPath + '/') {
      if (!existsSync(archiveIndexPath)) return new Response('not found', { status: 404 });
      return new Response(readFileSync(archiveIndexPath), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (url.pathname === wikiPath + '/archive.json' || url.pathname.endsWith('/archive.json')) {
      if (!existsSync(archiveDataPath)) return new Response('not found', { status: 404 });
      return new Response(readFileSync(archiveDataPath), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    }

    const payload = readArchive();
    const entry = payload.entries?.find((item) => url.pathname === item.path || url.pathname.startsWith(item.path + '/'));
    if (!entry) return new Response('not found', { status: 404 });
    return readTarget(entry, request, url);
  },
});
`);
}

async function isArchiveServerRunning(host: string): Promise<boolean> {
  for (const probePath of ['/__health', DESIGN_ARCHIVE_PATH]) {
    try {
      const response = await fetch(`http://${host}:${DESIGN_ARCHIVE_PORT}${probePath}`, { cache: 'no-store' });
      if (probePath === '/__health') return response.ok;
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function ensureArchiveServer(host: string): Promise<string> {
  try {
    writeArchiveServer();
    if (!(await isArchiveServerRunning(host))) {
      const child = spawn(process.execPath, [DESIGN_ARCHIVE_SERVER_PATH], {
        cwd: REPO_ROOT,
        detached: true,
        env: { ...process.env, CONSUELO_DESIGN_ARCHIVE_HOST: host, CONSUELO_DESIGN_ARCHIVE_PORT: String(DESIGN_ARCHIVE_PORT) },
        stdio: 'ignore',
      });
      child.unref();
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        if (await isArchiveServerRunning(host)) break;
      }
      if (!(await isArchiveServerRunning(host))) throw new Error(`Consuelo Wiki server did not start on ${host}:${DESIGN_ARCHIVE_PORT}`);
    }
    return `http://${host}:${DESIGN_ARCHIVE_PORT}`;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to start Consuelo Wiki server: ${message}`);
  }
}

async function updateDesignArchive(args: ParsedArgs, servePath: string, url: string, archiveTarget: string, sourceTarget: string, artifactPath: string | null, tailscaleSelf: TailscaleSelf, tailscaleBin: string): Promise<{ path: string; url: string; directUrl: string; target: string; entries: number }> {
  try {
    const now = new Date().toISOString();
    const payload = readArchivePayload();
    const id = slugify(servePath);
    const existing = payload.entries.find((entry) => entry.path === servePath);
    const entry: DesignArchiveEntry = {
      id,
      title: archiveTitleFromArgs(args, servePath),
      url,
      directUrl: `http://${tailscaleSelf.ip}:${DESIGN_ARCHIVE_PORT}${servePath}`,
      path: servePath,
      target: archiveTarget,
      sourceTarget,
      artifactPath,
      template: archiveTemplateFromArgs(args),
      category: archiveCategoryFromArgs(args, servePath),
      publishedAt: existing?.publishedAt ?? now,
      updatedAt: now,
    };
    payload.entries = [entry, ...payload.entries.filter((item) => item.path !== servePath)];
    payload.updatedAt = now;
    writeArchivePayload(payload);
    writeArchiveIndex(payload);
    const wikiTarget = await ensureArchiveServer(tailscaleSelf.ip);
    const archiveUrl = `https://${tailscaleSelf.hostname}${DESIGN_ARCHIVE_PATH}`;
    const archiveDirectUrl = `http://${tailscaleSelf.ip}:${DESIGN_ARCHIVE_PORT}${DESIGN_ARCHIVE_PATH}`;
    const archiveResult = await runCommand([tailscaleBin, 'serve', '--bg', '--yes', '--set-path', DESIGN_ARCHIVE_PATH, wikiTarget], REPO_ROOT);
    if (archiveResult.exitCode !== 0) {
      throw new Error(`tailscale serve failed for Consuelo Wiki: ${archiveResult.stderr || archiveResult.stdout || `exit ${archiveResult.exitCode}`}`);
    }
    return { path: DESIGN_ARCHIVE_PATH, url: archiveUrl, directUrl: archiveDirectUrl, target: wikiTarget, entries: payload.entries.length };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to update Consuelo Wiki archive: ${message}`);
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
    const archiveTarget = args.dryRun ? `http://${tailscaleSelf.ip}:${DESIGN_ARCHIVE_PORT}` : await ensureArchiveServer(tailscaleSelf.ip);
    const command = [tailscaleBin, 'serve', '--bg', '--yes', '--set-path', servePath, archiveTarget];
    const hostname = tailscaleSelf.hostname;
    const url = `https://${hostname}${servePath}`;
    const directUrl = `http://${tailscaleSelf.ip}:${DESIGN_ARCHIVE_PORT}${servePath}`;
    const archivePlan = {
      path: DESIGN_ARCHIVE_PATH,
      url: args.dryRun ? `https://${hostname}${DESIGN_ARCHIVE_PATH}` : null,
      directUrl: args.dryRun ? `http://${tailscaleSelf.ip}:${DESIGN_ARCHIVE_PORT}${DESIGN_ARCHIVE_PATH}` : null,
      target: `http://${tailscaleSelf.ip}:${DESIGN_ARCHIVE_PORT}`,
    };
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
      command,
    };

    if (args.dryRun) {
      if (args.json) printJson(plan);
      else writeStdout(`design publish dry-run\nurl: ${url}\ntarget: ${archiveTarget}\ncommand: ${command.join(' ')}\n`);
      return;
    }

    const materialized = materializeArchiveTarget(normalizedTarget, servePath);
    const archive = await updateDesignArchive(args, servePath, url, materialized.target, materialized.sourceTarget, materialized.artifactPath, tailscaleSelf, tailscaleBin);

    const result = await runCommand(command, REPO_ROOT);
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
    if (args.dryRun) {
      const prompt = buildWorkflowPrompt(workflow, args);
      const plan = {
        workflow: workflow.id,
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
      else writeStdout(`${workflow.title} session dry-run\nskill: ${workflow.skillId}\nproject: ${plan.project.name}\n`);
      return;
    }

    const runtime = await startOpenDesign({ ...args, json: true, dryRun: false });
    const project = await createWorkflowProject(workflow, runtime, args);
    await openUrl(project.projectUrl, args);
    if (args.json) {
      printJson({ ok: true, runtime, project });
      return;
    }
    if (!args.quiet) {
      writeStdout(`${workflow.title} session ready\n`);
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
  generate website            Start/open a website working session
  generate demo               Start/open a demo working session
  generate image-brief        Start/open an image/media working session
  generate digital-eguide     Start/open a digital e-guide working session
  generate email              Start/open an email working session
  generate motion-frame       Start/open a motion-frame working session
  render hyperframes          Start/open a HyperFrames render working session
  publish                     Publish a design artifact through private Tailscale Serve
  list-skills                 Show upstream skills and Consuelo workflow mapping
  list-design-systems         Show Consuelo default plus upstream reference systems
  get-design-system           Print base Consuelo DESIGN.md and consuelo-design AGENTS.md only
  check                       Run package boundary and Railway exclusion checks
  ui:bg|ui:status|ui:logs|ui:stop  Manage Open Design background runtime
  od:build                    Build the Open Design daemon CLI

Flags:
  --json                      Print structured JSON where supported
  --quiet                     Suppress success text where supported
  --dry-run                   Print the plan instead of starting runtimes or creating projects
  --name <name>               Override generated Open Design project name
  --prompt <brief>            Attach Ko's brief to the generated Open Design pending prompt
  --template <research|spec|plan>  Select/archive a digital e-guide template for generate/publish
  --target <url|path>          Target URL/file/directory for publish
  --portless-name <name>        Resolve target with portless get <name>
  --path <path>                Unique Tailscale Serve path for publish
  --category <name>            Default publish path category when --path is omitted
  --tailscale-bin <path>       Override tailscale binary for publish

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
