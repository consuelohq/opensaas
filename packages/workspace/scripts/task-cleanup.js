#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');

const DEFAULT_REPO = 'consuelohq/opensaas';

const { findOpenPullRequest, getToken } = require('./lib/github');
const {
  deleteLocalBranch,
  fetchOrigin,
  getCurrentBranch,
  getWorktreeForBranch,
  isBranchMerged,
  listWorktrees,
  pruneWorktrees,
  removeWorktree,
  runGit,
} = require('./lib/git');
const { resolveGitRoot } = require('./lib/paths');
const { isStreamBranchName, isTaskBranchName } = require('./lib/validation');
const { readTaskMeta } = require('./lib/task-meta');
const { readTaskSessionMetadata, terminateTaskTmuxSession } = require('./lib/task-session');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run task:cleanup -- [options]');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --preview              preview removals without deleting anything');
  writeStdout('  --merged               remove local task branches already merged into their stream or main');
  writeStdout('  --stale-days <n>       remove task worktrees older than n days');
  writeStdout('  --force                pass --force when removing worktrees and branches');
  writeStdout('  --keep <branch>        keep a branch even if it matches cleanup rules (repeatable)');
  writeStdout(`  --repo <owner/name>    github repository (default: ${DEFAULT_REPO})`);
  writeStdout('  --json                 output json');
  writeStdout('  --help                 show this help');
}

function parseArgs(argv) {
  const args = {
    repo: DEFAULT_REPO,
    keep: [],
    json: false,
    preview: false,
    merged: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const rawArgument = argv[index];

    if (!rawArgument.startsWith('--')) {
      throw new Error(`unexpected argument: ${rawArgument}`);
    }

    const [flag, inlineValue] = rawArgument.split('=', 2);
    const isBooleanFlag =
      flag === '--preview' ||
      flag === '--merged' ||
      flag === '--force' ||
      flag === '--json' ||
      flag === '--help';
    const value = inlineValue !== undefined ? inlineValue : isBooleanFlag ? undefined : argv[index + 1];

    if (!isBooleanFlag && (!value || value.startsWith('--'))) {
      throw new Error(`missing value for ${flag}`);
    }

    if (inlineValue === undefined && !isBooleanFlag) {
      index += 1;
    }

    switch (flag) {
      case '--preview':
        args.preview = true;
        break;
      case '--merged':
        args.merged = true;
        break;
      case '--stale-days':
        args.staleDays = Number.parseInt(value, 10);
        if (!Number.isFinite(args.staleDays) || args.staleDays < 0) {
          throw new Error('--stale-days must be a non-negative integer');
        }
        break;
      case '--force':
        args.force = true;
        break;
      case '--keep':
        args.keep.push(value);
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

  return args;
}

function getLocalBranches(repoRoot) {
  const output = runGit(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], { cwd: repoRoot });
  return output ? output.split('\n').filter(Boolean) : [];
}

function getWorktreeAgeDays(worktreePath) {
  const taskMeta = readTaskMeta(worktreePath);

  if (taskMeta && taskMeta.createdAt) {
    const createdAt = new Date(taskMeta.createdAt).getTime();
    if (Number.isFinite(createdAt)) {
      return (Date.now() - createdAt) / 86400000;
    }
  }

  const stats = fs.statSync(worktreePath);
  return (Date.now() - stats.mtimeMs) / 86400000;
}

async function getOpenPullRequest(token, repository, branch) {
  if (!token) {
    return null;
  }

  return findOpenPullRequest({
    token,
    repository,
    branch,
  });
}

function readTaskCleanupMetadata(worktreePath) {
  if (!worktreePath || !fs.existsSync(worktreePath)) {
    return [];
  }

  const records = [];
  const sessionMeta = readTaskSessionMetadata(worktreePath);
  if (sessionMeta) {
    records.push(sessionMeta);
  }

  const taskMeta = readTaskMeta(worktreePath);
  if (taskMeta) {
    records.push(taskMeta);
  }

  return records;
}

function recordTmuxCleanup(result, branch, cleanupResult) {
  const warnings = [...cleanupResult.warnings];
  if (cleanupResult.status === 'no-session-metadata') {
    warnings.push('no task tmux session metadata found');
  }

  result.tmuxSessions.push({
    branch,
    tmuxSession: cleanupResult.tmuxSession,
    status: cleanupResult.status,
    terminated: cleanupResult.terminated,
    dryRun: cleanupResult.dryRun,
    source: cleanupResult.source,
    taskBranch: cleanupResult.taskBranch,
    taskSession: cleanupResult.taskSession,
    warnings,
  });
}

function printResult(result, useJson) {
  if (useJson) {
    writeStdout(JSON.stringify(result, null, 2));
    return;
  }

  writeStdout(result.preview ? 'preview mode' : 'cleanup complete');
  if (result.removedWorktrees.length > 0) {
    writeStdout('removed worktrees:');
    for (const worktreePath of result.removedWorktrees) {
      writeStdout(`  - ${worktreePath}`);
    }
  }
  if (result.removedBranches.length > 0) {
    writeStdout('removed branches:');
    for (const branch of result.removedBranches) {
      writeStdout(`  - ${branch}`);
    }
  }
  if (result.tmuxSessions.length > 0) {
    writeStdout(result.preview ? 'tmux sessions to close:' : 'tmux sessions cleaned:');
    for (const session of result.tmuxSessions) {
      writeStdout(`  - ${session.branch}: ${session.tmuxSession} (${session.status})`);
    }
  }
  if (result.warnings.length > 0) {
    writeStdout('warnings:');
    for (const warning of result.warnings) {
      writeStdout(`  - ${warning}`);
    }
  }
  if (result.skipped.length > 0) {
    writeStdout('skipped:');
    for (const entry of result.skipped) {
      writeStdout(`  - ${entry.branch}: ${entry.reason}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const preview = args.preview || (!args.merged && args.staleDays === undefined);
  const repoRoot = resolveGitRoot(process.cwd());
  const currentWorktreePath = repoRoot;
  const currentBranch = getCurrentBranch(process.cwd());
  const token = (() => {
    try {
      return getToken();
    } catch {
      return null;
    }
  })();

  fetchOrigin(repoRoot);

  const localBranches = getLocalBranches(repoRoot);
  listWorktrees(repoRoot);
  const keepBranches = new Set([
    'main',
    currentBranch,
    ...args.keep,
    ...localBranches.filter((branch) => isStreamBranchName(branch)),
  ]);

  const result = {
    preview,
    removedWorktrees: [],
    removedBranches: [],
    tmuxSessions: [],
    warnings: [],
    keptBranches: Array.from(keepBranches).sort(),
    skipped: [],
  };

  for (const branch of localBranches) {
    if (!isTaskBranchName(branch)) {
      continue;
    }

    if (keepBranches.has(branch)) {
      continue;
    }

    const worktree = getWorktreeForBranch(repoRoot, branch);
    const worktreePath = worktree && worktree.path;

    if (worktreePath && path.resolve(worktreePath) === path.resolve(currentWorktreePath)) {
      result.skipped.push({ branch, reason: 'current worktree' });
      continue;
    }

    const orphan = Boolean(worktreePath) && !fs.existsSync(worktreePath);
    const stale =
      args.staleDays !== undefined &&
      Boolean(worktreePath) &&
      fs.existsSync(worktreePath) &&
      getWorktreeAgeDays(worktreePath) >= args.staleDays;
    const merged = args.merged && isBranchMerged(repoRoot, branch);

    if (!orphan && !stale && !merged) {
      continue;
    }

    if (!token) {
      result.skipped.push({ branch, reason: 'missing github token for open-pr check' });
      continue;
    }

    const openPullRequest = await getOpenPullRequest(token, args.repo, branch);
    if (openPullRequest) {
      result.skipped.push({ branch, reason: 'open pr' });
      continue;
    }

    const cleanupMetadata = readTaskCleanupMetadata(worktreePath);

    if (preview) {
      const tmuxCleanup = terminateTaskTmuxSession(cleanupMetadata, {
        branch,
        worktreePath,
        dryRun: true,
      });
      recordTmuxCleanup(result, branch, tmuxCleanup);

      if (worktreePath) {
        result.removedWorktrees.push(worktreePath);
      }
      result.removedBranches.push(branch);
      continue;
    }

    if (worktreePath) {
      const tmuxCleanup = terminateTaskTmuxSession(cleanupMetadata, {
        branch,
        worktreePath,
        warn: (message) => {
          result.warnings.push(`${branch}: ${message}`);
          writeStderr(`${branch}: ${message}`);
        },
      });
      recordTmuxCleanup(result, branch, tmuxCleanup);

      if (fs.existsSync(worktreePath)) {
        removeWorktree(repoRoot, worktreePath, args.force || stale || orphan);
      }
      result.removedWorktrees.push(worktreePath);
    }

    deleteLocalBranch(repoRoot, branch, true);
    result.removedBranches.push(branch);
  }

  pruneWorktrees(repoRoot);
  printResult(result, args.json);
}

main().catch((error) => {
  writeStderr(error instanceof Error ? error.message : 'unknown error');
  process.exit(1);
});
