#!/usr/bin/env bun

// pr-review.js — legacy CLI wrapper for normalized PR review collection
// Internals live in ./lib/pr-review-collector so CLI and workspace.github({ operation: "pr.reviews" }) stay consistent.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { findTaskMeta: findTaskMetaRecord, getTaskReviewsDir } = require('./lib/task-meta');
const collector = require('./lib/pr-review-collector');
const { DEFAULT_REPO, collectPrReview, createPrReviewJson, formatReviewFile } = collector;

function writeStdout(value = '') { process.stdout.write(value + '\n'); }
function writeStderr(value = '') { process.stderr.write(value + '\n'); }

function findTaskMeta() {
  const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  const record = findTaskMetaRecord(process.cwd(), { currentBranch });
  return record ? { data: record.data, root: record.dir } : null;
}

function printHelp() {
  [
    'pr-review - legacy CLI wrapper for github pr.reviews review collection',
    '',
    'usage:',
    '  bun run pr-review -- <pr-number>',
    '  bun run pr-review -- --repo <owner/name> <pr-number>',
    '  bun run pr-review                  (auto-detect from .task/current.json)',
    '',
    'options:',
    '  --repo      GitHub repository, defaults to consuelohq/opensaas',
    '  --stdout    print markdown to stdout instead of writing file',
    '  --json      print normalized JSON',
    '  --help      show this help',
    '',
    'agent-facing usage should prefer: workspace.github({ operation: "pr.reviews", pr })',
  ].forEach((line) => writeStdout(line));
}

function parseArgs(argv) {
  const args = { prNumber: null, repo: DEFAULT_REPO, stdout: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    switch (value) {
      case '--repo': args.repo = argv[index + 1]; index += 1; break;
      case '--stdout': args.stdout = true; break;
      case '--json': args.json = true; break;
      case '--help': args.help = true; break;
      default:
        if (value.startsWith('--')) throw new Error(`unknown flag: ${value}`);
        if (/^\d+$/.test(value)) args.prNumber = Number(value);
        else if (value.includes('/pull/')) args.prNumber = Number(value.match(/\/pull\/(\d+)/)[1]);
    }
  }
  return args;
}

function detectPrNumber() {
  const task = findTaskMeta();
  if (!task || !task.data.prUrl) return null;
  const match = task.data.prUrl.match(/\/pull\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }

  const prNumber = args.prNumber || detectPrNumber();
  if (!prNumber) {
    writeStderr('error: no PR number provided and none found in .task/current.json');
    writeStderr('usage: bun run pr-review -- <pr-number>');
    process.exit(1);
  }

  writeStderr(`fetching normalized review feedback for ${args.repo}#${prNumber}...`);
  const packet = collectPrReview({
    prNumber,
    repo: args.repo,
    onWarning: (message) => writeStderr(`warning: ${message}`),
  });
  writeStderr(`  ${packet.inlineComments.length} inline comments, ${packet.issueComments.length} issue comments, ${packet.reviews.length} reviews`);
  if (packet.suppressedNoiseCount > 0) writeStderr(`  suppressed ${packet.suppressedNoiseCount} non-actionable bot/rate-limit message(s)`);

  if (args.json) {
    writeStdout(JSON.stringify(createPrReviewJson(packet), null, 2));
    return;
  }

  const content = formatReviewFile(packet);
  if (args.stdout) {
    writeStdout(content);
    return;
  }

  const task = findTaskMeta();
  const outDir = task ? getTaskReviewsDir(task.root, task.data) : path.join(process.cwd(), '.task', 'reviews');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${prNumber}.md`);
  fs.writeFileSync(outPath, content + '\n', 'utf8');
  writeStdout(path.relative(process.cwd(), outPath));
}

if (require.main === module) main();

module.exports = collector;
