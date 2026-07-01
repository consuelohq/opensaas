#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');

const DEFAULT_REPO = 'consuelohq/opensaas';
const AUTHOR = { name: 'kokayicobb', email: 'kokayicobb@users.noreply.github.com' };
const COMMITTER = {
  name: 'suelo-kiro[bot]',
  email: '260422584+suelo-kiro[bot]@users.noreply.github.com',
};

const {
  createBlob,
  createCommit,
  createTree,
  getBranchRef,
  getCommit,
  getToken,
  updateBranchRef,
} = require('./lib/github');
const {
  fetchOrigin,
  getTrackedChanges,
  getCurrentBranch,
  getRefSha,
  refExists,
} = require('./lib/git');
const { resolveGitRoot } = require('./lib/paths');
const {
  assertCommitMessageFormat,
  assertTaskBranchName,
  isStreamBranchName,
} = require('./lib/validation');
const { collectTaskMetaFiles, findTaskMeta, validateBranchMatch } = require('./lib/task-meta');
const { findActiveTaskResult } = require('./lib/task-selection');
const { getVerifyStampMismatch } = require('./lib/verification');

const BOOLEAN_FLAGS = new Set(['--json', '--help', '--changed', '--verify', '--no-verify']);

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run task:push -- --message "fix(area): summary" [options]');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --message <text>       commit message in conventional format (required)');
  writeStdout('  --changed              push tracked changed files from the current task worktree');
  writeStdout('  --files <paths...>     explicit file paths to read from disk');
  writeStdout('  --files-json <json>    explicit JSON array of {path, content, deleted?} objects');
  writeStdout('  --area <name>          select task by area');
  writeStdout('  --branch <name>        select exact task branch');
  writeStdout('  --pr <number>          select task by pr number');
  writeStdout('  --task-session <id>    select exact task session metadata');
  writeStdout(`  --repo <owner/name>    github repository (default: ${DEFAULT_REPO})`);
  writeStdout('  --cwd <dir>            base directory for explicit file paths');
  writeStdout('  --verify               require a matching task-scoped verify stamp (default)');
  writeStdout('  --no-verify            visibly bypass the verify stamp check');
  writeStdout('  --json                 output json');
  writeStdout('  --help                 show this help');
}

function parseArgs(argv) {
  const args = {
    repo: DEFAULT_REPO,
    filePaths: [],
    json: false,
    changed: false,
    verify: true,
  };

  let index = 0;

  while (index < argv.length) {
    const rawArgument = argv[index];

    if (!rawArgument.startsWith('--')) {
      throw new Error(`unexpected argument: ${rawArgument}`);
    }

    if (rawArgument === '--files') {
      index += 1;
      while (index < argv.length && !argv[index].startsWith('--')) {
        args.filePaths.push(argv[index]);
        index += 1;
      }
      continue;
    }

    const [flag, inlineValue] = rawArgument.split('=', 2);
    const isBooleanFlag = BOOLEAN_FLAGS.has(flag);
    const value = inlineValue !== undefined ? inlineValue : isBooleanFlag ? undefined : argv[index + 1];

    if (!isBooleanFlag && (!value || value.startsWith('--'))) {
      throw new Error(`missing value for ${flag}`);
    }

    if (inlineValue === undefined && !isBooleanFlag) {
      index += 1;
    }

    switch (flag) {
      case '--message':
        args.message = value;
        break;
      case '--files-json':
        args.filesJson = value;
        break;
      case '--area':
        args.area = value;
        break;
      case '--branch':
        args.branch = value;
        break;
      case '--pr':
        args.prNumber = Number.parseInt(value, 10);
        break;
      case '--task-session':
        args.taskSession = value;
        break;
      case '--cwd':
        args.cwd = value;
        break;
      case '--repo':
        args.repo = value;
        break;
      case '--changed':
        args.changed = true;
        break;
      case '--verify':
        args.verify = true;
        break;
      case '--no-verify':
        args.verify = false;
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

    index += 1;
  }

  if (args.prNumber !== undefined && !Number.isInteger(args.prNumber)) {
    throw new Error('invalid --pr value');
  }

  return args;
}

function hasExplicitTaskSelector(args) {
  return Boolean(args.area || args.branch || args.prNumber !== undefined || args.taskSession);
}

function getSelectedTaskContext(args, startDirectory) {
  const repoRoot = resolveGitRoot(startDirectory);
  const selected = findActiveTaskResult(repoRoot, {
    area: args.area || null,
    branch: args.branch || null,
    prNumber: args.prNumber === undefined ? null : args.prNumber,
    taskSession: args.taskSession || null,
  });

  if (selected.error) {
    throw new Error(selected.error);
  }

  return {
    branch: selected.task.meta.taskBranch,
    currentBranch: selected.task.branch,
    repoRoot: selected.task.worktreePath,
    taskMeta: {
      dir: selected.task.worktreePath,
      data: selected.task.meta,
      path: path.join(selected.task.worktreePath, '.task', 'current.json'),
    },
  };
}

function getTaskContext(args) {
  const startDirectory = path.resolve(args.cwd || process.cwd());

  if (hasExplicitTaskSelector(args)) {
    return getSelectedTaskContext(args, startDirectory);
  }

  const repoRoot = resolveGitRoot(startDirectory);
  const currentBranch = getCurrentBranch(startDirectory);
  const taskMeta = findTaskMeta(startDirectory);

  if (!taskMeta) {
    throw new Error(
      'no .task/current.json found. this worktree was not created by task:start.\n' +
      'run: bun run task:start -- --area <area> --title "<title>"\n' +
      'then work in the new worktree it creates.',
    );
  }

  validateBranchMatch(taskMeta, currentBranch);

  const branch = args.branch || taskMeta.data.taskBranch;

  if (!branch) {
    throw new Error('unable to determine the current branch');
  }

  if (branch === 'main' || isStreamBranchName(branch)) {
    throw new Error('task:push only supports task/* branches; refusing to push from main or stream branches');
  }

  assertTaskBranchName(branch);

  if (currentBranch !== branch) {
    throw new Error(`current git branch mismatch: expected ${branch}, received ${currentBranch}`);
  }

  if (taskMeta) {
    if (taskMeta.data.taskBranch !== branch) {
      throw new Error(`task metadata branch mismatch: ${taskMeta.data.taskBranch} != ${branch}`);
    }

    if (path.resolve(taskMeta.data.worktreePath) !== path.resolve(repoRoot)) {
      throw new Error(
        `task metadata worktree mismatch: expected ${taskMeta.data.worktreePath}, received ${repoRoot}`,
      );
    }
  }

  return {
    branch,
    currentBranch,
    repoRoot,
    taskMeta,
  };
}

function resolveFilesFromJson(args) {
  if (!args.filesJson) {
    return null;
  }

  const parsed = JSON.parse(args.filesJson);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('--files-json must be a non-empty array');
  }

  return parsed.map((entry) => {
    if (!entry || typeof entry.path !== 'string') {
      throw new Error('--files-json entries must include a path field');
    }

    if (!entry.deleted && typeof entry.content !== 'string') {
      throw new Error(`files-json entry ${entry.path} is missing content`);
    }

    return {
      path: entry.path,
      content: entry.content,
      deleted: Boolean(entry.deleted),
    };
  });
}

function resolveFilesFromPaths(args, repoRoot) {
  if (args.filePaths.length === 0) {
    return null;
  }

  const baseDirectory = path.resolve(args.cwd || process.cwd());

  return args.filePaths.map((filePath) => {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(baseDirectory, filePath);
    const repoPath = path.relative(repoRoot, absolutePath).split(path.sep).join('/');

    if (repoPath.startsWith('..')) {
      throw new Error(`file is outside the repository root: ${filePath}`);
    }

    return {
      path: repoPath,
      content: fs.readFileSync(absolutePath, 'utf8'),
      deleted: false,
    };
  });
}

function assertChangedBranchIsSynced(repoRoot, branch) {
  fetchOrigin(repoRoot);

  const localRef = `refs/heads/${branch}`;
  const remoteRef = `refs/remotes/origin/${branch}`;

  if (!refExists(repoRoot, remoteRef)) {
    throw new Error(
      `origin/${branch} does not exist. sync the task branch with origin before running task:push --changed.`,
    );
  }

  const localSha = getRefSha(repoRoot, localRef);
  const remoteSha = getRefSha(repoRoot, remoteRef);

  if (localSha !== remoteSha) {
    throw new Error(
      `local task branch is not synced with origin/${branch} (local ${localSha.slice(0, 8)} != remote ${remoteSha.slice(0, 8)}). sync the task worktree first, then rerun task:push --changed.`,
    );
  }
}

function resolveChangedFiles(repoRoot) {
  const changes = getTrackedChanges(repoRoot);

  if (changes.length === 0) {
    throw new Error('no tracked changes detected in the current task worktree');
  }

  return changes.map((change) => {
    if (change.deleted) {
      return {
        path: change.path,
        deleted: true,
      };
    }

    return {
      path: change.path,
      content: fs.readFileSync(path.join(repoRoot, change.path), 'utf8'),
      deleted: false,
    };
  });
}

function resolveFiles(args, repoRoot) {
  const fromJson = resolveFilesFromJson(args);
  if (fromJson) {
    return fromJson;
  }

  const fromPaths = resolveFilesFromPaths(args, repoRoot);
  if (fromPaths) {
    return fromPaths;
  }

  if (args.changed) {
    return resolveChangedFiles(repoRoot);
  }

  throw new Error('provide --changed, --files, or --files-json');
}

function printPlan(branch, files, useJson) {
  if (useJson) {
    return;
  }

  writeStdout(`target branch: ${branch}`);
  writeStdout('files:');
  for (const file of files) {
    writeStdout(`  - ${file.path}${file.deleted ? ' (delete)' : ''}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.message) {
    throw new Error('missing required --message');
  }

  assertCommitMessageFormat(args.message);

  const { branch, repoRoot, taskMeta } = getTaskContext(args);

  if (args.verify) {
    const verifyMismatch = getVerifyStampMismatch(repoRoot, branch, taskMeta && taskMeta.data);
    if (verifyMismatch) {
      throw new Error(
        `verify required before task:push: ${verifyMismatch}.\n` +
        'run: bun run verify\n' +
        'or explicitly bypass with: bun run task:push -- --no-verify --message "fix(area): summary" --changed',
      );
    }
  } else {
    writeStderr('warning: task:push bypassing verify because --no-verify was provided');
  }

  if (args.changed) {
    assertChangedBranchIsSynced(repoRoot, branch);
  }

  const token = getToken();
  const userFiles = resolveFiles(args, repoRoot);

  // update workpad "files changed" section with the actual files being pushed
  const workpadPath = path.join(repoRoot, '.task', 'workpad.md');
  if (fs.existsSync(workpadPath)) {
    const nonMetaFiles = userFiles.filter((f) => !f.path.startsWith('.task/'));
    if (nonMetaFiles.length > 0) {
      let workpad = fs.readFileSync(workpadPath, 'utf8');
      const filesList = nonMetaFiles.map((f) => `- \`${f.path}\`${f.deleted ? ' (deleted)' : ''}`).join('\n');
      workpad = workpad.replace(
        /## files changed\n\n[\s\S]*?(?=\n## )/,
        `## files changed\n\n${filesList}\n\n`,
      );
      fs.writeFileSync(workpadPath, workpad, 'utf8');
    }
  }

  // auto-include .task/ metadata files — scoped to current task area only
  const currentArea = taskMeta && taskMeta.data && taskMeta.data.area;
  const currentTaskBranch = taskMeta && taskMeta.data && taskMeta.data.taskBranch;
  const metaFiles = collectTaskMetaFiles(repoRoot, currentArea, currentTaskBranch, { includeVerify: args.verify });
  const seenPaths = new Set(userFiles.map((f) => f.path));
  const files = [...userFiles];
  for (const mf of metaFiles) {
    if (!seenPaths.has(mf.path)) {
      files.push(mf);
    }
  }

  if (files.length === 0) {
    throw new Error('no files to push');
  }

  printPlan(branch, files, args.json);

  const branchRef = await getBranchRef({ token, repository: args.repo, branch });

  if (!branchRef) {
    throw new Error(`remote branch not found: ${branch}`);
  }

  const headCommit = await getCommit({
    token,
    repository: args.repo,
    sha: branchRef.object.sha,
  });

  const treeItems = [];

  for (const file of files) {
    if (file.deleted) {
      treeItems.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: null,
      });
      continue;
    }

    const blob = await createBlob({
      token,
      repository: args.repo,
      content: Buffer.from(file.content).toString('base64'),
      encoding: 'base64',
    });

    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    });
  }

  const tree = await createTree({
    token,
    repository: args.repo,
    baseTree: headCommit.tree.sha,
    tree: treeItems,
  });

  const timestamp = new Date().toISOString();
  const commit = await createCommit({
    token,
    repository: args.repo,
    message: args.message,
    tree: tree.sha,
    parents: [branchRef.object.sha],
    author: { ...AUTHOR, date: timestamp },
    committer: { ...COMMITTER, date: timestamp },
  });

  await updateBranchRef({
    token,
    repository: args.repo,
    branch,
    sha: commit.sha,
  });

  // save workpad to supabase memories for future agent context
  const workpadFile = path.join(repoRoot, '.task', 'workpad.md');
  if (fs.existsSync(workpadFile)) {
    try {
      const dotenvPath = path.join(__dirname, '..', '..', '.env');
      let supabaseUrl, supabaseKey;
      if (fs.existsSync(dotenvPath)) {
        const envContent = fs.readFileSync(dotenvPath, 'utf8');
        supabaseUrl = (envContent.match(/SUPABASE_URL=(.+)/) || [])[1];
        supabaseKey = (envContent.match(/SUPABASE_KEY=(.+)/) || [])[1];
      }
      supabaseUrl = supabaseUrl || process.env.SUPABASE_URL;
      supabaseKey = supabaseKey || process.env.SUPABASE_KEY;

      if (supabaseUrl && supabaseKey) {
        const workpadContent = fs.readFileSync(workpadFile, 'utf8');
        const resp = await fetch(`${supabaseUrl}/rest/v1/memories`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: `workpad: ${branch}`,
            category: 'workpad',
            content: workpadContent,
          }),
        });
        if (!resp.ok) {
          writeStderr(`workpad save warning: ${resp.status}`);
        }
      }
    } catch {
      // non-critical — don't fail the push if memory save fails
    }
  }

  const result = {
    repo: args.repo,
    branch,
    sha: commit.sha,
    message: args.message,
    files: files.map((file) => ({ path: file.path, deleted: Boolean(file.deleted) })),
  };

  if (args.json) {
    writeStdout(JSON.stringify(result, null, 2));
    return;
  }

  writeStdout(`pushed ${commit.sha.slice(0, 8)} to ${branch}`);
}

main().catch((error) => {
  writeStderr(error instanceof Error ? error.message : 'unknown error');
  process.exit(1);
});
