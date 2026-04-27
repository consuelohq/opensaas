#!/usr/bin/env bun

const {
  fetchOrigin,
  findRecentStamp,
  findTaskMetaRecord,
  formatAge,
  getAheadBehind,
  getChangedFiles,
  getCurrentBranch,
  getLatestRailwayDeploy,
  getRemoteBranchName,
  getRepoRoot,
  getStreamFromContext,
  parseTaskBranch,
  runCommand,
  writeError,
  writeLine,
} = require('./lib/workspace-state');

const DEFAULT_REPO = 'consuelohq/opensaas';

function printHelp() {
  [
    'usage: bun run status -- [options]',
    '',
    'shows current workspace task state and the next recommended command.',
    '',
    'options:',
    `  --repo <owner/name>   github repository (default: ${DEFAULT_REPO})`,
    '  --json                output json',
    '  --help                show this help',
  ].forEach(writeLine);
}

function parseArgs(argv) {
  const args = { repo: DEFAULT_REPO, json: false, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    switch (raw) {
      case '--repo':
        args.repo = argv[++index];
        if (!args.repo) throw new Error('missing value for --repo');
        break;
      case '--json':
        args.json = true;
        break;
      case '--help':
        args.help = true;
        break;
      default:
        throw new Error(`unknown flag: ${raw}`);
    }
  }

  return args;
}

function parseJsonOutput(result, fallback) {
  if (!result.ok || !result.stdout) return fallback;

  try {
    return JSON.parse(result.stdout);
  } catch {
    return fallback;
  }
}

function getPullRequests({ repo, taskBranch, stream }) {
  const result = {
    taskPr: null,
    streamPr: null,
    error: null,
  };

  const gh = runCommand('which', ['gh'], { timeout: 5000 });
  if (!gh.ok) {
    result.error = 'gh cli not found';
    return result;
  }

  if (taskBranch && stream) {
    const taskLookup = runCommand('gh', [
      'pr',
      'list',
      '--repo',
      repo,
      '--head',
      taskBranch,
      '--base',
      stream,
      '--state',
      'all',
      '--json',
      'number,url,title,state,isDraft,mergedAt',
      '--limit',
      '1',
    ], { timeout: 15000 });
    const prs = parseJsonOutput(taskLookup, []);
    result.taskPr = prs[0] || null;
    if (!taskLookup.ok && !result.error) result.error = taskLookup.stderr || taskLookup.error;
  }

  if (stream) {
    const streamLookup = runCommand('gh', [
      'pr',
      'list',
      '--repo',
      repo,
      '--head',
      stream,
      '--base',
      'main',
      '--state',
      'open',
      '--json',
      'number,url,title,state,isDraft',
      '--limit',
      '1',
    ], { timeout: 15000 });
    const prs = parseJsonOutput(streamLookup, []);
    result.streamPr = prs[0] || null;
    if (!streamLookup.ok && !result.error) result.error = streamLookup.stderr || streamLookup.error;
  }

  return result;
}

function recommendNext({ currentBranch, taskMeta, changedFiles, prs }) {
  const parsedTask = parseTaskBranch(currentBranch || taskMeta?.data?.taskBranch);
  const hasChanges = changedFiles.length > 0;

  if (!parsedTask && !taskMeta) {
    return {
      command: 'bun run stream:context -- --area <area>',
      reason: 'no active task metadata found',
    };
  }

  if (hasChanges) {
    return {
      command: 'bun run review',
      reason: 'local changes exist and should be verified before push',
    };
  }

  if (prs.taskPr && !prs.taskPr.mergedAt && prs.taskPr.state === 'OPEN') {
    return {
      command: 'bun run task:pr',
      reason: 'task pr exists and can be promoted into the stream',
    };
  }

  if (prs.taskPr?.mergedAt) {
    return {
      command: 'bun run task:finish',
      reason: 'task pr is merged into the stream and local cleanup is next',
    };
  }

  return {
    command: 'bun run task:push -- --message "feat(workspace): description" --changed',
    reason: 'task has no local changes and no merged task pr yet',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const cwd = process.cwd();
  const repoRoot = getRepoRoot(cwd);
  if (!repoRoot) {
    const result = { ok: false, cwd, error: 'not inside a git repository' };
    if (args.json) writeLine(JSON.stringify(result, null, 2));
    else writeLine('status: not inside a git repository');
    process.exit(1);
  }

  fetchOrigin(repoRoot);

  const currentBranch = getCurrentBranch(cwd);
  const taskMetaRecord = findTaskMetaRecord(cwd, { currentBranch, includeStale: true });
  const taskMeta = taskMetaRecord?.stale ? null : taskMetaRecord;
  const stream = getStreamFromContext({ branch: currentBranch, taskMeta });
  const taskBranch = taskMeta?.data?.taskBranch || (parseTaskBranch(currentBranch) ? currentBranch : null);
  const changedFiles = getChangedFiles(cwd).filter((file) => file.path !== 'node_modules');
  const streamSync = stream ? getAheadBehind(repoRoot, stream, getRemoteBranchName(stream)) : null;
  const branchSync = currentBranch ? getAheadBehind(repoRoot, currentBranch, getRemoteBranchName(currentBranch)) : null;
  const stamp = findRecentStamp(repoRoot, cwd);
  const railway = getLatestRailwayDeploy('opensaas', repoRoot);
  const prs = getPullRequests({ repo: args.repo, taskBranch, stream });
  const next = recommendNext({ currentBranch, taskMeta, changedFiles, prs });

  const result = {
    ok: true,
    cwd,
    repoRoot,
    branch: currentBranch,
    task: taskMeta?.data || null,
    staleTask: taskMetaRecord?.stale ? {
      path: taskMetaRecord.path,
      data: taskMetaRecord.data,
      mismatch: taskMetaRecord.mismatch,
    } : null,
    stream,
    sync: { branch: branchSync, stream: streamSync },
    pullRequests: prs,
    changedFiles,
    stamp,
    railway,
    next,
  };

  if (args.json) {
    writeLine(JSON.stringify(result, null, 2));
    return;
  }

  writeLine('status:');
  writeLine(`repo: ${repoRoot}`);
  writeLine(`branch: ${currentBranch || 'unknown'}`);
  if (stream) writeLine(`stream: ${stream}`);
  if (taskMetaRecord?.stale) {
    writeLine(`stale task metadata: ${taskMetaRecord.mismatch.expectedBranch} (current branch: ${taskMetaRecord.mismatch.currentBranch})`);
  }
  writeLine(`task: ${taskBranch || 'none'}`);

  if (taskMeta?.data?.prNumber && taskMeta?.data?.prUrl) {
    writeLine(`task pr: #${taskMeta.data.prNumber} ${taskMeta.data.prUrl}`);
  }
  if (prs.taskPr) writeLine(`task pr lookup: #${prs.taskPr.number} ${prs.taskPr.state}${prs.taskPr.mergedAt ? ' merged' : ''}`);
  if (prs.streamPr) writeLine(`review pr: #${prs.streamPr.number} ${prs.streamPr.url}`);
  if (!prs.streamPr) writeLine('review pr: none');
  if (prs.error) writeLine(`github lookup: ${prs.error}`);

  if (streamSync) writeLine(`stream sync: ${streamSync.ahead} ahead / ${streamSync.behind} behind origin`);
  if (branchSync) writeLine(`branch sync: ${branchSync.ahead} ahead / ${branchSync.behind} behind origin`);

  writeLine('');
  writeLine(`changed files: ${changedFiles.length}`);
  for (const file of changedFiles.slice(0, 20)) writeLine(`  ${file.status} ${file.path}`);
  if (changedFiles.length > 20) writeLine(`  ... ${changedFiles.length - 20} more`);

  writeLine('');
  writeLine(`recent verify/review stamp: ${stamp ? stamp.path : 'none'}`);
  if (railway.ok && railway.latest) {
    const commit = railway.latest.commit ? railway.latest.commit.slice(0, 8) : 'unknown';
    writeLine(`railway: ${railway.status} ${commit} ${formatAge(railway.latest.createdAt) || ''}`.trim());
  } else {
    writeLine(`railway: ${railway.status}${railway.error ? ` (${railway.error})` : ''}`);
  }

  writeLine('');
  writeLine(`next: ${next.command}`);
  writeLine(`why: ${next.reason}`);
}

main().catch((err) => {
  writeError(err instanceof Error ? err.message : 'unknown error');
  process.exit(1);
});
