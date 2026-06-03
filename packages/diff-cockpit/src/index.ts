export type PullRequestLocator = {
  owner: string;
  repo: string;
  number: number;
};

export type RepoLocator = {
  owner: string;
  repo: string;
};

export type GitHubPullRequest = {
  number: number;
  title: string;
  htmlUrl: string;
  state: string;
  draft: boolean;
  author: string;
  headRef: string;
  headSha: string;
  baseRef: string;
  baseSha: string;
  mergeable: boolean | null;
  mergeableState: string;
  updatedAt: string;
};

export type PullRequestKind = 'stream' | 'task' | 'draft' | 'open';
export type PullRequestCheckStatus = 'success' | 'failure' | 'pending' | 'unknown';
export type PullRequestReviewStatus = 'approved' | 'changes_requested' | 'commented' | 'none' | 'unknown';
export type PullRequestLifecycleStatus = 'open' | 'draft' | 'closed' | 'merged';

export type PullRequestSummary = GitHubPullRequest & {
  kind: PullRequestKind;
  createdAt: string;
  updatedAt: string;
  cockpitUrl: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  checkStatus: PullRequestCheckStatus;
  reviewStatus: PullRequestReviewStatus;
  lifecycleStatus: PullRequestLifecycleStatus;
  mergeStatus: PullRequestLifecycleStatus;
  mergedAt: string;
  closedAt: string;
  associatedStream: string;
};

export type PullRequestSection = {
  id: 'streams' | 'open' | 'recently-merged' | 'closed';
  title: string;
  pulls: PullRequestSummary[];
};

export type PullRequestIndexData = {
  repo: RepoLocator;
  pulls: PullRequestSummary[];
  updatedAt: string;
  warnings: string[];
};

export type GitHubPullRequestFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
  blobUrl: string;
};

export type ReviewProvider = 'github' | 'codex' | 'coderabbit' | 'claude' | 'unknown';

export type ReviewComment = {
  id: string;
  provider: ReviewProvider;
  author: string;
  body: string;
  url: string;
  createdAt: string;
  source: 'review' | 'issue-comment' | 'review-comment';
  path?: string;
  line?: number;
};

export type StreamCommit = {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  url: string;
  committedAt: string;
};

export type CheckSummary = {
  name: string;
  status: string;
  conclusion: string;
  url: string;
};
export type PullRequestReviewData = {
  locator: PullRequestLocator;
  pull: GitHubPullRequest;
  files: GitHubPullRequestFile[];
  tree: FileTreeNode;
  comments: ReviewComment[];
  streamCommits: StreamCommit[];
  warnings: string[];
  checks: CheckSummary[];
};

export type FileTreeNode = {
  type: 'root' | 'directory' | 'file';
  name: string;
  path: string;
  children: FileTreeNode[];
  file?: GitHubPullRequestFile;
};

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

type GithubLoaderOptions = {
  fetcher?: Fetcher;
  token?: string;
};

type DiffCockpitEnv = {
  GITHUB_TOKEN?: string;
  GH_TOKEN?: string;
  DIFF_COCKPIT_DEFAULT_REPO?: string;
};

const DEFAULT_OWNER = 'consuelohq';
const DEFAULT_REPO = 'opensaas';
const COCKPIT_ORIGIN = 'https://diffs.consuelohq.com';
const MAX_PAGES = 10;

export function parsePullRequestLocator(
  input: string,
  defaultRepo = `${DEFAULT_OWNER}/${DEFAULT_REPO}`,
): PullRequestLocator {
  const value = input.trim();
  const repoParts = defaultRepo.split('/');
  const defaultOwner = repoParts[0] || DEFAULT_OWNER;
  const fallbackRepo = repoParts[1] || DEFAULT_REPO;

  if (/^\d+$/.test(value)) {
    return { owner: defaultOwner, repo: fallbackRepo, number: Number(value) };
  }

  const githubMatch = value.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/,
  );
  if (githubMatch) {
    return {
      owner: githubMatch[1] || defaultOwner,
      repo: githubMatch[2] || fallbackRepo,
      number: Number(githubMatch[3]),
    };
  }

  const routeMatch = value.match(/^\/?([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/);
  if (routeMatch) {
    return {
      owner: routeMatch[1] || defaultOwner,
      repo: routeMatch[2] || fallbackRepo,
      number: Number(routeMatch[3]),
    };
  }

  throw new Error(`Unsupported pull request locator: ${input}`);
}

export function parseRepoLocator(input: string, defaultRepo = `${DEFAULT_OWNER}/${DEFAULT_REPO}`): RepoLocator {
  const repoParts = defaultRepo.split('/');
  const defaultOwner = repoParts[0] || DEFAULT_OWNER;
  const fallbackRepo = repoParts[1] || DEFAULT_REPO;
  const value = input.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!value) {
    return { owner: defaultOwner, repo: fallbackRepo };
  }
  const parts = value.split('/').filter(Boolean);
  return {
    owner: parts[0] || defaultOwner,
    repo: parts[1] || fallbackRepo,
  };
}

export function buildDiffCockpitUrl(locator: PullRequestLocator): string {
  return `${COCKPIT_ORIGIN}/${encodeURIComponent(locator.owner)}/${encodeURIComponent(
    locator.repo,
  )}/pull/${locator.number}`;
}

export function buildDiffCockpitPath(locator: PullRequestLocator): string {
  return `/${encodeURIComponent(locator.owner)}/${encodeURIComponent(locator.repo)}/pull/${locator.number}`;
}

export function createGithubPullRequestIndexLoader(options: GithubLoaderOptions = {}) {
  const fetcher = options.fetcher ?? fetch;

  return async (repo: RepoLocator): Promise<PullRequestIndexData> => {
    const headers = createGithubHeaders(options.token);
    const warnings: string[] = [];
    const apiBase = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`;
    const pullsJson = await fetchJsonArrayPages(
      fetcher,
      `${apiBase}/pulls?state=all&sort=updated&direction=desc`,
      headers,
      'GitHub pull requests fetch failed',
    );
    const pulls = await Promise.all(
      pullsJson.map((pullJson) => enrichPullRequestSummary(fetcher, apiBase, headers, repo, pullJson, warnings)),
    );

    return {
      repo,
      pulls,
      updatedAt: new Date().toISOString(),
      warnings,
    };
  };
}

export function createGithubPullRequestLoader(options: GithubLoaderOptions = {}) {
  const fetcher = options.fetcher ?? fetch;

  return async (locator: PullRequestLocator): Promise<PullRequestReviewData> => {
    try {
      const headers = createGithubHeaders(options.token);
      const apiBase = `https://api.github.com/repos/${encodeURIComponent(
        locator.owner,
      )}/${encodeURIComponent(locator.repo)}`;

      const pullResponse = await fetcher(`${apiBase}/pulls/${locator.number}`, { headers });
      if (!pullResponse.ok) {
        throw new Error(`GitHub pull request fetch failed: ${pullResponse.status}`);
      }

      const pullJson = await pullResponse.json();
      const pull = normalizePullRequest(pullJson);
      const filesJson = await fetchJsonArrayPages(
        fetcher,
        `${apiBase}/pulls/${locator.number}/files`,
        headers,
        'GitHub pull request files fetch failed',
      );
      const warnings: string[] = [];
      const reviewsJson = await fetchPartialJsonArrayPages(
        fetcher,
        `${apiBase}/pulls/${locator.number}/reviews`,
        headers,
        warnings,
        'reviews',
      );
      const issueCommentsJson = await fetchPartialJsonArrayPages(
        fetcher,
        `${apiBase}/issues/${locator.number}/comments`,
        headers,
        warnings,
        'issue comments',
      );
      const reviewCommentsJson = await fetchPartialJsonArrayPages(
        fetcher,
        `${apiBase}/pulls/${locator.number}/comments`,
        headers,
        warnings,
        'review comments',
      );
      const files = normalizeFiles(filesJson);
      const comments = [
        ...normalizeReviewComments(reviewsJson, 'review'),
        ...normalizeReviewComments(issueCommentsJson, 'issue-comment'),
        ...normalizeReviewComments(reviewCommentsJson, 'review-comment'),
      ];
      const checks = await loadChecks(fetcher, apiBase, pull.headSha, headers);
      const streamCommits = pull.headRef.startsWith('stream/')
        ? await loadStreamCommits(fetcher, apiBase, pull.headRef, headers)
        : [];

      return {
        locator,
        pull,
        files,
        tree: buildFileTree(files),
        comments,
        streamCommits,
        warnings,
        checks,
      };
    } catch (error: unknown) {
      throw new Error(`GitHub live pull request load failed: ${getErrorMessage(error)}`);
    }
  };
}

export function buildFileTree(files: GitHubPullRequestFile[]): FileTreeNode {
  const root: FileTreeNode = {
    type: 'root',
    name: '',
    path: '',
    children: [],
  };

  for (const file of files) {
    const parts = file.filename.split('/').filter(Boolean);
    let node = root;
    let path = '';

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index] || '';
      path = path ? `${path}/${part}` : part;
      const isFile = index === parts.length - 1;
      let child = node.children.find((candidate) => candidate.name === part);

      if (!child) {
        child = {
          type: isFile ? 'file' : 'directory',
          name: part,
          path,
          children: [],
          ...(isFile ? { file } : {}),
        };
        node.children.push(child);
      }

      if (isFile) {
        child.file = file;
      }

      node = child;
    }
  }

  sortTree(root);
  return root;
}

export function renderIndexPage(repo: RepoLocator): string {
  const apiPath = `/api/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/pulls`;
  const repoLabel = `${repo.owner}/${repo.repo}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Consuelo Diffs · ${escapeHtml(repoLabel)}</title>
  <style>${renderStyles()}</style>
</head>
<body class="index-page" data-api-path="${escapeAttribute(apiPath)}" data-active-stream="">
  <div class="shell index-shell">
    <div class="wiki-topbar" data-pagefind-ignore>
      <a class="brand" href="/">Consuelo Diffs</a>
      <nav class="nav" aria-label="Primary">
        <a href="#pull-requests">Pull Requests</a>
        <span aria-hidden="true">▣</span>
        <button class="search-button" type="button" data-search-toggle aria-controls="diff-cockpit-search" aria-expanded="false"><span class="search-mark" aria-hidden="true">⌕</span><span class="sr-only">Search</span></button>
      </nav>
    </div>
    <header class="hero" data-pagefind-ignore>
      <h1>Pull Requests</h1>
      <p class="lead">Live pull request review cockpit for ${escapeHtml(repoLabel)}.</p>
      <div class="filter-row" aria-label="Filters">
        <span class="filter-label">Filters:</span>
        <button class="active" data-filter="all">All</button>
        <button data-filter="stream">Stream</button>
        <button data-filter="task">Task</button>
        <button data-filter="failing">Failing</button>
        <button data-filter="draft">Draft</button>
        <button data-filter="open">Open</button>
      </div>
      <div class="stream-filter-row" data-stream-filter-row hidden>
        <span class="filter-label">Stream:</span>
        <button class="stream-chip active" type="button" data-clear-stream>All streams</button>
        <span data-stream-filter-label></span>
      </div>
      <label class="search-row" hidden>
        <span class="filter-label">Search:</span>
        <input id="diff-cockpit-search" class="search-input" type="search" placeholder="type to filter pull requests" autocomplete="off" spellcheck="false" />
      </label>
    </header>
    <main id="pull-requests" class="section-stack" data-sections-root data-pagefind-ignore>
      <details class="section pr-section" open data-section-id="streams"><summary><h2>Streams</h2><span class="section-count">—</span></summary><div class="post-list"><article class="post-item muted"><h3>Loading live pull requests…</h3><p>${escapeHtml(apiPath)}</p></article></div></details>
      <details class="section pr-section" open data-section-id="open"><summary><h2>Open</h2><span class="section-count">—</span></summary><div class="post-list"></div></details>
      <details class="section pr-section" data-section-id="recently-merged"><summary><h2>Merging and recently merged</h2><span class="section-count">—</span></summary><div class="post-list"></div></details>
      <details class="section pr-section" data-section-id="closed"><summary><h2>Closed</h2><span class="section-count">—</span></summary><div class="post-list"></div></details>
    </main>
    <footer data-pagefind-ignore>
      <span>© ${escapeHtml(new Date().getFullYear().toString())} Consuelo. All rights reserved.</span>
      <div class="footer-links" aria-label="Footer links"><a href="#pull-requests">Pull Requests</a></div>
    </footer>
  </div>
  <script type="module">${renderIndexClientScript(apiPath, repo)}</script>
</body>
</html>`;
}

export function renderReviewPage(locator: PullRequestLocator): string {
  const apiPath = `/api/${encodeURIComponent(locator.owner)}/${encodeURIComponent(
    locator.repo,
  )}/pull/${locator.number}`;
  const githubUrl = `https://github.com/${locator.owner}/${locator.repo}/pull/${locator.number}`;
  const graphiteUrl = `https://app.graphite.com/github/pr/${locator.owner}/${locator.repo}/${locator.number}`;
  const diffsHubUrl = `https://diffshub.com/${locator.owner}/${locator.repo}/pull/${locator.number}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Diff cockpit · ${escapeHtml(locator.owner)}/${escapeHtml(
    locator.repo,
  )}#${locator.number}</title>
  <style>${renderStyles()}</style>
</head>
<body class="review-page" data-review-drawer="closed" data-file-pane-collapsed="false" data-comments-visible="true" data-current-view="diff" data-api-path="${escapeAttribute(apiPath)}">
  <header class="topbar review-topbar">
    <div>
      <p class="eyebrow"><a href="/">Consuelo Diffs</a></p>
      <h1 id="pr-title">${escapeHtml(locator.owner)}/${escapeHtml(locator.repo)} #${
        locator.number
      }</h1>
      <p id="pr-meta" class="muted">Loading live GitHub data…</p>
    </div>
    <nav class="links" aria-label="Pull request links">
      <a href="${escapeAttribute(githubUrl)}">GitHub</a>
      <a href="${escapeAttribute(graphiteUrl)}">Graphite</a>
      <a href="${escapeAttribute(diffsHubUrl)}">DiffsHub</a>
      <button id="drawer-toggle" type="button" aria-expanded="false">Review notes</button>
    </nav>
  </header>
  <main class="layout">
    <aside class="file-pane" id="file-pane" aria-label="Changed files">
      <div class="pane-heading">
        <span>Files</span>
        <span id="file-count" class="muted">—</span>
      </div>
      <div id="tree-root" class="tree-root" data-trees-library="@pierre/trees">Loading…</div>
    </aside>
    <div id="file-pane-resizer" class="file-pane-resizer" role="separator" aria-label="Resize file pane" aria-orientation="vertical"></div>
    <section class="review-pane" aria-label="File diff">
      <div id="selected-file" class="selected-file">Select a file</div>
      <div id="diff-root" class="diff-root" data-diffs-library="@pierre/diffs"></div>
    </section>
    <aside id="review-drawer" class="review-drawer" aria-label="Review drawer" aria-hidden="true">
      <div class="drawer-head">
        <strong>review notes</strong>
        <button id="drawer-close" type="button">Close</button>
      </div>
      <div id="drawer-content" class="drawer-content">
        <div class="action-grid" aria-label="Review actions">
          <button id="copy-all-comments" class="action-button" type="button" title="Copy all review comments">□ Copy all</button>
          <button id="open-chatgpt-prompt" class="action-button" type="button">Open ChatGPT</button>
          <button id="copy-codex-prompt" class="action-button" type="button">Copy Codex</button>
        </div>
        <p class="muted">Keyboard: <span class="kbd">d</span> drawer · <span class="kbd">f</span> files · <span class="kbd">v</span> current view · <span class="kbd">i</span> inline comments · <span class="kbd">c</span> copy comments · <span class="kbd">g</span> ChatGPT · <span class="kbd">Esc</span> close</p>
        <div id="drawer-status" class="drawer-section"><h2>Status</h2><div class="comment-card muted">Loading PR status…</div></div>
        <div id="drawer-checks" class="drawer-section"><h2>Checks</h2><div class="comment-card muted">Loading checks…</div></div>
        <div id="drawer-summary" class="drawer-section"><h2>Review summary</h2><div class="comment-card muted">Loading review context…</div></div>
        <div id="drawer-comments" class="drawer-section"><h2>Comments</h2><div class="comment-card muted">No comments loaded yet.</div></div>
        <div id="drawer-commits" class="drawer-section"><h2>Recent stream commits</h2><div class="commit-card muted">No stream commits loaded yet.</div></div>
      </div>
    </aside>
  </main>
  <script type="module">${renderReviewClientScript(apiPath)}</script>
</body>
</html>`;
}

export function createWorker(options: GithubLoaderOptions = {}) {
  return {
    async fetch(request: Request, env?: DiffCockpitEnv) {
      const url = new URL(request.url);
      const token = options.token ?? env?.GITHUB_TOKEN ?? env?.GH_TOKEN;
      const defaultRepo = env?.DIFF_COCKPIT_DEFAULT_REPO ?? `${DEFAULT_OWNER}/${DEFAULT_REPO}`;
      const reviewLoader = createGithubPullRequestLoader({ fetcher: options.fetcher, token });
      const indexLoader = createGithubPullRequestIndexLoader({ fetcher: options.fetcher, token });

      if (url.pathname === '/healthz') {
        return new Response('ok', { headers: { 'content-type': 'text/plain' } });
      }

      const indexApiMatch = url.pathname.match(/^\/api\/([^/]+)\/([^/]+)\/pulls$/);
      if (indexApiMatch) {
        try {
          const repo = {
            owner: decodeURIComponent(indexApiMatch[1] || ''),
            repo: decodeURIComponent(indexApiMatch[2] || ''),
          };
          return json(await indexLoader(repo));
        } catch (error: unknown) {
          return json({ error: getErrorMessage(error) }, 502);
        }
      }

      const apiMatch = url.pathname.match(/^\/api\/([^/]+)\/([^/]+)\/pull\/(\d+)$/);
      if (apiMatch) {
        try {
          const locator = {
            owner: decodeURIComponent(apiMatch[1] || ''),
            repo: decodeURIComponent(apiMatch[2] || ''),
            number: Number(apiMatch[3]),
          };
          return cachedJson(await reviewLoader(locator), request);
        } catch (error: unknown) {
          return json({ error: getErrorMessage(error) }, 502);
        }
      }

      if (url.pathname === '/') {
        return html(renderIndexPage(parseRepoLocator('', defaultRepo)));
      }

      const repoRouteMatch = url.pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
      if (repoRouteMatch) {
        return html(renderIndexPage({
          owner: decodeURIComponent(repoRouteMatch[1] || ''),
          repo: decodeURIComponent(repoRouteMatch[2] || ''),
        }));
      }

      let locator: PullRequestLocator;
      try {
        locator = parsePullRequestLocator(url.pathname, defaultRepo);
      } catch (error: unknown) {
        return new Response(renderNotFoundPage(), {
          status: 404,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      return html(renderReviewPage(locator));
    },
  };
}

function createGithubHeaders(token?: string): HeadersInit {
  return {
    accept: 'application/vnd.github+json',
    'user-agent': 'consuelo-diff-cockpit',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchJsonArrayPages(
  fetcher: Fetcher,
  url: string,
  headers: HeadersInit,
  errorPrefix: string,
): Promise<unknown[]> {
  const items: unknown[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await fetcher(`${url}${url.includes('?') ? '&' : '?'}per_page=100&page=${page}`, { headers });
    if (!response.ok) {
      throw new Error(`${errorPrefix}: ${response.status}`);
    }
    const json = await response.json();
    const pageItems = Array.isArray(json) ? json : [];
    if (pageItems.length === 0) {
      break;
    }
    items.push(...pageItems);
  }
  return items;
}

async function fetchOptionalJsonArrayPages(
  fetcher: Fetcher,
  url: string,
  headers: HeadersInit,
): Promise<unknown[]> {
  try {
    return await fetchJsonArrayPages(fetcher, url, headers, 'GitHub optional list fetch failed');
  } catch {
    return [];
  }
}

async function fetchPartialJsonArrayPages(
  fetcher: Fetcher,
  url: string,
  headers: HeadersInit,
  warnings: string[],
  label: string,
): Promise<unknown[]> {
  try {
    return await fetchJsonArrayPages(fetcher, url, headers, `GitHub ${label} fetch failed`);
  } catch (error: unknown) {
    warnings.push(`${label}: ${getErrorMessage(error)}`);
    return [];
  }
}

function normalizePullRequest(input: unknown): GitHubPullRequest {
  const source = requireRecord(input, 'Invalid pull request data');
  const user = optionalRecord(source.user);
  const head = optionalRecord(source.head);
  const base = optionalRecord(source.base);
  return {
    number: numberValue(source.number, 0),
    title: stringValue(source.title, 'Untitled pull request'),
    htmlUrl: stringValue(source.html_url, ''),
    state: stringValue(source.state, 'unknown'),
    draft: booleanValue(source.draft),
    author: stringValue(user?.login, 'unknown'),
    headRef: stringValue(head?.ref, ''),
    headSha: stringValue(head?.sha, ''),
    baseRef: stringValue(base?.ref, ''),
    baseSha: stringValue(base?.sha, ''),
    mergeable: typeof source.mergeable === 'boolean' ? source.mergeable : null,
    mergeableState: stringValue(source.mergeable_state, 'unknown'),
    updatedAt: stringValue(source.updated_at, ''),
  };
}

async function enrichPullRequestSummary(
  fetcher: Fetcher,
  apiBase: string,
  headers: HeadersInit,
  repo: RepoLocator,
  pullJson: unknown,
  warnings: string[],
): Promise<PullRequestSummary> {
  try {
    const basePull = normalizePullRequest(pullJson);
    const detailJson = await fetchPullRequestDetail(fetcher, apiBase, headers, basePull.number, pullJson, warnings);
    const detailPull = normalizePullRequest(detailJson);
    const checkRuns = await fetchCheckRuns(fetcher, apiBase, detailPull.headSha || basePull.headSha, headers, warnings);
    const reviews = await fetchPartialJsonArrayPages(
      fetcher,
      `${apiBase}/pulls/${detailPull.number || basePull.number}/reviews`,
      headers,
      warnings,
      `reviews for #${detailPull.number || basePull.number}`,
    );
    return normalizePullRequestSummary(repo, detailJson, checkRuns, reviews);
  } catch (error: unknown) {
    warnings.push(`summary: ${getErrorMessage(error)}`);
    return normalizePullRequestSummary(repo, pullJson, [], []);
  }
}

async function fetchPullRequestDetail(
  fetcher: Fetcher,
  apiBase: string,
  headers: HeadersInit,
  number: number,
  fallback: unknown,
  warnings: string[],
): Promise<unknown> {
  try {
    const response = await fetcher(`${apiBase}/pulls/${number}`, { headers });
    if (!response.ok) {
      warnings.push(`pull #${number}: ${response.status}`);
      return fallback;
    }
    return await response.json();
  } catch (error: unknown) {
    warnings.push(`pull #${number}: ${getErrorMessage(error)}`);
    return fallback;
  }
}

async function fetchCheckRuns(
  fetcher: Fetcher,
  apiBase: string,
  sha: string,
  headers: HeadersInit,
  warnings: string[],
): Promise<unknown[]> {
  if (!sha) {
    return [];
  }
  try {
    const response = await fetcher(`${apiBase}/commits/${encodeURIComponent(sha)}/check-runs?per_page=100`, { headers });
    if (!response.ok) {
      warnings.push(`check runs for ${sha.slice(0, 7)}: ${response.status}`);
      return [];
    }
    const json = await response.json();
    const record = optionalRecord(json);
    const checkRuns = record && Array.isArray(record.check_runs) ? record.check_runs : json;
    return Array.isArray(checkRuns) ? checkRuns : [];
  } catch (error: unknown) {
    warnings.push(`check runs for ${sha.slice(0, 7)}: ${getErrorMessage(error)}`);
    return [];
  }
}

function normalizePullRequestSummary(
  repo: RepoLocator,
  input: unknown,
  checkRuns: unknown[],
  reviews: unknown[],
): PullRequestSummary {
  const pull = normalizePullRequest(input);
  const source = requireRecord(input, 'Invalid pull request summary data');
  const lifecycleStatus = normalizeLifecycleStatus(pull, source);
  const associatedStream = deriveAssociatedStream(pull);
  return {
    ...pull,
    kind: classifyPullRequest(pull),
    createdAt: stringValue(source.created_at, ''),
    updatedAt: stringValue(source.updated_at, ''),
    cockpitUrl: buildDiffCockpitPath({ owner: repo.owner, repo: repo.repo, number: pull.number }),
    additions: numberValue(source.additions, 0),
    deletions: numberValue(source.deletions, 0),
    changedFiles: numberValue(source.changed_files, 0),
    checkStatus: normalizeCheckStatus(checkRuns),
    reviewStatus: normalizeReviewStatus(reviews),
    lifecycleStatus,
    mergeStatus: lifecycleStatus,
    mergedAt: stringValue(source.merged_at, ''),
    closedAt: stringValue(source.closed_at, ''),
    associatedStream,
  };
}

export function deriveAssociatedStream(pull: Pick<GitHubPullRequest, 'headRef' | 'baseRef'>): string {
  if (pull.headRef.startsWith('stream/')) {
    return pull.headRef;
  }
  if (pull.baseRef.startsWith('stream/')) {
    return pull.baseRef;
  }
  const taskMatch = pull.headRef.match(/^task\/([^/]+)/);
  if (taskMatch && taskMatch[1]) {
    return `stream/${taskMatch[1]}`;
  }
  return '';
}

export function groupPullRequestSummaries(
  pulls: PullRequestSummary[],
  options: { stream?: string } = {},
): PullRequestSection[] {
  const scoped = options.stream ? pulls.filter((pull) => pull.associatedStream === options.stream) : pulls;
  const sections: PullRequestSection[] = [
    { id: 'streams', title: 'Streams', pulls: scoped.filter((pull) => pull.kind === 'stream') },
    {
      id: 'open',
      title: 'Open',
      pulls: scoped.filter((pull) => pull.lifecycleStatus === 'open' || pull.lifecycleStatus === 'draft'),
    },
    {
      id: 'recently-merged',
      title: 'Merging and recently merged',
      pulls: scoped.filter((pull) => pull.lifecycleStatus === 'merged'),
    },
    { id: 'closed', title: 'Closed', pulls: scoped.filter((pull) => pull.lifecycleStatus === 'closed') },
  ];
  return sections.filter((section) => section.pulls.length > 0);
}

function classifyPullRequest(pull: GitHubPullRequest): PullRequestKind {
  if (pull.draft) return 'draft';
  if (pull.headRef.startsWith('stream/')) return 'stream';
  if (pull.headRef.startsWith('task/')) return 'task';
  return 'open';
}

function normalizeLifecycleStatus(
  pull: GitHubPullRequest,
  source: Record<string, unknown>,
): PullRequestLifecycleStatus {
  if (pull.draft) return 'draft';
  if (stringValue(source.merged_at, '')) return 'merged';
  if (pull.state === 'closed') return 'closed';
  return 'open';
}

function normalizeCheckStatus(checkRuns: unknown[]): PullRequestCheckStatus {
  if (checkRuns.length === 0) {
    return 'unknown';
  }
  if (checkRuns.some((item) => isPendingCheckRun(item))) {
    return 'pending';
  }
  if (checkRuns.some((item) => isFailedCheckRun(item))) {
    return 'failure';
  }
  if (checkRuns.every((item) => isSuccessfulCheckRun(item))) {
    return 'success';
  }
  return 'unknown';
}

function isPendingCheckRun(input: unknown): boolean {
  const record = optionalRecord(input) ?? {};
  return stringValue(record.status, '').toLowerCase() !== 'completed';
}

function isFailedCheckRun(input: unknown): boolean {
  const record = optionalRecord(input) ?? {};
  const conclusion = stringValue(record.conclusion, '').toLowerCase();
  return ['failure', 'timed_out', 'cancelled', 'action_required'].includes(conclusion);
}

function isSuccessfulCheckRun(input: unknown): boolean {
  const record = optionalRecord(input) ?? {};
  const conclusion = stringValue(record.conclusion, '').toLowerCase();
  return ['success', 'skipped', 'neutral'].includes(conclusion);
}

function normalizeReviewStatus(reviews: unknown[]): PullRequestReviewStatus {
  const states = reviews
    .map((item) => optionalRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => stringValue(item.state, '').toUpperCase());
  if (states.includes('CHANGES_REQUESTED')) return 'changes_requested';
  if (states.includes('APPROVED')) return 'approved';
  if (states.includes('COMMENTED')) return 'commented';
  return states.length > 0 ? 'unknown' : 'none';
}

function normalizeFiles(input: unknown): GitHubPullRequestFile[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((item) => {
    const source = optionalRecord(item) ?? {};
    return {
      filename: stringValue(source.filename, ''),
      status: stringValue(source.status, 'modified'),
      additions: numberValue(source.additions, 0),
      deletions: numberValue(source.deletions, 0),
      changes: numberValue(source.changes, 0),
      patch: stringValue(source.patch, ''),
      blobUrl: stringValue(source.blob_url, ''),
    };
  });
}

async function loadStreamCommits(
  fetcher: Fetcher,
  apiBase: string,
  headRef: string,
  headers: HeadersInit,
): Promise<StreamCommit[]> {
  try {
    const response = await fetcher(
      `${apiBase}/commits?sha=${encodeURIComponent(headRef)}&per_page=10`,
      { headers },
    );
    if (!response.ok) {
      return [];
    }
    const json = await response.json();
    return normalizeStreamCommits(json);
  } catch {
    return [];
  }
}

async function loadChecks(
  fetcher: Fetcher,
  apiBase: string,
  headSha: string,
  headers: HeadersInit,
): Promise<CheckSummary[]> {
  if (!headSha) return [];
  try {
    const response = await fetcher(`${apiBase}/commits/${encodeURIComponent(headSha)}/check-runs?per_page=100`, { headers });
    if (!response.ok) return [];
    const json = await response.json();
    const record = optionalRecord(json);
    const checks = Array.isArray(record?.check_runs) ? record.check_runs : [];
    return checks.map((check) => {
      const item = optionalRecord(check) ?? {};
      return {
        name: stringValue(item.name, 'check'),
        status: stringValue(item.status, 'unknown'),
        conclusion: stringValue(item.conclusion, ''),
        url: stringValue(item.html_url ?? item.details_url, ''),
      };
    });
  } catch {
    return [];
  }
}

function normalizeReviewComments(
  input: unknown[],
  source: ReviewComment['source'],
): ReviewComment[] {
  return input
    .map((comment) => {
      const record = optionalRecord(comment);
      if (!record) {
        return null;
      }
      const user = optionalRecord(record.user);
      const author = stringValue(user?.login, 'unknown');
      const body = stringValue(record.body, '').trim();
      if (!body) {
        return null;
      }
      const line = numberValue(record.line ?? record.original_line, 0);
      return {
        id: stringValue(record.id, `${source}-${author}-${body}`),
        provider: detectReviewProvider(author),
        author,
        body,
        url: stringValue(record.html_url, ''),
        createdAt: stringValue(record.submitted_at ?? record.created_at, ''),
        source,
        ...(record.path ? { path: stringValue(record.path, '') } : {}),
        ...(line > 0 ? { line } : {}),
      };
    })
    .filter((comment): comment is ReviewComment => Boolean(comment));
}

function normalizeStreamCommits(input: unknown): StreamCommit[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((commit) => {
    const record = optionalRecord(commit) ?? {};
    const commitRecord = optionalRecord(record.commit);
    const authorRecord = optionalRecord(record.author);
    const commitAuthor = optionalRecord(commitRecord?.author);
    const sha = stringValue(record.sha, '');
    const message = stringValue(commitRecord?.message, '').split('\n')[0] || 'Untitled commit';
    return {
      sha,
      shortSha: sha.slice(0, 7),
      message,
      author: stringValue(authorRecord?.login ?? commitAuthor?.name, 'unknown'),
      url: stringValue(record.html_url, ''),
      committedAt: stringValue(commitAuthor?.date, ''),
    };
  });
}

function detectReviewProvider(author: string): ReviewProvider {
  const normalized = author.toLowerCase();
  if (normalized.includes('codex') || normalized.includes('chatgpt')) {
    return 'codex';
  }
  if (normalized.includes('coderabbit')) {
    return 'coderabbit';
  }
  if (normalized.includes('claude')) {
    return 'claude';
  }
  if (normalized === 'unknown') {
    return 'unknown';
  }
  return 'github';
}

const PREFERRED_PACKAGE_ORDER = [
  'workspace',
  'os',
  'consuelo-core',
  'diff-cockpit',
];

function sortTree(node: FileTreeNode): void {
  node.children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }

    if (node.path === 'packages') {
      const aIndex = PREFERRED_PACKAGE_ORDER.indexOf(a.name);
      const bIndex = PREFERRED_PACKAGE_ORDER.indexOf(b.name);

      if (aIndex !== bIndex) {
        return normalizeOrderIndex(aIndex) - normalizeOrderIndex(bIndex);
      }
    }

    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) {
    sortTree(child);
  }
}

function normalizeOrderIndex(index: number): number {
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function cachedJson(data: unknown, request: Request): Response {
  const body = JSON.stringify(data, null, 2);
  const etag = makeWeakEtag(body);
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        etag,
        'cache-control': 'private, max-age=30, stale-while-revalidate=120',
      },
    });
  }
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      etag,
      'cache-control': 'private, max-age=30, stale-while-revalidate=120',
    },
  });
}

function makeWeakEtag(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `W/\"${(hash >>> 0).toString(16)}-${input.length}\"`;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function html(markup: string): Response {
  return new Response(markup, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function renderNotFoundPage(): string {
  return '<!doctype html><title>Diff cockpit</title><body><h1>Diff cockpit</h1><p>Use /owner/repo/pull/number.</p></body>';
}

function renderStyles(): string {
  return `
:root { color-scheme: light; --paper:#f8f1e7; --surface:#fffaf3; --ink:#251d17; --muted:#6f6256; --quiet:#9b8d7f; --line:#decfbc; --soft:#efe3d2; --accent:#78533d; --accent-soft:#ead5bd; --danger:#9b2d2d; }
@media (prefers-color-scheme: dark) {
  :root { color-scheme: dark; --paper:#111820; --surface:#18212b; --ink:#e9eef4; --muted:#a9b4bf; --quiet:#7f8b96; --line:#2a3642; --soft:#1d2732; --accent:#c7d0d9; --accent-soft:#263341; --danger:#ff9d9d; }
}
* { box-sizing:border-box; }
html { scroll-behavior:smooth; background:var(--paper); }
body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:var(--paper); }
::selection { background:var(--accent-soft); color:var(--ink); }
a { color:inherit; text-decoration:none; }
a:hover, button:hover, .brand:hover, .post-item h3 a:hover, .footer-links a:hover { color:var(--accent); text-decoration-line:underline; text-decoration-style:dotted; text-decoration-thickness:1px; text-underline-offset:4px; }
button { appearance:none; border:0; background:transparent; color:var(--ink); padding:0; font:inherit; cursor:pointer; }
button:focus-visible, a:focus-visible, .search-input:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
.shell { max-width:680px; margin:0 auto; padding:0 18px 32px; }
.wiki-topbar { display:flex; align-items:center; justify-content:space-between; gap:18px; min-height:74px; border-bottom:1px solid var(--line); }
.brand { color:var(--ink); font-size:20px; font-weight:700; letter-spacing:.01em; }
.nav { display:flex; align-items:center; gap:22px; font-size:13px; }
.search-mark { font-size:26px; line-height:1; transform:translateY(-1px); }
.search-button { display:inline-flex; align-items:center; }
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
header.hero { padding:58px 0 28px; border-bottom:1px solid var(--line); }
h1 { margin:0 0 20px; font-size:44px; line-height:1; letter-spacing:-.05em; font-weight:800; }
.lead { margin:0 0 20px; color:var(--muted); font-size:14px; line-height:1.7; }
.filter-row, .pagination, .search-row { display:flex; align-items:center; gap:9px; flex-wrap:wrap; font-size:14px; }
.search-row { margin-top:18px; padding:10px 12px; border:1px solid var(--line); border-radius:10px; background:var(--surface); }
.search-row[hidden] { display:none; }
.filter-label { color:var(--muted); }
.search-input { min-width:0; flex:1 1 220px; border:0; border-bottom:1px solid var(--line); border-radius:0; padding:2px 0 5px; background:transparent; color:var(--ink); font:inherit; font-size:16px; outline:none; }
.search-input::placeholder { color:var(--quiet); }
.search-input:focus { border-bottom-color:var(--accent); }
button.active { color:var(--accent); font-weight:700; }
button.active::before { content:"["; color:var(--quiet); }
button.active::after { content:"]"; color:var(--quiet); }
.section { padding:44px 0 34px; border-bottom:1px solid var(--line); }
.section summary { list-style:none; cursor:pointer; }
.section summary::-webkit-details-marker { display:none; }
.section summary h2 { display:inline; }
h2 { margin:0 0 24px; font-size:24px; line-height:1.15; letter-spacing:-.04em; font-weight:800; }
.post-list { display:grid; gap:0; margin-top:18px; border-top:1px solid var(--line); }
.pr-section summary { display:flex; align-items:center; justify-content:space-between; gap:14px; }
.section-count { color:var(--quiet); font-size:16px; }
.post-item { display:grid; grid-template-columns:minmax(0, 1fr) auto; gap:16px; padding:13px 0; border-bottom:1px solid var(--line); }
.post-item h3 { margin:0 0 3px; font-size:17px; line-height:1.35; letter-spacing:-.02em; font-weight:500; }
.post-meta { color:var(--quiet); font-size:13px; line-height:1.35; margin-bottom:4px; }
.post-item p { margin:0; color:var(--quiet); font-size:13px; line-height:1.55; overflow-wrap:anywhere; }
.pr-row-main { min-width:0; }
.pr-row-side { display:flex; align-items:center; justify-content:flex-end; gap:10px; color:var(--quiet); font-size:13px; white-space:nowrap; }
.pr-status-icon { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border:1px solid var(--line); border-radius:999px; font-size:13px; }
.pr-status-icon.success { color:#2f8a44; }
.pr-status-icon.failure { color:#bc3b3b; }
.pr-status-icon.pending { color:#b77b1a; }
.stream-chip { color:var(--accent); text-decoration-line:underline; text-decoration-style:dotted; text-underline-offset:4px; }
.stream-filter-row { display:flex; align-items:center; gap:9px; margin-top:14px; flex-wrap:wrap; font-size:14px; }
.stream-filter-row[hidden] { display:none; }
.post-item[hidden] { display:none; }
.empty, .muted { color:var(--quiet); }
mark { background:var(--accent-soft); color:var(--ink); }
.pagination { margin-top:28px; color:var(--quiet); }
.page-status { color:var(--quiet); }
.page-button[disabled] { color:var(--quiet); cursor:default; text-decoration:none; }
footer { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:24px 0 0; color:var(--muted); font-size:13px; }
.footer-links { display:flex; gap:10px; }
.review-page { overflow:hidden; --file-pane-width:330px; }
.topbar { height:76px; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 18px; border-bottom:1px solid var(--line); background:var(--paper); }
.eyebrow { margin:0 0 4px; font-size:12px; color:var(--quiet); text-transform:uppercase; letter-spacing:.08em; }
.review-topbar h1 { margin:0; font-size:18px; line-height:1.2; letter-spacing:-.02em; }
#pr-meta { margin:4px 0 0; font-size:13px; }
.links { display:flex; align-items:center; gap:12px; white-space:nowrap; font-size:13px; }
.layout { height:calc(100vh - 76px); display:grid; grid-template-columns:var(--file-pane-width) 5px minmax(0, 1fr); position:relative; }
body[data-file-pane-collapsed="true"] .layout { grid-template-columns:0 0 minmax(0, 1fr); }
body[data-file-pane-collapsed="true"] .file-pane, body[data-file-pane-collapsed="true"] .file-pane-resizer { display:none; }
.file-pane { border-right:1px solid var(--line); overflow:auto; background:var(--paper); font-size:12px; }
.file-pane-resizer { cursor:col-resize; background:var(--line); opacity:.55; }
.file-pane-resizer:hover { opacity:1; }
.pane-heading { position:sticky; top:0; z-index:2; display:flex; justify-content:space-between; padding:14px 14px 10px; background:var(--paper); border-bottom:1px solid var(--line); font-weight:650; }
.tree-root { padding:8px; }
.tree-node { display:flex; align-items:center; gap:6px; width:100%; text-align:left; padding:5px 8px; color:var(--ink); overflow:hidden; white-space:nowrap; }
.tree-label { overflow:hidden; text-overflow:ellipsis; flex:1; }
.tree-stats { color:var(--quiet); margin-left:auto; font-variant-numeric:tabular-nums; }
.file-icon { color:var(--quiet); width:16px; text-align:center; }
.tree-node:hover, .tree-node[aria-current="true"], .tree-node.is-visible { background:var(--soft); text-decoration:none; }
.tree-node.file { cursor:pointer; }
.tree-children { margin-left:14px; }
.status { color:var(--quiet); font-size:12px; margin-right:5px; }
.review-pane { min-width:0; overflow:auto; background:var(--paper); }
.selected-file { position:sticky; top:0; z-index:1; padding:12px 16px; border-bottom:1px solid var(--line); background:var(--paper); font-size:13px; color:var(--muted); }
.diff-root { padding:0; }
.diff-file { border-bottom:1px solid var(--line); scroll-margin-top:46px; }
.diff-file-header { position:sticky; top:39px; z-index:1; display:flex; align-items:center; justify-content:space-between; gap:14px; padding:9px 14px; border-bottom:1px solid var(--line); background:var(--paper); color:var(--muted); font-size:13px; }
.diff-file-path { color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.diff-file-stats { color:var(--quiet); white-space:nowrap; }
.diff-fallback { margin:0; padding:0 0 18px; background:transparent; overflow:auto; font:13px/1.58 "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
.diff-line { min-height:20px; display:grid; grid-template-columns:68px 68px minmax(0, 1fr); padding:0 14px 0 0; white-space:pre; }
.diff-gutter { color:var(--quiet); text-align:right; padding-right:10px; user-select:none; font-variant-numeric:tabular-nums; }
.diff-code { overflow:visible; }
body[data-current-view="current"] .diff-line.del { display:none; }
body[data-comments-visible="false"] .inline-comment { display:none; }
.inline-comment { margin:6px 14px 10px 136px; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:var(--surface); font-size:13px; }
.diff-line.add { background:rgba(31, 136, 61, .18); }
.diff-line.del { background:rgba(248, 81, 73, .18); }
.diff-line.hunk { color:var(--quiet); background:var(--soft); }
.review-drawer { position:absolute; top:0; right:0; width:min(480px, 92vw); height:100%; transform:translateX(100%); transition:transform .16s ease; background:var(--surface); border-left:1px solid var(--line); box-shadow:-18px 0 45px rgba(0, 0, 0, .22); z-index:5; overflow:auto; }
body[data-review-drawer="open"] .review-drawer { transform:translateX(0); }
.drawer-head { position:sticky; top:0; z-index:2; display:flex; justify-content:space-between; align-items:center; padding:14px; border-bottom:1px solid var(--line); background:var(--surface); }
.drawer-content { padding:14px; display:grid; gap:16px; }
.action-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; }
.action-button { display:flex; justify-content:center; align-items:center; min-height:38px; border:1px solid var(--line); border-radius:10px; background:var(--paper); }
.drawer-section { border:1px solid var(--line); border-radius:12px; background:var(--paper); overflow:hidden; }
.drawer-section h2 { margin:0; padding:12px 12px 8px; font-size:13px; color:var(--ink); }
.comment-card, .commit-card { padding:10px 12px; border-top:1px solid var(--line); }
.comment-meta, .commit-meta { color:var(--quiet); font-size:12px; margin-bottom:5px; }
.comment-body { font-size:13px; line-height:1.5; }
.comment-body pre, .comment-body code { font-family:"SFMono-Regular", Menlo, Monaco, Consolas, monospace; background:var(--soft); border-radius:4px; padding:1px 4px; }
.comment-jump { display:inline-flex; margin-left:6px; color:var(--accent); }
.badge { display:inline-flex; align-items:center; border:1px solid var(--line); border-radius:999px; padding:2px 7px; font-size:11px; color:var(--muted); background:var(--surface); }
.kbd { font:11px/1.2 "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; border:1px solid var(--line); border-radius:5px; padding:2px 5px; background:var(--soft); color:var(--ink); }
.error { border:1px solid var(--danger); color:var(--danger); background:var(--surface); padding:14px; border-radius:10px; }
@media (max-width: 760px) {
  .wiki-topbar { align-items:flex-start; flex-direction:column; padding:20px 0; }
  .nav { gap:14px; flex-wrap:wrap; }
  header.hero { padding-top:44px; }
  h1 { font-size:38px; }
  footer { flex-direction:column; align-items:flex-start; }
  .post-item { grid-template-columns:1fr; gap:8px; }
  .pr-row-side { justify-content:flex-start; flex-wrap:wrap; }
  .topbar { height:auto; min-height:92px; align-items:flex-start; flex-direction:column; }
  .layout { height:calc(100vh - 132px); grid-template-columns:minmax(160px, 40vw) minmax(0, 1fr); }
}
`;
}

function renderIndexClientScript(apiPath: string, repo: RepoLocator): string {
  const routePrefix = `/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/pull/`;
  const repoLabel = `${repo.owner}/${repo.repo}`;
  return `
const apiPath = ${JSON.stringify(apiPath)};
const routePrefix = ${JSON.stringify(routePrefix)};
const repoLabel = ${JSON.stringify(repoLabel)};
let pulls = [];
let activeFilter = 'all';
let activeQuery = '';
let activeStream = '';
const sectionsRoot = document.querySelector('[data-sections-root]');
const searchToggle = document.querySelector('[data-search-toggle]');
const searchRow = document.querySelector('.search-row');
const searchInput = document.querySelector('#diff-cockpit-search');
const streamRow = document.querySelector('[data-stream-filter-row]');
const streamLabel = document.querySelector('[data-stream-filter-label]');
const clearStream = document.querySelector('[data-clear-stream]');
const escapeText = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const openPull = (route) => { window.location.href = route; };
const kindMatchesFilter = (pull) => activeFilter === 'all' || pull.kind === activeFilter || (activeFilter === 'failing' && pull.checkStatus === 'failure') || (activeFilter === 'open' && pull.lifecycleStatus === 'open') || (activeFilter === 'draft' && pull.lifecycleStatus === 'draft');
const queryMatchesPull = (pull) => {
  const query = activeQuery.trim().toLowerCase();
  if (!query) return true;
  return [pull.title, pull.headRef, pull.baseRef, pull.author, String(pull.number), pull.kind, pull.associatedStream].some((value) => String(value || '').toLowerCase().includes(query));
};
function visiblePulls() {
  return pulls.filter((pull) => kindMatchesFilter(pull) && queryMatchesPull(pull) && (!activeStream || pull.associatedStream === activeStream));
}
function groupSections(source) {
  const sections = [
    { id: 'streams', title: 'Streams', pulls: source.filter((pull) => pull.kind === 'stream') },
    { id: 'open', title: 'Open', pulls: source.filter((pull) => pull.lifecycleStatus === 'open' || pull.lifecycleStatus === 'draft') },
    { id: 'recently-merged', title: 'Merging and recently merged', pulls: source.filter((pull) => pull.lifecycleStatus === 'merged') },
    { id: 'closed', title: 'Closed', pulls: source.filter((pull) => pull.lifecycleStatus === 'closed') },
  ];
  return sections.filter((section) => section.pulls.length > 0);
}
function renderCard(pull) {
  const route = routePrefix + pull.number;
  const stream = pull.associatedStream || 'No stream';
  return '<article class="post-item pr-row" data-kind="' + escapeText(pull.kind) + '" data-state="' + escapeText(pull.lifecycleStatus) + '">' +
    '<div class="pr-row-main"><h3><a href="' + escapeText(route) + '" data-pr-route="' + escapeText(route) + '">' + escapeText(pull.title) + '</a></h3>' +
    '<div class="post-meta">' + escapeText(pull.author) + ' · ' + escapeText(repoLabel) + ' #' + escapeText(pull.number) + '</div>' +
    '<p><button class="stream-chip" type="button" data-stream-filter="' + escapeText(stream) + '">' + escapeText(stream) + '</button> · ' + escapeText(pull.headRef) + ' → ' + escapeText(pull.baseRef) + '</p></div>' +
    '<div class="pr-row-side"><span class="pr-status-icon ' + escapeText(pull.reviewStatus) + '" title="review: ' + escapeText(pull.reviewStatus) + '">' + reviewIcon(pull.reviewStatus) + '</span><span class="pr-status-icon ' + escapeText(pull.checkStatus) + '" title="checks: ' + escapeText(pull.checkStatus) + '">' + checkIcon(pull.checkStatus) + '</span><span>' + formatDelta(pull) + '</span><span>' + relativeTime(pull.updatedAt) + '</span></div>' +
  '</article>';
}
function renderSections() {
  const visible = visiblePulls();
  const sections = groupSections(visible);
  document.body.dataset.activeStream = activeStream;
  streamRow.hidden = !activeStream;
  streamLabel.textContent = activeStream || '';
  sectionsRoot.innerHTML = sections.length ? sections.map((section, index) => '<details class="section pr-section" data-section-id="' + section.id + '" ' + (index < 2 ? 'open' : '') + '><summary><h2>' + escapeText(section.title) + '</h2><span class="section-count">' + section.pulls.length + '</span></summary><div class="post-list">' + section.pulls.map(renderCard).join('') + '</div></details>').join('') : '<section class="section"><h2>No matching pull requests</h2><p class="muted">Try another filter, search, or stream.</p></section>';
  document.querySelectorAll('[data-pr-route]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      openPull(link.getAttribute('data-pr-route'));
    });
  });
  document.querySelectorAll('[data-stream-filter]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      activeStream = button.getAttribute('data-stream-filter') || '';
      renderSections();
    });
  });
}
function reviewIcon(status) {
  if (status === 'approved') return '✓';
  if (status === 'changes_requested') return '×';
  if (status === 'commented') return '◌';
  return '–';
}
function checkIcon(status) {
  if (status === 'success') return '✓';
  if (status === 'failure') return '×';
  if (status === 'pending') return '◌';
  return '–';
}
function formatDelta(pull) {
  return '+' + Number(pull.additions || 0).toLocaleString() + ' −' + Number(pull.deletions || 0).toLocaleString() + ' · ' + Number(pull.changedFiles || 0).toLocaleString() + ' files';
}
function relativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'live';
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return seconds + 's';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + 'm';
  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours + 'h';
  return Math.round(hours / 24) + 'd';
}
function loadIndex() {
  fetch(apiPath, { headers: { accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error('Live PR index fetch failed: ' + response.status);
      return response.json();
    })
    .then((data) => {
      pulls = Array.isArray(data.pulls) ? data.pulls : [];
      renderSections();
    }, (error) => {
      sectionsRoot.innerHTML = '<section class="section error"><h2>Could not load pull requests</h2><p>' + escapeText(error.message || error) + '</p></section>';
    });
}
document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
    renderSections();
  });
});
clearStream.addEventListener('click', () => {
  activeStream = '';
  renderSections();
});
searchToggle.addEventListener('click', () => {
  const shouldOpen = searchRow.hidden;
  searchRow.hidden = !shouldOpen;
  searchToggle.setAttribute('aria-expanded', String(shouldOpen));
  if (shouldOpen) searchInput.focus();
  else {
    searchInput.value = '';
    activeQuery = '';
    renderSections();
  }
});
searchInput.addEventListener('input', () => {
  activeQuery = searchInput.value;
  window.clearTimeout(searchInput.dataset.timer);
  searchInput.dataset.timer = String(window.setTimeout(renderSections, 120));
});
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    searchInput.value = '';
    activeQuery = '';
    searchRow.hidden = true;
    searchToggle.setAttribute('aria-expanded', 'false');
    renderSections();
  }
});
loadIndex();
`;
}

function renderReviewClientScript(apiPath: string): string {
  return `
const apiPath = ${JSON.stringify(apiPath)};
const state = { data: null, selected: null, diffModule: null, treeModule: null, activeFile: null, inlineCommentsVisible: true, currentView: false, observer: null };
const els = {
  title: document.getElementById('pr-title'),
  meta: document.getElementById('pr-meta'),
  count: document.getElementById('file-count'),
  tree: document.getElementById('tree-root'),
  selected: document.getElementById('selected-file'),
  diff: document.getElementById('diff-root'),
  drawerToggle: document.getElementById('drawer-toggle'),
  drawerClose: document.getElementById('drawer-close'),
  copyAll: document.getElementById('copy-all-comments'),
  openChatGpt: document.getElementById('open-chatgpt-prompt'),
  copyCodex: document.getElementById('copy-codex-prompt'),
  drawerSummary: document.getElementById('drawer-summary'),
  drawerStatus: document.getElementById('drawer-status'),
  drawerChecks: document.getElementById('drawer-checks'),
  drawerComments: document.getElementById('drawer-comments'),
  drawerCommits: document.getElementById('drawer-commits'),
  drawerContent: document.getElementById('drawer-content'),
  filePane: document.getElementById('file-pane'),
  filePaneResizer: document.getElementById('file-pane-resizer'),
};

els.drawerToggle.addEventListener('click', () => {
  if (document.body.dataset.reviewDrawer === 'open') {
    els.drawerContent.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  setDrawer(true);
});
els.drawerClose.addEventListener('click', () => setDrawer(false));
els.copyAll.addEventListener('click', () => copyText(buildCommentsMarkdown()));
els.openChatGpt.addEventListener('click', () => openChatGptPrompt());
els.copyCodex.addEventListener('click', () => copyText(buildCodexPrompt()));
document.addEventListener('keydown', (event) => {
  if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  if (event.key === 'd') setDrawer(document.body.dataset.reviewDrawer !== 'open');
  if (event.key === 'f') toggleFilePane();
  if (event.key === 'v') toggleCurrentView();
  if (event.key === 'i') toggleInlineComments();
  if (event.key === 'c') copyText(buildCommentsMarkdown());
  if (event.key === 'g') openChatGptPrompt();
  if (event.key === 'Escape') setDrawer(false);
});

loadLiveData();
loadViewerLibraries();
setupFilePaneResize();

function loadViewerLibraries() {
  Promise.allSettled([
    import('https://esm.sh/@pierre/diffs').then((module) => { state.diffModule = module; }),
    import('https://esm.sh/@pierre/trees@1.0.0-beta.3').then((module) => { state.treeModule = module; }),
  ]).then(() => {
    // Viewer libraries are optional progressive enhancement; the built-in long diff renders first.
  });
}
function setDrawer(open) {
  document.body.dataset.reviewDrawer = open ? 'open' : 'closed';
  els.drawerToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.getElementById('review-drawer').setAttribute('aria-hidden', open ? 'false' : 'true');
}

function loadLiveData() {
  fetch(apiPath, { headers: { accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error('Live PR fetch failed: ' + response.status);
      return response.json();
    })
    .then(
      (data) => {
        state.data = data;
        state.selected = state.data.files[0] || null;
        renderHeader();
        renderTree();
        renderSelectedFile();
        renderLongDiffs();
        setupActiveFileObserver();
        renderDrawer();
      },
      (error) => {
        els.tree.textContent = error.message || String(error);
      },
    );
}

function renderHeader() {
  const pull = state.data.pull;
  const commentCount = state.data.comments ? state.data.comments.length : 0;
  els.title.textContent = pull.title;
  els.meta.textContent = '#' + pull.number + ' · ' + pull.state + (pull.draft ? ' · draft' : '') + ' · ' + pull.headRef + ' → ' + pull.baseRef + ' · by ' + pull.author + ' · ' + commentCount + ' review comments';
  els.count.textContent = String(state.data.files.length);
}

function renderTree() {
  els.tree.innerHTML = renderTreeNode(state.data.tree);
  for (const button of els.tree.querySelectorAll('[data-file]')) {
    button.addEventListener('click', () => {
      state.selected = state.data.files.find((file) => file.filename === button.dataset.file);
      renderTree();
      renderSelectedFile();
      scrollToFile(state.selected);
    });
  }
}

function renderTreeNode(node) {
  if (node.type === 'root') return node.children.map(renderTreeNode).join('');
  if (node.type === 'file') {
    const current = state.selected && state.selected.filename === node.file.filename;
    const visible = state.activeFile === node.file.filename;
    return '<button class="tree-node file ' + (visible ? 'is-visible' : '') + '" type="button" data-file="' + escapeAttribute(node.file.filename) + '" aria-current="' + (current ? 'true' : 'false') + '"><span class="file-icon">' + escapeHtml(fileIcon(node.file.filename)) + '</span><span class="status">' + escapeHtml(statusToken(node.file.status)) + '</span><span class="tree-label">' + escapeHtml(node.name) + '</span><span class="tree-stats">+' + escapeHtml(node.file.additions) + ' −' + escapeHtml(node.file.deletions) + '</span>' + fileCommentBadge(node.file.filename) + '</button>';
  }
  return '<div class="tree-node directory">' + escapeHtml(node.name) + '</div><div class="tree-children">' + node.children.map(renderTreeNode).join('') + '</div>';
}

function fileCommentBadge(filename) {
  const count = (state.data.comments || []).filter((comment) => comment.path === filename).length;
  return count ? ' <span class="badge">' + count + '</span>' : '';
}

function renderSelectedFile() {
  if (!state.selected) {
    els.selected.textContent = 'No changed files';
    return;
  }
  els.selected.textContent = 'All changed files · ' + state.data.files.length + ' files · selected ' + state.selected.filename + ' · +' + state.selected.additions + ' −' + state.selected.deletions;
}

function renderLongDiffs() {
  if (!state.data || !Array.isArray(state.data.files) || state.data.files.length === 0) {
    els.diff.innerHTML = '<div class="error">No changed files found.</div>';
    return;
  }
  els.diff.innerHTML = state.data.files.map(renderDiffFile).join('');
}

function renderDiffFile(file) {
  return '<section class="diff-file" id="' + escapeAttribute(fileDomId(file.filename)) + '">' +
    '<div class="diff-file-header"><span class="diff-file-path">' + escapeHtml(file.filename) + '</span><span class="diff-file-stats">' + escapeHtml(statusToken(file.status)) + ' +' + escapeHtml(file.additions) + ' −' + escapeHtml(file.deletions) + '</span></div>' +
    renderPatchFallback(file.patch || 'No patch available', file.filename) +
  '</section>';
}

function scrollToFile(file) {
  if (!file) return;
  const target = document.getElementById(fileDomId(file.filename));
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fileDomId(filename) {
  return 'file-' + String(filename || '').replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function renderDrawer() {
  const comments = state.data.comments || [];
  const commits = state.data.streamCommits || [];
  const checks = state.data.checks || [];
  const pull = state.data.pull;
  els.drawerStatus.innerHTML = '<h2>Status</h2><div class="comment-card"><span class="badge">' + escapeHtml(pull.state) + '</span> <span class="badge">mergeability: ' + escapeHtml(pull.mergeableState || 'unknown') + '</span> <span class="badge">open: ' + escapeHtml(String(pull.state === 'open')) + '</span></div>';
  els.drawerChecks.innerHTML = '<h2>Checks</h2>' + (checks.length ? checks.map(renderCheck).join('') : '<div class="comment-card muted">No checks found.</div>');
  els.drawerSummary.innerHTML = '<h2>Review summary</h2><div class="comment-card"><span class="badge">' + comments.length + ' comments</span> <span class="badge">' + commits.length + ' stream commits</span></div>';
  els.drawerComments.innerHTML = '<h2>Comments</h2>' + (comments.length ? comments.map(renderComment).join('') : '<div class="comment-card muted">No review comments found.</div>');
  els.drawerCommits.innerHTML = '<h2>Recent stream commits</h2>' + (commits.length ? commits.map(renderCommit).join('') : '<div class="commit-card muted">No stream commits found for this head branch.</div>');
}

function renderComment(comment) {
  const location = comment.path ? ' · ' + comment.path + (comment.line ? ':' + comment.line : '') : '';
  const link = comment.url ? ' · <a href="' + escapeAttribute(comment.url) + '">open</a>' : '';
  const jump = comment.path ? ' <button class="comment-jump" type="button" data-comment-file="' + escapeAttribute(comment.path) + '" data-comment-line="' + escapeAttribute(String(comment.line || '')) + '">jump</button>' : '';
  return '<article class="comment-card"><div class="comment-meta"><span class="badge">' + escapeHtml(comment.provider) + '</span> ' + escapeHtml(comment.author) + location + link + jump + '</div><div class="comment-body">' + renderMarkdown(comment.body) + '</div></article>';
}

function renderCommit(commit) {
  const link = commit.url ? '<a href="' + escapeAttribute(commit.url) + '">' + escapeHtml(commit.shortSha) + '</a>' : escapeHtml(commit.shortSha);
  return '<article class="commit-card"><div class="commit-meta">' + link + ' · ' + escapeHtml(commit.author) + '</div><div>' + escapeHtml(commit.message) + '</div></article>';
}

function buildCommentsMarkdown() {
  if (!state.data) return 'No PR data loaded yet.';
  const pull = state.data.pull;
  const comments = state.data.comments || [];
  const lines = ['# Review comments for PR #' + pull.number, '', pull.title, '', '## Comments'];
  if (!comments.length) lines.push('No review comments found.');
  for (const comment of comments) {
    lines.push('', '### ' + comment.provider + ' · ' + comment.author);
    if (comment.path) lines.push('- Location: ' + comment.path + (comment.line ? ':' + comment.line : ''));
    if (comment.url) lines.push('- URL: ' + comment.url);
    lines.push('', comment.body);
  }
  return lines.join('\\n');
}

function buildChatGptPrompt() {
  if (!state.data) return 'Review this PR once data loads.';
  const pull = state.data.pull;
  return [
    'Please help me address the review feedback for this PR.',
    '',
    'PR: #' + pull.number + ' ' + pull.title,
    'Branch: ' + pull.headRef + ' → ' + pull.baseRef,
    'URL: ' + pull.htmlUrl,
    '',
    buildCommentsMarkdown(),
  ].join('\\n');
}

function buildCodexPrompt() {
  return '@codex please address the actionable review feedback in this PR.\\n\\n' + buildCommentsMarkdown();
}

function openChatGptPrompt() {
  copyText(buildChatGptPrompt()).finally(() => {
    window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer');
  });
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
  return Promise.resolve();
}

function renderPatchFallback(patch, filename) {
  let oldLine = 0;
  let newLine = 0;
  const comments = commentsForFile(filename);
  const rows = [];
  for (const line of String(patch || '').split('\\n')) {
    if (line.startsWith('@@')) {
      const hunk = parseHunkHeader(line);
      oldLine = hunk.oldStart;
      newLine = hunk.newStart;
      rows.push(renderDiffLine(line, 'hunk', '', ''));
      continue;
    }
    if (line.startsWith('+')) {
      rows.push(renderDiffLine(line, 'add', '', String(newLine)) + renderInlineComments(filename, newLine, comments));
      newLine += 1;
      continue;
    }
    if (line.startsWith('-')) {
      rows.push(renderDiffLine(line, 'del', String(oldLine), ''));
      oldLine += 1;
      continue;
    }
    rows.push(renderDiffLine(line || ' ', '', String(oldLine), String(newLine)) + renderInlineComments(filename, newLine, comments));
    oldLine += 1;
    newLine += 1;
  }
  return '<div class="diff-fallback">' + rows.join('') + '</div>';
}

function parseHunkHeader(line) {
  const match = String(line).match(/@@ -(\\d+)(?:,\\d+)? \\+(\\d+)(?:,\\d+)? @@/);
  return { oldStart: match ? Number(match[1]) : 0, newStart: match ? Number(match[2]) : 0 };
}

function renderDiffLine(line, className, oldLine, newLine) {
  return '<div class="diff-line ' + className + '" data-old-line="' + escapeAttribute(String(oldLine)) + '" data-new-line="' + escapeAttribute(String(newLine)) + '"><span class="diff-gutter oldLine">' + escapeHtml(String(oldLine || '')) + '</span><span class="diff-gutter newLine">' + escapeHtml(String(newLine || '')) + '</span><span class="diff-code">' + escapeHtml(line || ' ') + '</span></div>';
}

function commentsForFile(filename) {
  return (state.data?.comments || []).filter((comment) => comment.path === filename);
}

function renderInlineComments(filename, line, comments) {
  const matching = comments.filter((comment) => comment.line === line);
  return matching.map((comment) => '<aside class="inline-comment" data-comment-file="' + escapeAttribute(filename) + '" data-comment-line="' + escapeAttribute(String(line)) + '"><div class="comment-meta"><span class="badge">' + escapeHtml(comment.provider) + '</span> ' + escapeHtml(comment.author) + '</div><div class="comment-body">' + renderMarkdown(comment.body) + '</div></aside>').join('');
}

function renderCheck(check) {
  const conclusion = check.conclusion || check.status || 'unknown';
  const link = check.url ? ' · <a href="' + escapeAttribute(check.url) + '">open</a>' : '';
  return '<div class="comment-card"><span class="badge">' + escapeHtml(conclusion) + '</span> ' + escapeHtml(check.name) + link + '</div>';
}

function renderMarkdown(markdown) {
  return escapeHtml(String(markdown || ''))
    .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
    .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
    .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\[([^\\]]+)\\]\\((https?:[^)]+)\\)/g, '<a href="$2">$1</a>')
    .replace(/\\n/g, '<br>');
}

function navigateToComment(file, line) {
  const target = document.getElementById(fileDomId(file));
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const comment = document.querySelector('[data-comment-file="' + CSS.escape(file) + '"][data-comment-line="' + CSS.escape(String(line || '')) + '"]');
  if (comment) comment.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function setupCommentJumps() {
  document.querySelectorAll('[data-comment-file]').forEach((button) => {
    button.addEventListener('click', () => navigateToComment(button.dataset.commentFile, button.dataset.commentLine));
  });
}

function setupActiveFileObserver() {
  if (state.observer) state.observer.disconnect();
  state.observer = new IntersectionObserver((entries) => updateActiveFileFromScroll(entries), { root: els.diff.closest('.review-pane'), threshold: 0.2 });
  document.querySelectorAll('.diff-file').forEach((section) => state.observer.observe(section));
  setupCommentJumps();
}

function updateActiveFileFromScroll(entries) {
  const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  const matched = (state.data.files || []).find((item) => fileDomId(item.filename) === visible.target.id);
  if (!matched) return;
  state.activeFile = matched.filename;
  renderTree();
  const button = els.tree.querySelector('[data-file="' + CSS.escape(matched.filename) + '"]');
  if (button) button.scrollIntoView({ block: 'nearest' });
}

function toggleFilePane() {
  document.body.dataset.filePaneCollapsed = document.body.dataset.filePaneCollapsed === 'true' ? 'false' : 'true';
}

function toggleCurrentView() {
  state.currentView = !state.currentView;
  document.body.dataset.currentView = state.currentView ? 'current' : 'diff';
}

function toggleInlineComments() {
  state.inlineCommentsVisible = !state.inlineCommentsVisible;
  document.body.dataset.commentsVisible = state.inlineCommentsVisible ? 'true' : 'false';
}

function setupFilePaneResize() {
  let dragging = false;
  els.filePaneResizer.addEventListener('pointerdown', (event) => { dragging = true; els.filePaneResizer.setPointerCapture(event.pointerId); });
  els.filePaneResizer.addEventListener('pointermove', (event) => { if (!dragging) return; document.body.style.setProperty('--file-pane-width', Math.max(220, Math.min(560, event.clientX)) + 'px'); });
  els.filePaneResizer.addEventListener('pointerup', () => { dragging = false; });
}

function fileIcon(filename) {
  const extension = String(filename || '').split('.').pop();
  if (extension === 'ts' || extension === 'tsx') return 'TS';
  if (extension === 'js' || extension === 'jsx') return 'JS';
  if (extension === 'json') return '{}';
  if (extension === 'md') return 'M';
  if (extension === 'toml' || extension === 'yml' || extension === 'yaml') return '⚙';
  return '•';
}

function statusToken(status) {
  if (status === 'added') return 'A';
  if (status === 'removed') return 'D';
  if (status === 'renamed') return 'R';
  return 'M';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
`;
}

function requireRecord(input: unknown, message: string): Record<string, unknown> {
  const record = optionalRecord(input);
  if (!record) {
    throw new Error(message);
  }
  return record;
}

function optionalRecord(input: unknown): Record<string, unknown> | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

function stringValue(input: unknown, fallback: string): string {
  return input === undefined || input === null ? fallback : String(input);
}

function numberValue(input: unknown, fallback: number): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : fallback;
}

function booleanValue(input: unknown): boolean {
  return Boolean(input);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] || char;
  });
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function escapeJs(value: string): string {
  return value.replace(/[\\'\n\r]/g, (char) => {
    const entities: Record<string, string> = {
      '\\': '\\\\',
      "'": "\\'",
      '\n': '\\n',
      '\r': '\\r',
    };
    return entities[char] || char;
  });
}
