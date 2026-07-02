#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_REPO = 'consuelohq/opensaas';
const DEFAULT_REVIEW_BASE = 'main';
const AREA_DOCS = [
  'readme.md',
  'agents.md',
  'current-state.md',
  'decisions.md',
  'test-plan.md',
  'worklog.md',
];

const {
  GitHubRequestError,
  createPullRequest,
  findOpenPullRequest,
  findPullRequest,
  getBranchRef,
  getToken,
  markPullRequestReadyForReview,
  mergePullRequest,
  updatePullRequest,
} = require('./lib/github');
const { fetchOrigin, getCurrentBranch, runGit } = require('./lib/git');
const { buildGraphitePullRequestUrl } = require('./lib/pr-links');
const { resolveGitRoot } = require('./lib/paths');
const { resolvePrRefNumber } = require('./lib/pr-ref');
const { findActiveTaskResult } = require('./lib/task-selection');
const {
  assertTaskBranchName,
  assertStreamBranchName,
  getDefaultStreamBranch,
  isStreamBranchName,
} = require('./lib/validation');
const {
  findTaskMeta,
  getTaskCurrentMetaPath,
  isOnlyTaskMetadataConflict,
  resolveTaskMetadataConflicts,
  validateBranchMatch,
  writeTaskMeta,
} = require('./lib/task-meta');
const { assertWorkpadReady } = require('./lib/task-workpad');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run task:pr -- [options]');
  writeStdout('');
  writeStdout('default behavior:');
  writeStdout('  1. ensure the task pr exists for task/* -> stream/*');
  writeStdout('  2. merge that task pr into the stream branch');
  writeStdout('  3. create or refresh the review pr for stream/* -> main');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --area <name>            select task by area');
  writeStdout('  --branch <name>          select exact task branch');
  writeStdout('  --pr <number-or-url>            select task by pr number');
  writeStdout('  --title <value>          final review pr title (default: Stream/<area>)');
  writeStdout(`  --base <branch>          final review base branch (default: ${DEFAULT_REVIEW_BASE})`);
  writeStdout('  --body <text>            final review pr body text');
  writeStdout('  --body-file <path>       final review pr body markdown file');
  writeStdout('  --body-template area     generate an area-context body template for the final review pr');
  writeStdout('  --task-only              stop after creating or refreshing the task/* -> stream/* pr');
  writeStdout('  --ack-workpad-incomplete allow publish when Ko explicitly approved an incomplete workpad');
  writeStdout('  --draft                  create or keep the final review pr as draft');
  writeStdout('  --no-draft               create the final review pr as ready-for-review (default)');
  writeStdout('  --ready                  convert an existing draft final review pr to ready');
  writeStdout(`  --repo <owner/name>      github repository (default: ${DEFAULT_REPO})`);
  writeStdout('  --json                   output json');
  writeStdout('  --help                   show this help');
}

function parseArgs(argv) {
  const args = {
    repo: DEFAULT_REPO,
    draft: false,
    json: false,
    taskOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const rawArgument = argv[index];

    if (!rawArgument.startsWith('--')) {
      throw new Error(`unexpected argument: ${rawArgument}`);
    }

    const [flag, inlineValue] = rawArgument.split('=', 2);
    const isBooleanFlag =
      flag === '--draft' ||
      flag === '--no-draft' ||
      flag === '--json' ||
      flag === '--help' ||
      flag === '--ready' ||
      flag === '--task-only' ||
      flag === '--ack-workpad-incomplete';
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
      case '--title':
        args.title = value;
        break;
      case '--base':
        args.base = value;
        break;
      case '--body':
        args.body = value;
        break;
      case '--body-file':
        args.bodyFile = value;
        break;
      case '--body-template':
        args.bodyTemplate = value;
        break;
      case '--repo':
        args.repo = value;
        break;
      case '--task-only':
        args.taskOnly = true;
        break;
      case '--ack-workpad-incomplete':
        args.ackWorkpadIncomplete = true;
        break;
      case '--draft':
        args.draft = true;
        break;
      case '--no-draft':
        args.draft = false;
        break;
      case '--ready':
        args.ready = true;
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

  if (args.body && args.bodyFile) {
    throw new Error('use either --body or --body-file, not both');
  }

  return args;
}

function slugToPhrase(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .join(' ');
}

function buildAreaBodyTemplate(context) {
  const areaDirectory = path.join(context.repoRoot, 'areas', context.area);
  const areaDocs = AREA_DOCS.filter((name) => fs.existsSync(path.join(areaDirectory, name)));

  return [
    '## summary',
    `- area: ${context.area}`,
    `- stream: ${context.streamBranch}`,
    `- task branch: ${context.taskBranch}`,
    `- review target: ${context.streamBranch} -> ${context.reviewBase}`,
    '',
    '## area docs',
    ...(areaDocs.length > 0 ? areaDocs.map((name) => `- areas/${context.area}/${name}`) : ['- none found']),
    '',
    '## notes',
    '- created or refreshed by packages/workspace/scripts/task-pr.js',
  ].join('\n');
}

function buildTaskPrBody(context) {
  return [
    '## summary',
    `- area: ${context.area}`,
    `- task branch: ${context.taskBranch}`,
    `- stream: ${context.streamBranch}`,
    '',
    '## notes',
    '- internal promotion pr managed by packages/workspace/scripts/task-pr.js',
  ].join('\n');
}

function readReviewBody(args, context) {
  if (args.body) {
    return args.body;
  }

  if (args.bodyFile) {
    return fs.readFileSync(path.resolve(process.cwd(), args.bodyFile), 'utf8');
  }

  if (args.bodyTemplate === 'area') {
    return buildAreaBodyTemplate(context);
  }

  return '';
}

function hasExplicitTaskSelector(args) {
  return Boolean(args.area || args.branch || args.prNumber !== undefined);
}

function getSelectedPrContext(args) {
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
  const streamCandidates = [
    selected.task.meta.stream,
    isStreamBranchName(selected.task.meta.baseBranch) ? selected.task.meta.baseBranch : null,
    getDefaultStreamBranch(parsedTaskBranch.area),
  ].filter(Boolean);
  const streamBranch = streamCandidates[0];

  assertStreamBranchName(streamBranch, parsedTaskBranch.area);

  return {
    area: parsedTaskBranch.area,
    slug: parsedTaskBranch.slug,
    taskBranch: selected.task.meta.taskBranch,
    streamBranch,
    reviewBase: args.base || DEFAULT_REVIEW_BASE,
    currentBranch: selected.task.branch,
    repoRoot: selected.task.worktreePath,
    taskMeta: {
      dir: selected.task.worktreePath,
      data: selected.task.meta,
      path: getTaskCurrentMetaPath(selected.task.worktreePath, selected.task.meta),
    },
  };
}

function getPrContext(args) {
  if (hasExplicitTaskSelector(args)) {
    return getSelectedPrContext(args);
  }

  const repoRoot = resolveGitRoot(process.cwd());
  const taskMeta = findTaskMeta(process.cwd());
  const currentBranch = getCurrentBranch(process.cwd());

  if (!taskMeta) {
    throw new Error(
      'no .task/current.json found. this worktree was not created by task:start.\n' +
      'run: bun run task:start -- --area <area> --title "<title>"\n' +
      'then work in the new worktree it creates.',
    );
  }

  validateBranchMatch(taskMeta, currentBranch);

  const taskBranch = args.branch || taskMeta.data.taskBranch;

  if (!taskBranch) {
    throw new Error('unable to determine the task branch');
  }

  const parsedTaskBranch = assertTaskBranchName(taskBranch);
  const streamCandidates = [
    taskMeta && taskMeta.data.stream,
    taskMeta && isStreamBranchName(taskMeta.data.baseBranch) ? taskMeta.data.baseBranch : null,
    getDefaultStreamBranch(parsedTaskBranch.area),
  ].filter(Boolean);
  const streamBranch = streamCandidates[0];

  assertStreamBranchName(streamBranch, parsedTaskBranch.area);

  return {
    area: parsedTaskBranch.area,
    slug: parsedTaskBranch.slug,
    taskBranch,
    streamBranch,
    reviewBase: args.base || DEFAULT_REVIEW_BASE,
    currentBranch,
    repoRoot,
    taskMeta,
  };
}

function getTaskPrTitle(context) {
  return `task(${context.area}): ${slugToPhrase(context.slug)}`;
}

function updateTaskMetaIfPresent(taskMetaRecord, updates) {
  if (!taskMetaRecord) {
    return;
  }

  writeTaskMeta(taskMetaRecord.dir, {
    ...taskMetaRecord.data,
    ...updates,
  });
}

function parseStreamSyncOutput(output) {
  try {
    return JSON.parse(String(output || '').trim());
  } catch {
    return null;
  }
}

function runStreamSyncBeforeReview(context) {
  const result = spawnSync('bun', ['run', 'stream:sync', '--', '--area', context.area, '--json'], {
    cwd: context.repoRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const syncResult = parseStreamSyncOutput(result.stdout);
  if (result.status !== 0 || !syncResult || syncResult.pushed !== true) {
    throw new Error(
      `stream sync failed before publishing ${context.streamBranch}:\n` +
      [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    );
  }

  return result.stdout || '';
}

function getUpdateDetails({ pullRequest, title, body, base }) {
  return {
    nextTitle: title || pullRequest.title,
    nextBody: body || pullRequest.body || '',
    needsUpdate:
      (title || pullRequest.title) !== pullRequest.title ||
      (body || pullRequest.body || '') !== (pullRequest.body || '') ||
      base !== pullRequest.base.ref,
  };
}

async function ensurePullRequest({ token, repository, branch, base, title, body, draft }) {
  try {
    let pullRequest = await findOpenPullRequest({
    token,
    repository,
    branch,
    base,
  });

  if (pullRequest) {
    const { nextTitle, nextBody, needsUpdate } = getUpdateDetails({
      pullRequest,
      title,
      body,
      base,
    });

    if (needsUpdate) {
      pullRequest = await updatePullRequest({
        token,
        repository,
        prNumber: pullRequest.number,
        title: nextTitle,
        body: nextBody,
        base,
      });
    }

    // if the existing PR is draft but we want ready, mark it ready
    if (pullRequest.draft && !draft) {
      pullRequest = await markPullRequestReadyForReview({
        token,
        repository,
        prNumber: pullRequest.number,
      });
    }

    return {
      pullRequest,
      created: false,
      updated: needsUpdate,
      reused: !needsUpdate,
    };
  }

  if (!title) {
    throw new Error(`missing required --title for pull request creation (${branch} -> ${base})`);
  }

  pullRequest = await createPullRequest({
    token,
    repository,
    title,
    body,
    head: branch,
    base,
    draft,
  });

    return {
      pullRequest,
      created: true,
      updated: false,
      reused: false,
    };
  } finally {}
}

async function ensureTaskPullRequest({ token, repository, context }) {
  try {
    const openTaskPr = await findOpenPullRequest({
    token,
    repository,
    branch: context.taskBranch,
    base: context.streamBranch,
  });

  if (openTaskPr) {
    const details = await ensurePullRequest({
      token,
      repository,
      branch: context.taskBranch,
      base: context.streamBranch,
      title: getTaskPrTitle(context),
      body: buildTaskPrBody(context),
      draft: false,
    });

    return {
      ...details,
      alreadyMerged: false,
    };
  }

  const anyTaskPr = await findPullRequest({
    token,
    repository,
    branch: context.taskBranch,
    base: context.streamBranch,
    state: 'all',
  });

  if (anyTaskPr && anyTaskPr.merged_at) {
    return {
      pullRequest: anyTaskPr,
      created: false,
      updated: false,
      reused: true,
      alreadyMerged: true,
    };
  }

  const details = await ensurePullRequest({
    token,
    repository,
    branch: context.taskBranch,
    base: context.streamBranch,
    title: getTaskPrTitle(context),
    body: buildTaskPrBody(context),
    draft: false,
  });

    return {
      ...details,
      alreadyMerged: false,
    };
  } finally {}
}

function getConflictFiles(worktreePath) {
  const output = runGit(['-C', worktreePath, 'diff', '--name-only', '--diff-filter=U'], { cwd: worktreePath });
  return output ? output.split('\n').filter(Boolean) : [];
}

function syncTaskBranchWithBaseMetadataConflicts(context) {
  if (!context.taskMeta || !context.taskMeta.dir) {
    return { resolved: false, reason: 'no local task metadata record' };
  }

  const worktreePath = context.taskMeta.dir;
  fetchOrigin(worktreePath);

  try {
    runGit(['-C', worktreePath, 'merge', '--no-ff', '--no-edit', `origin/${context.streamBranch}`], { cwd: worktreePath });
    runGit(['-C', worktreePath, 'push', 'origin', context.taskBranch], { cwd: worktreePath });
    return { resolved: true, conflictFiles: [], alreadyMergedCleanly: true };
  } catch {
    const conflictFiles = getConflictFiles(worktreePath);
    if (!isOnlyTaskMetadataConflict(conflictFiles)) {
      try { runGit(['-C', worktreePath, 'merge', '--abort'], { cwd: worktreePath }); } catch { /* merge may not be active */ }
      return {
        resolved: false,
        reason: 'non-metadata conflicts present',
        conflictFiles,
        message: 'merge failed',
      };
    }

    const resolution = resolveTaskMetadataConflicts(worktreePath, conflictFiles, {
      currentBranch: context.taskBranch,
      taskBranch: context.taskBranch,
    });

    if (!resolution.resolved) {
      try { runGit(['-C', worktreePath, 'merge', '--abort'], { cwd: worktreePath }); } catch { /* merge may not be active */ }
      return resolution;
    }

    runGit(['-C', worktreePath, 'commit', '--no-edit'], { cwd: worktreePath });
    runGit(['-C', worktreePath, 'push', 'origin', context.taskBranch], { cwd: worktreePath });
    return resolution;
  }
}

async function mergeTaskPullRequestIfNeeded({ token, repository, taskPr, context }) {
  try {
    if (taskPr.merged_at) {
    return {
      pullRequest: taskPr,
      merged: false,
      alreadyMerged: true,
      markedReady: false,
    };
  }

  let pullRequest = taskPr;
  let markedReady = false;

  if (pullRequest.draft) {
    pullRequest = await markPullRequestReadyForReview({
      token,
      repository,
      prNumber: pullRequest.number,
    });
    markedReady = true;

    // GitHub needs a moment to propagate the draft→ready state change
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  await mergePullRequest({
    token,
    repository,
    prNumber: pullRequest.number,
    commitTitle: pullRequest.title,
    mergeMethod: 'merge',
  }).catch(async (mergeError) => {
    const isMergeConflict = mergeError instanceof GitHubRequestError && mergeError.details.status === 405;
    if (!isMergeConflict) {
      throw mergeError;
    }

    const resolution = syncTaskBranchWithBaseMetadataConflicts(context);

    if (!resolution.resolved) {
      throw new GitHubRequestError(
        `task PR merge failed and metadata recovery did not apply: ${resolution.reason || 'unknown reason'} (original: ${mergeError.message})`,
        { data: { resolution, originalError: mergeError.details } },
      );
    }

    await mergePullRequest({
      token,
      repository,
      prNumber: pullRequest.number,
      commitTitle: pullRequest.title,
      mergeMethod: 'merge',
    });
  });

  const mergedPullRequest = await findPullRequest({
    token,
    repository,
    branch: pullRequest.head.ref,
    base: pullRequest.base.ref,
    state: 'all',
  });

    return {
      pullRequest: mergedPullRequest || pullRequest,
      merged: true,
      alreadyMerged: false,
      markedReady,
    };
  } finally {}
}

function buildTaskOnlyResult({ args, context, taskPrDetails }) {
  const githubPrUrl = taskPrDetails.pullRequest.html_url;
  const graphitePrUrl = buildGraphitePullRequestUrl(args.repo, taskPrDetails.pullRequest.number, context.slug);
  const result = {
    repo: args.repo,
    branch: context.taskBranch,
    base: context.streamBranch,
    prNumber: taskPrDetails.pullRequest.number,
    prUrl: graphitePrUrl,
    githubPrUrl,
    graphitePrUrl,
    draft: Boolean(taskPrDetails.pullRequest.draft),
    created: taskPrDetails.created,
    updated: taskPrDetails.updated,
    alreadyExisted: taskPrDetails.reused,
    alreadyMerged: taskPrDetails.alreadyMerged,
    taskOnly: true,
  };

  if (args.json) {
    writeStdout(JSON.stringify(result, null, 2));
    return;
  }

  writeStdout(`graphite task pr #${result.prNumber}: ${result.graphitePrUrl}`);
  writeStdout(`github task pr #${result.prNumber}: ${result.githubPrUrl}`);
  writeStdout(`${context.taskBranch} -> ${context.streamBranch}`);
  if (result.alreadyMerged) {
    writeStdout('task pr is already merged');
  } else if (result.created) {
    writeStdout('created task pr');
  } else if (result.updated) {
    writeStdout('updated task pr');
  } else {
    writeStdout('reused existing task pr');
  }
}

function buildFinalResult({ args, context, taskPrDetails, taskMergeDetails, reviewPrDetails }) {
  const taskGitHubPrUrl = taskPrDetails.pullRequest.html_url;
  const taskGraphitePrUrl = buildGraphitePullRequestUrl(args.repo, taskPrDetails.pullRequest.number, context.slug);
  const streamGitHubPrUrl = reviewPrDetails.pullRequest.html_url;
  const streamGraphitePrUrl = buildGraphitePullRequestUrl(
    args.repo,
    reviewPrDetails.pullRequest.number,
    reviewPrDetails.pullRequest.title || context.streamBranch,
  );
  const result = {
    repo: args.repo,
    taskBranch: context.taskBranch,
    stream: context.streamBranch,
    base: context.reviewBase,
    taskPrNumber: taskPrDetails.pullRequest.number,
    taskPrUrl: taskGraphitePrUrl,
    taskGitHubPrUrl,
    taskGraphitePrUrl,
    taskPrMerged: Boolean(taskMergeDetails.pullRequest.merged_at),
    taskPrMergedNow: taskMergeDetails.merged,
    streamPrNumber: reviewPrDetails.pullRequest.number,
    streamPrUrl: streamGraphitePrUrl,
    streamGitHubPrUrl,
    streamGraphitePrUrl,
    prNumber: reviewPrDetails.pullRequest.number,
    prUrl: streamGraphitePrUrl,
    githubPrUrl: streamGitHubPrUrl,
    graphitePrUrl: streamGraphitePrUrl,
    draft: Boolean(reviewPrDetails.pullRequest.draft),
    created: reviewPrDetails.created,
    updated: reviewPrDetails.updated,
    alreadyExisted: reviewPrDetails.reused,
    markedReady: reviewPrDetails.markedReady,
  };

  if (args.json) {
    writeStdout(JSON.stringify(result, null, 2));
    return;
  }

  writeStdout(`graphite review pr #${result.streamPrNumber}: ${result.streamGraphitePrUrl}`);
  writeStdout(`github review pr #${result.streamPrNumber}: ${result.streamGitHubPrUrl}`);
  writeStdout(`${context.streamBranch} -> ${context.reviewBase}`);
  writeStdout(`graphite task pr #${result.taskPrNumber}: ${result.taskGraphitePrUrl}`);
  writeStdout(`github task pr #${result.taskPrNumber}: ${result.taskGitHubPrUrl}`);

  if (taskMergeDetails.alreadyMerged) {
    writeStdout('task pr was already merged into the stream branch');
  } else if (taskMergeDetails.merged) {
    writeStdout('merged task pr into the stream branch');
  }

  if (result.markedReady) {
    writeStdout('marked final review pr ready for review');
  } else if (result.created) {
    writeStdout('created final review pr');
  } else if (result.updated) {
    writeStdout('updated final review pr');
  } else {
    writeStdout('reused existing final review pr');
  }
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
    printHelp();
    return;
  }

  if (args.ready) {
    args.draft = false;
  }

  const context = getPrContext(args);
  const workpadReadiness = context.taskMeta?.data
    ? assertWorkpadReady(context.repoRoot, context.taskMeta.data, { ackIncomplete: args.ackWorkpadIncomplete })
    : { ok: true };
  if (!workpadReadiness.ok && args.ackWorkpadIncomplete) {
    writeStderr(`warning: publishing with incomplete workpad: ${workpadReadiness.path}`);
  }
  const token = getToken();
  const reviewBody = readReviewBody(args, context);

  const taskBranchRef = await getBranchRef({
    token,
    repository: args.repo,
    branch: context.taskBranch,
  });

  if (!taskBranchRef) {
    throw new Error(`remote branch '${context.taskBranch}' not found; start or push the task first`);
  }

  const streamBranchRef = await getBranchRef({
    token,
    repository: args.repo,
    branch: context.streamBranch,
  });

  if (!streamBranchRef) {
    throw new Error(`remote stream branch '${context.streamBranch}' not found`);
  }

  const reviewBaseRef = await getBranchRef({
    token,
    repository: args.repo,
    branch: context.reviewBase,
  });

  if (!reviewBaseRef) {
    throw new Error(`remote review base branch '${context.reviewBase}' not found`);
  }

  const taskPrDetails = await ensureTaskPullRequest({
    token,
    repository: args.repo,
    context,
  });

  if (args.taskOnly) {
    updateTaskMetaIfPresent(context.taskMeta, {
      taskPrNumber: taskPrDetails.pullRequest.number,
      taskPrUrl: taskPrDetails.pullRequest.html_url,
      taskGraphitePrUrl: buildGraphitePullRequestUrl(args.repo, taskPrDetails.pullRequest.number, context.slug),
      prNumber: taskPrDetails.pullRequest.number,
      prUrl: taskPrDetails.pullRequest.html_url,
      githubPrUrl: taskPrDetails.pullRequest.html_url,
      graphitePrUrl: buildGraphitePullRequestUrl(args.repo, taskPrDetails.pullRequest.number, context.slug),
      stream: context.streamBranch,
      baseBranch: context.streamBranch,
    });

    buildTaskOnlyResult({
      args,
      context,
      taskPrDetails,
    });
    return;
  }

  const taskMergeDetails = await mergeTaskPullRequestIfNeeded({
    token,
    repository: args.repo,
    taskPr: taskPrDetails.pullRequest,
    context,
  });

  runStreamSyncBeforeReview(context);

  const reviewTitle =
    args.title ||
    `Stream/${context.area}`;

  const reviewPrDetails = await ensurePullRequest({
    token,
    repository: args.repo,
    branch: context.streamBranch,
    base: context.reviewBase,
    title: reviewTitle,
    body: reviewBody,
    draft: args.draft,
  });

  let reviewPullRequest = reviewPrDetails.pullRequest;
  let markedReady = false;

  if (args.ready && reviewPullRequest.draft) {
    reviewPullRequest = await markPullRequestReadyForReview({
      token,
      repository: args.repo,
      prNumber: reviewPullRequest.number,
    });
    markedReady = true;
  }

  updateTaskMetaIfPresent(context.taskMeta, {
    stream: context.streamBranch,
    taskPrNumber: taskPrDetails.pullRequest.number,
    taskPrUrl: taskPrDetails.pullRequest.html_url,
    taskGraphitePrUrl: buildGraphitePullRequestUrl(args.repo, taskPrDetails.pullRequest.number, context.slug),
    taskPrMergedAt: taskMergeDetails.pullRequest.merged_at || null,
    streamPrNumber: reviewPullRequest.number,
    streamPrUrl: reviewPullRequest.html_url,
    streamGraphitePrUrl: buildGraphitePullRequestUrl(args.repo, reviewPullRequest.number, reviewPullRequest.title || context.streamBranch),
    prNumber: reviewPullRequest.number,
    prUrl: reviewPullRequest.html_url,
    githubPrUrl: reviewPullRequest.html_url,
    graphitePrUrl: buildGraphitePullRequestUrl(args.repo, reviewPullRequest.number, reviewPullRequest.title || context.streamBranch),
    baseBranch: context.streamBranch,
    reviewBaseBranch: context.reviewBase,
  });

    buildFinalResult({
      args,
      context,
      taskPrDetails,
      taskMergeDetails,
      reviewPrDetails: {
        ...reviewPrDetails,
        pullRequest: reviewPullRequest,
        markedReady,
      },
    });
  } finally {}
}

main().catch((error) => {
  writeStderr(error instanceof Error ? error.message : 'unknown error');
  process.exit(1);
});
