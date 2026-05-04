#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

function writeStdout(value = '') { process.stdout.write(`${value}\n`); }
function writeStderr(value = '') { process.stderr.write(`${value}\n`); }

function parseArgs(argv) {
  const args = { searchPaths: [], json: false, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--branch') args.branch = readFlagValue(argv, ++index, '--branch');
    else if (argument === '--search-pattern') args.searchPattern = readFlagValue(argv, ++index, '--search-pattern');
    else if (argument === '--search-paths') {
      while (argv[index + 1] && !argv[index + 1].startsWith('--')) args.searchPaths.push(argv[++index]);
    } else if (argument === '--from') args.from = Number.parseInt(readFlagValue(argv, ++index, '--from'), 10);
    else if (argument === '--to') args.to = Number.parseInt(readFlagValue(argv, ++index, '--to'), 10);
    else if (argument === '--content-file') args.contentFile = readFlagValue(argv, ++index, '--content-file');
    else if (argument === '--dry-run') args.dryRun = true;
    else if (argument === '--json') args.json = true;
    else if (argument === '--help') args.help = true;
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
  writeStdout('usage: bun run edit-flow -- --branch task/... --search-pattern oldFn --search-paths src --from 1 --to 2 --content-file /tmp/new.ts --json');
  writeStdout('');
  writeStdout('runs search -> read -> patch -> read verification through task:fs.');
}

function runTaskFs(args, fsArgs) {
  const command = ['run', 'task:fs', '--'];
  if (args.branch) command.push('--branch', args.branch);
  command.push(...fsArgs);

  const result = spawnSync('bun', command, {
    cwd: resolveControllerRoot(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
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

  if (!args.searchPattern) throw new Error('missing --search-pattern');
  if (args.searchPaths.length === 0) throw new Error('missing --search-paths');
  if (!Number.isInteger(args.from) || !Number.isInteger(args.to)) throw new Error('missing --from/--to');
  if (!args.contentFile) throw new Error('missing --content-file');
  const resolvedContentFile = path.resolve(process.cwd(), args.contentFile);
  let contentFileStats;
  try {
    contentFileStats = fs.statSync(resolvedContentFile);
    fs.accessSync(resolvedContentFile, fs.constants.R_OK);
  } catch {
    throw new Error(`content file not found or not readable: ${args.contentFile}`);
  }

  if (!contentFileStats.isFile()) {
    throw new Error(`content file must be a regular file: ${args.contentFile}`);
  }

  const search = runTaskFs(args, ['search', args.searchPattern, ...args.searchPaths, '--json']);
  const searchData = search.ok ? parseJson(search.stdout, []) : [];
  const firstMatch = Array.isArray(searchData) ? searchData[0] : null;
  const pathFromSearch = firstMatch && typeof firstMatch.file === 'string' ? firstMatch.file : null;
  const targetPath = pathFromSearch || args.searchPaths[0];
  const before = runTaskFs(args, ['read', targetPath, '--from', String(args.from), '--to', String(args.to), '--json']);
  const patchArgs = ['patch', targetPath, '--from', String(args.from), '--to', String(args.to), '--content-file', resolvedContentFile];
  if (args.dryRun) patchArgs.push('--dry-run');
  const patch = runTaskFs(args, patchArgs);
  const after = args.dryRun ? null : runTaskFs(args, ['read', targetPath, '--from', String(args.from), '--to', String(args.to), '--json']);

  const output = {
    ok: search.ok && before.ok && patch.ok && (after === null || after.ok),
    targetPath,
    steps: { search, before, patch, after },
  };

  if (args.json) writeStdout(JSON.stringify(output, null, 2));
  else writeStdout(output.ok ? `patched ${targetPath}` : `edit flow failed for ${targetPath}`);

  if (!output.ok) process.exitCode = 1;
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
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
