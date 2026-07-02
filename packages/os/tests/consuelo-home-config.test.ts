import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createDefaultGlobalYamlConfig,
  createDefaultNodeYamlConfig,
  createDefaultWorkspaceYamlConfig,
  loadWorkspaceYamlConfig,
  resolveConsueloHomeLayout,
  resolveProjectRepository,
} from '../scripts/lib/consuelo-home';

let tempHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-home-config-'));
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
});

describe('Consuelo home config boundaries', () => {
  it('resolves the flattened home layout without nesting product state under os', () => {
    const layout = resolveConsueloHomeLayout(tempHome);

    expect(layout.home).toBe(tempHome);
    expect(layout.legacyOsHome).toBe(join(tempHome, 'os'));
    expect(layout.globalConfigPath).toBe(join(tempHome, 'consuelo.yaml'));
    expect(layout.runtimeDir).toBe(join(tempHome, 'runtime'));
    expect(layout.runtimeCurrentDir).toBe(join(tempHome, 'runtime', 'current'));
    expect(layout.nodeDir).toBe(join(tempHome, 'node'));
    expect(layout.nodeConfigPath).toBe(join(tempHome, 'node', 'node.yaml'));
    expect(layout.nodeSecurityGeneratedDir).toBe(join(tempHome, 'node', 'security', 'generated'));
    expect(layout.nodeCaddyfilePath).toBe(join(tempHome, 'node', 'caddy', 'Caddyfile'));
    expect(layout.nodeDbPath).toBe(join(tempHome, 'node', 'db', 'consuelo.db'));
    expect(layout.workspaceSharedDir('ws_test')).toBe(join(tempHome, 'workspaces', 'ws_test', 'shared'));
    expect(layout.workspaceConfigPath('ws_test')).toBe(join(tempHome, 'workspaces', 'ws_test', 'shared', 'workspace.yaml'));
    expect(layout.nodeWorkspaceStateDir('ws_test')).toBe(join(tempHome, 'node', 'workspaces', 'ws_test', 'state'));
  });

  it('keeps default YAML split between sync-safe workspace config and local node state', () => {
    const globalConfig = createDefaultGlobalYamlConfig({ workspaceId: 'ws_test', nodeId: 'node_mac_mini' });
    const nodeConfig = createDefaultNodeYamlConfig({
      nodeId: 'node_mac_mini',
      nodeName: 'Mac Mini',
      workspaceId: 'ws_test',
    });
    const workspaceConfig = createDefaultWorkspaceYamlConfig({
      workspaceId: 'ws_test',
      workspaceName: 'Test Workspace',
      workspaceSlug: 'test-workspace',
      workspaceHost: 'test-workspace.consuelohq.com',
    });

    expect(globalConfig).toEqual({
      version: 1,
      activeWorkspace: 'ws_test',
      activeNode: 'node_mac_mini',
      runtime: { current: 'runtime/current' },
    });
    expect(nodeConfig.workspaces).toEqual([{ id: 'ws_test', state: 'workspaces/ws_test/state' }]);
    expect(workspaceConfig.workspace).toEqual({
      id: 'ws_test',
      name: 'Test Workspace',
      slug: 'test-workspace',
      host: 'test-workspace.consuelohq.com',
    });
    expect(Object.keys(workspaceConfig)).toEqual(
      expect.not.arrayContaining(['security', 'tunnels', 'caddy', 'db']),
    );
  });

  it('loads sync-safe workspace YAML and resolves project repositories from it', () => {
    const layout = resolveConsueloHomeLayout(tempHome);
    const workspaceConfigPath = layout.workspaceConfigPath('ws_test');
    mkdirSync(layout.workspaceSharedDir('ws_test'), { recursive: true });
    writeFileSync(
      workspaceConfigPath,
      [
        'version: 1',
        'workspace:',
        '  id: ws_test',
        '  name: Test Workspace',
        'defaults:',
        '  project: docs',
        '  node: mac-mini',
        'projects:',
        '  - id: docs',
        '    repo: consuelohq/docs',
        '    defaultBranch: main',
        '  - id: app',
        '    repo: consuelohq/app',
        '    defaultBranch: trunk',
        'routing:',
        '  builds: ubuntu-box',
        'policy:',
        '  allowedAgents:',
        '    - chatgpt',
        'agents:',
        '  defaults:',
        '    - chatgpt',
        'sites:',
        '  origin: https://sites.consuelohq.com',
        '',
      ].join('\n'),
    );

    const config = loadWorkspaceYamlConfig(workspaceConfigPath);

    expect(config.workspace.id).toBe('ws_test');
    expect(config.projects).toHaveLength(2);
    expect(resolveProjectRepository(config)).toEqual({
      projectId: 'docs',
      repo: 'consuelohq/docs',
      defaultBranch: 'main',
    });
    expect(resolveProjectRepository(config, 'app')).toEqual({
      projectId: 'app',
      repo: 'consuelohq/app',
      defaultBranch: 'trunk',
    });
  });

  it('rejects secret-shaped fields in sync-safe workspace YAML', () => {
    const layout = resolveConsueloHomeLayout(tempHome);
    const workspaceConfigPath = layout.workspaceConfigPath('ws_test');
    mkdirSync(layout.workspaceSharedDir('ws_test'), { recursive: true });
    writeFileSync(
      workspaceConfigPath,
      [
        'version: 1',
        'workspace:',
        '  id: ws_test',
        '  name: Test Workspace',
        'defaults:',
        '  project: app',
        'projects:',
        '  - id: app',
        '    repo: consuelohq/app',
        'secrets:',
        '  token: do-not-sync',
        '',
      ].join('\n'),
    );

    expect(() => loadWorkspaceYamlConfig(workspaceConfigPath)).toThrow(/workspace.yaml/i);
    expect(readFileSync(workspaceConfigPath, 'utf8')).toContain('do-not-sync');
  });
});
