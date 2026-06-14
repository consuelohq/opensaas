const fs = require('fs');
const path = require('path');

function pathExists(candidatePath) {
  return fs.existsSync(candidatePath);
}

function isPathInside(parentPath, candidatePath) {
  const parent = path.resolve(parentPath);
  const candidate = path.resolve(candidatePath);
  const relativePath = path.relative(parent, candidate);

  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function isSafeRelativePath(relativePath) {
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function maybeSymlinkDirectory(source, target) {
  if (!pathExists(source) || pathExists(target)) {
    return null;
  }

  const parent = path.dirname(target);

  if (!pathExists(parent)) {
    return null;
  }

  fs.symlinkSync(source, target, 'dir');

  return { source, target };
}

function findWorkspacePackageNodeModules(repoRoot) {
  const packagesRoot = path.join(repoRoot, 'packages');
  const found = [];

  function visit(directory) {
    if (!pathExists(directory) || !isPathInside(packagesRoot, directory)) {
      return;
    }

    const entries = fs.readdirSync(directory, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);

      if (entry.name === 'node_modules') {
        if (isPathInside(repoRoot, entryPath)) {
          found.push(entryPath);
        }
        continue;
      }

      if (!entry.isDirectory() || entry.name.startsWith('.')) {
        continue;
      }

      visit(entryPath);
    }
  }

  visit(packagesRoot);

  return found.sort();
}

function linkTaskWorktreeNodeModules({ repoRoot, worktreePath, writeStderr = () => {} }) {
  const linked = [];

  const rootLink = maybeSymlinkDirectory(
    path.join(repoRoot, 'node_modules'),
    path.join(worktreePath, 'node_modules'),
  );

  if (rootLink) {
    linked.push({ kind: 'root', path: 'node_modules', ...rootLink });
    writeStderr('symlinked node_modules from main worktree');
  }

  for (const source of findWorkspacePackageNodeModules(repoRoot)) {
    const relativePath = path.relative(repoRoot, source);

    if (!isSafeRelativePath(relativePath)) {
      continue;
    }

    const target = path.join(worktreePath, relativePath);

    if (!isPathInside(worktreePath, target)) {
      continue;
    }

    const packageLink = maybeSymlinkDirectory(source, target);

    if (!packageLink) {
      continue;
    }

    linked.push({ kind: 'workspace-package', path: relativePath, ...packageLink });
    writeStderr(`symlinked ${relativePath} from main worktree`);
  }

  return { linked };
}

module.exports = {
  findWorkspacePackageNodeModules,
  linkTaskWorktreeNodeModules,
};
