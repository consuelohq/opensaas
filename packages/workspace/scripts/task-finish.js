#!/usr/bin/env bun

const path = require('path');

const { findPullRequest, getToken } = require('./lib/github');
const {
  branchExistsLocal,
  deleteLocalBranch,
  fetchOrigin,
  getCurrentBranch,
  getWorktreeForBranch,
  isAncestor,
  refExists,
  removeWorktree,
} = require('./lib/git');
const { DEFAULT_REPO, resolveGitRoot } = require('./lib/paths');
const { resolvePrRefNumber } = require('./lib/pr-ref');
const { findTaskMeta } = require('./lib/task-meta');
const { findActiveTaskResult } = require('./lib/task-selection');
const {
  assertStreamBranchName,
  assertTaskBranchName,
  getDefaultStreamBranch,
  isStreamBranchName,
} = require('./lib/validation');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run task:finish -- [options]');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --area <name>          select task by area');
  writeStdout('  --branch <name>        select exact task branch');
  writeStdout('  --pr <number-or-url>          select task by pr number');
  writeStdout('  --stream <branch>      stream target to verify merge against (default: infer from task metadata or area)');
  writeStdout(`  --repo <owner/name>    github repository (default: ${DEFAULT_REPO})`);
  writeStdout('  --json                 output json');
  writeStdout('  --help                 show this help');
}

function parseArgs(argv) {
  const args = {
    repo: DEFAULT_REPO,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const rawArgument = argv[index];

    if (!rawArgument.startsWith('--')) {
      throw new Error(`unexpected argument: ${rawArgument}`);
    }

    const [flag, inlineValue] = rawArgument.split('=', 2);
    const isBooleanFlag = flag === '--json' || flag === '--help';
    const value = inlineValue !== undefined ? inlineValue : isBooleanFlag ? undefined : argv[index + 1];

    if (!isBooleanFlag && (!value || value.startsWith('--'))) {
      throw new Error(`missing value for ${flag}`);
    }

    if (inlineValue === undefined && !isBooleanFlag) {
      index += 1;
    }

    switch (flag) {
      case '--area':
        args.area = value;
        break;
      case '--branch':
        args.branch = value;
        break;
      case '--pr':
      case '--github':
        args.prNumber = resolvePrRefNumber(value);
        break;
      case '--stream':
        args.stream = value;
        break;
      case '--repo':
        args.repo = value;
        break;
      case '--json':
        args.json = true;
        break;
      case '--help':
        args.help = true;
        break;
      default:
        throw new Error(`unknown flag: ${flag}`);
    }
  }

  if (args.prNumber !== undefined && !Number.isInteger(args.prNumber)) {
    throw new Error('invalid --pr/--github value');
  }

  return args;
}

function hasExplicitTaskSelector(args) {
  return Boolean(args.area || args.branch || args.prNumber !== undefined);
}

function getSelectedTaskContext(args) {
  const repoRoot = resolveGitRoot(process.cwd());
  const selected = findActiveTaskResult(repoRoot, {
    area: args.area || null,
    branch: args.branch || null,
    prNumber: args.prNumber === undefined ? null : args.prNumber,
  });

  if (selected.error) {
    throw new Error(selected.error);
  }

  const parsedTaskBranch = assertTaskBranchName(selected.task.meta.taskBranch);

  return {
    repoRoot,
    taskMeta: { data: selected.task.meta, dir: selected.task.worktreePath },
    branch: selected.task.meta.taskBranch,
    area: parsedTaskBranch.area,
  };
}

function getTaskContext(args) {
  if (hasExplicitTaskSelector(args)) {
    return getSelectedTaskContext(args);
  }

  const repoRoot = resolveGitRoot(process.cwd());
  const taskMeta = findTaskMeta(process.cwd());
  const currentBranch = getCurrentBranch(process.cwd());
  const branch = args.branch || (taskMeta && taskMeta.data.taskBranch) || currentBranch;

  if (!branch) {
    throw new Error('unable to determine the task branch');
  }

  const parsedTaskBranch = assertTaskBranchName(branch);

  return {
    repoRoot,
    taskMeta,
    branch,
    area: parsedTaskBranch.area,
  };
}

function resolveStreamBranch(args, context, pullRequest) {
  const candidates = [
    args.stream,
    context.taskMeta && context.taskMeta.data.stream,
    context.taskMeta && context.taskMeta.data.baseBranch,
    pullRequest && isStreamBranchName(pullRequest.base.ref) ? pullRequest.base.ref : null,
    getDefaultStreamBranch(context.area),
  ].filter(Boolean);

  const streamBranch = candidates[0];
  assertStreamBranchName(streamBranch, context.area);
  return streamBranch;
}

function resolveExistingRef(repoRoot, candidates) {
  for (const candidate of candidates) {
    if (refExists(repoRoot, candidate)) {
      return candidate;
    }
  }

  return null;
}

function ensureOutsideWorktree(repoRoot, worktreePath) {
  const currentDirectory = path.resolve(process.cwd());
  const resolvedWorktreePath = path.resolve(worktreePath);
  const insideWorktree =
    currentDirectory === resolvedWorktreePath ||
    currentDirectory.startsWith(`${resolvedWorktreePath}${path.sep}`);

  if (insideWorktree) {
    process.chdir(repoRoot);
  }
}

function printResult(result, useJson) {
  if (useJson) {
    writeStdout(JSON.stringify(result, null, 2));
    return;
  }

  writeStdout(`finished: ${result.branch}`);
  writeStdout(`stream: ${result.stream}`);
  writeStdout(`pr: #${result.prNumber} (${result.prState})`);

  if (result.removedWorktree) {
    writeStdout(`removed worktree: ${result.removedWorktree}`);
  } else {
    writeStdout('removed worktree: none');
  }

  writeStdout(result.deletedLocalBranch ? 'deleted local branch' : 'local branch already absent');
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const context = getTaskContext(args);
  const token = getToken();

  fetchOrigin(context.repoRoot);

  const pullRequest = await findPullRequest({
    token,
    repository: args.repo,
    branch: context.branch,
    state: 'all',
  });

  if (!pullRequest) {
    throw new Error(`no github pull request found for ${context.branch}`);
  }

  const streamBranch = resolveStreamBranch(args, context, pullRequest);
  const taskRef = resolveExistingRef(context.repoRoot, [
    `refs/heads/${context.branch}`,
    `refs/remotes/origin/${context.branch}`,
  ]);
  const streamRef = resolveExistingRef(context.repoRoot, [
    `refs/remotes/origin/${streamBranch}`,
    `refs/heads/${streamBranch}`,
  ]);

  if (!taskRef) {
    throw new Error(`unable to resolve a local or remote ref for ${context.branch}`);
  }

  if (!streamRef) {
    throw new Error(`unable to resolve a local or remote ref for ${streamBranch}`);
  }

  if (!isAncestor(context.repoRoot, taskRef, streamRef)) {
    throw new Error(`${context.branch} is not merged into ${streamBranch}`);
  }

  const worktree = getWorktreeForBranch(context.repoRoot, context.branch);
  let removedWorktree = null;

  if (worktree) {
    ensureOutsideWorktree(context.repoRoot, worktree.path);
    removeWorktree(context.repoRoot, worktree.path);
    removedWorktree = worktree.path;
  }

  let deletedLocalBranch = false;

  if (branchExistsLocal(context.repoRoot, context.branch)) {
    deleteLocalBranch(context.repoRoot, context.branch);
    deletedLocalBranch = true;
  }

  printResult(
    {
      branch: context.branch,
      stream: streamBranch,
      prNumber: pullRequest.number,
      prUrl: pullRequest.html_url,
      prState: pullRequest.state,
      mergedAt: pullRequest.merged_at,
      removedWorktree,
      deletedLocalBranch,
    },
    args.json,
  );
  } finally {}
}

main().catch((error) => {
  writeStderr(error instanceof Error ? error.message : 'unknown error');
  process.exit(1);
});
