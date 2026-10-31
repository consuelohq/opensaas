import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '../../..');
const helperPaths = [
  'packages/os/scripts/lib/git.js',
  'packages/workspace/scripts/lib/git.js',
];

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'os-task-cleanup-'));
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@example.invalid');
  git(dir, 'config', 'user.name', 'Test Runner');
  writeFileSync(join(dir, 'fixture.txt'), 'initial\n');
  git(dir, 'add', 'fixture.txt');
  git(dir, 'commit', '-qm', 'initial');
  return dir;
}

for (const helperPath of helperPaths) {
  describe(helperPath, () => {
    const { isBranchMerged } = require(resolve(root, helperPath));

    it('recognizes a task committed to its owning stream without an explicit target', () => {
      const repo = makeRepo();
      try {
        git(repo, 'branch', 'task/os/finished');
        git(repo, 'update-ref', 'refs/remotes/origin/stream/os', 'HEAD');
        expect(isBranchMerged(repo, 'task/os/finished')).toBe(true);
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    });

    it('recognizes a task already in main if its stream ref is unavailable', () => {
      const repo = makeRepo();
      try {
        git(repo, 'branch', 'task/os/finished');
        git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
        expect(isBranchMerged(repo, 'task/os/finished')).toBe(true);
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    });

    it('rejects unmerged tasks and unavailable refs, and respects explicit targets', () => {
      const repo = makeRepo();
      try {
        git(repo, 'update-ref', 'refs/remotes/origin/stream/os', 'HEAD');
        git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
        git(repo, 'checkout', '-qb', 'task/os/not-yet-merged');
        writeFileSync(join(repo, 'fixture.txt'), 'change\n');
        git(repo, 'add', 'fixture.txt');
        git(repo, 'commit', '-qm', 'unmerged');
        expect(isBranchMerged(repo, 'task/os/not-yet-merged')).toBe(false);
        expect(isBranchMerged(repo, 'task/os/not-yet-merged', 'refs/remotes/origin/main')).toBe(false);
        expect(isBranchMerged(repo, 'task/os/not-yet-merged', 'HEAD')).toBe(true);
        git(repo, 'update-ref', '-d', 'refs/remotes/origin/stream/os');
        git(repo, 'update-ref', '-d', 'refs/remotes/origin/main');
        expect(isBranchMerged(repo, 'task/os/not-yet-merged')).toBe(false);
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    });
  });
}

describe('implicit merged cleanup safety guard', () => {
  for (const source of [
    'packages/os/scripts/task-cleanup.js',
    'packages/workspace/scripts/task-cleanup.js',
  ]) {
    it(source, () => {
      const code = readFileSync(resolve(root, source), 'utf8');
      expect(code).toMatch(/if \(args\.merged && \(durable \|\| worktreePath\)\)/);
      expect(code).toContain('registered task session or checked-out worktree');
    });
  }
});
