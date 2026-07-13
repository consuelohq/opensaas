#!/usr/bin/env bun

const fs = require('fs');

const {
  getTaskHookGuidance,
  renderTaskHookGuidance,
} = require('../hooks/task/guidance.js');
const { dispatchHookEvent, renderHookResult } = require('../hooks/dispatcher.js');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run task:hook -- <stage> [options]');
  writeStdout('       bun run task:hook -- --event-json <path> [--json]');
  writeStdout('');
  writeStdout('legacy stages: before-task-start | after-task-start | before-production-edit | before-publish | unknown-task-tool');
  writeStdout('event mode: dispatch a workflow hook event JSON object through the manifest-driven dispatcher');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --area <value>');
  writeStdout('  --title <value>');
  writeStdout('  --task-session <value>');
  writeStdout('  --worktree-path <path>');
  writeStdout('  --requested-tool <name>');
  writeStdout('  --base <branch>');
  writeStdout('  --message <commit message>');
  writeStdout('  --event-json <path>');
  writeStdout('  --manifest <path>');
  writeStdout('  --no-tests');
  writeStdout('  --json');
  writeStdout('  --help');
}

function parseArgs(argv) {
  const args = { json: false };
  let index = 0;

  if (argv.length === 0 || argv[0] === '--help') {
    args.help = true;
    return args;
  }

  if (!argv[0].startsWith('--')) {
    args.stage = argv[0];
    index = 1;
  }

  for (; index < argv.length; index += 1) {
    const rawArgument = argv[index];
    if (!rawArgument.startsWith('--')) {
      throw new Error(`unexpected argument: ${rawArgument}`);
    }

    const [flag, inlineValue] = rawArgument.split('=', 2);
    const isBooleanFlag = flag === '--json' || flag === '--help' || flag === '--no-tests';
    const value = inlineValue !== undefined ? inlineValue : isBooleanFlag ? undefined : argv[index + 1];

    if (!isBooleanFlag && (!value || value.startsWith('--'))) {
      throw new Error(`missing value for ${flag}`);
    }

    if (inlineValue === undefined && !isBooleanFlag) {
      index += 1;
    }

    switch (flag) {
      case '--area':
        args.area = value;
        break;
      case '--title':
        args.title = value;
        break;
      case '--task-session':
        args.taskSession = value;
        break;
      case '--worktree-path':
        args.worktreePath = value;
        break;
      case '--requested-tool':
        args.requestedTool = value;
        break;
      case '--base':
        args.base = value;
        break;
      case '--message':
        args.message = value;
        break;
      case '--event-json':
        args.eventJson = value;
        break;
      case '--manifest':
        args.manifestPath = value;
        break;
      case '--no-tests':
        args.noTests = true;
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

  if (!args.stage && !args.eventJson && !args.help) {
    throw new Error('missing stage or --event-json');
  }

  return args;
}

function readEventJson(eventJsonPath) {
  return JSON.parse(fs.readFileSync(eventJsonPath, 'utf8'));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (args.eventJson) {
    const guidance = dispatchHookEvent({
      manifestPath: args.manifestPath,
      event: readEventJson(args.eventJson),
    });

    if (args.json) {
      writeStdout(JSON.stringify(guidance, null, 2));
      return;
    }

    writeStdout(renderHookResult(guidance));
    return;
  }

  const guidance = getTaskHookGuidance(args.stage, args);
  if (args.json) {
    writeStdout(JSON.stringify(guidance, null, 2));
    return;
  }

  writeStdout(renderTaskHookGuidance(guidance));
}

try {
  main();
} catch (error) {
  writeStderr(error instanceof Error ? error.message : 'unknown error');
  process.exit(1);
}
