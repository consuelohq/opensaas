#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function writeStdout(value = '') { process.stdout.write(`${value}\n`); }
function writeStderr(value = '') { process.stderr.write(`${value}\n`); }

function parseArgs(argv) {
  const args = { positional: [], json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') args.json = true;
    else if (argument === '--cwd') args.cwd = readFlagValue(argv, ++index, '--cwd');
    else if (argument === '--timeout') args.timeout = parsePositiveInteger(readFlagValue(argv, ++index, '--timeout'), '--timeout');
    else if (argument === '--content') args.content = readFlagValue(argv, ++index, '--content');
    else if (argument === '--content-file') args.contentFile = readFlagValue(argv, ++index, '--content-file');
    else if (argument === '--include') args.include = readFlagValue(argv, ++index, '--include');
    else if (argument === '--depth') args.depth = parsePositiveInteger(readFlagValue(argv, ++index, '--depth'), '--depth');
    else if (argument === '--pid') args.pid = parsePositiveInteger(readFlagValue(argv, ++index, '--pid'), '--pid');
    else if (argument === '--name') args.name = readFlagValue(argv, ++index, '--name');
    else if (argument === '--help') args.help = true;
    else args.positional.push(argument);
  }
  return args;
}

function readFlagValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

function envelope(input) {
  return {
    ok: input.ok,
    code: input.code,
    message: input.message,
    data: input.data,
    stderr: input.stderr || '',
    exitCode: input.exitCode ?? (input.ok ? 0 : 1),
    durationMs: input.durationMs,
    traceId: `trc_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
    apiVersion: '1.0.0',
  };
}

function runExec(command, args) {
  const result = spawnSync(command, {
    cwd: args.cwd || process.cwd(),
    shell: true,
    encoding: 'utf8',
    timeout: args.timeout || 300000,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || (result.error ? result.error.message : ''),
    exitCode: result.status || (result.error ? 1 : 0),
  };
}

function readFile(filePath) {
  return { content: fs.readFileSync(filePath, 'utf8') };
}

function writeFile(filePath, args) {
  const content = args.contentFile
    ? fs.readFileSync(args.contentFile, 'utf8')
    : args.content || '';
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return { path: filePath, bytes: Buffer.byteLength(content) };
}

function searchFiles(pattern, args) {
  const searchPath = args.positional[2] || process.cwd();
  const commandArgs = ['--color=never', '--line-number'];
  if (args.include) commandArgs.push(`--glob=${args.include}`);
  commandArgs.push(pattern, searchPath);
  const result = spawnSync('rg', commandArgs, { encoding: 'utf8' });
  const matches = (result.stdout || '').split('\n').filter(Boolean).map((line) => {
    const match = line.match(/^(.+?):(\d+):(.*)$/);
    return match ? { file: match[1], line: Number.parseInt(match[2], 10), text: match[3] } : { raw: line };
  });
  return { matches };
}

function listFiles(rootPath, depth) {
  const root = rootPath || process.cwd();
  const maxDepth = depth || 1;
  const entries = [];

  function walk(currentPath, currentDepth) {
    if (currentDepth > maxDepth) return;
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const fullPath = path.join(currentPath, entry.name);
      entries.push({
        path: fullPath,
        type: entry.isDirectory() ? 'directory' : 'file',
      });
      if (entry.isDirectory()) walk(fullPath, currentDepth + 1);
    }
  }

  walk(root, 1);
  return { path: root, entries };
}

function processAction(action, args) {
  if (action === 'list') {
    const result = spawnSync('ps', ['-axo', 'pid,comm'], { encoding: 'utf8' });
    return {
      processes: (result.stdout || '').split('\n').slice(1).filter(Boolean).map((line) => {
        const trimmed = line.trim();
        const firstSpace = trimmed.indexOf(' ');
        return {
          pid: Number.parseInt(trimmed.slice(0, firstSpace), 10),
          command: trimmed.slice(firstSpace + 1).trim(),
        };
      }),
    };
  }

  if (action === 'kill') {
    if (args.pid) {
      const killed = [];
      const failed = [];
      recordKillResult({ pid: args.pid }, killed, failed);
      return { killed, failed };
    }
    if (!args.name) throw new Error('process kill requires --pid or --name');
    const list = processAction('list', args).processes;
    const matches = list.filter((item) => item.command.includes(args.name));
    const killed = [];
    const failed = [];
    for (const item of matches) recordKillResult(item, killed, failed);
    return { killed, failed };
  }

  throw new Error(`unknown process action: ${action}`);
}

function recordKillResult(item, killed, failed) {
  try {
    process.kill(item.pid);
    killed.push(item);
  } catch (error /*: unknown */) {
    failed.push({ ...item, error: error instanceof Error ? error.message : String(error) });
  }
}

function portAction(action, port) {
  if (action === 'check') {
    if (!port) throw new Error('port check requires a port');
    const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
    return { port, open: result.status === 0, output: result.stdout || '' };
  }

  if (action === 'find') {
    for (let candidate = 3000; candidate < 3100; candidate += 1) {
      if (!portAction('check', candidate).open) return { port: candidate };
    }
    throw new Error('no open port found from 3000 to 3099');
  }

  throw new Error(`unknown port action: ${action}`);
}

function showHelp() {
  writeStdout('usage: bun run mac -- <exec|read|write|search|list|process|port> [args] --json');
}

function main() {
  const startedAt = Date.now();
  const args = parseArgs(process.argv.slice(2));
  const command = args.positional[0];

  if (!command || args.help) {
    showHelp();
    return;
  }

  let data;
  let stderr = '';
  let exitCode = 0;

  try {
    if (command === 'exec') {
      const result = runExec(args.positional[1], args);
      data = { stdout: result.stdout, stderr: result.stderr };
      stderr = result.stderr;
      exitCode = result.exitCode;
    } else if (command === 'read') data = readFile(args.positional[1]);
    else if (command === 'write') data = writeFile(args.positional[1], args);
    else if (command === 'search') data = searchFiles(args.positional[1], args);
    else if (command === 'list') data = listFiles(args.positional[1], args.depth);
    else if (command === 'process') data = processAction(args.positional[1], args);
    else if (command === 'port') {
      const port = args.positional[2] === undefined
        ? undefined
        : parsePositiveInteger(args.positional[2], 'port');
      data = portAction(args.positional[1], port);
    }
    else throw new Error(`unknown command: ${command}`);
  } catch (error /*: unknown */) {
    const result = envelope({
      ok: false,
      code: 'COMMAND_FAILED',
      message: error instanceof Error ? error.message : String(error),
      data: null,
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1,
      durationMs: Date.now() - startedAt,
    });
    writeStdout(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const result = envelope({
    ok: exitCode === 0,
    code: exitCode === 0 ? 'OK' : 'COMMAND_FAILED',
    message: exitCode === 0 ? 'mac command completed' : 'mac command failed',
    data,
    stderr,
    exitCode,
    durationMs: Date.now() - startedAt,
  });

  if (args.json) writeStdout(JSON.stringify(result, null, 2));
  else writeStdout(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  if (!result.ok) process.exitCode = result.exitCode || 1;
}

try {
  main();
} catch (error /*: unknown */) {
  writeStderr(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
