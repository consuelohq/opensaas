import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getDefaultSelectedSkillNames } from './onboarding-skills';
import { createGatewaySecurityConfig } from './security-gateway';
import { materializeSites as materializeRuntimeSites } from './sites';
import { validateBundledSkills } from './skills';
import { planWorkspaceConnectorTransport } from './workspace-connector-transport';

export type OsMode = 'local' | 'cloud';
export type AgentName = 'codex' | 'claude' | 'opencode' | 'factory';
export type HealthStatus =
  | 'connected'
  | 'not_configured'
  | 'missing_capability'
  | 'unhealthy'
  | 'local_only'
  | 'cloud_only'
  | 'permission_denied'
  | 'approval_required'
  | 'validation_failed'
  | 'execution_failed';

export type AgentDetection = {
  name: AgentName;
  label: string;
  homePath: string;
  configPath: string;
  detected: boolean;
  connected: boolean;
  status: HealthStatus;
};

export type WorkspaceBootstrap = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  connectorId: string;
  connectorTransport: 'cloudflare-tunnel' | 'websocket-relay';
  connectorBootstrapToken?: string;
  cloudflareTunnelToken?: string;
};

export type OsConfig = {
  version: 1;
  mode: OsMode;
  home: string;
  port: number;
  artifactStorage: 'local';
  selectedSkills?: string[];
  workspace?: {
    id: string;
    slug: string;
    host: string;
  };
  connector?: {
    id: string;
    transport: WorkspaceBootstrap['connectorTransport'];
    status: 'configured';
  };
  security?: {
    auth: {
      kind: 'consuelo-generated';
      status: 'configured';
      path: string;
      tokenIssuer: string;
      signingKeyId: string;
    };
    gateway: {
      workspaceHost: string;
      publicRoutes: string[];
    };
  };
  agents: Array<{
    name: AgentName;
    homePath: string;
    configPath: string;
    connected: boolean;
    connectedAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type ProvisionOptions = {
  home?: string;
  mode?: OsMode;
  port?: number;
  dryRun?: boolean;
  selectedSkills?: string[];
  artifactStorage?: 'local';
  connectAgents?: AgentName[];
  workspaceBootstrap?: WorkspaceBootstrap;
};
export type ProvisionAction = {
  type:
    | 'create_dir'
    | 'create_file'
    | 'preserve_file'
    | 'connect_agent'
    | 'skip_agent'
    | 'seed_steering'
    | 'seed_skill'
    | 'seed_tool'
    | 'seed_operator';
  path: string;
  status: 'planned' | 'created' | 'preserved' | 'skipped';
  message: string;
};

export type ProvisionResult = {
  home: string;
  configPath: string;
  dbPath: string;
  actions: ProvisionAction[];
  agents: AgentDetection[];
};

export type DoctorCheck = {
  name: string;
  status: HealthStatus;
  message: string;
};

export type DoctorResult = {
  home: string;
  checks: DoctorCheck[];
  ok: boolean;
};

const REQUIRED_DIRS = [
  'agents',
  'skills',
  'tools',
  'scripts',
  'src',
  'tooling',
  'manifests',
  'hooks',
  'artifacts',
  'pages',
  'sites',
  'logs',
  'runs',
  'cache',
  'runtime',
  'security',
  'steering',
  'bin',
  'tmp',
] as const;

const REQUIRED_GENERATED_SECURITY_FILES = [
  'security/generated/auth.json',
  'security/generated/Caddyfile',
] as const;
const DEFAULT_PORT = 8960;

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(CURRENT_DIR, '..', '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');

function resolveBundledOperatorRoot(): string {
  const packageOperatorRoot = path.join(PACKAGE_ROOT, 'operator');
  if (fs.existsSync(packageOperatorRoot)) return packageOperatorRoot;
  return path.join(REPO_ROOT, 'operator');
}

const BUNDLED_SKILLS_ROOT = path.join(PACKAGE_ROOT, 'skills');
const BUNDLED_STEERING_ROOT = path.join(PACKAGE_ROOT, 'steering');
const BUNDLED_OPERATOR_ROOT = resolveBundledOperatorRoot();
const BUNDLED_TOOL_MANIFEST_PATH = path.join(PACKAGE_ROOT, 'manifests', 'tool.manifest.json');
const PRODUCT_PACKAGE_DIRS = ['scripts', 'src', 'tooling', 'manifests', 'hooks'] as const;
const PRODUCT_PACKAGE_FILES = ['package.json', 'bun.lock'] as const;
const SKILL_METADATA_FILE = '.consuelo-skill.json';
const SKILLS_REGISTRY_FILE = 'skills.json';
const TOOL_METADATA_FILE = '.consuelo-tool.json';
const TOOL_REGISTRY_FILE = 'tools.json';
const TOOL_DEFINITION_FILE = 'tool.json';
const DEFAULT_STEERING_FILES = ['system_prompt.md', 'decision.md'] as const;

const COMPACT_SKILL_FIELDS = [
  'name',
  'title',
  'description',
  'trigger',
  'entrypoint',
  'load',
  'permission',
  'requiresApproval',
  'status',
  'capabilities',
  'tools',
  'subskills',
  'visibility',
  'distribution',
  'audience',
] as const;

type JsonObject = Record<string, unknown>;

type SkillInstallMetadata = {
  version: 1;
  name: string;
  source: 'bundled';
  sourcePath: string;
  hash: string;
  installedAt: string;
  updatedAt: string;
};


type CanonicalToolEntry = {
  name: string;
  kind: string;
  source?: string;
  sourcePath?: string;
  category?: string;
  description?: string;
  core?: boolean;
  definition?: JsonObject;
};

type CanonicalToolManifest = {
  version: 1;
  kind: string;
  generatedFrom?: unknown[];
  tools: CanonicalToolEntry[];
};

type ToolInstallMetadata = {
  version: 1;
  name: string;
  source: 'bundled';
  sourcePath: string;
  hash: string;
  installedAt: string;
  updatedAt: string;
};

function expandHome(value: string): string {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

export function resolveOsHome(home?: string): string {
  return path.resolve(
    expandHome(home ?? process.env.CONSUELO_HOME ?? '~/.consuelo/os'),
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function writeJsonFile(
  filePath: string,
  value: unknown,
  dryRun: boolean,
): void {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function samePath(left: string, right: string): boolean {
  return path.resolve(left) === path.resolve(right);
}

function materializeProductPackageRoot(home: string, dryRun: boolean): ProvisionAction[] {
  const actions: ProvisionAction[] = [];
  const installedInPlace = samePath(PACKAGE_ROOT, home);

  for (const dir of PRODUCT_PACKAGE_DIRS) {
    const sourcePath = path.join(PACKAGE_ROOT, dir);
    const targetPath = path.join(home, dir);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`${sourcePath}: required OS package directory is missing`);
    }

    const targetExists = fs.existsSync(targetPath);
    actions.push({
      type: 'create_dir',
      path: targetPath,
      status: targetExists || installedInPlace ? 'preserved' : dryRun ? 'planned' : 'created',
      message: installedInPlace ? 'package directory already at OS root' : 'package directory materialized',
    });

    if (dryRun || installedInPlace) continue;
    fs.rmSync(targetPath, { recursive: true, force: true });
    fs.cpSync(sourcePath, targetPath, { recursive: true, force: true });
  }

  for (const file of PRODUCT_PACKAGE_FILES) {
    const sourcePath = path.join(PACKAGE_ROOT, file);
    const targetPath = path.join(home, file);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`${sourcePath}: required OS package file is missing`);
    }

    const targetExists = fs.existsSync(targetPath);
    actions.push({
      type: 'create_file',
      path: targetPath,
      status: targetExists || installedInPlace ? 'preserved' : dryRun ? 'planned' : 'created',
      message: installedInPlace ? 'package file already at OS root' : 'package file materialized',
    });

    if (dryRun || installedInPlace) continue;
    fs.copyFileSync(sourcePath, targetPath);
  }

  return actions;
}

function materializeOperator(home: string, dryRun: boolean): ProvisionAction[] {
  const targetPath = path.join(home, 'operator');
  const installedInPlace = samePath(BUNDLED_OPERATOR_ROOT, targetPath);
  if (!fs.existsSync(BUNDLED_OPERATOR_ROOT)) {
    throw new Error(`${BUNDLED_OPERATOR_ROOT}: required operator directory is missing`);
  }

  const targetExists = fs.existsSync(targetPath);
  const actions: ProvisionAction[] = [{
    type: 'seed_operator',
    path: targetPath,
    status: targetExists || installedInPlace ? 'preserved' : dryRun ? 'planned' : 'created',
    message: installedInPlace ? 'operator directory already at OS root' : 'operator prompts materialized',
  }];

  if (!dryRun && !installedInPlace && !targetExists) {
    fs.cpSync(BUNDLED_OPERATOR_ROOT, targetPath, { recursive: true, force: true });
  }

  return actions;
}

function seedBundledSteering(home: string, dryRun: boolean): ProvisionAction[] {
  const targetRoot = path.join(home, 'steering');
  const installedInPlace = samePath(BUNDLED_STEERING_ROOT, targetRoot);
  const actions: ProvisionAction[] = [];

  for (const fileName of DEFAULT_STEERING_FILES) {
    const sourcePath = path.join(BUNDLED_STEERING_ROOT, fileName);
    const targetPath = path.join(targetRoot, fileName);
    if (!fs.existsSync(sourcePath)) throw new Error(`${sourcePath}: required steering file is missing`);
    const targetExists = fs.existsSync(targetPath);
    actions.push({
      type: 'seed_steering',
      path: targetPath,
      status: targetExists || installedInPlace ? 'preserved' : dryRun ? 'planned' : 'created',
      message: targetExists || installedInPlace ? 'local steering file preserved' : 'default steering file installed',
    });
    if (dryRun || targetExists || installedInPlace) continue;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }

  return actions;
}

export function createDefaultConfig(
  home: string,
  mode: OsMode,
  port = DEFAULT_PORT,
): OsConfig {
  return {
    version: 1,
    mode,
    home,
    port,
    artifactStorage: 'local',
    agents: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}


type InstalledSitesPaths = {
  sitesDir: string;
  indexPath: string;
  pagesDir: string;
  pagesDataDir: string;
  pagesRegistryPath: string;
  pagesLeasesPath: string;
  officeDir: string;
  officeDataDir: string;
  officeAssetsDir: string;
  officeIndexPath: string;
  officeDataPath: string;
  tracesDir: string;
  tracesIndexPath: string;
  diffsDir: string;
  diffsIndexPath: string;
};

type InstalledOfficeSiteData = {
  version: 1;
  generatedAt: string;
  artifacts: unknown[];
};

function getInstalledSitesPaths(home: string): InstalledSitesPaths {
  const sitesDir = path.join(home, 'sites');
  const pagesDir = path.join(sitesDir, 'pages');
  const pagesDataDir = path.join(sitesDir, '.data', 'pages');
  const officeDir = path.join(sitesDir, 'office');
  const officeDataDir = path.join(officeDir, 'data');
  const officeAssetsDir = path.join(officeDir, 'assets');
  const tracesDir = path.join(sitesDir, 'traces');
  const diffsDir = path.join(sitesDir, 'diffs');

  return {
    sitesDir,
    indexPath: path.join(sitesDir, 'index.html'),
    pagesDir,
    pagesDataDir,
    pagesRegistryPath: path.join(pagesDataDir, 'registry.json'),
    pagesLeasesPath: path.join(pagesDataDir, 'leases.json'),
    officeDir,
    officeDataDir,
    officeAssetsDir,
    officeIndexPath: path.join(officeDir, 'index.html'),
    officeDataPath: path.join(officeDataDir, 'artifacts.json'),
    tracesDir,
    tracesIndexPath: path.join(tracesDir, 'index.html'),
    diffsDir,
    diffsIndexPath: path.join(diffsDir, 'index.html'),
  };
}

function addProvisionDirectoryAction(
  actions: ProvisionAction[],
  dirPath: string,
  dryRun: boolean,
): void {
  const exists = fs.existsSync(dirPath);
  actions.push({
    type: 'create_dir',
    path: dirPath,
    status: exists ? 'preserved' : dryRun ? 'planned' : 'created',
    message: exists ? 'sites directory exists' : 'sites directory configured',
  });
  if (!dryRun) fs.mkdirSync(dirPath, { recursive: true });
}

function addProvisionFileAction(
  actions: ProvisionAction[],
  filePath: string,
  dryRun: boolean,
  message: string,
): void {
  const exists = fs.existsSync(filePath);
  actions.push({
    type: 'create_file',
    path: filePath,
    status: exists ? 'preserved' : dryRun ? 'planned' : 'created',
    message,
  });
}

function buildInstalledSitesIndex(): string {
  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8"><title>Consuelo OS Sites</title></head>',
    '<body><main><h1>Consuelo OS Sites</h1><nav>',
    '<a href="/pages/">Pages</a><a href="/office/">Office</a>',
    '<a href="/traces/">Traces</a><a href="/diffs/">Diffs</a>',
    '</nav></main></body></html>',
    '',
  ].join('\n');
}

function buildInstalledPagesIndex(): string {
  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8"><title>Pages - Sites</title></head>',
    '<body><main><h1>Pages</h1><p>No local Sites pages have been published yet.</p></main></body></html>',
    '',
  ].join('\n');
}

function buildInstalledOfficeIndex(data: InstalledOfficeSiteData): string {
  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8"><title>Office - Sites</title></head>',
    `<body><main><h1>Office</h1><p>${data.artifacts.length} artifacts indexed.</p></main></body></html>`,
    '',
  ].join('\n');
}

function buildInstalledReservedSiteIndex(input: {
  title: string;
  description: string;
}): string {
  return [
    '<!doctype html>',
    `<html lang="en"><head><meta charset="utf-8"><title>${input.title} - Sites</title></head>`,
    `<body><main><h1>${input.title}</h1><p>${input.description}</p></main></body></html>`,
    '',
  ].join('\n');
}

function materializeSites(input: {
  home: string;
  dbPath: string;
  dryRun: boolean;
}): { actions: ProvisionAction[] } {
  const result = materializeRuntimeSites(input);
  return { actions: result.actions };
}

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

function renderCloudflaredLaunchdPlist(input: {
  label: string;
  programArguments: string[];
  keepAlive: boolean;
  runAtLoad: boolean;
  standardOutPath: string;
  standardErrorPath: string;
}): string {
  const argumentXml = input.programArguments
    .map((argument) => `    <string>${escapeXml(argument)}</string>`)
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>Label</key>',
    `  <string>${escapeXml(input.label)}</string>`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    argumentXml,
    '  </array>',
    '  <key>KeepAlive</key>',
    `  <${input.keepAlive ? 'true' : 'false'}/>`,
    '  <key>RunAtLoad</key>',
    `  <${input.runAtLoad ? 'true' : 'false'}/>`,
    '  <key>StandardOutPath</key>',
    `  <string>${escapeXml(input.standardOutPath)}</string>`,
    '  <key>StandardErrorPath</key>',
    `  <string>${escapeXml(input.standardErrorPath)}</string>`,
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
}

function renderGatewayAuthSmokeScript(input: {
  home: string;
  workspaceHost: string;
}): string {
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    `CONSUELO_HOME=${shellSingleQuote(input.home)}`,
    `WORKSPACE_HOST=${shellSingleQuote(input.workspaceHost)}`,
    'printf "%s\\n" "gateway auth smoke: $WORKSPACE_HOST"',
    'bun ./scripts/os.ts get-steering >/dev/null',
    '',
  ].join('\n');
}

function materializeWorkspaceConnectorBootstrap(input: {
  home: string;
  port: number;
  dryRun: boolean;
  workspaceBootstrap: WorkspaceBootstrap;
}): ProvisionAction[] {
  const actions: ProvisionAction[] = [];

  if (input.workspaceBootstrap.connectorTransport !== 'cloudflare-tunnel') {
    return actions;
  }

  const plan = planWorkspaceConnectorTransport({
    home: input.home,
    connectorId: input.workspaceBootstrap.connectorId,
    workspaceHost: input.workspaceBootstrap.workspaceHost,
    localPort: input.port,
    transport: 'cloudflare-tunnel',
    cloudflareTunnelToken: input.workspaceBootstrap.cloudflareTunnelToken,
  });

  if (plan.tokenPath) {
    actions.push({
      type: 'create_file',
      path: plan.tokenPath,
      status: input.dryRun ? 'planned' : 'created',
      message: 'cloudflared tunnel token file configured',
    });
    if (!input.dryRun) {
      fs.mkdirSync(path.dirname(plan.tokenPath), { recursive: true });
      fs.writeFileSync(
        plan.tokenPath,
        `${input.workspaceBootstrap.cloudflareTunnelToken ?? ''}\n`,
        { mode: 0o600 },
      );
    }
  }

  if (plan.launchd) {
    const plistPath = path.join(
      input.home,
      'security',
      'generated',
      'com.consuelo.os.cloudflared.plist',
    );
    actions.push({
      type: 'create_file',
      path: plistPath,
      status: input.dryRun ? 'planned' : 'created',
      message: 'cloudflared launchd service configured',
    });
    if (!input.dryRun) {
      fs.mkdirSync(path.dirname(plistPath), { recursive: true });
      fs.writeFileSync(plistPath, renderCloudflaredLaunchdPlist(plan.launchd), {
        mode: 0o600,
      });
    }
  }

  const smokePath = path.join(input.home, 'bin', 'smoke-gateway-auth');
  actions.push({
    type: 'create_file',
    path: smokePath,
    status: input.dryRun ? 'planned' : 'created',
    message: 'gateway auth smoke command configured',
  });
  if (!input.dryRun) {
    fs.mkdirSync(path.dirname(smokePath), { recursive: true });
    fs.writeFileSync(
      smokePath,
      renderGatewayAuthSmokeScript({
        home: input.home,
        workspaceHost: input.workspaceBootstrap.workspaceHost,
      }),
      { mode: 0o755 },
    );
    fs.chmodSync(smokePath, 0o755);
  }

  return actions;
}

export function loadOsConfig(home?: string): OsConfig | null {
  const resolvedHome = resolveOsHome(home);
  return readJsonFile<OsConfig>(path.join(resolvedHome, 'config.json'));
}

export function detectAgents(home?: string): AgentDetection[] {
  const resolvedHome = resolveOsHome(home);
  const config = loadOsConfig(resolvedHome);
  const connected = new Set(
    (config?.agents ?? [])
      .filter((agent) => agent.connected)
      .map((agent) => agent.name),
  );
  const userHome = os.homedir();
  const candidates: Array<
    Omit<AgentDetection, 'detected' | 'connected' | 'status'>
  > = [
    {
      name: 'codex',
      label: 'Codex',
      homePath: path.join(userHome, '.codex'),
      configPath: path.join(userHome, '.codex', 'consuelo-os.json'),
    },
    {
      name: 'claude',
      label: 'Claude',
      homePath: path.join(userHome, '.claude'),
      configPath: path.join(userHome, '.claude', 'consuelo-os.json'),
    },
    {
      name: 'opencode',
      label: 'OpenCode',
      homePath: path.join(userHome, '.opencode'),
      configPath: path.join(userHome, '.opencode', 'consuelo-os.json'),
    },
    {
      name: 'opencode',
      label: 'OpenCode config',
      homePath: path.join(userHome, '.config', 'opencode'),
      configPath: path.join(
        userHome,
        '.config',
        'opencode',
        'consuelo-os.json',
      ),
    },
    {
      name: 'factory',
      label: 'Factory',
      homePath: path.join(userHome, '.factory'),
      configPath: path.join(userHome, '.factory', 'consuelo-os.json'),
    },
  ];

  return candidates.map((candidate) => {
    const detected = fs.existsSync(candidate.homePath);
    const isConnected =
      connected.has(candidate.name) || fs.existsSync(candidate.configPath);
    return {
      ...candidate,
      detected,
      connected: isConnected,
      status: detected
        ? isConnected
          ? 'connected'
          : 'not_configured'
        : 'missing_capability',
    };
  });
}

function connectAgent(
  home: string,
  config: OsConfig,
  agent: AgentDetection,
  dryRun: boolean,
): ProvisionAction[] {
  const actions: ProvisionAction[] = [];
  const record = {
    name: agent.name,
    label: agent.label,
    osHome: home,
    portal: {
      url: `http://127.0.0.1:${config.port}`,
      steeringUrl: `http://127.0.0.1:${config.port}/get_steering`,
      callUrl: `http://127.0.0.1:${config.port}/call`,
    },
    commands: {
      start: 'consuelo os start',
      doctor: 'consuelo os doctor',
    },
    connectedAt: nowIso(),
  };

  if (!agent.detected) {
    actions.push({
      type: 'skip_agent',
      path: agent.homePath,
      status: 'skipped',
      message: `${agent.label} was not detected`,
    });
    return actions;
  }

  const backupPath = `${agent.configPath}.bak`;
  if (
    !dryRun &&
    fs.existsSync(agent.configPath) &&
    !fs.existsSync(backupPath)
  ) {
    fs.copyFileSync(agent.configPath, backupPath);
  }
  writeJsonFile(agent.configPath, record, dryRun);
  actions.push({
    type: 'connect_agent',
    path: agent.configPath,
    status: dryRun ? 'planned' : 'created',
    message: `connected ${agent.label}`,
  });

  const existingIndex = config.agents.findIndex(
    (item) => item.name === agent.name && item.homePath === agent.homePath,
  );
  const agentConfig = {
    name: agent.name,
    homePath: agent.homePath,
    configPath: agent.configPath,
    connected: true,
    connectedAt: nowIso(),
  };
  if (existingIndex >= 0) config.agents[existingIndex] = agentConfig;
  else config.agents.push(agentConfig);

  return actions;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJsonObject(filePath: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isJsonObject(parsed)) {
    throw new Error(`${filePath}: expected JSON object`);
  }
  return parsed;
}

function toPackageRootRelative(filePath: string): string {
  return path.relative(PACKAGE_ROOT, filePath).split(path.sep).join('/');
}

function toPortableSkillJson(skillDir: string, skillName: string): JsonObject {
  const skill = readJsonObject(path.join(skillDir, 'skill.json'));
  const entrypoint = typeof skill.entrypoint === 'string' && skill.entrypoint.length > 0
    ? skill.entrypoint
    : 'skill.json';
  const load = isJsonObject(skill.load) ? skill.load : {};
  return {
    ...skill,
    entrypoint,
    load: {
      ...load,
      type: typeof load.type === 'string' ? load.type : 'resource',
      path: `skills/${skillName}/${entrypoint}`,
    },
  };
}

function compactSkillMetadata(skill: JsonObject): JsonObject {
  const compact: JsonObject = {};
  for (const field of COMPACT_SKILL_FIELDS) {
    if (field in skill) compact[field] = skill[field];
  }
  return compact;
}

function listSkillDirs(skillsRoot: string): string[] {
  if (!fs.existsSync(skillsRoot)) return [];
  return fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(skillsRoot, entry.name))
    .filter((skillDir) => fs.existsSync(path.join(skillDir, 'skill.json')));
}

function getSkillName(skillDir: string): string {
  const skill = readJsonObject(path.join(skillDir, 'skill.json'));
  return typeof skill.name === 'string' && skill.name.length > 0
    ? skill.name
    : path.basename(skillDir);
}

function collectSkillFiles(skillDir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(skillDir, { withFileTypes: true })) {
    if (entry.name === SKILL_METADATA_FILE) continue;
    const filePath = path.join(skillDir, entry.name);
    if (entry.isDirectory()) files.push(...collectSkillFiles(filePath));
    else if (entry.isFile()) files.push(filePath);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function skillTreeHash(skillDir: string, skillName: string, portable: boolean): string {
  const hash = createHash('sha256');
  for (const filePath of collectSkillFiles(skillDir)) {
    const relativePath = path.relative(skillDir, filePath).split(path.sep).join('/');
    const content = portable && relativePath === 'skill.json'
      ? `${JSON.stringify(toPortableSkillJson(skillDir, skillName), null, 2)}\n`
      : fs.readFileSync(filePath);
    hash.update(relativePath);
    hash.update('\0');
    hash.update(content);
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

function copyBundledSkill(skillDir: string, targetDir: string, skillName: string): void {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const filePath of collectSkillFiles(skillDir)) {
    const relativePath = path.relative(skillDir, filePath).split(path.sep).join('/');
    const targetPath = path.join(targetDir, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (relativePath === 'skill.json') {
      fs.writeFileSync(targetPath, `${JSON.stringify(toPortableSkillJson(skillDir, skillName), null, 2)}\n`);
    } else {
      fs.copyFileSync(filePath, targetPath);
    }
  }
}

function readSkillInstallMetadata(filePath: string): SkillInstallMetadata | null {
  const metadata = readJsonFile<SkillInstallMetadata>(filePath);
  return metadata?.source === 'bundled' ? metadata : null;
}

function writeInstalledSkillsRegistry(skillsRoot: string, dryRun: boolean): ProvisionAction[] {
  const outputPath = path.join(skillsRoot, SKILLS_REGISTRY_FILE);
  if (dryRun) {
    return [{
      type: 'create_file',
      path: outputPath,
      status: 'planned',
      message: 'skills registry will be written',
    }];
  }

  const skills = listSkillDirs(skillsRoot)
    .map((skillDir) => compactSkillMetadata(readJsonObject(path.join(skillDir, 'skill.json'))))
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
  fs.writeFileSync(outputPath, `${JSON.stringify({ version: 1, skills }, null, 2)}\n`, { mode: 0o600 });
  return [{
    type: 'create_file',
    path: outputPath,
    status: 'created',
    message: 'skills registry written',
  }];
}

function migrateSelectedSkillNames(selectedSkills: readonly string[]): string[] {
  const migrated = selectedSkills.map((skillName) => skillName === 'office' ? 'sites' : skillName);
  return [...new Set(migrated)];
}

function seedBundledSkills(
  home: string,
  dryRun: boolean,
  selectedSkills?: readonly string[],
): ProvisionAction[] {
  const actions: ProvisionAction[] = [];
  const skillsRoot = path.join(home, 'skills');
  const bundledSkillNames = new Set<string>();
  const now = nowIso();

  for (const sourceDir of listSkillDirs(BUNDLED_SKILLS_ROOT)) {
    const skillName = getSkillName(sourceDir);
    bundledSkillNames.add(skillName);
    const targetDir = path.join(skillsRoot, skillName);
    const metadataPath = path.join(targetDir, SKILL_METADATA_FILE);
    const sourceHash = skillTreeHash(sourceDir, skillName, true);
    const existingMetadata = readSkillInstallMetadata(metadataPath);
    const targetExists = fs.existsSync(targetDir);
    const selectedSet = selectedSkills ? new Set(selectedSkills) : null;

    if (selectedSet && !selectedSet.has(skillName)) {
      actions.push({
        type: 'seed_skill',
        path: targetDir,
        status: 'skipped',
        message: targetExists
          ? 'bundled skill not selected; existing install preserved'
          : 'bundled skill not selected',
      });
      continue;
    }

    if (targetExists && !existingMetadata) {
      actions.push({
        type: 'seed_skill',
        path: targetDir,
        status: 'skipped',
        message: 'local skill preserved',
      });
      continue;
    }

    if (existingMetadata) {
      const installedHash = skillTreeHash(targetDir, skillName, false);
      if (installedHash !== existingMetadata.hash) {
        actions.push({
          type: 'seed_skill',
          path: targetDir,
          status: 'skipped',
          message: 'bundled skill has local changes; preserved',
        });
        continue;
      }
      if (existingMetadata.hash === sourceHash) {
        actions.push({
          type: 'seed_skill',
          path: targetDir,
          status: 'preserved',
          message: 'bundled skill already installed',
        });
        continue;
      }
    }

    actions.push({
      type: 'seed_skill',
      path: targetDir,
      status: dryRun ? 'planned' : 'created',
      message: targetExists ? 'bundled skill refreshed' : 'bundled skill installed',
    });

    if (!dryRun) {
      if (targetExists) fs.rmSync(targetDir, { recursive: true, force: true });
      copyBundledSkill(sourceDir, targetDir, skillName);
      const metadata: SkillInstallMetadata = {
        version: 1,
        name: skillName,
        source: 'bundled',
        sourcePath: toPackageRootRelative(sourceDir),
        hash: sourceHash,
        installedAt: existingMetadata?.installedAt ?? now,
        updatedAt: now,
      };
      fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
    }
  }

  for (const installedSkillDir of listSkillDirs(skillsRoot)) {
    const skillName = getSkillName(installedSkillDir);
    if (bundledSkillNames.has(skillName)) continue;
    actions.push({
      type: 'seed_skill',
      path: installedSkillDir,
      status: 'skipped',
      message: 'local skill preserved',
    });
  }

  actions.push(...writeInstalledSkillsRegistry(skillsRoot, dryRun));
  return actions;
}


function readBundledToolManifest(): CanonicalToolManifest {
  const parsed = readJsonFile<CanonicalToolManifest>(BUNDLED_TOOL_MANIFEST_PATH);
  if (!parsed || !Array.isArray(parsed.tools)) {
    throw new Error(`${BUNDLED_TOOL_MANIFEST_PATH}: expected full OS tool manifest with tools array`);
  }
  for (const entry of parsed.tools) {
    if (!entry || typeof entry.name !== 'string' || entry.name.length === 0) {
      throw new Error(`${BUNDLED_TOOL_MANIFEST_PATH}: every tool entry needs a name`);
    }
  }
  return parsed;
}

function compactToolEntry(entry: CanonicalToolEntry): JsonObject {
  return {
    name: entry.name,
    kind: entry.kind,
    source: entry.source,
    sourcePath: entry.sourcePath,
    category: entry.category,
    description: entry.description,
    core: Boolean(entry.core),
    definition: entry.definition,
  };
}

function toolEntryHash(entry: CanonicalToolEntry): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(compactToolEntry(entry)));
  return `sha256:${hash.digest('hex')}`;
}

function listToolDirs(toolsRoot: string): string[] {
  if (!fs.existsSync(toolsRoot)) return [];
  return fs.readdirSync(toolsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(toolsRoot, entry.name))
    .filter((toolDir) => fs.existsSync(path.join(toolDir, TOOL_DEFINITION_FILE)));
}

function readToolInstallMetadata(filePath: string): ToolInstallMetadata | null {
  const metadata = readJsonFile<ToolInstallMetadata>(filePath);
  return metadata?.source === 'bundled' ? metadata : null;
}

function readInstalledToolDefinition(toolDir: string): JsonObject {
  return readJsonObject(path.join(toolDir, TOOL_DEFINITION_FILE));
}

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function toolWrapperScript(entry: CanonicalToolEntry): string {
  const toolName = entry.name;
  const description = entry.description ?? 'Consuelo OS tool.';
  const quotedName = shellSingleQuote(toolName);
  const jsonName = shellSingleQuote(JSON.stringify(toolName));
  const runner = entry.kind === 'facade-tool'
    ? `exec bun ./scripts/tool-runner.ts ${quotedName} "$INPUT"`
    : `exec bun ./scripts/os.ts call "$(printf '{"name":%s,"input":%s}' ${jsonName} "$INPUT")"`;

  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    `TOOL_NAME=${quotedName}`,
    `TOOL_DESCRIPTION=${shellSingleQuote(description)}`,
    'OS_HOME="${CONSUELO_OS_HOME:-${CONSUELO_HOME:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}}"',
    'if [ ! -f "$OS_HOME/package.json" ] || [ ! -f "$OS_HOME/scripts/tool-runner.ts" ]; then',
    '  printf "%s\\n" "error: Consuelo OS package root not found. Set CONSUELO_OS_HOME." >&2',
    '  exit 1',
    'fi',
    'if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then',
    '  printf "%s\\n" "usage: $TOOL_NAME [json-input]"',
    '  printf "%s\\n" ""',
    '  printf "%s\\n" "$TOOL_DESCRIPTION"',
    '  exit 0',
    'fi',
    'if [ "$#" -gt 0 ]; then',
    '  INPUT="$1"',
    'else',
    "  INPUT='{}'",
    'fi',
    'cd "$OS_HOME"',
    runner,
    '',
  ].join('\n');
}

function writeBundledTool(entry: CanonicalToolEntry, targetDir: string, binDir: string, dryRun: boolean): void {
  if (dryRun) return;
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(
    path.join(targetDir, TOOL_DEFINITION_FILE),
    `${JSON.stringify(compactToolEntry(entry), null, 2)}\n`,
    { mode: 0o600 },
  );
  const wrapperPath = path.join(binDir, entry.name);
  fs.mkdirSync(path.dirname(wrapperPath), { recursive: true });
  fs.writeFileSync(wrapperPath, toolWrapperScript(entry), { mode: 0o755 });
  fs.chmodSync(wrapperPath, 0o755);
}

function writeInstalledToolsRegistry(toolsRoot: string, dryRun: boolean): ProvisionAction[] {
  const outputPath = path.join(toolsRoot, TOOL_REGISTRY_FILE);
  if (dryRun) {
    return [{
      type: 'create_file',
      path: outputPath,
      status: 'planned',
      message: 'tools registry will be written',
    }];
  }

  const tools = listToolDirs(toolsRoot)
    .map((toolDir) => readInstalledToolDefinition(toolDir))
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
  fs.writeFileSync(outputPath, `${JSON.stringify({ version: 1, kind: 'consuelo-os-installed-tool-manifest', tools }, null, 2)}\n`, { mode: 0o600 });
  return [{
    type: 'create_file',
    path: outputPath,
    status: 'created',
    message: 'tools registry written',
  }];
}

function seedBundledTools(home: string, dryRun: boolean): ProvisionAction[] {
  const actions: ProvisionAction[] = [];
  const toolsRoot = path.join(home, 'tools');
  const binDir = path.join(home, 'bin');
  const manifest = readBundledToolManifest();
  const bundledToolNames = new Set<string>();
  const now = nowIso();

  for (const entry of manifest.tools) {
    bundledToolNames.add(entry.name);
    const targetDir = path.join(toolsRoot, entry.name);
    const metadataPath = path.join(targetDir, TOOL_METADATA_FILE);
    const sourceHash = toolEntryHash(entry);
    const existingMetadata = readToolInstallMetadata(metadataPath);
    const targetExists = fs.existsSync(targetDir);

    if (targetExists && !existingMetadata) {
      actions.push({
        type: 'seed_tool',
        path: targetDir,
        status: 'skipped',
        message: 'local tool preserved',
      });
      continue;
    }

    if (existingMetadata) {
      const installedDefinition = readInstalledToolDefinition(targetDir);
      const installedHash = `sha256:${createHash('sha256').update(JSON.stringify(installedDefinition)).digest('hex')}`;
      if (installedHash !== existingMetadata.hash) {
        actions.push({
          type: 'seed_tool',
          path: targetDir,
          status: 'skipped',
          message: 'bundled tool has local changes; preserved',
        });
        continue;
      }
      if (existingMetadata.hash === sourceHash) {
        actions.push({
          type: 'seed_tool',
          path: targetDir,
          status: 'preserved',
          message: 'bundled tool already installed',
        });
        continue;
      }
    }

    actions.push({
      type: 'seed_tool',
      path: targetDir,
      status: dryRun ? 'planned' : 'created',
      message: targetExists ? 'bundled tool refreshed' : 'bundled tool installed',
    });

    if (!dryRun) {
      if (targetExists) fs.rmSync(targetDir, { recursive: true, force: true });
      writeBundledTool(entry, targetDir, binDir, false);
      const metadata: ToolInstallMetadata = {
        version: 1,
        name: entry.name,
        source: 'bundled',
        sourcePath: toPackageRootRelative(BUNDLED_TOOL_MANIFEST_PATH),
        hash: sourceHash,
        installedAt: existingMetadata?.installedAt ?? now,
        updatedAt: now,
      };
      fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
    }
  }

  for (const installedToolDir of listToolDirs(toolsRoot)) {
    const toolName = String(readInstalledToolDefinition(installedToolDir).name ?? path.basename(installedToolDir));
    if (bundledToolNames.has(toolName)) continue;
    actions.push({
      type: 'seed_tool',
      path: installedToolDir,
      status: 'skipped',
      message: 'local tool preserved',
    });
  }

  actions.push(...writeInstalledToolsRegistry(toolsRoot, dryRun));
  return actions;
}

export function provisionLocalOs(
  options: ProvisionOptions = {},
): ProvisionResult {
  const home = resolveOsHome(options.home);
  const configPath = path.join(home, 'config.json');
  const dbPath = path.join(home, 'consuelo.db');
  const dryRun = Boolean(options.dryRun);
  const actions: ProvisionAction[] = [];

  for (const dir of [
    home,
    ...REQUIRED_DIRS.map((entry) => path.join(home, entry)),
  ]) {
    const exists = fs.existsSync(dir);
    actions.push({
      type: 'create_dir',
      path: dir,
      status: exists ? 'preserved' : dryRun ? 'planned' : 'created',
      message: exists ? 'directory exists' : 'directory created',
    });
    if (!dryRun) fs.mkdirSync(dir, { recursive: true });
  }

  actions.push(...materializeProductPackageRoot(home, dryRun));
  actions.push(...materializeOperator(home, dryRun));
  actions.push(...seedBundledSteering(home, dryRun));

  let config = readJsonFile<OsConfig>(configPath);
  if (config) {
    actions.push({
      type: 'preserve_file',
      path: configPath,
      status: 'preserved',
      message: 'config exists',
    });
  } else {
    config = createDefaultConfig(
      home,
      options.mode ?? 'local',
      options.port ?? DEFAULT_PORT,
    );
    actions.push({
      type: 'create_file',
      path: configPath,
      status: dryRun ? 'planned' : 'created',
      message: 'config created',
    });
    writeJsonFile(configPath, config, dryRun);
  }

  if (fs.existsSync(dbPath)) {
    actions.push({
      type: 'preserve_file',
      path: dbPath,
      status: 'preserved',
      message: 'database exists',
    });
  } else {
    actions.push({
      type: 'create_file',
      path: dbPath,
      status: dryRun ? 'planned' : 'created',
      message: 'database initialized',
    });
    if (!dryRun) {
      fs.closeSync(fs.openSync(dbPath, 'a'));
    }
  }

  const generatedSecurityDir = path.join(home, 'security', 'generated');
  const securityOverridesDir = path.join(home, 'security', 'overrides');
  const generatedAuthPath = path.join(home, 'security', 'generated', 'auth.json');
  const generatedCaddyfilePath = path.join(home, 'security', 'generated', 'Caddyfile');
  const generatedSecurityDirExists = fs.existsSync(generatedSecurityDir);
  const securityOverridesDirExists = fs.existsSync(securityOverridesDir);
  const generatedAuthPathExists = fs.existsSync(generatedAuthPath);
  const generatedCaddyfilePathExists = fs.existsSync(generatedCaddyfilePath);
  const securityStatus = (exists: boolean): ProvisionAction['status'] => exists ? 'preserved' : dryRun ? 'planned' : 'created';

  const gatewayPort = options.port ?? config.port ?? DEFAULT_PORT;
  const workspaceBootstrap = options.workspaceBootstrap;
  const workspaceIdentity = workspaceBootstrap
    ? {
        workspaceId: workspaceBootstrap.workspaceId,
        workspaceSlug: workspaceBootstrap.workspaceSlug,
        workspaceHost: workspaceBootstrap.workspaceHost,
      }
    : {
        workspaceId: 'local-consuelo-os',
        workspaceSlug: 'local',
        workspaceHost: 'local.consuelohq.com',
      };

  config.port = gatewayPort;
  config.workspace = {
    id: workspaceIdentity.workspaceId,
    slug: workspaceIdentity.workspaceSlug,
    host: workspaceIdentity.workspaceHost,
  };
  if (workspaceBootstrap) {
    config.connector = {
      id: workspaceBootstrap.connectorId,
      transport: workspaceBootstrap.connectorTransport,
      status: 'configured',
    };
  }

  if (!dryRun) {
    const gatewayConfig = createGatewaySecurityConfig({
      home,
      workspaceId: workspaceIdentity.workspaceId,
      workspaceSlug: workspaceIdentity.workspaceSlug,
      workspaceHost: workspaceIdentity.workspaceHost,
      upstreamPort: gatewayPort,
    });
    config.security = {
      auth: {
        kind: 'consuelo-generated',
        status: 'configured',
        path: gatewayConfig.generatedAuthPath,
        tokenIssuer: gatewayConfig.tokenIssuer,
        signingKeyId: gatewayConfig.signingKeyId,
      },
      gateway: {
        workspaceHost: gatewayConfig.workspaceHost,
        publicRoutes: [...gatewayConfig.publicRoutes],
      },
    };
  }
  actions.push({
    type: 'create_dir',
    path: generatedSecurityDir,
    status: securityStatus(generatedSecurityDirExists),
    message: 'generated security directory configured',
  });
  actions.push({
    type: 'create_dir',
    path: securityOverridesDir,
    status: securityStatus(securityOverridesDirExists),
    message: 'security overrides directory configured',
  });
  actions.push({
    type: 'create_file',
    path: generatedAuthPath,
    status: securityStatus(generatedAuthPathExists),
    message: 'generated Consuelo auth config written',
  });
  actions.push({
    type: 'create_file',
    path: generatedCaddyfilePath,
    status: securityStatus(generatedCaddyfilePathExists),
    message: 'generated Caddy gateway config written',
  });
  if (workspaceBootstrap?.cloudflareTunnelToken) {
    actions.push(
      ...materializeWorkspaceConnectorBootstrap({
        home,
        port: gatewayPort,
        dryRun,
        workspaceBootstrap,
      }),
    );
  }
  actions.push(...materializeSites({ home, dbPath, dryRun }).actions);
  config.selectedSkills = migrateSelectedSkillNames(
    options.selectedSkills ??
    config.selectedSkills ??
    getDefaultSelectedSkillNames(),
  );
  config.artifactStorage = options.artifactStorage ?? config.artifactStorage;
  actions.push(...seedBundledSkills(home, dryRun, config.selectedSkills));
  actions.push(...seedBundledTools(home, dryRun));

  const agents = detectAgents(home);
  const requestedAgents = new Set(options.connectAgents ?? []);
  for (const agent of agents) {
    if (requestedAgents.has(agent.name))
      actions.push(...connectAgent(home, config, agent, dryRun));
  }

  if (!dryRun) {
    config.updatedAt = nowIso();
    writeJsonFile(configPath, config, false);
  }

  return { home, configPath, dbPath, actions, agents: detectAgents(home) };
}

export async function runDoctor(home?: string): Promise<DoctorResult> {
  const resolvedHome = resolveOsHome(home);
  const checks: DoctorCheck[] = [];
  const requiredPaths = [
    resolvedHome,
    path.join(resolvedHome, 'config.json'),
    ...REQUIRED_DIRS.map((entry) => path.join(resolvedHome, entry)),
  ];

  checks.push({
    name: 'bun',
    status: typeof Bun !== 'undefined' ? 'connected' : 'missing_capability',
    message:
      typeof Bun !== 'undefined' ? `Bun ${Bun.version}` : 'Bun is required',
  });

  for (const requiredPath of requiredPaths) {
    checks.push({
      name: path.basename(requiredPath) || requiredPath,
      status: fs.existsSync(requiredPath) ? 'connected' : 'not_configured',
      message: fs.existsSync(requiredPath)
        ? `${requiredPath} exists`
        : `${requiredPath} is missing`,
    });
  }

  for (const requiredFile of REQUIRED_GENERATED_SECURITY_FILES) {
    const requiredPath = path.join(resolvedHome, requiredFile);
    checks.push({
      name: `gateway:${path.basename(requiredPath)}`,
      status: fs.existsSync(requiredPath) ? 'connected' : 'unhealthy',
      message: fs.existsSync(requiredPath)
        ? `${requiredPath} exists`
        : `${requiredPath} is missing`,
    });
  }

  const runtimeModuleGroups = [
    {
      name: 'runtime:intent',
      files: [
        'scripts/task-intent.js',
        'hooks/intent.js',
        'hooks/dispatcher.js',
        'manifests/workflow-bundles.json',
      ],
    },
    {
      name: 'runtime:task-hook',
      files: [
        'scripts/task-hook.js',
        'hooks/task/guidance.js',
        'hooks/task/workflow.js',
        'hooks/dispatcher.js',
      ],
    },
  ] as const;

  for (const group of runtimeModuleGroups) {
    const missing = group.files.filter((file) => !fs.existsSync(path.join(resolvedHome, file)));
    checks.push({
      name: group.name,
      status: missing.length === 0 ? 'connected' : 'unhealthy',
      message: missing.length === 0
        ? `${group.files.join(', ')} exist`
        : `missing ${missing.join(', ')}`,
    });
  }
  try {
    const { Database } = await import('bun:sqlite');
    const db = new Database(path.join(resolvedHome, 'consuelo.db'));
    db.close();
    checks.push({
      name: 'sqlite',
      status: 'connected',
      message: 'SQLite database opens',
    });

  } catch (error: unknown) {
    checks.push({
      name: 'sqlite',
      status: 'unhealthy',
      message:
        error instanceof Error ? error.message : 'SQLite database failed',
    });
  }
  try {
    const { getSteering } = await import('../os');
    const steering = getSteering();
    checks.push({
      name: 'portal',
      status: steering.includes('Consuelo OS') ? 'connected' : 'unhealthy',
      message: 'OS portal returned steering',
    });
  } catch (error: unknown) {
    checks.push({

      name: 'portal',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'OS portal failed',
    });
  }

  const skillIssues = validateBundledSkills();
  checks.push({
    name: 'skills',
    status: skillIssues.length === 0 ? 'connected' : 'unhealthy',
    message:
      skillIssues.length === 0
        ? 'bundled skill metadata matches manifest'
        : `${skillIssues.length} bundled skill issue(s)`,
  });

  try {
    const { executeCall } = await import('../os');
    const result = await executeCall({
      name: 'daily-revenue-brief',
      traceId: `trc_doctor_${Date.now().toString(36)}`,
    });
    checks.push({
      name: 'daily-revenue-brief',
      status: result.ok && result.artifacts?.length ? 'connected' : 'unhealthy',
      message: result.ok
        ? 'skill created a local artifact'
        : (result.error?.message ?? 'skill failed'),
    });
  } catch (error: unknown) {
    checks.push({
      name: 'daily-revenue-brief',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'skill failed',
    });
  }

  for (const agent of detectAgents(resolvedHome)) {
    checks.push({
      name: agent.label,
      status: agent.status,
      message: agent.detected
        ? agent.connected
          ? 'agent connection recorded'
          : 'agent detected, connection pending'
        : 'agent not detected',
    });
  }

  const { getCapabilityHealth, isCapabilitySetHealthy } = await import(
    './capabilities'
  );
  const capabilities = getCapabilityHealth(resolvedHome);
  for (const capability of capabilities) {
    checks.push({
      name: `capability:${capability.id}`,
      status: capability.status,
      message: capability.message,
    });
  }

  const basicChecksHealthy = checks.every(
    (check) =>
      check.status === 'connected' ||
      check.status === 'missing_capability' ||
      check.status === 'not_configured' ||
      check.status === 'local_only' ||
      check.status === 'cloud_only',
  );
  return {
    home: resolvedHome,
    checks,
    ok: basicChecksHealthy && isCapabilitySetHealthy(capabilities),
  };
}



