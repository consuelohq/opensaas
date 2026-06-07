const fs = require('fs');
const path = require('path');

const { getPackageRoot } = require('./paths');

const GITHUB_API_URL = 'https://api.github.com';
let workspaceEnvLoaded = false;

class GitHubRequestError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'GitHubRequestError';
    this.details = details;
  }
}

function loadWorkspaceEnv() {
  if (workspaceEnvLoaded) {
    return;
  }

  workspaceEnvLoaded = true;

  const envPath = path.join(getPackageRoot(), '.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const line = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
    const separatorIndex = line.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();

    if (!key || process.env[key]) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();

    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    } else if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\n/g, '\n');
    }

    process.env[key] = value;
  }
}

function getToken() {
  let token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  if (!token) {
    loadWorkspaceEnv();
    token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  }

  if (!token) {
    try {
      token = require('child_process').execSync('gh auth token', { encoding: 'utf8', timeout: 5000 }).trim();
    } catch { /* gh cli not available or not logged in */ }
  }

  if (!token) {
    throw new Error(
      `missing github token: set GITHUB_TOKEN or GH_TOKEN, or add GITHUB_TOKEN to ${path.join(getPackageRoot(), '.env')}`,
    );
  }

  return token;
}

function parseRepository(repositoryFullName) {
  const parts = String(repositoryFullName || '').split('/');

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`invalid repo format: ${repositoryFullName}`);
  }

  return {
    owner: parts[0],
    name: parts[1],
    fullName: `${parts[0]}/${parts[1]}`,
  };
}

async function githubRequest({ token, method = 'GET', endpoint, body }) {
  const response = await fetch(`${GITHUB_API_URL}${endpoint}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'opensaas-workspace-scripts',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const responseText = await response.text();
  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }
  }

  if (!response.ok) {
    const message = typeof data === 'object' && data && data.message ? data.message : response.statusText;
    throw new GitHubRequestError(`github ${method} ${endpoint} -> ${response.status} ${message}`, {
      status: response.status,
      data,
    });
  }

  return data;
}

async function getBranchRef({ token, repository, branch }) {
  const { owner, name } = parseRepository(repository);

  try {
    return await githubRequest({
      token,
      endpoint: `/repos/${owner}/${name}/git/ref/heads/${branch}`,
    });
  } catch (error) {
    if (error instanceof GitHubRequestError && error.details.status === 404) {
      return null;
    }

    throw error;
  }
}

async function createBranch({ token, repository, branch, sha }) {
  const { owner, name } = parseRepository(repository);

  return githubRequest({
    token,
    method: 'POST',
    endpoint: `/repos/${owner}/${name}/git/refs`,
    body: {
      ref: `refs/heads/${branch}`,
      sha,
    },
  });
}

async function updateBranchRef({ token, repository, branch, sha, force = false }) {
  const { owner, name } = parseRepository(repository);

  return githubRequest({
    token,
    method: 'PATCH',
    endpoint: `/repos/${owner}/${name}/git/refs/heads/${branch}`,
    body: { sha, force },
  });
}

async function getCommit({ token, repository, sha }) {
  const { owner, name } = parseRepository(repository);

  return githubRequest({
    token,
    endpoint: `/repos/${owner}/${name}/git/commits/${sha}`,
  });
}

async function createBlob({ token, repository, content, encoding = 'utf-8' }) {
  const { owner, name } = parseRepository(repository);

  return githubRequest({
    token,
    method: 'POST',
    endpoint: `/repos/${owner}/${name}/git/blobs`,
    body: { content, encoding },
  });
}

async function createTree({ token, repository, baseTree, tree }) {
  const { owner, name } = parseRepository(repository);

  return githubRequest({
    token,
    method: 'POST',
    endpoint: `/repos/${owner}/${name}/git/trees`,
    body: { base_tree: baseTree, tree },
  });
}

async function createCommit({ token, repository, message, tree, parents, author, committer }) {
  const { owner, name } = parseRepository(repository);

  return githubRequest({
    token,
    method: 'POST',
    endpoint: `/repos/${owner}/${name}/git/commits`,
    body: { message, tree, parents, author, committer },
  });
}

async function listPullRequests({ token, repository, state = 'open', owner, head, base }) {
  const parsedRepository = parseRepository(repository);
  const query = new URLSearchParams({
    state,
    per_page: '100',
    sort: 'updated',
    direction: 'desc',
  });

  if (head) {
    query.set('head', head.includes(':') ? head : `${owner || parsedRepository.owner}:${head}`);
  }

  if (base) {
    query.set('base', base);
  }

  const pullRequests = await githubRequest({
    token,
    endpoint: `/repos/${parsedRepository.owner}/${parsedRepository.name}/pulls?${query.toString()}`,
  });

  return Array.isArray(pullRequests) ? pullRequests : [];
}

async function findPullRequest({ token, repository, owner, branch, base, state = 'open' }) {
  const pullRequests = await listPullRequests({
    token,
    repository,
    state,
    owner,
    head: branch,
    base,
  });

  return pullRequests.length > 0 ? pullRequests[0] : null;
}

async function findOpenPullRequest({ token, repository, owner, branch, base }) {
  return findPullRequest({
    token,
    repository,
    owner,
    branch,
    base,
    state: 'open',
  });
}

async function createPullRequest({ token, repository, title, body, head, base, draft = true }) {
  const { owner, name } = parseRepository(repository);

  return githubRequest({
    token,
    method: 'POST',
    endpoint: `/repos/${owner}/${name}/pulls`,
    body: { title, body, head, base, draft },
  });
}

async function updatePullRequest({ token, repository, prNumber, title, body, base }) {
  const { owner, name } = parseRepository(repository);
  const payload = {};

  if (title !== undefined) {
    payload.title = title;
  }

  if (body !== undefined) {
    payload.body = body;
  }

  if (base !== undefined) {
    payload.base = base;
  }

  return githubRequest({
    token,
    method: 'PATCH',
    endpoint: `/repos/${owner}/${name}/pulls/${prNumber}`,
    body: payload,
  });
}

async function markPullRequestReadyForReview({ token, repository, prNumber }) {
  const { owner, name } = parseRepository(repository);

  // Get the PR's node_id for GraphQL
  const prData = await githubRequest({
    token,
    method: 'GET',
    endpoint: `/repos/${owner}/${name}/pulls/${prNumber}`,
  });

  const nodeId = prData.node_id;

  // Use gh CLI for the GraphQL mutation — the script's GITHUB_TOKEN may lack
  // the scope needed for this mutation, but gh's auth always works.
  const { execSync } = require('child_process');
  try {
    execSync(
      `gh api graphql -f query='mutation { markPullRequestReadyForReview(input: { pullRequestId: "${nodeId}" }) { pullRequest { number isDraft } } }'`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (err) {
    throw new Error(`failed to mark PR #${prNumber} ready for review: ${err.stderr || err.message}`);
  }

  // re-fetch via REST so callers get the full PR shape
  return githubRequest({
    token,
    method: 'GET',
    endpoint: `/repos/${owner}/${name}/pulls/${prNumber}`,
  });
}

async function mergePullRequest({ token, repository, prNumber, commitTitle, mergeMethod = 'merge' }) {
  const { owner, name } = parseRepository(repository);
  const body = { merge_method: mergeMethod };

  if (commitTitle) {
    body.commit_title = commitTitle;
  }

  return githubRequest({
    token,
    method: 'PUT',
    endpoint: `/repos/${owner}/${name}/pulls/${prNumber}/merge`,
    body,
  });
}

module.exports = {
  GitHubRequestError,
  createBlob,
  createBranch,
  createCommit,
  createPullRequest,
  createTree,
  findOpenPullRequest,
  findPullRequest,
  getBranchRef,
  getCommit,
  getToken,
  githubRequest,
  listPullRequests,
  markPullRequestReadyForReview,
  mergePullRequest,
  parseRepository,
  updateBranchRef,
  updatePullRequest,
};
