#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const { resolveGitRoot } = require('./lib/paths');
const { findActiveTaskResult, parseTaskSelectorPrefix } = require('./lib/task-selection');

function writeStdout(message = '') { process.stdout.write(`${message}\n`); }
function writeStderr(message = '') { process.stderr.write(`${message}\n`); }

function showHelp() {
  writeStdout('task:exec — run a command inside the active task worktree');
  writeStdout('');
  writeStdout('usage:');
  writeStdout('  bun run task:exec -- <command...>');
  writeStdout('  bun run task:exec -- --area dialer <command...>');
  writeStdout('  bun run task:exec -- --branch task/dialer/fix-thing <command...>');
  writeStdout('  bun run task:exec -- --pr 209 <command...>');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --area <name>        select task by area');
  writeStdout('  --branch <branch>    select exact task branch');
  writeStdout('  --pr <number>        select task by pr number');
  writeStdout('  --help               show this help');
  writeStdout('');
  writeStdout('examples:');
  writeStdout('  bun run task:exec -- --branch task/workspace-agents/tighten-exact-task-command-selection git diff');
  writeStdout('  bun run task:exec -- --pr 210 npx nx typecheck twenty-front');
}

function main() {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.length === 0 || (rawArgs.length === 1 && (rawArgs[0] === '--help' || rawArgs[0] === '-h'))) {
    showHelp();
    return;
  }

  let parsed;
  try {
    parsed = parseTaskSelectorPrefix(rawArgs);
  } catch {
    writeStderr('error: invalid task selector');
    process.exitCode = 1;
    return;
  }

  const commandArgs = parsed.remainingArgs;
  if (commandArgs.length === 0) {
    writeStderr('error: no command provided');
    writeStderr('usage: bun run task:exec -- <command...>');
    process.exitCode = 1;
    return;
  }

  const repoRoot = resolveGitRoot(process.cwd());
  const selected = findActiveTaskResult(repoRoot, parsed.selector);
  if (selected.error) {
    writeStderr(`error: ${selected.error}`);
    process.exitCode = 1;
    return;
  }

  const task = selected.task;
  writeStderr(`→ task: ${task.meta.area}/${task.meta.taskBranch.split('/').pop()}`);
  writeStderr(`→ cwd: ${task.worktreePath}`);
  writeStderr(`→ running: ${commandArgs.join(' ')}`);

  const result = spawnSync(commandArgs[0], commandArgs.slice(1), {
    cwd: task.worktreePath,
    stdio: 'inherit',
    env: { ...process.env, TASK_WORKTREE: task.worktreePath },
  });

  process.exitCode = result.status || (result.error ? 1 : 0);
}

main();
