const GRAPHITE_BASE_URL = 'https://app.graphite.com/github/pr';

function slugifyGraphitePath(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getBranchSlug(branch) {
  const parts = String(branch || '').split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function buildGitHubPullRequestUrl(repository, pullRequestNumber) {
  if (!repository || !pullRequestNumber) return null;
  return `https://github.com/${repository}/pull/${pullRequestNumber}`;
}

function buildGraphitePullRequestUrl(repository, pullRequestNumber, slugSource) {
  if (!repository || !pullRequestNumber) return null;

  const slug = slugifyGraphitePath(slugSource || `pr-${pullRequestNumber}`);
  return `${GRAPHITE_BASE_URL}/${repository}/${pullRequestNumber}/${slug}`;
}

function addPullRequestLinks({ repository, pullRequestNumber, githubUrl, slugSource }) {
  const number = pullRequestNumber || null;
  const url = githubUrl || buildGitHubPullRequestUrl(repository, number);
  const graphiteUrl = buildGraphitePullRequestUrl(repository, number, slugSource);

  return {
    number,
    url,
    githubUrl: url,
    graphiteUrl,
  };
}

module.exports = {
  addPullRequestLinks,
  buildGitHubPullRequestUrl,
  buildGraphitePullRequestUrl,
  getBranchSlug,
  slugifyGraphitePath,
};
