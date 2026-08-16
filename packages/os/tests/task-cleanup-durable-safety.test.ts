import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function assertDurableCleanupContract(relativePath: string): void {
  const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
  const staleOnlyLine = source.split('\n').find((line) => line.includes('const staleOnly ='));
  expect(staleOnlyLine).toBeTruthy();
  expect(staleOnlyLine).not.toContain('!args.force');

  const cleanupStart = source.indexOf('const cleanupMetadata = readTaskCleanupMetadata(worktreePath);');
  const branchDelete = source.indexOf('deleteLocalBranch(repoRoot, branch, true);', cleanupStart);
  expect(cleanupStart).toBeGreaterThan(-1);
  expect(branchDelete).toBeGreaterThan(cleanupStart);
  const destructiveRegion = source.slice(cleanupStart, branchDelete);
  expect(destructiveRegion).toContain('if (durable && worktreePath && fs.existsSync(worktreePath))');
  expect(destructiveRegion).toContain('evictDurableTaskWorktree({ taskSession: durable.taskSession })');
  const afterDelete = source.slice(branchDelete, branchDelete + 220);
  expect(afterDelete).toContain('if (durable) removeDurableTaskRecoveryState(durable.taskSession)');
}

describe('task cleanup durable safety', () => {
  it('keeps workspace and installed OS destructive cleanup behind durable eviction', () => {
    assertDurableCleanupContract('packages/workspace/scripts/task-cleanup.js');
    assertDurableCleanupContract('packages/os/scripts/task-cleanup.js');
  });
});
