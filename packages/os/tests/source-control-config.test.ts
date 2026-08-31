import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createDefaultWorkspaceYamlConfig,
  loadWorkspaceYamlConfig,
  resolveConsueloHomeLayout,
  writeYamlConfig,
  type ConsueloWorkspaceYamlConfig,
} from '../scripts/lib/consuelo-home';
import {
  buildWorkspaceSourceControlSnapshot,
  requireWorkspaceSourceControlCodePath,
  requireWorkspaceSourceControlRepository,
  sourceControlCacheNamespace,
  updateWorkspaceSourceControlConfiguration,
} from '../scripts/lib/source-control-config';

function workspaceConfig(
  projects: ConsueloWorkspaceYamlConfig['projects'],
  defaultProject?: string,
): ConsueloWorkspaceYamlConfig {
  return {
    version: 1,
    workspace: {
      id: 'ws_test',
      name: 'Test Workspace',
      slug: 'test-workspace',
      host: 'test-workspace.consuelohq.com',
    },
    defaults: {
      ...(defaultProject ? { project: defaultProject } : {}),
      node: 'local',
    },
    projects,
    routing: {},
    policy: { allowedAgents: [] },
    sites: {},
    agents: { defaults: [] },
  };
}

describe('workspace source-control configuration', () => {
  it('creates a new workspace without an implicit OpenSaaS repository', () => {
    const config = createDefaultWorkspaceYamlConfig({
      workspaceId: 'ws_new',
      workspaceName: 'New Workspace',
      workspaceSlug: 'new-workspace',
      workspaceHost: 'new-workspace.consuelohq.com',
    });

    const snapshot = buildWorkspaceSourceControlSnapshot(config);

    expect(config.projects).toEqual([]);
    expect(config.defaults.project).toBeUndefined();
    expect(snapshot).toEqual({
      configured: false,
      defaultRepositoryId: null,
      repositories: [],
    });
  });

  it('normalizes multiple GitHub repositories and exposes connection references, never credential values', () => {
    const config = workspaceConfig([
      {
        id: 'app',
        name: 'App',
        repo: 'acme/app',
        defaultBranch: 'main',
        provider: 'github',
        connectionRef: 'github-app:primary',
        codeRoots: ['src', 'packages/app'],
      },
      {
        id: 'docs',
        name: 'Docs',
        repo: 'acme/docs',
        defaultBranch: 'trunk',
        provider: 'github',
        connectionRef: 'github-app:docs',
      },
    ], 'app');

    const snapshot = buildWorkspaceSourceControlSnapshot(config);

    expect(snapshot.configured).toBe(true);
    expect(snapshot.defaultRepositoryId).toBe('app');
    expect(snapshot.repositories).toEqual([
      {
        id: 'app',
        name: 'App',
        provider: 'github',
        owner: 'acme',
        nameWithOwner: 'acme/app',
        repository: 'app',
        defaultBranch: 'main',
        connectionRef: 'github-app:primary',
        codeRoots: ['src', 'packages/app'],
        ready: true,
      },
      {
        id: 'docs',
        name: 'Docs',
        provider: 'github',
        owner: 'acme',
        nameWithOwner: 'acme/docs',
        repository: 'docs',
        defaultBranch: 'trunk',
        connectionRef: 'github-app:docs',
        codeRoots: [],
        ready: true,
      },
    ]);
    expect(JSON.stringify(snapshot)).not.toContain('token');
    expect(JSON.stringify(snapshot)).not.toContain('credentialValue');
  });

  it('requires the configured repository and its connection before product reads', () => {
    const config = workspaceConfig([
      {
        id: 'app',
        repo: 'acme/app',
        defaultBranch: 'main',
        provider: 'github',
      },
    ], 'app');

    expect(() => requireWorkspaceSourceControlRepository(config, { owner: 'acme', repo: 'app' }))
      .toThrow(/connection/i);
    expect(() => requireWorkspaceSourceControlRepository(config, { owner: 'other', repo: 'private' }))
      .toThrow(/not configured/i);
  });

  it('atomically updates repository configuration while preserving local project paths', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-source-control-config-'));
    const configPath = resolveConsueloHomeLayout(home).workspaceConfigPath('ws_test');
    writeYamlConfig(configPath, workspaceConfig([{
      id: 'app',
      name: 'Old app',
      repo: 'acme/app',
      defaultBranch: 'main',
      provider: 'github',
      connectionRef: 'github-app:old',
      localPaths: { local: '/workspace/app' },
      worktreeRoot: '/workspace/worktrees',
    }], 'app'), false);

    const snapshot = updateWorkspaceSourceControlConfiguration({
      home,
      workspaceId: 'ws_test',
      configuration: {
        defaultRepositoryId: 'docs',
        repositories: [
          {
            id: 'app',
            name: 'App',
            provider: 'github',
            nameWithOwner: 'acme/app',
            defaultBranch: 'main',
            connectionRef: 'github-app:primary',
            codeRoots: ['src'],
          },
          {
            id: 'docs',
            name: 'Docs',
            provider: 'github',
            nameWithOwner: 'acme/docs',
            defaultBranch: 'trunk',
            connectionRef: 'github-app:docs',
            codeRoots: [],
          },
        ],
      },
    });

    expect(snapshot.defaultRepositoryId).toBe('docs');
    expect(snapshot.repositories).toHaveLength(2);
    const persisted = loadWorkspaceYamlConfig(configPath);
    expect(persisted.projects[0]).toMatchObject({
      id: 'app',
      repo: 'acme/app',
      connectionRef: 'github-app:primary',
      localPaths: { local: '/workspace/app' },
      worktreeRoot: '/workspace/worktrees',
    });
    expect(persisted.defaults.project).toBe('docs');
  });

  it('rejects unsafe code roots and leaves the workspace file unchanged', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-source-control-config-'));
    const configPath = resolveConsueloHomeLayout(home).workspaceConfigPath('ws_test');
    const original = workspaceConfig([], undefined);
    writeYamlConfig(configPath, original, false);
    const before = fs.readFileSync(configPath, 'utf8');

    expect(() => updateWorkspaceSourceControlConfiguration({
      home,
      workspaceId: 'ws_test',
      configuration: {
        defaultRepositoryId: 'app',
        repositories: [{
          id: 'app',
          provider: 'github',
          nameWithOwner: 'acme/app',
          defaultBranch: 'main',
          connectionRef: 'github-app:primary',
          codeRoots: ['../secrets'],
        }],
      },
    })).toThrow(/code root/i);
    expect(fs.readFileSync(configPath, 'utf8')).toBe(before);
  });


  it('uses repository root by default and constrains browsing when code roots are configured', () => {
    const unrestricted = requireWorkspaceSourceControlRepository(workspaceConfig([{
      id: 'app',
      repo: 'acme/app',
      defaultBranch: 'main',
      provider: 'github',
      connectionRef: 'github-app:primary',
    }], 'app'));
    expect(requireWorkspaceSourceControlCodePath(unrestricted, '')).toBe('');
    expect(requireWorkspaceSourceControlCodePath(unrestricted, 'packages/private')).toBe('packages/private');
    expect(() => requireWorkspaceSourceControlCodePath(unrestricted, '../private')).toThrow(/path/i);

    const restricted = requireWorkspaceSourceControlRepository(workspaceConfig([{
      id: 'app',
      repo: 'acme/app',
      defaultBranch: 'main',
      provider: 'github',
      connectionRef: 'github-app:primary',
      codeRoots: ['src', 'packages/app'],
    }], 'app'));
    expect(requireWorkspaceSourceControlCodePath(restricted, '')).toBe('src');
    expect(requireWorkspaceSourceControlCodePath(restricted, 'src/components')).toBe('src/components');
    expect(requireWorkspaceSourceControlCodePath(restricted, 'packages/app/server')).toBe('packages/app/server');
    expect(() => requireWorkspaceSourceControlCodePath(restricted, 'packages/private')).toThrow(/configured code roots/i);
  });

  it('uses workspace, connection, and repository identity in cache namespaces', () => {
    expect(sourceControlCacheNamespace({
      workspaceId: 'ws_test',
      connectionRef: 'github-app:primary',
      provider: 'github',
      owner: 'Acme',
      repo: 'App',
    })).toBe('ws_test:github:github-app%3Aprimary:acme/app');
  });
});
