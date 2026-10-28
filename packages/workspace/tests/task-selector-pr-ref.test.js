import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseTaskSelectorPrefix, selectTaskFromCandidatesResult } = require('../scripts/lib/task-selection.js');

describe('task selector PR references', () => {
  it('parses PR URLs before proxied command args', () => {
    const parsed = parseTaskSelectorPrefix([
      '--github',
      'https://diffs.consuelohq.com/consuelohq/opensaas/pull/780',
      'read',
      '.task/current.json',
    ]);
    expect(parsed.selector.prNumber).toBe(780);
    expect(parsed.remainingArgs).toEqual(['read', '.task/current.json']);
  });

  it('matches active tasks by parsed PR number', () => {
    const result = selectTaskFromCandidatesResult([
      { worktreePath: '/tmp/a', branch: 'task/workspace-agents/a', meta: { area: 'workspace-agents', taskBranch: 'task/workspace-agents/a', prNumber: 686 } },
      { worktreePath: '/tmp/b', branch: 'task/workspace-agents/b', meta: { area: 'workspace-agents', taskBranch: 'task/workspace-agents/b', prNumber: 780 } },
    ], { prNumber: 780 });
    expect(result.error).toBeNull();
    expect(result.task.worktreePath).toBe('/tmp/b');
  });

  it('parses task sessions before proxied command args', () => {
    const parsed = parseTaskSelectorPrefix([
      '--task-session',
      'tsk_e398fbe000ba',
      'read',
      '.task/current.json',
    ]);
    expect(parsed.selector.taskSession).toBe('tsk_e398fbe000ba');
    expect(parsed.remainingArgs).toEqual(['read', '.task/current.json']);
  });

  it('matches active tasks by task session', () => {
    const result = selectTaskFromCandidatesResult([
      {
        worktreePath: '/tmp/a',
        branch: 'task/workspace-agents/a',
        meta: {
          area: 'workspace-agents',
          taskBranch: 'task/workspace-agents/a',
          taskSession: 'tsk_a',
        },
      },
      {
        worktreePath: '/tmp/b',
        branch: 'task/workspace-agents/b',
        meta: {
          area: 'workspace-agents',
          taskBranch: 'task/workspace-agents/b',
          taskSession: 'tsk_b',
        },
      },
    ], { taskSession: 'tsk_b' });
    expect(result.error).toBeNull();
    expect(result.task.worktreePath).toBe('/tmp/b');
  });
});
