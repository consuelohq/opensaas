#!/usr/bin/env bun

const {
  getTaskHookGuidance,
  renderTaskHookGuidance,
} = require('../hooks/task/guidance.js');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run task:hook -- <stage> [options]');
  writeStdout('');
  writeStdout('stages: before-task-start | after-task-start | before-production-edit | before-publish | unknown-task-tool');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --area <value>');
  writeStdout('  --title <value>');
  writeStdout('  --task-session <value>');
  writeStdout('  --worktree-path <path>');
  writeStdout('  --requested-tool <name>');
  writeStdout('  --base <branch>');
  writeStdout('  --message <commit message>');
  writeStdout('  --no-tests');
  writeStdout('  --json');
  writeStdout('  --help');
}

function parseArgs(argv) {
  const args = { json: false };
  const [stage, ...rest] = argv;

  if (!stage || stage === '--help') {
    args.help = true;
    return args;
  }

  args.stage = stage;

  for (let index = 0; index < rest.length; index += 1) {
    const rawArgument = rest[index];
    if (!rawArgument.startsWith('--')) {
      throw new Error(`unexpected argument: ${rawArgument}`);
    }

    const [flag, inlineValue] = rawArgument.split('=', 2);
    const isBooleanFlag = flag === '--json' || flag === '--help' || flag === '--no-tests';
    const value = inlineValue !== undefined ? inlineValue : isBooleanFlag ? undefined : rest[index + 1];

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

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
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
