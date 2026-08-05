import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadWorkspaceYamlConfig } from '../scripts/lib/consuelo-home';
import {
  resolveWorkspaceProjectCwd,
  resolveWorkspaceProjectCwdFromConfig,
  workspaceYamlPath,
} from '../scripts/lib/workspace-project-cwd';

const workspaceId = 'workspace_internal';
const nodeId = 'node_laptop';

const baseYaml = (projects: string): string => `version: 1
workspace:
  id: ${workspaceId}
  name: internal
  slug: internal
defaults:
  project: opensaas
projects:
${projects}
routing: {}
policy: {}
sites: {}
`;

const withHome = (yaml: string): string => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-project-cwd-'));
  const file = workspaceYamlPath({ home, workspaceId });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, yaml);
  return home;
};

const configFrom = (yaml: string) => {
  const home = withHome(yaml);
  const config = loadWorkspaceYamlConfig(workspaceYamlPath({ home, workspaceId }));
  fs.rmSync(home, { recursive: true, force: true });
  return config;
};

const alwaysRepo = () => true;
const neverRepo = () => false;

describe('workspace project cwd', () => {
  describe('resolution', () => {
    it('prefers the entry for this node over the default', () => {
      const config = configFrom(
        baseYaml(`  - id: opensaas
    repo: consuelohq/opensaas
    localPaths:
      default: /srv/shared
      ${nodeId}: /Users/kokayi/Dev/opensaas
`),
      );

      expect(
        resolveWorkspaceProjectCwdFromConfig({ config, nodeId, exists: alwaysRepo }),
      ).toMatchObject({
        projectId: 'opensaas',
        repo: 'consuelohq/opensaas',
        cwd: '/Users/kokayi/Dev/opensaas',
        source: 'node',
      });
    });

    it('falls back to the default entry when this node has none', () => {
      const config = configFrom(
        baseYaml(`  - id: opensaas
    repo: consuelohq/opensaas
    localPaths:
      default: /srv/shared
`),
      );

      expect(
        resolveWorkspaceProjectCwdFromConfig({ config, nodeId, exists: alwaysRepo }),
      ).toMatchObject({ cwd: '/srv/shared', source: 'default' });
    });

    it('skips a node entry that is not a git repository and uses the default', () => {
      const config = configFrom(
        baseYaml(`  - id: opensaas
    repo: consuelohq/opensaas
    localPaths:
      default: /srv/shared
      ${nodeId}: /gone
`),
      );

      expect(
        resolveWorkspaceProjectCwdFromConfig({
          config,
          nodeId,
          exists: (candidate) => candidate === '/srv/shared',
        }),
      ).toMatchObject({ cwd: '/srv/shared', source: 'default' });
    });

    it('returns undefined when no candidate is a git repository', () => {
      const config = configFrom(
        baseYaml(`  - id: opensaas
    repo: consuelohq/opensaas
    localPaths:
      default: /srv/shared
`),
      );

      expect(
        resolveWorkspaceProjectCwdFromConfig({ config, nodeId, exists: neverRepo }),
      ).toBeUndefined();
    });

    it('returns undefined when the project declares no localPaths, the pre-existing state', () => {
      const config = configFrom(
        baseYaml(`  - id: opensaas
    repo: consuelohq/opensaas
`),
      );

      expect(
        resolveWorkspaceProjectCwdFromConfig({ config, nodeId, exists: alwaysRepo }),
      ).toBeUndefined();
    });

    it('resolves an explicitly requested project rather than the default', () => {
      const config = configFrom(
        baseYaml(`  - id: opensaas
    repo: consuelohq/opensaas
    localPaths:
      default: /srv/opensaas
  - id: website
    repo: consuelohq/website
    localPaths:
      default: /srv/website
`),
      );

      expect(
        resolveWorkspaceProjectCwdFromConfig({
          config,
          nodeId,
          projectId: 'website',
          exists: alwaysRepo,
        }),
      ).toMatchObject({ projectId: 'website', cwd: '/srv/website' });
    });

    it('returns undefined for an unknown project instead of throwing', () => {
      const config = configFrom(
        baseYaml(`  - id: opensaas
    repo: consuelohq/opensaas
    localPaths:
      default: /srv/opensaas
`),
      );

      expect(
        resolveWorkspaceProjectCwdFromConfig({
          config,
          projectId: 'missing',
          exists: alwaysRepo,
        }),
      ).toBeUndefined();
    });

    it('resolves a relative path to an absolute one', () => {
      const config = configFrom(
        baseYaml(`  - id: opensaas
    repo: consuelohq/opensaas
    localPaths:
      default: ./checkout
`),
      );

      const resolved = resolveWorkspaceProjectCwdFromConfig({
        config,
        exists: alwaysRepo,
      });
      expect(path.isAbsolute(resolved!.cwd)).toBe(true);
    });
  });

  describe('reading from disk', () => {
    it('resolves this repository end to end from a real workspace.yaml', () => {
      const repoRoot = path.resolve(__dirname, '..', '..', '..');
      const home = withHome(
        baseYaml(`  - id: opensaas
    repo: consuelohq/opensaas
    localPaths:
      ${nodeId}: ${repoRoot}
`),
      );

      expect(
        resolveWorkspaceProjectCwd({ home, workspaceId, nodeId })?.cwd,
      ).toBe(fs.realpathSync(repoRoot));
      fs.rmSync(home, { recursive: true, force: true });
    });

    it('returns undefined when workspace.yaml does not exist', () => {
      const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-empty-'));
      expect(
        resolveWorkspaceProjectCwd({ home, workspaceId, nodeId }),
      ).toBeUndefined();
      fs.rmSync(home, { recursive: true, force: true });
    });

    it('degrades to undefined on a malformed workspace.yaml rather than throwing', () => {
      const home = withHome('this: is: not: valid: yaml: [\n');
      expect(() =>
        resolveWorkspaceProjectCwd({ home, workspaceId, nodeId }),
      ).not.toThrow();
      expect(
        resolveWorkspaceProjectCwd({ home, workspaceId, nodeId }),
      ).toBeUndefined();
      fs.rmSync(home, { recursive: true, force: true });
    });
  });
});
