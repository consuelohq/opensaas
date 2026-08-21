import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const scripts = [
  resolve(import.meta.dirname, '../scripts/stream-sync.js'),
  resolve(import.meta.dirname, '../../os/scripts/stream-sync.js'),
] as const;

describe.each(scripts)('%s stream sync repo option contract', (script) => {
  it('accepts the typed facade repo option', () => {
    const result = spawnSync(
      'bun',
      [script, '--area', 'self-healing', '--repo', 'consuelohq/opensaas', '--help'],
      { encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('unknown flag: --repo');
    expect(result.stdout).toContain('usage: bun run stream:sync');
  });
});
