import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, expect, test } from 'vitest';

const cleanupPaths: string[] = [];
const repoRoot = path.resolve(import.meta.dirname, '../../..');

function makeTempDirectory() {
  const directory = mkdtempSync(path.join(tmpdir(), 'workspace-apply-patch-'));
  cleanupPaths.push(directory);
  return directory;
}

function runFs(cwd: string, args: string[], input?: string) {
  return spawnSync('bun', [path.join(repoRoot, 'packages/workspace/scripts/fs.js'), ...args], {
    cwd,
    encoding: 'utf8',
    input,
  });
}

function readJson(filePath: string) {
  return JSON.parse(readFileSync(path.join(repoRoot, filePath), 'utf8')) as unknown;
}

afterEach(() => {
  while (cleanupPaths.length > 0) {
    rmSync(cleanupPaths.pop()!, { force: true, recursive: true });
  }
});

test('exposes apply_patch with lowercase snake public tool naming', () => {
  const manifest = readJson('packages/workspace/tooling/tool-manifest.json') as Array<{
    name: string;
    methodPath?: string[];
    command?: { subcommand?: string };
  }>;
  const toolNames = manifest.map((entry) => entry.name);
  const applyPatch = manifest.find((entry) => entry.name === 'fs.apply_patch');

  expect(toolNames).toContain('fs.apply_patch');
  expect(toolNames).not.toContain('fs.applyPatch');
  expect(applyPatch?.methodPath).toEqual(['fs', 'apply_patch']);
  expect(applyPatch?.command?.subcommand).toBe('apply-patch');
});

test('includes apply_patch in the OS dev and core manifests', () => {
  const devManifest = readJson('packages/os/tooling/dev-tool-manifest.json') as Array<{ name: string }>;
  const coreManifest = readJson('packages/os/manifests/core.manifest.json') as { tools: Array<{ name: string; definition?: { name?: string } }> };

  expect(devManifest.map((entry) => entry.name)).toContain('fs.apply_patch');
  expect(coreManifest.tools.map((entry) => entry.name)).toContain('fs.apply_patch');
  expect(coreManifest.tools.find((entry) => entry.name === 'fs.apply_patch')?.definition?.name).toBe('fs.apply_patch');
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

  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(readFileSync(path.join(root, 'src', 'example.ts'), 'utf8')).toBe(
    ['export const value = 1;', 'export const keep = false;', 'export const added = "yes";', ''].join('\n'),
  );
  expect(readFileSync(path.join(root, 'src', 'new-file.ts'), 'utf8')).toBe('export const created = true;\n');
  expect(existsSync(path.join(root, 'src', 'obsolete.ts'))).toBe(false);
});

test('supports patchText transport for short OpenCode-style payloads', () => {
  const root = makeTempDirectory();
  writeFileSync(path.join(root, 'example.txt'), 'before\n');
  const patchText = [
    '*** Begin Patch',
    '*** Update File: example.txt',
    '@@',
    '-before',
    '+after',
    '*** End Patch',
    '',
  ].join('\n');

  const result = runFs(root, ['apply-patch', '--patch-text', patchText]);

  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(readFileSync(path.join(root, 'example.txt'), 'utf8')).toBe('after\n');
});

test('supports move markers and dry-run does not mutate files', () => {
  const root = makeTempDirectory();
  mkdirSync(path.join(root, 'src'));
  writeFileSync(path.join(root, 'src', 'old.ts'), 'export const name = "old";\n');
  const patchText = [
    '*** Begin Patch',
    '*** Update File: src/old.ts',
    '*** Move to: src/new.ts',
    '@@',
    '-export const name = "old";',
    '+export const name = "new";',
    '*** End Patch',
    '',
  ].join('\n');

  const dryRun = runFs(root, ['apply-patch', '--patch-text', patchText, '--dry-run']);
  expect(dryRun.stderr).toBe('');
  expect(dryRun.status).toBe(0);
  expect(readFileSync(path.join(root, 'src', 'old.ts'), 'utf8')).toBe('export const name = "old";\n');
  expect(existsSync(path.join(root, 'src', 'new.ts'))).toBe(false);

  const result = runFs(root, ['apply-patch', '--patch-text', patchText]);
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(existsSync(path.join(root, 'src', 'old.ts'))).toBe(false);
  expect(readFileSync(path.join(root, 'src', 'new.ts'), 'utf8')).toBe('export const name = "new";\n');
});

test('rejects unsafe patch paths', () => {
  const root = makeTempDirectory();
  const patchPath = path.join(root, 'unsafe.patch');
  writeFileSync(patchPath, ['*** Begin Patch', '*** Add File: ../outside.txt', '+bad', '*** End Patch', ''].join('\n'));

  const result = runFs(root, ['apply-patch', '--patch-file', patchPath]);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('unsafe patch path');
});

test('does not partially mutate files when a later hunk fails', () => {
  const root = makeTempDirectory();
  writeFileSync(path.join(root, 'existing.txt'), 'stable\n');
  const patchText = [
    '*** Begin Patch',
    '*** Add File: created-before-failure.txt',
    '+must not exist after failure',
    '*** Update File: existing.txt',
    '@@',
    '-missing',
    '+changed',
    '*** End Patch',
    '',
  ].join('\n');

  const result = runFs(root, ['apply-patch', '--patch-text', patchText]);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('patch hunk did not match');
  expect(readFileSync(path.join(root, 'existing.txt'), 'utf8')).toBe('stable\n');
  expect(existsSync(path.join(root, 'created-before-failure.txt'))).toBe(false);
});
