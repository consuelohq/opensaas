import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../..');
const syntaxRunners = [
  resolve(repoRoot, 'packages/os/scripts/check-syntax.js'),
  resolve(repoRoot, 'packages/workspace/scripts/check-syntax.js'),
];
const fixture = resolve(repoRoot, 'packages/os/scripts/wait.js');

describe('OS JavaScript syntax runner', () => {
  it.each(syntaxRunners)('stays bounded when %s is launched by Bun', (syntaxRunner) => {
    const result = spawnSync('bun', [syntaxRunner, fixture], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 3_000,
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('workspace script syntax checks passed');
  });
});
