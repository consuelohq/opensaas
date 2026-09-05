const fs = require('fs');
const path = require('path');

const { removeWorktree, runGit, runGitMaybe } = require('./git');
const { toWorktreeDirectoryName } = require('./paths');

function removeStaleGeneratedSyncWorktree(repoRoot, worktreePath, branch, worktreeRoot) {
  const resolvedRoot = fs.realpathSync(worktreeRoot);
  const resolvedWorktree = fs.realpathSync(worktreePath);
  const generatedPrefix = `${toWorktreeDirectoryName(branch)}-sync-`;

  if (path.dirname(resolvedWorktree) !== resolvedRoot) return false;
  if (!path.basename(resolvedWorktree).startsWith(generatedPrefix)) return false;

  removeWorktree(repoRoot, worktreePath);
  return true;
}

function restoreWorktreeAfterFailedMerge(repoRoot, worktreePath, branch, createdTemporaryWorktree) {
  if (createdTemporaryWorktree) {
    removeWorktree(repoRoot, worktreePath);
    return;
  }

  runGitMaybe(['-C', worktreePath, 'merge', '--abort'], { cwd: repoRoot });
  runGit(['-C', worktreePath, 'reset', '--hard', `origin/${branch}`], { cwd: repoRoot });
}

module.exports = { removeStaleGeneratedSyncWorktree, restoreWorktreeAfterFailedMerge };
