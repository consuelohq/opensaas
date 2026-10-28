import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

import { removeSafeTempDir } from './safe-temp-cleanup';

const tempRoots: string[] = [];
const fsScript = resolve(import.meta.dirname, '../scripts/fs.js');

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'consuelo-fs-list-portability-'));
  tempRoots.push(root);
  return root;
}

function runList(args: string[]) {
  return spawnSync(process.execPath, [fsScript, 'list', ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: '',
    },
  });
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) removeSafeTempDir(root, 'consuelo-fs-list-portability-');
  }
});

describe('fs.list portable helper fallback', () => {
  it('should list directory contents when eza is unavailable', () => {
    const root = makeRoot();
    writeFileSync(join(root, 'visible.txt'), 'visible\n');

    const result = runList([root]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('visible.txt');
    expect(result.stderr).toBe('');
  });

  it('should find matching files when fd is unavailable', () => {
    const root = makeRoot();
    const nested = join(root, 'nested');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, 'needle.ts'), 'export {};\n');
    writeFileSync(join(nested, 'other.js'), 'export {};\n');

    const result = runList([root, '--find', 'needle', '--depth', '3']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('needle.ts');
    expect(result.stdout).not.toContain('other.js');
    expect(result.stderr).toBe('');
  });
});
