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

function realPathOrNull(candidatePath) {
  try {
    return fs.realpathSync(candidatePath);
  } catch {
    return null;
  }
}

function findWorkspacePackageNodeModules(repoRoot) {
  const packagesRoot = path.join(repoRoot, 'packages');
  const resolvedRepoRoot = realPathOrNull(repoRoot) ?? path.resolve(repoRoot);
  const resolvedPackagesRoot = realPathOrNull(packagesRoot) ?? path.resolve(packagesRoot);
  const found = [];

  function visit(directory) {
    const resolvedDirectory = realPathOrNull(directory);
    if (!pathExists(directory) || !resolvedDirectory || !isPathInside(resolvedPackagesRoot, resolvedDirectory)) {
      return;
    }

    const entries = fs.readdirSync(directory, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);

      if (entry.name === 'node_modules') {
        const resolvedEntry = realPathOrNull(entryPath);
        if (resolvedEntry && isPathInside(resolvedRepoRoot, resolvedEntry)) {
          found.push(entryPath);
        }
        continue;
      }

      if (entry.isSymbolicLink()) {
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
  const resolvedRepoRoot = realPathOrNull(repoRoot) ?? path.resolve(repoRoot);
  const resolvedWorktreePath = path.resolve(worktreePath);

  const rootLink = maybeSymlinkDirectory(
    path.join(repoRoot, 'node_modules'),
    path.join(worktreePath, 'node_modules'),
  );

  if (rootLink) {
    linked.push({ kind: 'root', path: 'node_modules', ...rootLink });
    writeStderr('symlinked node_modules from main worktree');
  }

  for (const source of findWorkspacePackageNodeModules(repoRoot)) {
    const resolvedSource = realPathOrNull(source) ?? path.resolve(source);
    const relativePath = path.relative(resolvedRepoRoot, resolvedSource);

    if (!isSafeRelativePath(relativePath)) {
      continue;
    }

    const target = path.join(worktreePath, relativePath);

    if (!isPathInside(resolvedWorktreePath, target)) {
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
