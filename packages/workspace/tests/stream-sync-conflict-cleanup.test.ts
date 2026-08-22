import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const helperModules = [
  '../scripts/lib/stream-sync-cleanup',
  '../../os/scripts/lib/stream-sync-cleanup',
] as const;

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function initRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'stream-sync-cleanup-'));
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);
  writeFileSync(join(root, 'state.txt'), 'base\n');
  git(root, ['add', 'state.txt']);
  git(root, ['commit', '-m', 'base']);
  return root;
}

describe.each(helperModules)('%s stream sync failed-merge cleanup', (helperModule) => {
  const { restoreWorktreeAfterFailedMerge } = require(helperModule) as {
    restoreWorktreeAfterFailedMerge: (
      repoRoot: string,
      worktreePath: string,
      streamBranch: string,
      createdTemporaryWorktree: boolean,
    ) => void;
  };
  it('restores an existing stream worktree to its remote head after a substantive merge conflict', () => {
    const root = initRepo();
    try {
      git(root, ['checkout', '-b', 'stream/test']);
      writeFileSync(join(root, 'state.txt'), 'stream\n');
      git(root, ['commit', '-am', 'stream']);
      const streamSha = git(root, ['rev-parse', 'HEAD']);
      git(root, ['update-ref', 'refs/remotes/origin/stream/test', streamSha]);

      git(root, ['checkout', 'main']);
      writeFileSync(join(root, 'state.txt'), 'main\n');
      git(root, ['commit', '-am', 'main']);
      git(root, ['checkout', 'stream/test']);

      const merge = spawnSync('git', ['merge', '--no-ff', '--no-edit', 'main'], { cwd: root, encoding: 'utf8' });
      expect(merge.status).not.toBe(0);
      expect(git(root, ['diff', '--name-only', '--diff-filter=U'])).toBe('state.txt');

      restoreWorktreeAfterFailedMerge(root, root, 'stream/test', false);

      expect(git(root, ['status', '--porcelain'])).toBe('');
      expect(git(root, ['rev-parse', 'HEAD'])).toBe(streamSha);
      expect(existsSync(join(root, '.git', 'MERGE_HEAD'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('removes a temporary stream worktree after a failed merge', () => {
    const root = initRepo();
    const worktreePath = mkdtempSync(join(tmpdir(), 'stream-sync-temp-worktree-'));
    rmSync(worktreePath, { recursive: true, force: true });
    try {
      git(root, ['checkout', '-b', 'stream/temp']);
      const streamSha = git(root, ['rev-parse', 'HEAD']);
      git(root, ['update-ref', 'refs/remotes/origin/stream/temp', streamSha]);
      git(root, ['checkout', 'main']);
      git(root, ['worktree', 'add', worktreePath, 'stream/temp']);
      writeFileSync(join(worktreePath, 'dirty.txt'), 'dirty\n');

      restoreWorktreeAfterFailedMerge(root, worktreePath, 'stream/temp', true);

      expect(existsSync(worktreePath)).toBe(false);
      expect(git(root, ['worktree', 'list', '--porcelain'])).not.toContain(worktreePath);
    } finally {
      if (existsSync(worktreePath)) rmSync(worktreePath, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });
});
