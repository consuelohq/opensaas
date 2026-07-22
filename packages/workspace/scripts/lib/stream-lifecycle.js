function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function classifyLocalStream({
  branch,
  currentBranch = null,
  remoteExists,
  ahead,
  behind: _behind,
  worktreePaths = [],
  kept = false,
}) {
  const reasons = [];

  if (kept) {
    reasons.push('explicitly kept');
  }

  if (branch === currentBranch) {
    reasons.push('current branch');
  }

  if (worktreePaths.length > 0) {
    reasons.push('checked out in a worktree');
  }

  if (!remoteExists) {
    reasons.push('no origin backup');
  } else if (ahead === null || ahead === undefined) {
    reasons.push('unable to compare with origin');
  } else if (ahead > 0) {
    reasons.push(`${ahead} unique local ${pluralize(ahead, 'commit')}`);
  }

  return {
    removable: reasons.length === 0,
    reasons,
  };
}

function resolveRemoteStreamAction({ streamBranch, remoteExists, createStream }) {
  if (remoteExists) {
    return 'reuse';
  }

  if (createStream) {
    return 'create';
  }

  throw new Error(
    `remote stream ${streamBranch} does not exist. ` +
      'Choose an existing durable stream, or pass --create-stream to create this stream intentionally.',
  );
}

module.exports = {
  classifyLocalStream,
  resolveRemoteStreamAction,
};
