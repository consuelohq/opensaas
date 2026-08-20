const { removeWorktree, runGit, runGitMaybe } = require('./git');

function restoreWorktreeAfterFailedMerge(repoRoot, worktreePath, branch, createdTemporaryWorktree) {
  if (createdTemporaryWorktree) {
    removeWorktree(repoRoot, worktreePath);
    return;
  }

  runGitMaybe(['-C', worktreePath, 'merge', '--abort'], { cwd: repoRoot });
  runGit(['-C', worktreePath, 'reset', '--hard', `origin/${branch}`], { cwd: repoRoot });
}

module.exports = { restoreWorktreeAfterFailedMerge };
