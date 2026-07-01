#!/usr/bin/env node
'use strict';

const { execFileSync, spawnSync } = require('child_process');
const path = require('path');

function writeStdout(value = '') { process.stdout.write(`${value}\n`); }
function writeStderr(value = '') { process.stderr.write(`${value}\n`); }

function readFlagValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function parseArgs(argv) {
  const args = {
    json: false,
    stat: false,
    files: false,
    hunks: false,
    patch: false,
    nameOnly: false,
    context: 3,
    maxBytes: 20000,
    paths: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--branch') args.branch = readFlagValue(argv, ++index, '--branch');
    else if (argument === '--base') args.base = readFlagValue(argv, ++index, '--base');
    else if (argument === '--head') args.head = readFlagValue(argv, ++index, '--head');
    else if (argument === '--stat') args.stat = true;
    else if (argument === '--files') args.files = true;
    else if (argument === '--hunks') args.hunks = true;
    else if (argument === '--patch') args.patch = true;
    else if (argument === '--name-only') args.nameOnly = true;
    else if (argument === '--context') args.context = Number.parseInt(readFlagValue(argv, ++index, '--context'), 10);
    else if (argument === '--max-bytes') args.maxBytes = Number.parseInt(readFlagValue(argv, ++index, '--max-bytes'), 10);
    else if (argument === '--paths') {
      while (argv[index + 1] && !argv[index + 1].startsWith('--')) args.paths.push(argv[++index]);
    } else if (argument === '--json') args.json = true;
    else if (argument === '--help') args.help = true;
    else if (!argument.startsWith('--')) args.paths.push(argument);
    else throw new Error(`unknown argument: ${argument}`);
  }

  if (!Number.isInteger(args.context) || args.context < 0) throw new Error('--context must be a non-negative integer');
  if (!Number.isInteger(args.maxBytes) || args.maxBytes <= 0) throw new Error('--max-bytes must be a positive integer');

  if (!args.stat && !args.files && !args.hunks && !args.patch && !args.nameOnly) {
    args.stat = true;
    args.files = true;
    args.hunks = true;
  }

  return args;
}

function showHelp() {
  writeStdout('git:diff — structured, bounded git diff output for agents');
  writeStdout('');
  writeStdout('usage:');
  writeStdout('  bun run git:diff -- --branch task/... --base origin/main --files --hunks --json');
  writeStdout('  bun run git:diff -- --patch --max-bytes 20000 --json');
  writeStdout('');
  writeStdout('defaults: no base/head reads working tree diff; base without head compares base...HEAD.');
}

function runGit(cwd, args, options = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: options.maxBuffer || 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim();
    throw new Error(`git ${args.join(' ')} failed: ${detail}`);
  }

  return result.stdout || '';
}

function resolveGitRoot(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return cwd;
  }
}

function parseWorktrees(output) {
  const worktrees = [];
  let current = null;
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) {
      if (current) worktrees.push(current);
      current = null;
      continue;
    }
    const [key, ...rest] = line.split(' ');
    const value = rest.join(' ');
    if (key === 'worktree') current = { path: value, branch: '' };
    else if (current && key === 'branch') current.branch = value.replace(/^refs\/heads\//, '');
    else if (current && key === 'detached') current.branch = 'HEAD';
  }
  if (current) worktrees.push(current);
  return worktrees;
}

function resolveWorktree(cwd, branch) {
  const repoRoot = resolveGitRoot(cwd);
  if (!branch) return repoRoot;
  const output = runGit(repoRoot, ['worktree', 'list', '--porcelain']);
  const match = parseWorktrees(output).find((worktree) => worktree.branch === branch);
  if (!match) throw new Error(`worktree not found for branch ${branch}`);
  return match.path;
}

function revisionArgs(args) {
  if (args.base && args.head) return [`${args.base}...${args.head}`];
  if (args.base) return [`${args.base}...HEAD`];
  if (args.head) return [args.head];
  return [];
}

function diffArgs(args, extra = []) {
  const gitArgs = ['diff', '--no-ext-diff', ...extra, ...revisionArgs(args)];
  if (args.paths.length > 0) gitArgs.push('--', ...args.paths);
  return gitArgs;
}

function isWorkingTreeMode(args) {
  return !args.base && !args.head;
}

function pathMatchesFilters(filePath, paths) {
  if (!paths.length) return true;
  return paths.some((filterPath) => {
    const normalized = filterPath.replace(/\/$/, '');
    return filePath === normalized || filePath.startsWith(`${normalized}/`);
  });
}

function listUntrackedFiles(cwd, args) {
  if (!isWorkingTreeMode(args)) return [];
  return runGit(cwd, ['ls-files', '--others', '--exclude-standard'])
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((filePath) => pathMatchesFilters(filePath, args.paths));
}

function readFileFromWorktree(cwd, filePath) {
  return require('fs').readFileSync(path.join(cwd, filePath), 'utf8');
}

function countContentLines(content) {
  if (!content) return 0;
  const lines = content.split(/\r?\n/);
  return lines.at(-1) === '' ? lines.length - 1 : lines.length;
}

function untrackedFilePatch(cwd, filePath) {
  const content = readFileFromWorktree(cwd, filePath);
  const lines = content.split(/\r?\n/);
  const comparableLines = lines.at(-1) === '' ? lines.slice(0, -1) : lines;
  const lineCount = Math.max(comparableLines.length, 1);
  const body = comparableLines.map((line) => `+${line}`).join('\n');
  return [
    `diff --git a/${filePath} b/${filePath}`,
    'new file mode 100644',
    'index 0000000..0000000',
    '--- /dev/null',
    `+++ b/${filePath}`,
    `@@ -0,0 +1,${lineCount} @@`,
    body,
  ].filter(Boolean).join('\n');
}

function untrackedFilesPatch(cwd, files) {
  return files.map((filePath) => untrackedFilePatch(cwd, filePath)).join('\n');
}

function untrackedNumstat(cwd, files) {
  return files.map((filePath) => {
    const content = readFileFromWorktree(cwd, filePath);
    return { path: filePath, additions: countContentLines(content), deletions: 0, status: 'A' };
  });
}

function combinePatch(trackedPatch, untrackedPatch) {
  if (!trackedPatch) return untrackedPatch;
  if (!untrackedPatch) return trackedPatch;
  return `${trackedPatch.replace(/\s+$/, '')}\n${untrackedPatch}`;
}

function capText(text, maxBytes) {
  const buffer = Buffer.from(text, 'utf8');
  if (buffer.length <= maxBytes) return { text, truncated: false, bytes: buffer.length };
  return {
    text: buffer.subarray(0, maxBytes).toString('utf8'),
    truncated: true,
    bytes: buffer.length,
  };
}

function parseShortStat(text) {
  const files = Number.parseInt(text.match(/(\d+) files? changed/)?.[1] || '0', 10);
  const insertions = Number.parseInt(text.match(/(\d+) insertions?/)?.[1] || '0', 10);
  const deletions = Number.parseInt(text.match(/(\d+) deletions?/)?.[1] || '0', 10);
  return { filesChanged: files, insertions, deletions };
}

function parseNumstat(text) {
  return text.split(/\r?\n/).filter(Boolean).map((line) => {
    const [added, deleted, ...rest] = line.split('\t');
    return {
      path: rest.join('\t'),
      additions: added === '-' ? null : Number.parseInt(added, 10),
      deletions: deleted === '-' ? null : Number.parseInt(deleted, 10),
    };
  });
}

function parseNameStatus(text) {
  return text.split(/\r?\n/).filter(Boolean).map((line) => {
    const parts = line.split('\t');
    const status = parts[0];
    const paths = parts.slice(1);
    return {
      status,
      path: paths[paths.length - 1] || '',
      oldPath: paths.length > 1 ? paths[0] : undefined,
    };
  });
}

function mergeFiles(numstat, statuses) {
  const statusByPath = new Map(statuses.map((item) => [item.path, item]));
  return numstat.map((item) => ({
    ...item,
    status: statusByPath.get(item.path)?.status || 'M',
    oldPath: statusByPath.get(item.path)?.oldPath,
  }));
}

function parseHunks(patch, maxPreviewChars = 1200) {
  const files = [];
  let currentFile = null;
  let currentHunk = null;

  const finishHunk = () => {
    if (!currentFile || !currentHunk) return;
    const preview = currentHunk.lines.join('\n');
    currentFile.hunks.push({
      oldStart: currentHunk.oldStart,
      oldLines: currentHunk.oldLines,
      newStart: currentHunk.newStart,
      newLines: currentHunk.newLines,
      header: currentHunk.header,
      preview: preview.length > maxPreviewChars ? `${preview.slice(0, maxPreviewChars)}\n…` : preview,
      lineCount: currentHunk.lines.length,
    });
    currentHunk = null;
  };

  const finishFile = () => {
    finishHunk();
    if (currentFile) files.push(currentFile);
    currentFile = null;
  };

  for (const line of patch.split(/\r?\n/)) {
    const fileMatch = line.match(/^diff --git a\/(.*) b\/(.*)$/);
    if (fileMatch) {
      finishFile();
      currentFile = { path: fileMatch[2], oldPath: fileMatch[1], hunks: [] };
      continue;
    }

    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
    if (hunkMatch && currentFile) {
      finishHunk();
      currentHunk = {
        oldStart: Number.parseInt(hunkMatch[1], 10),
        oldLines: Number.parseInt(hunkMatch[2] || '1', 10),
        newStart: Number.parseInt(hunkMatch[3], 10),
        newLines: Number.parseInt(hunkMatch[4] || '1', 10),
        header: hunkMatch[5].trim(),
        lines: [],
      };
      continue;
    }

    if (currentHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
      currentHunk.lines.push(line);
    }
  }

  finishFile();
  return files;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    showHelp();
    return;
  }

  const worktree = resolveWorktree(process.cwd(), args.branch);
  const untrackedFiles = listUntrackedFiles(worktree, args);
  const trackedPatchRaw = args.hunks || args.patch
    ? runGit(worktree, diffArgs(args, [`--unified=${args.context}`]))
    : '';
  const untrackedPatchRaw = args.hunks || args.patch ? untrackedFilesPatch(worktree, untrackedFiles) : '';
  const patchRaw = combinePatch(trackedPatchRaw, untrackedPatchRaw);
  const cappedPatch = capText(patchRaw, args.maxBytes);
  const trackedFiles = args.files ? mergeFiles(
    parseNumstat(runGit(worktree, diffArgs(args, ['--numstat']))),
    parseNameStatus(runGit(worktree, diffArgs(args, ['--name-status']))),
  ) : undefined;
  const untrackedFileStats = args.files ? untrackedNumstat(worktree, untrackedFiles) : undefined;
  const trackedNameOnly = args.nameOnly ? runGit(worktree, diffArgs(args, ['--name-only'])).split(/\r?\n/).filter(Boolean) : undefined;

  const output = {
    branch: args.branch || runGit(worktree, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(),
    worktree,
    base: args.base || null,
    head: args.head || (args.base ? 'HEAD' : null),
    mode: args.base || args.head ? 'revision' : 'working-tree',
    summary: args.stat ? (() => {
      const tracked = parseShortStat(runGit(worktree, diffArgs(args, ['--shortstat'])).trim());
      const untracked = untrackedNumstat(worktree, untrackedFiles);
      return {
        filesChanged: tracked.filesChanged + untracked.length,
        insertions: tracked.insertions + untracked.reduce((sum, file) => sum + (file.additions || 0), 0),
        deletions: tracked.deletions,
      };
    })() : undefined,
    files: args.files ? [...(trackedFiles || []), ...(untrackedFileStats || [])] : undefined,
    nameOnly: args.nameOnly ? [...(trackedNameOnly || []), ...untrackedFiles] : undefined,
    hunks: args.hunks ? parseHunks(cappedPatch.text) : undefined,
    patch: args.patch ? cappedPatch.text : undefined,
    truncated: cappedPatch.truncated,
    bytes: cappedPatch.bytes,
    notes: cappedPatch.truncated ? [`diff output truncated to ${args.maxBytes} bytes`] : [],
  };

  if (args.json) writeStdout(JSON.stringify(output, null, 2));
  else {
    if (output.summary) writeStdout(`${output.summary.filesChanged} files changed, ${output.summary.insertions} insertions, ${output.summary.deletions} deletions`);
    if (output.files) for (const file of output.files) writeStdout(`${file.status}\t${file.additions ?? '-'}\t${file.deletions ?? '-'}\t${file.path}`);
    if (output.patch) writeStdout(output.patch);
  }
}

try {
  main();
} catch (error) {
  writeStderr(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
