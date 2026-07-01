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

function expectNoFsPatchTool(toolNames: string[]) {
  expect(toolNames).toContain('fs.apply_patch');
  expect(toolNames).not.toContain('fs.patch');
  expect(toolNames).not.toContain('fs.applyPatch');
}

afterEach(() => {
  while (cleanupPaths.length > 0) {
    rmSync(cleanupPaths.pop()!, { force: true, recursive: true });
  }
});

test('should expose only apply_patch when reading workspace tool manifest', () => {
  const manifest = readJson('packages/workspace/tooling/tool-manifest.json') as Array<{
    name: string;
    methodPath?: string[];
    command?: { subcommand?: string };
  }>;
  const toolNames = manifest.map((entry) => entry.name);
  const applyPatch = manifest.find((entry) => entry.name === 'fs.apply_patch');

  expectNoFsPatchTool(toolNames);
  expect(applyPatch?.methodPath).toEqual(['fs', 'apply_patch']);
  expect(applyPatch?.command?.subcommand).toBe('apply-patch');
});

test('should expose only apply_patch when reading OS manifests', () => {
  const devManifest = readJson('packages/os/tooling/dev-tool-manifest.json') as Array<{ name: string }>;
  const coreManifest = readJson('packages/os/manifests/core.manifest.json') as { tools: Array<{ name: string; definition?: { name?: string } }> };

  expectNoFsPatchTool(devManifest.map((entry) => entry.name));
  expectNoFsPatchTool(coreManifest.tools.map((entry) => entry.name));
  expect(coreManifest.tools.find((entry) => entry.name === 'fs.apply_patch')?.definition?.name).toBe('fs.apply_patch');
});

test('should expose only apply_patch when reading generated workspace surfaces', () => {
  const generatedTypes = readFileSync(path.join(repoRoot, 'packages/workspace/src/generated/workspace.d.ts'), 'utf8');
  const generatedTools = readFileSync(path.join(repoRoot, 'packages/workspace/TOOLS.md'), 'utf8');
  const workspaceScripts = readFileSync(path.join(repoRoot, 'packages/workspace/SCRIPTS.md'), 'utf8');
  const osScripts = readFileSync(path.join(repoRoot, 'packages/os/SCRIPTS.md'), 'utf8');

  expect(generatedTypes).toContain('apply_patch');
  expect(generatedTypes).not.toContain('\n    patch: (input');
  expect(generatedTypes).not.toContain('applyPatch');
  expect(generatedTools).toContain('workspace.fs.apply_patch');
  expect(generatedTools).not.toContain('workspace.fs.patch');
  expect(generatedTools).not.toContain('| null>>');
  expect(workspaceScripts).toContain('**apply_patch**');
  expect(workspaceScripts).not.toContain('**patch**');
  expect(osScripts).toContain('**apply_patch**');
  expect(osScripts).not.toContain('**patch**');
});

test('should fail loudly without mutating when stale patch command is used', () => {
  const root = makeTempDirectory();
  writeFileSync(path.join(root, 'example.txt'), 'before\n');

  const result = runFs(root, ['patch', 'example.txt', '--from', '1', '--to', '1', '--content', 'after']);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('fs.patch has been removed');
  expect(result.stderr).toContain('apply-patch');
  expect(readFileSync(path.join(root, 'example.txt'), 'utf8')).toBe('before\n');
});

test('should apply anchored patch file when patch contains update add and delete operations', () => {
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
  expect(result.stdout).toContain('operations: 3');
  expect(result.stdout).toContain('writes: 2');
  expect(result.stdout).toContain('deletes: 1');
  expect(readFileSync(path.join(root, 'src', 'example.ts'), 'utf8')).toBe(
    ['export const value = 1;', 'export const keep = false;', 'export const added = "yes";', ''].join('\n'),
  );
  expect(readFileSync(path.join(root, 'src', 'new-file.ts'), 'utf8')).toBe('export const created = true;\n');
  expect(existsSync(path.join(root, 'src', 'obsolete.ts'))).toBe(false);
});

test('should support patchText transport when payload is short', () => {
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

test('should support stdin transport when payload is multiline', () => {
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

  const result = runFs(root, ['apply-patch', '--stdin'], patchText);

  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(readFileSync(path.join(root, 'example.txt'), 'utf8')).toBe('after\n');
});

test('should support move markers and dry-run when applying patch text', () => {
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
  expect(dryRun.stdout).toContain('(dry run');
  expect(readFileSync(path.join(root, 'src', 'old.ts'), 'utf8')).toBe('export const name = "old";\n');
  expect(existsSync(path.join(root, 'src', 'new.ts'))).toBe(false);

  const result = runFs(root, ['apply-patch', '--patch-text', patchText]);
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(existsSync(path.join(root, 'src', 'old.ts'))).toBe(false);
  expect(readFileSync(path.join(root, 'src', 'new.ts'), 'utf8')).toBe('export const name = "new";\n');
});

test('should reject unsafe patch paths when patch escapes worktree', () => {
  const root = makeTempDirectory();
  const patchPath = path.join(root, 'unsafe.patch');
  writeFileSync(patchPath, ['*** Begin Patch', '*** Add File: ../outside.txt', '+bad', '*** End Patch', ''].join('\n'));

  const result = runFs(root, ['apply-patch', '--patch-file', patchPath]);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('unsafe patch path');
});

test('should reject conflicting operations when paths resolve to the same file', () => {
  const root = makeTempDirectory();
  mkdirSync(path.join(root, 'src'));
  writeFileSync(path.join(root, 'src', 'example.txt'), 'one\n');
  const patchText = [
    '*** Begin Patch',
    '*** Update File: src/example.txt',
    '@@',
    '-one',
    '+two',
    '*** Delete File: ./src/example.txt',
    '*** End Patch',
    '',
  ].join('\n');

  const result = runFs(root, ['apply-patch', '--patch-text', patchText]);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('conflicting patch operations');
  expect(readFileSync(path.join(root, 'src', 'example.txt'), 'utf8')).toBe('one\n');
});

test('should not partially mutate files when a later hunk fails', () => {
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

test('should keep move source when destination write fails', () => {
  const root = makeTempDirectory();
  mkdirSync(path.join(root, 'src'));
  mkdirSync(path.join(root, 'blocked'));
  writeFileSync(path.join(root, 'src', 'old.txt'), 'old\n');
  writeFileSync(path.join(root, 'blocked', 'new.txt'), 'already here\n');
  const patchText = [
    '*** Begin Patch',
    '*** Update File: src/old.txt',
    '*** Move to: blocked/new.txt/child.txt',
    '@@',
    '-old',
    '+new',
    '*** End Patch',
    '',
  ].join('\n');

  const result = runFs(root, ['apply-patch', '--patch-text', patchText]);

  expect(result.status).not.toBe(0);
  expect(readFileSync(path.join(root, 'src', 'old.txt'), 'utf8')).toBe('old\n');
  expect(readFileSync(path.join(root, 'blocked', 'new.txt'), 'utf8')).toBe('already here\n');
});
