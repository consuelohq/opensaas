import fs from 'node:fs';
import path from 'node:path';

import { getCapabilityHealth } from './capabilities';
import { detectAgents, loadOsConfig } from './install-state';
import {
  isManifestItemEnabled,
  manifestOverlayPath,
  readManifestOverlay,
} from './manifest-overlay';
import {
  readEffectiveCoreManifest,
  readEffectiveFullManifest,
  getPackageRoot,
} from './manifest';
import { listBundledSkills } from './skills';

export type SettingsConnectionStatus =
  | 'connected'
  | 'not_configured'
  | 'missing_capability'
  | 'unhealthy';

export type SettingsCloudConnector = {
  id: string;
  label: string;
  kind: 'cloud';
  status: SettingsConnectionStatus;
  mcpUrl: string | null;
  placeholder: boolean;
};

export type SettingsLocalAgent = {
  name: string;
  label: string;
  kind: 'local';
  status: SettingsConnectionStatus;
  detected: boolean;
  connected: boolean;
};

export type SettingsRunBook = {
  id: string;
  aliases: string[];
  roleCount: number;
  toolCount: number;
  enabled: boolean;
};

export type SettingsManifestItem = {
  name: string;
  kind: 'tool' | 'skill';
  category: string;
  enabled: boolean;
  core: boolean;
};

export type SettingsOverlaySummary = {
  path: string;
  disabledTools: string[];
  disabledSkills: string[];
  disabledWorkflows: string[];
  updatedAt: string | null;
};

export type SettingsManifestSummary = {
  totalTools: number;
  coreTools: number;
  skillEntries: number;
  bundledSkills: number;
  selectedSkills: string[];
};

export type SettingsWorkspaceSummary = {
  mode: string | null;
  workspaceId: string | null;
  workspaceSlug: string | null;
  workspaceHost: string | null;
  connectorId: string | null;
  connectorTransport: string | null;
  mcpUrl: string | null;
};

export type SettingsSnapshot = {
  version: 1;
  generatedAt: string;
  workspace: SettingsWorkspaceSummary;
  cloudConnectors: SettingsCloudConnector[];
  localAgents: SettingsLocalAgent[];
  manifest: SettingsManifestSummary;
  overlay: SettingsOverlaySummary;
  tools: SettingsManifestItem[];
  skills: SettingsManifestItem[];
  runBooks: SettingsRunBook[];
  capabilities: ReturnType<typeof getCapabilityHealth>;
};

type ChatGptMcpConfig = {
  url?: string;
};

type WorkflowBundlesFile = {
  workflows?: Array<{
    id?: string;
    aliases?: string[];
    roles?: string[];
    tools?: unknown[];
  }>;
};

const CLOUD_CONNECTOR_PLACEHOLDERS = [
  { id: 'grok', label: 'Grok' },
  { id: 'cursor-cloud', label: 'Cursor' },
  { id: 'gemini', label: 'Gemini' },
] as const;

function readJsonFile<TData>(filePath: string): TData | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TData;
  } catch {
    return null;
  }
}

function resolveMcpUrl(home: string, config: ReturnType<typeof loadOsConfig>): string | null {
  const mcpConfig = readJsonFile<ChatGptMcpConfig>(
    path.join(home, 'security', 'generated', 'chatgpt-mcp.json'),
  );
  if (typeof mcpConfig?.url === 'string' && mcpConfig.url.length > 0) {
    return mcpConfig.url;
  }

  const workspaceHost = config?.workspace?.host;
  if (typeof workspaceHost === 'string' && workspaceHost.length > 0) {
    return `https://${workspaceHost}/mcp`;
  }

  return null;
}

function buildCloudConnectors(home: string, mcpUrl: string | null): SettingsCloudConnector[] {
  const chatGptConfigured = fs.existsSync(
    path.join(home, 'security', 'generated', 'chatgpt-mcp.json'),
  );

  const connectors: SettingsCloudConnector[] = [
    {
      id: 'chatgpt',
      label: 'ChatGPT',
      kind: 'cloud',
      status: chatGptConfigured ? 'connected' : 'not_configured',
      mcpUrl,
      placeholder: false,
    },
  ];

  for (const placeholder of CLOUD_CONNECTOR_PLACEHOLDERS) {
    connectors.push({
      id: placeholder.id,
      label: placeholder.label,
      kind: 'cloud',
      status: 'not_configured',
      mcpUrl: null,
      placeholder: true,
    });
  }

  return connectors;
}

function readRunBooks(overlay: ReturnType<typeof readManifestOverlay>): SettingsRunBook[] {
  const bundlesPath = path.join(getPackageRoot(), 'manifests', 'workflow-bundles.json');
  const bundles = readJsonFile<WorkflowBundlesFile>(bundlesPath);
  return (bundles?.workflows ?? [])
    .filter((workflow): workflow is { id: string; aliases?: string[]; roles?: string[]; tools?: unknown[] } =>
      typeof workflow.id === 'string',
    )
    .map((workflow) => ({
      id: workflow.id,
      aliases: Array.isArray(workflow.aliases)
        ? workflow.aliases.filter((alias): alias is string => typeof alias === 'string')
        : [],
      roleCount: Array.isArray(workflow.roles) ? workflow.roles.length : 0,
      toolCount: Array.isArray(workflow.tools) ? workflow.tools.length : 0,
      enabled: isManifestItemEnabled(overlay, 'workflow', workflow.id),
    }));
}

function buildManifestItems(home: string, overlay: ReturnType<typeof readManifestOverlay>): {
  tools: SettingsManifestItem[];
  skills: SettingsManifestItem[];
} {
  const fullManifest = readEffectiveFullManifest(home);
  const coreNames = new Set(readEffectiveCoreManifest(home).tools.map((entry) => entry.name));

  const tools: SettingsManifestItem[] = [];
  const skills: SettingsManifestItem[] = [];

  for (const entry of fullManifest.tools) {
    const entryRecord = entry as typeof entry & { category?: string; core?: boolean };
    const definition = entry.definition as { category?: string };
    const category = entryRecord.category ?? definition.category ?? '';
    if (entry.kind === 'os-skill') {
      skills.push({
        name: entry.name,
        kind: 'skill',
        category,
        enabled: isManifestItemEnabled(overlay, 'skill', entry.name),
        core: entryRecord.core === true || coreNames.has(entry.name),
      });
      continue;
    }

    tools.push({
      name: entry.name,
      kind: 'tool',
      category,
      enabled: isManifestItemEnabled(overlay, 'tool', entry.name),
      core: entryRecord.core === true || coreNames.has(entry.name),
    });
  }

  return {
    tools: tools.sort((left, right) => left.name.localeCompare(right.name)),
    skills: skills.sort((left, right) => left.name.localeCompare(right.name)),
  };
}

export function buildSettingsSnapshot(home: string): SettingsSnapshot {
  const config = loadOsConfig(home);
  const mcpUrl = resolveMcpUrl(home, config);
  const overlay = readManifestOverlay(home);
  const fullManifest = readEffectiveFullManifest(home);
  const coreManifest = readEffectiveCoreManifest(home);
  const bundledSkills = listBundledSkills();
  const manifestItems = buildManifestItems(home, overlay);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    workspace: {
      mode: config?.mode ?? null,
      workspaceId: config?.workspace?.id ?? null,
      workspaceSlug: config?.workspace?.slug ?? null,
      workspaceHost: config?.workspace?.host ?? null,
      connectorId: config?.connector?.id ?? null,
      connectorTransport: config?.connector?.transport ?? null,
      mcpUrl,
    },
    cloudConnectors: buildCloudConnectors(home, mcpUrl),
    localAgents: detectAgents(home).map((agent) => ({
      name: agent.name,
      label: agent.label,
      kind: 'local' as const,
      status: agent.status,
      detected: agent.detected,
      connected: agent.connected,
    })),
    manifest: {
      totalTools: fullManifest.tools.filter((entry) => entry.kind === 'facade-tool').length,
      coreTools: coreManifest.tools.length,
      skillEntries: fullManifest.tools.filter((entry) => entry.kind === 'os-skill').length,
      bundledSkills: bundledSkills.length,
      selectedSkills: config?.selectedSkills ?? [],
    },
    overlay: {
      path: manifestOverlayPath(home),
      disabledTools: overlay.disabledTools,
      disabledSkills: overlay.disabledSkills,
      disabledWorkflows: overlay.disabledWorkflows,
      updatedAt: overlay.updatedAt,
    },
    tools: manifestItems.tools,
    skills: manifestItems.skills,
    runBooks: readRunBooks(overlay),
    capabilities: getCapabilityHealth(home),
  };
}