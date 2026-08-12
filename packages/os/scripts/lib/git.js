const { execFileSync } = require('child_process');

function runGit(args, options = {}) {
  const cwd = options.cwd || process.cwd();
  const env = options.env ? { ...process.env, ...options.env } : process.env;
  return execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
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

function parseGitHubRepositoryFromRemote(remoteUrl) {
  const normalized = String(remoteUrl || '').trim().replace(/\.git$/i, '');
  const match = normalized.match(/github\.com(?::|\/)([^/:\s]+)\/([^/\s]+)$/i);
  return match ? `${match[1]}/${match[2]}` : null;
}

function githubGitAuthEnv(token) {
  const basic = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64');
  return {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.extraHeader',
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${basic}`,
    GIT_TERMINAL_PROMPT: '0',
  };
}

function resolveApiPushSyncTarget(repoRoot, branch, repository, token) {
  const originUrl = runGitMaybe(['remote', 'get-url', 'origin'], { cwd: repoRoot });
  const originRepository = parseGitHubRepositoryFromRemote(originUrl);
  if (originRepository && originRepository.toLowerCase() === String(repository).toLowerCase()) {
    return {
      remote: 'origin',
      trackingRef: `refs/remotes/origin/${branch}`,
      label: 'origin',
    };
  }

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(repository))) {
    throw new Error(`invalid GitHub repository for task push synchronization: ${repository}`);
  }
  const repositoryKey = String(repository).toLowerCase();

  return {
    remote: `https://github.com/${repository}.git`,
    trackingRef: `refs/consuelo/task-push/${repositoryKey}/${branch}`,
    label: String(repository),
    env: githubGitAuthEnv(token),
  };
}

function normalizeApiPushSyncTarget(branch, target = {}) {
  return {
    remote: target.remote || 'origin',
    trackingRef: target.trackingRef || `refs/remotes/origin/${branch}`,
    label: target.label || 'origin',
    env: target.env,
  };
}

function fetchApiPushBranch(repoRoot, branch, target) {
  runGit(['fetch', '--no-tags', target.remote, `refs/heads/${branch}:${target.trackingRef}`], {
    cwd: repoRoot,
    env: target.env,
  });
}

function captureStagedIndexState(repoRoot, baseSha) {
  const pathOutput = execFileSync('git', ['diff', '--cached', '--name-only', '-z', baseSha], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const paths = pathOutput.split('\0').filter(Boolean);
  return paths.map((filePath) => ({
    path: filePath,
    entries: execFileSync('git', ['ls-files', '--stage', '-z', '--', filePath], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }),
  }));
}

function restoreStagedIndexState(repoRoot, snapshot) {
  for (const entry of snapshot) {
    if (!entry.entries) {
      runGit(['update-index', '--force-remove', '--', entry.path], { cwd: repoRoot });
      continue;
    }
    execFileSync('git', ['update-index', '-z', '--index-info'], {
      cwd: repoRoot,
      encoding: 'utf8',
      input: entry.entries,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }
}

function assertApiPushBaseIsSynced(repoRoot, branch, expectedSha, targetOptions) {
  const currentBranch = getCurrentBranch(repoRoot);
  if (currentBranch !== branch) {
    throw new Error(`cannot prepare API push for ${branch}: checked out branch is ${currentBranch || '<detached>'}`);
  }

  const target = normalizeApiPushSyncTarget(branch, targetOptions);
  fetchApiPushBranch(repoRoot, branch, target);

  const localRef = `refs/heads/${branch}`;
  const remoteRef = target.trackingRef;
  if (!refExists(repoRoot, remoteRef)) {
    throw new Error(`${target.label}/${branch} does not exist; sync the task branch before running task:push`);
  }

  const localSha = getRefSha(repoRoot, localRef);
  const remoteSha = getRefSha(repoRoot, remoteRef);
  if (remoteSha !== expectedSha) {
    throw new Error(
      `cannot prepare API push for ${branch}: ${target.label} head changed while preparing the push (expected ${expectedSha.slice(0, 8)}, fetched ${remoteSha.slice(0, 8)}); retry task:push from the refreshed branch`,
    );
  }
  if (localSha !== expectedSha) {
    throw new Error(
      `local task branch is not synced with ${target.label}/${branch} (local ${localSha.slice(0, 8)} != remote ${remoteSha.slice(0, 8)}); sync the task worktree before running task:push`,
    );
  }

  return { branch, sha: expectedSha };
}

function synchronizeApiPushedTaskBranch(repoRoot, branch, previousSha, nextSha, targetOptions) {
  const currentBranch = getCurrentBranch(repoRoot);
  if (currentBranch !== branch) {
    throw new Error(`cannot synchronize API-pushed task branch ${branch}: checked out branch is ${currentBranch || '<detached>'}`);
  }
  const target = normalizeApiPushSyncTarget(branch, targetOptions);
  const localRef = `refs/heads/${branch}`;
  const remoteRef = target.trackingRef;
  const localSha = getRefSha(repoRoot, localRef);
  const remoteSha = getRefSha(repoRoot, remoteRef);
  if (localSha !== previousSha || remoteSha !== previousSha) {
    throw new Error(
      `cannot synchronize API-pushed task branch ${branch}: expected local and ${target.label} refs at ${previousSha.slice(0, 8)}, received local ${localSha.slice(0, 8)} and ${target.label} ${remoteSha.slice(0, 8)}`,
    );
  }

  // The commit was created through the GitHub API, so it does not exist in the
  // local object database yet. Fetch the exact task branch before moving any
  // local ref, and fail closed if the remote no longer points at the commit we
  // just created.
  fetchApiPushBranch(repoRoot, branch, target);
  const fetchedRemoteSha = getRefSha(repoRoot, remoteRef);
  if (fetchedRemoteSha !== nextSha) {
    throw new Error(
      `cannot synchronize API-pushed task branch ${branch}: expected fetched ${target.label} ref at ${nextSha.slice(0, 8)}, received ${fetchedRemoteSha.slice(0, 8)}`,
    );
  }

  // Reconcile the index to the API-created commit while preserving any staged
  // entries the caller had before task.push. A plain mixed reset would silently
  // unstage those entries.
  const stagedIndexState = captureStagedIndexState(repoRoot, previousSha);
  runGit(['reset', '--mixed', nextSha], { cwd: repoRoot });
  restoreStagedIndexState(repoRoot, stagedIndexState);

  const synchronizedLocal = getRefSha(repoRoot, localRef);
  const synchronizedRemote = getRefSha(repoRoot, remoteRef);
  if (synchronizedLocal !== nextSha || synchronizedRemote !== nextSha) {
    throw new Error(`failed to synchronize local refs after API push for ${branch}`);
  }
  return { branch, previousSha, sha: nextSha };
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
  assertApiPushBaseIsSynced,
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
  resolveApiPushSyncTarget,
  removeWorktree,
  runGit,
  runGitMaybe,
  setBranchUpstream,
  synchronizeApiPushedTaskBranch,
};
