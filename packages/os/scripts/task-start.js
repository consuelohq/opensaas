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
  createOrResetLocalBranch,
  createWorktree,
  fetchOrigin,
  getRefSha,
  getWorktreeForBranch,
  runGit,
  setBranchUpstream,
} = require('./lib/git');
const { readTaskMeta, saveTaskMetaMemory, writeTaskMeta } = require('./lib/task-meta');
const { assertTmuxAvailable, ensureTaskTmuxSession, writeTaskSessionMetadata } = require('./lib/task-session');
const { dispatchHookEvent, renderHookResult } = require('../hooks/dispatcher.js');

const DEFAULT_START_FROM = 'main';
const START_FROM_OPTIONS = new Set(['main', 'stream']);

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
  writeStdout('  --stream <branch>      target stream branch for later push/pr flow (default: stream/<area>)');
  writeStdout(`  --start-from <mode>    source branch for the new task: ${Array.from(START_FROM_OPTIONS).join('|')} (default: ${DEFAULT_START_FROM})`);
  writeStdout('  --branch <name>        task branch (default: task/<area>/<slug>)');
  writeStdout(`  --repo <owner/name>    github repository (default: ${DEFAULT_REPO})`);
  writeStdout('  --body <text>          pull request body text');
  writeStdout('  --body-file <path>     pull request body markdown file');
  writeStdout('  --worktree-root <dir>  worktree root (default: $WORKSPACE_WORKTREE_ROOT, $OPENSAAS_WORKTREE_ROOT, or os.tmpdir()/opensaas-worktrees)');
  writeStdout('  --json                 print machine-readable json');
  writeStdout('  --help                 show this help message');
}

function parseArgs(argv) {
  const args = {
    repo: DEFAULT_REPO,
    json: false,
    startFrom: DEFAULT_START_FROM,
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
      case '--start-from':
        args.startFrom = value;
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

  if (!START_FROM_OPTIONS.has(args.startFrom)) {
    throw new Error(`--start-from must be one of: ${Array.from(START_FROM_OPTIONS).join(', ')}`);
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
    `- start source: ${defaults.sourceBranch}`,
    '',
    '## workspace',
    `- worktree: ${defaults.worktreePath}`,
    '',
    '## notes',
    '- pr created automatically by packages/workspace/scripts/task-start.js',
  ].join('\n');
}

function printResult(result, useJson) {
  if (useJson) {
    writeStdout(JSON.stringify(result, null, 2));
    return;
  }

  writeStdout(`area: ${result.area}`);
  writeStdout(`stream: ${result.stream}`);
  writeStdout(`start from: ${result.startFrom}`);
  writeStdout(`source branch: ${result.sourceBranch}`);
  writeStdout(`branch: ${result.branch}`);
  writeStdout(`worktree: ${result.worktreePath}`);
  writeStdout(`created branch: ${result.createdBranch}`);
  writeStdout(`created worktree: ${result.createdWorktree}`);
  writeStdout(`bootstrapped branch: ${result.bootstrappedBranch}`);
  writeStdout(`created pr: ${result.createdPr}`);
  writeStdout(`task session: ${result.taskSession}`);
  writeStdout(`tmux session: ${result.tmuxSession}`);
  writeStdout(`pr: #${result.prNumber}`);
  writeStdout(`url: ${result.prUrl}`);
}

function resolveSourceBranch(startFrom, stream) {
  if (startFrom === 'stream') {
    return stream;
  }

  return DEFAULT_MAIN_BRANCH;
}

async function ensureRemoteStreamBranch({ token, repository, streamBranch, mainRef }) {
  try {
    let streamRef = await getBranchRef({ token, repository, branch: streamBranch });

    if (streamRef) {
      return {
        streamRef,
        created: false,
      };
    }

    writeStderr(`creating remote ${streamBranch} from ${DEFAULT_MAIN_BRANCH}...`);
    streamRef = await createBranch({
      token,
      repository,
      branch: streamBranch,
      sha: mainRef.object.sha,
    });

    return {
      streamRef,
      created: true,
    };
  } catch (error) {
    throw new Error(`failed to ensure stream branch ${streamBranch}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function ensureRemoteTaskBranch({ token, repository, taskBranch, sourceSha }) {
  try {
    let remoteTaskRef = await getBranchRef({ token, repository, branch: taskBranch });

    if (remoteTaskRef) {
      return {
        remoteTaskRef,
        created: false,
      };
    }

    writeStderr(`creating remote ${taskBranch} from source sha ${sourceSha.slice(0, 8)}...`);
    remoteTaskRef = await createBranch({
      token,
      repository,
      branch: taskBranch,
      sha: sourceSha,
    });

    return {
      remoteTaskRef,
      created: true,
    };
  } catch (error) {
    throw new Error(`failed to ensure task branch ${taskBranch}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function createBootstrapCommit({ repoRoot, worktreePath, taskBranch }) {
  writeStderr(`creating bootstrap commit on ${taskBranch}...`);
  runGit(
    ['-C', worktreePath, 'commit', '--allow-empty', '-m', `chore(workspace): bootstrap ${taskBranch} branch`],
    { cwd: repoRoot },
  );
  writeStderr(`pushing bootstrap commit for ${taskBranch}...`);
  runGit(['-C', worktreePath, 'push', 'origin', taskBranch], { cwd: repoRoot });
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
    assertTmuxAvailable();

    fetchOrigin(repoRoot);

    const mainRef = await getBranchRef({ token, repository: args.repo, branch: DEFAULT_MAIN_BRANCH });

    if (!mainRef) {
      throw new Error(`remote ${DEFAULT_MAIN_BRANCH} branch not found in ${args.repo}`);
    }

    const streamDetails = await ensureRemoteStreamBranch({
      token,
      repository: args.repo,
      streamBranch: stream,
      mainRef,
    });

    if (streamDetails.created) {
      fetchOrigin(repoRoot);
    }

    const sourceBranch = resolveSourceBranch(args.startFrom, stream);
    const sourceRef = `refs/remotes/origin/${sourceBranch}`;
    const sourceSha = getRefSha(repoRoot, sourceRef);

    const remoteTaskDetails = await ensureRemoteTaskBranch({
      token,
      repository: args.repo,
      taskBranch,
      sourceSha,
    });

    if (remoteTaskDetails.created) {
      fetchOrigin(repoRoot);
    }

    let worktree = getWorktreeForBranch(repoRoot, taskBranch);

    if (!worktree) {
      createOrResetLocalBranch(repoRoot, taskBranch, `origin/${taskBranch}`);
    }

    try {
      setBranchUpstream(repoRoot, taskBranch, `origin/${taskBranch}`);
    } catch {
      // ignore upstream wiring failures on older local setups
    }

    let createdWorktree = false;
    const desiredWorktreePath = path.join(worktreeRoot, toWorktreeDirectoryName(taskBranch));

    // guard 1: reject if worktree path already exists
    if (fs.existsSync(desiredWorktreePath) && !worktree) {
      throw new Error(
        `worktree path already exists: ${desiredWorktreePath}\n` +
        'run: bun run task:cleanup\n' +
        'or pick a different --title to generate a new branch slug.',
      );
    }

    if (!worktree) {
      writeStderr(`creating worktree ${desiredWorktreePath}...`);
      createWorktree(repoRoot, desiredWorktreePath, taskBranch);
      worktree = getWorktreeForBranch(repoRoot, taskBranch) || { path: desiredWorktreePath };
      createdWorktree = true;
    }

    const worktreePath = worktree.path;

    // symlink node_modules from main worktree so tests/lint/typecheck work
    const worktreeNodeModules = path.join(worktreePath, 'node_modules');
    if (!fs.existsSync(worktreeNodeModules)) {
      const mainNodeModules = path.join(repoRoot, 'node_modules');
      if (fs.existsSync(mainNodeModules)) {
        fs.symlinkSync(mainNodeModules, worktreeNodeModules);
        writeStderr('symlinked node_modules from main worktree');
      }
    }

    const workspacePackageNodeModules = path.join(worktreePath, 'packages', 'workspace', 'node_modules');
    if (!fs.existsSync(workspacePackageNodeModules)) {
      const mainWorkspacePackageNodeModules = path.join(repoRoot, 'packages', 'workspace', 'node_modules');
      if (fs.existsSync(mainWorkspacePackageNodeModules)) {
        fs.symlinkSync(mainWorkspacePackageNodeModules, workspacePackageNodeModules);
        writeStderr('symlinked packages/workspace/node_modules from main worktree');
      }
    }

    const taskTmux = ensureTaskTmuxSession({
      area,
      taskBranch,
      worktreePath,
    });

    let localTaskSha = getRefSha(repoRoot, `refs/heads/${taskBranch}`);
    let remoteTaskSha = getRefSha(repoRoot, `refs/remotes/origin/${taskBranch}`);
    let pullRequest = await findOpenPullRequest({
      token,
      repository: args.repo,
      branch: taskBranch,
      base: stream,
    });
    let bootstrappedBranch = false;

    if (!pullRequest && localTaskSha === sourceSha && remoteTaskSha === sourceSha) {
      createBootstrapCommit({
        repoRoot,
        worktreePath,
        taskBranch,
      });
      bootstrappedBranch = true;
      fetchOrigin(repoRoot);
      localTaskSha = getRefSha(repoRoot, `refs/heads/${taskBranch}`);
      remoteTaskSha = getRefSha(repoRoot, `refs/remotes/origin/${taskBranch}`);
    }

    const prBody = readPullRequestBody(args, {
      area,
      stream,
      taskBranch,
      worktreePath,
      sourceBranch,
    });

    let createdPr = false;

    if (!pullRequest) {
      writeStderr(`creating pr ${taskBranch} -> ${stream}...`);
      pullRequest = await createPullRequest({
        token,
        repository: args.repo,
        title: args.title,
        body: prBody,
        head: taskBranch,
        base: stream,
        draft: false,
      });
      createdPr = true;
    }

    // guard 3: verify PR targets stream, not main
    if (pullRequest.base.ref !== stream) {
      throw new Error(
        `pr #${pullRequest.number} targets ${pullRequest.base.ref}, expected ${stream}.\n` +
        'the pr must target the stream branch, not main.\n' +
        'close the incorrect pr on github and rerun task:start.',
      );
    }

    const taskSessionMeta = writeTaskSessionMetadata({
      area,
      stream,
      taskBranch,
      worktreePath,
      prNumber: pullRequest.number,
      prUrl: pullRequest.html_url,
    }, taskTmux.created);

    const taskMeta = {
      area,
      stream,
      taskBranch,
      baseBranch: stream,
      sourceBranch,
      startFrom: args.startFrom,
      prNumber: pullRequest.number,
      prUrl: pullRequest.html_url,
      worktreePath,
      taskSession: taskSessionMeta.taskSession,
      tmuxSession: taskSessionMeta.tmuxSession,
      sessionPath: path.join(worktreePath, '.task', 'session.json'),
      createdAt: new Date().toISOString(),
    };

    writeTaskMeta(worktreePath, taskMeta);

    // guard 2: verify .task/current.json was written correctly
    const verifyMeta = readTaskMeta(worktreePath);
    if (!verifyMeta || verifyMeta.taskBranch !== taskBranch || verifyMeta.stream !== stream) {
      throw new Error(
        `.task/current.json verification failed in ${worktreePath}.\n` +
        'the file was not written correctly. check disk permissions.',
      );
    }

    await saveTaskMetaMemory(taskMeta);

    // create fresh workpad — always overwrite, never reuse from previous task
    const workpadPath = path.join(worktreePath, '.task', 'workpad.md');
    const slug = taskBranch.split('/').pop();
    const workpad = [
      `# ${args.title}`,
      '',
      `branch: \`${taskBranch}\``,
      `stream: \`${stream}\``,
      `pr: ${pullRequest.html_url}`,
      `started: ${new Date().toISOString().slice(0, 10)}`,
      '',
      '## acceptance criteria',
      '',
      '- [ ] Define explicit task acceptance criteria before coding.',
      '',
      '## plan',
      '',
      '1. Read the relevant code and update this plan before editing.',
      '',
      '## files changed',
      '',
      '- none yet',
      '',
      '## key decisions',
      '',
      '- none yet',
      '',
      '## notes for ko',
      '',
      '- none yet',
      '',
      '## improvements noticed',
      '',
      '- none yet',
      '',
      '## errors i ran into',
      '',
      '- none yet',
      '',
      '---',
      '',
      '## publish checklist',
      '',
      '```bash',
      `bun run task:push -- --message "type(${area}): description" --changed`,
      'bun run task:pr',
      'bun run task:finish',
      '```',
      '',
    ].join('\n');
    fs.writeFileSync(workpadPath, workpad, 'utf8');

    printResult(
      {
        area,
        stream,
        sourceBranch,
        startFrom: args.startFrom,
        branch: taskBranch,
        worktreePath,
        prNumber: pullRequest.number,
        prUrl: pullRequest.html_url,
        taskSession: taskSessionMeta.taskSession,
        tmuxSession: taskSessionMeta.tmuxSession,
        createdBranch: remoteTaskDetails.created,
        createdWorktree,
        bootstrappedBranch,
        createdPr,
      },
      args.json,
    );

    // guard 4: emit manifest-driven task hook guidance for non-JSON callers
    if (!args.json) {
      try {
        const guidance = dispatchHookEvent({
          event: {
            event: 'tool.postInvoke',
            tool: 'task.start',
            workflow: 'task',
            result: {
              area,
              branch: taskBranch,
              taskSession: taskSessionMeta.taskSession,
              worktreePath,
            },
          },
        });
        if (guidance) {
          writeStderr('');
          writeStderr('task hook guidance:');
          writeStderr(renderHookResult(guidance).trimEnd());
        }
      } catch (error) {
        writeStderr(`warning: task hook guidance failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
}

main().catch((error) => {
  writeStderr(error instanceof Error ? error.message : 'unknown error');
  process.exit(1);
});

