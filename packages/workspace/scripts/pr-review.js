#!/usr/bin/env bun

// pr-review.js — fetch review comments from a PR, write structured file
// pulls from CodeRabbit, Qodo, Codex/OpenAI bots, ko, and human reviewers
// output: .task/reviews/<pr-number>.md — structured, graph-aware, actionable

const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');
const { findTaskMeta: findTaskMetaRecord, getTaskReviewsDir } = require('./lib/task-meta');

const REPO = 'consuelohq/opensaas';
const KNOWN_REVIEW_BOT_PATTERNS = [
  { pattern: /coderabbit/i, label: 'coderabbit' },
  { pattern: /qodo/i, label: 'qodo' },
  { pattern: /codex|openai|chatgpt/i, label: 'codex' },
];
const ACTIONABLE_BODY_RE = /(actionable comments|suggestion|```diff|```suggestion|should|must|fix|regression|security|correctness|maintainability|cr-comment|finding|issue)/i;
const BOT_NOISE_RE = /(rate limit|secondary rate limit|too many requests|http 429|temporarily unavailable|request failed|unable to review|no changed files|skipped review|try again later)/i;

function writeStdout(s = '') { process.stdout.write(s + '\n'); }
function writeStderr(s = '') { process.stderr.write(s + '\n'); }

function compactGhError(error, args) {
  const raw = [error?.stderr, error?.stdout, error?.message]
    .filter(Boolean)
    .map((value) => String(value))
    .join('\n');
  const seen = new Set();
  const kept = [];
  for (const line of raw.split('\n').map((value) => value.trim()).filter(Boolean)) {
    const redacted = line.replace(/gh[ops]_[A-Za-z0-9_]+/g, '<redacted-token>');
    const key = redacted.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (BOT_NOISE_RE.test(redacted) || /http [0-9]{3}|graphql|api rate/i.test(redacted)) {
      kept.push(redacted.slice(0, 240));
    } else if (kept.length < 4 && redacted.length < 300 && !/^\{/.test(redacted)) {
      kept.push(redacted);
    }
    if (kept.length >= 8) break;
  }
  const summary = kept.length > 0 ? kept.join(' | ') : 'unknown gh failure';
  return `gh ${args.slice(0, 3).join(' ')} failed: ${summary}`;
}

function gh(args) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    throw new Error(compactGhError(error, args));
  }
}

function ghJson(args) {
  const raw = gh(args);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`failed to parse gh JSON for ${args.slice(0, 3).join(' ')}: ${error.message}`);
  }
}

function flattenPaginatedJson(payload) {
  if (payload == null) return [];
  if (!Array.isArray(payload)) return [payload];
  if (payload.every((page) => Array.isArray(page))) return payload.flat();
  return payload;
}

function ghPaginatedJson(endpoint) {
  return flattenPaginatedJson(ghJson(['api', endpoint, '--paginate', '--slurp']));
}

function findTaskMeta() {
  const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  const record = findTaskMetaRecord(process.cwd(), { currentBranch });
  return record ? { data: record.data, root: record.dir } : null;
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
  ];
  lines.forEach((line) => writeStdout(line));
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
  return ghJson(['pr', 'view', String(prNumber), '--repo', REPO, '--json', 'number,title,headRefName,baseRefName,state,files,author']);
}

function fetchInlineComments(prNumber) {
  return ghPaginatedJson(`repos/${REPO}/pulls/${prNumber}/comments`);
}

function fetchIssueComments(prNumber) {
  return ghPaginatedJson(`repos/${REPO}/issues/${prNumber}/comments`);
}

function fetchReviews(prNumber) {
  return ghPaginatedJson(`repos/${REPO}/pulls/${prNumber}/reviews`);
}

function fetchReviewCommentsForReviews(prNumber, reviews) {
  const comments = [];
  for (const review of reviews) {
    if (!review?.id) continue;
    try {
      comments.push(...ghPaginatedJson(`repos/${REPO}/pulls/${prNumber}/reviews/${review.id}/comments`));
    } catch (error) {
      writeStderr(`  warning: skipped comments for review ${review.id}: ${error.message}`);
    }
  }
  return comments;
}

function commentSortKey(comment) {
  return comment.updated_at || comment.created_at || '';
}

function mergeCommentsById(comments) {
  const byKey = new Map();
  for (const comment of comments) {
    const key = comment.id ?? `${comment.path || 'unknown'}:${comment.line || comment.original_line || '?'}:${comment.user?.login || 'unknown'}:${comment.body || ''}`;
    const previous = byKey.get(key);
    if (!previous || commentSortKey(comment) >= commentSortKey(previous)) {
      byKey.set(key, comment);
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const fileCompare = String(a.path || '').localeCompare(String(b.path || ''));
    if (fileCompare !== 0) return fileCompare;
    return Number(a.line || a.original_line || 0) - Number(b.line || b.original_line || 0);
  });
}

function isKnownReviewBot(login = '') {
  return login.endsWith('[bot]') || KNOWN_REVIEW_BOT_PATTERNS.some(({ pattern }) => pattern.test(login));
}

function classifyAuthor(login = '') {
  const known = KNOWN_REVIEW_BOT_PATTERNS.find(({ pattern }) => pattern.test(login));
  if (known) return known.label;
  if (login === 'kokayicobb') return 'ko';
  return login.replace('[bot]', '');
}

function isActionableBody(body = '') {
  return ACTIONABLE_BODY_RE.test(body);
}

function isNoisyBotSummary(commentOrReview) {
  const login = commentOrReview?.user?.login || '';
  const body = commentOrReview?.body || '';
  return isKnownReviewBot(login) && BOT_NOISE_RE.test(body) && !isActionableBody(body);
}

function buildFileGraph(inlineComments, changedFiles) {
  const graph = {};
  for (const c of inlineComments) {
    const file = c.path || 'unknown';
    if (!graph[file]) graph[file] = { comments: 0, authors: new Set(), lines: [] };
    graph[file].comments++;
    graph[file].authors.add(classifyAuthor(c.user?.login || 'unknown'));
    graph[file].lines.push(c.line || c.original_line || '?');
  }
  for (const f of changedFiles) {
    if (!graph[f.path]) graph[f.path] = { comments: 0, authors: new Set(), lines: [] };
  }
  return graph;
}

function formatQuotedBody(lines, body) {
  for (const line of String(body || '').trim().split('\n')) {
    lines.push(`> ${line}`);
  }
}

function formatReviewFile(prMeta, inlineComments, issueComments, reviews, fileGraph) {
  const lines = [];
  const usefulIssueComments = issueComments.filter((comment) => !isNoisyBotSummary(comment));
  const usefulReviews = reviews.filter((review) => !isNoisyBotSummary(review));

  lines.push(`# pr #${prMeta.number}: ${prMeta.title}`);
  lines.push('');
  lines.push(`branch: \`${prMeta.headRefName}\` → \`${prMeta.baseRefName}\``);
  lines.push(`state: ${prMeta.state}`);
  lines.push(`files changed: ${prMeta.files.length}`);
  lines.push('');

  lines.push('## file attention map');
  lines.push('');
  const sorted = Object.entries(fileGraph).sort((a, b) => b[1].comments - a[1].comments);
  for (const [file, data] of sorted) {
    const authors = [...data.authors].join(', ');
    if (data.comments > 0) lines.push(`- \`${file}\` — ${data.comments} comment(s) from ${authors}`);
  }
  const clean = sorted.filter(([, data]) => data.comments === 0);
  if (clean.length > 0) lines.push(`- ${clean.length} file(s) with no review comments`);
  lines.push('');

  const verdicts = usefulReviews.filter((r) => r.state !== 'COMMENTED' || r.body);
  if (verdicts.length > 0) {
    lines.push('## review verdicts');
    lines.push('');
    for (const r of verdicts) {
      const who = classifyAuthor(r.user?.login || 'unknown');
      const state = String(r.state || '').toLowerCase().replace('_', ' ');
      lines.push(`- **${who}**: ${state}${r.body ? ' — ' + r.body.split('\n')[0].slice(0, 120) : ''}`);
    }
    lines.push('');
  }

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
        const who = classifyAuthor(c.user?.login || 'unknown');
        const line = c.line || c.original_line || '?';
        lines.push(`**${who}** (line ${line}, updated ${c.updated_at || c.created_at || 'unknown'}):`);
        lines.push('');
        formatQuotedBody(lines, c.body);
        lines.push('');
      }
    }
  }

  const botSummaries = usefulIssueComments.filter((c) => isKnownReviewBot(c.user?.login || ''));
  if (botSummaries.length > 0) {
    lines.push('## bot summaries');
    lines.push('');
    for (const c of botSummaries) {
      const who = classifyAuthor(c.user?.login || 'unknown');
      const body = String(c.body || '').split('\n').slice(0, 80).join('\n');
      lines.push(`### ${who} (updated ${c.updated_at || c.created_at || 'unknown'})`);
      lines.push('');
      lines.push(body);
      lines.push('');
    }
  }

  const humanComments = usefulIssueComments.filter((c) => !isKnownReviewBot(c.user?.login || '') && c.user?.login !== 'github-actions[bot]');
  if (humanComments.length > 0) {
    lines.push('## human comments');
    lines.push('');
    for (const c of humanComments) {
      const who = classifyAuthor(c.user?.login || 'unknown');
      lines.push(`**${who}**:`);
      lines.push('');
      formatQuotedBody(lines, c.body);
      lines.push('');
    }
  }

  lines.push('## action items');
  lines.push('');
  let actionCount = 0;
  for (const c of inlineComments) {
    const who = classifyAuthor(c.user?.login || 'unknown');
    const file = c.path || 'unknown';
    const line = c.line || c.original_line || '?';
    const firstLine = String(c.body || '').trim().split('\n').find((l) => l.trim()) || '';
    actionCount++;
    lines.push(`${actionCount}. \`${file}:${line}\` — ${firstLine.slice(0, 150)} (${who})`);
  }
  for (const r of usefulReviews.filter((review) => review.body && isActionableBody(review.body))) {
    actionCount++;
    const who = classifyAuthor(r.user?.login || 'unknown');
    const firstLine = String(r.body || '').trim().split('\n').find((line) => line.trim()) || '';
    lines.push(`${actionCount}. review summary — ${firstLine.slice(0, 150)} (${who})`);
  }
  if (actionCount === 0) lines.push('no inline review comments to address.');
  lines.push('');

  const suppressedNoiseCount = issueComments.length + reviews.length - usefulIssueComments.length - usefulReviews.length;
  if (suppressedNoiseCount > 0) {
    lines.push(`suppressed ${suppressedNoiseCount} non-actionable bot/rate-limit review message(s).`);
    lines.push('');
  }

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

  const prNumber = args.prNumber || detectPrNumber();
  if (!prNumber) {
    writeStderr('error: no PR number provided and none found in .task/current.json');
    writeStderr('usage: bun run pr-review -- <pr-number>');
    process.exit(1);
  }

  writeStderr(`→ fetching reviews for PR #${prNumber}...`);

  const prMeta = fetchPrMeta(prNumber);
  const reviews = fetchReviews(prNumber);
  const inlineComments = mergeCommentsById([
    ...fetchInlineComments(prNumber),
    ...fetchReviewCommentsForReviews(prNumber, reviews),
  ]);
  const issueComments = fetchIssueComments(prNumber);

  const suppressedNoiseCount = issueComments.filter(isNoisyBotSummary).length + reviews.filter(isNoisyBotSummary).length;
  writeStderr(`  ${inlineComments.length} inline comments, ${issueComments.length} issue comments, ${reviews.length} reviews`);
  if (suppressedNoiseCount > 0) writeStderr(`  suppressed ${suppressedNoiseCount} non-actionable bot/rate-limit message(s)`);

  const fileGraph = buildFileGraph(inlineComments, prMeta.files || []);

  if (args.json) {
    const data = {
      pr: { number: prMeta.number, title: prMeta.title, branch: prMeta.headRefName, base: prMeta.baseRefName },
      counts: { inlineComments: inlineComments.length, issueComments: issueComments.length, reviews: reviews.length, suppressedNoise: suppressedNoiseCount },
      fileGraph: Object.fromEntries(Object.entries(fileGraph).map(([key, value]) => [key, { ...value, authors: [...value.authors] }])),
      inlineComments: inlineComments.map((c) => ({
        id: c.id, file: c.path, line: c.line || c.original_line, author: classifyAuthor(c.user?.login || 'unknown'), updatedAt: c.updated_at, body: c.body,
      })),
      issueComments: issueComments.filter((c) => !isNoisyBotSummary(c)).map((c) => ({
        id: c.id, author: classifyAuthor(c.user?.login || 'unknown'), updatedAt: c.updated_at, body: c.body,
      })),
      reviews: reviews.filter((r) => !isNoisyBotSummary(r)).map((r) => ({
        id: r.id, author: classifyAuthor(r.user?.login || 'unknown'), state: r.state, updatedAt: r.submitted_at, body: r.body,
      })),
    };
    writeStdout(JSON.stringify(data, null, 2));
    return;
  }

  const content = formatReviewFile(prMeta, inlineComments, issueComments, reviews, fileGraph);

  if (args.stdout) {
    writeStdout(content);
    return;
  }

  const task = findTaskMeta();
  const outDir = task ? getTaskReviewsDir(task.root, task.data) : path.join(process.cwd(), '.task', 'reviews');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${prNumber}.md`);
  fs.writeFileSync(outPath, content + '\n', 'utf8');

  const relPath = path.relative(process.cwd(), outPath);
  writeStderr(`→ wrote ${relPath}`);
  writeStdout(relPath);
}

if (require.main === module) {
  main();
}

module.exports = {
  classifyAuthor,
  compactGhError,
  flattenPaginatedJson,
  formatReviewFile,
  isKnownReviewBot,
  isNoisyBotSummary,
  mergeCommentsById,
};
