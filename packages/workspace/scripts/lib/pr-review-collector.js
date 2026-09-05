const { execFileSync } = require('child_process');
const { resolveGitHubCli } = require('./github');

const DEFAULT_REPO = 'consuelohq/opensaas';
const KNOWN_REVIEW_BOT_PATTERNS = [
  { pattern: /coderabbit/i, label: 'coderabbit' },
  { pattern: /qodo/i, label: 'qodo' },
  { pattern: /codex|openai|chatgpt/i, label: 'codex' },
];
const ACTIONABLE_BODY_RE = /(actionable comments|suggestion|```diff|```suggestion|should|must|fix|regression|security|correctness|maintainability|cr-comment|finding|issue)/i;
const BOT_NOISE_RE = /(rate limit|secondary rate limit|too many requests|http 429|temporarily unavailable|request failed|unable to review|no changed files|skipped review|try again later)/i;

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
    return execFileSync(resolveGitHubCli(), args, {
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

function fetchPrMeta(prNumber, repo = DEFAULT_REPO) {
  return ghJson(['pr', 'view', String(prNumber), '--repo', repo, '--json', 'number,title,headRefName,baseRefName,state,files,author']);
}

function fetchInlineComments(prNumber, repo = DEFAULT_REPO) {
  return ghPaginatedJson(`repos/${repo}/pulls/${prNumber}/comments`);
}

function fetchIssueComments(prNumber, repo = DEFAULT_REPO) {
  return ghPaginatedJson(`repos/${repo}/issues/${prNumber}/comments`);
}

function fetchReviews(prNumber, repo = DEFAULT_REPO) {
  return ghPaginatedJson(`repos/${repo}/pulls/${prNumber}/reviews`);
}

function fetchReviewCommentsForReviews(prNumber, reviews, repo = DEFAULT_REPO, onWarning = () => {}) {
  const comments = [];
  for (const review of reviews) {
    if (!review?.id) continue;
    try {
      comments.push(...ghPaginatedJson(`repos/${repo}/pulls/${prNumber}/reviews/${review.id}/comments`));
    } catch (error) {
      onWarning(`skipped comments for review ${review.id}: ${error.message}`);
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
  for (const comment of inlineComments) {
    const file = comment.path || 'unknown';
    if (!graph[file]) graph[file] = { comments: 0, authors: new Set(), lines: [] };
    graph[file].comments += 1;
    graph[file].authors.add(classifyAuthor(comment.user?.login || 'unknown'));
    graph[file].lines.push(comment.line || comment.original_line || '?');
  }
  for (const file of changedFiles || []) {
    if (!graph[file.path]) graph[file.path] = { comments: 0, authors: new Set(), lines: [] };
  }
  return graph;
}

function serializeFileGraph(fileGraph) {
  return Object.fromEntries(Object.entries(fileGraph).map(([key, value]) => [key, {
    comments: value.comments,
    authors: [...value.authors],
    lines: value.lines,
  }]));
}

function collectPrReview({ prNumber, repo = DEFAULT_REPO, onWarning = () => {} }) {
  const prMeta = fetchPrMeta(prNumber, repo);
  const reviews = fetchReviews(prNumber, repo);
  const inlineComments = mergeCommentsById([
    ...fetchInlineComments(prNumber, repo),
    ...fetchReviewCommentsForReviews(prNumber, reviews, repo, onWarning),
  ]);
  const issueComments = fetchIssueComments(prNumber, repo);
  const fileGraph = buildFileGraph(inlineComments, prMeta.files || []);
  const suppressedNoiseCount = issueComments.filter(isNoisyBotSummary).length + reviews.filter(isNoisyBotSummary).length;

  return {
    repo,
    prNumber,
    prMeta,
    reviews,
    inlineComments,
    issueComments,
    fileGraph,
    suppressedNoiseCount,
  };
}

function createPrReviewJson(packet) {
  const { prMeta, inlineComments, issueComments, reviews, fileGraph, suppressedNoiseCount, repo } = packet;
  return {
    repo,
    pr: { number: prMeta.number, title: prMeta.title, branch: prMeta.headRefName, base: prMeta.baseRefName, state: prMeta.state },
    counts: {
      inlineComments: inlineComments.length,
      issueComments: issueComments.length,
      reviews: reviews.length,
      suppressedNoise: suppressedNoiseCount,
    },
    fileGraph: serializeFileGraph(fileGraph),
    inlineComments: inlineComments.map((comment) => ({
      id: comment.id,
      file: comment.path,
      line: comment.line || comment.original_line,
      author: classifyAuthor(comment.user?.login || 'unknown'),
      updatedAt: comment.updated_at || comment.created_at,
      body: comment.body,
    })),
    issueComments: issueComments.filter((comment) => !isNoisyBotSummary(comment)).map((comment) => ({
      id: comment.id,
      author: classifyAuthor(comment.user?.login || 'unknown'),
      updatedAt: comment.updated_at || comment.created_at,
      body: comment.body,
    })),
    reviews: reviews.filter((review) => !isNoisyBotSummary(review)).map((review) => ({
      id: review.id,
      author: classifyAuthor(review.user?.login || 'unknown'),
      state: review.state,
      updatedAt: review.submitted_at,
      body: review.body,
    })),
  };
}

function formatQuotedBody(lines, body) {
  for (const line of String(body || '').trim().split('\n')) lines.push(`> ${line}`);
}

function formatReviewFile(packet) {
  const { prMeta, inlineComments, issueComments, reviews, fileGraph } = packet;
  const lines = [];
  const usefulIssueComments = issueComments.filter((comment) => !isNoisyBotSummary(comment));
  const usefulReviews = reviews.filter((review) => !isNoisyBotSummary(review));

  lines.push(`# pr #${prMeta.number}: ${prMeta.title}`);
  lines.push('');
  lines.push(`branch: \`${prMeta.headRefName}\` -> \`${prMeta.baseRefName}\``);
  lines.push(`state: ${prMeta.state}`);
  lines.push(`files changed: ${prMeta.files.length}`);
  lines.push('');
  lines.push('## file attention map');
  lines.push('');
  const sorted = Object.entries(fileGraph).sort((a, b) => b[1].comments - a[1].comments);
  for (const [file, data] of sorted) {
    const authors = [...data.authors].join(', ');
    if (data.comments > 0) lines.push(`- \`${file}\` - ${data.comments} comment(s) from ${authors}`);
  }
  const clean = sorted.filter(([, data]) => data.comments === 0);
  if (clean.length > 0) lines.push(`- ${clean.length} file(s) with no review comments`);
  lines.push('');

  const verdicts = usefulReviews.filter((review) => review.state !== 'COMMENTED' || review.body);
  if (verdicts.length > 0) {
    lines.push('## review verdicts');
    lines.push('');
    for (const review of verdicts) {
      const who = classifyAuthor(review.user?.login || 'unknown');
      const state = String(review.state || '').toLowerCase().replace('_', ' ');
      lines.push(`- **${who}**: ${state}${review.body ? ' - ' + review.body.split('\n')[0].slice(0, 120) : ''}`);
    }
    lines.push('');
  }

  if (inlineComments.length > 0) {
    lines.push('## inline comments');
    lines.push('');
    const byFile = {};
    for (const comment of inlineComments) {
      const file = comment.path || 'unknown';
      if (!byFile[file]) byFile[file] = [];
      byFile[file].push(comment);
    }
    for (const [file, comments] of Object.entries(byFile)) {
      lines.push(`### \`${file}\``);
      lines.push('');
      for (const comment of comments) {
        const who = classifyAuthor(comment.user?.login || 'unknown');
        const line = comment.line || comment.original_line || '?';
        lines.push(`**${who}** (line ${line}, updated ${comment.updated_at || comment.created_at || 'unknown'}):`);
        lines.push('');
        formatQuotedBody(lines, comment.body);
        lines.push('');
      }
    }
  }

  const botSummaries = usefulIssueComments.filter((comment) => isKnownReviewBot(comment.user?.login || ''));
  if (botSummaries.length > 0) {
    lines.push('## bot summaries');
    lines.push('');
    for (const comment of botSummaries) {
      const who = classifyAuthor(comment.user?.login || 'unknown');
      lines.push(`### ${who} (updated ${comment.updated_at || comment.created_at || 'unknown'})`);
      lines.push('');
      lines.push(String(comment.body || '').split('\n').slice(0, 80).join('\n'));
      lines.push('');
    }
  }

  const humanComments = usefulIssueComments.filter((comment) => !isKnownReviewBot(comment.user?.login || '') && comment.user?.login !== 'github-actions[bot]');
  if (humanComments.length > 0) {
    lines.push('## human comments');
    lines.push('');
    for (const comment of humanComments) {
      const who = classifyAuthor(comment.user?.login || 'unknown');
      lines.push(`**${who}**:`);
      lines.push('');
      formatQuotedBody(lines, comment.body);
      lines.push('');
    }
  }

  lines.push('## action items');
  lines.push('');
  let actionCount = 0;
  for (const comment of inlineComments) {
    const who = classifyAuthor(comment.user?.login || 'unknown');
    const file = comment.path || 'unknown';
    const line = comment.line || comment.original_line || '?';
    const firstLine = String(comment.body || '').trim().split('\n').find((lineValue) => lineValue.trim()) || '';
    actionCount += 1;
    lines.push(`${actionCount}. \`${file}:${line}\` - ${firstLine.slice(0, 150)} (${who})`);
  }
  for (const review of usefulReviews.filter((item) => item.body && isActionableBody(item.body))) {
    const who = classifyAuthor(review.user?.login || 'unknown');
    const firstLine = String(review.body || '').trim().split('\n').find((lineValue) => lineValue.trim()) || '';
    actionCount += 1;
    lines.push(`${actionCount}. review summary - ${firstLine.slice(0, 150)} (${who})`);
  }
  if (actionCount === 0) lines.push('no inline review comments to address.');
  lines.push('');
  if (packet.suppressedNoiseCount > 0) {
    lines.push(`suppressed ${packet.suppressedNoiseCount} non-actionable bot/rate-limit review message(s).`);
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = {
  ACTIONABLE_BODY_RE,
  BOT_NOISE_RE,
  DEFAULT_REPO,
  classifyAuthor,
  collectPrReview,
  compactGhError,
  createPrReviewJson,
  flattenPaginatedJson,
  formatReviewFile,
  isKnownReviewBot,
  isNoisyBotSummary,
  mergeCommentsById,
};
