import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';

import taskNodeModules from '../scripts/lib/task-node-modules.js';

const { findWorkspacePackageNodeModules, linkTaskWorktreeNodeModules } = taskNodeModules;

const cleanupPaths = [];

function makeTempDirectory(name) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), name));
  cleanupPaths.push(directory);
  return directory;
}

function mkdirp(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

afterEach(() => {
  while (cleanupPaths.length > 0) {
    fs.rmSync(cleanupPaths.pop(), { force: true, recursive: true });
  }
});

test('should link root and package node_modules when setting up a task worktree', () => {
  const repoRoot = makeTempDirectory('workspace-main-');
  const worktreePath = makeTempDirectory('workspace-task-');

  mkdirp(path.join(repoRoot, 'node_modules', '.bin'));
  mkdirp(path.join(repoRoot, 'packages', 'workspace', 'node_modules'));
  mkdirp(path.join(repoRoot, 'packages', 'twenty-server', 'node_modules', '@nestjs', 'common'));
  mkdirp(path.join(repoRoot, 'packages', 'without-task-copy', 'node_modules'));

  mkdirp(path.join(worktreePath, 'packages', 'workspace'));
  mkdirp(path.join(worktreePath, 'packages', 'twenty-server'));

  const messages = [];
  const result = linkTaskWorktreeNodeModules({
    repoRoot,
    worktreePath,
    writeStderr: (message) => messages.push(message),
  });

  expect(findWorkspacePackageNodeModules(repoRoot).map((entry) => path.relative(repoRoot, entry))).toEqual([
    'packages/twenty-server/node_modules',
    'packages/without-task-copy/node_modules',
    'packages/workspace/node_modules',
  ]);

  expect(fs.lstatSync(path.join(worktreePath, 'node_modules')).isSymbolicLink()).toBe(true);
  expect(fs.realpathSync(path.join(worktreePath, 'node_modules'))).toBe(
    fs.realpathSync(path.join(repoRoot, 'node_modules')),
  );
  expect(fs.lstatSync(path.join(worktreePath, 'packages', 'twenty-server', 'node_modules')).isSymbolicLink()).toBe(true);
  expect(fs.realpathSync(path.join(worktreePath, 'packages', 'twenty-server', 'node_modules'))).toBe(
    fs.realpathSync(path.join(repoRoot, 'packages', 'twenty-server', 'node_modules')),
  );
  expect(fs.existsSync(path.join(worktreePath, 'packages', 'without-task-copy', 'node_modules'))).toBe(false);
  expect(fs.lstatSync(path.join(worktreePath, 'packages', 'workspace', 'node_modules')).isSymbolicLink()).toBe(true);
  expect(fs.realpathSync(path.join(worktreePath, 'packages', 'workspace', 'node_modules'))).toBe(
    fs.realpathSync(path.join(repoRoot, 'packages', 'workspace', 'node_modules')),
  );
  expect(result.linked.map((entry) => entry.path)).toEqual([
    'node_modules',
    'packages/twenty-server/node_modules',
    'packages/workspace/node_modules',
  ]);
  expect(messages).toEqual([
    'symlinked node_modules from main worktree',
    'symlinked packages/twenty-server/node_modules from main worktree',
    'symlinked packages/workspace/node_modules from main worktree',
  ]);
});

test('should skip linked package directories when discovering package node_modules', () => {
  const repoRoot = makeTempDirectory('workspace-main-');
  const externalPackage = makeTempDirectory('workspace-external-package-');
  mkdirp(path.join(repoRoot, 'packages'));
  mkdirp(path.join(repoRoot, 'packages', 'real-package', 'node_modules'));
  mkdirp(path.join(externalPackage, 'node_modules'));
  fs['symlink' + 'Sync'](externalPackage, path.join(repoRoot, 'packages', 'linked-package'), 'dir');
  expect(findWorkspacePackageNodeModules(repoRoot).map((entry) => path.relative(repoRoot, entry))).toEqual(['packages/real-package/node_modules']);
});
