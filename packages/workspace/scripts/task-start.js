#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DEFAULT_REPO = 'consuelohq/opensaas';
const DEFAULT_BASE = 'main';
const GITHUB_API_URL = 'https://api.github.com';

class GitHubRequestError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'GitHubRequestError';
    this.details = details;
  }
}

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: task-start.js --title "task title" [options]');
  writeStdout('');
  writeStdout('required:');
  writeStdout('  --title <value>        pull request title and branch slug source');
  writeStdout('');
  writeStdout('options:');
  writeStdout(`  --repo <owner/name>    github repository (default: ${DEFAULT_REPO})`);
  writeStdout(`  --base <branch>        base branch (default: ${DEFAULT_BASE})`);
  writeStdout('  --branch <name>        branch name (default: task/<slug-from-title>)');
  writeStdout('  --body <text>          pull request body text');
  writeStdout('  --body-file <path>     pull request body file path');
  writeStdout('  --json                 print json output');
  writeStdout('  --help                 show this help message');
  writeStdout('');
  writeStdout('examples:');
  writeStdout('  bun ./scripts/task-start.js --title "github workflow bootstrap" --json');
  writeStdout('  yarn workspace openworkspace task:start --title "dialer retry fix"');
}

function parseArgs(argv) {
  const args = {
    repo: DEFAULT_REPO,
    base: DEFAULT_BASE,
    json: false,
  };

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
      case '--title':
        args.title = value;
        break;
      case '--repo':
        args.repo = value;
        break;
      case '--base':
        args.base = value;
        break;
      case '--branch':
        args.branch = value;
        break;
      case '--body':
        args.body = value;
        break;
      case '--body-file':
        args.bodyFile = value;
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

  if (args.body && args.bodyFile) {
    throw new Error('use either --body or --body-file, not both');
  }

  return args;
}

function slugifyTitle(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function parseRepository(repo) {
  const [owner, name] = repo.split('/');

  if (!owner || !name || repo.split('/').length !== 2) {
    throw new Error(`invalid repo format: ${repo}`);
  }

  return { owner, name };
}

function getToken() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  if (!token) {
    throw new Error('missing github token: set GITHUB_TOKEN or GH_TOKEN');
  }

  return token;
}

async function githubRequest({ token, method = 'GET', endpoint, body }) {
  const response = await fetch(`${GITHUB_API_URL}${endpoint}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'opensaas-task-start-script',
    },
    body: body ? JSON.stringify(body) : undefined,
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

    throw new GitHubRequestError(`github api request failed: ${method} ${endpoint} -> ${response.status} ${message}`, {
      status: response.status,
      data,
    });
  }

  return data;
}

async function getBranchRef({ token, owner, name, branch }) {
  try {
    return await githubRequest({
      token,
      endpoint: `/repos/${owner}/${name}/git/ref/heads/${branch}`,
    });
  } catch (error) {
    if (error instanceof GitHubRequestError && error.details && error.details.status === 404) {
      return null;
    }

    throw error;
  }
}

async function getPullRequest({ token, owner, name, branch, base }) {
  const query = new URLSearchParams({
    state: 'open',
    head: `${owner}:${branch}`,
    base,
  });

  const pullRequests = await githubRequest({
    token,
    endpoint: `/repos/${owner}/${name}/pulls?${query.toString()}`,
  });

  return Array.isArray(pullRequests) && pullRequests.length > 0 ? pullRequests[0] : null;
}

function readPullRequestBody(args) {
  if (args.body) {
    return args.body;
  }

  if (args.bodyFile) {
    const filePath = path.resolve(process.cwd(), args.bodyFile);
    return fs.readFileSync(filePath, 'utf8');
  }

  return [
    '## summary',
    '- bootstrap task branch and draft pr',
    '',
    '## notes',
    '- created by `packages/workspace/scripts/task-start.js`',
  ].join('\n');
}

function printResult(result, useJson) {
  if (useJson) {
    writeStdout(JSON.stringify(result, null, 2));
    return;
  }

  writeStdout(`repo: ${result.repo}`);
  writeStdout(`base: ${result.base}`);
  writeStdout(`branch: ${result.branch}`);
  writeStdout(`created branch: ${result.createdBranch}`);
  writeStdout(`created bootstrap commit: ${result.createdBootstrapCommit}`);
  writeStdout(`created pr: ${result.createdPr}`);
  writeStdout(`pr: #${result.prNumber}`);
  writeStdout(`url: ${result.prUrl}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.title) {
    throw new Error('missing required --title');
  }

  // sync local main with github before creating branch
  const workspaceDir = process.env.WORKSPACE_DIR || path.resolve(__dirname, '..', '..', '..');
  writeStderr('syncing local main with github...');
  const { execSync } = require('child_process');
  try {
    execSync('git pull origin main', { cwd: workspaceDir, stdio: ['pipe', 'pipe', 'pipe'] });
    writeStderr('local main synced.');
  } catch (pullError) {
    writeStderr('warning: git pull failed (dirty state or offline). continuing with current local state.');
  }

  const slug = slugifyTitle(args.title);

  if (!slug) {
    throw new Error('unable to derive branch slug from title');
  }

  const branch = args.branch || `task/${slug}`;
  const { owner, name } = parseRepository(args.repo);
  const token = getToken();
  const prBody = readPullRequestBody(args);

  await githubRequest({
    token,
    endpoint: `/repos/${owner}/${name}`,
  });

  const baseRef = await githubRequest({
    token,
    endpoint: `/repos/${owner}/${name}/git/ref/heads/${args.base}`,
  });

  let createdBranch = false;
  let createdBootstrapCommit = false;
  let branchRef = await getBranchRef({ token, owner, name, branch });

  if (!branchRef) {
    branchRef = await githubRequest({
      token,
      method: 'POST',
      endpoint: `/repos/${owner}/${name}/git/refs`,
      body: {
        ref: `refs/heads/${branch}`,
        sha: baseRef.object.sha,
      },
    });
    createdBranch = true;
  }

  if (branchRef.object.sha === baseRef.object.sha) {
    const currentCommit = await githubRequest({
      token,
      endpoint: `/repos/${owner}/${name}/git/commits/${branchRef.object.sha}`,
    });

    const bootstrapCommit = await githubRequest({
      token,
      method: 'POST',
      endpoint: `/repos/${owner}/${name}/git/commits`,
      body: {
        message: `chore(workspace): bootstrap ${branch} branch`,
        tree: currentCommit.tree.sha,
        parents: [branchRef.object.sha],
      },
    });

    branchRef = await githubRequest({
      token,
      method: 'PATCH',
      endpoint: `/repos/${owner}/${name}/git/refs/heads/${branch}`,
      body: {
        sha: bootstrapCommit.sha,
        force: false,
      },
    });
    createdBootstrapCommit = true;
  }

  let pullRequest = await getPullRequest({
    token,
    owner,
    name,
    branch,
    base: args.base,
  });
  let createdPr = false;

  if (!pullRequest) {
    pullRequest = await githubRequest({
      token,
      method: 'POST',
      endpoint: `/repos/${owner}/${name}/pulls`,
      body: {
        title: args.title,
        body: prBody,
        head: branch,
        base: args.base,
        draft: true,
      },
    });
    createdPr = true;
  }

  printResult(
    {
      repo: `${owner}/${name}`,
      base: args.base,
      branch,
      createdBranch,
      createdBootstrapCommit,
      createdPr,
      prNumber: pullRequest.number,
      prUrl: pullRequest.html_url,
    },
    args.json,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  writeStderr(message);

  if (error instanceof GitHubRequestError && error.details && error.details.data) {
    writeStderr(JSON.stringify(error.details.data, null, 2));
  }

  process.exit(1);
});
