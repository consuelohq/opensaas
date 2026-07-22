#!/usr/bin/env bun

// task-prs.js — show task PR + review PR links for a selected task

const { execFileSync } = require('child_process');
const { resolveGitRoot } = require('./lib/paths');
const { resolvePrRefNumber } = require('./lib/pr-ref');
const { findActiveTaskResult } = require('./lib/task-selection');
const { findTaskMeta } = require('./lib/task-meta');
const { getCurrentBranch } = require('./lib/git');
const { buildGraphitePullRequestUrl, getBranchSlug } = require('./lib/pr-links');

function writeStdout(s = '') { process.stdout.write(s + '\n'); }
function writeStderr(s = '') { process.stderr.write(s + '\n'); }

function parseArgs(argv) {
  const args = { json: false };

  for (let index = 0; index < argv.length; index += 1) {
    const rawArgument = argv[index];
    if (!rawArgument.startsWith('--')) {
      throw new Error(`unexpected argument: ${rawArgument}`);
    }

    const [flag, inlineValue] = rawArgument.split('=', 2);
    const isBooleanFlag = flag === '--json' || flag === '--help';
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
      case '--branch':
        args.branch = value;
        break;
      case '--pr':
      case '--github':
        args.prNumber = resolvePrRefNumber(value);
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

  if (args.prNumber !== undefined && !Number.isInteger(args.prNumber)) {
    throw new Error('invalid --pr/--github value');
  }

  return args;
}

function printHelp() {
  writeStdout('usage: bun run task:prs -- [options]');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --area <name>        select task by area');
  writeStdout('  --branch <name>      select exact task branch');
  writeStdout('  --pr <number-or-url>        select task by pr number');
  writeStdout('  --json               output json');
  writeStdout('  --help               show this help');
}

function hasExplicitTaskSelector(args) {
  return Boolean(args.area || args.branch || args.prNumber !== undefined);
}

function getSelectedTaskMeta(args) {
  const repoRoot = resolveGitRoot(process.cwd());
  const selected = findActiveTaskResult(repoRoot, {
    area: args.area || null,
    branch: args.branch || null,
    prNumber: args.prNumber === undefined ? null : args.prNumber,
  });

  if (selected.error) {
    throw new Error(selected.error);
  }

  return selected.task.meta;
}

function getCurrentTaskMeta() {
  const currentBranch = getCurrentBranch(process.cwd());
  const taskMeta = findTaskMeta(process.cwd(), { currentBranch });
  return taskMeta ? taskMeta.data : null;
}

function ghJson(args) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', timeout: 10000 }).trim();
  } catch {
    return null;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const meta = hasExplicitTaskSelector(args) ? getSelectedTaskMeta(args) : getCurrentTaskMeta();

  if (!meta) {
    writeStderr('no active task found — pass --branch, --pr, or run from a task worktree');
    process.exit(1);
    return;
  }

  const taskPrNumber = meta.taskPrNumber || meta.prNumber;
  const taskGitHubUrl = meta.taskPrUrl || meta.githubPrUrl || (String(meta.prUrl || '').includes('/pull/') ? meta.prUrl : null);
  const taskGraphiteUrl = meta.taskGraphitePrUrl || buildGraphitePullRequestUrl('consuelohq/opensaas', taskPrNumber, getBranchSlug(meta.taskBranch));
  const result = {
    area: meta.area,
    taskBranch: meta.taskBranch,
    stream: meta.stream,
    taskPr: {
      number: taskPrNumber,
      url: taskGraphiteUrl,
      githubUrl: taskGitHubUrl,
      graphiteUrl: taskGraphiteUrl,
    },
    reviewPr: null,
  };

  if (meta.stream) {
    const prJson = ghJson([
      'pr',
      'list',
      '--repo',
      'consuelohq/opensaas',
      '--head',
      meta.stream,
      '--base',
      'main',
      '--json',
      'number,url,title,state,isDraft',
      '--limit',
      '1',
    ]);
    if (prJson) {
      try {
        const prs = JSON.parse(prJson);
        if (prs.length > 0) {
          const graphiteUrl = buildGraphitePullRequestUrl('consuelohq/opensaas', prs[0].number, prs[0].title || meta.stream);
          result.reviewPr = {
            number: prs[0].number,
            url: graphiteUrl,
            githubUrl: prs[0].url,
            graphiteUrl,
            title: prs[0].title,
            state: prs[0].state,
            draft: prs[0].isDraft,
          };
        }
      } catch {
        // ignore malformed gh output
      }
    }
  }

  if (args.json) {
    writeStdout(JSON.stringify(result, null, 2));
    return;
  }

  writeStdout(`area: ${result.area}`);
  writeStdout(`branch: ${result.taskBranch}`);
  writeStdout(`stream: ${result.stream}`);
  writeStdout('');
  writeStdout(`task pr:   #${result.taskPr.number} ${result.taskPr.url}`);
  if (result.taskPr.githubUrl) writeStdout(`task github: ${result.taskPr.githubUrl}`);
  if (result.reviewPr) {
    const draft = result.reviewPr.draft ? ' (draft)' : '';
    writeStdout(`review pr: #${result.reviewPr.number} ${result.reviewPr.url}${draft}`);
    if (result.reviewPr.githubUrl) writeStdout(`review github: ${result.reviewPr.githubUrl}`);
  } else {
    writeStdout('review pr: none (run task:pr to create)');
  }
}

main();
