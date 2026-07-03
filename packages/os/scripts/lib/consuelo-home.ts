import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { z } from 'zod';

const DEFAULT_CONSUELO_HOME = '~/.consuelo';
const DEFAULT_PROJECT_ID = 'opensaas';
const DEFAULT_PROJECT_REPO = 'consuelohq/opensaas';
const DEFAULT_BRANCH = 'main';

const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  repo: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  defaultBranch: z.string().min(1).default(DEFAULT_BRANCH),
  localPaths: z.record(z.string(), z.string()).optional(),
  worktreeRoot: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
}).strict();

const workspaceYamlConfigSchema = z.object({
  version: z.literal(1),
  workspace: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1).optional(),
    host: z.string().min(1).optional(),
  }).strict(),
  defaults: z.object({
    project: z.string().min(1).optional(),
    node: z.string().min(1).optional(),
  }).strict().default({}),
  projects: z.array(projectSchema).default([]),
  routing: z.record(z.string(), z.string()).default({}),
  policy: z.object({
    allowedAgents: z.array(z.string().min(1)).optional(),
  }).strict().default({}),
  sites: z.object({
    origin: z.string().min(1).optional(),
  }).strict().default({}),
  agents: z.object({
    defaults: z.array(z.string().min(1)).optional(),
  }).strict().default({}),
}).strict();

const globalYamlConfigSchema = z.object({
  version: z.literal(1),
  activeWorkspace: z.string().min(1).optional(),
  activeNode: z.string().min(1).optional(),
  runtime: z.object({
    current: z.string().min(1).optional(),
  }).strict().default({}),
}).strict();

const nodeYamlConfigSchema = z.object({
  version: z.literal(1),
  node: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    role: z.string().min(1).optional(),
  }).strict(),
  capabilities: z.array(z.string().min(1)).default([]),
  workspaces: z.array(z.object({
    id: z.string().min(1),
    state: z.string().min(1),
  }).strict()).default([]),
}).strict();

export type ConsueloProjectConfig = z.infer<typeof projectSchema>;
export type ConsueloWorkspaceYamlConfig = z.infer<typeof workspaceYamlConfigSchema>;
export type ConsueloGlobalYamlConfig = z.infer<typeof globalYamlConfigSchema>;
export type ConsueloNodeYamlConfig = z.infer<typeof nodeYamlConfigSchema>;

export type ResolvedProjectRepository = {
  projectId: string;
  repo: string;
  defaultBranch: string;
};

export type ConsueloHomeLayout = {
  home: string;
  legacyOsHome: string;
  globalConfigPath: string;
  runtimeDir: string;
  runtimeReleasesDir: string;
  runtimeCurrentDir: string;
  nodeDir: string;
  nodeConfigPath: string;
  nodeKeysDir: string;
  nodeSecurityDir: string;
  nodeSecurityGeneratedDir: string;
  nodeSecurityOverridesDir: string;
  nodeTunnelsDir: string;
  nodeCaddyDir: string;
  nodeCaddyfilePath: string;
  nodeDbDir: string;
  nodeDbPath: string;
  nodeLogsDir: string;
  nodeRunsDir: string;
  nodeCacheDir: string;
  nodeTmpDir: string;
  workspacesDir: string;
  workspaceDir: (workspaceId: string) => string;
  workspaceSharedDir: (workspaceId: string) => string;
  workspaceConfigPath: (workspaceId: string) => string;
  nodeWorkspaceStateDir: (workspaceId: string) => string;
};

export function expandHome(value: string): string {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

function isLegacyOsHome(value: string): boolean {
  return path.basename(value) === 'os' && path.basename(path.dirname(value)) === '.consuelo';
}

function normalizeConsueloHome(value: string): string {
  const resolved = path.resolve(expandHome(value));
  return isLegacyOsHome(resolved) ? path.dirname(resolved) : resolved;
}

export function resolveConsueloHome(home?: string): string {
  return normalizeConsueloHome(
    home ?? process.env.CONSUELO_HOME ?? process.env.CONSUELO_OS_HOME ?? DEFAULT_CONSUELO_HOME,
  );
}

export function resolveLegacyOsHome(home?: string): string {
  const rawHome = path.resolve(
    expandHome(home ?? process.env.CONSUELO_HOME ?? process.env.CONSUELO_OS_HOME ?? DEFAULT_CONSUELO_HOME),
  );
  return isLegacyOsHome(rawHome) ? rawHome : path.join(resolveConsueloHome(home), 'os');
}

export function resolveConsueloHomeLayout(home?: string): ConsueloHomeLayout {
  const resolvedHome = resolveConsueloHome(home);
  const nodeDir = path.join(resolvedHome, 'node');
  const workspacesDir = path.join(resolvedHome, 'workspaces');

  return {
    home: resolvedHome,
    legacyOsHome: resolveLegacyOsHome(home),
    globalConfigPath: path.join(resolvedHome, 'consuelo.yaml'),
    runtimeDir: path.join(resolvedHome, 'runtime'),
    runtimeReleasesDir: path.join(resolvedHome, 'runtime', 'releases'),
    runtimeCurrentDir: path.join(resolvedHome, 'runtime', 'current'),
    nodeDir,
    nodeConfigPath: path.join(nodeDir, 'node.yaml'),
    nodeKeysDir: path.join(nodeDir, 'keys'),
    nodeSecurityDir: path.join(nodeDir, 'security'),
    nodeSecurityGeneratedDir: path.join(nodeDir, 'security', 'generated'),
    nodeSecurityOverridesDir: path.join(nodeDir, 'security', 'overrides'),
    nodeTunnelsDir: path.join(nodeDir, 'tunnels'),
    nodeCaddyDir: path.join(nodeDir, 'caddy'),
    nodeCaddyfilePath: path.join(nodeDir, 'caddy', 'Caddyfile'),
    nodeDbDir: path.join(nodeDir, 'db'),
    nodeDbPath: path.join(nodeDir, 'db', 'consuelo.db'),
    nodeLogsDir: path.join(nodeDir, 'logs'),
    nodeRunsDir: path.join(nodeDir, 'runs'),
    nodeCacheDir: path.join(nodeDir, 'cache'),
    nodeTmpDir: path.join(nodeDir, 'tmp'),
    workspacesDir,
    workspaceDir: (workspaceId: string) => path.join(workspacesDir, workspaceId),
    workspaceSharedDir: (workspaceId: string) => path.join(workspacesDir, workspaceId, 'shared'),
    workspaceConfigPath: (workspaceId: string) => path.join(workspacesDir, workspaceId, 'shared', 'workspace.yaml'),
    nodeWorkspaceStateDir: (workspaceId: string) => path.join(nodeDir, 'workspaces', workspaceId, 'state'),
  };
}

function parseYamlFile(filePath: string): unknown {
  try {
    return parseYaml(fs.readFileSync(filePath, 'utf8'));
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'invalid YAML';
    throw new Error(`${path.basename(filePath)} could not be parsed: ${detail}`);
  }
}

function formatValidationError(filePath: string, error: z.ZodError): Error {
  const issues = error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`).join('; ');
  return new Error(`${path.basename(filePath)} failed validation: ${issues}`);
}

export function loadWorkspaceYamlConfig(filePath: string): ConsueloWorkspaceYamlConfig {
  const result = workspaceYamlConfigSchema.safeParse(parseYamlFile(filePath));
  if (!result.success) throw formatValidationError(filePath, result.error);
  return result.data;
}

export function loadGlobalYamlConfig(filePath: string): ConsueloGlobalYamlConfig {
  const result = globalYamlConfigSchema.safeParse(parseYamlFile(filePath));
  if (!result.success) throw formatValidationError(filePath, result.error);
  return result.data;
}

export function loadNodeYamlConfig(filePath: string): ConsueloNodeYamlConfig {
  const result = nodeYamlConfigSchema.safeParse(parseYamlFile(filePath));
  if (!result.success) throw formatValidationError(filePath, result.error);
  return result.data;
}

export function stringifyYamlConfig(value: unknown): string {
  const rendered = stringifyYaml(value);
  return rendered.endsWith('\n') ? rendered : `${rendered}\n`;
}

export function writeYamlConfig(filePath: string, value: unknown, dryRun: boolean): void {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, stringifyYamlConfig(value), { mode: 0o600 });
}

export function createDefaultGlobalYamlConfig(input: {
  workspaceId: string;
  nodeId: string;
}): ConsueloGlobalYamlConfig {
  return {
    version: 1,
    activeWorkspace: input.workspaceId,
    activeNode: input.nodeId,
    runtime: { current: 'runtime/current' },
  };
}

export function createDefaultNodeYamlConfig(input: {
  nodeId: string;
  nodeName: string;
  workspaceId: string;
}): ConsueloNodeYamlConfig {
  return {
    version: 1,
    node: {
      id: input.nodeId,
      name: input.nodeName,
      role: 'default',
    },
    capabilities: ['local-runtime', process.platform],
    workspaces: [{ id: input.workspaceId, state: `workspaces/${input.workspaceId}/state` }],
  };
}

export function createDefaultWorkspaceYamlConfig(input: {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  workspaceHost: string;
}): ConsueloWorkspaceYamlConfig {
  return {
    version: 1,
    workspace: {
      id: input.workspaceId,
      name: input.workspaceName,
      slug: input.workspaceSlug,
      host: input.workspaceHost,
    },
    defaults: {
      project: DEFAULT_PROJECT_ID,
      node: 'local',
    },
    projects: [{
      id: DEFAULT_PROJECT_ID,
      name: 'OpenSaaS',
      repo: DEFAULT_PROJECT_REPO,
      defaultBranch: DEFAULT_BRANCH,
    }],
    routing: {},
    policy: { allowedAgents: [] },
    sites: {},
    agents: { defaults: [] },
  };
}

export function resolveProjectRepository(
  config: ConsueloWorkspaceYamlConfig,
  projectId = config.defaults.project,
): ResolvedProjectRepository {
  const selectedProjectId = projectId ?? config.projects[0]?.id;
  if (!selectedProjectId) {
    throw new Error('workspace.yaml does not define a default project.');
  }

  const project = config.projects.find((entry) => entry.id === selectedProjectId);
  if (!project) {
    throw new Error(`workspace.yaml does not define project ${selectedProjectId}.`);
  }

  return {
    projectId: project.id,
    repo: project.repo,
    defaultBranch: project.defaultBranch,
  };
}
