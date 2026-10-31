'use strict';

const DEFAULT_PULL_REQUEST_LIMIT = 12;
const DEFAULT_COMMIT_LIMIT = 8;

function compactStreamContext(source, { full = false } = {}) {
  if (full) return source;

  const open = source.openTaskPullRequests || {};
  const allPullRequests = Array.isArray(open.pullRequests) ? open.pullRequests : [];
  const authors = new Map();
  for (const request of allPullRequests) {
    if (request.author) authors.set(request.author, (authors.get(request.author) || 0) + 1);
  }
  const [mostCommonAuthor, commonCount] = [...authors.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || [null, 0];
  const usualAuthor = commonCount > allPullRequests.length / 2 ? mostCommonAuthor : null;
  const shown = allPullRequests.slice(0, DEFAULT_PULL_REQUEST_LIMIT);
  const prs = {
    total: allPullRequests.length,
    ...(open.skipped ? { skipped: true, reason: open.reason || 'unavailable' } : {}),
    ...(usualAuthor ? { usualAuthor } : {}),
    pullRequests: shown.map((request) => ({
      number: request.number,
      title: request.title,
      ...(!usualAuthor || request.author !== usualAuthor
        ? { author: request.author || null }
        : {}),
    })),
    ...(allPullRequests.length > shown.length ? { omitted: allPullRequests.length - shown.length } : {}),
  };

  const workpads = source.recentWorkpads || {};
  const workpadRows = Array.isArray(workpads.workpads) ? workpads.workpads : [];
  const commits = Array.isArray(source.recentCommits) ? source.recentCommits : [];
  const worktrees = Array.isArray(source.worktrees) ? source.worktrees : [];

  return {
    ...(source.area ? { area: source.area } : {}),
    stream: source.stream,
    ...(source.aheadBehind ? { aheadBehind: source.aheadBehind } : {}),
    ...(source.instructions?.exists ? { instructions: source.instructions } : {}),
    ...(Array.isArray(source.decisions) && source.decisions.length ? { decisions: source.decisions } : {}),
    openTaskPullRequests: prs,
    ...(workpadRows.length || workpads.skipped ? {
      recentWorkpads: {
        total: workpadRows.length,
        ...(workpads.skipped ? { skipped: true, reason: workpads.reason || 'unavailable' } : {}),
        workpads: workpadRows.map(({ title, date, category }) => ({
          title,
          date,
          ...(category && category !== 'workpad' ? { category } : {}),
        })),
      },
    } : {}),
    ...(commits.length ? {
      recentCommitCount: commits.length,
      recentCommits: commits.slice(0, DEFAULT_COMMIT_LIMIT)
        .map((commit) => commit.replace(/^([0-9a-f]{7,40})\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+[+-]\d{4}\s+/, '$1 ')),
    } : {}),
    ...(worktrees.length ? { worktrees: { total: worktrees.length } } : {}),
    detailHint: 'Call stream.context with { area: "' + (source.area || '') + '", full: true } for all PR branches, URLs, authors, complete workpads, commits and worktree paths.',
  };
}

module.exports = { compactStreamContext };
