#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const { resolveGitRoot } = require('./lib/paths');
const { markFileRead } = require('./lib/state/evidence-log');
const { findActiveTaskResult, parseTaskSelectorPrefix } = require('./lib/task-selection');

function writeStdout(message = '') { process.stdout.write(`${message}\n`); }
function writeStderr(message = '') { process.stderr.write(`${message}\n`); }

function getReadTargets(fsArgs) {
  if (fsArgs[0] !== 'read') return [];

  const targets = [];
  for (const argument of fsArgs.slice(1)) {
    if (argument.startsWith('--')) break;
    if (argument === '.task/evidence-log.json' || argument === '.task/read-log.json') continue;
    targets.push(argument);
  }

  return targets;
}

function showHelp() {
  writeStdout('task:fs — file operations inside the active task worktree');
  writeStdout('');
  writeStdout('proxies all arguments to `bun run fs` with cwd set to the selected task worktree.');
  writeStdout('paths are relative to the worktree root, same as `bun run fs` from repo root.');
  writeStdout('');
  writeStdout('usage:');
  writeStdout('  bun run task:fs -- <fs-command> [args...]');
  writeStdout('  bun run task:fs -- --area dialer <fs-command> [args...]');
  writeStdout('  bun run task:fs -- --branch task/dialer/fix-thing <fs-command> [args...]');
  writeStdout('  bun run task:fs -- --pr 209 <fs-command> [args...]');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --area <name>        select task by area');
  writeStdout('  --branch <branch>    select exact task branch');
  writeStdout('  --pr <number>        select task by pr number');
  writeStdout('  --help               show this help');
  writeStdout('');
  writeStdout('examples:');
  writeStdout('  bun run task:fs -- --branch task/workspace-agents/tighten-exact-task-command-selection read packages/workspace/SCRIPTS.md');
  writeStdout('  bun run task:fs -- --pr 210 search "code.call" packages/workspace/scripts');
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

  const fsArgs = parsed.remainingArgs;
  if (fsArgs.length === 0) {
    writeStderr('error: no fs command provided');
    writeStderr('usage: bun run task:fs -- read <file>');
    process.exitCode = 1;
    return;
  }

  if (fsArgs.includes('--help') || fsArgs.includes('-h')) {
    showHelp();
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
  const fsScript = path.join(repoRoot, 'packages/os/scripts/fs.js');

  writeStderr(`→ task: ${task.meta.area}/${task.meta.taskBranch.split('/').pop()}`);
  writeStderr(`→ cwd: ${task.worktreePath}`);

  const result = spawnSync(process.execPath, [fsScript, ...fsArgs], {
    cwd: task.worktreePath,
    stdio: 'inherit',
    env: { ...process.env, TASK_WORKTREE: task.worktreePath },
  });

  if (result.status === 0) {
    for (const filePath of getReadTargets(fsArgs)) {
      try {
        markFileRead(task.worktreePath, filePath, {
          source: 'task:fs',
          task_branch: task.meta.taskBranch,
        });
      } catch {
        writeStderr(`warning: read evidence not recorded for ${filePath}`);
      }
    }
  }

  process.exitCode = result.status || (result.error ? 1 : 0);
}

main();
