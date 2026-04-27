#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const writeLine = (message = '') => process.stdout.write(`${message}\n`);
const writeError = (message) => process.stderr.write(`${message}\n`);

function printHelp() {
  [
    'usage: bun run tracing -- <status|runs|tokens|smoke> [options]',
    '',
    'workspace langsmith tracing helper.',
    '',
    'options:',
    '  --json              output json',
    '  --limit <n>         number of langsmith runs to read',
    '  --project <name>    langsmith project name',
    '  --thread-id <id>    thread id for smoke/filtering',
    '  --file <path>       estimate token use for a file',
    '  --text <text>       estimate token use for text',
    '  --stdin             estimate token use for stdin',
    '  --help              show help',
  ].forEach(writeLine);
}

function parseArgs(argv) {
  const args = {
    command: argv[0] || 'status',
    json: false,
    limit: 10,
    project: null,
    threadId: null,
    file: null,
    text: null,
    stdin: false,
    help: false,
  };

  for (let i = 1; i < argv.length; i += 1) {
    const raw = argv[i];
    if (raw === '--json') args.json = true;
    else if (raw === '--stdin') args.stdin = true;
    else if (raw === '--help') args.help = true;
    else if (raw === '--limit') args.limit = Number(argv[++i]);
    else if (raw === '--project') args.project = argv[++i];
    else if (raw === '--thread-id') args.threadId = argv[++i];
    else if (raw === '--file') args.file = argv[++i];
    else if (raw === '--text') args.text = argv[++i];
    else throw new Error(`unknown flag: ${raw}`);
  }

  if (!Number.isInteger(args.limit) || args.limit < 1) throw new Error('--limit must be a positive integer');
  return args;
}

function projectName(args) {
  return args.project || process.env.LANGSMITH_PROJECT || process.env.LANGCHAIN_PROJECT || 'default';
}

function stringify(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function estimateTokens(value) {
  const text = stringify(value);
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

function tokenSummary(value) {
  const text = stringify(value);
  return { chars: text.length, tokensEstimated: estimateTokens(text), estimator: 'chars_div_4_ceil' };
}

function pythonBin() {
  const candidates = [
    process.env.PYTHON_BIN,
    path.join(process.cwd(), 'packages/workspace/.venv/bin/python3'),
    '/Users/kokayi/Dev/opensaas/packages/workspace/.venv/bin/python3',
    'python3',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === 'python3' || fs.existsSync(candidate)) return candidate;
  }

  return 'python3';
}

function runPython(code, env = {}) {
  const result = spawnSync(pythonBin(), ['-c', code], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 45000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `python exited ${result.status}`).trim());
  return result.stdout.trim();
}

function status(project) {
  const code = `
import json
try:
    import langsmith
    from langsmith import Client
    version = getattr(langsmith, '__version__', None)
    client = Client()
    runs = list(client.list_runs(project_name=${JSON.stringify(project)}, limit=1))
    print(json.dumps({'installed': True, 'version': version, 'reachable': True, 'recentRuns': len(runs)}))
except Exception as err:
    print(json.dumps({'installed': False, 'version': None, 'reachable': False, 'error': str(err)}))
`;
  return JSON.parse(runPython(code));
}

function listRuns(project, limit, threadId = null) {
  const filterLine = threadId
    ? `filter_value = "metadata_key = 'thread_id' AND metadata_value = '${threadId}'"`
    : 'filter_value = None';
  const code = `
import json
from langsmith import Client
client = Client()
${filterLine}
runs = []
try:
    iterator = client.list_runs(project_name=${JSON.stringify(project)}, limit=${Number(limit)}, filter=filter_value)
    for run in iterator:
        metadata = getattr(run, 'metadata', None) or {}
        runs.append({
            'id': str(getattr(run, 'id', '')),
            'name': getattr(run, 'name', None),
            'runType': getattr(run, 'run_type', None),
            'startTime': str(getattr(run, 'start_time', '')),
            'metadata': metadata,
        })
except Exception:
    iterator = client.list_runs(project_name=${JSON.stringify(project)}, limit=max(${Number(limit)}, 25))
    for run in iterator:
        metadata = getattr(run, 'metadata', None) or {}
        if ${JSON.stringify(threadId)} is None or metadata.get('thread_id') == ${JSON.stringify(threadId)}:
            runs.append({
                'id': str(getattr(run, 'id', '')),
                'name': getattr(run, 'name', None),
                'runType': getattr(run, 'run_type', None),
                'startTime': str(getattr(run, 'start_time', '')),
                'metadata': metadata,
            })
print(json.dumps(runs[:${Number(limit)}]))
`;
  return JSON.parse(runPython(code) || '[]');
}

function printRuns(runs) {
  if (runs.length === 0) {
    writeLine('no runs found');
    return;
  }
  for (const run of runs) {
    const thread = run.metadata?.thread_id || '-';
    const inTokens = run.metadata?.workspace_input_tokens_estimated ?? '-';
    const outTokens = run.metadata?.workspace_output_tokens_estimated ?? '-';
    writeLine(`${run.startTime} ${run.name} ${run.runType} thread=${thread} in=${inTokens} out=${outTokens}`);
  }
}

function readTokenInput(args) {
  if (args.file) return fs.readFileSync(args.file, 'utf8');
  if (args.text !== null) return args.text;
  if (args.stdin) return fs.readFileSync(0, 'utf8');
  throw new Error('tokens requires --file, --text, or --stdin');
}

function waitForRuns(project, threadId) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const runs = listRuns(project, 20, threadId);
    const names = new Set(runs.map((run) => run.name));
    if (names.has('get_steering') && names.has('sandbox_exec')) return runs;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }
  return listRuns(project, 20, threadId);
}

function smoke(args, project) {
  const threadId = args.threadId || `workspace-smoke-${crypto.randomUUID()}`;
  const code = `
import os
import sys
import time
sys.path.insert(0, os.path.join(os.getcwd(), 'packages/workspace'))
os.environ['WORKSPACE_LANGSMITH_THREAD_ID'] = ${JSON.stringify(threadId)}
import server
server.get_steering()
server.sandbox_exec('printf tracing-smoke', 5)
time.sleep(3)
print('ok')
`;
  runPython(code, { WORKSPACE_LANGSMITH_THREAD_ID: threadId });
  const runs = waitForRuns(project, threadId);
  const names = new Set(runs.map((run) => run.name));
  const missing = ['get_steering', 'sandbox_exec'].filter((name) => !names.has(name));
  const badMetadata = runs.filter((run) => ['get_steering', 'sandbox_exec'].includes(run.name))
    .filter((run) => run.metadata?.thread_id !== threadId || run.metadata?.workspace_output_tokens_estimated === undefined)
    .map((run) => run.id);
  return { ok: missing.length === 0 && badMetadata.length === 0, project, threadId, missing, badMetadata, runs };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.command === '--help') {
    printHelp();
    return;
  }

  const project = projectName(args);
  if (args.command === 'status') {
    const result = { project, ...status(project) };
    if (args.json) writeLine(JSON.stringify(result, null, 2));
    else {
      writeLine(`project: ${project}`);
      writeLine(`langsmith: ${result.installed ? result.version : 'missing'}`);
      writeLine(`reachable: ${result.reachable ? 'yes' : 'no'}`);
      if (result.error) writeLine(`error: ${result.error}`);
    }
    if (!result.reachable) process.exitCode = 1;
  } else if (args.command === 'runs') {
    const runs = listRuns(project, args.limit, args.threadId);
    if (args.json) writeLine(JSON.stringify({ project, runs }, null, 2));
    else printRuns(runs);
  } else if (args.command === 'tokens') {
    const result = tokenSummary(readTokenInput(args));
    if (args.json) writeLine(JSON.stringify(result, null, 2));
    else writeLine(`chars=${result.chars} tokens_estimated=${result.tokensEstimated} estimator=${result.estimator}`);
  } else if (args.command === 'smoke') {
    const result = smoke(args, project);
    if (args.json) writeLine(JSON.stringify(result, null, 2));
    else {
      writeLine(`thread: ${result.threadId}`);
      printRuns(result.runs);
      writeLine(result.ok ? 'smoke: ok' : 'smoke: failed');
    }
    if (!result.ok) process.exitCode = 1;
  } else {
    throw new Error(`unknown command: ${args.command}`);
  }
}

try {
  main();
} catch {
  writeError('tracing failed');
  process.exit(1);
}
