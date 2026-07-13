import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { appendActivity, checkWorkpadReady, syncFilesChanged, syncValidationEvidence } = require('../scripts/lib/task-workpad');

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
    const root = makeWorktree([
      '# workpad',
      '',
      '## files changed',
      '',
      '- none yet',
      '',
      '## workspace-owned: files changed',
      '',
      '- none yet',
      '',
    ].join('\n'));
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

  it('accumulates repeated automated file changes', () => {
    const root = makeWorktree([
      '# workpad',
      '',
      '## files changed',
      '',
      '- none yet',
      '',
      '## workspace-owned: files changed',
      '',
      '- none yet',
      '',
    ].join('\n'));
    try {
      syncFilesChanged(root, meta, [{ path: 'packages/workspace/scripts/one.js' }]);
      syncFilesChanged(root, meta, [{ path: 'packages/workspace/scripts/two.js' }]);
      const content = readFileSync(join(root, '.task', 'workspace-agents', 'workpad-test', 'workpad.md'), 'utf8');
      expect(content).toContain('- `packages/workspace/scripts/one.js`');
      expect(content).toContain('- `packages/workspace/scripts/two.js`');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('can replace automated files changed with final publish file set', () => {
    const root = makeWorktree([
      '# workpad',
      '',
      '## files changed',
      '',
      '- `packages/workspace/scripts/old.js`',
      '',
      '## workspace-owned: files changed',
      '',
      '- `packages/workspace/scripts/old.js`',
      '',
    ].join('\n'));
    try {
      syncFilesChanged(root, meta, [{ path: 'packages/workspace/scripts/final.js' }], { replace: true });
      const content = readFileSync(join(root, '.task', 'workspace-agents', 'workpad-test', 'workpad.md'), 'utf8');
      expect(content).toContain('- `packages/workspace/scripts/final.js`');
      expect(content).not.toContain('- `packages/workspace/scripts/old.js`');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps validation evidence human readable', () => {
    const root = makeWorktree([
      '# workpad',
      '',
      '## workspace-owned: validation evidence',
      '',
      '- none yet',
      '',
    ].join('\n'));
    try {
      syncValidationEvidence(root, meta, { command: 'review.run', ok: true, detail: 'OK' });
      const content = readFileSync(join(root, '.task', 'workspace-agents', 'workpad-test', 'workpad.md'), 'utf8');
      expect(content).toContain('`review.run`: passed — OK');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not treat automated activity alone as publish-ready', () => {
    const root = makeWorktree([
      '# workpad',
      '',
      '## acceptance criteria',
      '',
      '- [ ] Define explicit task acceptance criteria before coding.',
      '',
      '## plan',
      '',
      '1. Read the relevant code and update this plan before editing.',
      '',
      '## workspace-owned: activity log',
      '',
      '- none yet',
      '',
    ].join('\n'));
    try {
      appendActivity(root, meta, { action: 'fs.apply_patch', filePath: 'packages/workspace/scripts/foo.js' });
      const readiness = checkWorkpadReady(root, meta);
      expect(readiness.ok).toBe(false);
      expect(readiness.message).toContain('Workpad update needed before publishing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('treats an agent checkpoint as publish-ready', () => {
    const root = makeWorktree([
      '# workpad',
      '',
      '## acceptance criteria',
      '',
      '- [ ] Define explicit task acceptance criteria before coding.',
      '',
      '## plan',
      '',
      '1. Read the relevant code and update this plan before editing.',
      '',
      '## implementation checkpoint — initial task setup',
      '',
      'The agent wrote useful context.',
      '',
    ].join('\n'));
    try {
      expect(checkWorkpadReady(root, meta).ok).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('treats replaced acceptance criteria as publish-ready', () => {
    const root = makeWorktree([
      '# workpad',
      '',
      '## acceptance criteria',
      '',
      '- [ ] Prove the workpad readiness gate blocks scaffold-only tasks.',
      '',
      '## plan',
      '',
      '1. Read the relevant code and update this plan before editing.',
      '',
    ].join('\n'));
    try {
      expect(checkWorkpadReady(root, meta).ok).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
