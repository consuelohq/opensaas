#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const path = require('path');
const { resolveGitRoot } = require('./lib/paths');
const { readValidTaskMetaForWorktree } = require('./lib/task-meta');
const { listWorktrees } = require('./lib/git');

function writeStdout(msg) { process.stdout.write(msg + '\n'); }
function writeStderr(msg) { process.stderr.write(msg + '\n'); }

function showHelp() {
  writeStdout('task:fs — file operations inside the active task worktree');
  writeStdout('');
  writeStdout('proxies all arguments to `bun run fs` with cwd set to the task worktree.');
  writeStdout('paths are relative to the worktree root, same as `bun run fs` from repo root.');
  writeStdout('');
  writeStdout('usage:');
  writeStdout('  bun run task:fs -- <fs-command> [args...]');
  writeStdout('  bun run task:fs -- --area dialer <fs-command> [args...]');
  writeStdout('');
  writeStdout('examples:');
  writeStdout('  bun run task:fs -- read packages/contacts/package.json');
  writeStdout('  bun run task:fs -- search "Sentry" packages/twenty-front/src/');
  writeStdout('  bun run task:fs -- patch packages/twenty-front/vite.config.ts --from 250 --to 260');
  writeStdout('  bun run task:fs -- write packages/contacts/src/new.ts --content "export const x = 1;"');
  writeStdout('  bun run task:fs -- --area clean-up list packages/ --tree');
}

function findActiveTask(repoRoot, area) {
  const worktrees = listWorktrees(repoRoot);
  const tasks = [];

  for (const wt of worktrees) {
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

  if (rawArgs.length === 0 || (rawArgs.length === 1 && (rawArgs[0] === '--help' || rawArgs[0] === '-h'))) {
    showHelp();
    return;
  }

  let area = null;
  let fsArgs = [];
  let i = 0;

  while (i < rawArgs.length) {
    if (rawArgs[i] === '--area' && i + 1 < rawArgs.length) {
      area = rawArgs[i + 1];
      i += 2;
    } else {
      fsArgs = rawArgs.slice(i);
      break;
    }
  }

  if (fsArgs.length === 0) {
    writeStderr('error: no fs command provided');
    writeStderr('usage: bun run task:fs -- read <file>');
    process.exitCode = 1;
    return;
  }

  // pass --help through to fs.js
  if (fsArgs.includes('--help') || fsArgs.includes('-h')) {
    showHelp();
    return;
  }

  const repoRoot = resolveGitRoot(process.cwd());
  const task = findActiveTask(repoRoot, area);
  const fsScript = path.join(repoRoot, 'packages/workspace/scripts/fs.js');

  writeStderr(`→ task: ${task.meta.area}/${task.meta.taskBranch.split('/').pop()}`);
  writeStderr(`→ cwd: ${task.worktreePath}`);

  // build the fs.js command with the worktree as cwd
  const escaped = fsArgs.map(a => a.includes(' ') ? `"${a}"` : a).join(' ');
  const cmd = `node ${fsScript} ${escaped}`;

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
