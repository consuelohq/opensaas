#!/usr/bin/env bun

// gh.js — common one-off github commands for agents
// wraps `gh` CLI with repo defaults and structured output

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = 'consuelohq/opensaas';

function writeStdout(s = '') { process.stdout.write(s + '\n'); }
function writeStderr(s = '') { process.stderr.write(s + '\n'); }

function gh(args) {
  return execSync(`gh ${args}`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim();
}

function findTaskMeta() {
  const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  let dir = process.cwd();
  while (dir !== '/') {
    const p = path.join(dir, '.task', 'current.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (data.taskBranch && currentBranch && data.taskBranch !== currentBranch) return null;
      return data;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function printHelp() {
  const lines = [
    'gh — common github commands for agents',
    '',
    'usage: bun run gh -- <command> [args]',
    '',
    'commands:',
    '  prs                  list open PRs',
    '  prs --mine           list PRs by kokayicobb',
    '  prs --bot            list PRs by suelo-kiro[bot]',
    '  checks <pr>          show CI check status for a PR',
    '  diff <pr>            show diff for a PR (file list + stats)',
    '  diff <pr> --full     show full diff',
    '  files <pr>           list changed files in a PR',
    '  view <pr>            show PR details',
    '  reviews <pr>         show review status (who approved/requested changes)',
    '  comment <pr> <body>  post a comment on a PR',
    '  read <path> [--ref <branch>]  read a file from a branch (no local checkout)',
    '  blame <path>         show blame for a file',
    '  branches             list remote branches',
    '  branches --stream    list stream/* branches only',
    '  branches --task      list task/* branches only',
    '',
    'all commands default to repo: ' + REPO,
  ];
  lines.forEach((l) => writeStdout(l));
}

function resolvePr(arg) {
  if (!arg) {
    const meta = findTaskMeta();
    if (meta && meta.prUrl) {
      const m = meta.prUrl.match(/\/pull\/(\d+)/);
      if (m) return m[1];
    }
    writeStderr('error: no PR number provided and none in .task/current.json');
    process.exit(1);
  }
  if (/^\d+$/.test(arg)) return arg;
  const m = arg.match(/\/pull\/(\d+)/);
  if (m) return m[1];
  writeStderr(`error: can't parse PR number from: ${arg}`);
  process.exit(1);
}

// ── commands ──

function cmdPrs(argv) {
  let filter = '';
  if (argv.includes('--mine')) filter = '--author kokayicobb';
  else if (argv.includes('--bot')) filter = '--author "suelo-kiro[bot]"';
  const raw = gh(`pr list --repo ${REPO} ${filter} --json number,title,headRefName,baseRefName,state,author,createdAt --limit 20`);
  const prs = JSON.parse(raw);
  if (prs.length === 0) { writeStdout('no open PRs'); return; }
  for (const pr of prs) {
    const author = pr.author.login === 'kokayicobb' ? 'ko' : pr.author.login;
    writeStdout(`#${pr.number} ${pr.title} (${pr.headRefName} → ${pr.baseRefName}) [${author}]`);
  }
}

function cmdChecks(argv) {
  const pr = resolvePr(argv[0]);
  const raw = gh(`pr checks ${pr} --repo ${REPO} 2>&1 || true`);
  writeStdout(raw);
}

function cmdDiff(argv) {
  const pr = resolvePr(argv[0]);
  if (argv.includes('--full')) {
    const raw = gh(`pr diff ${pr} --repo ${REPO}`);
    writeStdout(raw);
  } else {
    const raw = gh(`pr diff ${pr} --repo ${REPO} --stat`);
    writeStdout(raw);
  }
}

function cmdFiles(argv) {
  const pr = resolvePr(argv[0]);
  const raw = gh(`pr view ${pr} --repo ${REPO} --json files --jq '.files[].path'`);
  writeStdout(raw);
}

function cmdView(argv) {
  const pr = resolvePr(argv[0]);
  const raw = gh(`pr view ${pr} --repo ${REPO}`);
  writeStdout(raw);
}

function cmdReviews(argv) {
  const pr = resolvePr(argv[0]);
  const raw = gh(`api repos/${REPO}/pulls/${pr}/reviews`);
  const reviews = JSON.parse(raw);
  if (reviews.length === 0) { writeStdout('no reviews yet'); return; }
  for (const r of reviews) {
    const who = r.user.login === 'kokayicobb' ? 'ko' : r.user.login.replace('[bot]', '');
    const state = r.state.toLowerCase().replace('_', ' ');
    const body = r.body ? ' — ' + r.body.split('\n')[0].slice(0, 100) : '';
    writeStdout(`${who}: ${state}${body}`);
  }
}

function cmdComment(argv) {
  const pr = resolvePr(argv[0]);
  const body = argv.slice(1).join(' ');
  if (!body) { writeStderr('error: no comment body'); process.exit(1); }
  gh(`pr comment ${pr} --repo ${REPO} --body ${JSON.stringify(body)}`);
  writeStderr(`→ commented on PR #${pr}`);
}

function cmdRead(argv) {
  let filePath = argv[0];
  let ref = 'main';
  const refIdx = argv.indexOf('--ref');
  if (refIdx !== -1) ref = argv[refIdx + 1];
  if (!filePath) { writeStderr('error: no file path'); process.exit(1); }
  const raw = gh(`api repos/${REPO}/contents/${filePath}?ref=${ref} --jq '.content'`);
  const content = Buffer.from(raw, 'base64').toString('utf8');
  writeStdout(content);
}

function cmdBlame(argv) {
  const filePath = argv[0];
  if (!filePath) { writeStderr('error: no file path'); process.exit(1); }
  const raw = gh(`api repos/${REPO}/contents/${filePath} --jq '.html_url'`);
  // blame URL
  const blameUrl = raw.replace('/blob/', '/blame/');
  writeStdout(blameUrl);
  writeStderr('(open in browser for full blame view)');
}

function cmdBranches(argv) {
  let filter = '';
  if (argv.includes('--stream')) filter = 'stream/';
  else if (argv.includes('--task')) filter = 'task/';
  const raw = gh(`api repos/${REPO}/git/matching-refs/heads/${filter} --jq '.[].ref'`);
  const branches = raw.split('\n').filter(Boolean).map((r) => r.replace('refs/heads/', ''));
  for (const b of branches) writeStdout(b);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help') { printHelp(); return; }

  const cmd = argv[0];
  const rest = argv.slice(1);

  switch (cmd) {
    case 'prs': cmdPrs(rest); break;
    case 'checks': cmdChecks(rest); break;
    case 'diff': cmdDiff(rest); break;
    case 'files': cmdFiles(rest); break;
    case 'view': cmdView(rest); break;
    case 'reviews': cmdReviews(rest); break;
    case 'comment': cmdComment(rest); break;
    case 'read': cmdRead(rest); break;
    case 'blame': cmdBlame(rest); break;
    case 'branches': cmdBranches(rest); break;
    default:
      writeStderr(`unknown command: ${cmd}`);
      writeStderr('run: bun run gh -- --help');
      process.exit(1);
  }
}

main();
