import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const streamSyncPath = resolve(import.meta.dirname, '../scripts/stream-sync.js');

test('stream sync links main-worktree node_modules before running verify', () => {
  const source = readFileSync(streamSyncPath, 'utf8');

  expect(source).toContain("require('./lib/task-node-modules')");
  expect(source).toContain('linkTaskWorktreeNodeModules({');
  expect(source.indexOf('linkTaskWorktreeNodeModules({')).toBeLessThan(
    source.lastIndexOf('runStreamChecks(worktreePath)'),
  );
});
