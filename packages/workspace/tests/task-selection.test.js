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

test('findActiveTaskCandidates can recover metadata from the durable registry', () => {
  const repoRoot = mkdtempSync(join(tmpdir(), 'workspace-task-registry-selection-'));
  const worktreeRoot = mkdtempSync(join(tmpdir(), 'workspace-task-registry-worktree-'));
  const home = mkdtempSync(join(tmpdir(), 'workspace-task-registry-home-'));
  const branch = 'task/workspace-agent/registry-selection';
  const oldHome = process.env.CONSUELO_HOME;
  try {
    execFileSync('git', ['init', '-q'], { cwd: repoRoot });
    execFileSync('git', ['config', 'user.email', 'test@consuelohq.com'], { cwd: repoRoot });
    execFileSync('git', ['config', 'user.name', 'Consuelo Test'], { cwd: repoRoot });
    writeFileSync(join(repoRoot, 'README.md'), 'fixture\n');
    execFileSync('git', ['add', 'README.md'], { cwd: repoRoot });
    execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: repoRoot });
    execFileSync('git', ['branch', branch], { cwd: repoRoot });
    rmSync(worktreeRoot, { recursive: true, force: true });
    execFileSync('git', ['worktree', 'add', '-q', worktreeRoot, branch], { cwd: repoRoot });
    process.env.CONSUELO_HOME = home;
    const { writeDurableTaskSessionMetadata } = require('../scripts/lib/task-registry.js');
    writeDurableTaskSessionMetadata({ area: 'workspace-agent', taskBranch: branch, taskSession: 'tsk_registry_selection', worktreePath: worktreeRoot });
    const result = taskSelection.findActiveTaskCandidates(repoRoot);
    expect(result).toContainEqual(expect.objectContaining({ branch, meta: expect.objectContaining({ taskSession: 'tsk_registry_selection' }) }));
  } finally {
    if (oldHome === undefined) delete process.env.CONSUELO_HOME; else process.env.CONSUELO_HOME = oldHome;
    rmSync(repoRoot, { recursive: true, force: true }); rmSync(worktreeRoot, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true });
  }
});


test('findActiveTaskResult recovers an evicted taskSession even when no worktree candidate exists', () => {
  const repoRoot = mkdtempSync(join(tmpdir(), 'task-selection-evicted-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: repoRoot });
    const recoveredPath = join(repoRoot, 'restored-task');
    const result = findActiveTaskResult(repoRoot, { taskSession: 'tsk_evicted_selection' }, {
      recoverTaskSession: (taskSession) => ({
        taskSession,
        area: 'workspace-agent',
        taskBranch: 'task/workspace-agent/restored',
        branch: 'task/workspace-agent/restored',
        worktreePath: recoveredPath,
        worktree: recoveredPath,
        status: 'active',
      }),
    });
    expect(result.error).toBeNull();
    expect(result.task).toMatchObject({
      branch: 'task/workspace-agent/restored',
      worktreePath: recoveredPath,
      meta: expect.objectContaining({ taskSession: 'tsk_evicted_selection', status: 'active' }),
    });
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
