#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { resolveGitRoot } = require('./lib/paths');
const { findActiveTaskResult, parseTaskSelectorPrefix } = require('./lib/task-selection');
const { readTaskSessionMetadata } = require('./lib/task-session');

function writeStdout(message = '') { process.stdout.write(`${message}\n`); }
function writeStderr(message = '') { process.stderr.write(`${message}\n`); }

function showHelp() {
  writeStdout('task:exec — run a command inside the active task tmux session');
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
  writeStdout('  --pr <number-or-url> select task by pr number or supported PR URL');
  writeStdout('  --github <url>       select task by GitHub, Graphite, or diffs PR URL');
  writeStdout('  --help               show this help');
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function formatCommandPreview(commandArgs) {
  const maxChars = 2000;
  const command = commandArgs.join(' ');
  if (command.length <= maxChars) return command;
  return `${command.slice(0, maxChars)}... [truncated ${command.length - maxChars} chars]`;
}

function runTmux(args, options = {}) {
  return spawnSync('tmux', args, {
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
  });
}

function tmuxSessionExists(tmuxSession) {
  const result = runTmux(['has-session', '-t', tmuxSession], { stdio: 'ignore' });
  return result.status === 0;
}

function executeInTmux({ tmuxSession, worktreePath, taskBranch, commandArgs }) {
  if (!tmuxSessionExists(tmuxSession)) {
    throw new Error(`tmux session not found for task: ${tmuxSession}`);
  }

  const token = `opensaas-task-exec-${process.pid}-${Date.now()}`;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opensaas-task-exec-'));

  try {
    const stdoutPath = path.join(tempDir, 'stdout.log');
    const stderrPath = path.join(tempDir, 'stderr.log');
    const statusPath = path.join(tempDir, 'status');
    const scriptPath = path.join(tempDir, 'command.sh');
    const command = commandArgs.map(shellQuote).join(' ');
    const script = [
      '#!/usr/bin/env bash',
      'set +e',
      `${command} > ${shellQuote(stdoutPath)} 2> ${shellQuote(stderrPath)}`,
      'status=$?',
      `printf '%s\n' "$status" > ${shellQuote(statusPath)}`,
      `tmux wait-for -S ${shellQuote(token)}`,
      'exit "$status"',
      '',
    ].join('\n');
    fs.writeFileSync(scriptPath, script, { mode: 0o700 });

    const start = runTmux([
      'new-window',
      '-d',
      '-t',
      tmuxSession,
      '-c',
      worktreePath,
      'env',
      `TASK_BRANCH=${taskBranch}`,
      `TASK_WORKTREE=${worktreePath}`,
      'bash',
      scriptPath,
    ]);
    if (start.status !== 0) {
      const detail = start.stderr || start.stdout || `exit ${start.status}`;
      throw new Error(`failed to execute command in tmux session ${tmuxSession}: ${detail}`);
    }

    const wait = runTmux(['wait-for', token]);
    if (wait.status !== 0) {
      const detail = wait.stderr || wait.stdout || `exit ${wait.status}`;
      throw new Error(`failed waiting for tmux task command ${tmuxSession}: ${detail}`);
    }

    const stdout = fs.existsSync(stdoutPath) ? fs.readFileSync(stdoutPath, 'utf8') : '';
    const stderr = fs.existsSync(stderrPath) ? fs.readFileSync(stderrPath, 'utf8') : '';
    const statusText = fs.existsSync(statusPath) ? fs.readFileSync(statusPath, 'utf8').trim() : '1';
    const status = Number.parseInt(statusText, 10);

    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);

    return Number.isFinite(status) ? status : 1;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
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
  const metadata = readTaskSessionMetadata(task.worktreePath);
  const tmuxSession = metadata && typeof metadata.tmuxSession === 'string' ? metadata.tmuxSession : undefined;
  if (!tmuxSession) {
    writeStderr(`error: task ${task.meta.taskBranch || task.branch} does not have tmux session metadata`);
    process.exitCode = 1;
    return;
  }

  writeStderr(`→ task: ${task.meta.area}/${task.meta.taskBranch.split('/').pop()}`);
  writeStderr(`→ tmux: ${tmuxSession}`);
  writeStderr(`→ cwd: ${task.worktreePath}`);
  writeStderr(`→ running: ${formatCommandPreview(commandArgs)}`);

  try {
    process.exitCode = executeInTmux({
      tmuxSession,
      worktreePath: task.worktreePath,
      taskBranch: task.meta.taskBranch || task.branch,
      commandArgs,
    });
  } catch (error) {
    writeStderr(`error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

main();
