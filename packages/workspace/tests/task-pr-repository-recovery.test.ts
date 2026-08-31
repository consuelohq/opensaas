import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('task.pr selected repository conflict recovery', () => {
  it('should keep conflict recovery on the selected repository when a task PR merge conflicts', () => {
    const source = readFileSync(join(import.meta.dirname, '../scripts/task-pr.js'), 'utf8');
    const start = source.indexOf('function syncTaskBranchWithBaseMetadataConflicts');
    const end = source.indexOf('async function mergeTaskPullRequestIfNeeded', start);
    const recovery = source.slice(start, end);
    const merge = source.slice(end, source.indexOf('function buildTaskOnlyResult', end));

    expect(recovery).toContain('resolveApiPushSyncTarget(worktreePath, context.taskBranch, repository, token)');
    expect(recovery).toContain('resolveApiPushSyncTarget(worktreePath, context.streamBranch, repository, token)');
    expect(recovery).toContain('baseTarget.trackingRef');
    expect(recovery).toContain('taskTarget.remote');
    expect(recovery).toContain('env: taskTarget.env');
    expect(recovery).not.toContain("push', 'origin'");
    expect(recovery).not.toContain('fetchOrigin(');
    expect(merge).toContain('syncTaskBranchWithBaseMetadataConflicts(context, { repository, token })');
  });
});
