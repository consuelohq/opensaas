#!/usr/bin/env bun

// pr-review.js — fetch all review comments from a PR, write structured file
// pulls from: qodo-code-review[bot], coderabbitai[bot], codex, ko (kokayicobb), and any human reviewers
// output: .task/reviews/<pr-number>.md — structured, graph-aware, actionable

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'consuelohq/opensaas';
const BOTS = ['qodo-code-review[bot]', 'coderabbitai[bot]', 'codex'];

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
      return { data, root: dir };
    }
    dir = path.dirname(dir);
  }
  return null;
}

function printHelp() {
  const lines = [
    'pr-review — fetch all review comments from a PR into a structured file',
    '',
    'usage:',
    '  bun run pr-review -- <pr-number>',
    '  bun run pr-review                  (auto-detect from .task/current.json)',
    '',
    'options:',
    '  --stdout    print to stdout instead of writing file',
    '  --json      json output',
    '  --help      show this help',
    '',
    'output: .task/reviews/<pr-number>.md',
    '',
    'after fixing review comments, run the full task loop:',
    '',
    '  bun run stream:context -- --area <area>',
    '  bun run stream:sync -- --area <area>',
    '  bun run task:start -- --area <area> --title "description"',
    '  bun run review -- --mine',
    '  bun run task:push -- --message "fix(scope): desc" --changed',
    '  bun run task:pr',
    '  bun run task:prs',
    '  bun run task:merge -- --pr <N> --wait',
    '  bun run task:finish',
  ];
  lines.forEach((l) => writeStdout(l));
}

function parseArgs(argv) {
  const args = { prNumber: null, stdout: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--stdout': args.stdout = true; break;
      case '--json': args.json = true; break;
      case '--help': args.help = true; break;
      default:
        if (argv[i].startsWith('--')) throw new Error(`unknown flag: ${argv[i]}`);
        if (/^\d+$/.test(argv[i])) args.prNumber = parseInt(argv[i], 10);
        else if (argv[i].includes('/pull/')) args.prNumber = parseInt(argv[i].match(/\/pull\/(\d+)/)[1], 10);
    }
  }
  return args;
}

function detectPrNumber() {
  const task = findTaskMeta();
  if (!task || !task.data.prUrl) return null;
  const m = task.data.prUrl.match(/\/pull\/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function fetchPrMeta(prNumber) {
  const raw = gh(`pr view ${prNumber} --repo ${REPO} --json number,title,headRefName,baseRefName,state,files,author`);
  return JSON.parse(raw);
}

function fetchInlineComments(prNumber) {
  const raw = gh(`api repos/${REPO}/pulls/${prNumber}/comments --paginate`);
  return JSON.parse(raw);
}

function fetchIssueComments(prNumber) {
  const raw = gh(`api repos/${REPO}/issues/${prNumber}/comments --paginate`);
  return JSON.parse(raw);
}

function fetchReviews(prNumber) {
  const raw = gh(`api repos/${REPO}/pulls/${prNumber}/reviews --paginate`);
  return JSON.parse(raw);
}

function classifyAuthor(login) {
  if (BOTS.includes(login)) return login.replace('[bot]', '').replace('-', ' ');
  if (login === 'kokayicobb') return 'ko';
  return login;
}

function buildFileGraph(inlineComments, changedFiles) {
  // group comments by file path — shows which files have the most review attention
  const graph = {};
  for (const c of inlineComments) {
    const file = c.path || 'unknown';
    if (!graph[file]) graph[file] = { comments: 0, authors: new Set(), lines: [] };
    graph[file].comments++;
    graph[file].authors.add(classifyAuthor(c.user.login));
    graph[file].lines.push(c.line || c.original_line || '?');
  }
  // add changed files with no comments
  for (const f of changedFiles) {
    if (!graph[f.path]) graph[f.path] = { comments: 0, authors: new Set(), lines: [] };
  }
  return graph;
}

function formatReviewFile(prMeta, inlineComments, issueComments, reviews, fileGraph) {
  const lines = [];
  const pr = prMeta;

  lines.push(`# pr #${pr.number}: ${pr.title}`);
  lines.push('');
  lines.push(`branch: \`${pr.headRefName}\` → \`${pr.baseRefName}\``);
  lines.push(`state: ${pr.state}`);
  lines.push(`files changed: ${pr.files.length}`);
  lines.push('');

  // file graph — which files need attention
  lines.push('## file attention map');
  lines.push('');
  const sorted = Object.entries(fileGraph).sort((a, b) => b[1].comments - a[1].comments);
  for (const [file, data] of sorted) {
    const authors = [...data.authors].join(', ');
    if (data.comments > 0) {
      lines.push(`- \`${file}\` — ${data.comments} comment(s) from ${authors}`);
    }
  }
  const clean = sorted.filter(([, d]) => d.comments === 0);
  if (clean.length > 0) {
    lines.push(`- ${clean.length} file(s) with no review comments`);
  }
  lines.push('');

  // review verdicts (approve/request changes/comment)
  const verdicts = reviews.filter((r) => r.state !== 'COMMENTED' || r.body);
  if (verdicts.length > 0) {
    lines.push('## review verdicts');
    lines.push('');
    for (const r of verdicts) {
      const who = classifyAuthor(r.user.login);
      const state = r.state.toLowerCase().replace('_', ' ');
      lines.push(`- **${who}**: ${state}${r.body ? ' — ' + r.body.split('\n')[0].slice(0, 120) : ''}`);
    }
    lines.push('');
  }

  // inline comments grouped by file
  if (inlineComments.length > 0) {
    lines.push('## inline comments');
    lines.push('');
    const byFile = {};
    for (const c of inlineComments) {
      const file = c.path || 'unknown';
      if (!byFile[file]) byFile[file] = [];
      byFile[file].push(c);
    }
    for (const [file, comments] of Object.entries(byFile)) {
      lines.push(`### \`${file}\``);
      lines.push('');
      for (const c of comments) {
        const who = classifyAuthor(c.user.login);
        const line = c.line || c.original_line || '?';
        const body = c.body.trim();
        lines.push(`**${who}** (line ${line}):`);
        lines.push('');
        // indent the body
        for (const bl of body.split('\n')) {
          lines.push(`> ${bl}`);
        }
        lines.push('');
      }
    }
  }

  // summary comments (issue-level, usually from bots)
  const botSummaries = issueComments.filter((c) => BOTS.includes(c.user.login));
  if (botSummaries.length > 0) {
    lines.push('## bot summaries');
    lines.push('');
    for (const c of botSummaries) {
      const who = classifyAuthor(c.user.login);
      // truncate long bot summaries to first 80 lines
      const body = c.body.split('\n').slice(0, 80).join('\n');
      lines.push(`### ${who}`);
      lines.push('');
      lines.push(body);
      lines.push('');
    }
  }

  // human comments
  const humanComments = issueComments.filter((c) => !BOTS.includes(c.user.login) && c.user.login !== 'github-actions[bot]');
  if (humanComments.length > 0) {
    lines.push('## human comments');
    lines.push('');
    for (const c of humanComments) {
      const who = classifyAuthor(c.user.login);
      lines.push(`**${who}**:`);
      lines.push('');
      for (const bl of c.body.trim().split('\n')) {
        lines.push(`> ${bl}`);
      }
      lines.push('');
    }
  }

  // action items — extract actionable lines from inline comments
  lines.push('## action items');
  lines.push('');
  let actionCount = 0;
  for (const c of inlineComments) {
    const who = classifyAuthor(c.user.login);
    const file = c.path || 'unknown';
    const line = c.line || c.original_line || '?';
    // first non-empty line of the comment as the action
    const firstLine = c.body.trim().split('\n').find((l) => l.trim()) || '';
    actionCount++;
    lines.push(`${actionCount}. \`${file}:${line}\` — ${firstLine.slice(0, 150)} (${who})`);
  }
  if (actionCount === 0) {
    lines.push('no inline review comments to address.');
  }
  lines.push('');

  // task loop reminder
  lines.push('---');
  lines.push('');
  lines.push('## fixing these — full task loop');
  lines.push('');
  lines.push('```');
  lines.push('bun run stream:context -- --area <area>');
  lines.push('bun run stream:sync -- --area <area>');
  lines.push('bun run task:start -- --area <area> --title "fix review comments"');
  lines.push('bun run review -- --mine');
  lines.push('bun run task:push -- --message "fix(scope): address review comments" --changed');
  lines.push('bun run task:pr');
  lines.push('bun run task:prs');
  lines.push('bun run task:merge -- --pr <N> --wait');
  lines.push('bun run task:finish');
  lines.push('```');

  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }

  let prNumber = args.prNumber || detectPrNumber();
  if (!prNumber) {
    writeStderr('error: no PR number provided and none found in .task/current.json');
    writeStderr('usage: bun run pr-review -- <pr-number>');
    process.exit(1);
  }

  writeStderr(`→ fetching reviews for PR #${prNumber}...`);

  const prMeta = fetchPrMeta(prNumber);
  const inlineComments = fetchInlineComments(prNumber);
  const issueComments = fetchIssueComments(prNumber);
  const reviews = fetchReviews(prNumber);

  writeStderr(`  ${inlineComments.length} inline comments, ${issueComments.length} issue comments, ${reviews.length} reviews`);

  const fileGraph = buildFileGraph(inlineComments, prMeta.files || []);

  if (args.json) {
    const data = {
      pr: { number: prMeta.number, title: prMeta.title, branch: prMeta.headRefName, base: prMeta.baseRefName },
      fileGraph: Object.fromEntries(Object.entries(fileGraph).map(([k, v]) => [k, { ...v, authors: [...v.authors] }])),
      inlineComments: inlineComments.map((c) => ({
        file: c.path, line: c.line || c.original_line, author: classifyAuthor(c.user.login), body: c.body,
      })),
      reviews: reviews.map((r) => ({ author: classifyAuthor(r.user.login), state: r.state, body: r.body })),
    };
    writeStdout(JSON.stringify(data, null, 2));
    return;
  }

  const content = formatReviewFile(prMeta, inlineComments, issueComments, reviews, fileGraph);

  if (args.stdout) {
    writeStdout(content);
    return;
  }

  // write to .task/reviews/<pr-number>.md
  const task = findTaskMeta();
  const outDir = task ? path.join(task.root, '.task', 'reviews') : path.join(process.cwd(), '.task', 'reviews');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${prNumber}.md`);
  fs.writeFileSync(outPath, content + '\n', 'utf8');

  const relPath = path.relative(process.cwd(), outPath);
  writeStderr(`→ wrote ${relPath}`);
  writeStdout(relPath);
}

main();
