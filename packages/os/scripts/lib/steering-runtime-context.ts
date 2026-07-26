import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  loadGlobalYamlConfig,
  loadNodeYamlConfig,
  loadWorkspaceYamlConfig,
  resolveConsueloHomeLayout,
  type ConsueloGlobalYamlConfig,
} from './consuelo-home';
import { readManagedComponentState } from './managed-components';
import {
  readWorkspaceNodeSummaryCache,
  type WorkspaceNodeListSummary,
} from './workspace-node-summary';

const EXCLUDED_STEERING_FILES = new Set(['decision.md', 'steering.md']);
const ACTIONABLE_UPDATE_ACTIONS = [
  'install',
  'update-clean',
  'merge-clean',
  'conflict',
  'remove-upstream',
] as const;

export type CompactInstalledSkill = {
  name: string;
  title: string;
  description: string | null;
  trigger: string | null;
  status: string;
  entrypoint: string;
};

export type CompactNodeSummary = {
  nodeId: string;
  displayName: string;
  role: string;
  platform: string;
  architecture: string;
  channel: string;
  presence: 'online' | 'stale' | 'offline';
  state: string;
  lastSeenAt: string | null;
};

export type CompactNodeListSummary = {
  workspaceId: string;
  workspaceHost: string;
  currentNodeId: string | null;
  defaultNodeId: string | null;
  nodeCount: number;
  presence: { online: number; stale: number; offline: number };
  nodes: CompactNodeSummary[];
};

export type CompactUpdateSummary = {
  availableCount: number;
  conflictCount: number;
  checkedAt: string;
  currentVersion: string | null;
  targetVersion: string;
};

export type SteeringMarkdownFile = {
  name: string;
  content: string;
  source: 'managed' | 'user';
};

export type SteeringRuntimeContext = {
  identity: {
    nodeId: string | null;
    displayName: string | null;
    platform: string | null;
    architecture: string | null;
    channel: string | null;
    installedVersion: string | null;
    workspaceId: string | null;
    workspaceSlug: string | null;
    workspaceHost: string | null;
    isDefaultNode: boolean | null;
  };
  nodes: CompactNodeListSummary | null;
  installedSkills: CompactInstalledSkill[];
  updateSummary: CompactUpdateSummary | null;
  reminder: string | null;
  diagnostics: string[];
  steeringFiles: SteeringMarkdownFile[];
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

function isRegularFileInside(root: string, filePath: string): boolean {
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    const realRoot = fs.realpathSync(root);
    const realFile = fs.realpathSync(filePath);
    const relative = path.relative(realRoot, realFile);
    return Boolean(relative)
      && relative !== '..'
      && !relative.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relative);
  } catch {
    return false;
  }
}

function compactSkill(value: unknown): CompactInstalledSkill | null {
  if (!isObject(value)) return null;
  const name = typeof value.name === 'string' && value.name.trim()
    ? value.name.trim()
    : typeof value.id === 'string' && value.id.trim()
      ? value.id.trim()
      : null;
  if (!name) return null;
  return {
    name,
    title: typeof value.title === 'string' && value.title.trim()
      ? value.title.trim()
      : name,
    description: typeof value.description === 'string' && value.description.trim()
      ? value.description.trim()
      : null,
    trigger: typeof value.trigger === 'string' && value.trigger.trim()
      ? value.trigger.trim()
      : null,
    status: typeof value.status === 'string' && value.status.trim()
      ? value.status.trim()
      : 'installed',
    entrypoint: typeof value.entrypoint === 'string' && value.entrypoint.trim()
      ? value.entrypoint.trim()
      : 'SKILL.md',
  };
}

function resolveInside(root: string, relativePath: string): string | null {
  if (!relativePath || path.isAbsolute(relativePath)) return null;
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, target);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return null;
  }
  return target;
}

function readInstalledSkills(home: string): CompactInstalledSkill[] {
  const index = readJson(path.join(home, 'components', 'installed-skills.json'));
  if (
    !isObject(index)
    || index.schemaVersion !== 1
    || index.kind !== 'consuelo-installed-skill-index'
    || !Array.isArray(index.selected)
    || !Array.isArray(index.legacyCustom)
  ) {
    throw new Error('invalid installed skill index');
  }

  const skills = index.selected
    .map(compactSkill)
    .filter((skill): skill is CompactInstalledSkill => skill !== null);

  for (const legacy of index.legacyCustom) {
    if (!isObject(legacy) || typeof legacy.legacyPath !== 'string') continue;
    const skillRoot = resolveInside(home, legacy.legacyPath);
    if (!skillRoot) continue;
    const metadataPath = path.join(skillRoot, 'skill.json');
    if (!isRegularFileInside(home, metadataPath)) continue;
    const skill = compactSkill(readJson(metadataPath));
    if (skill) skills.push(skill);
  }

  return skills
    .filter((skill, index, all) => all.findIndex((candidate) => candidate.name === skill.name) === index)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function compactNodes(summary: WorkspaceNodeListSummary): CompactNodeListSummary {
  return {
    workspaceId: summary.workspaceId,
    workspaceHost: summary.workspaceHost,
    currentNodeId: summary.currentNodeId,
    defaultNodeId: summary.defaultNodeId,
    nodeCount: summary.nodeCount,
    presence: summary.presence,
    nodes: summary.nodes.map((node) => ({
      nodeId: node.nodeId,
      displayName: node.displayName,
      role: node.role,
      platform: node.platform,
      architecture: node.architecture,
      channel: node.channel,
      presence: node.presence,
      state: node.state,
      lastSeenAt: node.lastSeenAt,
    })),
  };
}

function readUpdateSummary(home: string): CompactUpdateSummary {
  const state = readManagedComponentState(home);
  const byAction = state.plan.summary?.byAction;
  if (!byAction || typeof byAction !== 'object') {
    throw new Error('invalid update summary');
  }
  const count = (action: string): number => {
    const value = (byAction as Record<string, unknown>)[action];
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
  };
  const versions = [...new Set(
    state.provenance
      .map((component) => component.sourceVersion)
      .filter((version): version is string => Boolean(version)),
  )];
  return {
    availableCount: ACTIONABLE_UPDATE_ACTIONS.reduce((total, action) => total + count(action), 0),
    conflictCount: count('conflict'),
    checkedAt: state.plan.generatedAt,
    currentVersion: versions.length === 1 ? versions[0]! : null,
    targetVersion: state.plan.sourceBundle.version,
  };
}

function notificationEnabled(config: ConsueloGlobalYamlConfig | null, now: Date): boolean {
  if (!config) return false;
  const notification = config?.updates.notifications;
  if (!notification || notification.mode === 'on') return true;
  if (notification.mode === 'off') return false;
  const until = Date.parse(notification.snoozedUntil);
  return !Number.isFinite(until) || until <= now.getTime();
}

function readSteeringFiles(home: string, userHome: string): SteeringMarkdownFile[] {
  const files: SteeringMarkdownFile[] = [];
  const managedPath = path.join(home, 'steering', 'system_prompt.md');
  if (isRegularFileInside(home, managedPath)) {
    files.push({
      name: 'system_prompt.md',
      content: fs.readFileSync(managedPath, 'utf8'),
      source: 'managed',
    });
  }

  const userRoot = path.join(userHome, 'Consuelo', 'Steering');
  if (!fs.existsSync(userRoot)) return files;
  const names = fs.readdirSync(userRoot)
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .filter((name) => !EXCLUDED_STEERING_FILES.has(name.toLowerCase()))
    .sort((left, right) => left.localeCompare(right));
  for (const name of names) {
    const filePath = path.join(userRoot, name);
    if (!isRegularFileInside(userRoot, filePath)) continue;
    files.push({ name, content: fs.readFileSync(filePath, 'utf8'), source: 'user' });
  }
  return files;
}

export function readSteeringRuntimeContext(input: {
  home: string;
  userHome?: string;
  now?: Date;
}): SteeringRuntimeContext {
  const layout = resolveConsueloHomeLayout(input.home);
  const diagnostics: string[] = [];
  const now = input.now ?? new Date();
  let globalConfig: ConsueloGlobalYamlConfig | null = null;
  let nodeId: string | null = null;
  let displayName: string | null = null;
  let workspaceId: string | null = null;
  let workspaceSlug: string | null = null;
  let workspaceHost: string | null = null;
  let channel: string | null = null;

  try {
    const loadedGlobalConfig = loadGlobalYamlConfig(layout.globalConfigPath);
    const nodeConfig = loadNodeYamlConfig(layout.nodeConfigPath);
    const loadedWorkspaceId = loadedGlobalConfig.activeWorkspace ?? nodeConfig.workspaces[0]?.id ?? null;
    let loadedWorkspaceSlug: string | null = null;
    let loadedWorkspaceHost: string | null = null;
    if (loadedWorkspaceId) {
      const workspace = loadWorkspaceYamlConfig(layout.workspaceConfigPath(loadedWorkspaceId));
      loadedWorkspaceSlug = workspace.workspace.slug ?? null;
      loadedWorkspaceHost = workspace.workspace.host ?? null;
    }
    globalConfig = loadedGlobalConfig;
    workspaceId = loadedWorkspaceId;
    nodeId = loadedGlobalConfig.activeNode ?? nodeConfig.node.id;
    displayName = nodeConfig.node.name;
    channel = loadedGlobalConfig.updates.channel;
    workspaceSlug = loadedWorkspaceSlug;
    workspaceHost = loadedWorkspaceHost;
  } catch {
    globalConfig = null;
    nodeId = null;
    displayName = null;
    workspaceId = null;
    workspaceSlug = null;
    workspaceHost = null;
    channel = null;
    diagnostics.push('runtime_identity_unavailable');
  }

  let nodes: CompactNodeListSummary | null = null;
  let platform: string | null = null;
  let architecture: string | null = null;
  let isDefaultNode: boolean | null = null;
  if (workspaceId) {
    try {
      const cache = readWorkspaceNodeSummaryCache(input.home, workspaceId);
      if (!cache) throw new Error('missing node summary');
      nodes = compactNodes(cache.summary);
      const currentNode = nodeId
        ? cache.summary.nodes.find((node) => node.nodeId === nodeId)
        : cache.summary.currentNode;
      if (currentNode) {
        platform = currentNode.platform;
        architecture = currentNode.architecture;
        displayName = currentNode.displayName;
      }
      isDefaultNode = nodeId ? cache.summary.defaultNodeId === nodeId : null;
    } catch {
      diagnostics.push('node_summary_unavailable');
    }
  } else {
    diagnostics.push('node_summary_unavailable');
  }

  let installedSkills: CompactInstalledSkill[] = [];
  try {
    installedSkills = readInstalledSkills(input.home);
  } catch {
    diagnostics.push('installed_skills_unavailable');
  }

  let updateSummary: CompactUpdateSummary | null = null;
  try {
    updateSummary = readUpdateSummary(input.home);
  } catch {
    diagnostics.push('update_summary_unavailable');
  }

  let steeringFiles: SteeringMarkdownFile[] = [];
  try {
    steeringFiles = readSteeringFiles(input.home, input.userHome ?? os.homedir());
  } catch {
    diagnostics.push('steering_files_unavailable');
  }

  const reminder = updateSummary
    && updateSummary.availableCount > 0
    && notificationEnabled(globalConfig, now)
    ? `Consuelo OS: ${updateSummary.availableCount} ${updateSummary.availableCount === 1 ? 'update' : 'updates'} available.`
    : null;

  return {
    identity: {
      nodeId,
      displayName,
      platform,
      architecture,
      channel,
      installedVersion: updateSummary?.currentVersion ?? null,
      workspaceId,
      workspaceSlug,
      workspaceHost,
      isDefaultNode,
    },
    nodes,
    installedSkills,
    updateSummary,
    reminder,
    diagnostics: [...new Set(diagnostics)].sort(),
    steeringFiles,
  };
}
