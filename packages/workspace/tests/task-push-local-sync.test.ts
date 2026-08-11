import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { synchronizeApiPushedTaskBranch } = require('../scripts/lib/git');

function git(cwd: string, args: string[], input?: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', input }).trim();
}

describe('task.push local branch synchronization', () => {
  it('advances the checked-out task branch and origin tracking ref to the API-created commit without changing worktree bytes', () => {
    const root = mkdtempSync(join(tmpdir(), 'task-push-sync-'));
    try {
      git(root, ['init']);
      git(root, ['config', 'user.email', 'test@example.com']);
      git(root, ['config', 'user.name', 'Test']);
      writeFileSync(join(root, 'file.txt'), 'base\n');
      git(root, ['add', 'file.txt']);
      git(root, ['commit', '-m', 'base']);
      const base = git(root, ['rev-parse', 'HEAD']);
      const branch = 'task/workspace-agents/example';
      git(root, ['checkout', '-b', branch]);
      git(root, ['update-ref', `refs/remotes/origin/${branch}`, base]);

      writeFileSync(join(root, 'file.txt'), 'api commit content\n');
      git(root, ['add', 'file.txt']);
      const tree = git(root, ['write-tree']);
      const apiCommit = git(root, ['commit-tree', tree, '-p', base, '-m', 'api push']);
      git(root, ['reset', '--mixed', base]);

      synchronizeApiPushedTaskBranch(root, branch, base, apiCommit);

      expect(git(root, ['rev-parse', `refs/heads/${branch}`])).toBe(apiCommit);
      expect(git(root, ['rev-parse', `refs/remotes/origin/${branch}`])).toBe(apiCommit);
      expect(git(root, ['status', '--porcelain'])).toBe('');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
