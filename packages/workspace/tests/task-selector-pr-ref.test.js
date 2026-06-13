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
});
