import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

const script = resolve(import.meta.dirname, '../scripts/task-init.js');

test('task:init preserves compatible surviving PR and session metadata', () => {
  const repoRoot = mkdtempSync(join(tmpdir(), 'workspace-task-init-'));
  const branch = 'task/os/recover-session';
  const stateDir = join(repoRoot, '.task', 'os', 'recover-session');
  const historyPath = join(repoRoot, '.task', 'tasks', 'os', 'recover-session.json');
  const currentPath = join(stateDir, 'current.json');
  const sessionPath = join(stateDir, 'session.json');
  try {
    execFileSync('git', ['init', '-q'], { cwd: repoRoot });
    execFileSync('git', ['config', 'user.email', 'test@consuelohq.com'], { cwd: repoRoot });
    execFileSync('git', ['config', 'user.name', 'Consuelo Test'], { cwd: repoRoot });
    writeFileSync(join(repoRoot, 'README.md'), 'fixture\n');
    execFileSync('git', ['add', 'README.md'], { cwd: repoRoot });
    execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: repoRoot });
    execFileSync('git', ['checkout', '-qb', branch], { cwd: repoRoot });
    mkdirSync(join(repoRoot, '.task', 'tasks', 'os'), { recursive: true });
    mkdirSync(stateDir, { recursive: true });
    const existing = {
      area: 'os', stream: 'stream/os', taskBranch: branch, baseBranch: 'stream/os',
      sourceBranch: 'stream/os', startFrom: 'stream', prNumber: 321,
      prUrl: 'https://github.com/consuelohq/opensaas/pull/321', worktreePath: repoRoot,
      graphitePrUrl: 'https://app.graphite.com/github/pr/consuelohq/opensaas/321/recover-session',
      githubPrUrl: 'https://github.com/consuelohq/opensaas/pull/321',
      taskSession: 'tsk_recover', tmuxSession: 'tmux-recover', sessionPath,
      createdAt: '2026-08-13T20:00:00.000Z',
    };
    writeFileSync(currentPath, `${JSON.stringify(existing, null, 2)}\n`);
    writeFileSync(historyPath, `${JSON.stringify(existing, null, 2)}\n`);
    writeFileSync(sessionPath, `${JSON.stringify({ ...existing, branch, worktree: repoRoot }, null, 2)}\n`);

    execFileSync(process.execPath, [script, '--area', 'os', '--branch', branch, '--worktree', repoRoot, '--json'], { cwd: repoRoot });
    const repaired = JSON.parse(readFileSync(currentPath, 'utf8'));
    expect(repaired).toMatchObject({
      prNumber: 321, taskSession: 'tsk_recover', tmuxSession: 'tmux-recover',
      sourceBranch: 'stream/os', startFrom: 'stream', createdAt: existing.createdAt,
      graphitePrUrl: existing.graphitePrUrl, githubPrUrl: existing.githubPrUrl,
    });
    expect(JSON.parse(readFileSync(historyPath, 'utf8'))).toMatchObject({ taskSession: 'tsk_recover', prNumber: 321 });
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
