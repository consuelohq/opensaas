import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { assertApiPushBaseIsSynced, synchronizeApiPushedTaskBranch } = require('../scripts/lib/git');

function git(cwd: string, args: string[], input?: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', input }).trim();
}

describe('task.push local branch synchronization', () => {
  it('should refresh a stale origin tracking ref before publish when the local task branch matches the GitHub head', () => {
    const root = mkdtempSync(join(tmpdir(), 'task-push-preflight-'));
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
      const base = git(local, ['rev-parse', 'HEAD']);

      writeFileSync(join(producer, 'file.txt'), 'remote head\n');
      git(producer, ['add', 'file.txt']);
      git(producer, ['commit', '-m', 'remote head']);
      const githubHead = git(producer, ['rev-parse', 'HEAD']);
      git(producer, ['push', 'origin', branch]);

      git(local, ['fetch', 'origin', githubHead]);
      git(local, ['reset', '--mixed', githubHead]);
      expect(git(local, ['rev-parse', `refs/heads/${branch}`])).toBe(githubHead);
      expect(git(local, ['rev-parse', `refs/remotes/origin/${branch}`])).toBe(base);

      assertApiPushBaseIsSynced(local, branch, githubHead);

      expect(git(local, ['rev-parse', `refs/remotes/origin/${branch}`])).toBe(githubHead);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should reject a stale local task branch during preflight when the GitHub head is newer', () => {
    const root = mkdtempSync(join(tmpdir(), 'task-push-preflight-stale-local-'));
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

      writeFileSync(join(producer, 'file.txt'), 'remote head\n');
      git(producer, ['add', 'file.txt']);
      git(producer, ['commit', '-m', 'remote head']);
      const githubHead = git(producer, ['rev-parse', 'HEAD']);
      git(producer, ['push', 'origin', branch]);

      expect(() => assertApiPushBaseIsSynced(local, branch, githubHead)).toThrow(/local task branch is not synced/);
      expect(git(local, ['rev-parse', `refs/remotes/origin/${branch}`])).toBe(githubHead);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should run ref preflight before any GitHub write when task-push publishes files', () => {
    const source = readFileSync(join(import.meta.dirname, '../scripts/task-push.js'), 'utf8');
    const preflight = source.indexOf('assertApiPushBaseIsSynced(repoRoot, branch, branchRef.object.sha)');
    expect(preflight).toBeGreaterThan(-1);
    for (const writeCall of ['createBlob({', 'createTree({', 'createCommit({', 'updateBranchRef({']) {
      expect(preflight).toBeLessThan(source.indexOf(writeCall));
    }
  });

  it('should fetch the commit and advance local refs without changing worktree bytes when the API-created commit exists only on the remote', () => {
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

  it('should fail closed without moving the local ref when previousSha no longer matches local refs', () => {
    const root = mkdtempSync(join(tmpdir(), 'task-push-sync-stale-previous-'));
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
      const actualPrevious = git(local, ['rev-parse', 'HEAD']);

      writeFileSync(join(producer, 'file.txt'), 'api commit\n');
      git(producer, ['add', 'file.txt']);
      git(producer, ['commit', '-m', 'api push']);
      const nextSha = git(producer, ['rev-parse', 'HEAD']);
      git(producer, ['push', 'origin', branch]);

      expect(() => synchronizeApiPushedTaskBranch(local, branch, nextSha, nextSha)).toThrow(/expected local and origin refs/);
      expect(git(local, ['rev-parse', `refs/heads/${branch}`])).toBe(actualPrevious);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should fail closed without moving the local ref when the fetched remote head differs from nextSha', () => {
    const root = mkdtempSync(join(tmpdir(), 'task-push-sync-raced-remote-'));
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
      const previousSha = git(local, ['rev-parse', 'HEAD']);

      writeFileSync(join(producer, 'file.txt'), 'expected api commit\n');
      git(producer, ['add', 'file.txt']);
      git(producer, ['commit', '-m', 'expected api push']);
      const expectedNextSha = git(producer, ['rev-parse', 'HEAD']);
      writeFileSync(join(producer, 'file.txt'), 'racing writer\n');
      git(producer, ['add', 'file.txt']);
      git(producer, ['commit', '-m', 'racing writer']);
      git(producer, ['push', 'origin', branch]);

      expect(() => synchronizeApiPushedTaskBranch(local, branch, previousSha, expectedNextSha)).toThrow(/expected fetched origin ref/);
      expect(git(local, ['rev-parse', `refs/heads/${branch}`])).toBe(previousSha);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should guard post-publish local sync and hook dispatch failures when the remote branch has already advanced', () => {
    const source = readFileSync(join(import.meta.dirname, '../scripts/task-push.js'), 'utf8');
    const postPublish = source.slice(source.indexOf('await updateBranchRef({'));

    expect(postPublish).toMatch(/try\s*\{[\s\S]*synchronizeApiPushedTaskBranch[\s\S]*\}\s*catch/);
    expect(postPublish).toMatch(/try\s*\{[\s\S]*dispatchHookEvent[\s\S]*\}\s*catch/);
    expect(postPublish).toContain('remote push succeeded');
  });

  it('should print stream-promotion guidance when task-push succeeds without JSON output', () => {
    const source = readFileSync(join(import.meta.dirname, '../scripts/task-push.js'), 'utf8');
    const nonJsonOutput = source.slice(source.indexOf('writeStdout(`pushed ${commit.sha.slice(0, 8)} to ${branch}`)'));

    expect(nonJsonOutput).toContain('renderHookResult(workflowHookResult)');
  });
});
