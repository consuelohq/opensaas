import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { classifyConsueloChanges, readChangedFiles } from '../scripts/ci-plan';

describe('Consuelo CI plan', () => {
  it('routes every Consuelo-owned package through verify without waking product lanes unnecessarily', () => {
    expect(classifyConsueloChanges(['packages/cli/src/auth.ts'])).toEqual({
      verify: true,
      workflowSecurity: false,
      osContracts: false,
      dialer: false,
      sitesGatewayCloudflare: false,
    });
  });

  it('routes package removals through Consuelo verification', () => {
    expect(classifyConsueloChanges(['packages/twenty-front/src/App.tsx'])).toEqual({
      verify: true,
      workflowSecurity: false,
      osContracts: false,
      dialer: false,
      sitesGatewayCloudflare: false,
    });
  });

  it('routes OS and Sites Gateway changes to their focused lanes', () => {
    expect(
      classifyConsueloChanges([
        'packages/os/cloudflare/workspace-edge/src/index.ts',
      ]),
    ).toEqual({
      verify: true,
      workflowSecurity: false,
      osContracts: true,
      dialer: false,
      sitesGatewayCloudflare: true,
    });
  });

  it('preserves the existing broad gateway classification', () => {
    expect(classifyConsueloChanges(['packages/os/tests/security-gateway.test.ts'])).toMatchObject({
      verify: true,
      osContracts: true,
      sitesGatewayCloudflare: true,
    });
  });

  it('routes dialer package changes to verify and the release package lane', () => {
    expect(classifyConsueloChanges(['packages/dialer-server/src/app.ts'])).toEqual({
      verify: true,
      workflowSecurity: false,
      osContracts: false,
      dialer: true,
      sitesGatewayCloudflare: false,
    });
  });

  it.each(['package.json', 'bun.lock', 'bunfig.toml', '.bun-version'])(
    'treats root package-manager control file %s as cross-cutting',
    (file) => {
      expect(classifyConsueloChanges([file])).toMatchObject({
        verify: true,
        dialer: true,
      });
    },
  );

  it('routes workflow changes through workflow security and keeps Consuelo release workflows in the dialer lane', () => {
    expect(
      classifyConsueloChanges(['.github/workflows/consuelo-production-release.yaml']),
    ).toEqual({
      verify: true,
      workflowSecurity: true,
      osContracts: false,
      dialer: true,
      sitesGatewayCloudflare: false,
    });
  });

  it('detects deletion-only PRs from a two-commit shallow checkout', () => {
    const root = mkdtempSync(join(tmpdir(), 'consuelo-ci-deletions-'));
    const source = join(root, 'source');
    const checkout = join(root, 'checkout');
    const deletedPaths = [
      'packages/dialer-server/src/removed.ts',
      'packages/dialer-server/src/café.ts',
      'packages/dialer-server/src/  leading space.ts',
      'packages/dialer-server/src/with\ttab.ts',
      'packages/dialer-server/src/with\nnewline.ts',
    ];

    function git(cwd: string, ...args: string[]): string {
      return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
    }

    try {
      mkdirSync(join(source, 'packages/dialer-server/src'), { recursive: true });
      git(source, 'init', '-b', 'main');
      git(source, 'config', 'user.email', 'ci@example.invalid');
      git(source, 'config', 'user.name', 'CI Fixture');
      git(source, 'config', 'commit.gpgsign', 'false');
      expect(git(source, 'config', '--local', '--get', 'commit.gpgsign')).toBe('false');
      for (const deletedPath of deletedPaths) {
        writeFileSync(join(source, deletedPath), 'export const removed = true;\n');
      }
      git(source, 'add', '.');
      git(source, 'commit', '-m', 'base');
      git(source, 'checkout', '-b', 'pr');
      for (const deletedPath of deletedPaths) {
        unlinkSync(join(source, deletedPath));
      }
      git(source, 'add', '-u');
      git(source, 'commit', '-m', 'delete dialer source');
      git(source, 'checkout', 'main');
      git(source, 'merge', '--no-ff', '--no-edit', 'pr');
      git(root, 'clone', '--depth', '2', '--branch', 'main', `file://${source}`, checkout);

      const base = git(checkout, 'rev-parse', 'HEAD^1');
      const changed = readChangedFiles(base, checkout);
      expect([...changed].sort()).toEqual([...deletedPaths].sort());
      expect(classifyConsueloChanges(changed)).toMatchObject({ verify: true, dialer: true });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
