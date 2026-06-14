const fs = require('fs');
const path = require('path');

function pathExists(candidatePath) {
  return fs.existsSync(candidatePath);
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
    if (!pathExists(directory)) {
      return;
    }

    const entries = fs.readdirSync(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) {
        continue;
      }

      if (entry.name === 'node_modules') {
        found.push(path.join(directory, entry.name));
        continue;
      }

      if (entry.name.startsWith('.')) {
        continue;
      }

      visit(path.join(directory, entry.name));
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
    const target = path.join(worktreePath, relativePath);
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
