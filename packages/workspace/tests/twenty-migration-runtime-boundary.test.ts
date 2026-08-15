import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../..');
const repoPath = (path: string): string => resolve(repoRoot, path);
const readRepoFile = (path: string): string => readFileSync(repoPath(path), 'utf8');

const legacyPackageMarkers = [
  'packages/twenty-docker/twenty/Dockerfile',
  'packages/twenty-e2e-testing/package.json',
  'packages/twenty-front/package.json',
  'packages/twenty-sdk/package.json',
  'packages/twenty-server/package.json',
  'packages/twenty-shared/package.json',
  'packages/twenty-ui/package.json',
  'packages/twenty-utils/package.json',
];

const retiredTwentyWorkflows = [
  '.github/workflows/ci-breaking-changes.yaml',
  '.github/workflows/ci-create-app.yaml',
  '.github/workflows/ci-docker-build.yaml',
  '.github/workflows/ci-front.yaml',
  '.github/workflows/ci-sdk.yaml',
  '.github/workflows/ci-server.yaml',
  '.github/workflows/ci-shared.yaml',
  '.github/workflows/ci-test-docker-compose.yaml',
  '.github/workflows/ci-utils.yaml',
];

const protectedProductManifests = [
  'packages/cli/package.json',
  'packages/dialer/package.json',
  'packages/dialer-server/package.json',
  'packages/lead-connector/package.json',
  'packages/os/package.json',
];

const activeOperationalSurfaces = [
  'areas/dialer/AGENTS.md',
  'scripts/code-review.sh',
  'packages/os/SCRIPTS.md',
  'packages/os/operator/prompts/review.md',
  'packages/os/scripts/artifacts-design.ts',
  'packages/os/scripts/ci-plan.ts',
  'packages/workspace/scripts/ci/check-github-workflows.cjs',
];

type PackageManifest = {
  packageManager?: string;
  workspaces?: { packages?: string[] };
  resolutions?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const dependencyNames = (manifest: PackageManifest): string[] =>
  [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].flatMap((section) => Object.keys(section ?? {}));

describe('M4 Twenty physical deletion boundary', () => {
  it('removes the legacy Twenty application package surfaces', () => {
    for (const marker of legacyPackageMarkers) {
      expect(existsSync(repoPath(marker)), marker).toBe(false);
    }
  });

  it('removes legacy Twenty workspace and patch ownership while keeping Yarn 4 authoritative', () => {
    const rootPackage = JSON.parse(readRepoFile('package.json')) as PackageManifest;
    const workspacePackages = rootPackage.workspaces?.packages ?? [];
    const resolutionValues = Object.values(rootPackage.resolutions ?? {});

    expect(rootPackage.packageManager).toBe('yarn@4.9.2');
    expect(
      workspacePackages.filter(
        (workspace) =>
          workspace.startsWith('packages/twenty-') ||
          workspace === 'packages/create-twenty-app',
      ),
    ).toEqual([]);
    expect(
      resolutionValues.filter((value) => value.includes('packages/twenty-')),
    ).toEqual([]);
  });

  it('removes CI workflows whose only runtime is the deleted Twenty application', () => {
    for (const workflow of retiredTwentyWorkflows) {
      expect(existsSync(repoPath(workflow)), workflow).toBe(false);
    }
  });

  it('keeps active Consuelo product manifests free of deleted Twenty package dependencies', () => {
    for (const manifestPath of protectedProductManifests) {
      const manifest = JSON.parse(readRepoFile(manifestPath)) as PackageManifest;
      expect(
        dependencyNames(manifest).filter((name) => name.startsWith('twenty-')),
        manifestPath,
      ).toEqual([]);
    }
  });

  it('keeps active operational tooling free of deleted Twenty application paths', () => {
    for (const path of activeOperationalSurfaces) {
      const source = readRepoFile(path);
      expect(source, path).not.toContain('packages/twenty-');
      expect(source, path).not.toContain('packages/create-twenty-app');
    }
  });
});
