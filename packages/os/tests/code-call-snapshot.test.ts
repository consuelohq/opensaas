import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import { executeCodeCall } from '../scripts/lib/code-call/runtime';
import { captureSnapshotEffect, changedFiles } from '../scripts/lib/code-call/snapshot';

describe('code.call mutation snapshots', () => {
  it('detects content changes to an already untracked file', async () => {
    const root = mkdtempSync(join(tmpdir(), 'os-code-call-snapshot-'));

    try {
      const init = spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
      expect(init.status).toBe(0);

      const file = join(root, 'dirty.txt');
      writeFileSync(file, 'alpha');
      const before = await Effect.runPromise(captureSnapshotEffect(root));

      writeFileSync(file, 'bravo');
      const after = await Effect.runPromise(captureSnapshotEffect(root));

      expect(changedFiles(before, after)).toEqual(['dirty.txt']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports an already untracked file when code.call changes it in read mode', async () => {
    const root = mkdtempSync(join(tmpdir(), 'os-code-call-runtime-snapshot-'));

    try {
      const init = spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
      expect(init.status).toBe(0);
      writeFileSync(join(root, 'dirty.txt'), 'alpha');

      const result = await executeCodeCall({
        language: 'python',
        mode: 'read',
        code: 'from pathlib import Path\nPath("dirty.txt").write_text("bravo")',
      }, {
        cwd: root,
        now: () => 1000,
        randomUUID: () => 'abc123def4567890abc123def4567890',
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('COMMAND_FAILED');
      expect(result.data.detectedMistakeClass).toBe('mutation_in_read_mode');
      expect(result.data.filesChanged).toEqual(['dirty.txt']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports a retargeted already-dirty broken symlink in read mode', async () => {
    const root = mkdtempSync(join(tmpdir(), 'os-code-call-broken-symlink-'));

    try {
      const init = spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
      expect(init.status).toBe(0);
      symlinkSync('missing-alpha', join(root, 'dirty-link'));

      const result = await executeCodeCall({
        language: 'python',
        mode: 'read',
        code: [
          'from pathlib import Path',
          'link = Path("dirty-link")',
          'link.unlink()',
          'link.symlink_to("missing-bravo")',
        ].join('\n'),
      }, {
        cwd: root,
        now: () => 1000,
        randomUUID: () => 'abc123def4567890abc123def4567890',
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('COMMAND_FAILED');
      expect(result.data.detectedMistakeClass).toBe('mutation_in_read_mode');
      expect(result.data.filesChanged).toEqual(['dirty-link']);
    } finally {
      try { unlinkSync(join(root, 'dirty-link')); } catch {}
      rmSync(root, { recursive: true, force: true });
    }
  });
});
