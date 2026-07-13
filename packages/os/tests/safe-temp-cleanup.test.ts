import { existsSync, mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { removeSafeTempDir } from './safe-temp-cleanup';

describe('removeSafeTempDir', () => {
  it('rejects symlinked temp paths before deleting the real target', () => {
    const parentDir = mkdtempSync(join(tmpdir(), 'consuelo-os-safe-cleanup-parent-'));
    const outsideDir = mkdtempSync(join(tmpdir(), 'consuelo-os-safe-cleanup-target-'));
    const symlinkPath = join(parentDir, 'consuelo-os-safe-cleanup-parent-link');

    try {
      symlinkSync(outsideDir, symlinkPath, 'dir');

      expect(() => removeSafeTempDir(symlinkPath, 'consuelo-os-safe-cleanup-parent-')).toThrow(
        /Refusing to remove unsafe temp path/,
      );
      expect(existsSync(outsideDir)).toBe(true);
    } finally {
      if (existsSync(outsideDir)) removeSafeTempDir(outsideDir, 'consuelo-os-safe-cleanup-target-');
      if (existsSync(parentDir)) removeSafeTempDir(parentDir, 'consuelo-os-safe-cleanup-parent-');
    }
  });
});
