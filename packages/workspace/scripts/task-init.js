#!/usr/bin/env bun

// task-init.js — write or fix task metadata for an existing worktree
// use when metadata is stale or missing. does NOT create branches or worktrees.

const fs = require('fs');
const path = require('path');
const { resolvePrRefNumber } = require('./lib/pr-ref');
const { execSync } = require('child_process');

const { writeTaskMeta, readTaskMeta } = require('./lib/task-meta');

function writeStdout(s = '') { process.stdout.write(s + '\n'); }
function writeStderr(s = '') { process.stderr.write(s + '\n'); }

function printHelp() {
  writeStdout('task:init — write or fix task metadata for an existing worktree');
  writeStdout('');
  writeStdout('usage:');
  writeStdout('  bun run task:init -- --area dialer --branch task/dialer/fix-thing --pr 173');
  writeStdout('  bun run task:init -- --area dialer --branch task/dialer/fix-thing --pr 173 --worktree /private/tmp/opensaas-worktrees/task-dialer-fix-thing');
  writeStdout('');
  writeStdout('required:');
  writeStdout('  --area <name>          stream area (e.g. dialer)');
  writeStdout('  --branch <name>        task branch (e.g. task/dialer/fix-thing)');
  writeStdout('');
  writeStdout('optional:');
  writeStdout('  --pr <number-or-url>  PR number or supported PR URL');
  writeStdout('  --github <url>       GitHub, Graphite, or diffs PR URL');
  writeStdout('  --worktree <path>      worktree path (default: detect from git worktree list)');
  writeStdout('  --stream <branch>      stream branch (default: stream/<area>)');
  writeStdout('  --json                 json output');
  writeStdout('  --help                 show this help');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help') { args.help = true; continue; }
    if (flag === '--json') { args.json = true; continue; }
    if (!flag.startsWith('--')) throw new Error(`unexpected argument: ${flag}`);
    const val = argv[++i];
    if (!val || val.startsWith('--')) throw new Error(`missing value for ${flag}`);
    switch (flag) {
      case '--area': args.area = val; break;
      case '--branch': args.branch = val; break;
      case '--pr':
      case '--github': args.pr = resolvePrRefNumber(val); break;
      case '--worktree': args.worktree = val; break;
      case '--stream': args.stream = val; break;
      default: throw new Error(`unknown flag: ${flag}`);
    }
  }
  return args;
}

function detectWorktree(branch) {
  try {
    const out = execSync('git worktree list --porcelain', { encoding: 'utf8', cwd: process.cwd() });
    const worktrees = [];
    let current = {};
    for (const line of out.split('\n')) {
      if (line.startsWith('worktree ')) current.path = line.slice(9);
      else if (line.startsWith('branch ')) current.branch = line.slice(7).replace('refs/heads/', '');
      else if (line === '') { if (current.path) worktrees.push(current); current = {}; }
    }
    if (current.path) worktrees.push(current);
    const match = worktrees.find((w) => w.branch === branch);
    return match ? match.path : null;
  } catch { return null; }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }

  if (!args.area) throw new Error('missing required --area');
  if (!args.branch) throw new Error('missing required --branch');

  const stream = args.stream || `stream/${args.area}`;
  const worktreePath = args.worktree || detectWorktree(args.branch);

  if (!worktreePath) {
    throw new Error(
      `could not detect worktree for branch ${args.branch}.\n` +
      'pass --worktree <path> explicitly, or check: git worktree list',
    );
  }

  if (!fs.existsSync(worktreePath)) {
    throw new Error(`worktree path does not exist: ${worktreePath}`);
  }

  const repo = 'consuelohq/opensaas';
  const prUrl = args.pr ? `https://github.com/${repo}/pull/${args.pr}` : '';

  const meta = {
    area: args.area,
    stream,
    taskBranch: args.branch,
    baseBranch: stream,
    sourceBranch: 'main',
    startFrom: 'main',
    prNumber: args.pr || null,
    prUrl,
    worktreePath,
    createdAt: new Date().toISOString(),
  };

  writeTaskMeta(worktreePath, meta);

  // verify
  const verify = readTaskMeta(worktreePath);
  if (!verify || verify.taskBranch !== args.branch) {
    throw new Error('failed to write task metadata — check disk permissions');
  }

  if (args.json) {
    writeStdout(JSON.stringify(meta, null, 2));
  } else {
    writeStdout(`wrote task metadata in ${worktreePath}`);
    writeStdout(`  area: ${meta.area}`);
    writeStdout(`  branch: ${meta.taskBranch}`);
    writeStdout(`  stream: ${meta.stream}`);
    writeStdout(`  pr: ${meta.prUrl || '(none)'}`);
  }
}

main();
