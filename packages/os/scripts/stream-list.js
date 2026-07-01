#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');

const { getToken, listPullRequests } = require('./lib/github');
const { fetchOrigin, listWorktrees, refExists, runGit, runGitMaybe } = require('./lib/git');
const { DEFAULT_REPO, resolveGitRoot } = require('./lib/paths');
const { getDefaultStreamBranch, normalizeArea, parseStreamBranchName, parseTaskBranchName } = require('./lib/validation');

function writeStdout(value = '') {
  process.stdout.write(`${value}
`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}
`);
}

function printHelp() {
  writeStdout('usage: bun run stream:list -- [options]');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --area <value>         limit output to a single area');
  writeStdout(`  --repo <owner/name>    github repository (default: ${DEFAULT_REPO})`);
  writeStdout('  --all                  include detail rows in human output');
  writeStdout('  --json                 output json');
  writeStdout('  --help                 show this help');
}

function parseArgs(argv) {
  const args = {
    repo: DEFAULT_REPO,
    json: false,
    all: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const rawArgument = argv[index];

    if (!rawArgument.startsWith('--')) {
      throw new Error(`unexpected argument: ${rawArgument}`);
    }

    const [flag, inlineValue] = rawArgument.split('=', 2);
    const isBooleanFlag = flag === '--json' || flag === '--help' || flag === '--all';
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
      case '--repo':
        args.repo = value;
        break;
      case '--all':
        args.all = true;
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

function listAreaDirectories(repoRoot) {
  const areasDirectory = path.join(repoRoot, 'areas');

  if (!fs.existsSync(areasDirectory)) {
    return [];
  }

  return fs
    .readdirSync(areasDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => normalizeArea(entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function listRefs(repoRoot, refs) {
  const output = runGitMaybe(['for-each-ref', '--format=%(refname:short)', ...refs], { cwd: repoRoot }) || '';

  return output
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);
}

function listLocalStreamBranches(repoRoot) {
  return listRefs(repoRoot, ['refs/heads/stream'])
    .map((branch) => {
      const parsed = parseStreamBranchName(branch);
      return parsed ? { branch, area: parsed.area } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.branch.localeCompare(right.branch));
}

function listRemoteStreamBranches(repoRoot) {
  return listRefs(repoRoot, ['refs/remotes/origin/stream'])
    .map((branch) => {
      const shortBranch = branch.replace(/^origin\//, '');
      const parsed = parseStreamBranchName(shortBranch);
      return parsed ? { branch: shortBranch, remoteBranch: branch, area: parsed.area } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.branch.localeCompare(right.branch));
}

function listLocalTaskBranches(repoRoot) {
  return listRefs(repoRoot, ['refs/heads/task'])
    .map((branch) => {
      const parsed = parseTaskBranchName(branch);
      return parsed ? { branch, area: parsed.area, slug: parsed.slug } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.branch.localeCompare(right.branch));
}

function listAreaDocs(repoRoot, area) {
  const directory = path.join(repoRoot, 'areas', area);
  const directoryExists = fs.existsSync(directory) && fs.statSync(directory).isDirectory();

  if (!directoryExists) {
    return {
      directory: `areas/${area}`,
      directoryExists: false,
      exists: false,
      files: [],
    };
  }

  const files = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `areas/${area}/${entry.name}`)
    .sort((left, right) => left.localeCompare(right));

  return {
    directory: `areas/${area}`,
    directoryExists: true,
    exists: files.length > 0,
    files,
  };
}

function getAheadBehind(repoRoot, streamBranch) {
  const localRef = `refs/heads/${streamBranch}`;
  const remoteRef = `refs/remotes/origin/${streamBranch}`;

  if (!refExists(repoRoot, localRef) || !refExists(repoRoot, remoteRef)) {
    return null;
  }

  const output = runGit(['rev-list', '--left-right', '--count', `${localRef}...${remoteRef}`], { cwd: repoRoot });
  const [ahead, behind] = output.split(/\s+/).map((value) => Number.parseInt(value, 10));

  return {
    ahead: Number.isFinite(ahead) ? ahead : 0,
    behind: Number.isFinite(behind) ? behind : 0,
  };
}

function getRelatedWorktrees(allWorktrees, area, currentDirectory) {
  return allWorktrees
    .filter((worktree) => {
      if (!worktree.branch) {
        return false;
      }

      const taskBranch = parseTaskBranchName(worktree.branch);
      if (taskBranch && taskBranch.area === area) {
        return true;
      }

      const streamBranch = parseStreamBranchName(worktree.branch);
      return Boolean(streamBranch && streamBranch.area === area);
    })
    .map((worktree) => ({
      branch: worktree.branch,
      path: worktree.path,
      current: path.resolve(worktree.path) === path.resolve(currentDirectory),
      detached: Boolean(worktree.detached),
      prunable: Boolean(worktree.prunable),
      locked: Boolean(worktree.locked),
      missingPath: !fs.existsSync(worktree.path),
    }))
    .sort((left, right) => left.branch.localeCompare(right.branch));
}

function getStaleWorktrees(worktrees) {
  return worktrees.filter((worktree) => worktree.prunable || worktree.detached || worktree.missingPath);
}

function getWarningSummary(warnings) {
  return warnings.length === 0 ? '-' : warnings.join('; ');
}

function getYesNo(value, truthyValue = 'yes', falsyValue = 'no') {
  return value ? truthyValue : falsyValue;
}

function pad(value, width) {
  return String(value).padEnd(width, ' ');
}

function printTable(streams) {
  const rows = streams.map((stream) => ({
    area: stream.area,
    stream: stream.stream,
    docs: stream.docs.exists ? `yes(${stream.docs.files.length})` : 'no',
    local: getYesNo(stream.local.exists),
    remote: getYesNo(stream.remote.exists),
    sync: stream.aheadBehind ? `${stream.aheadBehind.ahead}/${stream.aheadBehind.behind}` : '-',
    wt: String(stream.worktrees.count),
    task: String(stream.taskBranches.localCount),
    prs: stream.pullRequests.skipped ? '?' : String(stream.pullRequests.count),
    warnings: getWarningSummary(stream.warnings),
  }));

  const columns = [
    { key: 'area', label: 'area' },
    { key: 'stream', label: 'stream' },
    { key: 'docs', label: 'docs' },
    { key: 'local', label: 'local' },
    { key: 'remote', label: 'remote' },
    { key: 'sync', label: 'a/b' },
    { key: 'wt', label: 'wt' },
    { key: 'task', label: 'task' },
    { key: 'prs', label: 'prs' },
    { key: 'warnings', label: 'warnings' },
  ];

  const widths = Object.fromEntries(
    columns.map((column) => [
      column.key,
      Math.max(column.label.length, ...rows.map((row) => String(row[column.key]).length)),
    ]),
  );

  writeStdout(columns.map((column) => pad(column.label, widths[column.key])).join('  '));
  writeStdout(columns.map((column) => '-'.repeat(widths[column.key])).join('  '));

  for (const row of rows) {
    writeStdout(columns.map((column) => pad(row[column.key], widths[column.key])).join('  '));
  }
}

function printStreamDetails(stream) {
  writeStdout(`  discovered from: ${stream.discoveredFrom.length > 0 ? stream.discoveredFrom.join(', ') : 'requested area'}`);

  writeStdout('  docs:');
  if (stream.docs.files.length === 0) {
    writeStdout('    - none');
  } else {
    for (const filePath of stream.docs.files) {
      writeStdout(`    - ${filePath}`);
    }
  }

  writeStdout('  local task branches:');
  if (stream.taskBranches.branches.length === 0) {
    writeStdout('    - none');
  } else {
    for (const branch of stream.taskBranches.branches) {
      writeStdout(`    - ${branch}`);
    }
  }

  writeStdout('  related worktrees:');
  if (stream.worktrees.items.length === 0) {
    writeStdout('    - none');
  } else {
    for (const worktree of stream.worktrees.items) {
      const flags = [];
      if (worktree.current) {
        flags.push('current');
      }
      if (worktree.prunable) {
        flags.push('prunable');
      }
      if (worktree.detached) {
        flags.push('detached');
      }
      if (worktree.missingPath) {
        flags.push('missing-path');
      }
      writeStdout(
        `    - ${worktree.branch} -> ${worktree.path}${flags.length > 0 ? ` (${flags.join(', ')})` : ''}`,
      );
    }
  }

  writeStdout('  open prs:');
  if (stream.pullRequests.skipped) {
    writeStdout(`    - skipped (${stream.pullRequests.reason})`);
  } else if (stream.pullRequests.items.length === 0) {
    writeStdout('    - none');
  } else {
    for (const pullRequest of stream.pullRequests.items) {
      writeStdout(`    - #${pullRequest.number} ${pullRequest.branch || 'unknown-branch'} :: ${pullRequest.title}`);
    }
  }
}

function printHumanResult(result, includeDetails) {
  writeStdout(`repo: ${result.repo}`);
  writeStdout(`streams: ${result.summary.streamCount}`);

  if (result.fetch.skipped) {
    writeStdout(`fetch: skipped (${result.fetch.reason})`);
  } else if (!result.fetch.success) {
    writeStdout(`fetch: failed (${result.fetch.reason})`);
  }

  if (result.summary.streamCount === 0) {
    writeStdout('no streams discovered');
    return;
  }

  printTable(result.streams);

  if (!includeDetails) {
    return;
  }

  for (const stream of result.streams) {
    writeStdout('');
    writeStdout(`${stream.stream}`);
    printStreamDetails(stream);
  }
}

async function getOpenPullRequestsByBase(repository) {
  const token = (() => {
    try {
      return getToken();
    } catch {
      return null;
    }
  })();

  if (!token) {
    return {
      skipped: true,
      reason: 'missing github token',
      byBase: new Map(),
    };
  }

  try {
    const pullRequests = await listPullRequests({
      token,
      repository,
      state: 'open',
    });

    const byBase = new Map();

    for (const pullRequest of pullRequests) {
      const baseBranch = pullRequest && pullRequest.base ? pullRequest.base.ref : null;

      if (!baseBranch) {
        continue;
      }

      const items = byBase.get(baseBranch) || [];
      items.push({
        number: pullRequest.number,
        title: pullRequest.title,
        url: pullRequest.html_url,
        branch: pullRequest.head ? pullRequest.head.ref : null,
        author: pullRequest.user ? pullRequest.user.login : null,
        draft: Boolean(pullRequest.draft),
      });
      byBase.set(baseBranch, items);
    }

    return {
      skipped: false,
      reason: null,
      byBase,
    };
  } catch (error) {
    return {
      skipped: true,
      reason: error instanceof Error ? error.message : 'github request failed',
      byBase: new Map(),
    };
  }
}

function buildWarnings(stream) {
  const warnings = [];

  if (!stream.docs.exists) {
    warnings.push('docs missing');
  }

  if (!stream.local.exists) {
    warnings.push('local stream missing');
  }

  if (!stream.remote.exists) {
    warnings.push('remote stream missing');
  }

  if (stream.local.exists && !stream.remote.exists) {
    warnings.push('local branch detached from remote');
  }

  if (stream.aheadBehind) {
    if (stream.aheadBehind.ahead > 0 && stream.aheadBehind.behind > 0) {
      warnings.push('local stream diverged from remote');
    } else if (stream.aheadBehind.behind > 0) {
      warnings.push('local stream behind remote');
    } else if (stream.aheadBehind.ahead > 0) {
      warnings.push('local stream ahead of remote');
    }
  }

  if (stream.worktrees.staleCount > 0) {
    warnings.push('stale worktrees');
  }

  return warnings;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const repoRoot = resolveGitRoot(process.cwd());
  const currentDirectory = process.cwd();
  const requestedArea = args.area ? normalizeArea(args.area) : null;

  const fetchResult = {
    skipped: false,
    success: true,
    reason: null,
  };

  try {
    fetchOrigin(repoRoot);
  } catch (error) {
    fetchResult.success = false;
    fetchResult.reason = error instanceof Error ? error.message : 'git fetch origin --prune failed';
  }

  const areaDirectories = listAreaDirectories(repoRoot);
  const localStreamBranches = listLocalStreamBranches(repoRoot);
  const remoteStreamBranches = listRemoteStreamBranches(repoRoot);
  const localTaskBranches = listLocalTaskBranches(repoRoot);
  const allWorktrees = listWorktrees(repoRoot);
  const pullRequestsByBase = await getOpenPullRequestsByBase(args.repo);

  const discoveredAreas = new Set();

  for (const area of areaDirectories) {
    discoveredAreas.add(area);
  }

  for (const branch of localStreamBranches) {
    discoveredAreas.add(branch.area);
  }

  for (const branch of remoteStreamBranches) {
    discoveredAreas.add(branch.area);
  }

  if (requestedArea) {
    discoveredAreas.add(requestedArea);
  }

  const areas = requestedArea
    ? [requestedArea]
    : Array.from(discoveredAreas).sort((left, right) => left.localeCompare(right));

  const streams = areas.map((area) => {
    const streamBranch = getDefaultStreamBranch(area);
    const docs = listAreaDocs(repoRoot, area);
    const localExists = refExists(repoRoot, `refs/heads/${streamBranch}`);
    const remoteExists = refExists(repoRoot, `refs/remotes/origin/${streamBranch}`);
    const aheadBehind = getAheadBehind(repoRoot, streamBranch);
    const worktreeItems = getRelatedWorktrees(allWorktrees, area, currentDirectory);
    const staleWorktrees = getStaleWorktrees(worktreeItems);
    const taskBranches = localTaskBranches.filter((branch) => branch.area === area).map((branch) => branch.branch);
    const openPullRequests = pullRequestsByBase.byBase.get(streamBranch) || [];

    const stream = {
      area,
      stream: streamBranch,
      discoveredFrom: [
        ...(areaDirectories.includes(area) ? ['area-directory'] : []),
        ...(localStreamBranches.some((branch) => branch.area === area) ? ['local-branch'] : []),
        ...(remoteStreamBranches.some((branch) => branch.area === area) ? ['remote-branch'] : []),
      ],
      docs,
      local: {
        exists: localExists,
        ref: `refs/heads/${streamBranch}`,
      },
      remote: {
        exists: remoteExists,
        ref: `refs/remotes/origin/${streamBranch}`,
      },
      aheadBehind,
      worktrees: {
        count: worktreeItems.length,
        staleCount: staleWorktrees.length,
        items: worktreeItems,
      },
      taskBranches: {
        localCount: taskBranches.length,
        branches: taskBranches,
      },
      pullRequests: pullRequestsByBase.skipped
        ? {
            skipped: true,
            reason: pullRequestsByBase.reason,
            count: 0,
            items: [],
          }
        : {
            skipped: false,
            reason: null,
            count: openPullRequests.length,
            items: openPullRequests,
          },
    };

    stream.warnings = buildWarnings(stream);
    return stream;
  });

  const result = {
    repo: args.repo,
    repoRoot,
    generatedAt: new Date().toISOString(),
    filters: {
      area: requestedArea,
      all: args.all,
    },
    fetch: fetchResult,
    streams,
    summary: {
      streamCount: streams.length,
      warningCount: streams.reduce((count, stream) => count + stream.warnings.length, 0),
    },
  };

  if (args.json) {
    writeStdout(JSON.stringify(result, null, 2));
    return;
  }

  printHumanResult(result, args.all);
}

main().catch((error) => {
  writeStderr(error instanceof Error ? error.message : 'unknown error');
  process.exit(1);
});
