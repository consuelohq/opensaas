#!/usr/bin/env bun

// fs.js — safe file operations for agents
// wraps bat (read), rg (search), and provides stdin-based write/apply-patch
// usage: bun run fs -- <read|search|write|apply-patch> [options]

const { execSync, execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { findTaskMeta, getTaskWorkpadPath } = require('./lib/task-meta');

const DEFAULT_CONTEXT = 3;
const SEARCH_EXCLUDES = ['node_modules', '.git', 'dist', 'build', '.next', 'out', '.cache'];

function out(s = '') { process.stdout.write(s + '\n'); }
function err(s = '') { process.stderr.write(s + '\n'); process.exitCode = 1; }

function readStdin() {
  try { return fs.readFileSync('/dev/stdin', 'utf8'); } catch { return ''; }
}

function resolve(p) { return path.resolve(process.cwd(), p); }

function which(bin) {
  try { return execSync(`which ${bin}`, { encoding: 'utf8' }).trim(); } catch { return null; }
}

// ── helpers shown contextually ──

function readHelp() {
  out('usage: bun run fs -- read <path> [--offset N] [--limit M] [path2 --offset N --limit M ...]');
  out('');
  out('read a bounded structured view of text or supported media for agent-safe ingestion.');
  out('');
  out('options:');
  out('  --offset N       start line (1-based, preferred)');
  out('  --limit M        max lines to return, capped at 2000');
  out('  --from N         alias for --offset');
  out('  --to M           alias that derives --limit from offset');
  out('  --files-json J   JSON array of { path, offset?, limit? } entries');
  out('  --plain          no line numbers for human text output');
  out('  --json           structured JSON output');
  out('');
  out('multi-file: each path starts a new segment with its own page options');
  out('  bun run fs -- read src/a.ts --offset 1 --limit 50 src/b.ts --offset 100 --limit 60 --json');
}

function searchHelp() {
  out('usage: bun run fs -- search <pattern> [paths...] [options]');
  out('');
  out('search files. wraps rg. excludes node_modules/.git/dist by default.');
  out('');
  out('options:');
  out('  --context N    lines of context around matches (default: 3)');
  out('  --files        filenames only (no content)');
  out('  --then-read    read ±context lines around top matches with line numbers');
  out('  --max-results N  cap number of matches');
  out('  --json         json output');
  out('  --include <glob>  file filter (e.g. "*.ts")');
}

function writeHelp() {
  out('usage: bun run fs -- write <path> [options]');
  out('');
  out('write a file. reads content from stdin by default.');
  out('');
  out('options:');
  out('  --stdin        read content from stdin (default)');
  out('  --content <t>       inline content (for short writes)');
  out('  --content-file <p>  read content from a file for multiline writes');
  out('  --force             overwrite existing file');
  out('  --append       append instead of overwrite');
  out('  --mkdirs       create parent directories');
  out('');
  out('examples:');
  out('  cat /tmp/new.ts | bun run fs -- write src/foo.ts --force');
  out('  bun run fs -- write src/foo.ts --content-file /tmp/new.ts --force');
  out('  echo "line" | bun run fs -- write src/foo.ts --append');
  out('  bun run fs -- write src/foo.ts --content "export const x = 1;" --mkdirs');
}


function applyPatchHelp() {
  out('usage: bun run fs -- apply-patch [options]');
  out('');
  out('apply an anchored patch file with embedded paths.');
  out('');
  out('options:');
  out('  --patch-file <p>  read patch text from a file');
  out('  --patch-text <t>  inline patch text for short patches');
  out('  --stdin           read patch text from stdin (default)');
  out('  --dry-run         parse and plan without applying changes');
  out('');
  out('supported markers:');
  out('  *** Begin Patch');
  out('  *** Update File: src/existing.ts');
  out('  *** Add File: src/new.ts');
  out('  *** Move to: src/renamed.ts');
  out('  *** Delete File: src/old.ts');
  out('  *** End Patch');
}

function mainHelp() {
  out('usage: bun run fs -- <command> [options]');
  out('');
  out('safe file operations for agents.');
  out('');
  out('commands:');
  out('  read    read files with line numbers and ranges');
  out('  search  search files (wraps rg)');
  out('  list    list/find files (wraps eza and fd)');
  out('  write   write files from stdin (no heredocs)');
  out('  apply-patch apply an anchored patch file');
  out('  http    make http requests (wraps xh)');
  out('  trash   safe delete (moves to trash, not rm)');
  out('');
  out('run any command with --help for details.');
}

// ── read ──

function parseReadSegments(argv) {
  const segments = [];
  let current = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--files-json') {
      let files;
      try {
        files = JSON.parse(argv[++i]);
      } catch {
        err('error: --files-json must be valid JSON');
        process.exitCode = 1;
        return null;
      }
      if (Array.isArray(files)) {
        for (const file of files) {
          if (file && typeof file.path === 'string') segments.push(file);
        }
      }
      current = null;
    }
    else if (a === '--from') { if (current) current.from = parseInt(argv[++i], 10); }
    else if (a === '--to') { if (current) current.to = parseInt(argv[++i], 10); }
    else if (a === '--offset') { if (current) current.offset = parseInt(argv[++i], 10); }
    else if (a === '--limit') { if (current) current.limit = parseInt(argv[++i], 10); }
    else if (a === '--all' || a === '--plain' || a === '--json') { /* handled globally */ }
    else if (!a.startsWith('--')) {
      current = { path: a };
      segments.push(current);
    }
  }
  return segments;
}

function renderTextPage(page, plain) {
  const lines = String(page.content || '').split('\n');
  if (page.content === '') return;
  lines.forEach((line, idx) => {
    const lineNum = page.offset + idx;
    out(plain ? line : `${String(lineNum).padStart(4)}: ${line}`);
  });
  if (page.truncated && page.next) out(`... truncated; next offset ${page.next}`);
}

async function cmdRead(argv) {
  if (argv.includes('--help') || argv.length === 0) { readHelp(); return; }

  const plain = argv.includes('--plain');
  const json = argv.includes('--json');
  const segments = parseReadSegments(argv);

  if (!segments) return;
  if (segments.length === 0) { err('error: no file path given'); readHelp(); return; }

  let result;
  try {
    const { readManyForCli } = await import('./lib/fs/read.ts');
    result = await readManyForCli(segments, { root: process.cwd() });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    err(`error: failed to read file: ${message}`);
    process.exitCode = 1;
    return;
  }

  if (json) {
    out(JSON.stringify(result, null, 2));
    return;
  }

  if (result && Array.isArray(result.results)) {
    for (const item of result.results) {
      out(`── ${item.path} ──`);
      if (!item.ok) {
        err(`${item.error.code}: ${item.error.message}`);
        continue;
      }
      if (item.page.type === 'text-page') renderTextPage(item.page, plain);
      else out(`${item.page.type}: ${item.page.message || item.page.mime || item.path}`);
    }
    return;
  }

  if (result.type === 'text-page') renderTextPage(result, plain);
  else if (result.type === 'error') err(`${result.code}: ${result.message}`);
  else out(`${result.type}: ${result.message || result.mime || result.path}`);
}

// ── search ──

function cmdSearch(argv) {
  if (argv.includes('--help') || argv.length === 0) { searchHelp(); return; }

  const json = argv.includes('--json');
  const filesOnly = argv.includes('--files');
  const thenRead = argv.includes('--then-read');
  let context = DEFAULT_CONTEXT;
  let maxResults = null;
  let include = null;

  // extract flags
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--context') { context = parseInt(argv[++i], 10); }
    else if (a === '--max-results') { maxResults = parseInt(argv[++i], 10); }
    else if (a === '--include') { include = argv[++i]; }
    else if (a === '--json' || a === '--files' || a === '--then-read') { /* skip */ }
    else { positional.push(a); }
  }

  const pattern = positional[0];
  const paths = positional.slice(1);
  if (!pattern) { err('error: search pattern required'); searchHelp(); return; }

  // build rg args
  const rgArgs = ['--color=always', '--line-number'];
  SEARCH_EXCLUDES.forEach((e) => rgArgs.push(`--glob=!${e}`));
  if (filesOnly) rgArgs.push('--files-with-matches');
  else rgArgs.push(`--context=${context}`);
  if (maxResults) rgArgs.push(`--max-count=${maxResults}`);
  if (include) rgArgs.push(`--glob=${include}`);
  rgArgs.push(pattern);
  if (paths.length > 0) rgArgs.push(...paths);

  const r = spawnSync('rg', rgArgs, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const output = (r.stdout || '').trimEnd();

  if (!output) { out('no matches'); return; }

  if (json && !thenRead) {
    // parse rg output into structured format
    const matches = [];
    output.split('\n').forEach((line) => {
      const m = line.replace(/\x1b\[[0-9;]*m/g, '').match(/^(.+?):(\d+):(.*)/);
      if (m) matches.push({ file: m[1], line: parseInt(m[2], 10), text: m[3].trim() });
    });
    out(JSON.stringify(matches, null, 2));
    return;
  }

  out(output);

  if (thenRead) {
    // re-run rg without color and with filename for reliable parsing
    const parseArgs = ['--color=never', '--line-number', '--with-filename'];
    SEARCH_EXCLUDES.forEach((e) => parseArgs.push(`--glob=!${e}`));
    if (maxResults) parseArgs.push(`--max-count=${maxResults}`);
    if (include) parseArgs.push(`--glob=${include}`);
    parseArgs.push(pattern);
    if (paths.length > 0) parseArgs.push(...paths);

    const pr = spawnSync('rg', parseArgs, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const parseOutput = (pr.stdout || '').trimEnd();

    const seen = new Map();
    parseOutput.split('\n').forEach((line) => {
      const m = line.match(/^(.+?):(\d+):/);
      if (m) {
        const f = m[1];
        const n = parseInt(m[2], 10);
        if (!seen.has(f)) seen.set(f, []);
        seen.get(f).push(n);
      }
    });

    out('');
    out('── then-read ──');
    for (const [file, lines] of seen) {
      const fp = resolve(file);
      if (!fs.existsSync(fp)) continue;
      const content = fs.readFileSync(fp, 'utf8').split('\n');
      // merge nearby ranges
      const sorted = [...new Set(lines)].sort((a, b) => a - b);
      const ranges = [];
      for (const n of sorted) {
        const from = Math.max(1, n - context);
        const to = Math.min(content.length, n + context);
        if (ranges.length > 0 && from <= ranges[ranges.length - 1].to + 2) {
          ranges[ranges.length - 1].to = to;
        } else {
          ranges.push({ from, to });
        }
      }
      for (const range of ranges) {
        out(`\n── ${file}:${range.from}-${range.to} ──`);
        for (let i = range.from; i <= range.to; i++) {
          out(`${String(i).padStart(4)}: ${content[i - 1]}`);
        }
      }
    }
  }
}

// ── list ──

function cmdList(argv) {
  if (argv.includes('--help') || argv.length === 0) {
    out('usage: bun run fs -- list [path] [options]');
    out('');
    out('list files and directories. wraps eza (list) and fd (find).');
    out('');
    out('modes:');
    out('  list [path]                list directory contents (eza)');
    out('  list [path] --tree         tree view (eza --tree)');
    out('  list [path] --find <name>  find files by name (fd)');
    out('');
    out('options:');
    out('  --tree                     show as tree');
    out('  --depth N                  max depth for tree/find (default: 3)');
    out('  --find <pattern>           find files matching pattern (uses fd)');
    out('  --dirs                     directories only');
    out('  --files                    files only');
    out('  --ext <ext>                filter by extension (fd mode)');
    out('  --hidden                   include hidden files');
    out('  --git                      show git status column');
    out('  --all                      include ignored files');
    return;
  }

  const args = [];
  let path = '.';
  let mode = 'eza'; // eza or fd
  let depth = null;
  let findPattern = null;
  let dirsOnly = false;
  let filesOnly = false;
  let ext = null;
  let hidden = false;
  let gitStatus = false;
  let showAll = false;
  let tree = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tree') tree = true;
    else if (a === '--depth') depth = parseInt(argv[++i], 10);
    else if (a === '--find') { mode = 'fd'; findPattern = argv[++i]; }
    else if (a === '--dirs') dirsOnly = true;
    else if (a === '--files') filesOnly = true;
    else if (a === '--ext') ext = argv[++i];
    else if (a === '--hidden') hidden = true;
    else if (a === '--git') gitStatus = true;
    else if (a === '--all') showAll = true;
    else if (!a.startsWith('-')) path = a;
  }

  if (mode === 'fd' || ext) {
    // fd mode — find files by name/pattern
    const cmd = ['fd'];
    if (findPattern) cmd.push(findPattern);
    else cmd.push('.'); // match everything
    cmd.push(path);
    if (depth) cmd.push('--max-depth', String(depth));
    else if (!depth) cmd.push('--max-depth', '3');
    if (dirsOnly) cmd.push('--type', 'd');
    if (filesOnly) cmd.push('--type', 'f');
    if (ext) cmd.push('--extension', ext);
    if (hidden) cmd.push('--hidden');
    try {
      const result = execFileSync(cmd[0], cmd.slice(1), { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      process.stdout.write(result);
    } catch (e) {
      if (e.stdout) process.stdout.write(e.stdout);
      else err('fd failed: ' + (e.message || ''));
    }
  } else {
    // eza mode — list directory
    const cmd = ['eza'];
    if (tree) {
      cmd.push('--tree');
      cmd.push('--level', String(depth || 3));
    } else {
      cmd.push('-la');
    }
    if (gitStatus) cmd.push('--git');
    if (hidden) cmd.push('-a');
    if (dirsOnly) cmd.push('--only-dirs');
    if (filesOnly) cmd.push('--only-files');
    cmd.push('--git-ignore');
    cmd.push(path);
    try {
      const result = execFileSync(cmd[0], cmd.slice(1), { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      process.stdout.write(result);
    } catch (e) {
      if (e.stdout) process.stdout.write(e.stdout);
      else err('eza failed: ' + (e.message || ''));
    }
  }
}

// ── write ──

async function readFilePayload({ inlineContent, contentFile }) {
  if (inlineContent !== null && contentFile !== null) {
    return {
      ok: false,
      type: 'error',
      code: 'INVALID_CONTENT_SOURCE',
      message: 'use exactly one of --content or --content-file',
    };
  }

  if (contentFile !== null) {
    try {
      const { readContentFileForCli } = await import('./lib/fs/write.ts');
      const result = await readContentFileForCli(contentFile, { cwd: process.cwd() });
      if (result && typeof result === 'object' && result.ok === false) return result;
      return { ok: true, content: result };
    } catch (error) {
      return {
        ok: false,
        type: 'error',
        code: 'CONTENT_FILE_NOT_READABLE',
        path: contentFile,
        message: `failed to read content file: ${error && error.message ? error.message : String(error)}`,
      };
    }
  }

  if (inlineContent !== null) return { ok: true, content: inlineContent };

  if (process.stdin.isTTY) {
    return {
      ok: false,
      type: 'error',
      code: 'INVALID_CONTENT_SOURCE',
      message: 'no content (pipe via stdin, use --content, or use --content-file)',
    };
  }

  const stdinContent = readStdin();
  if (stdinContent === '') {
    return {
      ok: false,
      type: 'error',
      code: 'INVALID_CONTENT_SOURCE',
      message: 'no content received on stdin',
    };
  }
  return { ok: true, content: stdinContent };
}

function renderWriteError(result, json) {
  process.exitCode = 1;
  if (json) {
    out(JSON.stringify(result, null, 2));
    return;
  }
  err(`${result.code || 'WRITE_FAILED'}: ${result.message || 'write failed'}`);
}

function renderWriteSuccess(result, json) {
  if (json) {
    out(JSON.stringify(result, null, 2));
    return;
  }
  if (result.operation === 'append') out(`appended to ${result.path}`);
  else out(`wrote ${result.path} (${result.lines} lines)`);
}

async function cmdWrite(argv) {
  if (argv.includes('--help') || argv.length === 0) { writeHelp(); return; }

  const force = argv.includes('--force');
  const append = argv.includes('--append');
  const mkdirs = argv.includes('--mkdirs');
  const json = argv.includes('--json');

  try {

    let inlineContent = null;
    let contentFile = null;
    let filePath = null;

    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === '--content') { inlineContent = argv[++i]; }
      else if (a === '--content-file') { contentFile = argv[++i]; }
      else if (a === '--force' || a === '--append' || a === '--mkdirs' || a === '--stdin' || a === '--json') { /* skip */ }
      else if (!a.startsWith('--') && !filePath) { filePath = a; }
    }

    if (!filePath) { err('error: file path required'); writeHelp(); return; }

    const payload = await readFilePayload({ inlineContent, contentFile });

    if (!payload.ok) {
      renderWriteError(payload, json);
      return;
    }

    const { writeFileForCli } = await import('./lib/fs/write.ts');
    const result = await writeFileForCli({ path: filePath, content: payload.content, force, append, mkdirs }, { root: process.cwd() });
    if (!result.ok) {
      renderWriteError(result, json);
      return;
    }

    renderWriteSuccess(result, json);

    // log to workpad if it exists
    logToWorkpad(result.path, result.operation === 'append' ? 'append' : 'write');
  } catch (error) {
    renderWriteError({
      ok: false,
      type: 'error',
      code: 'WRITE_FAILED',
      message: `write command failed: ${error && error.message ? error.message : String(error)}`,
    }, json);
  }
}

// ── removed patch command ──

function cmdPatch(argv) {
  err('error: fs.patch has been removed. Use bun run fs -- apply-patch --patch-file <file>, --patch-text <text>, or --stdin. Workspace tools should call fs.apply_patch.');
}

// ── apply-patch ──

function readPatchPayload({ patchText, patchFile }) {
  if (patchText !== null && patchFile !== null) {
    err('error: use exactly one of --patch-text or --patch-file');
    return null;
  }

  if (patchFile !== null) {
    const patchPath = path.resolve(process.cwd(), patchFile);
    try {
      const patchFileStats = fs.statSync(patchPath);
      fs.accessSync(patchPath, fs.constants.R_OK);
      if (!patchFileStats.isFile()) {
        err(`error: patch file must be a regular file: ${patchFile}`);
        return null;
      }
    } catch {
      err(`error: patch file not found or not readable: ${patchFile}`);
      return null;
    }
    return fs.readFileSync(patchPath, 'utf8');
  }

  if (patchText !== null) return patchText;

  if (process.stdin.isTTY) {
    err('error: no patch text (pipe via stdin, use --patch-text, or use --patch-file)');
    return null;
  }

  const stdinContent = readStdin();
  if (stdinContent === '') {
    err('error: no patch text received on stdin');
    return null;
  }
  return stdinContent;
}

function assertSafePatchPath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') throw new Error('unsafe patch path: empty path');
  if (path.isAbsolute(rawPath)) throw new Error(`unsafe patch path: ${rawPath}`);
  const parts = rawPath.split(/[\\/]+/).filter(Boolean);
  if (parts.includes('..') || parts.includes('.git')) throw new Error(`unsafe patch path: ${rawPath}`);
  const resolved = resolve(rawPath);
  const relative = path.relative(process.cwd(), resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`unsafe patch path: ${rawPath}`);
  return { rawPath, resolved };
}

function parsePatchHeader(line, prefix) {
  if (!line.startsWith(prefix)) return null;
  return line.slice(prefix.length).trim();
}

function isOperationMarker(line) {
  return line.startsWith('*** Update File: ')
    || line.startsWith('*** Add File: ')
    || line.startsWith('*** Delete File: ')
    || line.startsWith('*** End Patch');
}

function parseApplyPatch(patchText) {
  const lines = patchText.replace(/\r\n/g, '\n').split('\n');
  let index = 0;
  while (index < lines.length && lines[index].trim() === '') index += 1;
  if (lines[index] !== '*** Begin Patch') throw new Error('invalid patch: missing *** Begin Patch');
  index += 1;

  const operations = [];
  while (index < lines.length) {
    const line = lines[index];
    if (line === '*** End Patch') return operations;

    const addPath = parsePatchHeader(line, '*** Add File: ');
    if (addPath !== null) {
      index += 1;
      const content = [];
      while (index < lines.length && !isOperationMarker(lines[index])) {
        const contentLine = lines[index];
        if (contentLine === '') {
          index += 1;
          continue;
        }
        if (!contentLine.startsWith('+')) throw new Error(`invalid add-file line: ${contentLine}`);
        content.push(contentLine.slice(1));
        index += 1;
      }
      operations.push({ type: 'add', path: addPath, content });
      continue;
    }

    const deletePath = parsePatchHeader(line, '*** Delete File: ');
    if (deletePath !== null) {
      operations.push({ type: 'delete', path: deletePath });
      index += 1;
      continue;
    }

    const updatePath = parsePatchHeader(line, '*** Update File: ');
    if (updatePath !== null) {
      index += 1;
      const operation = { type: 'update', path: updatePath, moveTo: null, hunks: [] };
      let currentHunk = [];
      while (index < lines.length && !isOperationMarker(lines[index])) {
        const hunkLine = lines[index];
        const moveTo = parsePatchHeader(hunkLine, '*** Move to: ');
        if (moveTo !== null) {
          if (currentHunk.length > 0) {
            operation.hunks.push(currentHunk);
            currentHunk = [];
          }
          operation.moveTo = moveTo;
          index += 1;
          continue;
        }
        if (hunkLine.startsWith('@@')) {
          if (currentHunk.length > 0) {
            operation.hunks.push(currentHunk);
            currentHunk = [];
          }
          index += 1;
          continue;
        }
        if (hunkLine === '\\ No newline at end of file') {
          index += 1;
          continue;
        }
        const marker = hunkLine[0];
        if (marker !== ' ' && marker !== '+' && marker !== '-') {
          throw new Error(`invalid update hunk line: ${hunkLine}`);
        }
        currentHunk.push({ marker, text: hunkLine.slice(1) });
        index += 1;
      }
      if (currentHunk.length > 0) operation.hunks.push(currentHunk);
      if (operation.hunks.length === 0 && !operation.moveTo) throw new Error(`invalid update: no hunks for ${updatePath}`);
      operations.push(operation);
      continue;
    }

    if (line.trim() === '') {
      index += 1;
      continue;
    }
    throw new Error(`invalid patch marker: ${line}`);
  }

  throw new Error('invalid patch: missing *** End Patch');
}

function splitPatchFileContent(content) {
  const hasFinalNewline = content.endsWith('\n');
  const body = hasFinalNewline ? content.slice(0, -1) : content;
  return body === '' ? [] : body.split('\n');
}

function joinPatchFileContent(lines) {
  return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
}

function findSubsequence(lines, target, startIndex) {
  if (target.length === 0) return -1;
  for (let index = startIndex; index <= lines.length - target.length; index += 1) {
    let matched = true;
    for (let offset = 0; offset < target.length; offset += 1) {
      if (lines[index + offset] !== target[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return index;
  }
  return -1;
}

function applyUpdateHunks(rawPath, originalContent, hunks) {
  const lines = splitPatchFileContent(originalContent);
  let cursor = 0;
  for (const hunk of hunks) {
    const before = hunk.filter((entry) => entry.marker !== '+').map((entry) => entry.text);
    const after = hunk.filter((entry) => entry.marker !== '-').map((entry) => entry.text);
    const matchIndex = findSubsequence(lines, before, cursor);
    if (matchIndex < 0) throw new Error(`patch hunk did not match: ${rawPath}`);
    lines.splice(matchIndex, before.length, ...after);
    cursor = matchIndex + after.length;
  }
  return joinPatchFileContent(lines);
}

function displayPatchPath(target) {
  const relative = path.relative(process.cwd(), target.resolved);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : target.rawPath;
}

function conflictForPatchPath(existing, incoming) {
  return `conflicting patch operations for ${incoming.rawPath} and ${existing.path}`;
}

function applyPatchOperations(operations) {
  const plannedWrites = new Map();
  const plannedDeletes = new Map();
  const touched = [];

  function touch(target) {
    touched.push(displayPatchPath(target));
  }

  function plannedContent(target) {
    const deletePlan = plannedDeletes.get(target.resolved);
    if (deletePlan) throw new Error(conflictForPatchPath(deletePlan, target));
    const writePlan = plannedWrites.get(target.resolved);
    if (writePlan) return writePlan.content;
    if (!fs.existsSync(target.resolved)) throw new Error(`patch file not found: ${target.rawPath}`);
    if (!fs.statSync(target.resolved).isFile()) throw new Error(`patch target must be a file: ${target.rawPath}`);
    return fs.readFileSync(target.resolved, 'utf8');
  }

  function planWrite(target, content) {
    const deletePlan = plannedDeletes.get(target.resolved);
    if (deletePlan) throw new Error(conflictForPatchPath(deletePlan, target));
    plannedWrites.set(target.resolved, { path: displayPatchPath(target), rawPath: target.rawPath, resolved: target.resolved, content });
    touch(target);
  }

  function planDelete(target) {
    const writePlan = plannedWrites.get(target.resolved);
    if (writePlan) throw new Error(conflictForPatchPath(writePlan, target));
    if (!fs.existsSync(target.resolved)) throw new Error(`patch file not found: ${target.rawPath}`);
    plannedDeletes.set(target.resolved, { path: displayPatchPath(target), rawPath: target.rawPath, resolved: target.resolved });
    touch(target);
  }

  for (const operation of operations) {
    const target = assertSafePatchPath(operation.path);
    if (operation.type === 'add') {
      if (fs.existsSync(target.resolved) || plannedWrites.has(target.resolved)) throw new Error(`patch target already exists: ${operation.path}`);
      if (plannedDeletes.has(target.resolved)) throw new Error(conflictForPatchPath(plannedDeletes.get(target.resolved), target));
      planWrite(target, joinPatchFileContent(operation.content));
      continue;
    }

    if (operation.type === 'delete') {
      planDelete(target);
      continue;
    }

    if (operation.type === 'update') {
      const updatedContent = applyUpdateHunks(operation.path, plannedContent(target), operation.hunks);
      if (operation.moveTo) {
        const moveTarget = assertSafePatchPath(operation.moveTo);
        if (target.resolved === moveTarget.resolved) throw new Error(`conflicting patch operations for ${operation.path} and ${operation.moveTo}`);
        if (fs.existsSync(moveTarget.resolved) || plannedWrites.has(moveTarget.resolved)) throw new Error(`patch move target already exists: ${operation.moveTo}`);
        if (plannedDeletes.has(moveTarget.resolved)) throw new Error(conflictForPatchPath(plannedDeletes.get(moveTarget.resolved), moveTarget));
        plannedWrites.delete(target.resolved);
        plannedDeletes.set(target.resolved, { path: displayPatchPath(target), rawPath: target.rawPath, resolved: target.resolved });
        plannedWrites.set(moveTarget.resolved, { path: displayPatchPath(moveTarget), rawPath: moveTarget.rawPath, resolved: moveTarget.resolved, content: updatedContent });
        touch(target);
        touch(moveTarget);
      } else {
        planWrite(target, updatedContent);
      }
    }
  }

  return { plannedWrites, plannedDeletes, touched: Array.from(new Set(touched)) };
}

function applyPlannedPatchMutations(plan) {
  const stagedWrites = [];
  try {
    for (const writePlan of plan.plannedWrites.values()) {
      const dir = path.dirname(writePlan.resolved);
      if (fs.existsSync(dir) && !fs.statSync(dir).isDirectory()) throw new Error(`patch target parent is not a directory: ${writePlan.path}`);
      fs.mkdirSync(dir, { recursive: true });
    }

    let index = 0;
    for (const writePlan of plan.plannedWrites.values()) {
      const dir = path.dirname(writePlan.resolved);
      const tempPath = path.join(dir, `.apply-patch-${process.pid}-${Date.now()}-${index++}.tmp`);
      fs.writeFileSync(tempPath, writePlan.content);
      stagedWrites.push({ ...writePlan, tempPath });
    }

    for (const writePlan of stagedWrites) {
      fs.renameSync(writePlan.tempPath, writePlan.resolved);
    }

    for (const [resolved, deletePlan] of plan.plannedDeletes) {
      if (plan.plannedWrites.has(resolved)) continue;
      if (fs.existsSync(deletePlan.resolved)) fs.unlinkSync(deletePlan.resolved);
    }
  } catch (error) {
    for (const writePlan of stagedWrites) {
      if (fs.existsSync(writePlan.tempPath)) fs.unlinkSync(writePlan.tempPath);
    }
    throw error;
  }
}

function cmdApplyPatch(argv) {
  if (argv.includes('--help')) { applyPatchHelp(); return; }

  const dryRun = argv.includes('--dry-run');
  let patchText = null;
  let patchFile = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--patch-text') patchText = argv[++i];
    else if (a === '--patch-file') patchFile = argv[++i];
    else if (a === '--stdin' || a === '--dry-run') { /* skip */ }
  }

  const payload = readPatchPayload({ patchText, patchFile });
  if (payload === null) return;

  try {
    const operations = parseApplyPatch(payload);
    const plan = applyPatchOperations(operations);

    out(`── apply-patch ──`);
    out(`operations: ${operations.length}`);
    out(`writes: ${plan.plannedWrites.size}`);
    out(`deletes: ${plan.plannedDeletes.size}`);
    plan.touched.forEach((filePath) => out(`  ${filePath}`));

    if (dryRun) { out('\n(dry run — no changes applied)'); return; }

    applyPlannedPatchMutations(plan);

    out('\npatch applied');
    plan.touched.forEach((filePath) => logToWorkpad(filePath, 'apply-patch'));
  } catch (e) {
    err(`error: ${e.message || e}`);
  }
}

// ── workpad logging ──

function logToWorkpad(filePath, action) {
  let dir = process.cwd();
  while (dir !== '/') {
    const taskMeta = findTaskMeta(dir);
    const candidates = [];
    if (taskMeta?.data) candidates.push(getTaskWorkpadPath(taskMeta.dir, taskMeta.data));
    candidates.push(path.join(dir, '.task', 'workpad.md'));

    for (const wp of Array.from(new Set(candidates))) {
      if (fs.existsSync(wp)) {
        const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
        fs.appendFileSync(wp, `\n- ${ts} ${action}: \`${filePath}\``);
        return;
      }
    }
    dir = path.dirname(dir);
  }
}

// ── http ──

function cmdHttp(argv) {
  if (argv.includes('--help') || argv.length === 0) {
    out('usage: bun run fs -- http <method> <url> [args...]');
    out('');
    out('make http requests. wraps xh.');
    out('');
    out('examples:');
    out('  http get https://api.github.com');
    out('  http post https://api.example.com key=val');
    out('  http get https://api.example.com Authorization:"Bearer $TOKEN"');
    out('  http get https://api.example.com --json');
    return;
  }
  const cmd = ['xh', '--ignore-stdin', ...argv];
  try {
    const result = execFileSync(cmd[0], cmd.slice(1), { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    process.stdout.write(result);
  } catch (e) {
    if (e.stdout) process.stdout.write(e.stdout);
    if (e.stderr) process.stderr.write(e.stderr);
    process.exit(e.status || 1);
  }
}

// ── trash ──

function cmdTrash(argv) {
  if (argv.includes('--help') || argv.length === 0) {
    out('usage: bun run fs -- trash <path> [path...]');
    out('');
    out('move files/directories to trash. safer than rm.');
    out('');
    out('examples:');
    out('  trash old-file.ts');
    out('  trash old-dir/');
    out('  trash a.ts b.ts c.ts');
    return;
  }
  for (const target of argv) {
    if (target.startsWith('-')) continue;
    try {
      execFileSync('trash', [target], { encoding: 'utf8' });
      out(`trashed: ${target}`);
    } catch (e) {
      err(`failed to trash ${target}: ${e.message}`);
    }
  }
}


// ── main ──

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help') { mainHelp(); return; }

  const command = argv[0];
  const rest = argv.slice(1);

  switch (command) {
    case 'read': await cmdRead(rest); break;
    case 'search': cmdSearch(rest); break;
    case 'list': cmdList(rest); break;
    case 'write': await cmdWrite(rest); break;
    case 'patch': cmdPatch(rest); break;
    case 'apply-patch': cmdApplyPatch(rest); break;
    case 'http': cmdHttp(rest); break;
    case 'trash': cmdTrash(rest); break;
    default:
      err(`unknown command: ${command}`);
      mainHelp();
      break;
  }
}

main().catch((error) => {
  err(error && error.message ? error.message : String(error));
});

