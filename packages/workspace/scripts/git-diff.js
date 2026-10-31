#!/usr/bin/env node
'use strict';

const { execFileSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

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
    task: false,
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
    else if (argument === '--task') args.task = true;
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
  if (args.task && (!args.base || args.head)) throw new Error('--task requires --base without --head');

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
  writeStdout('  bun run git:diff -- --task --base origin/stream/os --json  (complete task changes)');
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
  if (args.task) return [args.base];
  if (args.base && args.head) return [`${args.base}...${args.head}`];
  if (args.base) return [`${args.base}...HEAD`];
  if (args.head) return [args.head];
  return ['HEAD'];
}

function diffArgs(args, extra = []) {
  const gitArgs = ['-c', 'core.quotePath=false', 'diff', '--no-ext-diff', '--find-renames', ...extra, ...revisionArgs(args)];
  if (args.paths.length > 0) gitArgs.push('--', ...args.paths);
  return gitArgs;
}

function isWorkingTreeMode(args) {
  return (!args.base && !args.head) || args.task;
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
  return runGit(cwd, ['ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter(Boolean)
    .filter((filePath) => pathMatchesFilters(filePath, args.paths));
}

const MAX_UNTRACKED_TEXT_BYTES = 8 * 1024 * 1024;

function describeUntracked(cwd, filePath) {
  const absolute = path.join(cwd, filePath);
  const entry = fs.lstatSync(absolute);
  if (entry.isSymbolicLink()) {
    // Never follow an untracked symlink into a different worktree or a secret.
    const link = fs.readlinkSync(absolute);
    return { path: filePath, text: link, additions: 1, binary: false, mode: '120000', symlink: true };
  }
  if (!entry.isFile() || entry.size > MAX_UNTRACKED_TEXT_BYTES) {
    return { path: filePath, text: null, additions: null, binary: true, mode: '100644', oversized: entry.size > MAX_UNTRACKED_TEXT_BYTES };
  }
  const buffer = fs.readFileSync(absolute);
  if (buffer.includes(0)) {
    return { path: filePath, text: null, additions: null, binary: true, mode: '100644' };
  }
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return { path: filePath, text: null, additions: null, binary: true, mode: '100644' };
  }
  return { path: filePath, text, additions: countContentLines(text), binary: false, mode: '100644' };
}

function countContentLines(content) {
  if (!content) return 0;
  const lines = content.split(/\r?\n/);
  return lines.at(-1) === '' ? lines.length - 1 : lines.length;
}

function quoteGitPath(prefix, filePath) {
  const name = prefix + filePath;
  return /[\t\n"\\]/.test(name) ? JSON.stringify(name) : name;
}

function untrackedFilePatch(info) {
  const name = info.path;
  const header = [
    'diff --git ' + quoteGitPath('a/', name) + ' ' + quoteGitPath('b/', name),
    'new file mode ' + info.mode,
    'index 0000000..0000000',
  ];
  if (info.binary) {
    return header.concat('Binary files /dev/null and ' + quoteGitPath('b/', name) + ' differ').join('\n');
  }
  const text = info.text || '';
  const lines = text.split(/\r?\n/);
  const comparable = lines.at(-1) === '' ? lines.slice(0, -1) : lines;
  const count = comparable.length;
  return header.concat(
    '--- /dev/null',
    '+++ ' + quoteGitPath('b/', name),
    '@@ -0,0 +1,' + count + ' @@',
    ...comparable.map((line) => '+' + line),
  ).join('\n');
}

function untrackedFilesPatch(files) {
  return files.map(untrackedFilePatch).join('\n');
}

function untrackedNumstat(files) {
  return files.map((info) => ({
    path: info.path,
    additions: info.additions,
    deletions: info.binary ? null : 0,
    status: 'A',
    ...(info.binary ? { binary: true } : {}),
    ...(info.symlink ? { symlink: true } : {}),
    ...(info.oversized ? { oversized: true } : {}),
  }));
}

function combinePatch(trackedPatch, untrackedPatch) {
  if (!trackedPatch) return untrackedPatch;
  if (!untrackedPatch) return trackedPatch;
  return `${trackedPatch.replace(/\s+$/, '')}\n${untrackedPatch}`;
}

function capText(text, maxBytes) {
  const buffer = Buffer.from(text, 'utf8');
  if (buffer.length <= maxBytes) return { text, truncated: false, bytes: buffer.length };
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let preview = '';
  for (let end = maxBytes; end >= Math.max(0, maxBytes - 4); end -= 1) {
    try {
      preview = decoder.decode(buffer.subarray(0, end));
      break;
    } catch {
      // Cap may fall inside a multi-byte character; clip to its beginning.
    }
  }
  return {
    text: preview,
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

function parseNumstatZ(text) {
  const records = [];
  const fields = text.split('\0');
  for (let index = 0; index < fields.length;) {
    const entry = fields[index++];
    if (!entry) continue;
    const match = entry.match(/^(-|\d+)\t(-|\d+)\t(.*)$/s);
    if (!match) throw new Error('invalid NUL-delimited Git numstat entry');
    const renamed = match[3] === '';
    const oldPath = renamed ? fields[index++] : undefined;
    const filePath = renamed ? fields[index++] : match[3];
    if (!filePath) throw new Error('invalid NUL-delimited Git numstat rename');
    records.push({
      path: filePath,
      additions: match[1] === '-' ? null : Number(match[1]),
      deletions: match[2] === '-' ? null : Number(match[2]),
      ...(oldPath !== undefined ? { oldPath } : {}),
    });
  }
  return records;
}

function parseNameStatusZ(text) {
  const records = [];
  const fields = text.split('\0');
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (!status) continue;
    const renamed = status.startsWith('R') || status.startsWith('C');
    const oldPath = renamed ? fields[index++] : undefined;
    const filePath = fields[index++];
    if (!filePath) throw new Error('invalid NUL-delimited Git status entry');
    records.push({
      status,
      path: filePath,
      ...(oldPath !== undefined ? { oldPath } : {}),
    });
  }
  return records;
}

function mergeFiles(numstat, statuses) {
  const statusByPath = new Map(statuses.map((item) => [item.path, item]));
  return numstat.map((item) => ({
    ...item,
    status: statusByPath.get(item.path)?.status || 'M',
    oldPath: statusByPath.get(item.path)?.oldPath,
  }));
}

function parseGitDiffHeader(line) {
  if (!line.startsWith('diff --git ')) return null;
  const body = line.slice('diff --git '.length);

  // Git quotes only the filename that needs escaping: an unquoted old path
  // can coexist with a C-quoted new path (especially for tabs/newlines).
  const quotedNew = body.match(/^(.*) ("b\/(?:\\.|[^"\\])*")$/);
  const quotedOld = !quotedNew && body.match(/^("(?:\\.|[^"\\])*") (.*)$/);
  let oldName;
  let newName;
  if (quotedNew) {
    oldName = quotedNew[1];
    newName = quotedNew[2];
  } else if (quotedOld) {
    oldName = quotedOld[1];
    newName = quotedOld[2];
  } else {
    const boundary = body.lastIndexOf(' b/');
    if (boundary < 0) return null;
    oldName = body.slice(0, boundary);
    newName = body.slice(boundary + 1);
  }

  try {
    const decode = (name) => name.startsWith('"') ? JSON.parse(name) : name;
    oldName = decode(oldName);
    newName = decode(newName);
  } catch {
    return null;
  }
  return typeof oldName === 'string' && oldName.startsWith('a/')
    && typeof newName === 'string' && newName.startsWith('b/')
      ? { oldPath: oldName.slice(2), path: newName.slice(2) }
      : null;
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
    const header = parseGitDiffHeader(line);
    if (header) {
      finishFile();
      currentFile = { ...header, hunks: [] };
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
  const untracked = listUntrackedFiles(worktree, args).map((name) => describeUntracked(worktree, name));
  const needPatch = Boolean(args.hunks || args.patch);
  const trackedPatchRaw = needPatch
    ? runGit(worktree, diffArgs(args, ['--unified=' + args.context]))
    : '';
  const patchRaw = combinePatch(trackedPatchRaw, needPatch ? untrackedFilesPatch(untracked) : '');
  const cappedPatch = capText(patchRaw, args.maxBytes);

  const needMetadata = Boolean(args.stat || args.files || args.nameOnly);
  const trackedNumstat = needMetadata ? parseNumstatZ(runGit(worktree, diffArgs(args, ['--numstat', '-z']))) : [];
  const trackedStatuses = needMetadata ? parseNameStatusZ(runGit(worktree, diffArgs(args, ['--name-status', '-z']))) : [];
  const trackedFiles = needMetadata ? mergeFiles(trackedNumstat, trackedStatuses) : [];
  const fileStats = needMetadata ? trackedFiles.concat(untrackedNumstat(untracked)) : [];

  const output = {
    branch: args.branch || runGit(worktree, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(),
    worktree,
    base: args.base || null,
    head: args.head || (args.base && !args.task ? 'HEAD' : null),
    mode: args.task ? 'task' : args.base || args.head ? 'revision' : 'working-tree',
    summary: args.stat ? {
      filesChanged: fileStats.length,
      insertions: fileStats.reduce((sum, file) => sum + (file.additions || 0), 0),
      deletions: fileStats.reduce((sum, file) => sum + (file.deletions || 0), 0),
    } : undefined,
    files: args.files ? fileStats : undefined,
    nameOnly: args.nameOnly ? [...new Set(fileStats.map((file) => file.path))] : undefined,
    // No partial hunks are reported as complete when the byte cap cuts a diff.
    hunks: args.hunks ? (cappedPatch.truncated ? [] : parseHunks(cappedPatch.text)) : undefined,
    patch: args.patch ? cappedPatch.text : undefined,
    truncated: cappedPatch.truncated,
    bytes: cappedPatch.bytes,
    notes: cappedPatch.truncated
      ? ['diff output truncated to ' + args.maxBytes + ' bytes; structured hunks omitted because the patch is incomplete']
      : [],
  };

  if (args.json) writeStdout(JSON.stringify(output, null, 2));
  else {
    if (output.summary) writeStdout(output.summary.filesChanged + ' files changed, ' + output.summary.insertions + ' insertions, ' + output.summary.deletions + ' deletions');
    if (output.files) for (const file of output.files) writeStdout(file.status + '\t' + (file.additions ?? '-') + '\t' + (file.deletions ?? '-') + '\t' + file.path);
    if (output.patch) writeStdout(output.patch);
  }
}


try {
  main();
} catch (error) {
  writeStderr(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
