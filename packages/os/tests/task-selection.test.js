import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';

import taskSelection from '../scripts/lib/task-selection.js';

const {
  findActiveTaskResult,
  parseTaskSelectorPrefix,
  taskMatchesSelector,
} = taskSelection;

test('parseTaskSelectorPrefix accepts task session selectors', () => {
  const result = parseTaskSelectorPrefix([
    '--task-session',
    'tsk_abc123',
    '--message',
    'docs(os): example',
  ]);

  expect(result.selector).toMatchObject({
    taskSession: 'tsk_abc123',
  });
  expect(result.remainingArgs).toEqual(['--message', 'docs(os): example']);
});

test('taskMatchesSelector can select by task session', () => {
  const task = {
    branch: 'task/os-skills/example',
    meta: {
      area: 'os-skills',
      taskBranch: 'task/os-skills/example',
      prNumber: 123,
      taskSession: 'tsk_example',
    },
  };

  expect(taskMatchesSelector(task, { taskSession: 'tsk_example' })).toBe(true);
  expect(taskMatchesSelector(task, { taskSession: 'tsk_other' })).toBe(false);
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
