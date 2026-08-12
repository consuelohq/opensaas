import {
  loadWorkspaceYamlConfig,
  resolveConsueloHomeLayout,
  validateWorkspaceYamlConfig,
  writeYamlConfig,
  type ConsueloProjectConfig,
  type ConsueloWorkspaceYamlConfig,
} from './consuelo-home';

export type WorkspaceSourceControlRepository = {
  id: string;
  name?: string;
  provider: string;
  owner: string;
  repository: string;
  nameWithOwner: string;
  defaultBranch: string;
  connectionRef: string | null;
  codeRoots: string[];
  ready: boolean;
};

export type WorkspaceSourceControlSnapshot = {
  configured: boolean;
  defaultRepositoryId: string | null;
  repositories: WorkspaceSourceControlRepository[];
};

export type RequiredWorkspaceSourceControlRepository = Omit<
  WorkspaceSourceControlRepository,
  'connectionRef' | 'ready'
> & {
  provider: 'github';
  connectionRef: string;
  ready: true;
};

type RepositoryLocator = {
  owner: string;
  repo: string;
};

function normalizedIdentity(value: string): string {
  return value.trim().toLowerCase();
}

function repositoryFromProject(project: ConsueloProjectConfig): WorkspaceSourceControlRepository {
  const [owner, repository] = project.repo.split('/');
  if (!owner || !repository) {
    throw new Error(`source-control repository is invalid for project ${project.id}`);
  }

  const provider = project.provider.trim().toLowerCase();
  const connectionRef = project.connectionRef?.trim() || null;

  return {
    id: project.id,
    ...(project.name ? { name: project.name } : {}),
    provider,
    owner,
    repository,
    nameWithOwner: `${owner}/${repository}`,
    defaultBranch: project.defaultBranch,
    connectionRef,
    codeRoots: [...(project.codeRoots ?? [])],
    ready: provider === 'github' && connectionRef !== null,
  };
}

function validateRepositorySet(repositories: WorkspaceSourceControlRepository[]): void {
  const projectIds = new Set<string>();
  const repositoryIdentities = new Set<string>();

  for (const repository of repositories) {
    if (projectIds.has(repository.id)) {
      throw new Error(`duplicate source-control project id: ${repository.id}`);
    }
    projectIds.add(repository.id);

    const identity = `${normalizedIdentity(repository.provider)}:${normalizedIdentity(repository.nameWithOwner)}`;
    if (repositoryIdentities.has(identity)) {
      throw new Error(`duplicate source-control repository: ${repository.nameWithOwner}`);
    }
    repositoryIdentities.add(identity);
  }
}

export function buildWorkspaceSourceControlSnapshot(
  config: ConsueloWorkspaceYamlConfig,
): WorkspaceSourceControlSnapshot {
  const repositories = config.projects.map(repositoryFromProject);
  validateRepositorySet(repositories);

  const defaultRepositoryId = config.defaults.project ?? repositories[0]?.id ?? null;
  if (
    defaultRepositoryId !== null
    && !repositories.some((repository) => repository.id === defaultRepositoryId)
  ) {
    throw new Error(`default source-control project is not configured: ${defaultRepositoryId}`);
  }

  const defaultRepository = defaultRepositoryId === null
    ? null
    : repositories.find((repository) => repository.id === defaultRepositoryId) ?? null;

  return {
    configured: defaultRepository?.ready === true,
    defaultRepositoryId,
    repositories,
  };
}

export function requireWorkspaceSourceControlRepository(
  config: ConsueloWorkspaceYamlConfig,
  locator?: RepositoryLocator,
): RequiredWorkspaceSourceControlRepository {
  const snapshot = buildWorkspaceSourceControlSnapshot(config);
  const repository = locator
    ? snapshot.repositories.find((candidate) => (
      normalizedIdentity(candidate.owner) === normalizedIdentity(locator.owner)
      && normalizedIdentity(candidate.repository) === normalizedIdentity(locator.repo)
    ))
    : snapshot.repositories.find((candidate) => candidate.id === snapshot.defaultRepositoryId);

  const displayName = locator ? `${locator.owner}/${locator.repo}` : snapshot.defaultRepositoryId ?? 'default';
  if (!repository) {
    throw new Error(`source-control repository is not configured for this workspace: ${displayName}`);
  }
  if (repository.provider !== 'github') {
    throw new Error(`source-control provider is not supported yet: ${repository.provider}`);
  }
  if (!repository.connectionRef) {
    throw new Error(`source-control connection is not configured for repository ${repository.nameWithOwner}`);
  }

  return {
    ...repository,
    provider: 'github',
    connectionRef: repository.connectionRef,
    ready: true,
  };
}

function normalizeRepositoryRelativePath(value: string): string {
  const normalized = value.trim().replace(/^\/+|\/+$/g, '');
  if (!normalized) return '';
  if (value.trim().startsWith('/') || normalized.includes('\\')) {
    throw new Error('source-control code path must be repository-relative');
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('source-control code path cannot contain dot or empty segments');
  }
  return normalized;
}

export function requireWorkspaceSourceControlCodePath(
  repository: WorkspaceSourceControlRepository,
  requestedPath: string,
): string {
  const normalized = normalizeRepositoryRelativePath(requestedPath);
  const roots = repository.codeRoots.map(normalizeRepositoryRelativePath).filter(Boolean);
  if (roots.length === 0) return normalized;
  if (!normalized) return roots[0]!;
  if (roots.some((root) => normalized === root || normalized.startsWith(`${root}/`))) {
    return normalized;
  }
  throw new Error(
    `source-control code path is outside configured code roots for ${repository.nameWithOwner}`,
  );
}

export function sourceControlCacheNamespace(input: {
  workspaceId: string;
  connectionRef: string;
  provider: string;
  owner: string;
  repo: string;
}): string {
  const workspaceId = input.workspaceId.trim();
  const provider = normalizedIdentity(input.provider);
  const connectionRef = encodeURIComponent(input.connectionRef.trim());
  const owner = normalizedIdentity(input.owner);
  const repo = normalizedIdentity(input.repo);
  if (!workspaceId || !provider || !input.connectionRef.trim() || !owner || !repo) {
    throw new Error('source-control cache namespace requires workspace, provider, connection, owner, and repository');
  }
  return `${workspaceId}:${provider}:${connectionRef}:${owner}/${repo}`;
}


export type WorkspaceSourceControlConfigurationInput = {
  defaultRepositoryId: string | null;
  repositories: Array<{
    id: string;
    name?: string;
    provider: string;
    nameWithOwner: string;
    defaultBranch?: string;
    connectionRef?: string | null;
    codeRoots?: string[];
  }>;
};


export function parseWorkspaceSourceControlConfiguration(
  value: unknown,
): WorkspaceSourceControlConfigurationInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Source-control configuration must be a JSON object.');
  }
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.repositories)) {
    throw new Error('Source-control configuration repositories must be an array.');
  }
  if (
    input.defaultRepositoryId !== null
    && input.defaultRepositoryId !== undefined
    && typeof input.defaultRepositoryId !== 'string'
  ) {
    throw new Error('Source-control defaultRepositoryId must be a string or null.');
  }
  for (const repository of input.repositories) {
    if (!repository || typeof repository !== 'object' || Array.isArray(repository)) {
      throw new Error('Each source-control repository must be a JSON object.');
    }
  }
  return value as WorkspaceSourceControlConfigurationInput;
}

export function readWorkspaceSourceControlConfiguration(input: {
  home: string;
  workspaceId: string;
}): WorkspaceSourceControlSnapshot {
  const workspaceId = trimmedRequired(input.workspaceId, 'workspace id');
  const configPath = resolveConsueloHomeLayout(input.home).workspaceConfigPath(workspaceId);
  const config = loadWorkspaceYamlConfig(configPath);
  if (config.workspace.id !== workspaceId) {
    throw new Error(`workspace configuration identity mismatch: expected ${workspaceId}`);
  }
  return buildWorkspaceSourceControlSnapshot(config);
}

function trimmedRequired(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function normalizeConfigurationProject(
  input: WorkspaceSourceControlConfigurationInput['repositories'][number],
  existing: ConsueloProjectConfig | undefined,
): ConsueloProjectConfig {
  const id = trimmedRequired(input.id, 'source-control project id');
  const repo = trimmedRequired(input.nameWithOwner, `source-control repository for ${id}`);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error(`source-control repository for ${id} must use owner/repository format`);
  }
  const provider = trimmedRequired(input.provider, `source-control provider for ${id}`).toLowerCase();
  const defaultBranch = input.defaultBranch?.trim() || 'main';
  const connectionRef = input.connectionRef?.trim() || undefined;
  const codeRoots = (input.codeRoots ?? []).map((root) => trimmedRequired(root, `code root for ${id}`));
  return {
    id,
    ...(input.name?.trim() ? { name: input.name.trim() } : {}),
    repo,
    defaultBranch,
    provider,
    ...(connectionRef ? { connectionRef } : {}),
    ...(codeRoots.length > 0 ? { codeRoots } : {}),
    ...(existing?.localPaths ? { localPaths: existing.localPaths } : {}),
    ...(existing?.worktreeRoot ? { worktreeRoot: existing.worktreeRoot } : {}),
  };
}

export function updateWorkspaceSourceControlConfiguration(input: {
  home: string;
  workspaceId: string;
  configuration: WorkspaceSourceControlConfigurationInput;
}): WorkspaceSourceControlSnapshot {
  const workspaceId = trimmedRequired(input.workspaceId, 'workspace id');
  const layout = resolveConsueloHomeLayout(input.home);
  const configPath = layout.workspaceConfigPath(workspaceId);
  const current = loadWorkspaceYamlConfig(configPath);
  if (current.workspace.id !== workspaceId) {
    throw new Error(`workspace configuration identity mismatch: expected ${workspaceId}`);
  }

  const existingById = new Map(current.projects.map((project) => [project.id, project]));
  const projects = input.configuration.repositories.map((repository) =>
    normalizeConfigurationProject(repository, existingById.get(repository.id)),
  );
  const defaultRepositoryId = input.configuration.defaultRepositoryId?.trim() || undefined;
  if (projects.length > 0 && !defaultRepositoryId) {
    throw new Error('default source-control repository is required when repositories are configured');
  }
  if (defaultRepositoryId && !projects.some((project) => project.id === defaultRepositoryId)) {
    throw new Error(`default source-control project is not configured: ${defaultRepositoryId}`);
  }

  const { project: _currentDefaultProject, ...defaultsWithoutProject } = current.defaults;
  const next = validateWorkspaceYamlConfig({
    ...current,
    defaults: {
      ...defaultsWithoutProject,
      ...(defaultRepositoryId ? { project: defaultRepositoryId } : {}),
    },
    projects,
  }, configPath);

  const snapshot = buildWorkspaceSourceControlSnapshot(next);
  writeYamlConfig(configPath, next, false);
  return snapshot;
}
