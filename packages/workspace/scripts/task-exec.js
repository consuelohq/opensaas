#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const { resolveGitRoot } = require('./lib/paths');
const { readValidTaskMetaForWorktree } = require('./lib/task-meta');
const { listWorktrees } = require('./lib/git');

function writeStdout(msg) { process.stdout.write(msg + '\n'); }
function writeStderr(msg) { process.stderr.write(msg + '\n'); }

function showHelp() {
  writeStdout('task:exec — run a command inside the active task worktree');
  writeStdout('');
  writeStdout('usage:');
  writeStdout('  bun run task:exec -- <command...>');
  writeStdout('  bun run task:exec -- --area dialer <command...>');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --area <name>    select task by area (required if multiple active tasks)');
  writeStdout('  --help           show this help');
  writeStdout('');
  writeStdout('examples:');
  writeStdout('  bun run task:exec -- bun run review');
  writeStdout('  bun run task:exec -- npx nx typecheck twenty-front');
  writeStdout('  bun run task:exec -- --area dialer git diff');
}

function findActiveTask(repoRoot, area) {
  const worktrees = listWorktrees(repoRoot);
  const tasks = [];

  for (const wt of worktrees) {
    // skip the main worktree
    if (wt.path === repoRoot) continue;
    const meta = readValidTaskMetaForWorktree(wt.path, wt.branch);
    if (!meta) continue;
    if (area && meta.area !== area) continue;
    tasks.push({ worktreePath: wt.path, meta, branch: wt.branch });
  }

  if (tasks.length === 0) {
    const msg = area
      ? `no active task found for area "${area}". run task:start first.`
      : 'no active task found. run task:start first.';
    throw new Error(msg);
  }

  if (tasks.length > 1 && !area) {
    const areas = tasks.map(t => t.meta.area).join(', ');
    throw new Error(
      `multiple active tasks found (${areas}). use --area <name> to select one.`
    );
  }

  return tasks[0];
}

function main() {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    showHelp();
    return;
  }

  let area = null;
  const commandArgs = [];
  let i = 0;

  while (i < rawArgs.length) {
    if (rawArgs[i] === '--area' && i + 1 < rawArgs.length) {
      area = rawArgs[i + 1];
      i += 2;
    } else {
      // everything from here on is the command
      commandArgs.push(...rawArgs.slice(i));
      break;
    }
  }

  if (commandArgs.length === 0) {
    writeStderr('error: no command provided');
    writeStderr('usage: bun run task:exec -- <command...>');
    process.exitCode = 1;
    return;
  }

  const repoRoot = resolveGitRoot(process.cwd());
  const task = findActiveTask(repoRoot, area);
  const cmd = commandArgs.join(' ');

  writeStderr(`→ task: ${task.meta.area}/${task.meta.taskBranch.split('/').pop()}`);
  writeStderr(`→ cwd: ${task.worktreePath}`);
  writeStderr(`→ running: ${cmd}`);

  try {
    execSync(cmd, {
      cwd: task.worktreePath,
      stdio: 'inherit',
      env: { ...process.env, TASK_WORKTREE: task.worktreePath },
    });
  } catch (err) {
    process.exitCode = err.status || 1;
  }
}

main();
