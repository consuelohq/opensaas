#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  findTaskMeta,
  isOnlyTaskMetadataConflict,
  readValidTaskMetaForWorktree,
  resolveTaskMetadataConflicts,
} = require('./lib/task-meta');
const { parseTaskSelectorPrefix, selectTaskFromCandidates } = require('./lib/task-selection');

function writeLine(value = '') {
  process.stdout.write(`${value}\n`);
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeMeta(repoPath, data) {
  writeFile(path.join(repoPath, '.task', 'current.json'), JSON.stringify(data, null, 2) + '\n');
}

function writeWorkpad(repoPath, taskBranch, started) {
  writeFile(path.join(repoPath, '.task', 'workpad.md'), [
    `# ${taskBranch}`,
    '',
    'branch: `' + taskBranch + '`',
    'stream: `stream/workspace-agents`',
    `started: ${started}`,
    '',
  ].join('\n'));
}

function initRepo() {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'task-meta-smoke-'));
  git(repoPath, ['init']);
  git(repoPath, ['checkout', '-b', 'stream/workspace-agents']);
  git(repoPath, ['config', 'user.name', 'task-meta-smoke']);
  git(repoPath, ['config', 'user.email', 'task-meta-smoke@example.com']);
  return repoPath;
}

function commitAll(repoPath, message) {
  git(repoPath, ['add', '.']);
  git(repoPath, ['commit', '-m', message]);
}

function getConflictFiles(repoPath) {
  const output = git(repoPath, ['diff', '--name-only', '--diff-filter=U']);
  return output ? output.split('\n').filter(Boolean) : [];
}

function runStaleMetadataSmoke() {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'task-meta-stale-'));
  writeMeta(repoPath, {
    area: 'dialer',
    stream: 'stream/dialer',
    taskBranch: 'task/dialer/stale-task',
    createdAt: '2026-04-27T00:00:00.000Z',
  });

  assert.equal(readValidTaskMetaForWorktree(repoPath, 'stream/workspace-agents'), null);
  assert.equal(
    readValidTaskMetaForWorktree(repoPath, 'task/dialer/stale-task').taskBranch,
    'task/dialer/stale-task',
  );

  assert.equal(findTaskMeta(repoPath, { currentBranch: 'stream/workspace-agents' }), null);
  const staleRecord = findTaskMeta(repoPath, {
    currentBranch: 'stream/workspace-agents',
    includeStale: true,
  });
  assert.equal(staleRecord.stale, true);
  assert.equal(staleRecord.mismatch.expectedBranch, 'task/dialer/stale-task');

  const activeRecord = findTaskMeta(repoPath, { currentBranch: 'task/dialer/stale-task' });
  assert.equal(activeRecord.stale, false);
  assert.equal(activeRecord.data.taskBranch, 'task/dialer/stale-task');
}

function runMetadataConflictSmoke() {
  const repoPath = initRepo();
  const workspaceTask = 'task/workspace-agents/keep-me';
  const dialerTask = 'task/dialer/newer-but-wrong-stream';

  writeMeta(repoPath, {
    area: 'workspace-agents',
    stream: 'stream/workspace-agents',
    taskBranch: 'task/workspace-agents/base',
    createdAt: '2026-04-26T00:00:00.000Z',
  });
  writeWorkpad(repoPath, 'task/workspace-agents/base', '2026-04-26');
  commitAll(repoPath, 'base metadata');

  git(repoPath, ['checkout', '-b', 'incoming-main']);
  writeMeta(repoPath, {
    area: 'dialer',
    stream: 'stream/dialer',
    taskBranch: dialerTask,
    createdAt: '2026-04-27T23:00:00.000Z',
  });
  writeWorkpad(repoPath, dialerTask, '2026-04-27');
  commitAll(repoPath, 'incoming newer dialer metadata');

  git(repoPath, ['checkout', 'stream/workspace-agents']);
  writeMeta(repoPath, {
    area: 'workspace-agents',
    stream: 'stream/workspace-agents',
    taskBranch: workspaceTask,
    createdAt: '2026-04-27T01:00:00.000Z',
  });
  writeWorkpad(repoPath, workspaceTask, '2026-04-27');
  commitAll(repoPath, 'workspace metadata');

  try {
    git(repoPath, ['merge', '--no-ff', '--no-edit', 'incoming-main']);
  } catch {
    // expected conflict
  }

  const conflictFiles = getConflictFiles(repoPath);
  assert.deepEqual(conflictFiles.sort(), ['.task/current.json', '.task/workpad.md']);
  assert.equal(isOnlyTaskMetadataConflict(conflictFiles), true);

  const resolution = resolveTaskMetadataConflicts(repoPath, conflictFiles, {
    currentBranch: 'stream/workspace-agents',
    taskBranch: workspaceTask,
  });

  assert.equal(resolution.resolved, true);
  const selected = JSON.parse(fs.readFileSync(path.join(repoPath, '.task', 'current.json'), 'utf8'));
  assert.equal(selected.taskBranch, workspaceTask);
  assert.match(fs.readFileSync(path.join(repoPath, '.task', 'workpad.md'), 'utf8'), new RegExp(workspaceTask));
}

function runMixedConflictSmoke() {
  assert.equal(isOnlyTaskMetadataConflict(['.task/current.json', 'packages/workspace/SCRIPTS.md']), false);
}

function runTaskSelectionSmoke() {
  const tasks = [
    {
      branch: 'task/workspace-agents/old-task',
      worktreePath: '/tmp/old-task',
      meta: { area: 'workspace-agents', taskBranch: 'task/workspace-agents/old-task', prNumber: 208 },
    },
    {
      branch: 'task/workspace-agents/tighten-exact-task-command-selection',
      worktreePath: '/tmp/current-task',
      meta: { area: 'workspace-agents', taskBranch: 'task/workspace-agents/tighten-exact-task-command-selection', prNumber: 210 },
    },
  ];

  assert.equal(
    selectTaskFromCandidates(tasks, { branch: 'task/workspace-agents/tighten-exact-task-command-selection' }).worktreePath,
    '/tmp/current-task',
  );
  assert.equal(selectTaskFromCandidates(tasks, { prNumber: 210 }).worktreePath, '/tmp/current-task');
  assert.throws(
    () => selectTaskFromCandidates(tasks, { area: 'workspace-agents' }),
    /multiple active tasks found/,
  );

  const parsed = parseTaskSelectorPrefix([
    '--area',
    'workspace-agents',
    '--branch',
    'task/workspace-agents/tighten-exact-task-command-selection',
    'git',
    'diff',
  ]);
  assert.deepEqual(parsed.selector, {
    area: 'workspace-agents',
    branch: 'task/workspace-agents/tighten-exact-task-command-selection',
    prNumber: null,
  });
  assert.deepEqual(parsed.remainingArgs, ['git', 'diff']);
}

function main() {
  runStaleMetadataSmoke();
  runMetadataConflictSmoke();
  runMixedConflictSmoke();
  runTaskSelectionSmoke();
  writeLine('task metadata smoke checks passed');
}

main();
