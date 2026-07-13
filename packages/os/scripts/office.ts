#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
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

type ParsedArgs = {
  command: string;
  subcommand: string | null;
  json: boolean;
  quiet: boolean;
  dryRun: boolean;
  name?: string;
  prompt?: string;
  forwarded: string[];
};

type WorkflowId = 'website' | 'demo' | 'image-brief' | 'digital-eguide' | 'email' | 'motion-frame' | 'hyperframes';

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
      policy: 'Base Consuelo design system returns only DESIGN.md and office/AGENTS.md. Website-specific animations.md and website AGENTS.md are attached only to website/motion workflow sessions.',
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
    if (content.includes('office')) failures.push(`${dockerfile} references office`);
  }

  for (const manifestPath of DEPLOYED_PACKAGE_MANIFESTS) {
    if (!pathExists(manifestPath)) continue;
    const manifest = JSON.parse(readText(manifestPath)) as Record<string, Record<string, string> | undefined>;
    for (const group of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      const dependencies = manifest[group];
      if (dependencies?.['office'] || dependencies?.['@consuelo/design']) {
        failures.push(`${manifestPath} ${group} references office`);
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
  else if (result.ok && !args.quiet) writeStdout('office check passed.\n');
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

function buildWorkflowPrompt(workflow: WorkflowConfig, args: ParsedArgs): string {
  const files = getWorkflowContextFiles(workflow);
  const suppliedPrompt = args.prompt ? `\n\n## Ko's brief\n\n${args.prompt.trim()}\n` : '';
  const fileBlocks = files.map((file) => [
    `## ${file.role}: ${file.path}`,
    file.content.trim(),
  ].join('\n\n')).join('\n\n---\n\n');
  return [
    workflow.promptLead,
    suppliedPrompt,
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
    throw new Error('Open Design did not return daemon/web URLs. Run `bun run office run` and retry.');
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
      source: 'office',
      workflow: workflow.id,
      primarySkill: workflow.skillId,
      fallbackSkillIds: workflow.fallbackSkillIds,
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
  return { id, name, projectUrl, pendingPrompt, workflow: workflow.id, skillId: workflow.skillId };
}

function workflowFromArgs(args: ParsedArgs): WorkflowConfig {
  const workflow = args.subcommand;
  if (!workflow || !(workflow in WORKFLOW_CONFIGS)) {
    const names = Object.keys(WORKFLOW_CONFIGS).filter((name) => name !== 'hyperframes').join('|');
    throw new Error(`expected workflow: ${names}`);
  }
  return WORKFLOW_CONFIGS[workflow as WorkflowId];
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
            source: 'office',
            workflow: workflow.id,
            primarySkill: workflow.skillId,
            fallbackSkillIds: workflow.fallbackSkillIds,
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
  writeStdout(`office

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
  list-skills                 Show upstream skills and Consuelo workflow mapping
  list-design-systems         Show Consuelo default plus upstream reference systems
  get-design-system           Print base Consuelo DESIGN.md and office AGENTS.md only
  check                       Run package boundary and Railway exclusion checks
  ui:bg|ui:status|ui:logs|ui:stop  Manage Open Design background runtime
  od:build                    Build the Open Design daemon CLI

Flags:
  --json                      Print structured JSON where supported
  --quiet                     Suppress success text where supported
  --dry-run                   Print the plan instead of starting runtimes or creating projects
  --name <name>               Override generated Open Design project name
  --prompt <brief>            Attach Ko's brief to the generated Open Design pending prompt

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
        else if (!args.quiet) writeStdout('office full check passed.\n');
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
