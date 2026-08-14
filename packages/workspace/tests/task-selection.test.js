import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';

import taskSelection from '../scripts/lib/task-selection.js';

const { findActiveTaskResult } = taskSelection;

test('findActiveTaskResult includes the current task worktree', () => {
  const repoRoot = mkdtempSync(join(tmpdir(), 'workspace-task-selection-'));
  const branch = 'task/os/current-worktree';
  try {
    execFileSync('git', ['init', '-q'], { cwd: repoRoot });
    execFileSync('git', ['config', 'user.email', 'test@consuelohq.com'], { cwd: repoRoot });
    execFileSync('git', ['config', 'user.name', 'Consuelo Test'], { cwd: repoRoot });
    writeFileSync(join(repoRoot, 'README.md'), 'fixture\n');
    execFileSync('git', ['add', 'README.md'], { cwd: repoRoot });
    execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: repoRoot });
    execFileSync('git', ['checkout', '-qb', branch], { cwd: repoRoot });
    const stateDir = join(repoRoot, '.task', 'os', 'current-worktree');
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, 'current.json'), `${JSON.stringify({
      area: 'os', taskBranch: branch, taskSession: 'tsk_current_worktree', worktreePath: repoRoot,
    }, null, 2)}\n`);

    const canonicalRepoRoot = realpathSync(repoRoot);
    const result = findActiveTaskResult(canonicalRepoRoot, { branch });
    expect(result.error).toBeNull();
    expect(result.task).toMatchObject({ branch, worktreePath: canonicalRepoRoot });
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
