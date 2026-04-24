const { execFileSync } = require('child_process');

function runGit(args, options = {}) {
  const cwd = options.cwd || process.cwd();
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function runGitMaybe(args, options = {}) {
  try {
    return runGit(args, options);
  } catch {
    return null;
  }
}

function fetchOrigin(repoRoot) {
  runGit(['fetch', 'origin', '--prune'], { cwd: repoRoot });
}

function getCurrentBranch(cwd) {
  return runGit(['branch', '--show-current'], { cwd });
}

function refExists(repoRoot, ref) {
  return runGitMaybe(['rev-parse', '--verify', ref], { cwd: repoRoot }) !== null;
}

function getRefSha(repoRoot, ref) {
  const sha = runGitMaybe(['rev-parse', ref], { cwd: repoRoot });
  if (!sha) throw new Error(`ref not found: ${ref}`);
  return sha;
}

function branchExistsLocal(repoRoot, branch) {
  return refExists(repoRoot, `refs/heads/${branch}`);
}

function createOrResetLocalBranch(repoRoot, branch, startPoint) {
  if (branchExistsLocal(repoRoot, branch)) {
    runGit(['branch', '-f', branch, startPoint], { cwd: repoRoot });
  } else {
    runGit(['branch', branch, startPoint], { cwd: repoRoot });
  }
}

function setBranchUpstream(repoRoot, branch, upstream) {
  runGit(['branch', `--set-upstream-to=${upstream}`, branch], { cwd: repoRoot });
}

function deleteLocalBranch(repoRoot, branch) {
  runGit(['branch', '-D', branch], { cwd: repoRoot });
}

function listWorktrees(repoRoot) {
  const output = runGit(['worktree', 'list', '--porcelain'], { cwd: repoRoot });
  const worktrees = [];
  let current = {};

  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) worktrees.push(current);
      current = { path: line.slice('worktree '.length) };
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length);
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace('refs/heads/', '');
    } else if (line === 'detached') {
      current.detached = true;
    }
  }

  if (current.path) worktrees.push(current);
  return worktrees;
}

function getWorktreeForBranch(repoRoot, branch) {
  const worktrees = listWorktrees(repoRoot);
  return worktrees.find((wt) => wt.branch === branch) || null;
}

function createWorktree(repoRoot, worktreePath, branch) {
  runGit(['worktree', 'add', worktreePath, branch], { cwd: repoRoot });
}

function removeWorktree(repoRoot, worktreePath) {
  runGit(['worktree', 'remove', worktreePath, '--force'], { cwd: repoRoot });
}

function pruneWorktrees(repoRoot) {
  runGit(['worktree', 'prune'], { cwd: repoRoot });
}

function ensureWorktreeClean(worktreePath, label) {
  const status = runGit(['-C', worktreePath, 'status', '--porcelain'], { cwd: worktreePath });
  if (status) {
    throw new Error(`${label || worktreePath} has uncommitted changes:\n${status}`);
  }
}

function isAncestor(repoRoot, ancestor, descendant) {
  return runGitMaybe(['merge-base', '--is-ancestor', ancestor, descendant], { cwd: repoRoot }) !== null;
}

function isBranchMerged(repoRoot, branch, into) {
  return isAncestor(repoRoot, `refs/heads/${branch}`, into);
}

function getTrackedChanges(repoRoot) {
  // use execFileSync directly — runGit trims leading spaces which breaks porcelain parsing.
  // exclude node_modules because task:start symlinks it into worktrees for local checks.
  const output = execFileSync('git', [
    '-c',
    'core.quotePath=false',
    'status',
    '--porcelain',
    '-z',
    '-uall',
    '--',
    '.',
    ':!node_modules',
  ], {
    cwd: repoRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (!output || !output.trim()) return [];

  return output.split('\0').filter(Boolean).map((entry) => {
    const status = entry.slice(0, 2).trim();
    let filePath = entry.slice(3);

    if ((status.startsWith('R') || status.startsWith('C')) && filePath.includes(' -> ')) {
      filePath = filePath.split(' -> ').pop();
    }

    return {
      path: filePath,
      status,
      deleted: status === 'D',
    };
  }).filter((change) => change.path !== 'node_modules' && !change.path.startsWith('node_modules/'));
}

module.exports = {
  branchExistsLocal,
  createOrResetLocalBranch,
  createWorktree,
  deleteLocalBranch,
  ensureWorktreeClean,
  fetchOrigin,
  getCurrentBranch,
  getRefSha,
  getTrackedChanges,
  getWorktreeForBranch,
  isAncestor,
  isBranchMerged,
  listWorktrees,
  pruneWorktrees,
  refExists,
  removeWorktree,
  runGit,
  runGitMaybe,
  setBranchUpstream,
};
