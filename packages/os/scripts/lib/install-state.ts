import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createDefaultGlobalYamlConfig,
  createDefaultNodeYamlConfig,
  createDefaultWorkspaceYamlConfig,
  loadGlobalYamlConfig,
  loadNodeYamlConfig,
  loadWorkspaceYamlConfig,
  resolveConsueloHome,
  resolveConsueloHomeLayout,
  writeYamlConfig,
} from './consuelo-home';
import { CHATGPT_MCP_URL } from './chatgpt-mcp-connection';
import {
  configureLocalAgents,
  detectLocalAgents,
  toLocalAgentConfigRecords,
  type AgentConnectionStatus,
  type AgentName,
  type LocalAgentConfigRecord,
  type LocalAgentDetection,
} from './local-agent-connectivity';
import { getDefaultSelectedSkillNames } from './onboarding-skills';
import { provisionManagedComponentIndexes } from './managed-component-install';
import {
  renderWorkspaceCloudflaredSystemdUnit,
  renderWorkspaceNodeHeartbeatSystemdUnits,
} from './platforms/linux';
import {
  createGatewaySecurityConfig,
  getAgentAppCredentialStatus,
  issueAgentAppToken,
  updateAgentAppTokenScopes,
} from './security-gateway';
import { materializeSites as materializeRuntimeSites } from './sites';
import { validateBundledSkills } from './skills';
import { STANDARD_OS_MCP_SCOPES } from './tool-scope-authorization';
import { planWorkspaceConnectorTransport } from './workspace-connector-transport';

export type OsMode = 'local' | 'cloud';
export type { AgentName, AgentConnectionStatus } from './local-agent-connectivity';
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
  | 'execution_failed'
  | AgentConnectionStatus;

export type AgentDetection = LocalAgentDetection;

export type WorkspaceBootstrap = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  connectorId: string;
  connectorTransport: 'cloudflare-tunnel' | 'websocket-relay';
  nodeId?: string;
  nodeName?: string;
  nodeRole?: 'home' | 'member';
  nodeStatus?: 'created' | 'reconnected';
  nodePublicKeyJwk?: string;
  nodeSigningKeyJwk?: string;
  nodeCapabilities?: string[];
  authorityOrigin?: string;
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
  agents: LocalAgentConfigRecord[];
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
  platform?: NodeJS.Platform | string;
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
  status: 'planned' | 'created' | 'preserved' | 'updated' | 'skipped';
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
  'components',
  'skills',
  'tools',
  'scripts',
  'src',
  'manifests',
  'workflows',
  'hooks',
  'artifacts',
  'pages',
  'sites',
  'logs',
  'runs',
  'cache',
  'steering',
  'bin',
  'tmp',
  'runtime',
  'runtime/releases',
  'node',
  'node/keys',
  'node/security',
  'node/security/generated',
  'node/security/overrides',
  'node/tunnels',
  'node/caddy',
  'node/db',
  'node/logs',
  'node/runs',
  'node/cache',
  'node/tmp',
  'node/workspaces',
  'workspaces',
] as const;

const REQUIRED_GENERATED_SECURITY_FILES = [
  'node/security/generated/auth.json',
  'node/caddy/Caddyfile',
] as const;
const LEGACY_DEFAULT_PORT = 8960;
const DEFAULT_PORT = 46321;

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
const BUNDLED_STREAMS_ROOT = path.join(PACKAGE_ROOT, 'streams');
const BUNDLED_OPERATOR_ROOT = resolveBundledOperatorRoot();
const BUNDLED_TOOL_MANIFEST_PATH = path.join(PACKAGE_ROOT, 'manifests', 'generated', 'tool.manifest.json');
const PRODUCT_PACKAGE_DIRS = ['scripts', 'src', 'manifests', 'workflows', 'hooks'] as const;
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

export function resolveOsHome(home?: string): string {
  return resolveConsueloHome(home);
}

export type LocalNodeIdentity = {
  nodeId: string;
  nodeName: string;
  nodeRole?: 'home' | 'member';
};

export function readLocalNodeIdentity(home?: string): LocalNodeIdentity | undefined {
  const layout = resolveConsueloHomeLayout(resolveOsHome(home));
  if (!fs.existsSync(layout.nodeConfigPath)) return undefined;
  try {
    const config = loadNodeYamlConfig(layout.nodeConfigPath);
    return {
      nodeId: config.node.id,
      nodeName: config.node.name,
      ...(config.node.role ? { nodeRole: config.node.role } : {}),
    };
  } catch {
    return undefined;
  }
}

type ExistingProvisionIdentity = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  node?: LocalNodeIdentity;
};

function readExistingProvisionIdentity(input: {
  home: string;
  layout: ReturnType<typeof resolveConsueloHomeLayout>;
  config: OsConfig;
}): ExistingProvisionIdentity | undefined {
  const node = readLocalNodeIdentity(input.home);

  if (!fs.existsSync(input.layout.globalConfigPath)) {
    return input.config.workspace
      ? {
          workspaceId: input.config.workspace.id,
          workspaceSlug: input.config.workspace.slug,
          workspaceHost: input.config.workspace.host,
          ...(node ? { node } : {}),
        }
      : undefined;
  }

  const globalConfig = loadGlobalYamlConfig(input.layout.globalConfigPath);
  const activeWorkspace = globalConfig.activeWorkspace;
  if (!activeWorkspace) {
    return input.config.workspace
      ? {
          workspaceId: input.config.workspace.id,
          workspaceSlug: input.config.workspace.slug,
          workspaceHost: input.config.workspace.host,
          ...(node ? { node } : {}),
        }
      : undefined;
  }

  if (input.config.workspace && input.config.workspace.id !== activeWorkspace) {
    throw new Error('active workspace does not match the installed OS config');
  }

  const workspaceConfigPath = input.layout.workspaceConfigPath(activeWorkspace);
  if (!fs.existsSync(workspaceConfigPath)) {
    throw new Error('active workspace config is missing');
  }

  const workspaceConfig = loadWorkspaceYamlConfig(workspaceConfigPath);
  if (workspaceConfig.workspace.id !== activeWorkspace) {
    throw new Error('active workspace does not match workspace.yaml');
  }

  const fallbackWorkspace = input.config.workspace?.id === activeWorkspace
    ? input.config.workspace
    : undefined;
  const workspaceSlug = workspaceConfig.workspace.slug ?? fallbackWorkspace?.slug;
  const workspaceHost = workspaceConfig.workspace.host ?? fallbackWorkspace?.host;
  if (!workspaceSlug || !workspaceHost) {
    throw new Error('active workspace is missing its slug or host');
  }

  if (globalConfig.activeNode && node && globalConfig.activeNode !== node.nodeId) {
    throw new Error('active node does not match node.yaml');
  }

  return {
    workspaceId: activeWorkspace,
    workspaceSlug,
    workspaceHost,
    ...(node
      ? { node }
      : globalConfig.activeNode
        ? {
            node: {
              nodeId: globalConfig.activeNode,
              nodeName: os.hostname() || 'local',
            },
          }
        : {}),
  };
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

function addFileAction(input: {
  actions: ProvisionAction[];
  path: string;
  exists: boolean;
  dryRun: boolean;
  message: string;
}): void {
  input.actions.push({
    type: 'create_file',
    path: input.path,
    status: input.exists ? 'preserved' : input.dryRun ? 'planned' : 'created',
    message: input.message,
  });
}

function writeYamlConfigIfMissing(input: {
  actions: ProvisionAction[];
  path: string;
  value: unknown;
  dryRun: boolean;
  message: string;
}): void {
  const exists = fs.existsSync(input.path);
  addFileAction({
    actions: input.actions,
    path: input.path,
    exists,
    dryRun: input.dryRun,
    message: input.message,
  });
  if (!exists) writeYamlConfig(input.path, input.value, input.dryRun);
}

function seedBundledStreams(
  home: string,
  dryRun: boolean,
): ProvisionAction[] {
  const sourcePath = path.join(BUNDLED_STREAMS_ROOT, 'tools', 'AGENTS.md');
  const targetPath = path.join(home, 'streams', 'tools', 'AGENTS.md');
  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      `${sourcePath}: required Tools stream instructions are missing`,
    );
  }

  const targetExists = fs.existsSync(targetPath);
  const actions: ProvisionAction[] = [
    {
      type: 'seed_stream',
      path: targetPath,
      status: targetExists ? 'preserved' : dryRun ? 'planned' : 'created',
      message: targetExists
        ? 'user stream instructions preserved'
        : 'Tools stream instructions installed',
    },
  ];
  if (!dryRun && !targetExists) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
  return actions;
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
  startIntervalSeconds?: number;
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
    ...(input.startIntervalSeconds
      ? [
          '  <key>StartInterval</key>',
          `  <integer>${input.startIntervalSeconds}</integer>`,
        ]
      : []),
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


function materializeChatGptMcpConnection(input: {
  home: string;
  config: ReturnType<typeof createGatewaySecurityConfig>;
  port: number;
  dryRun: boolean;
}): ProvisionAction[] {
  const targetPath = path.join(input.home, 'security', 'generated', 'chatgpt-mcp.json');
  const scopes = [...STANDARD_OS_MCP_SCOPES];
  if (input.dryRun) {
    return [{ type: 'create_file', path: targetPath, status: 'planned', message: 'ChatGPT MCP connection planned' }];
  }
  const existing = readJsonFile<JsonObject>(targetPath);
  const localUrl = `http://127.0.0.1:${input.port}/mcp`;
  const hasExistingConnection =
    typeof existing?.bearerToken === 'string' &&
    typeof existing?.tokenId === 'string' &&
    typeof existing?.url === 'string';
  if (hasExistingConnection) {
    const credential = getAgentAppCredentialStatus({
      config: input.config,
      tokenId: existing.tokenId,
    });
    if (credential?.status === 'active') {
      updateAgentAppTokenScopes({
        config: input.config,
        tokenId: existing.tokenId,
        scopes,
      });
      if (
        existing.url !== CHATGPT_MCP_URL ||
        existing.localUrl !== localUrl ||
        JSON.stringify(existing.scopes) !== JSON.stringify(scopes)
      ) {
        writeJsonFile(targetPath, {
          ...existing,
          url: CHATGPT_MCP_URL,
          localUrl,
          scopes,
          updatedAt: nowIso(),
        }, false);
        return [{ type: 'create_file', path: targetPath, status: 'updated', message: 'ChatGPT MCP connection metadata updated' }];
      }
      return [{ type: 'create_file', path: targetPath, status: 'preserved', message: 'ChatGPT MCP connection exists' }];
    }
  }
  const token = issueAgentAppToken({
    config: input.config,
    callerId: 'chatgpt-mcp',
    appId: 'chatgpt',
    subjectId: 'chatgpt-user',
    deviceId: 'chatgpt-custom-connector',
    connectorId: 'connector_chatgpt_mcp',
    connectionId: 'connection_chatgpt_mcp',
    scopes,
    expiresInSeconds: 60 * 60 * 24 * 365,
  });
  if (!token.bearerToken) {
    throw new Error('ChatGPT MCP token was not issued');
  }
  writeJsonFile(targetPath, {
    version: 1,
    kind: 'consuelo-chatgpt-mcp-connection',
    auth: 'bearer',
    url: CHATGPT_MCP_URL,
    localUrl: `http://127.0.0.1:${input.port}/mcp`,
    tokenId: token.tokenId,
    bearerToken: token.bearerToken,
    scopes,
    createdAt: nowIso(),
  }, false);
  return [{
    type: 'create_file',
    path: targetPath,
    status: hasExistingConnection ? 'updated' : 'created',
    message: hasExistingConnection
      ? 'ChatGPT MCP connection credential replaced'
      : 'ChatGPT MCP connection written',
  }];
}

function materializeWorkspaceConnectorBootstrap(input: {
  nodeHome: string;
  runtimeHome: string;
  port: number;
  dryRun: boolean;
  platform: NodeJS.Platform | string;
  workspaceBootstrap: WorkspaceBootstrap;
}): ProvisionAction[] {
  const actions: ProvisionAction[] = [];

  if (input.workspaceBootstrap.connectorTransport === 'cloudflare-tunnel') {
    const plan = planWorkspaceConnectorTransport({
      home: input.nodeHome,
      connectorId: input.workspaceBootstrap.connectorId,
      workspaceHost: input.workspaceBootstrap.workspaceHost,
      localPort: input.port,
      transport: 'cloudflare-tunnel',
      cloudflareTunnelToken: input.workspaceBootstrap.cloudflareTunnelToken,
      cloudflaredBin:
        process.env.CLOUDFLARED_BIN ??
        path.join(input.runtimeHome, 'bin', 'cloudflared'),
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

    if (plan.launchd && input.platform === 'linux') {
      const unit = renderWorkspaceCloudflaredSystemdUnit({
        home: input.runtimeHome,
        connectorId: input.workspaceBootstrap.connectorId,
        programArguments: plan.launchd.programArguments,
      });
      actions.push({
        type: 'create_file',
        path: unit.unitPath,
        status: input.dryRun ? 'planned' : 'created',
        message: 'cloudflared systemd service configured',
      });
      if (!input.dryRun) {
        fs.mkdirSync(unit.systemdUserDir, { recursive: true, mode: 0o700 });
        fs.writeFileSync(unit.unitPath, unit.service, { mode: 0o600 });
      }
    } else if (plan.launchd) {
      const legacyPlistPath = path.join(
        input.nodeHome,
        'security',
        'generated',
        'com.consuelo.os.cloudflared.plist',
      );
      const plistPath = path.join(
        input.nodeHome,
        'security',
        'generated',
        `${plan.launchd.label}.plist`,
      );
      actions.push({
        type: 'create_file',
        path: plistPath,
        status: input.dryRun ? 'planned' : 'created',
        message: 'cloudflared launchd service configured',
      });
      if (!input.dryRun) {
        fs.mkdirSync(path.dirname(plistPath), { recursive: true });
        if (fs.existsSync(legacyPlistPath) && legacyPlistPath !== plistPath) {
          fs.rmSync(legacyPlistPath, { force: true });
        }
        fs.writeFileSync(plistPath, renderCloudflaredLaunchdPlist(plan.launchd), {
          mode: 0o600,
        });
      }
    }

    const smokePath = path.join(
      input.runtimeHome,
      'bin',
      'smoke-gateway-auth',
    );
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
          home: input.runtimeHome,
          workspaceHost: input.workspaceBootstrap.workspaceHost,
        }),
        { mode: 0o755 },
      );
      fs.chmodSync(smokePath, 0o755);
    }
  }

  if (
    input.workspaceBootstrap.nodeId &&
    input.workspaceBootstrap.nodePublicKeyJwk &&
    input.workspaceBootstrap.nodeSigningKeyJwk
  ) {
    const heartbeatConfigPath = path.join(
      input.nodeHome,
      'security',
      'generated',
      'workspace-node-heartbeat.json',
    );
    const safeNodeId = input.workspaceBootstrap.nodeId.replace(
      /[^a-zA-Z0-9.-]+/g,
      '-',
    );
    const heartbeatLabel = `com.consuelo.os.node-heartbeat.${safeNodeId}`;
    const heartbeatScriptPath = path.join(
      input.runtimeHome,
      'scripts',
      'workspace-node-heartbeat.ts',
    );
    const heartbeatLogPath = path.join(
      input.nodeHome,
      'logs',
      'workspace-node-heartbeat.log',
    );
    writeJsonFile(
      heartbeatConfigPath,
      {
        authorityOrigin:
          input.workspaceBootstrap.authorityOrigin ??
          'https://os.consuelohq.com',
        workspaceId: input.workspaceBootstrap.workspaceId,
        nodeId: input.workspaceBootstrap.nodeId,
        connectorStatus: 'connected',
        capabilities: [
          ...(input.workspaceBootstrap.nodeCapabilities ?? ['mcp', 'tools']),
        ].sort(),
        publicKeyJwk: input.workspaceBootstrap.nodePublicKeyJwk,
        signingKeyJwk: input.workspaceBootstrap.nodeSigningKeyJwk,
      },
      input.dryRun,
    );
    actions.push({
      type: 'create_file',
      path: heartbeatConfigPath,
      status: input.dryRun ? 'planned' : 'created',
      message: 'workspace node heartbeat config configured',
    });
    if (input.platform === 'linux') {
      const units = renderWorkspaceNodeHeartbeatSystemdUnits({
        home: input.runtimeHome,
        bunExecutable: process.execPath,
        heartbeatScriptPath,
        heartbeatConfigPath,
      });
      if (!input.dryRun) {
        fs.mkdirSync(units.systemdUserDir, { recursive: true, mode: 0o700 });
        fs.writeFileSync(units.servicePath, units.service, { mode: 0o600 });
        fs.writeFileSync(units.timerPath, units.timer, { mode: 0o600 });
      }
      actions.push(
        {
          type: 'create_file',
          path: units.servicePath,
          status: input.dryRun ? 'planned' : 'created',
          message: 'workspace node heartbeat systemd service configured',
        },
        {
          type: 'create_file',
          path: units.timerPath,
          status: input.dryRun ? 'planned' : 'created',
          message: 'workspace node heartbeat systemd timer configured',
        },
      );
    } else {
      const heartbeatPlistPath = path.join(
        input.nodeHome,
        'security',
        'generated',
        `${heartbeatLabel}.plist`,
      );
      if (!input.dryRun) {
        fs.mkdirSync(path.dirname(heartbeatPlistPath), { recursive: true });
        fs.writeFileSync(
          heartbeatPlistPath,
          renderCloudflaredLaunchdPlist({
            label: heartbeatLabel,
            programArguments: [
              process.execPath,
              heartbeatScriptPath,
              '--config',
              heartbeatConfigPath,
            ],
            keepAlive: false,
            runAtLoad: true,
            startIntervalSeconds: 30,
            standardOutPath: heartbeatLogPath,
            standardErrorPath: heartbeatLogPath,
          }),
          { mode: 0o600 },
        );
      }
      actions.push({
        type: 'create_file',
        path: heartbeatPlistPath,
        status: input.dryRun ? 'planned' : 'created',
        message: 'workspace node heartbeat launchd service configured',
      });
    }
  }

  return actions;
}

export function loadOsConfig(home?: string): OsConfig | null {
  const resolvedHome = resolveOsHome(home);
  return readJsonFile<OsConfig>(path.join(resolvedHome, 'config.json'));
}

export function detectAgents(home?: string): AgentDetection[] {
  return detectLocalAgents({ home: resolveOsHome(home), userHome: os.homedir() });
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

function normalizeSelectedSkillNames(selectedSkills: readonly string[]): string[] {
  const bundledSkillNames = new Set(
    listSkillDirs(BUNDLED_SKILLS_ROOT).map((skillDir) => getSkillName(skillDir)),
  );
  return [...new Set(selectedSkills.filter((skillName) => bundledSkillNames.has(skillName)))];
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
  const layout = resolveConsueloHomeLayout(home);
  const configPath = path.join(home, 'config.json');
  const dbPath = layout.nodeDbPath;
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
  actions.push(...seedBundledStreams(home, dryRun));

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

  const gatewayPort = options.port ??
    (config.port === LEGACY_DEFAULT_PORT ? DEFAULT_PORT : config.port ?? DEFAULT_PORT);
  const workspaceBootstrap = options.workspaceBootstrap;
  const existingIdentity = workspaceBootstrap
    ? undefined
    : readExistingProvisionIdentity({ home, layout, config });
  const workspaceIdentity = workspaceBootstrap
    ? {
        workspaceId: workspaceBootstrap.workspaceId,
        workspaceSlug: workspaceBootstrap.workspaceSlug,
        workspaceHost: workspaceBootstrap.workspaceHost,
      }
    : existingIdentity ?? {
        workspaceId: 'local-consuelo-os',
        workspaceSlug: 'local',
        workspaceHost: 'local.consuelohq.com',
      };
  const nodeId = workspaceBootstrap?.nodeId ??
    workspaceBootstrap?.connectorId ??
    existingIdentity?.node?.nodeId ??
    'local';
  const nodeName = workspaceBootstrap?.nodeName ??
    existingIdentity?.node?.nodeName ??
    (os.hostname() || 'local');
  const nodeRole = workspaceBootstrap?.nodeRole ??
    existingIdentity?.node?.nodeRole ??
    'home';

  for (const dir of [
    layout.workspaceSharedDir(workspaceIdentity.workspaceId),
    layout.nodeWorkspaceStateDir(workspaceIdentity.workspaceId),
  ]) {
    const exists = fs.existsSync(dir);
    actions.push({
      type: 'create_dir',
      path: dir,
      status: exists ? 'preserved' : dryRun ? 'planned' : 'created',
      message: exists ? 'directory exists' : 'directory created',
    });
    if (!dryRun) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  writeYamlConfigIfMissing({
    actions,
    path: layout.globalConfigPath,
    value: createDefaultGlobalYamlConfig({
      workspaceId: workspaceIdentity.workspaceId,
      nodeId,
    }),
    dryRun,
    message: 'global Consuelo config written',
  });
  writeYamlConfigIfMissing({
    actions,
    path: layout.nodeConfigPath,
    value: createDefaultNodeYamlConfig({
      nodeId,
      nodeName,
      nodeRole,
      workspaceId: workspaceIdentity.workspaceId,
    }),
    dryRun,
    message: 'local node config written',
  });
  writeYamlConfigIfMissing({
    actions,
    path: layout.workspaceConfigPath(workspaceIdentity.workspaceId),
    value: createDefaultWorkspaceYamlConfig({
      workspaceId: workspaceIdentity.workspaceId,
      workspaceName: workspaceIdentity.workspaceSlug,
      workspaceSlug: workspaceIdentity.workspaceSlug,
      workspaceHost: workspaceIdentity.workspaceHost,
    }),
    dryRun,
    message: 'sync-safe workspace config written',
  });

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

  const generatedSecurityDir = layout.nodeSecurityGeneratedDir;
  const securityOverridesDir = layout.nodeSecurityOverridesDir;
  const generatedAuthPath = path.join(layout.nodeSecurityGeneratedDir, 'auth.json');
  const generatedCaddyfilePath = layout.nodeCaddyfilePath;
  const generatedSecurityDirExists = fs.existsSync(generatedSecurityDir);
  const securityOverridesDirExists = fs.existsSync(securityOverridesDir);
  const generatedAuthPathExists = fs.existsSync(generatedAuthPath);
  const generatedCaddyfilePathExists = fs.existsSync(generatedCaddyfilePath);
  const securityStatus = (exists: boolean): ProvisionAction['status'] => exists ? 'preserved' : dryRun ? 'planned' : 'created';

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
      home: layout.nodeDir,
      workspaceId: workspaceIdentity.workspaceId,
      workspaceSlug: workspaceIdentity.workspaceSlug,
      workspaceHost: workspaceIdentity.workspaceHost,
      upstreamPort: gatewayPort,
    });
    actions.push(...materializeChatGptMcpConnection({
      home: layout.nodeDir,
      config: gatewayConfig,
      port: gatewayPort,
      dryRun,
    }));
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
  if (workspaceBootstrap) {
    actions.push(
      ...materializeWorkspaceConnectorBootstrap({
        nodeHome: layout.nodeDir,
        runtimeHome: home,
        port: gatewayPort,
        dryRun,
        platform: options.platform ?? process.platform,
        workspaceBootstrap,
      }),
    );
  }
  config.selectedSkills = normalizeSelectedSkillNames(
    options.selectedSkills ??
    config.selectedSkills ??
    getDefaultSelectedSkillNames(),
  );
  config.artifactStorage = options.artifactStorage ?? config.artifactStorage;
  actions.push(...provisionManagedComponentIndexes({
    home,
    selectedSkills: config.selectedSkills,
    dryRun,
    generatedAt: nowIso(),
    userRoot: path.join(os.homedir(), 'Consuelo'),
  }));

  const requestedAgentNames = options.connectAgents ?? [];
  const agentConfiguration = requestedAgentNames.length > 0
    ? configureLocalAgents({
        home,
        userHome: os.homedir(),
        agentNames: requestedAgentNames,
        dryRun,
        persist: false,
      })
    : (() => {
        const agents = detectAgents(home);
        return {
          agents,
          records: toLocalAgentConfigRecords(agents),
          actions: [],
        };
      })();
  actions.push(...agentConfiguration.actions);
  config.agents = agentConfiguration.records;

  if (!dryRun) {
    config.updatedAt = nowIso();
    writeJsonFile(configPath, config, false);
  }

  actions.push(...materializeSites({ home, dbPath, dryRun }).actions);

  return {
    home,
    configPath,
    dbPath,
    actions,
    agents: dryRun ? agentConfiguration.agents : detectAgents(home),
  };
}

export async function runDoctor(home?: string): Promise<DoctorResult> {
  const resolvedHome = resolveOsHome(home);
  const checks: DoctorCheck[] = [];
  const layout = resolveConsueloHomeLayout(resolvedHome);
  const requiredPaths = [
    resolvedHome,
    path.join(resolvedHome, 'config.json'),
    layout.globalConfigPath,
    layout.nodeConfigPath,
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
        'workflows/generated/workflow-bundles.json',
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
    const db = new Database(layout.nodeDbPath);
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

  for (const agent of detectAgents(resolvedHome)) {
    checks.push({
      name: agent.label,
      status: agent.status,
      message: agent.message ?? (
        agent.status === 'verified'
          ? 'agent MCP connection verified'
          : agent.detected
            ? 'agent detected, connection not verified'
            : 'agent not detected'
      ),
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
      check.status === 'not_detected' ||
      check.status === 'detected' ||
      check.status === 'configured' ||
      check.status === 'verified' ||
      check.status === 'unsupported' ||
      check.status === 'local_only' ||
      check.status === 'cloud_only',
  );
  return {
    home: resolvedHome,
    checks,
    ok: basicChecksHealthy && isCapabilitySetHealthy(capabilities),
  };
}



