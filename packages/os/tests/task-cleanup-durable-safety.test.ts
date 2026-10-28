import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const osRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(osRoot, '..', '..');

function assertDurableCleanupContract(absolutePath: string): void {
  const source = readFileSync(absolutePath, 'utf8');
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
    assertDurableCleanupContract(resolve(repoRoot, 'packages/workspace/scripts/task-cleanup.js'));
    assertDurableCleanupContract(resolve(osRoot, 'scripts/task-cleanup.js'));
  });
});
