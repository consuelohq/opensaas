#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');

const {
  DEFAULT_MAIN_BRANCH,
  DEFAULT_REPO,
  getWorktreeRoot,
  resolveGitRoot,
  toWorktreeDirectoryName,
} = require('./lib/paths');
const {
  assertStreamBranchName,
  assertTaskBranchName,
  getDefaultStreamBranch,
  getDefaultTaskBranch,
  normalizeArea,
} = require('./lib/validation');
const {
  createBranch,
  createPullRequest,
  findOpenPullRequest,
  getBranchRef,
  getToken,
} = require('./lib/github');
const {
  branchExistsLocal,
  createOrResetLocalBranch,
  createWorktree,
  ensureMainMatchesOrigin,
  ensureWorktreeClean,
  fetchOrigin,
  getRefSha,
  getWorktreeForBranch,
  runGit,
  setBranchUpstream,
} = require('./lib/git');
const { saveTaskMetaMemory, writeTaskMeta } = require('./lib/task-meta');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run task:start -- --area <area> --title "task title" [options]');
  writeStdout('');
  writeStdout('required:');
  writeStdout('  --area <value>         stream area, for example dialer');
  writeStdout('  --title <value>        task title used for branch slug and pr title');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --stream <branch>      stream branch (default: stream/<area>)');
  writeStdout('  --branch <name>        task branch (default: task/<area>/<slug>)');
  writeStdout(`  --repo <owner/name>    github repository (default: ${DEFAULT_REPO})`);
  writeStdout('  --body <text>          pull request body text');
  writeStdout('  --body-file <path>     pull request body markdown file');
  writeStdout('  --worktree-root <dir>  worktree root (default: /private/tmp/opensaas-worktrees)');
  writeStdout('  --json                 print machine-readable json');
  writeStdout('  --help                 show this help message');
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
      case '--title':
        args.title = value;
        break;
      case '--stream':
      case '--base':
        args.stream = value;
        break;
      case '--branch':
        args.branch = value;
        break;
      case '--repo':
        args.repo = value;
        break;
      case '--body':
        args.body = value;
        break;
      case '--body-file':
        args.bodyFile = value;
        break;
      case '--worktree-root':
        args.worktreeRoot = value;
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

  if (args.body && args.bodyFile) {
    throw new Error('use either --body or --body-file, not both');
  }

  return args;
}

function readPullRequestBody(args, defaults) {
  if (args.body) {
    return args.body;
  }

  if (args.bodyFile) {
    return fs.readFileSync(path.resolve(process.cwd(), args.bodyFile), 'utf8');
  }

  return [
    '## summary',
    `- area: ${defaults.area}`,
    `- stream: ${defaults.stream}`,
    `- task branch: ${defaults.taskBranch}`,
    '',
    '## workspace',
    `- worktree: ${defaults.worktreePath}`,
    '',
    '## notes',
    '- draft pr created automatically by packages/workspace/scripts/task-start.js',
  ].join('\n');
}

function printResult(result, useJson) {
  if (useJson) {
    writeStdout(JSON.stringify(result, null, 2));
    return;
  }

  writeStdout(`area: ${result.area}`);
  writeStdout(`stream: ${result.stream}`);
  writeStdout(`branch: ${result.branch}`);
  writeStdout(`worktree: ${result.worktreePath}`);
  writeStdout(`created branch: ${result.createdBranch}`);
  writeStdout(`created worktree: ${result.createdWorktree}`);
  writeStdout(`created pr: ${result.createdPr}`);
  writeStdout(`pr: #${result.prNumber}`);
  writeStdout(`url: ${result.prUrl}`);
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

  if (!args.title) {
    throw new Error('missing required --title');
  }

  const area = normalizeArea(args.area);
  const stream = args.stream || getDefaultStreamBranch(area);
  const taskBranch = args.branch || getDefaultTaskBranch(area, args.title);
  const repoRoot = resolveGitRoot(process.cwd());
  const worktreeRoot = getWorktreeRoot(args.worktreeRoot);
  const token = getToken();

  assertStreamBranchName(stream, area);
  assertTaskBranchName(taskBranch, area);

  ensureWorktreeClean(repoRoot, 'repo root');
  fetchOrigin(repoRoot);
  ensureMainMatchesOrigin(repoRoot, DEFAULT_MAIN_BRANCH);

  const mainRef = await getBranchRef({ token, repository: args.repo, branch: DEFAULT_MAIN_BRANCH });

  if (!mainRef) {
    throw new Error(`remote ${DEFAULT_MAIN_BRANCH} branch not found in ${args.repo}`);
  }

  let streamRef = await getBranchRef({ token, repository: args.repo, branch: stream });

  if (!streamRef) {
    writeStderr(`creating remote ${stream} from ${DEFAULT_MAIN_BRANCH}...`);
    streamRef = await createBranch({
      token,
      repository: args.repo,
      branch: stream,
      sha: mainRef.object.sha,
    });
  }

  fetchOrigin(repoRoot);
  createOrResetLocalBranch(repoRoot, stream, `origin/${stream}`);

  try {
    setBranchUpstream(repoRoot, stream, `origin/${stream}`);
  } catch {
    // ignore upstream wiring failures on older local setups
  }

  let remoteTaskRef = await getBranchRef({ token, repository: args.repo, branch: taskBranch });

  if (remoteTaskRef) {
    createOrResetLocalBranch(repoRoot, taskBranch, `origin/${taskBranch}`);
  } else if (!branchExistsLocal(repoRoot, taskBranch)) {
    createOrResetLocalBranch(repoRoot, taskBranch, `refs/heads/${stream}`);
  }

  let worktree = getWorktreeForBranch(repoRoot, taskBranch);
  let createdWorktree = false;
  const desiredWorktreePath = path.join(worktreeRoot, toWorktreeDirectoryName(taskBranch));

  if (!worktree) {
    writeStderr(`creating worktree ${desiredWorktreePath}...`);
    createWorktree(repoRoot, desiredWorktreePath, taskBranch);
    worktree = getWorktreeForBranch(repoRoot, taskBranch) || { path: desiredWorktreePath };
    createdWorktree = true;
  }

  const worktreePath = worktree.path;
  let localTaskSha = getRefSha(repoRoot, `refs/heads/${taskBranch}`);
  const streamSha = getRefSha(repoRoot, `refs/heads/${stream}`);
  let createdBranch = false;

  if (!remoteTaskRef && localTaskSha === streamSha) {
    writeStderr(`creating bootstrap commit on ${taskBranch}...`);
    runGit(
      ['-C', worktreePath, 'commit', '--allow-empty', '-m', `chore(workspace): bootstrap ${taskBranch} branch`],
      { cwd: repoRoot },
    );
    localTaskSha = getRefSha(repoRoot, `refs/heads/${taskBranch}`);
  }

  if (!remoteTaskRef) {
    writeStderr(`creating remote ${taskBranch} from ${stream}...`);
    remoteTaskRef = await createBranch({
      token,
      repository: args.repo,
      branch: taskBranch,
      sha: localTaskSha,
    });
    createdBranch = true;
    fetchOrigin(repoRoot);
  }

  try {
    setBranchUpstream(repoRoot, taskBranch, `origin/${taskBranch}`);
  } catch {
    // ignore upstream wiring failures on older local setups
  }

  const prBody = readPullRequestBody(args, {
    area,
    stream,
    taskBranch,
    worktreePath,
  });

  let pullRequest = await findOpenPullRequest({
    token,
    repository: args.repo,
    branch: taskBranch,
    base: stream,
  });
  let createdPr = false;

  if (!pullRequest) {
    writeStderr(`creating draft pr ${taskBranch} -> ${stream}...`);
    pullRequest = await createPullRequest({
      token,
      repository: args.repo,
      title: args.title,
      body: prBody,
      head: taskBranch,
      base: stream,
      draft: true,
    });
    createdPr = true;
  }

  const taskMeta = {
    area,
    stream,
    taskBranch,
    baseBranch: stream,
    prNumber: pullRequest.number,
    prUrl: pullRequest.html_url,
    worktreePath,
    createdAt: new Date().toISOString(),
  };

  writeTaskMeta(worktreePath, taskMeta);
  await saveTaskMetaMemory(taskMeta);

  printResult(
    {
      area,
      stream,
      branch: taskBranch,
      worktreePath,
      prNumber: pullRequest.number,
      prUrl: pullRequest.html_url,
      createdBranch,
      createdWorktree,
      createdPr,
    },
    args.json,
  );
}

main().catch((error) => {
  writeStderr(error instanceof Error ? error.message : 'unknown error');
  process.exit(1);
});
