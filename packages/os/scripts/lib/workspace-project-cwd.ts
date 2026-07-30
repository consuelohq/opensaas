import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  loadWorkspaceYamlConfig,
  resolveProjectRepository,
  type ConsueloWorkspaceYamlConfig,
} from './consuelo-home';

/**
 * Resolves the on-disk checkout for a workspace's default project.
 *
 * `workspace.yaml` has always described the *remote* of each project (`consuelohq/opensaas`) and
 * carried a `localPaths` field for the checkout location, but nothing ever read `localPaths`. The
 * effect was that tools resolving a git root fell back to the server process's own cwd, which for a
 * launchd or systemd service is not a repository — so anything needing a repo failed with "could
 * not find a Git repository root" even though the project was configured correctly.
 *
 * `localPaths` is keyed by node id so the same workspace can describe different checkout locations
 * on different machines, with `default` as the fallback. A path is only returned if it exists and is
 * actually a git repository, so a stale entry degrades to the previous behaviour instead of pointing
 * tools at a directory that will fail in a more confusing way later.
 */

export type WorkspaceProjectCwd = {
  projectId: string;
  repo: string;
  cwd: string;
  source: 'node' | 'default';
};

export function workspaceYamlPath(input: {
  home: string;
  workspaceId: string;
}): string {
  return path.join(
    input.home,
    'workspaces',
    input.workspaceId,
    'shared',
    'workspace.yaml',
  );
}

const isGitRepository = (candidate: string): boolean => {
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: candidate,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return top.length > 0;
  } catch (_error: unknown) {
    return false;
  }
};

/**
 * Picks the checkout path for a project on a specific node. Returns undefined rather than throwing:
 * a workspace with no local checkout configured is a normal state, not an error.
 */
export function resolveWorkspaceProjectCwdFromConfig(input: {
  config: ConsueloWorkspaceYamlConfig;
  nodeId?: string;
  projectId?: string;
  exists?: (candidate: string) => boolean;
}): WorkspaceProjectCwd | undefined {
  let resolved: { projectId: string; repo: string };
  try {
    resolved = resolveProjectRepository(input.config, input.projectId);
  } catch (_error: unknown) {
    return undefined;
  }

  const project = input.config.projects.find(
    (entry) => entry.id === resolved.projectId,
  );
  const localPaths = project?.localPaths;
  if (!localPaths) return undefined;

  const nodeKey = input.nodeId?.trim();
  const candidates: Array<{ value: string; source: 'node' | 'default' }> = [];
  if (nodeKey && typeof localPaths[nodeKey] === 'string') {
    candidates.push({ value: localPaths[nodeKey], source: 'node' });
  }
  if (typeof localPaths.default === 'string') {
    candidates.push({ value: localPaths.default, source: 'default' });
  }

  const exists = input.exists ?? isGitRepository;
  for (const candidate of candidates) {
    const absolute = path.resolve(candidate.value);
    if (!exists(absolute)) continue;
    return {
      projectId: resolved.projectId,
      repo: resolved.repo,
      cwd: absolute,
      source: candidate.source,
    };
  }
  return undefined;
}

/** Reads workspace.yaml from disk and resolves the checkout. Undefined when unconfigured. */
export function resolveWorkspaceProjectCwd(input: {
  home: string;
  workspaceId: string;
  nodeId?: string;
  projectId?: string;
}): WorkspaceProjectCwd | undefined {
  const file = workspaceYamlPath(input);
  if (!fs.existsSync(file)) return undefined;
  let config: ConsueloWorkspaceYamlConfig;
  try {
    config = loadWorkspaceYamlConfig(file);
  } catch (_error: unknown) {
    // A malformed workspace.yaml is surfaced by the config surfaces that own it. Tool cwd
    // resolution degrades to the previous fallback rather than taking every tool down with it.
    return undefined;
  }
  return resolveWorkspaceProjectCwdFromConfig({
    config,
    nodeId: input.nodeId,
    projectId: input.projectId,
  });
}

/**
 * Resolves the checkout for whatever workspace and node the OS home currently has active.
 *
 * Callers under `code-call/` are required by architecture test to be Effect-only with no raw
 * try/catch, so all the failure handling for this lookup lives here and the function simply returns
 * undefined when anything is missing or unreadable.
 */
export function resolveActiveWorkspaceProjectCwd(
  home = process.env.CONSUELO_HOME,
): string | undefined {
  if (!home) return undefined;
  try {
    const globalConfigPath = path.join(home, 'consuelo.yaml');
    if (!fs.existsSync(globalConfigPath)) return undefined;
    const raw = fs.readFileSync(globalConfigPath, 'utf8');
    const workspaceId = /^activeWorkspace:\s*(\S+)\s*$/m.exec(raw)?.[1];
    if (!workspaceId) return undefined;
    const nodeId = /^activeNode:\s*(\S+)\s*$/m.exec(raw)?.[1];
    return resolveWorkspaceProjectCwd({ home, workspaceId, nodeId })?.cwd;
  } catch (_error: unknown) {
    return undefined;
  }
}
