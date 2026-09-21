import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import vm from 'node:vm';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

function loadIndexPathPolicy() {
  const source = readFileSync(
    join(import.meta.dirname, '../scripts/lib/index/indexer.js'),
    'utf8',
  );
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    process,
    require: (specifier) =>
      specifier.startsWith('.') ? {} : require(specifier),
  });
  return module.exports;
}

describe('semantic index path exclusions', () => {
  it('excludes dependency, generated, vendor, and nested worktree trees', () => {
    const { isIndexablePath } = loadIndexPathPolicy();

    for (const filePath of [
      'node_modules/package/index.js',
      'packages/app/dist/index.js',
      'packages/app/generated/schema.ts',
      'packages/app/vendor/library/index.js',
      'worktrees/task/packages/app/src/index.ts',
      '.worktrees/task/packages/app/src/index.ts',
    ]) {
      expect(isIndexablePath(filePath), filePath).toBe(false);
    }
    expect(isIndexablePath('packages/app/src/index.ts')).toBe(true);
  });
});
