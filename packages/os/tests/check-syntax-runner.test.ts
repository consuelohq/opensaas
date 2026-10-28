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

  it.each(syntaxRunners)('falls back safely when %s receives an invalid timeout override', (syntaxRunner) => {
    for (const invalid of ['abc', '1500.5', '0', '-1']) {
      const result = spawnSync('bun', [syntaxRunner, fixture], {
        cwd: repoRoot,
        encoding: 'utf8',
        timeout: 3_000,
        env: { ...process.env, CONSUELO_SYNTAX_CHECK_TIMEOUT_MS: invalid },
      });
      expect(result.error, `${syntaxRunner} timeout=${invalid}`).toBeUndefined();
      expect(result.status, `${syntaxRunner} timeout=${invalid}`).toBe(0);
    }
  });
});
