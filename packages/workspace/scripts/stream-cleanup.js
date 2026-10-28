#!/usr/bin/env bun

const {
  deleteLocalBranch,
  fetchOrigin,
  getCurrentBranch,
  listWorktrees,
  refExists,
  runGitMaybe,
} = require('./lib/git');
const { resolveGitRoot } = require('./lib/paths');
const { classifyLocalStream } = require('./lib/stream-lifecycle');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run stream:cleanup -- [options]');
  writeStdout('');
  writeStdout('Safely removes local stream refs only. Remote streams and task branches are never deleted.');
  writeStdout('Preview is the default; pass --apply to mutate local branches.');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --apply                delete branches classified as removable');
  writeStdout('  --keep <branch>        protect a local stream branch; repeat or comma-separate values');
  writeStdout('  --json                 output json');
  writeStdout('  --help                 show this help');
}

function parseBooleanFlag(flag, inlineValue) {
  if (inlineValue === undefined || inlineValue === 'true') {
    return true;
  }

  if (inlineValue === 'false') {
    return false;
  }

  throw new Error(`${flag} must be true or false when a value is provided`);
}

function parseArgs(argv) {
  const args = {
    apply: false,
    json: false,
    keep: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const rawArgument = argv[index];

    if (!rawArgument.startsWith('--')) {
      throw new Error(`unexpected argument: ${rawArgument}`);
    }

    const [flag, inlineValue] = rawArgument.split('=', 2);
    const isBooleanFlag = flag === '--apply' || flag === '--json' || flag === '--help';
    const value = inlineValue !== undefined ? inlineValue : isBooleanFlag ? undefined : argv[index + 1];

    if (!isBooleanFlag && (!value || value.startsWith('--'))) {
      throw new Error(`missing value for ${flag}`);
    }

    if (inlineValue === undefined && !isBooleanFlag) {
      index += 1;
    }

    switch (flag) {
      case '--apply':
        args.apply = parseBooleanFlag(flag, inlineValue);
        break;
      case '--keep':
        args.keep.push(...value.split(',').map((item) => item.trim()).filter(Boolean));
        break;
      case '--json':
        args.json = parseBooleanFlag(flag, inlineValue);
        break;
      case '--help':
        args.help = parseBooleanFlag(flag, inlineValue);
        break;
      default:
        throw new Error(`unknown flag: ${flag}`);
    }
  }

  return args;
}

function listLocalStreamBranches(repoRoot) {
  const output = runGitMaybe(
    ['for-each-ref', '--format=%(refname:short)', 'refs/heads/stream/'],
    { cwd: repoRoot },
  );

  if (!output) {
    return [];
  }

  return output.split('\n').map((line) => line.trim()).filter(Boolean).sort();
}

function getAheadBehind(repoRoot, branch) {
  const output = runGitMaybe(
    ['rev-list', '--left-right', '--count', `${branch}...origin/${branch}`],
    { cwd: repoRoot },
  );

  if (!output) {
    return { ahead: null, behind: null };
  }

  const [aheadRaw, behindRaw] = output.split(/\s+/);
  const ahead = Number.parseInt(aheadRaw, 10);
  const behind = Number.parseInt(behindRaw, 10);

  if (!Number.isFinite(ahead) || !Number.isFinite(behind)) {
    return { ahead: null, behind: null };
  }

  return { ahead, behind };
}

function buildCleanupPlan(repoRoot, keepBranches) {
  const currentBranch = getCurrentBranch(repoRoot);
  const worktrees = listWorktrees(repoRoot);
  const keep = new Set(keepBranches);

  const items = listLocalStreamBranches(repoRoot).map((branch) => {
    const remoteExists = refExists(repoRoot, `refs/remotes/origin/${branch}`);
    const { ahead, behind } = remoteExists
      ? getAheadBehind(repoRoot, branch)
      : { ahead: null, behind: null };
    const worktreePaths = worktrees
      .filter((worktree) => worktree.branch === branch)
      .map((worktree) => worktree.path);
    const classification = classifyLocalStream({
      branch,
      currentBranch,
      remoteExists,
      ahead,
      behind,
      worktreePaths,
      kept: keep.has(branch),
    });

    return {
      branch,
      remoteExists,
      ahead,
      behind,
      worktreePaths,
      ...classification,
    };
  });

  return {
    currentBranch,
    removable: items.filter((item) => item.removable),
    protected: items.filter((item) => !item.removable),
  };
}

function printHumanResult(result) {
  writeStdout(`mode: ${result.applied ? 'apply' : 'preview'}`);
  writeStdout(`removable: ${result.removable.length}`);
  writeStdout(`protected: ${result.protected.length}`);

  if (result.removable.length > 0) {
    writeStdout('');
    writeStdout(result.applied ? 'removed local streams:' : 'would remove local streams:');
    for (const item of result.removable) {
      writeStdout(`  - ${item.branch} (ahead ${item.ahead}, behind ${item.behind})`);
    }
  }

  if (result.protected.length > 0) {
    writeStdout('');
    writeStdout('protected local streams:');
    for (const item of result.protected) {
      writeStdout(`  - ${item.branch}: ${item.reasons.join('; ')}`);
    }
  }

  if (!result.applied && result.removable.length > 0) {
    writeStdout('');
    writeStdout('preview only; rerun with --apply to delete these local refs');
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const repoRoot = resolveGitRoot(process.cwd());
  fetchOrigin(repoRoot);
  const plan = buildCleanupPlan(repoRoot, args.keep);
  const removed = [];

  if (args.apply) {
    for (const item of plan.removable) {
      deleteLocalBranch(repoRoot, item.branch);
      removed.push(item.branch);
    }
  }

  const result = {
    repoRoot,
    applied: args.apply,
    currentBranch: plan.currentBranch,
    keep: args.keep,
    removable: plan.removable,
    protected: plan.protected,
    removed,
  };

  if (args.json) {
    writeStdout(JSON.stringify(result, null, 2));
    return;
  }

  printHumanResult(result);
}

try {
  main();
} catch (error) {
  writeStderr(error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
}
