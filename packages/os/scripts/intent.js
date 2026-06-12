#!/usr/bin/env bun
'use strict';

const fs = require('fs');

const { createWorkflowIntentRuntime } = require('../hooks/intent.js');
const { renderHookResult } = require('../hooks/dispatcher.js');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run intent -- <start|dispatch> [options]');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --workflow <task|office|design|sites>');
  writeStdout('  --task-session <id>');
  writeStdout('  --area <value>');
  writeStdout('  --title <value>');
  writeStdout('  --branch <branch>');
  writeStdout('  --worktree-path <path>');
  writeStdout('  --event-json <path>');
  writeStdout('  --json');
  writeStdout('  --help');
}

function parseArgs(argv) {
  const args = { action: 'start', json: false };
  let index = 0;

  if (argv[0] && !argv[0].startsWith('--')) {
    args.action = argv[0];
    index = 1;
  }

  for (; index < argv.length; index += 1) {
    const rawArgument = argv[index];
    if (!rawArgument.startsWith('--')) throw new Error(`unexpected argument: ${rawArgument}`);
    const [flag, inlineValue] = rawArgument.split('=', 2);
    const isBooleanFlag = flag === '--json' || flag === '--help';
    const value = inlineValue !== undefined ? inlineValue : isBooleanFlag ? undefined : argv[index + 1];
    if (!isBooleanFlag && (!value || value.startsWith('--'))) throw new Error(`missing value for ${flag}`);
    if (inlineValue === undefined && !isBooleanFlag) index += 1;

    switch (flag) {
      case '--workflow':
        args.workflow = value;
        break;
      case '--task-session':
        args.taskSession = value;
        break;
      case '--area':
        args.area = value;
        break;
      case '--title':
        args.title = value;
        break;
      case '--branch':
        args.branch = value;
        break;
      case '--worktree-path':
        args.worktreePath = value;
        break;
      case '--event-json':
        args.eventJson = value;
        break;
      case '--json':
        args.json = true;
        break;
      case '--help':
        args.help = true;
        break;
      default:
        throw new Error(`unknown flag: ${flag}`);
    }
  }

  return args;
}

function readEventJson(eventJsonPath) {
  if (!eventJsonPath) throw new Error('--event-json is required for dispatch');
  return JSON.parse(fs.readFileSync(eventJsonPath, 'utf8'));
}

function renderIntentResult(result) {
  const lines = [
    `# Intent result: ${result.workflow}`,
    '',
    `taskSession: ${result.taskSession}`,
    `requestedWorkflow: ${result.requestedWorkflow}`,
    `tools: ${result.manifestBundle?.tools?.map((tool) => tool.name).join(', ') || ''}`,
  ];
  if (result.hookResult) {
    lines.push('', renderHookResult(result.hookResult).trimEnd());
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const runtime = createWorkflowIntentRuntime();
  const result = args.action === 'dispatch'
    ? runtime.dispatch({
        taskSession: args.taskSession,
        workflow: args.workflow,
        event: readEventJson(args.eventJson),
      })
    : runtime.start({
        workflow: args.workflow,
        taskSession: args.taskSession,
        area: args.area,
        title: args.title,
        branch: args.branch,
        worktreePath: args.worktreePath,
      });

  if (args.json) {
    writeStdout(JSON.stringify(result, null, 2));
    return;
  }

  writeStdout(renderIntentResult(result));
}

try {
  main();
} catch (error) {
  writeStderr(error instanceof Error ? error.message : 'unknown error');
  process.exit(1);
}
