#!/usr/bin/env node
'use strict';

const { execFileSync, spawnSync } = require('child_process');

function writeStdout(value = '') { process.stdout.write(`${value}\n`); }
function writeStderr(value = '') { process.stderr.write(`${value}\n`); }

function parseArgs(argv) {
  const args = { files: [], json: false, stopOnFirstError: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--branch') args.branch = readFlagValue(argv, ++index, '--branch');
    else if (argument === '--files') {
      while (argv[index + 1] && !argv[index + 1].startsWith('--')) args.files.push(argv[++index]);
    } else if (argument === '--stop-on-first-error') args.stopOnFirstError = true;
    else if (argument === '--json') args.json = true;
    else if (argument === '--help') args.help = true;
    else if (!argument.startsWith('--')) args.files.push(argument);
    else throw new Error(`unknown argument: ${argument}`);
  }
  return args;
}

function readFlagValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function showHelp() {
  writeStdout('usage: bun run check-files -- --branch task/... --files src/a.js src/b.js --json');
  writeStdout('');
  writeStdout('runs node --check for each file through code.call in the task worktree.');
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\''`)}'`;
}

function runCheck(args, file) {
  const taskWorktree = process.env.TASK_WORKTREE;
  const input = {
    language: 'bash',
    mode: 'verify',
    ...(args.branch ? { branch: args.branch } : {}),
    ...(taskWorktree ? { taskWorktree, cwd: taskWorktree } : {}),
    code: `node --check ${shellQuote(file)}`,
    timeout: 120000,
    maxResultChars: 40000,
  };
  const command = ['run', 'code-call', '--', JSON.stringify(input)];

  const result = spawnSync('bun', command, {
    cwd: resolveControllerRoot(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    file,
    ok: result.status === 0,
    exitCode: result.status || (result.error ? 1 : 0),
    stdout: result.stdout || '',
    stderr: result.stderr || (result.error ? result.error.message : ''),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    showHelp();
    return;
  }

  if (args.files.length === 0) {
    throw new Error('provide at least one file with --files');
  }

  const results = [];
  for (const file of args.files) {
    const result = runCheck(args, file);
    results.push(result);
    if (!result.ok && args.stopOnFirstError) break;
  }

  const output = {
    ok: results.every((result) => result.ok),
    results,
  };

  if (args.json) {
    writeStdout(JSON.stringify(output, null, 2));
  } else {
    for (const result of results) {
      writeStdout(`${result.ok ? 'ok' : 'fail'} ${result.file}`);
      if (!result.ok) writeStderr(result.stderr.trim());
    }
  }

  if (!output.ok) process.exitCode = 1;
}

function resolveControllerRoot() {
  try {
    const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const match = output.match(/^worktree (.+)$/m);
    return match?.[1] || process.cwd();
  } catch {
    return process.cwd();
  }
}

try {
  main();
} catch (error /*: unknown */) {
  writeStderr(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
