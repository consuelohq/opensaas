export type PullRequestLocator = {
  owner: string;
  repo: string;
  number: number;
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

export type PullRequestReviewData = {
  locator: PullRequestLocator;
  pull: GitHubPullRequest;
  files: GitHubPullRequestFile[];
  tree: FileTreeNode;
  comments: ReviewComment[];
  streamCommits: StreamCommit[];
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

const DEFAULT_OWNER = 'consuelohq';
const DEFAULT_REPO = 'opensaas';
const COCKPIT_ORIGIN = 'https://diffs.consuelohq.com';

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

export function buildDiffCockpitUrl(locator: PullRequestLocator): string {
  return `${COCKPIT_ORIGIN}/${encodeURIComponent(locator.owner)}/${encodeURIComponent(
    locator.repo,
  )}/pull/${locator.number}`;
}

export function createGithubPullRequestLoader(options: GithubLoaderOptions = {}) {
  const fetcher = options.fetcher ?? fetch;

  return async (locator: PullRequestLocator): Promise<PullRequestReviewData> => {
    try {
      const headers = createGithubHeaders(options.token);
      const apiBase = `https://api.github.com/repos/${encodeURIComponent(
        locator.owner,
      )}/${encodeURIComponent(locator.repo)}`;

      const [
        pullResponse,
        filesResponse,
        reviewsResponse,
        issueCommentsResponse,
        reviewCommentsResponse,
      ] = await Promise.all([
        fetcher(`${apiBase}/pulls/${locator.number}`, { headers }),
        fetcher(`${apiBase}/pulls/${locator.number}/files?per_page=100`, { headers }),
        fetcher(`${apiBase}/pulls/${locator.number}/reviews?per_page=100`, { headers }),
        fetcher(`${apiBase}/issues/${locator.number}/comments?per_page=100`, { headers }),
        fetcher(`${apiBase}/pulls/${locator.number}/comments?per_page=100`, { headers }),
      ]);

      if (!pullResponse.ok) {
        throw new Error(`GitHub pull request fetch failed: ${pullResponse.status}`);
      }
      if (!filesResponse.ok) {
        throw new Error(`GitHub pull request files fetch failed: ${filesResponse.status}`);
      }

      const pullJson = await pullResponse.json();
      const filesJson = await filesResponse.json();
      const pull = normalizePullRequest(pullJson);
      const files = normalizeFiles(filesJson);
      const comments = [
        ...normalizeReviewComments(await optionalJsonArray(reviewsResponse), 'review'),
        ...normalizeReviewComments(await optionalJsonArray(issueCommentsResponse), 'issue-comment'),
        ...normalizeReviewComments(await optionalJsonArray(reviewCommentsResponse), 'review-comment'),
      ];
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
<body data-review-drawer="closed" data-api-path="${escapeAttribute(apiPath)}">
  <header class="topbar">
    <div>
      <p class="eyebrow">Diff cockpit</p>
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
    <aside class="file-pane" aria-label="Changed files">
      <div class="pane-heading">
        <span>Files</span>
        <span id="file-count" class="muted">—</span>
      </div>
      <div id="tree-root" class="tree-root" data-trees-library="@pierre/trees">Loading…</div>
    </aside>
    <section class="review-pane" aria-label="File diff">
      <div id="selected-file" class="selected-file">Select a file</div>
      <div id="diff-root" class="diff-root" data-diffs-library="@pierre/diffs"></div>
    </section>
    <aside id="review-drawer" class="review-drawer" aria-label="Review drawer" aria-hidden="true">
      <div class="drawer-head">
        <strong>Review notes</strong>
        <button id="drawer-close" type="button">Close</button>
      </div>
      <div id="drawer-content" class="drawer-content">
        <div class="action-grid" aria-label="Review actions">
          <button id="copy-all-comments" class="action-button" type="button" title="Copy all review comments">□ Copy all</button>
          <button id="open-chatgpt-prompt" class="action-button" type="button">Open ChatGPT</button>
          <button id="copy-codex-prompt" class="action-button" type="button">Copy Codex</button>
        </div>
        <p class="muted">Keyboard: <span class="kbd">r</span> drawer · <span class="kbd">c</span> copy comments · <span class="kbd">g</span> ChatGPT · <span class="kbd">Esc</span> close</p>
        <div id="drawer-summary" class="drawer-section"><h2>Review summary</h2><div class="comment-card muted">Loading review context…</div></div>
        <div id="drawer-comments" class="drawer-section"><h2>Comments</h2><div class="comment-card muted">No comments loaded yet.</div></div>
        <div id="drawer-commits" class="drawer-section"><h2>Recent stream commits</h2><div class="commit-card muted">No stream commits loaded yet.</div></div>
      </div>
    </aside>
  </main>
  <script type="module">${renderClientScript(apiPath)}</script>
</body>
</html>`;
}

export function createWorker(options: GithubLoaderOptions = {}) {
  const loader = createGithubPullRequestLoader(options);

  return {
    async fetch(request: Request, env?: { GITHUB_TOKEN?: string; GH_TOKEN?: string }) {
      const url = new URL(request.url);
      const token = options.token ?? env?.GITHUB_TOKEN ?? env?.GH_TOKEN;
      const liveLoader = token === options.token ? loader : createGithubPullRequestLoader({ token });

      if (url.pathname === '/healthz') {
        return new Response('ok', { headers: { 'content-type': 'text/plain' } });
      }

      const apiMatch = url.pathname.match(/^\/api\/([^/]+)\/([^/]+)\/pull\/(\d+)$/);
      if (apiMatch) {
        try {
          const locator = {
            owner: decodeURIComponent(apiMatch[1] || ''),
            repo: decodeURIComponent(apiMatch[2] || ''),
            number: Number(apiMatch[3]),
          };
          const data = await liveLoader(locator);
          return json(data);
        } catch (error: unknown) {
          return json({ error: getErrorMessage(error) }, 502);
        }
      }

      try {
        const locator = parsePullRequestLocator(url.pathname);
        return new Response(renderReviewPage(locator), {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      } catch {
        return new Response(renderNotFoundPage(), {
          status: 404,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
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

function normalizePullRequest(input: unknown): GitHubPullRequest {
  const source = input as Record<string, any>;
  return {
    number: Number(source.number ?? 0),
    title: String(source.title ?? 'Untitled pull request'),
    htmlUrl: String(source.html_url ?? ''),
    state: String(source.state ?? 'unknown'),
    draft: Boolean(source.draft),
    author: String(source.user?.login ?? 'unknown'),
    headRef: String(source.head?.ref ?? ''),
    headSha: String(source.head?.sha ?? ''),
    baseRef: String(source.base?.ref ?? ''),
    baseSha: String(source.base?.sha ?? ''),
  };
}

function normalizeFiles(input: unknown): GitHubPullRequestFile[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((source) => ({
    filename: String(source.filename ?? ''),
    status: String(source.status ?? 'modified'),
    additions: Number(source.additions ?? 0),
    deletions: Number(source.deletions ?? 0),
    changes: Number(source.changes ?? 0),
    patch: String(source.patch ?? ''),
    blobUrl: String(source.blob_url ?? ''),
  }));
}

async function optionalJsonArray(response: Response): Promise<unknown[]> {
  try {
    if (!response.ok) {
      return [];
    }
    const json = await response.json();
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
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

function normalizeReviewComments(
  input: unknown[],
  source: ReviewComment['source'],
): ReviewComment[] {
  return input
    .map((comment) => {
      const record = comment as Record<string, any>;
      const author = String(record.user?.login ?? 'unknown');
      const body = String(record.body ?? '').trim();
      if (!body) {
        return null;
      }
      const line = Number(record.line ?? record.original_line ?? 0);
      return {
        id: String(record.id ?? `${source}-${author}-${body}`),
        provider: detectReviewProvider(author),
        author,
        body,
        url: String(record.html_url ?? ''),
        createdAt: String(record.submitted_at ?? record.created_at ?? ''),
        source,
        ...(record.path ? { path: String(record.path) } : {}),
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
    const record = commit as Record<string, any>;
    const sha = String(record.sha ?? '');
    const message = String(record.commit?.message ?? '').split('\\n')[0] || 'Untitled commit';
    return {
      sha,
      shortSha: sha.slice(0, 7),
      message,
      author: String(record.author?.login ?? record.commit?.author?.name ?? 'unknown'),
      url: String(record.html_url ?? ''),
      committedAt: String(record.commit?.author?.date ?? ''),
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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
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
:root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f0f11; color: #eceef2; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; overflow: hidden; background: #0f0f11; }
a, button { color: inherit; }
button, a { border: 1px solid #30323a; background: #17181d; border-radius: 8px; padding: 8px 10px; text-decoration: none; font: inherit; }
button:hover, a:hover { background: #20222a; }
.topbar { height: 76px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 18px; border-bottom: 1px solid #262832; background: #131419; }
.eyebrow { margin: 0 0 4px; font-size: 12px; color: #8b90a1; text-transform: uppercase; letter-spacing: .08em; }
h1 { margin: 0; font-size: 18px; line-height: 1.2; font-weight: 650; }
.muted { color: #9aa0ad; }
#pr-meta { margin: 4px 0 0; font-size: 13px; }
.links { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.layout { height: calc(100vh - 76px); display: grid; grid-template-columns: minmax(260px, 330px) minmax(0, 1fr); position: relative; }
.file-pane { border-right: 1px solid #262832; overflow: auto; background: #111217; }
.pane-heading { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; padding: 14px 14px 10px; background: #111217; border-bottom: 1px solid #20222a; font-weight: 650; }
.tree-root { padding: 8px; }
.tree-node { display: block; width: 100%; text-align: left; border: 0; background: transparent; padding: 5px 8px; border-radius: 6px; color: #d9dce5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-node:hover, .tree-node[aria-current="true"] { background: #22242d; }
.tree-node.file { cursor: pointer; }
.tree-children { margin-left: 14px; }
.status { color: #9aa0ad; font-size: 12px; margin-right: 5px; }
.review-pane { min-width: 0; overflow: auto; background: #0f0f11; }
.selected-file { position: sticky; top: 0; z-index: 1; padding: 12px 16px; border-bottom: 1px solid #262832; background: #0f0f11; font-size: 13px; color: #c7cad4; }
.diff-root { padding: 16px; }
.diff-fallback { margin: 0; padding: 14px; background: #101116; border: 1px solid #272a34; border-radius: 10px; overflow: auto; font: 12px/1.55 "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.diff-line.add { background: rgba(31, 136, 61, .18); }
.diff-line.del { background: rgba(248, 81, 73, .18); }
.review-drawer { position: absolute; top: 0; right: 0; width: min(480px, 92vw); height: 100%; transform: translateX(100%); transition: transform .16s ease; background: #15161c; border-left: 1px solid #30323a; box-shadow: -18px 0 45px rgba(0, 0, 0, .35); z-index: 5; overflow: auto; }
body[data-review-drawer="open"] .review-drawer { transform: translateX(0); }
.drawer-head { display: flex; justify-content: space-between; align-items: center; padding: 14px; border-bottom: 1px solid #2a2d36; }
.drawer-content { padding: 14px; display: grid; gap: 16px; }
.action-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.action-button { display: flex; justify-content: center; align-items: center; min-height: 38px; }
.drawer-section { border: 1px solid #292c36; border-radius: 12px; background: #111217; overflow: hidden; }
.drawer-section h2 { margin: 0; padding: 12px 12px 8px; font-size: 13px; color: #eceef2; }
.comment-card, .commit-card { padding: 10px 12px; border-top: 1px solid #252832; }
.comment-meta, .commit-meta { color: #9aa0ad; font-size: 12px; margin-bottom: 5px; }
.comment-body { white-space: pre-wrap; font-size: 13px; line-height: 1.45; }
.badge { display: inline-flex; align-items: center; border: 1px solid #30323a; border-radius: 999px; padding: 2px 7px; font-size: 11px; color: #cbd0dd; background: #1a1c23; }
.kbd { font: 11px/1.2 "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; border: 1px solid #393c46; border-bottom-color: #252832; border-radius: 5px; padding: 2px 5px; background: #20222a; color: #dfe3ed; }
.error { border: 1px solid #753236; color: #ffb4b4; background: #241114; padding: 14px; border-radius: 10px; }
`;
}

function renderClientScript(apiPath: string): string {
  return `
const apiPath = ${JSON.stringify(apiPath)};
const state = { data: null, selected: null, diffModule: null, treeModule: null };
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
  drawerComments: document.getElementById('drawer-comments'),
  drawerCommits: document.getElementById('drawer-commits'),
};

els.drawerToggle.addEventListener('click', () => setDrawer(true));
els.drawerClose.addEventListener('click', () => setDrawer(false));
els.copyAll.addEventListener('click', () => copyText(buildCommentsMarkdown()));
els.openChatGpt.addEventListener('click', () => openChatGptPrompt());
els.copyCodex.addEventListener('click', () => copyText(buildCodexPrompt()));
document.addEventListener('keydown', (event) => {
  if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  if (event.key === 'r') setDrawer(document.body.dataset.reviewDrawer !== 'open');
  if (event.key === 'c') copyText(buildCommentsMarkdown());
  if (event.key === 'g') openChatGptPrompt();
  if (event.key === 'Escape') setDrawer(false);
});

Promise.allSettled([
  import('https://esm.sh/@pierre/diffs').then((module) => { state.diffModule = module; }),
  import('https://esm.sh/@pierre/trees@1.0.0-beta.3').then((module) => { state.treeModule = module; }),
]).finally(loadLiveData);

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
    });
  }
}

function renderTreeNode(node) {
  if (node.type === 'root') return node.children.map(renderTreeNode).join('');
  if (node.type === 'file') {
    const current = state.selected && state.selected.filename === node.file.filename;
    return '<button class="tree-node file" type="button" data-file="' + escapeAttribute(node.file.filename) + '" aria-current="' + (current ? 'true' : 'false') + '"><span class="status">' + escapeHtml(statusToken(node.file.status)) + '</span>' + escapeHtml(node.name) + fileCommentBadge(node.file.filename) + '</button>';
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
    els.diff.innerHTML = '';
    return;
  }

  els.selected.textContent = state.selected.filename + ' · +' + state.selected.additions + ' −' + state.selected.deletions;
  renderDiff(state.selected);
}

function renderDiff(file) {
  els.diff.innerHTML = '';

  if (state.diffModule && state.diffModule.FileDiff && file.patch) {
    try {
      const fileDiff = new state.diffModule.FileDiff({ theme: 'pierre-dark' });
      fileDiff.render({
        patchFile: { name: file.filename, contents: file.patch },
        containerWrapper: els.diff,
      });
      return;
    } catch {
      // fall through to the local renderer
    }
  }

  els.diff.innerHTML = renderPatchFallback(file.patch || 'No patch available');
}

function renderDrawer() {
  const comments = state.data.comments || [];
  const commits = state.data.streamCommits || [];
  els.drawerSummary.innerHTML = '<h2>Review summary</h2><div class="comment-card"><span class="badge">' + comments.length + ' comments</span> <span class="badge">' + commits.length + ' stream commits</span></div>';
  els.drawerComments.innerHTML = '<h2>Comments</h2>' + (comments.length ? comments.map(renderComment).join('') : '<div class="comment-card muted">No review comments found.</div>');
  els.drawerCommits.innerHTML = '<h2>Recent stream commits</h2>' + (commits.length ? commits.map(renderCommit).join('') : '<div class="commit-card muted">No stream commits found for this head branch.</div>');
}

function renderComment(comment) {
  const location = comment.path ? ' · ' + comment.path + (comment.line ? ':' + comment.line : '') : '';
  const link = comment.url ? ' · <a href="' + escapeAttribute(comment.url) + '">open</a>' : '';
  return '<article class="comment-card"><div class="comment-meta"><span class="badge">' + escapeHtml(comment.provider) + '</span> ' + escapeHtml(comment.author) + location + link + '</div><div class="comment-body">' + escapeHtml(comment.body) + '</div></article>';
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
  return lines.join('
');
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
  ].join('
');
}

function buildCodexPrompt() {
  return '@codex please address the actionable review feedback in this PR.

' + buildCommentsMarkdown();
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

function renderPatchFallback(patch) {
  return '<pre class="diff-fallback">' + patch.split('
').map((line) => {
    const className = line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : '';
    return '<div class="diff-line ' + className + '">' + escapeHtml(line) + '</div>';
  }).join('') + '</pre>';
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
