import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
  it('fetches a remote-only API-created commit before advancing local refs without changing worktree bytes', () => {
    const root = mkdtempSync(join(tmpdir(), 'task-push-sync-'));
    const remote = join(root, 'remote.git');
    const producer = join(root, 'producer');
    const local = join(root, 'local');
    const branch = 'task/workspace-agents/example';
    try {
      mkdirSync(producer);
      git(root, ['init', '--bare', remote]);
      git(producer, ['init']);
      git(producer, ['config', 'user.email', 'test@example.com']);
      git(producer, ['config', 'user.name', 'Test']);
      writeFileSync(join(producer, 'file.txt'), 'base\n');
      git(producer, ['add', 'file.txt']);
      git(producer, ['commit', '-m', 'base']);
      git(producer, ['checkout', '-b', branch]);
      git(producer, ['remote', 'add', 'origin', remote]);
      git(producer, ['push', '-u', 'origin', branch]);

      git(root, ['clone', '--branch', branch, remote, local]);
      git(local, ['config', 'user.email', 'test@example.com']);
      git(local, ['config', 'user.name', 'Test']);
      const base = git(local, ['rev-parse', 'HEAD']);

      writeFileSync(join(local, 'file.txt'), 'api commit content\n');
      writeFileSync(join(producer, 'file.txt'), 'api commit content\n');
      git(producer, ['add', 'file.txt']);
      git(producer, ['commit', '-m', 'api push']);
      const apiCommit = git(producer, ['rev-parse', 'HEAD']);
      git(producer, ['push', 'origin', branch]);

      const missingObject = spawnSync('git', ['cat-file', '-e', `${apiCommit}^{commit}`], { cwd: local });
      expect(missingObject.status).not.toBe(0);
      expect(git(local, ['rev-parse', `refs/remotes/origin/${branch}`])).toBe(base);

      synchronizeApiPushedTaskBranch(local, branch, base, apiCommit);

      expect(git(local, ['cat-file', '-t', apiCommit])).toBe('commit');
      expect(git(local, ['rev-parse', `refs/heads/${branch}`])).toBe(apiCommit);
      expect(git(local, ['rev-parse', `refs/remotes/origin/${branch}`])).toBe(apiCommit);
      expect(git(local, ['status', '--porcelain'])).toBe('');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
