import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { appendActivity, checkWorkpadReady, syncFilesChanged } = require('../scripts/lib/task-workpad');

const meta = { area: 'workspace-agents', taskBranch: 'task/workspace-agents/workpad-test' };

function makeWorktree(content: string) {
  const root = mkdtempSync(join(tmpdir(), 'workpad-test-'));
  const dir = join(root, '.task', 'workspace-agents', 'workpad-test');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'workpad.md'), content);
  return root;
}

describe('task workpad helpers', () => {
  it('keeps automated file changes human readable', () => {
    const root = makeWorktree(`# workpad

## files changed

- none yet

## workspace-owned: files changed

- none yet
`);
    try {
      syncFilesChanged(root, meta, [
        { path: 'packages/workspace/scripts/foo.js' },
        { path: '.task/workspace-agents/workpad-test/workpad.md' },
        { path: 'packages/workspace/tests/foo.test.ts', deleted: true },
      ]);
      const content = readFileSync(join(root, '.task', 'workspace-agents', 'workpad-test', 'workpad.md'), 'utf8');
      expect(content).toContain('- `packages/workspace/scripts/foo.js`');
      expect(content).toContain('- `packages/workspace/tests/foo.test.ts` (deleted)');
      expect(content).not.toContain('`.task/workspace-agents/workpad-test/workpad.md`');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not treat automated activity alone as publish-ready', () => {
    const root = makeWorktree(`# workpad

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## workspace-owned: activity log

- none yet
`);
    try {
      appendActivity(root, meta, { action: 'fs.patch', filePath: 'packages/workspace/scripts/foo.js' });
      const readiness = checkWorkpadReady(root, meta);
      expect(readiness.ok).toBe(false);
      expect(readiness.message).toContain('Workpad update needed before publishing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('treats an agent checkpoint as publish-ready', () => {
    const root = makeWorktree(`# workpad

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## implementation checkpoint — initial task setup

The agent wrote useful context.
`);
    try {
      expect(checkWorkpadReady(root, meta).ok).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('treats replaced acceptance criteria as publish-ready', () => {
    const root = makeWorktree(`# workpad

## acceptance criteria

- [ ] Prove the workpad readiness gate blocks scaffold-only tasks.

## plan

1. Read the relevant code and update this plan before editing.
`);
    try {
      expect(checkWorkpadReady(root, meta).ok).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
