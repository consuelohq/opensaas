import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { findTaskMeta } = require('../scripts/lib/task-meta');

function writeScopedCurrent(root: string, branch: string) {
  const [, area, ...slugParts] = branch.split('/');
  const slug = slugParts.join('-');
  const dir = join(root, '.task', area, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'current.json'), JSON.stringify({
    area,
    stream: `stream/${area}`,
    taskBranch: branch,
    createdAt: '2026-05-22T00:00:00.000Z',
  }, null, 2) + '\n');
}

describe('task metadata lookup', () => {
  it('ignores historical scoped task metadata on main status lookup', () => {
    const root = mkdtempSync(join(tmpdir(), 'task-meta-main-'));
    try {
      writeScopedCurrent(root, 'task/workspace-agents/old-shipped-task');
      const record = findTaskMeta(root, { currentBranch: 'main', includeStale: true });
      expect(record).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses scoped task metadata for matching task branch lookup', () => {
    const root = mkdtempSync(join(tmpdir(), 'task-meta-task-'));
    try {
      const branch = 'task/workspace-agents/active-task';
      writeScopedCurrent(root, branch);
      const record = findTaskMeta(root, { currentBranch: branch, includeStale: true });
      expect(record?.stale).toBe(false);
      expect(record?.data.taskBranch).toBe(branch);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
