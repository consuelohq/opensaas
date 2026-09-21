import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../..');
const repoPath = (path: string): string => resolve(repoRoot, path);
const read = (path: string): string => readFileSync(repoPath(path), 'utf8');

type RootManifest = {
  dependencies?: Record<string, string>;
  packageManager?: string;
  engines?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
};

describe('M6 Bun root package-manager cutover', () => {
  it('declares Bun as the root package manager', () => {
    const manifest = JSON.parse(read('package.json')) as RootManifest;

    expect(manifest.packageManager).toBe('bun@1.3.14');
    expect(manifest.engines?.bun).toBe('>=1.3.14');
    expect(manifest.engines?.yarn).toBeUndefined();
    expect(manifest.engines?.npm).toBeUndefined();
    expect(Array.isArray(manifest.workspaces)).toBe(true);
  });

  it('commits only the Bun root lockfile and removes Yarn-owned install state', () => {
    expect(existsSync(repoPath('bun.lock'))).toBe(true);
    expect(existsSync(repoPath('yarn.lock'))).toBe(false);
    expect(existsSync(repoPath('.yarnrc.yml'))).toBe(false);
    expect(existsSync(repoPath('.yarn'))).toBe(false);
  });

  it('uses a Bun install action for Consuelo CI and release workflows', () => {
    expect(existsSync(repoPath('.github/actions/yarn-install'))).toBe(false);
    expect(existsSync(repoPath('.github/actions/bun-install/action.yaml'))).toBe(
      true,
    );

    for (const path of [
      '.github/actions/consuelo-ci-setup/action.yaml',
      '.github/workflows/consuelo-dialer-rollback.yaml',
      '.github/workflows/consuelo-production-release.yaml',
    ]) {
      const source = read(path);
      expect(source, path).not.toContain('yarn-install');
      expect(source, path).not.toContain('yarn.lock');
      expect(source, path).not.toContain('.yarnrc.yml');
      expect(source, path).not.toContain('.yarn/');
    }

    expect(read('.github/actions/consuelo-ci-setup/action.yaml')).toContain(
      './.github/actions/bun-install',
    );
  });

  it('installs the independent workspace toolchain before running repository verify', () => {
    const setup = read('.github/actions/consuelo-ci-setup/action.yaml');
    const workflow = read('.github/workflows/consuelo-ci.yaml');

    expect(setup).toContain('install-workspace:');
    expect(setup).toContain('working-directory: packages/workspace');
    expect(setup).toContain('bun install --frozen-lockfile');
    expect(workflow).toContain("install-workspace: 'true'");
  });

  it('declares direct runtime instrumentation dependencies in the dialer package', () => {
    const dialer = JSON.parse(
      read('packages/dialer/package.json'),
    ) as RootManifest;

    expect(dialer.dependencies?.['@sentry/node']).toBe('^10.38.0');
  });

  it('uses Bun for active root bootstrap and standalone dialer builds', () => {
    for (const path of [
      'README.md',
      '.github/CONTRIBUTING.md',
      '.cursor/worktrees.json',
      'packages/dialer-server/Dockerfile',
      'packages/dialer-server/railway.json',
    ]) {
      expect(read(path), path).not.toMatch(/\byarn\b|yarn\.lock|\.yarnrc|\.yarn\//);
    }

    const dockerfile = read('packages/dialer-server/Dockerfile');
    expect(dockerfile).toContain('FROM oven/bun:1.3.14');
    expect(dockerfile).toContain('bun install --frozen-lockfile');

    const railway = read('packages/dialer-server/railway.json');
    expect(railway).toContain('bun.lock');
  });

  it('keeps the vendored Open Design package-manager boundary on pnpm', () => {
    const upstream = JSON.parse(
      read('packages/consuelo-design/upstream/open-design/package.json'),
    ) as { packageManager?: string };

    expect(upstream.packageManager).toMatch(/^pnpm@/);
    expect(
      read('packages/consuelo-design/upstream/open-design/pnpm-lock.yaml'),
    ).toContain('lockfileVersion');
  });
});
