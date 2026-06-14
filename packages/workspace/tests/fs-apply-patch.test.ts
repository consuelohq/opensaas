import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, expect, test } from 'vitest';

const cleanupPaths: string[] = [];

function makeTempDirectory() {
  const directory = mkdtempSync(path.join(tmpdir(), 'workspace-apply-patch-'));
  cleanupPaths.push(directory);
  return directory;
}

function runFs(cwd: string, args: string[]) {
  return spawnSync('bun', [path.join(process.cwd(), 'packages/workspace/scripts/fs.js'), ...args], {
    cwd,
    encoding: 'utf8',
  });
}

afterEach(() => {
  while (cleanupPaths.length > 0) {
    rmSync(cleanupPaths.pop()!, { force: true, recursive: true });
  }
});

test('applies an anchored patch file with update add and delete operations', () => {
  const root = makeTempDirectory();
  mkdirSync(path.join(root, 'src'));
  writeFileSync(path.join(root, 'src', 'example.ts'), ['export const value = 1;', 'export const keep = true;', ''].join('\n'));
  writeFileSync(path.join(root, 'src', 'obsolete.ts'), 'delete me\n');

  const patchPath = path.join(root, 'change.patch');
  writeFileSync(patchPath, [
    '*** Begin Patch',
    '*** Update File: src/example.ts',
    '@@',
    ' export const value = 1;',
    '-export const keep = true;',
    '+export const keep = false;',
    '+export const added = "yes";',
    '*** Add File: src/new-file.ts',
    '+export const created = true;',
    '*** Delete File: src/obsolete.ts',
    '*** End Patch',
    '',
  ].join('\n'));

  const result = runFs(root, ['apply-patch', '--patch-file', patchPath]);

  expect(result.status).toBe(0);
  expect(readFileSync(path.join(root, 'src', 'example.ts'), 'utf8')).toBe(
    ['export const value = 1;', 'export const keep = false;', 'export const added = "yes";', ''].join('\n'),
  );
  expect(readFileSync(path.join(root, 'src', 'new-file.ts'), 'utf8')).toBe('export const created = true;\n');
  expect(existsSync(path.join(root, 'src', 'obsolete.ts'))).toBe(false);
});

test('rejects unsafe patch paths', () => {
  const root = makeTempDirectory();
  const patchPath = path.join(root, 'unsafe.patch');
  writeFileSync(patchPath, ['*** Begin Patch', '*** Add File: ../outside.txt', '+bad', '*** End Patch', ''].join('\n'));

  const result = runFs(root, ['apply-patch', '--patch-file', patchPath]);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('unsafe patch path');
});
