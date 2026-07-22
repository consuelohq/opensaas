#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  createOrResetLocalBranch,
  createWorktree,
  ensureWorktreeClean,
  fetchOrigin,
  getWorktreeForBranch,
  pruneWorktrees,
  refExists,
  removeWorktree,
  runGit,
  setBranchUpstream,
} = require('./lib/git');
const {
  DEFAULT_MAIN_BRANCH,
  getWorktreeRoot,
  resolveGitRoot,
  toWorktreeDirectoryName,
} = require('./lib/paths');
const { assertStreamBranchName, getDefaultStreamBranch, normalizeArea } = require('./lib/validation');
const { isOnlyTaskMetadataConflict, resolveTaskMetadataConflicts } = require('./lib/task-meta');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run stream:sync -- --area <area> [options]');
  writeStdout('');
  writeStdout('required:');
  writeStdout('  --area <value>         stream area, for example dialer');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --stream <branch>      stream branch (default: stream/<area>)');
  writeStdout('  --json                 output json');
  writeStdout('  --help                 show this help');
}

function parseArgs(argv) {
  const args = {
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
      case '--stream':
        args.stream = value;
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

function createTemporaryStreamWorktree(repoRoot, streamBranch) {
  const worktreeRoot = getWorktreeRoot();
  fs.mkdirSync(worktreeRoot, { recursive: true });
  const worktreePath = fs.mkdtempSync(path.join(worktreeRoot, `${toWorktreeDirectoryName(streamBranch)}-sync-`));
  createWorktree(repoRoot, worktreePath, streamBranch);
  return worktreePath;
}

function runMerge(worktreePath, mainBranch) {
  return spawnSync('git', ['-C', worktreePath, 'merge', '--no-ff', '--no-edit', `origin/${mainBranch}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function getConflictFiles(repoRoot, worktreePath) {
  const output = runGit(['-C', worktreePath, 'diff', '--name-only', '--diff-filter=U'], { cwd: repoRoot });
  return output ? output.split('\n').filter(Boolean) : [];
}

function parseJsonOutput(output) {
  try {
    return JSON.parse(output.trim());
  } catch {
    // fall through to heuristic extraction for noisy stdout.
  }

  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(output.slice(start, end + 1));
  } catch {
    return null;
  }
}

function runStreamChecks(worktreePath) {
  const verifyBase = `origin/${DEFAULT_MAIN_BRANCH}`;
  const command = `bun run verify -- --base ${verifyBase} --debug-skip-review --no-stamp --db-warn-only --json`;
  const result = spawnSync('bun', [
    'run',
    'verify',
    '--',
    '--base',
    verifyBase,
    '--debug-skip-review',
    '--no-stamp',
    '--db-warn-only',
    '--json',
  ], {
    cwd: worktreePath,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    skipped: false,
    command,
    status: result.status === 0 ? 'pass' : 'fail',
    exitCode: result.status,
    data: parseJsonOutput(result.stdout || ''),
    stderr: result.stderr || '',
  };
}

function pushStreamBranch(repoRoot, worktreePath, streamBranch, checks) {
  if (!checks || checks.status !== 'pass') {
    return false;
  }

  runGit(['-C', worktreePath, 'push', 'origin', streamBranch], { cwd: repoRoot });
  return true;
}

function printResult(result, useJson) {
  if (useJson) {
    writeStdout(JSON.stringify(result, null, 2));
    return;
  }

  writeStdout(`stream: ${result.stream}`);
  writeStdout(`status: ${result.status}`);
  writeStdout(`worktree: ${result.worktreePath}`);

  if (result.status === 'conflict' && result.conflictFiles.length > 0) {
    writeStdout('conflicts:');
    for (const filePath of result.conflictFiles) {
      writeStdout(`  - ${filePath}`);
    }
  }

  if (result.checks && result.checks.skipped) {
    writeStdout(`checks: skipped (${result.checks.reason})`);
  } else if (result.checks) {
    writeStdout(`checks: ${result.checks.status} (${result.checks.command})`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.area) {
    throw new Error('missing required --area');
  }

  const area = normalizeArea(args.area);
  const streamBranch = args.stream || getDefaultStreamBranch(area);
  const repoRoot = resolveGitRoot(process.cwd());

  assertStreamBranchName(streamBranch, area);
  fetchOrigin(repoRoot);

  if (!refExists(repoRoot, `refs/remotes/origin/${DEFAULT_MAIN_BRANCH}`)) {
    throw new Error(`origin/${DEFAULT_MAIN_BRANCH} is missing`);
  }

  if (!refExists(repoRoot, `refs/remotes/origin/${streamBranch}`)) {
    throw new Error(`origin/${streamBranch} is missing`);
  }
  pruneWorktrees(repoRoot);

  const existingWorktree = getWorktreeForBranch(repoRoot, streamBranch);

  if (!existingWorktree) {
    createOrResetLocalBranch(repoRoot, streamBranch, `origin/${streamBranch}`);
  }

  try {
    setBranchUpstream(repoRoot, streamBranch, `origin/${streamBranch}`);
  } catch {
    // ignore upstream wiring failures on older local setups
  }

  const worktreePath = existingWorktree ? existingWorktree.path : createTemporaryStreamWorktree(repoRoot, streamBranch);
  const createdTemporaryWorktree = !existingWorktree;

  ensureWorktreeClean(worktreePath, `${streamBranch} worktree`);
  runGit(['-C', worktreePath, 'reset', '--hard', `origin/${streamBranch}`], { cwd: repoRoot });

  const mergeResult = runMerge(worktreePath, DEFAULT_MAIN_BRANCH);
  const mergeOutput = [mergeResult.stdout, mergeResult.stderr].filter(Boolean).join('\n').trim();

  if (mergeResult.status === 0) {
    let checks;
    let pushed = false;
    try {
      checks = runStreamChecks(worktreePath);
      pushed = pushStreamBranch(repoRoot, worktreePath, streamBranch, checks);
    } finally {
      if (createdTemporaryWorktree) {
        removeWorktree(repoRoot, worktreePath, true);
      }
    }

    printResult(
      {
        stream: streamBranch,
        status: 'success',
        worktreePath,
        temporaryWorktree: createdTemporaryWorktree,
        mergeOutput,
        conflictFiles: [],
        checks,
        pushed,
      },
      args.json,
    );
    return;
  }

  const conflictFiles = getConflictFiles(repoRoot, worktreePath);

  if (conflictFiles.length === 0) {
    throw new Error(mergeOutput || `merge failed for ${streamBranch}`);
  }

  if (isOnlyTaskMetadataConflict(conflictFiles)) {
    const resolution = resolveTaskMetadataConflicts(worktreePath, conflictFiles, {
      currentBranch: streamBranch,
    });

    if (resolution.resolved) {
      let checks;
      let pushed = false;
      try {
        runGit(['-C', worktreePath, 'commit', '--no-edit'], { cwd: repoRoot });
        checks = runStreamChecks(worktreePath);
        pushed = pushStreamBranch(repoRoot, worktreePath, streamBranch, checks);
      } finally {
        if (createdTemporaryWorktree) {
          removeWorktree(repoRoot, worktreePath, true);
        }
      }

      printResult(
        {
          stream: streamBranch,
          status: 'success',
          worktreePath,
          temporaryWorktree: createdTemporaryWorktree,
          mergeOutput,
          conflictFiles: [],
          autoResolvedMetadata: resolution,
          checks,
          pushed,
        },
        args.json,
      );
      return;
    }
  }

  const checks = {
    skipped: true,
    status: 'skipped',
    reason: 'merge failed before stream checks could run',
  };

  printResult(
    {
      stream: streamBranch,
      status: 'conflict',
      worktreePath,
      temporaryWorktree: createdTemporaryWorktree,
      mergeOutput,
      conflictFiles,
      checks,
    },
    args.json,
  );
  process.exitCode = 1;
}

main().catch((error) => {
  writeStderr(error instanceof Error ? error.message : 'unknown error');
  process.exit(1);
});
