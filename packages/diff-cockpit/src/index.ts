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
  authorAvatarUrl?: string;
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
export type PullRequestMergeability = 'mergeable' | 'conflicts' | 'merged' | 'closed' | 'draft' | 'unknown';

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
  mergeability: PullRequestMergeability;
};

export type PullRequestSection = {
  id: 'streams' | 'recently-merged' | 'open' | 'closed';
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
  nodeId?: string;
  databaseId?: string;
};

export type ReviewItemSource = ReviewComment['source'] | 'review-thread';
export type ReviewResolutionSource = 'github' | 'local';

export type ReviewThreadComment = {
  id: string;
  databaseId: string;
  provider: ReviewProvider;
  author: string;
  body: string;
  url: string;
  createdAt: string;
  path?: string;
  line?: number;
};

export type ReviewThread = {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path?: string;
  line?: number;
  comments: ReviewThreadComment[];
};

export type ReviewItem = {
  id: string;
  provider: ReviewProvider;
  source: ReviewItemSource;
  author: string;
  body: string;
  htmlUrl: string;
  createdAt: string;
  threadId?: string;
  commentNodeId?: string;
  path?: string;
  line?: number;
  isResolved: boolean;
  isOutdated: boolean;
  canResolve: boolean;
  resolutionSource: ReviewResolutionSource;
};

export type StreamCommit = {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  url: string;
  committedAt: string;
  additions: number;
  deletions: number;
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
  reviewItems: ReviewItem[];
  commits: StreamCommit[];
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


export type CodeBrowserLocator = RepoLocator & {
  ref: string;
  path: string;
};

export type CodeBrowserEntryType = 'dir' | 'file';

export type CodeBrowserCommit = {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  committedAt: string;
  htmlUrl: string;
  treeUrl: string;
};

export type CodeBrowserEntry = {
  name: string;
  path: string;
  type: CodeBrowserEntryType;
  sha: string;
  htmlUrl: string;
  treeUrl: string;
  latestCommitSha: string;
  latestCommitMessage: string;
  latestCommitAuthor: string;
  latestCommitDate: string;
};

export type CodeBrowserFile = {
  name: string;
  path: string;
  sha: string;
  htmlUrl: string;
  text: string;
  renderedHtml: string;
  language: string;
  isMarkdown: boolean;
};

export type CodeBrowserData = {
  locator: CodeBrowserLocator;
  entries: CodeBrowserEntry[];
  file: CodeBrowserFile | null;
  commitCount: number;
  latestCommit: CodeBrowserCommit | null;
  historyUrl: string;
  githubUrl: string;
  parentUrl: string;
};

export type CodeHistoryData = {
  locator: CodeBrowserLocator;
  commits: CodeBrowserCommit[];
  codeUrl: string;
};

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

type EdgeCache = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
  delete(request: Request): Promise<boolean>;
};

type DurableJsonSnapshotStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete?(key: string): Promise<void>;
};

type GithubLoaderOptions = {
  fetcher?: Fetcher;
  token?: string;
  cache?: EdgeCache;
  snapshotStore?: DurableJsonSnapshotStore;
};

type DiffCockpitEnv = {
  GITHUB_TOKEN?: string;
  GH_TOKEN?: string;
  DIFF_COCKPIT_DEFAULT_REPO?: string;
  DIFF_COCKPIT_REFRESH_TOKEN?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  DIFF_COCKPIT_SNAPSHOT_STORE?: DurableJsonSnapshotStore;
};

type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

const DEFAULT_OWNER = 'consuelohq';
const DEFAULT_REPO = 'opensaas';
const COCKPIT_ORIGIN = 'https://diffs.consuelohq.com';
const MAX_PAGES = 10;
const INDEX_OPEN_PULL_LIMIT = 75;
const INDEX_RECENT_PULL_LIMIT = 75;
const INDEX_MAX_PAGES = 1;
const INDEX_ENRICH_LIMIT = 10;
const HOT_PR_CACHE_LIMIT = 20;
const HOT_PR_RECENT_WINDOW_MS = 72 * 60 * 60 * 1000;
const REVIEW_REVALIDATE_MS = 15_000;
type PullRequestSearchTarget = Pick<
  PullRequestSummary,
  'title' | 'headRef' | 'baseRef' | 'number' | 'kind' | 'associatedStream'
>;

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function splitSearchTokens(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function isSubsequence(needle: string, haystack: string): boolean {
  if (!needle) return false;
  let haystackIndex = 0;
  for (const char of needle) {
    haystackIndex = haystack.indexOf(char, haystackIndex);
    if (haystackIndex === -1) return false;
    haystackIndex += 1;
  }
  return true;
}

function scoreSearchField(value: string, rawQuery: string, compactQuery: string, tokens: string[], weight: number): number {
  if (!value) return 0;
  const lowerValue = value.toLowerCase();
  const compactValue = normalizeSearchText(value);
  const fieldTokens = splitSearchTokens(value);
  let score = 0;
  if (rawQuery && lowerValue.includes(rawQuery)) score += 20 * weight;
  if (compactQuery && compactValue.includes(compactQuery)) score += 14 * weight;
  for (const token of tokens) {
    if (fieldTokens.some((fieldToken) => fieldToken.startsWith(token))) score += 5 * weight;
    else if (compactValue.includes(token)) score += 2 * weight;
    else if (isSubsequence(token, compactValue)) score += weight;
  }
  if (compactQuery && isSubsequence(compactQuery, compactValue)) score += weight;
  return score;
}

export function scorePullRequestSearch(
  pull: PullRequestSearchTarget,
  query: string,
  repoLabel = `${DEFAULT_OWNER}/${DEFAULT_REPO}`,
): number {
  const rawQuery = query.trim().toLowerCase();
  const compactQuery = normalizeSearchText(rawQuery);
  const tokens = splitSearchTokens(rawQuery);
  if (!rawQuery || (!compactQuery && tokens.length === 0)) return 1;

  const fields: Array<{ value: string; weight: number }> = [
    { value: pull.title, weight: 10 },
    { value: pull.headRef, weight: 8 },
    { value: pull.associatedStream, weight: 7 },
    { value: repoLabel, weight: 6 },
    { value: String(pull.number), weight: 6 },
    { value: pull.baseRef, weight: 4 },
    { value: pull.kind, weight: 3 },
  ];

  return fields.reduce(
    (score, field) => score + scoreSearchField(field.value, rawQuery, compactQuery, tokens, field.weight),
    0,
  );
}

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



export function buildCodeBrowserPath(repo: RepoLocator, ref = 'main', path = 'packages'): string {
  return `/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/tree/${encodeURIComponent(ref)}/${encodeCodePath(path)}`;
}

export function buildCodeHistoryPath(repo: RepoLocator, ref = 'main', path = 'packages'): string {
  return `/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/history/${encodeURIComponent(ref)}/${encodeCodePath(path)}`;
}

export function createGithubCodeBrowserLoader(options: GithubLoaderOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  return async (locator: CodeBrowserLocator): Promise<CodeBrowserData> => {
    try {
      const normalized = normalizeCodeBrowserLocator(locator);
      const headers = createGithubHeaders(options.token);
      const apiBase = `https://api.github.com/repos/${encodeURIComponent(normalized.owner)}/${encodeURIComponent(normalized.repo)}`;
      const contentUrl = `${apiBase}/contents/${encodeURIComponent(normalized.path)}?ref=${encodeURIComponent(normalized.ref)}`;
      const contentResponse = await fetcher(contentUrl, { headers });
      if (!contentResponse.ok) {
        throw new Error(`GitHub contents fetch failed: ${contentResponse.status}`);
      }
      const contentJson = await contentResponse.json();
      const pathCommitResponse = await fetcher(`${apiBase}/commits?${new URLSearchParams({ sha: normalized.ref, path: normalized.path, per_page: '1' }).toString()}`, { headers });
      if (!pathCommitResponse.ok) {
        throw new Error(`GitHub path commits fetch failed: ${pathCommitResponse.status}`);
      }
      const pathCommitJson = await pathCommitResponse.json();
      const pathCommitItems = Array.isArray(pathCommitJson) ? pathCommitJson : [];
      const latestCommit = pathCommitItems.length > 0 ? normalizeCodeCommit(normalized, pathCommitItems[0]) : null;
      const commitCount = parseCommitCount(pathCommitResponse.headers.get('link'), pathCommitItems.length);
      const githubPath = normalized.path ? `/${normalized.path}` : '';
      const githubUrl = `https://github.com/${encodeURIComponent(normalized.owner)}/${encodeURIComponent(normalized.repo)}/${Array.isArray(contentJson) ? 'tree' : 'blob'}/${encodeURIComponent(normalized.ref)}${githubPath}`;
      const parentPath = parentCodePath(normalized.path);
      const parentUrl = parentPath === normalized.path ? buildCodeBrowserPath(normalized, normalized.ref, normalized.path) : buildCodeBrowserPath(normalized, normalized.ref, parentPath);

      if (Array.isArray(contentJson)) {
        const entries = await Promise.all(contentJson.map((entryJson) => enrichCodeBrowserEntry(fetcher, apiBase, headers, normalized, entryJson)));
        return {
          locator: normalized,
          entries: entries.sort(compareCodeEntries),
          file: null,
          commitCount,
          latestCommit,
          historyUrl: buildCodeHistoryPath(normalized, normalized.ref, normalized.path),
          githubUrl,
          parentUrl,
        };
      }

      const record = requireRecord(contentJson, 'GitHub contents file response was not an object');
      const filePath = stringValue(record.path, normalized.path);
      const text = decodeGitHubContent(record);
      return {
        locator: { ...normalized, path: filePath },
        entries: [],
        file: {
          name: stringValue(record.name, filePath.split('/').pop() || filePath),
          path: filePath,
          sha: stringValue(record.sha, ''),
          htmlUrl: stringValue(record.html_url, githubUrl),
          text,
          renderedHtml: isMarkdownPath(filePath) ? renderMarkdownLite(text) : `<pre><code>${escapeHtml(text)}</code></pre>`,
          language: detectLanguage(filePath),
          isMarkdown: isMarkdownPath(filePath),
        },
        commitCount,
        latestCommit,
        historyUrl: buildCodeHistoryPath(normalized, normalized.ref, filePath),
        githubUrl,
        parentUrl,
      };
    } catch (error: unknown) {
      throw new Error(`failed to load code browser data: ${getErrorMessage(error)}`);
    }
  };
}

export function createGithubCodeHistoryLoader(options: GithubLoaderOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  return async (locator: CodeBrowserLocator): Promise<CodeHistoryData> => {
    try {
      const normalized = normalizeCodeBrowserLocator(locator);
      const headers = createGithubHeaders(options.token);
      const apiBase = `https://api.github.com/repos/${encodeURIComponent(normalized.owner)}/${encodeURIComponent(normalized.repo)}`;
      const commitsJson = await fetchJsonArrayPages(
        fetcher,
        `${apiBase}/commits?${new URLSearchParams({ sha: normalized.ref, path: normalized.path }).toString()}`,
        headers,
        'GitHub code history fetch failed',
        { maxPages: 2 },
      );
      return {
        locator: normalized,
        commits: commitsJson.map((item) => normalizeCodeCommit(normalized, item)),
        codeUrl: buildCodeBrowserPath(normalized, normalized.ref, normalized.path),
      };
    } catch (error: unknown) {
      throw new Error(`failed to load code history: ${getErrorMessage(error)}`);
    }
  };
}

async function enrichCodeBrowserEntry(
  fetcher: Fetcher,
  apiBase: string,
  headers: HeadersInit,
  locator: CodeBrowserLocator,
  entryJson: unknown,
): Promise<CodeBrowserEntry> {
  const entry = requireRecord(entryJson, 'GitHub contents entry was not an object');
  const path = stringValue(entry.path, '');
  const type = stringValue(entry.type, 'file') === 'dir' ? 'dir' : 'file';
  let latestCommit: CodeBrowserCommit | null = null;
  try {
    const response = await fetcher(`${apiBase}/commits?${new URLSearchParams({ sha: locator.ref, path, per_page: '1' }).toString()}`, { headers });
    if (response.ok) {
      const json = await response.json();
      const commits = Array.isArray(json) ? json : [];
      latestCommit = commits.length > 0 ? normalizeCodeCommit(locator, commits[0]) : null;
    }
  } catch {
    latestCommit = null;
  }
  return {
    name: stringValue(entry.name, path.split('/').pop() || path),
    path,
    type,
    sha: stringValue(entry.sha, ''),
    htmlUrl: stringValue(entry.html_url, ''),
    treeUrl: buildCodeBrowserPath(locator, locator.ref, path),
    latestCommitSha: latestCommit?.sha ?? '',
    latestCommitMessage: latestCommit?.message ?? 'No commit metadata',
    latestCommitAuthor: latestCommit?.author ?? '',
    latestCommitDate: latestCommit?.committedAt ?? '',
  };
}

function normalizeCodeCommit(locator: CodeBrowserLocator, input: unknown): CodeBrowserCommit {
  const record = requireRecord(input, 'GitHub commit was not an object');
  const commit = optionalRecord(record.commit) ?? {};
  const author = optionalRecord(record.author);
  const commitAuthor = optionalRecord(commit.author) ?? {};
  const sha = stringValue(record.sha, '');
  return {
    sha,
    shortSha: sha.slice(0, 7),
    message: firstLine(stringValue(commit.message, 'Untitled commit')),
    author: stringValue(author?.login, stringValue(commitAuthor.name, 'unknown')),
    committedAt: stringValue(commitAuthor.date, ''),
    htmlUrl: stringValue(record.html_url, `https://github.com/${locator.owner}/${locator.repo}/commit/${sha}`),
    treeUrl: buildCodeBrowserPath(locator, sha, locator.path),
  };
}

function compareCodeEntries(a: CodeBrowserEntry, b: CodeBrowserEntry): number {
  if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function normalizeCodeBrowserLocator(locator: CodeBrowserLocator): CodeBrowserLocator {
  return {
    owner: locator.owner || DEFAULT_OWNER,
    repo: locator.repo || DEFAULT_REPO,
    ref: locator.ref || 'main',
    path: normalizeCodePath(locator.path),
  };
}

function normalizeCodePath(path: string): string {
  const normalized = String(path || '').replace(/^\/+/, '').replace(/\/+$/, '');
  return normalized || 'packages';
}

function parentCodePath(path: string): string {
  const normalized = normalizeCodePath(path);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 1) return 'packages';
  return parts.slice(0, -1).join('/');
}

function encodeCodePath(path: string): string {
  return normalizeCodePath(path).split('/').map((part) => encodeURIComponent(part)).join('/');
}

function firstLine(message: string): string {
  return message.split('\n')[0] || message;
}

function parseCommitCount(linkHeader: string | null, fallback: number): number {
  if (!linkHeader) return fallback;
  const match = linkHeader.match(/[?&]page=(\d+)>; rel="last"/);
  return match ? Number(match[1]) : fallback;
}

function decodeGitHubContent(record: Record<string, unknown>): string {
  const encoding = stringValue(record.encoding, '');
  const content = stringValue(record.content, '');
  if (encoding !== 'base64') return content;
  try {
    const binary = atob(content.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch (error: unknown) {
    throw new Error(`failed to decode GitHub file content: ${getErrorMessage(error)}`);
  }
}

function isMarkdownPath(path: string): boolean {
  return /(^|\.)(md|mdx|markdown)$/i.test(path);
}

function detectLanguage(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() || '';
  return extension || 'text';
}

function renderMarkdownLite(markdown: string): string {
  const blocks: string[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return blocks.join('\n');
}

function renderInlineMarkdown(value: string): string {
  return escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
}

export function createGithubPullRequestIndexLoader(options: GithubLoaderOptions = {}) {
  const fetcher = options.fetcher ?? fetch;

  return async (repo: RepoLocator): Promise<PullRequestIndexData> => {
    const warnings: string[] = [];
    if (options.token) {
      try {
        return await loadGraphqlPullRequestIndex(fetcher, repo, options.token, warnings);
      } catch (error: unknown) {
        warnings.push(`graphql index: ${getErrorMessage(error)}`);
      }
    }

    const headers = createGithubHeaders(options.token);
    const apiBase = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`;
    const [openPullsJson, recentPullsJson] = await Promise.all([
      fetchJsonArrayPages(
        fetcher,
        `${apiBase}/pulls?state=open&sort=updated&direction=desc`,
        headers,
        'GitHub open pull requests fetch failed',
        { maxPages: INDEX_MAX_PAGES },
      ),
      fetchJsonArrayPages(
        fetcher,
        `${apiBase}/pulls?state=closed&sort=updated&direction=desc`,
        headers,
        'GitHub closed pull requests fetch failed',
        { maxPages: INDEX_MAX_PAGES },
      ),
    ]);
    const pullsJson = dedupePullRequestJson([
      ...openPullsJson.slice(0, INDEX_OPEN_PULL_LIMIT),
      ...recentPullsJson.slice(0, INDEX_RECENT_PULL_LIMIT),
    ]);
    const enrichedPulls = await Promise.all(
      pullsJson
        .slice(0, INDEX_ENRICH_LIMIT)
        .map((pullJson) => enrichPullRequestSummary(fetcher, apiBase, headers, repo, pullJson, warnings)),
    );
    const fallbackPulls = pullsJson
      .slice(INDEX_ENRICH_LIMIT)
      .map((pullJson) => normalizePullRequestSummary(repo, pullJson, [], []));
    const pulls = [...enrichedPulls, ...fallbackPulls];

    return {
      repo,
      pulls,
      updatedAt: deriveIndexUpdatedAt(pulls),
      warnings,
    };
  };
}

function dedupePullRequestJson(items: unknown[]): unknown[] {
  const seen = new Set<number>();
  const deduped: unknown[] = [];
  for (const item of items) {
    const record = optionalRecord(item);
    const number = numberValue(record?.number, 0);
    if (!number || seen.has(number)) continue;
    seen.add(number);
    deduped.push(item);
  }
  return deduped;
}

function dedupePullRequestSummaries(pulls: PullRequestSummary[]): PullRequestSummary[] {
  const seen = new Set<number>();
  const deduped: PullRequestSummary[] = [];
  for (const pull of pulls) {
    if (!pull.number || seen.has(pull.number)) continue;
    seen.add(pull.number);
    deduped.push(pull);
  }
  return deduped;
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
      const reviewThreads = options.token
        ? await loadReviewThreads(fetcher, locator, headers, warnings)
        : [];
      const reviewItems = normalizeReviewItems(comments, reviewThreads);
      const checks = await loadChecks(fetcher, apiBase, pull.headSha, headers);
      const commits = await loadPullCommits(fetcher, apiBase, locator.number, headers);
      const streamCommits = pull.headRef.startsWith('stream/')
        ? await loadStreamCommits(fetcher, apiBase, pull.headRef, headers)
        : [];

      return {
        locator,
        pull,
        files,
        tree: buildFileTree(files),
        comments,
        reviewItems,
        commits,
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

export function renderIndexPage(repo: RepoLocator, initialData: PullRequestIndexData | null = null, initialEtag = ''): string {
  const apiPath = `/api/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/pulls`;
  const repoLabel = `${repo.owner}/${repo.repo}`;
  const mainCodePath = `/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/tree/main/packages`;
  const initialDataScript = initialData
    ? `  <script id="diff-cockpit-index-initial-data" type="application/json">${escapeScriptJson(initialData)}</script>\n`
    : '';
  const initialEtagScript = initialEtag
    ? `  <script id="diff-cockpit-index-initial-etag" type="application/json">${escapeScriptJson(initialEtag)}</script>\n`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Consuelo Diffs · ${escapeHtml(repoLabel)}</title>
  <style>${renderStyles()}</style>
</head>
<body class="index-page" data-api-path="${escapeAttribute(apiPath)}" data-active-stream="" data-command-palette-state="closed">
  <div class="shell index-shell">
    <div class="wiki-topbar" data-pagefind-ignore>
      <a class="brand" href="/">Consuelo Diffs</a>
      <nav class="nav" aria-label="Primary">
        <button class="command-button command-button-plain" type="button" data-command-trigger aria-controls="diff-command-palette" aria-expanded="false"><span>Search</span><span class="command-shortcut">⌘K</span></button>
      </nav>
    </div>
    <header class="hero" data-pagefind-ignore>
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
    </header>
    <main id="pull-requests" class="section-stack" data-sections-root data-pagefind-ignore>
      <details class="section pr-section" open data-section-id="streams"><summary><h2>Streams</h2><button class="section-count" type="button" data-toggle-streams aria-pressed="false" title="Show all streams">—</button></summary><div class="post-list"><article class="post-item muted"><h3>Loading live pull requests…</h3><p>${escapeHtml(apiPath)}</p></article></div></details>
      <details class="section pr-section" open data-section-id="recently-merged"><summary><h2>Merging and recently merged</h2><span class="section-count">—</span></summary><div class="post-list"></div></details>
      <details class="section pr-section" open data-section-id="open"><summary><h2>Open</h2><span class="section-count">—</span></summary><div class="post-list"></div></details>
      <details class="section pr-section" open data-section-id="closed"><summary><h2>Closed</h2><span class="section-count">—</span></summary><div class="post-list"></div></details>
    </main>
    <div class="command-backdrop" data-command-backdrop hidden></div>
    <section id="diff-command-palette" class="command-palette command-bottom-drawer" data-command-palette role="dialog" aria-modal="true" aria-labelledby="diff-command-title" hidden>
      <div class="command-panel">
        <div class="command-panel-head"><div><p class="command-kicker">COMMAND PALETTE</p><h2 id="diff-command-title">Jump without hunting.</h2><p class="command-caption">Search PRs fuzzily or jump to a cockpit page.</p></div><button class="command-close" type="button" data-command-close>Close</button></div>
        <label class="command-input-row" for="diff-command-input"><span class="sr-only">Search pull requests and pages</span><input id="diff-command-input" class="command-input" type="search" placeholder="Search PRs or jump pages, e.g. code.call" autocomplete="off" spellcheck="false" /></label>
        <div class="command-section"><p class="command-section-title">Page</p><div class="command-list" data-command-pages>
          <button class="command-item" type="button" data-command-page data-command-label="Go to: PR inbox" data-command-url="#pull-requests"><span class="command-key">GI</span><span><strong>Go to: PR inbox</strong><small>Show the pull request inbox.</small></span></button>
          <button class="command-item" type="button" data-command-page data-command-label="Go to: Main code" data-command-url="${escapeAttribute(mainCodePath)}"><span class="command-key">GC</span><span><strong>Go to: Main code</strong><small>Open the main packages browser.</small></span></button>
          <button class="command-item" type="button" data-command-page data-command-label="Go to: Merges" data-command-filter="all" data-command-url="#recently-merged"><span class="command-key">GM</span><span><strong>Go to: Merges</strong><small>Jump to merging and recently merged PRs.</small></span></button>
          <button class="command-item" type="button" data-command-page data-command-label="Go to: Streams" data-command-filter="stream" data-command-url="#streams"><span class="command-key">GS</span><span><strong>Go to: Streams</strong><small>Show stream pull requests.</small></span></button>
          <button class="command-item" type="button" data-command-page data-command-label="Go to: Failing PRs" data-command-filter="failing" data-command-url="#pull-requests"><span class="command-key">GF</span><span><strong>Go to: Failing PRs</strong><small>Filter conflicts and failed checks.</small></span></button>
        </div></div>
        <div class="command-section"><p class="command-section-title">Recent PRs</p><div class="command-list" data-command-results><div class="command-empty">Loading live pull requests…</div></div></div>
        <div class="command-foot"><span><span class="kbd">⌘K</span> open</span><span><span class="kbd">Esc</span> close</span><span><span class="kbd">Enter</span> run</span></div>
      </div>
    </section>
    <button class="mobile-command-fab" type="button" data-command-trigger aria-controls="diff-command-palette" aria-expanded="false" aria-label="Open command search">⌘K</button>
    <footer data-pagefind-ignore>
      <span>© ${escapeHtml(new Date().getFullYear().toString())} Consuelo. All rights reserved.</span>
      <div class="footer-links" aria-label="Footer links"><a href="#pull-requests">Inbox</a></div>
    </footer>
  </div>
${initialDataScript}${initialEtagScript}  <script type="module">${renderIndexClientScript(apiPath, repo)}</script>
</body>
</html>`;
}

export function renderReviewPage(locator: PullRequestLocator, initialData: PullRequestReviewData | null = null, initialEtag = ''): string {
  const apiPath = `/api/${encodeURIComponent(locator.owner)}/${encodeURIComponent(
    locator.repo,
  )}/pull/${locator.number}`;
  const initialDataScript = initialData
    ? `  <script id="diff-cockpit-initial-data" type="application/json">${escapeScriptJson(initialData)}</script>\n`
    : '';
  const initialEtagScript = initialEtag
    ? `  <script id="diff-cockpit-initial-etag" type="application/json">${escapeScriptJson(initialEtag)}</script>\n`
    : '';

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
<body class="review-page" data-review-drawer="closed" data-ai-sidebar="closed" data-file-pane-collapsed="false" data-file-pane-drawer="open" data-comments-visible="true" data-current-view="diff" data-api-path="${escapeAttribute(apiPath)}">
  <header class="topbar review-topbar">
    <div>
      <p class="eyebrow"><a href="/">Consuelo Diffs</a></p>
      <h1 id="pr-title">${escapeHtml(locator.owner)}/${escapeHtml(locator.repo)} #${
        locator.number
      }</h1>
      <p id="pr-meta" class="muted">Loading live GitHub data…</p>
    </div>
    <nav class="links" aria-label="Pull request controls">
      <button id="mergeability-nav-button" class="nav-status-button" type="button" data-open-mergeability>mergeable</button>
      <button id="commit-nav-button" class="nav-status-button" type="button" data-open-commits>0 commits</button>
      <button id="ai-comments-toggle" class="nav-status-button" type="button" aria-expanded="false">Comments</button>
      <button id="drawer-toggle" type="button" aria-expanded="false">Panel</button>
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
    <button id="mobile-files-toggle" class="mobile-files-toggle" type="button" aria-label="Close files" aria-expanded="true">×</button>
    <button id="mobile-file-backdrop" class="mobile-file-backdrop" type="button" aria-label="Close files"></button>
    <section class="review-pane" aria-label="File diff">
      <div id="selected-file" class="selected-file">Select a file</div>
      <div id="diff-root" class="diff-root" data-diffs-library="@pierre/diffs"></div>
    </section>
    <aside id="review-drawer" class="review-drawer" aria-label="Review panel" aria-hidden="true">
      <div class="drawer-head">
        <strong>panel</strong>
        <button id="drawer-close" type="button">Close</button>
      </div>
      <div id="drawer-content" class="drawer-content">
        <div class="action-grid" aria-label="Review actions">
          <button id="copy-all-comments" class="action-button" type="button" title="Copy all review comments">□ Copy all</button>
          <button id="copy-review-link" class="action-button" type="button" title="Copy pull request link">Copy PR</button>
          <button id="copy-current-commit-link" class="action-button" type="button" title="Copy current commit link">Copy Commit</button>
          <button id="open-chatgpt-prompt" class="action-button" type="button">Open ChatGPT</button>
          <button id="copy-codex-prompt" class="action-button" type="button">Copy Codex</button>
          <button id="mergeability-button" class="action-button" type="button" data-open-mergeability>Mergeability</button>
          <button id="merge-pr-button" class="action-button" type="button">Merge PR</button>
        </div>
        <p class="muted">Keyboard: <span class="kbd">p</span> panel · <span class="kbd">f</span> files · <span class="kbd">m</span> mergeability · <span class="kbd">⌘M</span> merge PR · <span class="kbd">v</span> current view · <span class="kbd">i</span> inline comments · <span class="kbd">c</span> copy comments · <span class="kbd">g</span> ChatGPT · <span class="kbd">Esc</span> close</p>
        <div id="drawer-status" class="drawer-section drawer-section-open"><div class="drawer-section-head"><button class="drawer-section-toggle" type="button" data-drawer-section-toggle="status" aria-expanded="true"><span>Status</span><span class="drawer-section-caret">⌄</span></button></div><div class="drawer-section-body"><div class="comment-card muted">Loading PR status…</div></div></div>
        <div id="drawer-summary" class="drawer-section drawer-section-open"><div class="drawer-section-head"><button class="drawer-section-toggle" type="button" data-drawer-section-toggle="summary" aria-expanded="true"><span>Review summary</span><span class="drawer-section-caret">⌄</span></button></div><div class="drawer-section-body"><div class="comment-card muted">Loading review context…</div></div></div>
        <div id="drawer-prompt" class="drawer-section drawer-section-closed"><div class="drawer-section-head"><button class="drawer-section-toggle" type="button" data-drawer-section-toggle="prompt" aria-expanded="false"><span>Prompt for AI agents</span><span class="drawer-section-caret">›</span></button></div></div>
        <div id="drawer-checks" class="drawer-section drawer-section-closed"><div class="drawer-section-head"><button class="drawer-section-toggle" type="button" data-drawer-section-toggle="checks" aria-expanded="false"><span>Checks</span><span class="drawer-section-caret">›</span></button></div></div>
        <div id="drawer-comments" class="drawer-section drawer-section-closed"><div class="drawer-section-head"><button class="drawer-section-toggle" type="button" data-drawer-section-toggle="comments" aria-expanded="false"><span>Comments</span><span class="drawer-section-caret">›</span></button></div></div>
        <div id="drawer-commits" class="drawer-section drawer-section-closed"><div class="drawer-section-head"><button class="drawer-section-toggle" type="button" data-drawer-section-toggle="commits" aria-expanded="false"><span>Commits</span><span class="drawer-section-caret">›</span></button></div></div>
      </div>
    </aside>
    <aside id="ai-comments-sidebar" class="ai-comments-sidebar" aria-label="Comments" aria-hidden="true">
      <div class="ai-comments-head">
        <div><strong>Comments</strong><p id="ai-comments-summary" class="muted">Loading review comments…</p></div>
        <button id="ai-comments-close" type="button">Close</button>
      </div>
      <div id="ai-comments-content" class="ai-comments-content"><div class="comment-card muted">Loading CodeRabbit and Codex comments…</div></div>
    </aside>
    <div id="commit-popover" class="commit-popover" role="dialog" aria-label="Commits" hidden></div>
    <div id="mergeability-popover" class="commit-popover" role="dialog" aria-label="Mergeability" hidden></div>
  </main>
${initialDataScript}${initialEtagScript}  <script type="module">${renderReviewClientScript(apiPath)}</script>
</body>
</html>`;
}



export function renderCodeBrowserPage(repo: RepoLocator, ref = 'main', path = 'packages'): string {
  const normalizedPath = normalizeCodePath(path);
  const apiPath = `/api/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/code?ref=${encodeURIComponent(ref)}&path=${encodeURIComponent(normalizedPath)}`;
  const historyPath = buildCodeHistoryPath(repo, ref, normalizedPath);
  const repoLabel = `${repo.owner}/${repo.repo}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Code · ${escapeHtml(repoLabel)} · ${escapeHtml(normalizedPath)}</title>
  <style>${renderStyles()}</style>
</head>
<body class="code-page" data-api-path="${escapeAttribute(apiPath)}">
  <div class="shell code-shell">
    <div class="wiki-topbar" data-pagefind-ignore>
      <a class="brand" href="/">Consuelo Diffs</a>
      <nav class="nav" aria-label="Primary">
        <a href="/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}">Pull Requests</a>
        <a class="active-nav" href="${escapeAttribute(buildCodeBrowserPath(repo, ref, 'packages'))}">${escapeHtml(ref)}</a>
      </nav>
    </div>
    <header class="code-hero" data-pagefind-ignore>
      <div>
        <p class="eyebrow">${escapeHtml(repoLabel)}</p>
        <h1>${escapeHtml(ref)}</h1>
        <p class="lead">Browse live code from <code>${escapeHtml(normalizedPath)}</code>.</p>
      </div>
      <a class="history-button" data-history-link href="${escapeAttribute(historyPath)}">History</a>
    </header>
    <label class="code-search-row" for="code-search" data-pagefind-ignore>
      <span class="filter-label">Search</span>
      <input id="code-search" class="search-input code-search-input" type="search" placeholder="Search current folder or file" autocomplete="off" spellcheck="false" />
      <span class="search-hint">Press / to search</span>
    </label>
    <main class="code-browser-card" data-code-browser-root>
      <div class="code-browser-toolbar">
        <span class="branch-pill">${escapeHtml(ref)}</span>
        <span class="path-pill">${escapeHtml(normalizedPath)}</span>
        <span class="muted" data-commit-count>Loading commits…</span>
      </div>
      <div class="code-browser-list"><div class="code-row muted">Loading live GitHub files…</div></div>
    </main>
  </div>
  <script type="module">${renderCodeBrowserClientScript(apiPath)}</script>
</body>
</html>`;
}

export function renderHistoryPage(repo: RepoLocator, ref = 'main', path = 'packages'): string {
  const normalizedPath = normalizeCodePath(path);
  const apiPath = `/api/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/history?ref=${encodeURIComponent(ref)}&path=${encodeURIComponent(normalizedPath)}`;
  const codePath = buildCodeBrowserPath(repo, ref, normalizedPath);
  const repoLabel = `${repo.owner}/${repo.repo}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>History · ${escapeHtml(repoLabel)} · ${escapeHtml(normalizedPath)}</title>
  <style>${renderStyles()}</style>
</head>
<body class="code-page" data-api-path="${escapeAttribute(apiPath)}">
  <div class="shell code-shell">
    <div class="wiki-topbar" data-pagefind-ignore>
      <a class="brand" href="/">Consuelo Diffs</a>
      <nav class="nav" aria-label="Primary">
        <a href="/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}">Pull Requests</a>
        <a class="active-nav" href="${escapeAttribute(buildCodeBrowserPath(repo, ref, 'packages'))}">${escapeHtml(ref)}</a>
      </nav>
    </div>
    <header class="code-hero" data-pagefind-ignore>
      <div>
        <p class="eyebrow">${escapeHtml(repoLabel)}</p>
        <h1>History</h1>
        <p class="lead">Commits touching <code>${escapeHtml(normalizedPath)}</code>.</p>
      </div>
      <a class="history-button" href="${escapeAttribute(codePath)}">Back to code</a>
    </header>
    <main class="code-browser-card" data-code-history-root>
      <div class="code-browser-list"><div class="code-row muted">Loading commit history…</div></div>
    </main>
  </div>
  <script type="module">${renderCodeHistoryClientScript(apiPath)}</script>
</body>
</html>`;
}

export function createWorker(options: GithubLoaderOptions = {}) {
  memoryJsonCache.clear();
  return {
    async fetch(request: Request, env?: DiffCockpitEnv, ctx?: WorkerExecutionContext) {
      const url = new URL(request.url);
      const token = options.token ?? env?.GITHUB_TOKEN ?? env?.GH_TOKEN;
      const defaultRepo = env?.DIFF_COCKPIT_DEFAULT_REPO ?? `${DEFAULT_OWNER}/${DEFAULT_REPO}`;
      const reviewLoader = createGithubPullRequestLoader({ fetcher: options.fetcher, token });
      const indexLoader = createGithubPullRequestIndexLoader({ fetcher: options.fetcher, token });
      const codeLoader = createGithubCodeBrowserLoader({ fetcher: options.fetcher, token });
      const historyLoader = createGithubCodeHistoryLoader({ fetcher: options.fetcher, token });
      const edgeCache = options.cache ?? getDefaultEdgeCache();
      const snapshotStore = options.snapshotStore ?? env?.DIFF_COCKPIT_SNAPSHOT_STORE ?? null;

      if (url.pathname === '/healthz') {
        return new Response('ok', { headers: { 'content-type': 'text/plain' } });
      }

      if (url.pathname === '/internal/cache/refresh') {
        return handleCacheRefresh({ request, env, ctx, defaultRepo, indexLoader, reviewLoader, codeLoader, historyLoader, edgeCache, snapshotStore });
      }

      if (url.pathname === '/api/github/webhook') {
        return handleGithubWebhook({ request, env, edgeCache });
      }



      const codeApiMatch = url.pathname.match(/^\/api\/([^/]+)\/([^/]+)\/code$/);
      if (codeApiMatch) {
        try {
          const locator = {
            owner: decodeURIComponent(codeApiMatch[1] || ''),
            repo: decodeURIComponent(codeApiMatch[2] || ''),
            ref: url.searchParams.get('ref') || 'main',
            path: url.searchParams.get('path') || 'packages',
          };
          const cacheRequest = makeApiCacheRequest(url);
          return getOrSetCachedJson(edgeCache, snapshotStore, cacheRequest, request, async () => codeLoader(locator));
        } catch (error: unknown) {
          return json({ error: getErrorMessage(error) }, 502);
        }
      }

      const historyApiMatch = url.pathname.match(/^\/api\/([^/]+)\/([^/]+)\/history$/);
      if (historyApiMatch) {
        try {
          const locator = {
            owner: decodeURIComponent(historyApiMatch[1] || ''),
            repo: decodeURIComponent(historyApiMatch[2] || ''),
            ref: url.searchParams.get('ref') || 'main',
            path: url.searchParams.get('path') || 'packages',
          };
          const cacheRequest = makeApiCacheRequest(url);
          return getOrSetCachedJson(edgeCache, snapshotStore, cacheRequest, request, async () => historyLoader(locator));
        } catch (error: unknown) {
          return json({ error: getErrorMessage(error) }, 502);
        }
      }

      const indexApiMatch = url.pathname.match(/^\/api\/([^/]+)\/([^/]+)\/pulls$/);
      if (indexApiMatch) {
        try {
          const repo = {
            owner: decodeURIComponent(indexApiMatch[1] || ''),
            repo: decodeURIComponent(indexApiMatch[2] || ''),
          };
          const cacheRequest = makeApiCacheRequest(url);
          return getOrSetCachedJson(edgeCache, snapshotStore, cacheRequest, request, async () => indexLoader(repo));
        } catch (error: unknown) {
          return json({ error: getErrorMessage(error) }, 502);
        }
      }

      const reviewThreadApiMatch = url.pathname.match(/^\/api\/([^/]+)\/([^/]+)\/pull\/(\d+)\/review-threads\/([^/]+)\/(resolve|unresolve)$/);
      if (reviewThreadApiMatch) {
        if (request.method !== 'POST') {
          return json({ ok: false, error: 'Use POST to update a review thread.' }, 405);
        }
        const locator = {
          owner: decodeURIComponent(reviewThreadApiMatch[1] || ''),
          repo: decodeURIComponent(reviewThreadApiMatch[2] || ''),
          number: Number(reviewThreadApiMatch[3]),
        };
        const threadId = decodeURIComponent(reviewThreadApiMatch[4] || '');
        const action = reviewThreadApiMatch[5] === 'unresolve' ? 'unresolve' : 'resolve';
        return mutateGithubReviewThread(options.fetcher ?? fetch, token, threadId, action, edgeCache, url.origin, locator);
      }

      const mergeApiMatch = url.pathname.match(/^\/api\/([^/]+)\/([^/]+)\/pull\/(\d+)\/merge$/);
      if (mergeApiMatch) {
        if (request.method !== 'POST') {
          return json({ ok: false, error: 'Use POST to merge a pull request.' }, 405);
        }
        const locator = {
          owner: decodeURIComponent(mergeApiMatch[1] || ''),
          repo: decodeURIComponent(mergeApiMatch[2] || ''),
          number: Number(mergeApiMatch[3]),
        };
        return mergeGithubPullRequest(options.fetcher ?? fetch, token, locator);
      }

      const apiMatch = url.pathname.match(/^\/api\/([^/]+)\/([^/]+)\/pull\/(\d+)$/);
      if (apiMatch) {
        try {
          const locator = {
            owner: decodeURIComponent(apiMatch[1] || ''),
            repo: decodeURIComponent(apiMatch[2] || ''),
            number: Number(apiMatch[3]),
          };
          const cacheRequest = makeApiCacheRequest(url);
          return getOrSetCachedJson(edgeCache, snapshotStore, cacheRequest, request, async () => reviewLoader(locator));
        } catch (error: unknown) {
          return json({ error: getErrorMessage(error) }, 502);
        }
      }

      if (url.pathname === '/') {
        try {
          const repo = parseRepoLocator('', defaultRepo);
          const indexApiUrl = new URL(`${url.origin}/api/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/pulls`);
          const initialIndex = await readCachedJsonSnapshot<PullRequestIndexData>(edgeCache, snapshotStore, makeApiCacheRequest(indexApiUrl));
          return html(renderIndexPage(repo, initialIndex?.data ?? null, initialIndex?.etag ?? ''));
        } catch {
          return html(renderIndexPage(parseRepoLocator('', defaultRepo)));
        }
      }



      const treeRouteMatch = url.pathname.match(/^\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.*))?$/);
      if (treeRouteMatch) {
        return html(renderCodeBrowserPage({
          owner: decodeURIComponent(treeRouteMatch[1] || ''),
          repo: decodeURIComponent(treeRouteMatch[2] || ''),
        }, decodeURIComponent(treeRouteMatch[3] || 'main'), decodeURIComponent(treeRouteMatch[4] || 'packages')));
      }

      const historyRouteMatch = url.pathname.match(/^\/([^/]+)\/([^/]+)\/history\/([^/]+)(?:\/(.*))?$/);
      if (historyRouteMatch) {
        return html(renderHistoryPage({
          owner: decodeURIComponent(historyRouteMatch[1] || ''),
          repo: decodeURIComponent(historyRouteMatch[2] || ''),
        }, decodeURIComponent(historyRouteMatch[3] || 'main'), decodeURIComponent(historyRouteMatch[4] || 'packages')));
      }

      const repoRouteMatch = url.pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
      if (repoRouteMatch) {
        const repo = {
          owner: decodeURIComponent(repoRouteMatch[1] || ''),
          repo: decodeURIComponent(repoRouteMatch[2] || ''),
        };
        try {
          const indexApiUrl = new URL(`${url.origin}/api/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/pulls`);
          const initialIndex = await readCachedJsonSnapshot<PullRequestIndexData>(edgeCache, snapshotStore, makeApiCacheRequest(indexApiUrl));
          return html(renderIndexPage(repo, initialIndex?.data ?? null, initialIndex?.etag ?? ''));
        } catch {
          return html(renderIndexPage(repo));
        }
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
      try {
        const reviewApiUrl = new URL(`${url.origin}/api/${encodeURIComponent(locator.owner)}/${encodeURIComponent(locator.repo)}/pull/${locator.number}`);
        const initialData = await readCachedJsonSnapshot<PullRequestReviewData>(edgeCache, snapshotStore, makeApiCacheRequest(reviewApiUrl));
        return html(renderReviewPage(locator, initialData?.data ?? null, initialData?.etag ?? ''));
      } catch {
        return html(renderReviewPage(locator));
      }
    },
  };
}

function deriveIndexUpdatedAt(pulls: PullRequestSummary[]): string {
  let latest = '';
  for (const pull of pulls) {
    if (pull.updatedAt && (!latest || pull.updatedAt > latest)) latest = pull.updatedAt;
  }
  return latest;
}

function createGithubHeaders(token?: string): HeadersInit {
  return {
    accept: 'application/vnd.github+json',
    'user-agent': 'consuelo-diff-cockpit',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function mergeGithubPullRequest(fetcher: Fetcher, token: string | undefined, locator: PullRequestLocator): Promise<Response> {
  if (!token) {
    return json({ ok: false, error: 'Missing GitHub token for merge.' }, 401);
  }
  try {
    const response = await fetcher(
      `https://api.github.com/repos/${encodeURIComponent(locator.owner)}/${encodeURIComponent(locator.repo)}/pulls/${locator.number}/merge`,
      {
        method: 'PUT',
        headers: {
          ...createGithubHeaders(token),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ merge_method: 'merge' }),
      },
    );
    let payload: unknown = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    const record = optionalRecord(payload) ?? {};
    if (!response.ok) {
      return json({
        ok: false,
        status: response.status,
        error: stringValue(record.message, `GitHub merge failed: ${response.status}`),
        details: record,
      }, response.status);
    }
    return json({
      ok: true,
      merged: booleanValue(record.merged),
      sha: stringValue(record.sha, ''),
      message: stringValue(record.message, 'Merged'),
    });
  } catch (error: unknown) {
    return json({ ok: false, error: getErrorMessage(error) }, 502);
  }
}

async function fetchJsonArrayPages(
  fetcher: Fetcher,
  url: string,
  headers: HeadersInit,
  errorPrefix: string,
  options: { maxPages?: number } = {},
): Promise<unknown[]> {
  const items: unknown[] = [];
  const maxPages = options.maxPages ?? MAX_PAGES;
  for (let page = 1; page <= maxPages; page += 1) {
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
    authorAvatarUrl: stringValue(user?.avatar_url, ''),
    headRef: stringValue(head?.ref, ''),
    headSha: stringValue(head?.sha, ''),
    baseRef: stringValue(base?.ref, ''),
    baseSha: stringValue(base?.sha, ''),
    mergeable: typeof source.mergeable === 'boolean' ? source.mergeable : null,
    mergeableState: stringValue(source.mergeable_state, 'unknown'),
    updatedAt: stringValue(source.updated_at, ''),
  };
}

async function loadGraphqlPullRequestIndex(
  fetcher: Fetcher,
  repo: RepoLocator,
  token: string,
  warnings: string[],
): Promise<PullRequestIndexData> {
  try {
    const response = await fetcher('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        ...createGithubHeaders(token),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: GRAPHQL_PULL_REQUEST_INDEX_QUERY,
        variables: {
          owner: repo.owner,
          name: repo.repo,
          openFirst: INDEX_OPEN_PULL_LIMIT,
          recentFirst: INDEX_RECENT_PULL_LIMIT,
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`GitHub GraphQL pull request fetch failed: ${response.status}`);
    }
    const json = requireRecord(await response.json(), 'Invalid GitHub GraphQL response');
    if (Array.isArray(json.errors) && json.errors.length > 0) {
      throw new Error(`GitHub GraphQL errors: ${JSON.stringify(json.errors)}`);
    }
    const repository = optionalRecord(optionalRecord(json.data)?.repository);
    const openConnection = optionalRecord(repository?.openPullRequests) ?? optionalRecord(repository?.pullRequests);
    const recentConnection = optionalRecord(repository?.recentPullRequests);
    const openNodes = Array.isArray(openConnection?.nodes) ? openConnection.nodes : [];
    const recentNodes = Array.isArray(recentConnection?.nodes) ? recentConnection.nodes : [];
    const pulls = dedupePullRequestSummaries([
      ...openNodes.map((node) => normalizeGraphqlPullRequestSummary(repo, node)),
      ...recentNodes.map((node) => normalizeGraphqlPullRequestSummary(repo, node)),
    ]);
    if (booleanValue(optionalRecord(openConnection?.pageInfo)?.hasNextPage)) {
      warnings.push(`Open pull request backlog capped at ${INDEX_OPEN_PULL_LIMIT}`);
    }
    if (booleanValue(optionalRecord(recentConnection?.pageInfo)?.hasNextPage)) {
      warnings.push(`Recent pull request backlog capped at ${INDEX_RECENT_PULL_LIMIT}`);
    }
    return {
      repo,
      pulls,
      updatedAt: deriveIndexUpdatedAt(pulls),
      warnings,
    };
  } catch (error: unknown) {
    warnings.push(`GitHub GraphQL pull request fetch failed: ${getErrorMessage(error)}`);
    throw error;
  }
}

const GRAPHQL_PULL_REQUEST_INDEX_QUERY = `
query DiffCockpitPullRequests($owner: String!, $name: String!, $openFirst: Int!, $recentFirst: Int!) {
  repository(owner: $owner, name: $name) {
    openPullRequests: pullRequests(first: $openFirst, states: [OPEN], orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes { ...PullRequestIndexNode }
    }
    recentPullRequests: pullRequests(first: $recentFirst, states: [CLOSED, MERGED], orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes { ...PullRequestIndexNode }
    }
  }
}
fragment PullRequestIndexNode on PullRequest {
  number
  title
  url
  state
  isDraft
  merged
  mergedAt
  closedAt
  createdAt
  updatedAt
  additions
  deletions
  changedFiles
  mergeStateStatus
  author { login avatarUrl }
  headRefName
  headRefOid
  baseRefName
  baseRefOid
}
`;

function normalizeGraphqlPullRequestSummary(repo: RepoLocator, input: unknown): PullRequestSummary {
  const source = requireRecord(input, 'Invalid GitHub GraphQL pull request data');
  const author = optionalRecord(source.author);
  const state = stringValue(source.state, 'UNKNOWN').toLowerCase();
  const pull: GitHubPullRequest = {
    number: numberValue(source.number, 0),
    title: stringValue(source.title, 'Untitled pull request'),
    htmlUrl: stringValue(source.url, ''),
    state: state === 'merged' ? 'closed' : state,
    draft: booleanValue(source.isDraft),
    author: stringValue(author?.login, 'unknown'),
    authorAvatarUrl: stringValue(author?.avatarUrl, ''),
    headRef: stringValue(source.headRefName, ''),
    headSha: stringValue(source.headRefOid, ''),
    baseRef: stringValue(source.baseRefName, ''),
    baseSha: stringValue(source.baseRefOid, ''),
    mergeable: stringValue(source.mergeStateStatus, '').toUpperCase() === 'DIRTY' ? false : null,
    mergeableState: stringValue(source.mergeStateStatus, 'unknown').toLowerCase(),
    updatedAt: stringValue(source.updatedAt, ''),
  };
  const lifecycleStatus = normalizeGraphqlLifecycleStatus(pull, source);
  const associatedStream = deriveAssociatedStream(pull);
  return {
    ...pull,
    kind: classifyPullRequest(pull),
    createdAt: stringValue(source.createdAt, ''),
    updatedAt: stringValue(source.updatedAt, ''),
    cockpitUrl: buildDiffCockpitPath({ owner: repo.owner, repo: repo.repo, number: pull.number }),
    additions: numberValue(source.additions, 0),
    deletions: numberValue(source.deletions, 0),
    changedFiles: numberValue(source.changedFiles, 0),
    checkStatus: 'unknown',
    reviewStatus: 'none',
    lifecycleStatus,
    mergeStatus: lifecycleStatus,
    mergedAt: stringValue(source.mergedAt, ''),
    closedAt: stringValue(source.closedAt, ''),
    associatedStream,
    mergeability: normalizeMergeability(pull, lifecycleStatus),
  };
}

function normalizeGraphqlLifecycleStatus(
  pull: GitHubPullRequest,
  source: Record<string, unknown>,
): PullRequestLifecycleStatus {
  if (pull.draft) return 'draft';
  if (booleanValue(source.merged) || stringValue(source.mergedAt, '')) return 'merged';
  if (pull.state === 'closed') return 'closed';
  return 'open';
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
    return normalizePullRequestSummary(repo, detailJson, [], []);
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
    mergeability: normalizeMergeability(pull, lifecycleStatus),
  };
}

function normalizeMergeability(pull: GitHubPullRequest, lifecycleStatus: PullRequestLifecycleStatus): PullRequestMergeability {
  if (lifecycleStatus === 'merged') return 'merged';
  if (lifecycleStatus === 'closed') return 'closed';
  if (lifecycleStatus === 'draft') return 'draft';
  const state = pull.mergeableState.toLowerCase();
  if (state === 'dirty') return 'conflicts';
  if (['clean', 'has_hooks', 'unstable', 'blocked', 'behind'].includes(state)) return 'mergeable';
  if (pull.mergeable === false) return 'conflicts';
  if (pull.mergeable === true) return 'mergeable';
  return 'unknown';
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
  options: { stream?: string; showAllStreams?: boolean } = {},
): PullRequestSection[] {
  const scoped = options.stream ? pulls.filter((pull) => pull.associatedStream === options.stream) : pulls;
  const streamPulls = scoped.filter(
    (pull) =>
      pull.kind === 'stream' &&
      (options.showAllStreams || pull.lifecycleStatus === 'open' || pull.lifecycleStatus === 'draft'),
  );
  const sections: PullRequestSection[] = [
    { id: 'streams', title: 'Streams', pulls: streamPulls },
    {
      id: 'recently-merged',
      title: 'Merging and recently merged',
      pulls: scoped.filter((pull) => pull.lifecycleStatus === 'merged'),
    },
    {
      id: 'open',
      title: 'Open',
      pulls: scoped.filter((pull) => pull.kind !== 'stream' && (pull.lifecycleStatus === 'open' || pull.lifecycleStatus === 'draft')),
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

async function loadPullCommits(
  fetcher: Fetcher,
  apiBase: string,
  number: number,
  headers: HeadersInit,
): Promise<StreamCommit[]> {
  try {
    const json = await fetchJsonArrayPages(
      fetcher,
      `${apiBase}/pulls/${number}/commits`,
      headers,
      'GitHub pull request commits fetch failed',
      { maxPages: 1 },
    );
    return normalizeStreamCommits(json);
  } catch {
    return [];
  }
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
    const json = await fetchJsonArrayPages(
      fetcher,
      `${apiBase}/commits?sha=${encodeURIComponent(headRef)}`,
      headers,
      'GitHub stream commits fetch failed',
      { maxPages: 1 },
    );
    return normalizeStreamCommits(json).slice(0, 50);
  } catch {
    return [];
  }
}

async function loadReviewThreads(
  fetcher: Fetcher,
  locator: PullRequestLocator,
  headers: HeadersInit,
  warnings: string[],
): Promise<ReviewThread[]> {
  const query = [
    'query DiffCockpitReviewThreads($owner: String!, $repo: String!, $number: Int!) {' ,
    'repository(owner: $owner, name: $repo) {' ,
    'pullRequest(number: $number) {' ,
    'reviewThreads(first: 100) {' ,
    'nodes { id isResolved isOutdated path line comments(first: 30) {' ,
    'nodes { id databaseId url body createdAt path line author { login } }' ,
    '} } } } } }' ,
  ].join(' ');

  try {
    const response = await fetcher('https://api.github.com/graphql', {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { owner: locator.owner, repo: locator.repo, number: locator.number },
      }),
    });
    if (!response.ok) {
      warnings.push('review threads unavailable: GitHub GraphQL returned ' + response.status);
      return [];
    }
    return normalizeReviewThreadsResponse(await response.json());
  } catch (error: unknown) {
    warnings.push('review threads unavailable: ' + getErrorMessage(error));
    return [];
  }
}

function normalizeReviewThreadsResponse(input: unknown): ReviewThread[] {
  const root = optionalRecord(input);
  const data = optionalRecord(root?.data);
  const repository = optionalRecord(data?.repository);
  const pullRequest = optionalRecord(repository?.pullRequest);
  const reviewThreads = optionalRecord(pullRequest?.reviewThreads);
  const nodes = Array.isArray(reviewThreads?.nodes) ? reviewThreads.nodes : [];
  return nodes
    .map((thread) => {
      const record = optionalRecord(thread);
      if (!record) return null;
      const commentsConnection = optionalRecord(record.comments);
      const comments = Array.isArray(commentsConnection?.nodes) ? commentsConnection.nodes : [];
      const line = numberValue(record.line, 0);
      const item: ReviewThread = {
        id: stringValue(record.id, ''),
        isResolved: booleanValue(record.isResolved),
        isOutdated: booleanValue(record.isOutdated),
        ...(record.path ? { path: stringValue(record.path, '') } : {}),
        ...(line > 0 ? { line } : {}),
        comments: comments.map(normalizeReviewThreadComment).filter((comment): comment is ReviewThreadComment => Boolean(comment)),
      };
      return item.id ? item : null;
    })
    .filter((thread): thread is ReviewThread => Boolean(thread));
}

function normalizeReviewThreadComment(input: unknown): ReviewThreadComment | null {
  const record = optionalRecord(input);
  if (!record) return null;
  const authorRecord = optionalRecord(record.author);
  const author = stringValue(authorRecord?.login, 'unknown');
  const body = stringValue(record.body, '').trim();
  if (!body) return null;
  const line = numberValue(record.line, 0);
  const databaseId = stringValue(record.databaseId, '');
  return {
    id: stringValue(record.id, databaseId || body),
    databaseId,
    provider: detectReviewProvider(author),
    author,
    body,
    url: stringValue(record.url, ''),
    createdAt: stringValue(record.createdAt, ''),
    ...(record.path ? { path: stringValue(record.path, '') } : {}),
    ...(line > 0 ? { line } : {}),
  };
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
        ...(record.node_id ? { nodeId: stringValue(record.node_id, '') } : {}),
        ...(record.id ? { databaseId: stringValue(record.id, '') } : {}),
        ...(record.path ? { path: stringValue(record.path, '') } : {}),
        ...(line > 0 ? { line } : {}),
      };
    })
    .filter((comment): comment is ReviewComment => Boolean(comment));
}

export function normalizeReviewItems(comments: ReviewComment[], threads: ReviewThread[] = []): ReviewItem[] {
  const itemsByKey = new Map<string, ReviewItem>();

  for (const comment of comments) {
    if (!isAiReviewProvider(comment.provider)) continue;
    const item: ReviewItem = {
      id: comment.nodeId || comment.id,
      provider: comment.provider,
      source: comment.source,
      author: comment.author,
      body: comment.body,
      htmlUrl: comment.url,
      createdAt: comment.createdAt,
      ...(comment.path ? { path: comment.path } : {}),
      ...(comment.line ? { line: comment.line } : {}),
      isResolved: false,
      isOutdated: false,
      canResolve: false,
      resolutionSource: 'local',
    };
    itemsByKey.set(reviewItemKey(comment.nodeId, comment.id, comment.url), item);
  }

  for (const thread of threads) {
    for (const comment of thread.comments) {
      if (!isAiReviewProvider(comment.provider)) continue;
      const item: ReviewItem = {
        id: comment.id,
        provider: comment.provider,
        source: 'review-thread',
        author: comment.author,
        body: comment.body,
        htmlUrl: comment.url,
        createdAt: comment.createdAt,
        threadId: thread.id,
        commentNodeId: comment.id,
        ...(comment.path || thread.path ? { path: comment.path || thread.path } : {}),
        ...(comment.line || thread.line ? { line: comment.line || thread.line } : {}),
        isResolved: thread.isResolved,
        isOutdated: thread.isOutdated,
        canResolve: true,
        resolutionSource: 'github',
      };
      itemsByKey.set(reviewItemKey(comment.id, comment.databaseId, comment.url), item);
    }
  }

  return Array.from(itemsByKey.values()).sort(compareReviewItems);
}

function isAiReviewProvider(provider: ReviewProvider): boolean {
  return provider === 'coderabbit' || provider === 'codex' || provider === 'claude';
}

function reviewItemKey(commentNodeId: string | undefined, id: string, htmlUrl: string): string {
  return htmlUrl || commentNodeId || id;
}

function compareReviewItems(a: ReviewItem, b: ReviewItem): number {
  const pathCompare = (a.path || '').localeCompare(b.path || '');
  if (pathCompare !== 0) return pathCompare;
  const lineCompare = (a.line || 0) - (b.line || 0);
  if (lineCompare !== 0) return lineCompare;
  return a.createdAt.localeCompare(b.createdAt);
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
    const stats = optionalRecord(record.stats);
    const sha = stringValue(record.sha, '');
    const message = stringValue(commitRecord?.message, '').split('\n')[0] || 'Untitled commit';
    return {
      sha,
      shortSha: sha.slice(0, 7),
      message,
      author: stringValue(authorRecord?.login ?? commitAuthor?.name, 'unknown'),
      url: stringValue(record.html_url, ''),
      committedAt: stringValue(commitAuthor?.date, ''),
      additions: numberValue(stats?.additions, 0),
      deletions: numberValue(stats?.deletions, 0),
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


type ReviewThreadMutationAction = 'resolve' | 'unresolve';

async function mutateGithubReviewThread(
  fetcher: Fetcher,
  token: string | undefined,
  threadId: string,
  action: ReviewThreadMutationAction,
  edgeCache: EdgeCache | null,
  requestOrigin: string,
  locator: PullRequestLocator,
): Promise<Response> {
  if (!token) return json({ ok: false, error: 'GitHub token is required to update review threads.' }, 401);
  if (!threadId) return json({ ok: false, error: 'review thread id is required.' }, 400);
  try {
    const mutationName = action === 'resolve' ? 'resolveReviewThread' : 'unresolveReviewThread';
    const query = 'mutation DiffCockpitReviewThread($threadId: ID!) { ' + mutationName + '(input: { threadId: $threadId }) { thread { id isResolved } } }';
    const response = await fetcher('https://api.github.com/graphql', {
      method: 'POST',
      headers: { ...createGithubHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables: { threadId } }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json({ ok: false, error: 'GitHub GraphQL review thread mutation failed.', details: payload }, response.status);
    }
    const invalidated = await invalidatePullRequestReviewCache(edgeCache, requestOrigin, locator);
    return json({ ok: true, action, payload, invalidated: [invalidated.path], edgeInvalidated: invalidated.edgeInvalidated });
  } catch (error: unknown) {
    return json({ ok: false, error: getErrorMessage(error) }, 502);
  }
}

async function invalidatePullRequestReviewCache(
  edgeCache: EdgeCache | null,
  requestOrigin: string,
  locator: PullRequestLocator,
): Promise<{ path: string; edgeInvalidated: boolean }> {
  try {
    const apiUrl = new URL(`${requestOrigin}/api/${encodeURIComponent(locator.owner)}/${encodeURIComponent(locator.repo)}/pull/${locator.number}`);
    const cacheRequest = makeApiCacheRequest(apiUrl);
    memoryJsonCache.delete(memoryCacheKey(cacheRequest));
    const edgeInvalidated = edgeCache ? await edgeCache.delete(cacheRequest) : false;
    return { path: apiUrl.pathname, edgeInvalidated };
  } catch (error: unknown) {
    throw new Error(`failed to invalidate PR cache: ${getErrorMessage(error)}`);
  }
}

type GithubWebhookDeps = {
  request: Request;
  env?: DiffCockpitEnv;
  edgeCache: EdgeCache | null;
};

async function handleGithubWebhook(deps: GithubWebhookDeps): Promise<Response> {
  if (deps.request.method !== 'POST') return internalJson({ error: 'GitHub webhook requires POST' }, 405);
  const secret = deps.env?.GITHUB_WEBHOOK_SECRET;
  if (!secret) return internalJson({ error: 'GITHUB_WEBHOOK_SECRET is not configured' }, 503);
  const body = await deps.request.text();
  const valid = await verifyGithubWebhookSignature(body, deps.request.headers.get('x-hub-signature-256') || '', secret);
  if (!valid) return internalJson({ error: 'invalid GitHub webhook signature' }, 401);
  const event = deps.request.headers.get('x-github-event') || '';
  let payload: unknown;
  try { payload = JSON.parse(body); } catch (error: unknown) { return internalJson({ error: 'invalid JSON body: ' + getErrorMessage(error) }, 400); }
  const record = optionalRecord(payload);
  const action = stringValue(record?.action, '');
  if (event !== 'pull_request_review_thread' || !['resolved', 'unresolved'].includes(action)) {
    return internalJson({ ok: true, event, action, invalidated: [] });
  }
  const pull = optionalRecord(record?.pull_request);
  const repo = optionalRecord(record?.repository);
  const ownerRecord = optionalRecord(repo?.owner);
  const owner = stringValue(ownerRecord?.login, '');
  const repoName = stringValue(repo?.name, '');
  const pullNumber = numberValue(pull?.number, 0);
  if (!owner || !repoName || pullNumber <= 0) {
    return internalJson({ ok: false, error: 'missing pull request locator' }, 400);
  }
  try {
    const invalidated = await invalidatePullRequestReviewCache(deps.edgeCache, COCKPIT_ORIGIN, { owner, repo: repoName, number: pullNumber });
    return internalJson({ ok: true, event, action, invalidated: [invalidated.path], edgeInvalidated: invalidated.edgeInvalidated });
  } catch (error: unknown) {
    return internalJson({ ok: false, error: getErrorMessage(error) }, 502);
  }
}

async function verifyGithubWebhookSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    if (!signature.startsWith('sha256=')) return false;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expected = 'sha256=' + Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return timingSafeEqual(expected, signature);
  } catch {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}
type CacheRefreshInput = {
  repo?: string;
  pulls?: unknown;
  reason?: string;
  codePaths?: unknown;
};

type CacheRefreshDeps = {
  request: Request;
  env?: DiffCockpitEnv;
  ctx?: WorkerExecutionContext;
  defaultRepo: string;
  indexLoader: ReturnType<typeof createGithubPullRequestIndexLoader>;
  reviewLoader: ReturnType<typeof createGithubPullRequestLoader>;
  codeLoader: ReturnType<typeof createGithubCodeBrowserLoader>;
  historyLoader: ReturnType<typeof createGithubCodeHistoryLoader>;
  edgeCache: EdgeCache | null;
  snapshotStore: DurableJsonSnapshotStore | null;
};

async function handleCacheRefresh(deps: CacheRefreshDeps): Promise<Response> {
  if (deps.request.method !== 'POST') {
    return internalJson({ error: 'cache refresh requires POST' }, 405);
  }
  const expectedToken = deps.env?.DIFF_COCKPIT_REFRESH_TOKEN;
  if (!expectedToken) {
    return internalJson({ error: 'DIFF_COCKPIT_REFRESH_TOKEN is not configured' }, 503);
  }
  if (!isAuthorizedRefreshRequest(deps.request, expectedToken)) {
    return internalJson({ error: 'unauthorized' }, 401);
  }

  let input: CacheRefreshInput;
  try {
    input = await deps.request.json() as CacheRefreshInput;
  } catch (error: unknown) {
    return internalJson({ error: `invalid JSON body: ${getErrorMessage(error)}` }, 400);
  }

  const repo = parseRepoLocator('', stringValue(input.repo, deps.defaultRepo));
  const pullNumbers = normalizeRefreshPulls(input.pulls);
  const codePaths = normalizeRefreshCodePaths(input.codePaths);
  const requestOrigin = new URL(deps.request.url).origin;
  const reason = stringValue(input.reason, 'manual');
  const planned = buildCacheRefreshPlan(requestOrigin, repo, pullNumbers, codePaths);

  const waitForCompletion = new URL(deps.request.url).searchParams.get('wait') === '1';
  if (deps.ctx && !waitForCompletion) {
    deps.ctx.waitUntil(refreshCacheEntries(deps, repo, pullNumbers, codePaths, requestOrigin).catch(() => undefined));
    return internalJson({
      ok: true,
      reason,
      cache: deps.edgeCache ? 'edge' : 'none',
      queued: true,
      refreshed: planned,
    });
  }

  const refreshed = await refreshCacheEntries(deps, repo, pullNumbers, codePaths, requestOrigin);
  return internalJson({
    ok: true,
    reason,
    cache: deps.edgeCache ? 'edge' : 'none',
    completed: true,
    refreshed,
  });
}

async function refreshCacheEntries(
  deps: CacheRefreshDeps,
  repo: RepoLocator,
  pullNumbers: number[],
  codePaths: string[],
  requestOrigin: string,
): Promise<{ homepage: string; pulls: string[]; code: string[]; history: string[] }> {
  try {
    const homepageUrl = `${requestOrigin}/api/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/pulls`;
    const homepageRequest = makeApiCacheRequest(new URL(homepageUrl));
    const homepageData = await deps.indexLoader(repo);
    await replaceCachedJson(deps.edgeCache, deps.snapshotStore, homepageRequest, cachedJson(homepageData, homepageRequest));
    const selectedPullNumbers = selectRefreshPullNumbers(homepageData.pulls, pullNumbers);
    const [codeResults, pullResults] = await Promise.all([
      Promise.all(codePaths.map((path) => refreshCodePathCache(deps, repo, path, requestOrigin))),
      mapWithConcurrency(selectedPullNumbers, 5, (pullNumber) => refreshPullCache(deps, repo, pullNumber, requestOrigin)),
    ]);

    return {
      homepage: new URL(homepageUrl).pathname,
      pulls: pullResults,
      code: codeResults.map((result) => result.code),
      history: codeResults.map((result) => result.history),
    };
  } catch (error: unknown) {
    throw new Error(`failed to refresh diff cockpit cache entries: ${getErrorMessage(error)}`);
  }
}

async function refreshCodePathCache(
  deps: CacheRefreshDeps,
  repo: RepoLocator,
  path: string,
  requestOrigin: string,
): Promise<{ code: string; history: string }> {
  try {
    const codeUrl = `${requestOrigin}/api/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/code?ref=main&path=${encodeURIComponent(path)}`;
    const historyUrl = `${requestOrigin}/api/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/history?ref=main&path=${encodeURIComponent(path)}`;
    const codeRequest = makeApiCacheRequest(new URL(codeUrl));
    const historyRequest = makeApiCacheRequest(new URL(historyUrl));
    const [codeData, historyData] = await Promise.all([
      deps.codeLoader({ owner: repo.owner, repo: repo.repo, ref: 'main', path }),
      deps.historyLoader({ owner: repo.owner, repo: repo.repo, ref: 'main', path }),
    ]);
    await Promise.all([
      replaceCachedJson(deps.edgeCache, deps.snapshotStore, codeRequest, cachedJson(codeData, codeRequest)),
      replaceCachedJson(deps.edgeCache, deps.snapshotStore, historyRequest, cachedJson(historyData, historyRequest)),
    ]);
    return { code: cachePathLabel(codeUrl), history: cachePathLabel(historyUrl) };
  } catch (error: unknown) {
    throw new Error(`failed to refresh code cache for ${path}: ${getErrorMessage(error)}`);
  }
}

async function refreshPullCache(
  deps: CacheRefreshDeps,
  repo: RepoLocator,
  pullNumber: number,
  requestOrigin: string,
): Promise<string> {
  try {
    const pullUrl = `${requestOrigin}/api/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/pull/${pullNumber}`;
    const pullRequest = makeApiCacheRequest(new URL(pullUrl));
    const pullData = await deps.reviewLoader({ owner: repo.owner, repo: repo.repo, number: pullNumber });
    await replaceCachedJson(deps.edgeCache, deps.snapshotStore, pullRequest, cachedJson(pullData, pullRequest));
    return new URL(pullUrl).pathname;
  } catch (error: unknown) {
    throw new Error(`failed to refresh PR cache for ${pullNumber}: ${getErrorMessage(error)}`);
  }
}

function buildCacheRefreshPlan(
  requestOrigin: string,
  repo: RepoLocator,
  pullNumbers: number[],
  codePaths: string[],
): { homepage: string; pulls: string[]; code: string[]; history: string[] } {
  const homepageUrl = `${requestOrigin}/api/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/pulls`;
  return {
    homepage: new URL(homepageUrl).pathname,
    pulls: pullNumbers.map((pullNumber) => `/api/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/pull/${pullNumber}`),
    code: codePaths.map((path) => cachePathLabel(`${requestOrigin}/api/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/code?ref=main&path=${encodeURIComponent(path)}`)),
    history: codePaths.map((path) => cachePathLabel(`${requestOrigin}/api/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/history?ref=main&path=${encodeURIComponent(path)}`)),
  };
}

function cachePathLabel(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

function selectRefreshPullNumbers(pulls: PullRequestSummary[], explicitPullNumbers: number[]): number[] {
  const explicit = new Set(explicitPullNumbers);
  const selected = [...explicit];
  const hot = pulls
    .filter((pull) => isHotPullSummary(pull))
    .sort((a, b) => pullUpdatedAtMs(b) - pullUpdatedAtMs(a));
  for (const pull of hot) {
    if (selected.length >= explicit.size + HOT_PR_CACHE_LIMIT) break;
    if (!explicit.has(pull.number) && !selected.includes(pull.number)) selected.push(pull.number);
  }
  return selected;
}

function isHotPullSummary(pull: PullRequestSummary): boolean {
  return pull.state === 'open' || isRecentIsoDate(pull.updatedAt);
}

function pullUpdatedAtMs(pull: PullRequestSummary): number {
  const timestamp = Date.parse(pull.updatedAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  try {
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(concurrency, 1), items.length);
    const runWorker = async () => {
      try {
        while (nextIndex < items.length) {
          const currentIndex = nextIndex;
          nextIndex += 1;
          results[currentIndex] = await mapper(items[currentIndex]);
        }
      } catch (error: unknown) {
        throw error;
      }
    };
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    return results;
  } catch (error: unknown) {
    throw new Error(`failed to run bounded cache refresh workers: ${getErrorMessage(error)}`);
  }
}

function isRecentIsoDate(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= Date.now() - HOT_PR_RECENT_WINDOW_MS;
}

function isAuthorizedRefreshRequest(request: Request, expectedToken: string): boolean {
  const authorization = request.headers.get('authorization') || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
  const headerToken = request.headers.get('x-diff-cockpit-refresh-token') || '';
  return bearer === expectedToken || headerToken === expectedToken;
}

function normalizeRefreshPulls(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const pulls = new Set<number>();
  for (const item of value) {
    const pull = typeof item === 'number' ? item : Number(item);
    if (Number.isInteger(pull) && pull > 0) pulls.add(pull);
  }
  return [...pulls];
}

function normalizeRefreshCodePaths(value: unknown): string[] {
  const paths = new Set<string>(['packages']);
  if (Array.isArray(value)) {
    for (const item of value) {
      const path = normalizeCodePath(String(item || ''));
      if (path.startsWith('packages')) paths.add(path);
    }
  }
  return [...paths];
}

type MemoryCachedJson = {
  body: string;
  etag: string;
  expiresAt: number;
};

type DurableCachedJson = {
  body: string;
  etag: string;
  schemaVersion: string;
  writtenAt: string;
};

type CachedJsonSnapshot<T> = {
  data: T;
  etag: string;
  body?: string;
};

const MEMORY_JSON_CACHE_TTL_MS = 5 * 60 * 1000;
const API_CACHE_SCHEMA_VERSION = 'v6-hot-pr-cache';
const memoryJsonCache = new Map<string, MemoryCachedJson>();

function makeApiCacheRequest(url: URL): Request {
  const cacheUrl = new URL(url.toString());
  cacheUrl.searchParams.set('_dcv', API_CACHE_SCHEMA_VERSION);
  return new Request(cacheUrl.toString(), { headers: { accept: 'application/json' } });
}

async function getOrSetCachedJson(
  edgeCache: EdgeCache | null,
  snapshotStore: DurableJsonSnapshotStore | null,
  cacheRequest: Request,
  clientRequest: Request,
  load: () => Promise<unknown>,
): Promise<Response> {
  try {
    const cached = await readCachedJson(edgeCache, snapshotStore, cacheRequest, clientRequest);
    if (cached) return cached;
    const response = cachedJson(await load(), clientRequest);
    const cacheWriteStatus = await replaceCachedJson(edgeCache, snapshotStore, cacheRequest, response);
    response.headers.set('x-diff-cockpit-cache-write', cacheWriteStatus);
    return response;
  } catch (error: unknown) {
    throw new Error(`failed to build cached JSON response: ${getErrorMessage(error)}`);
  }
}

async function readCachedJsonSnapshot<T>(edgeCache: EdgeCache | null, snapshotStore: DurableJsonSnapshotStore | null, cacheRequest: Request): Promise<CachedJsonSnapshot<T> | null> {
  const durable = await readDurableCachedJsonSnapshot<T>(snapshotStore, cacheRequest);
  if (durable) return durable;
  try {
    if (edgeCache) {
      const cached = await edgeCache.match(cacheRequest);
      if (cached?.status === 200) {
        void writeMemoryCachedJson(cacheRequest, cached.clone());
        const body = await cached.clone().text();
        return { data: JSON.parse(body) as T, etag: cached.headers.get('etag') || makeWeakEtag(body), body };
      }
    }
  } catch {
    // Fall through to the isolate-local cache.
  }
  return readMemoryCachedJsonSnapshot<T>(cacheRequest);
}

async function readCachedJson(edgeCache: EdgeCache | null, snapshotStore: DurableJsonSnapshotStore | null, cacheRequest: Request, clientRequest: Request): Promise<Response | null> {
  const durable = await readDurableCachedJson(snapshotStore, cacheRequest, clientRequest);
  if (durable) return durable;
  try {
    if (edgeCache) {
      const cached = await edgeCache.match(cacheRequest);
      if (cached) {
        if (cached.status === 200) void writeMemoryCachedJson(cacheRequest, cached.clone());
        const etag = cached.headers.get('etag') || '';
        const body = await cached.clone().text();
        if (etag && clientRequest.headers.get('if-none-match') === etag) {
          return cachedJsonNotModified(etag, clientRequest, 'edge', body);
        }
        return cachedJsonBody(body, etag || makeWeakEtag(body), clientRequest, 'edge');
      }
    }
  } catch {
    // Fall through to the isolate-local cache.
  }
  return readMemoryCachedJson(cacheRequest, clientRequest);
}

async function replaceCachedJson(edgeCache: EdgeCache | null, snapshotStore: DurableJsonSnapshotStore | null, cacheRequest: Request, response: Response): Promise<string> {
  if (response.status !== 200) return 'skip-status';
  await writeMemoryCachedJson(cacheRequest, response);
  const snapshotStatus = await writeDurableCachedJson(snapshotStore, cacheRequest, response);
  let edgeStatus = 'memory';
  try {
    if (edgeCache) {
      const cacheResponse = await cloneCacheableResponse(response);
      await edgeCache.put(cacheRequest, cacheResponse);
      edgeStatus = 'edge';
    }
  } catch (error: unknown) {
    edgeStatus = `edge-error:${getErrorMessage(error).slice(0, 160)}`;
  }
  return [snapshotStatus, edgeStatus].filter(Boolean).join('+');
}

function durableSnapshotKey(cacheRequest: Request): string {
  const url = new URL(cacheRequest.url);
  return `diff-cockpit:json:${url.pathname}${url.search}`;
}

async function readDurableCachedJson(snapshotStore: DurableJsonSnapshotStore | null, cacheRequest: Request, clientRequest: Request): Promise<Response | null> {
  const snapshot = await readDurableCachedJsonSnapshot<unknown>(snapshotStore, cacheRequest);
  if (!snapshot?.body) return null;
  if (snapshot.etag && clientRequest.headers.get('if-none-match') === snapshot.etag) {
    return cachedJsonNotModified(snapshot.etag, clientRequest, 'snapshot', snapshot.body);
  }
  return cachedJsonBody(snapshot.body, snapshot.etag, clientRequest, 'snapshot');
}

async function readDurableCachedJsonSnapshot<T>(snapshotStore: DurableJsonSnapshotStore | null, cacheRequest: Request): Promise<CachedJsonSnapshot<T> | null> {
  if (!snapshotStore) return null;
  try {
    const raw = await snapshotStore.get(durableSnapshotKey(cacheRequest));
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as DurableCachedJson;
    if (!snapshot || snapshot.schemaVersion !== API_CACHE_SCHEMA_VERSION || typeof snapshot.body !== 'string') return null;
    const etag = snapshot.etag || makeWeakEtag(snapshot.body);
    return { data: JSON.parse(snapshot.body) as T, etag, body: snapshot.body };
  } catch {
    return null;
  }
}

async function writeDurableCachedJson(snapshotStore: DurableJsonSnapshotStore | null, cacheRequest: Request, response: Response): Promise<string> {
  if (!snapshotStore) return '';
  try {
    const body = await response.clone().text();
    const snapshot: DurableCachedJson = {
      body,
      etag: response.headers.get('etag') || makeWeakEtag(body),
      schemaVersion: API_CACHE_SCHEMA_VERSION,
      writtenAt: new Date().toISOString(),
    };
    await snapshotStore.put(durableSnapshotKey(cacheRequest), JSON.stringify(snapshot));
    return 'snapshot';
  } catch (error: unknown) {
    return `snapshot-error:${getErrorMessage(error).slice(0, 160)}`;
  }
}

async function cloneCacheableResponse(response: Response): Promise<Response> {
  const cloned = response.clone();
  const body = await cloned.text();
  const headers = new Headers(cloned.headers);
  headers.delete('vary');
  return new Response(body, {
    status: cloned.status,
    statusText: cloned.statusText,
    headers,
  });
}

function readMemoryCachedJson(cacheRequest: Request, clientRequest: Request): Response | null {
  const cached = getMemoryCachedJson(cacheRequest);
  if (!cached) return null;
  if (cached.etag && clientRequest.headers.get('if-none-match') === cached.etag) {
    return cachedJsonNotModified(cached.etag, clientRequest, 'memory', cached.body);
  }
  return cachedJsonBody(cached.body, cached.etag, clientRequest, 'memory');
}

function readMemoryCachedJsonData<T>(cacheRequest: Request): T | null {
  const snapshot = readMemoryCachedJsonSnapshot<T>(cacheRequest);
  return snapshot?.data ?? null;
}

function readMemoryCachedJsonSnapshot<T>(cacheRequest: Request): CachedJsonSnapshot<T> | null {
  const cached = getMemoryCachedJson(cacheRequest);
  if (!cached) return null;
  try {
    return { data: JSON.parse(cached.body) as T, etag: cached.etag };
  } catch {
    memoryJsonCache.delete(memoryCacheKey(cacheRequest));
    return null;
  }
}

async function writeMemoryCachedJson(cacheRequest: Request, response: Response): Promise<void> {
  try {
    if (response.status !== 200) return;
    const body = await response.clone().text();
    const etag = response.headers.get('etag') || makeWeakEtag(body);
    memoryJsonCache.set(memoryCacheKey(cacheRequest), {
      body,
      etag,
      expiresAt: Date.now() + MEMORY_JSON_CACHE_TTL_MS,
    });
  } catch {
    memoryJsonCache.delete(memoryCacheKey(cacheRequest));
  }
}

function getMemoryCachedJson(cacheRequest: Request): MemoryCachedJson | null {
  const key = memoryCacheKey(cacheRequest);
  const cached = memoryJsonCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    memoryJsonCache.delete(key);
    return null;
  }
  return cached;
}

function memoryCacheKey(request: Request): string {
  return request.url;
}

function cachedJsonBody(body: string, etag: string, request: Request, cacheSource: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      etag,
      'cache-control': apiCacheControl(request, parseJsonBody(body)),
      vary: 'Accept',
      'x-diff-cockpit-cache': cacheSource,
    },
  });
}

function cachedJsonNotModified(etag: string, request: Request, cacheSource: string, body?: string): Response {
  return new Response(null, {
    status: 304,
    headers: {
      etag,
      'cache-control': apiCacheControl(request, body ? parseJsonBody(body) : null),
      vary: 'Accept',
      'x-diff-cockpit-cache': cacheSource,
    },
  });
}

function apiCacheControl(request: Request, data?: unknown): string {
  const pathname = new URL(request.url).pathname;
  if (/^\/api\/[^/]+\/[^/]+\/pulls$/.test(pathname)) {
    return 'public, max-age=0, s-maxage=30, must-revalidate';
  }
  if (/^\/api\/[^/]+\/[^/]+\/pull\/\d+$/.test(pathname) && isHotPullReviewData(data)) {
    return 'public, max-age=0, s-maxage=30, must-revalidate';
  }
  return 'public, max-age=30, s-maxage=300, stale-while-revalidate=1800';
}

function parseJsonBody(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function isHotPullReviewData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const pull = (data as { pull?: unknown }).pull;
  if (!pull || typeof pull !== 'object') return false;
  const state = stringValue((pull as { state?: unknown }).state, '').toLowerCase();
  const updatedAt = stringValue((pull as { updatedAt?: unknown }).updatedAt, '');
  return state === 'open' || isRecentIsoDate(updatedAt);
}

function getDefaultEdgeCache(): EdgeCache | null {
  const maybeCaches = globalThis.caches as (CacheStorage & { default?: EdgeCache }) | undefined;
  return maybeCaches?.default ?? null;
}

function cachedJson(data: unknown, request: Request): Response {
  const body = JSON.stringify(data, null, 2);
  const etag = makeWeakEtag(body);
  if (request.headers.get('if-none-match') === etag) {
    return cachedJsonNotModified(etag, request, 'fresh');
  }
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      etag,
      'cache-control': apiCacheControl(request, data),
      vary: 'Accept',
      'x-diff-cockpit-cache': 'fresh',
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


function internalJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200 ? 'public, max-age=45, stale-while-revalidate=300' : 'no-store',
    },
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
:root { color-scheme: light; --paper:#f6efe4; --surface:#fff9f0; --ink:#251d17; --muted:#6f6256; --quiet:#9b8d7f; --line:#decfbc; --soft:#efe3d2; --accent:#78533d; --accent-strong:#e98262; --accent-soft:#ead5bd; --danger:#9b2d2d; --shadow:0 18px 60px rgba(55, 37, 20, .14); }
@media (prefers-color-scheme: dark) {
  :root { color-scheme: dark; --paper:#0f0f0d; --surface:#191814; --ink:#f2eee6; --muted:#b5aea2; --quiet:#7e776d; --line:#37322b; --soft:#221f1a; --accent:#f0c66d; --accent-strong:#ff8b68; --accent-soft:#352a1c; --danger:#ff9d9d; --shadow:0 28px 90px rgba(0,0,0,.42); }
}
* { box-sizing:border-box; }
html { background:var(--paper); }
html, body, button, a { -webkit-tap-highlight-color: transparent; }
body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:var(--paper); }
::selection { background:var(--accent-soft); color:var(--ink); }
a { color:inherit; text-decoration:none; }
a:hover, button:hover, .brand:hover, .post-item h3 a:hover, .footer-links a:hover { color:var(--accent-strong); text-decoration-line:underline; text-decoration-style:dotted; text-decoration-thickness:1px; text-underline-offset:4px; }
button { appearance:none; border:0; background:transparent; color:var(--ink); padding:0; font:inherit; cursor:pointer; }
button:focus:not(:focus-visible), a:focus:not(:focus-visible) { outline:none; }
button:focus-visible, a:focus-visible, .search-input:focus-visible { outline:2px solid var(--accent-strong); outline-offset:3px; }
.shell { max-width:min(1180px, calc(100vw - 48px)); margin:0 auto; padding:0 18px 32px; }
.index-shell { max-width:min(1720px, calc(100vw - 48px)); padding:0 10px 28px; }
.wiki-topbar { display:flex; align-items:center; justify-content:space-between; gap:18px; min-height:54px; border-bottom:1px solid var(--line); }
.brand { color:var(--ink); font-size:20px; font-weight:700; letter-spacing:.01em; }
.nav { display:flex; align-items:center; gap:22px; font-size:13px; }
.search-mark { font-size:26px; line-height:1; transform:translateY(-1px); }
.command-button { display:inline-flex; align-items:center; gap:8px; border:1px solid var(--line); border-radius:8px; background:var(--surface); padding:6px 9px; color:var(--muted); }
.command-button-plain { border:0; background:transparent; padding:0; color:var(--muted); }
.command-button-plain .command-shortcut { margin-left:2px; }
.command-shortcut, .command-key { font:11px/1.2 "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; border:1px solid var(--line); border-radius:6px; padding:3px 6px; background:var(--soft); color:var(--ink); }
.command-backdrop { position:fixed; inset:0; z-index:40; background:rgba(0,0,0,.36); backdrop-filter:blur(7px); }
.command-backdrop[hidden], .command-palette[hidden] { display:none; }
.command-palette { position:fixed; inset:0; z-index:41; display:grid; place-items:start center; padding:9vh 18px 18px; }
.command-panel { width:min(720px, calc(100vw - 32px)); max-height:min(760px, calc(100vh - 80px)); overflow:auto; border:1px solid var(--line); border-radius:18px; background:var(--surface); box-shadow:var(--shadow); }
.command-panel-head { display:flex; justify-content:space-between; gap:18px; padding:18px; border-bottom:1px solid var(--line); }
.command-kicker, .command-section-title { margin:0 0 6px; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
.command-panel h2 { margin:0 0 6px; font-size:30px; }
.command-caption { margin:0; color:var(--muted); font-size:13px; }
.command-close { color:var(--muted); }
.command-input-row { display:block; padding:14px 18px; border-bottom:1px solid var(--line); }
.command-input { width:100%; border:0; border-bottom:1px solid var(--line); border-radius:0; background:var(--soft); color:var(--ink); padding:14px 22px; font:inherit; font-size:15px; outline:none; }
.command-input:focus { border-bottom-color:var(--accent-strong); }
.command-section { padding:12px; border-bottom:1px solid var(--line); }
.command-list { display:grid; gap:6px; }
.command-item { width:100%; min-height:52px; display:grid; grid-template-columns:54px minmax(0,1fr); align-items:center; gap:12px; padding:9px 10px; border:1px solid transparent; border-radius:11px; text-align:left; }
.command-item:hover, .command-item:focus-visible { border-color:var(--line); background:var(--soft); text-decoration:none; }
.command-item strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:650; }
.command-item small { display:block; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--muted); }
.command-empty { padding:14px 10px; color:var(--muted); }
.command-foot { display:flex; gap:14px; justify-content:flex-end; padding:10px 14px; color:var(--quiet); font-size:12px; }
.mobile-command-fab { display:none; position:fixed; left:18px; right:auto; bottom:calc(18px + env(safe-area-inset-bottom)); z-index:35; width:56px; height:56px; align-items:center; justify-content:center; border:1px solid var(--line); border-radius:999px; background:var(--surface); box-shadow:0 12px 30px rgba(0,0,0,.3); font-weight:800; }

.code-shell { max-width:min(1180px, calc(100vw - 48px)); }
.code-hero { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; padding:46px 0 22px; border-bottom:1px solid var(--line); }
.code-hero h1 { font-size:34px; line-height:1.05; margin-bottom:8px; font-weight:700; }
.active-nav { font-weight:700; color:var(--accent); }
.history-button, .branch-pill, .path-pill { display:inline-flex; align-items:center; border:1px solid var(--line); border-radius:8px; background:var(--surface); padding:7px 10px; font-size:13px; }
.code-search-row { display:flex; align-items:center; gap:10px; margin:18px 0 0; padding:10px 12px; border:1px solid var(--line); border-radius:10px; background:var(--surface); }
.code-search-input { flex:1 1 auto; min-width:180px; }
.search-hint { color:var(--quiet); font-size:12px; white-space:nowrap; }
.file-path-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; font-weight:500; }
.file-view-actions { display:flex; align-items:center; justify-content:flex-end; gap:12px; margin-left:auto; color:var(--muted); font-size:13px; }
.copy-file-path { display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border:1px solid var(--line); border-radius:7px; background:var(--paper); color:var(--muted); }
.copy-file-path:hover { color:var(--accent); text-decoration:none; }
.file-match-count { color:var(--quiet); }
.code-browser-card { margin-top:22px; border:1px solid var(--line); border-radius:10px; background:var(--surface); overflow:hidden; }
.code-browser-toolbar { min-height:48px; display:flex; align-items:center; gap:10px; padding:8px 12px; border-bottom:1px solid var(--line); }
.code-browser-list { display:grid; }
.code-table-head, .history-table-head { min-height:38px; display:grid; grid-template-columns:minmax(160px, 1fr) 132px; gap:12px; align-items:center; padding:8px 12px; border-bottom:1px solid var(--line); color:var(--muted); font-size:13px; font-weight:600; letter-spacing:.01em; }
.code-table-head span:last-child, .history-table-head span:last-child { text-align:right; }
.code-row { min-height:44px; display:grid; grid-template-columns:28px minmax(0, 1fr) 132px; gap:10px; align-items:center; padding:9px 12px; border-bottom:1px solid var(--line); color:var(--ink); }
.code-row:last-child { border-bottom:0; }
.code-row:hover { background:var(--soft); text-decoration:none; }
.file-icon { color:var(--quiet); text-align:center; }
.code-name { font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.code-message { display:none; }
.code-date { color:var(--quiet); text-align:right; font-variant-numeric:tabular-nums; }
.history-row { min-height:58px; display:grid; grid-template-columns:28px minmax(0, 1fr); grid-template-rows:auto auto; column-gap:10px; row-gap:3px; align-items:center; padding:10px 12px; border-bottom:1px solid var(--line); color:var(--ink); }
.history-row:hover { background:var(--soft); text-decoration:none; }
.history-row .file-icon { grid-row:1 / span 2; align-self:start; padding-top:3px; }
.history-main { min-width:0; display:grid; grid-template-columns:minmax(0, 1fr) auto; gap:14px; align-items:center; }
.history-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500; }
.history-meta { grid-column:2; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.history-row .code-date { text-align:right; }
.file-view-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border-bottom:1px solid var(--line); }
.file-view { padding:18px; overflow:auto; }
.markdown-body { line-height:1.7; }
.markdown-body h1, .markdown-body h2, .markdown-body h3 { letter-spacing:-.03em; margin:0 0 16px; }
.markdown-body p { margin:0 0 14px; color:var(--ink); }
.markdown-body code { padding:1px 5px; border-radius:5px; background:var(--soft); }
.code-body pre { margin:0; font:13px/1.6 Menlo, Monaco, Consolas, "Liberation Mono", monospace; white-space:pre; }
@media (max-width: 760px) {
  .code-shell { max-width:calc(100vw - 20px); }
  .code-hero { align-items:flex-start; flex-direction:column; gap:14px; padding:34px 0 20px; }
  .code-hero h1 { font-size:32px; }
  .code-search-row { padding:9px 10px; gap:8px; }
  .search-hint { display:none; }
  .code-browser-card { margin-top:16px; border-radius:8px; }
  .code-browser-toolbar { min-height:42px; padding:7px 10px; }
  .code-table-head { grid-template-columns:minmax(0, 1fr) 116px; padding:8px 10px; }
  .code-row { grid-template-columns:24px minmax(0, 1fr) 116px; min-height:42px; padding:9px 10px; gap:8px; }
  .code-name { font-weight:500; }
  .code-date { grid-column:auto; text-align:right; }
  .history-table-head { grid-template-columns:minmax(0, 1fr) 72px; padding:8px 10px; }
  .history-row { min-height:62px; padding:10px 10px; grid-template-columns:24px minmax(0, 1fr); }
  .history-main { grid-template-columns:minmax(0, 1fr) 54px; gap:10px; }
  .history-title { white-space:nowrap; }
  .history-meta { grid-column:2; }
  .file-view { padding:14px; overflow:auto; }
}
.search-button { display:inline-flex; align-items:center; }
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
header.hero { padding:12px 0 10px; border-bottom:0; }
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
.section { margin:10px 0; padding:0; border:1px solid var(--line); border-radius:10px; background:var(--surface); overflow:hidden; }
.section summary { list-style:none; cursor:pointer; }
.section summary::-webkit-details-marker { display:none; }
.section summary h2 { display:inline; }
h2 { margin:0; font-size:17px; line-height:1.2; letter-spacing:-.02em; font-weight:650; }
.post-list { display:grid; gap:0; margin-top:0; border-top:1px solid var(--line); }
.post-list .post-item:last-child { border-bottom:0; }
.pr-section summary { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:10px 14px; }
.section-count { color:var(--quiet); font-size:16px; }
button.section-count { cursor:pointer; }
.post-item { display:grid; grid-template-columns:minmax(0, 1fr) minmax(260px, auto); gap:18px; min-height:44px; padding:8px 14px; border-bottom:1px solid var(--line); align-items:center; }
.pr-row { grid-template-columns:32px minmax(0, 1fr) minmax(260px, auto); gap:12px; }
.index-page .post-item[data-card-route] { cursor:pointer; }
.post-item:hover { background:var(--soft); }
.post-item h3 { margin:0; font-size:15px; line-height:1.35; letter-spacing:-.01em; font-weight:500; }
.post-meta { color:var(--quiet); font-size:13px; line-height:1.35; }
.post-item p { margin:0; color:var(--quiet); font-size:13px; line-height:1.55; overflow-wrap:anywhere; }
.pr-author-avatar { width:32px; height:32px; border-radius:999px; object-fit:cover; background:var(--surface); box-shadow:0 0 0 1px var(--line); }
.pr-author-avatar-fallback { display:grid; place-items:center; color:var(--muted); font-size:11px; font-weight:700; letter-spacing:.02em; }
.pr-row-main { min-width:0; display:grid; gap:2px; }
.pr-title-line { display:flex; align-items:baseline; gap:10px; min-width:0; flex-wrap:wrap; }
.pr-title-line a { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pr-title-meta { color:var(--quiet); font-size:12px; font-weight:400; white-space:nowrap; }
.pr-file-chip, .pr-avatar, .mobile-pr-table-head, .pr-author, .pr-author-sep, .pr-mobile-meta, .pr-mobile-files { display:none; }
.pr-subtitle { display:flex; align-items:center; gap:7px; min-width:0; color:var(--muted); font-size:13px; }
.pr-subtitle span { white-space:nowrap; }
.pr-row-side { display:grid; grid-template-columns:auto 120px 54px; align-items:center; justify-content:end; gap:12px; color:var(--quiet); font-size:13px; white-space:nowrap; min-width:220px; }
.status-set { display:inline-flex; align-items:center; gap:6px; }
.pr-delta { min-width:112px; text-align:right; color:var(--quiet); font-variant-numeric:tabular-nums; }
.pr-updated { min-width:42px; text-align:right; color:var(--quiet); font-variant-numeric:tabular-nums; }
.mergeability-icon, .review-icon, .check-icon { display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border:1px solid var(--line); border-radius:999px; font-size:11px; flex:0 0 auto; }
.mergeability-icon:empty, .review-icon:empty, .check-icon:empty { display:none; }
.mergeability-icon.mergeability-mergeable { color:#1f7a3a; border-color:#1f7a3a; }
.mergeability-icon.mergeability-conflicts { color:#ef4444; border-color:#ef4444; }
.mergeability-icon.mergeability-merged { color:#6f4bd8; }
.mergeability-icon.mergeability-draft, .mergeability-icon.mergeability-closed, .mergeability-icon.mergeability-unknown { color:var(--quiet); }
.stream-chip { color:var(--accent); text-decoration-line:underline; text-decoration-style:dotted; text-underline-offset:4px; }
.stream-dot-button { display:inline-flex; align-items:center; gap:4px; }
.stream-compact-button { display:inline-flex; align-items:center; min-width:0; }
.stream-dot { color:var(--accent); font-size:16px; line-height:1; }
.load-more-button { color:var(--muted); }
.stream-filter-row { display:flex; align-items:center; gap:9px; margin-top:14px; flex-wrap:wrap; font-size:14px; }
.stream-filter-row[hidden] { display:none; }
.post-item[hidden] { display:none; }
.empty, .muted { color:var(--quiet); }
mark { background:var(--accent-soft); color:var(--ink); }
.section-pager { display:flex; align-items:center; justify-content:center; gap:10px; padding:8px 14px; border-top:1px solid var(--line); color:var(--quiet); font-size:13px; }
.page-status { color:var(--quiet); }
.page-button[disabled] { color:var(--quiet); cursor:default; text-decoration:none; }
footer { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:24px 0 0; color:var(--muted); font-size:13px; }
.footer-links { display:flex; gap:10px; }
.review-page { overflow:hidden; --file-pane-width:460px; }

.review-page .topbar, .review-page .review-topbar, .review-page .links, .review-page .file-pane, .review-page .pane-heading, .review-page .tree-root, .review-page .tree-node, .review-page .directory-toggle, .review-page .tree-label, .review-page .tree-stats, .review-page .selected-file, .review-page .diff-file-header, .review-page .diff-file-path, .review-page .diff-file-stats, .review-page .inline-comment, .review-page .comment-card, .review-page .commit-popover, .review-page .review-drawer { font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.review-page .diff-fallback, .review-page .code-body pre, .review-page .comment-body pre, .review-page .comment-body code { font-family:Menlo, Monaco, Consolas, "Liberation Mono", monospace; -webkit-font-smoothing:antialiased; text-rendering:geometricPrecision; }
.topbar { height:76px; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 18px; border-bottom:1px solid var(--line); background:var(--paper); }
.eyebrow { margin:0 0 4px; font-size:12px; color:var(--quiet); text-transform:uppercase; letter-spacing:.08em; }
.review-topbar h1 { margin:0; font-size:18px; line-height:1.2; letter-spacing:-.02em; }
#pr-meta { margin:4px 0 0; font-size:13px; }
.links { display:flex; align-items:center; gap:12px; white-space:nowrap; font-size:13px; }
.nav-status-button { color:var(--muted); }
.nav-status-button[data-status="mergeable"] { color:#2f7d46; }
.nav-status-button[data-status="unmergeable"] { color:#ef4444; }
  .layout { height:calc(100dvh - 76px); display:grid; grid-template-columns:var(--file-pane-width) 5px minmax(0, 1fr); position:relative; overflow:hidden; border-top:1px solid var(--line); }
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
.tree-children { margin-left:14px; padding-left:10px; border-left:1px solid var(--line); }
.tree-branch { position:relative; }
.tree-branch::before { content:""; position:absolute; left:0; top:0; bottom:0; border-left:1px solid transparent; }
.tree-branch .tree-branch::before { border-left-color:var(--line); }
.tree-depth-0 { --tree-depth:0; }
.tree-depth-1 { --tree-depth:1; }
.tree-depth-2 { --tree-depth:2; }
.tree-depth-3 { --tree-depth:3; }
.directory-toggle { display:flex; align-items:center; gap:6px; width:100%; text-align:left; padding:5px 8px; color:var(--ink); }
.tree-twist { color:var(--quiet); width:12px; text-align:center; }
.status { color:var(--quiet); font-size:12px; margin-right:5px; }
.review-pane { min-width:0; overflow-y:auto; overflow-x:hidden; background:var(--paper); overscroll-behavior:contain; }
.selected-file { position:sticky; top:0; z-index:1; padding:12px 16px; border-bottom:1px solid var(--line); background:var(--paper); font-size:13px; color:var(--muted); overflow-wrap:anywhere; }
.diff-root { padding:0; max-width:100%; overflow-x:hidden; }
.diff-file { border-bottom:1px solid var(--line); scroll-margin-top:46px; }
.diff-file-header { position:sticky; top:39px; z-index:1; display:flex; align-items:center; justify-content:space-between; gap:14px; padding:9px 14px; border-bottom:1px solid var(--line); background:var(--paper); color:var(--muted); font-size:13px; }
.diff-file-path { color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.diff-file-stats { color:var(--quiet); white-space:nowrap; }
.diff-fallback { margin:0; padding:0 0 18px; background:transparent; overflow:visible; max-width:100%; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word; font:13px/1.58 Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
.diff-line { min-height:20px; display:grid; grid-template-columns:42px 42px minmax(0, 1fr); align-items:start; padding:0 8px 0 0; white-space:normal; max-width:100%; }
.diff-gutter { color:var(--quiet); text-align:right; padding-right:5px; user-select:none; font-variant-numeric:tabular-nums; }
.diff-code { min-width:0; overflow:visible; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word; }
body[data-current-view="current"] .diff-line.del { display:none; }
body[data-comments-visible="false"] .inline-comment { display:none; }
.inline-comment { margin:6px 12px 10px 84px; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:var(--surface); font-size:13px; }
.diff-line.add { background:rgba(31, 136, 61, .18); }
.diff-line.del { background:rgba(248, 81, 73, .18); }
.diff-line.hunk { color:var(--quiet); background:var(--soft); }
.mobile-files-toggle { display:none; position:fixed; left:18px; bottom:18px; z-index:11; width:54px; height:54px; align-items:center; justify-content:center; border-radius:999px; border:1px solid var(--line); background:var(--surface); box-shadow:0 12px 30px rgba(0,0,0,.28); font-size:22px; }
.mobile-file-backdrop { display:none; }
.ai-comments-sidebar { position:absolute; top:0; right:0; width:min(380px, 36vw); height:100%; transform:translateX(0); transition:transform .16s ease; border-left:1px solid var(--line); background:var(--paper); z-index:4; overflow:auto; }
body[data-ai-sidebar="closed"] .ai-comments-sidebar { transform:translateX(100%); }
body[data-ai-sidebar="open"] .review-pane { margin-right:min(380px, 36vw); }
.ai-comments-head { position:sticky; top:0; z-index:2; display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding:14px; border-bottom:1px solid var(--line); background:var(--paper); }
.ai-comments-head p { margin:4px 0 0; font-size:12px; }
.ai-comments-content { display:grid; gap:8px; padding:10px; }
.ai-review-card { border:1px solid var(--line); border-radius:12px; background:var(--surface); overflow:hidden; }
.ai-review-card.is-resolved { opacity:.68; }
.ai-review-summary { width:100%; display:grid; grid-template-columns:auto minmax(0, 1fr) auto auto; gap:8px; align-items:start; padding:10px; text-align:left; }
.ai-review-main { min-width:0; display:grid; gap:3px; }
.ai-review-main strong, .ai-review-main span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ai-review-main span { color:var(--muted); font-size:12px; }
.ai-review-expanded { border-top:1px solid var(--line); padding:10px; display:grid; gap:10px; }
.ai-review-actions { display:flex; flex-wrap:wrap; gap:6px; }
.ai-review-action { display:inline-flex; align-items:center; min-height:28px; border:1px solid var(--line); border-radius:999px; padding:4px 9px; color:var(--muted); background:var(--paper); font-size:12px; }
@media (max-width: 1120px) { body[data-ai-sidebar="open"] .review-pane { margin-right:0; } .ai-comments-sidebar { width:min(420px, 92vw); z-index:6; box-shadow:-18px 0 45px rgba(0,0,0,.22); } }
.review-drawer { position:absolute; top:0; right:0; width:min(480px, 92vw); height:100%; transform:translateX(100%); transition:transform .16s ease; background:var(--surface); border-left:1px solid var(--line); box-shadow:-18px 0 45px rgba(0, 0, 0, .22); z-index:5; overflow:auto; }
body[data-review-drawer="open"] .review-drawer { transform:translateX(0); }
.drawer-head { position:sticky; top:0; z-index:2; display:flex; justify-content:space-between; align-items:center; padding:14px; border-bottom:1px solid var(--line); background:var(--surface); }
.drawer-content { padding:14px; display:grid; gap:10px; }
.action-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; }
.action-button { display:flex; justify-content:center; align-items:center; min-height:38px; border:1px solid var(--line); border-radius:10px; background:var(--paper); }
.drawer-section { border:1px solid var(--line); border-radius:12px; background:var(--paper); overflow:hidden; }
.drawer-section-head { border-bottom:1px solid var(--line); background:var(--surface); }
.drawer-section-toggle { width:100%; min-height:40px; display:grid; grid-template-columns:minmax(0, 1fr) auto auto; align-items:center; gap:8px; padding:9px 12px; text-align:left; font-size:13px; font-weight:650; }
.drawer-section-state { color:var(--quiet); font-size:11px; font-weight:500; text-transform:uppercase; letter-spacing:.05em; }
.drawer-section-caret { color:var(--quiet); font-size:14px; }
.drawer-section-body { display:grid; gap:0; }
.comment-card, .commit-card { padding:10px 12px; border-top:1px solid var(--line); }
.drawer-section-body > .comment-card:first-child, .drawer-section-body > .commit-card:first-child { border-top:0; }
.review-summary-card { display:flex; flex-wrap:wrap; gap:6px; }
.summary-chip { margin-right:0; cursor:pointer; }
.prompt-preview { max-height:360px; overflow:auto; }
.comment-body h1, .comment-body h2, .comment-body h3 { margin:10px 0 6px; font-size:14px; line-height:1.25; }
.comment-body p, .comment-body ul, .comment-body ol, .comment-body blockquote { margin:0 0 8px; }
.comment-body ul, .comment-body ol { padding-left:20px; }
.comment-body blockquote { border-left:3px solid var(--line); padding-left:10px; color:var(--muted); }
.comment-body pre { margin:8px 0; padding:10px; overflow:auto; white-space:pre-wrap; }
.markdown-details { margin:8px 0; border:1px solid var(--line); border-radius:8px; background:var(--surface); }
.markdown-details summary { padding:8px 10px; cursor:pointer; font-weight:650; }
.commit-popover { position:fixed; right:16px; top:54px; z-index:20; width:min(520px, calc(100vw - 32px)); max-height:min(620px, calc(100vh - 72px)); overflow:auto; border:1px solid var(--line); border-radius:14px; background:var(--surface); box-shadow:0 18px 50px rgba(0,0,0,.24); }
.commit-popover[hidden] { display:none; }
.commit-popover-head { position:sticky; top:0; z-index:1; display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 14px; border-bottom:1px solid var(--line); background:var(--surface); }
.commit-popover-list { display:grid; }
.commit-title { margin:0 0 4px; font-weight:650; }
.commit-delta { color:var(--quiet); }
.comment-meta, .commit-meta { color:var(--quiet); font-size:12px; margin-bottom:5px; }
.comment-body { font-size:13px; line-height:1.5; }
.comment-body pre, .comment-body code { font-family:Menlo, Monaco, Consolas, monospace; background:var(--soft); border-radius:4px; padding:1px 4px; }
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
  .pr-row { grid-template-columns:28px minmax(0, 1fr); gap:10px; }
  .pr-author-avatar { width:28px; height:28px; }
  .pr-row-side { grid-template-columns:auto auto auto; justify-content:flex-start; flex-wrap:wrap; min-width:0; }
  .command-button { display:none; }
  .mobile-command-fab { display:flex; }
  .index-shell { max-width:calc(100vw - 36px); padding:0 0 calc(92px + env(safe-area-inset-bottom)); }
  .index-page .wiki-topbar { min-height:0; align-items:flex-start; flex-direction:row; padding:36px 2px 28px; border-bottom:0; }
  .index-page .brand { font-size:34px; line-height:1.05; font-weight:800; letter-spacing:-.04em; }
  .index-page .nav, .index-page header.hero, .index-page .filter-row, .index-page .stream-filter-row { display:none; }
  .index-page .section { margin:0 0 38px; border:0; background:transparent; overflow:visible; }
  .index-page .pr-section summary { padding:0 2px 14px; }
  .index-page .pr-section summary h2 { display:block; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; font-size:15px; font-weight:800; }
  .index-page .section-count { font-size:15px; font-weight:700; color:var(--muted); }
  .index-page .post-list { border-top:0; gap:10px; }
  .index-page .post-item { position:relative; grid-template-columns:28px minmax(0,1fr) auto; min-height:112px; gap:8px 10px; padding:20px 52px 20px 52px; border:1px solid var(--line); border-radius:14px; background:var(--surface); }
  .index-page .post-item::before { content:""; position:absolute; left:24px; top:29px; width:10px; height:10px; border-radius:999px; background:#ff6257; box-shadow:0 0 14px rgba(255,98,87,.45); }
  .index-page .post-item[data-state="merged"]::before { background:#8b5cf6; box-shadow:0 0 14px rgba(139,92,246,.42); }
  .index-page .post-item[data-state="draft"]::before, .index-page .post-item[data-state="closed"]::before { background:var(--quiet); box-shadow:none; }
  .index-page .post-item::after { content:"›"; position:absolute; right:24px; top:50%; transform:translateY(-50%); color:var(--muted); font-size:42px; line-height:1; }
  .index-page .post-item h3 { font-size:19px; font-weight:650; line-height:1.25; }
  .index-page .pr-title-line { align-items:center; gap:10px; flex-wrap:nowrap; }
  .index-page .pr-title-line a { flex:0 1 auto; }
  .index-page .pr-file-chip { display:inline-flex; align-items:center; border:1px solid var(--line); border-radius:8px; padding:2px 8px; background:var(--soft); color:var(--muted); font-size:13px; font-weight:650; }
  .index-page .pr-subtitle { margin-top:2px; gap:8px; font-size:15px; overflow:hidden; white-space:nowrap; }
  .index-page .post-item[data-kind="stream"] .stream-compact-button, .index-page .post-item[data-kind="stream"] .pr-subtitle-stream-separator { display:none; }
  .index-page .pr-subtitle-file-separator, .index-page .pr-subtitle-file-count { display:none; }
  .index-page .stream-compact-button { max-width:168px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border:1px solid var(--line); border-radius:7px; padding:2px 7px; color:var(--muted); background:rgba(255,255,255,.03); }
  .index-page .pr-row-side { display:flex; align-items:center; gap:14px; margin-top:8px; color:var(--muted); font-size:15px; }
  .index-page .status-set { display:none; }
  .index-page .pr-delta, .index-page .pr-updated { min-width:0; text-align:left; }
  .index-page .pr-delta::after { content:"•"; margin-left:14px; color:var(--quiet); }
  .index-page .section-pager { border-top:0; padding:14px 0 0; }
  .command-palette { align-items:end; place-items:end center; padding:0; }
  .command-panel { width:100%; max-height:min(82vh, 720px); border-radius:18px 18px 0 0; border-left:0; border-right:0; border-bottom:0; }
  .command-panel-head { padding:16px; }
  .command-panel h2 { font-size:24px; }
  .topbar { height:auto; min-height:92px; align-items:flex-start; flex-direction:column; }
  .layout { height:calc(100dvh - 132px); grid-template-columns:minmax(0, 1fr); }
  .file-pane-resizer { display:none; }
  .file-pane { position:fixed; left:0; right:0; bottom:0; top:86px; z-index:9; transform:translateY(100%); transition:transform .18s ease; border-right:0; border-top:1px solid var(--line); border-radius:18px 18px 0 0; box-shadow:0 -22px 50px rgba(0,0,0,.36); background:var(--paper); font-size:16px; }
  body[data-file-pane-drawer="open"] .file-pane { transform:translateY(0); }
  .pane-heading { padding:18px 20px 12px; font-size:20px; }
  .tree-root { padding:14px 18px 28px; }
  .tree-node, .directory-toggle { min-height:42px; font-size:17px; }
  .diff-line { grid-template-columns:34px 34px minmax(0, 1fr); padding:0 6px 0 0; }
  .diff-gutter { padding-right:4px; }
  .inline-comment { margin-left:68px; }
  .mobile-files-toggle { display:flex; }
  body[data-file-pane-drawer="open"] .mobile-files-toggle { background:var(--ink); color:var(--paper); }
  .mobile-file-backdrop { display:none; position:fixed; inset:0; z-index:8; background:rgba(0,0,0,.35); }
  body[data-file-pane-drawer="open"] .mobile-file-backdrop { display:block; }

@media (max-width: 760px) {
  .index-shell{max-width:calc(100vw - 28px);padding:0 0 calc(92px + env(safe-area-inset-bottom));}
  .index-page .wiki-topbar{padding:36px 2px 32px;border-bottom:0;min-height:0;}
  .index-page .brand{font-size:30px;line-height:1.08;font-weight:800;letter-spacing:-.035em;}
  .index-page .nav,.index-page header.hero,.index-page .filter-row,.index-page .stream-filter-row{display:none;}
  .index-page .section{margin:0 0 18px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.035);overflow:hidden;}
  .index-page .pr-section summary{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;min-height:48px;padding:9px 14px;border-bottom:1px solid var(--line);list-style:none;}
  
  
  
  .index-page .pr-section summary h2{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink);text-transform:none;letter-spacing:-.01em;font-size:19px;font-weight:400;}
  .index-page .section-count{font-size:19px;font-weight:400;color:var(--muted);}
  .index-page .post-list{border-top:0;gap:0;}
  
  .index-page .post-item{display:grid;grid-template-columns:28px minmax(0,1fr) auto;grid-template-rows:auto auto;column-gap:10px;row-gap:4px;align-items:center;min-height:68px;padding:11px 14px;border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent;}
  .index-page .post-item:last-child{border-bottom:0;}
  .index-page .post-item:hover{background:rgba(255,255,255,.035);}
  
  
  
  .index-page .post-item:before,.index-page .post-item:after{content:none;}
  .index-page .pr-author-avatar{grid-column:1;grid-row:1 / span 2;align-self:center;}
  .index-page .pr-row-main{grid-column:2;grid-row:1 / span 2;min-width:0;gap:2px;}
  .index-page .post-item h3{font-size:15px;font-weight:400;line-height:1.22;letter-spacing:0;}
  .index-page .pr-title-line{align-items:center;gap:8px;flex-wrap:nowrap;}
  .index-page .pr-title-line a{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-decoration:none;}
  .index-page .pr-file-chip{display:none;}
  .index-page .pr-subtitle{margin-top:2px;gap:6px;min-width:0;overflow:hidden;color:var(--muted);font-size:13px;line-height:1.25;white-space:nowrap;}
  .index-page .stream-compact-button,.index-page .pr-subtitle-stream-separator,.index-page .pr-subtitle-repo,.index-page .pr-subtitle-file-count,.index-page .pr-subtitle-file-separator{display:none;}
  .index-page .pr-mobile-meta{display:inline;min-width:0;overflow:hidden;text-overflow:ellipsis;}
  .index-page .pr-row-side{grid-column:3;grid-row:1 / span 2;display:grid;grid-template-columns:auto auto;grid-template-rows:auto auto;gap:4px 8px;align-items:center;justify-content:end;min-width:86px;color:var(--muted);font-size:13px;}
  .index-page .status-set{grid-column:1 / span 2;grid-row:2;display:flex;justify-content:flex-end;gap:0;}
  .index-page .mergeability-icon{width:21px;height:21px;border-radius:999px;border:1px solid var(--line);font-size:12px;font-weight:700;} .index-page .review-icon,.index-page .check-icon{display:none;}
  .index-page .mergeability-icon.mergeability-mergeable{border-color:#2f7d46;background:#2f7d46;color:#07110a;}
  .index-page .mergeability-icon.mergeability-conflicts{border-color:#ef4444;color:#ef4444;background:transparent;}
  .index-page .mergeability-icon:empty{display:inline-flex;}
  .index-page .mergeability-icon:empty:before{content:"-";color:var(--quiet);font-weight:500;}
  .index-page .pr-delta{display:none;}
  .index-page .pr-updated{grid-column:2;grid-row:1;min-width:0;text-align:right;color:var(--muted);font-variant-numeric:tabular-nums;}
  .index-page .pr-mobile-files{display:inline;grid-column:1;grid-row:1;text-align:right;color:var(--muted);font-variant-numeric:tabular-nums;}
}

@media (max-width: 760px) {
  .index-page .post-item::before, .index-page .post-item::after, .index-page .post-item:before, .index-page .post-item:after { content:none !important; display:none !important; }
  .index-page .review-icon, .index-page .check-icon { display:none !important; }
  .index-page .status-set { gap:0 !important; }
  .index-page .mergeability-icon.mergeability-conflicts { border-color:#ef4444 !important; color:#ef4444 !important; background:transparent !important; }
  .index-page .mergeability-icon.mergeability-mergeable { border-color:#2f7d46 !important; background:#2f7d46 !important; color:#07110a !important; }
}

@media (max-width: 760px) {
  .index-page .post-item::before, .index-page .post-item::after, .index-page .post-item:before, .index-page .post-item:after { content:none !important; display:none !important; }
  .index-page .review-icon, .index-page .check-icon { display:none !important; }
  .index-page .status-set { gap:0 !important; }
  .index-page .mergeability-icon.mergeability-conflicts { border-color:#ef4444 !important; color:#ef4444 !important; background:transparent !important; }
  .index-page .mergeability-icon.mergeability-mergeable { border-color:#2f7d46 !important; background:#2f7d46 !important; color:#07110a !important; }
}
}
`;
}



function renderCodeBrowserClientScript(apiPath: string): string {
  return `
const root = document.querySelector('[data-code-browser-root]');
const searchInput = document.querySelector('#code-search');
const apiPath = '${escapeJs(apiPath)}';
const state = { data: null, search: '' };
setupSearch();
loadCodeBrowser();
function loadCodeBrowser() {
  fetch(apiPath, { cache: 'no-cache' })
    .then((response) => { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then((data) => { state.data = data; renderCode(); })
    .catch((error) => { root.innerHTML = '<div class="code-row error">Failed to load code browser: ' + escapeHtml(String(error && error.message || error)) + '</div>'; });
}
function setupSearch() {
  if (searchInput) {
    searchInput.addEventListener('input', () => { state.search = String(searchInput.value || '').trim().toLowerCase(); renderCode(); });
  }
  document.addEventListener('keydown', (event) => {
    const tag = String(event.target && event.target.tagName || '').toLowerCase();
    if (event.key === '/' && tag !== 'input' && tag !== 'textarea' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      focusSearch();
    }
  });
}
function focusSearch() {
  if (!searchInput) return;
  searchInput.focus();
  searchInput.select();
}
function renderCode() {
  const data = state.data;
  if (!data) return;
  const count = root.querySelector('[data-commit-count]');
  if (count) count.textContent = (data.commitCount || 0).toLocaleString() + ' commits';
  const list = root.querySelector('.code-browser-list');
  if (data.file) {
    const query = state.search;
    const text = String(data.file.text || '');
    const matchCount = query ? (text.toLowerCase().split(query).length - 1) : 0;
    const matchLabel = query ? '<span class="file-match-count">' + matchCount + ' matches</span>' : '';
    list.innerHTML = '<div class="file-view-header"><span class="file-path-label">' + escapeHtml(data.file.path) + '</span><div class="file-view-actions">' + matchLabel + '<a href="' + escapeAttribute(data.historyUrl) + '">History</a><button class="copy-file-path" type="button" data-copy-path="' + escapeAttribute(data.file.path) + '" title="Copy file path">⧉</button></div></div><div class="file-view ' + (data.file.isMarkdown ? 'markdown-body' : 'code-body') + '">' + data.file.renderedHtml + '</div>';
    bindCopyButtons();
    return;
  }
  const entries = filterEntries(data.entries || [], state.search);
  list.innerHTML = '<div class="code-table-head" data-pagefind-ignore><span>Name</span><span>Last commit date</span></div>' + (entries.map((entry) => '<a class="code-row" href="' + escapeAttribute(entry.treeUrl) + '"><span class="file-icon">' + (entry.type === 'dir' ? '📁' : '📄') + '</span><span class="code-name">' + escapeHtml(entry.name) + '</span><span class="code-message">' + escapeHtml(entry.latestCommitMessage || '') + '</span><time class="code-date" datetime="' + escapeAttribute(entry.latestCommitDate || '') + '">' + relativeTime(entry.latestCommitDate) + '</time></a>').join('') || '<div class="code-row muted">' + (state.search ? 'No files match "' + escapeHtml(state.search) + '".' : 'No files found.') + '</div>');
}
function filterEntries(entries, query) {
  if (!query) return entries;
  return entries.filter((entry) => [entry.name, entry.path, entry.latestCommitMessage, entry.latestCommitAuthor].some((value) => String(value || '').toLowerCase().includes(query)));
}
function bindCopyButtons() {
  root.querySelectorAll('[data-copy-path]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const path = button.getAttribute('data-copy-path') || '';
      const markCopied = () => { button.textContent = 'Copied'; window.setTimeout(() => { button.textContent = '⧉'; }, 1200); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(path).then(markCopied, () => { button.textContent = path; });
      } else {
        button.textContent = path;
      }
    });
  });
}
function relativeTime(value) {
  if (!value) return '';
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(delta / 60000));
  if (minutes < 60) return minutes + 'm';
  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours + 'h';
  return Math.round(hours / 24) + 'd';
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]); }
function escapeAttribute(value) { return escapeHtml(value); }
`;
}

function renderCodeHistoryClientScript(apiPath: string): string {
  return `
const root = document.querySelector('[data-code-history-root]');
const apiPath = '${escapeJs(apiPath)}';
loadHistory();
function loadHistory() {
  fetch(apiPath, { cache: 'no-cache' })
    .then((response) => { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(renderHistory)
    .catch((error) => { root.innerHTML = '<div class="code-row error">Failed to load history: ' + escapeHtml(String(error && error.message || error)) + '</div>'; });
}
function renderHistory(data) {
  const list = root.querySelector('.code-browser-list');
  list.innerHTML = '<div class="history-table-head" data-pagefind-ignore><span>Commit</span><span>Time</span></div>' + ((data.commits || []).map((commit) => '<a class="history-row" href="' + escapeAttribute(commit.treeUrl) + '"><span class="file-icon">◆</span><span class="history-main"><span class="history-title">' + escapeHtml(commit.message) + '</span><time class="code-date" datetime="' + escapeAttribute(commit.committedAt || '') + '">' + relativeTime(commit.committedAt) + '</time></span><span class="history-meta">' + escapeHtml(commit.author) + ' · ' + escapeHtml(commit.shortSha) + '</span></a>').join('') || '<div class="code-row muted">No commits found.</div>');
}
function relativeTime(value) {
  if (!value) return '';
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(delta / 60000));
  if (minutes < 60) return minutes + 'm';
  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours + 'h';
  return Math.round(hours / 24) + 'd';
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]); }
function escapeAttribute(value) { return escapeHtml(value); }
`;
}

function renderIndexClientScript(apiPath: string, repo: RepoLocator): string {
  const routePrefix = `/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/pull/`;
  const repoLabel = `${repo.owner}/${repo.repo}`;
  return `
const apiPath = ${JSON.stringify(apiPath)};
const routePrefix = ${JSON.stringify(routePrefix)};
const repoLabel = ${JSON.stringify(repoLabel)};
const cacheSchemaVersion = 'v4-mergeability-live';
const cacheKey = 'diff-cockpit:index:' + cacheSchemaVersion + ':' + apiPath;
const staleCachePrefix = 'diff-cockpit:index:';
const sectionPageSize = 10;
let pulls = [];
let activeFilter = 'all';
let activeQuery = '';
let activeStream = '';
let showAllStreams = false;
const sectionLimits = {};
const sectionsRoot = document.querySelector('[data-sections-root]');
const streamRow = document.querySelector('[data-stream-filter-row]');
const streamLabel = document.querySelector('[data-stream-filter-label]');
const clearStream = document.querySelector('[data-clear-stream]');
const commandPalette = document.querySelector('[data-command-palette]');
const commandBackdrop = document.querySelector('[data-command-backdrop]');
const commandInput = document.querySelector('#diff-command-input');
const commandResults = document.querySelector('[data-command-results]');
const commandPages = document.querySelector('[data-command-pages]');
const commandTriggers = Array.from(document.querySelectorAll('[data-command-trigger]'));
const commandClose = document.querySelector('[data-command-close]');
const pageCommandItems = Array.from(document.querySelectorAll('[data-command-page]'));
const escapeText = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const openPull = (route) => { window.location.href = route; };
const kindMatchesFilter = (pull) => activeFilter === 'all' || pull.kind === activeFilter || (activeFilter === 'failing' && pull.mergeability === 'conflicts') || (activeFilter === 'open' && pull.lifecycleStatus === 'open') || (activeFilter === 'draft' && pull.lifecycleStatus === 'draft');
const queryMatchesPull = (pull) => !activeQuery.trim() || scorePullRequestSearchValue(pull, activeQuery) > 0;
function visiblePulls() { return pulls.filter((pull) => kindMatchesFilter(pull) && queryMatchesPull(pull) && (!activeStream || pull.associatedStream === activeStream)); }
function groupSections(source) {
  return [
    { id: 'streams', title: 'Streams', pulls: source.filter((pull) => pull.kind === 'stream' && (showAllStreams || pull.lifecycleStatus === 'open' || pull.lifecycleStatus === 'draft')) },
    { id: 'recently-merged', title: 'Merging and recently merged', pulls: source.filter((pull) => pull.lifecycleStatus === 'merged') },
    { id: 'open', title: 'Open', pulls: source.filter((pull) => pull.kind !== 'stream' && (pull.lifecycleStatus === 'open' || pull.lifecycleStatus === 'draft')) },
    { id: 'closed', title: 'Closed', pulls: source.filter((pull) => pull.lifecycleStatus === 'closed') },
  ].filter((section) => section.pulls.length > 0);
}
function normalizeSearchValue(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function splitSearchTokens(value) { return String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); }
function isSearchSubsequence(needle, haystack) { let index = 0; for (const char of needle) { index = haystack.indexOf(char, index); if (index === -1) return false; index += 1; } return Boolean(needle); }
function scoreSearchValue(value, rawQuery, compactQuery, tokens, weight) {
  if (!value) return 0;
  const lowerValue = String(value).toLowerCase();
  const compactValue = normalizeSearchValue(value);
  const fieldTokens = splitSearchTokens(value);
  let score = 0;
  if (rawQuery && lowerValue.includes(rawQuery)) score += 20 * weight;
  if (compactQuery && compactValue.includes(compactQuery)) score += 14 * weight;
  for (const token of tokens) {
    if (fieldTokens.some((fieldToken) => fieldToken.startsWith(token))) score += 5 * weight;
    else if (compactValue.includes(token)) score += 2 * weight;
    else if (isSearchSubsequence(token, compactValue)) score += weight;
  }
  if (compactQuery && isSearchSubsequence(compactQuery, compactValue)) score += weight;
  return score;
}
function scorePullRequestSearchValue(pull, query) {
  const rawQuery = String(query || '').trim().toLowerCase();
  const compactQuery = normalizeSearchValue(rawQuery);
  const tokens = splitSearchTokens(rawQuery);
  if (!rawQuery || (!compactQuery && !tokens.length)) return 1;
  return [
    { value: pull.title, weight: 10 }, { value: pull.headRef, weight: 8 }, { value: pull.associatedStream, weight: 7 },
    { value: repoLabel, weight: 6 }, { value: String(pull.number || ''), weight: 6 }, { value: pull.baseRef, weight: 4 }, { value: pull.kind, weight: 3 },
  ].reduce((score, field) => score + scoreSearchValue(field.value, rawQuery, compactQuery, tokens, field.weight), 0);
}
function mergeabilityIcon(status) { if (status === 'mergeable') return '✓'; if (status === 'conflicts') return '×'; if (status === 'merged') return '◆'; if (status === 'draft') return '◌'; if (status === 'closed') return '○'; return ''; }
function reviewIcon(status) { if (status === 'approved') return '✓'; if (status === 'changes_requested') return '×'; if (status === 'commented') return '◌'; if (status === 'none') return '○'; return ''; }
function checkIcon(status) { if (status === 'success') return '✓'; if (status === 'failure') return '×'; if (status === 'pending') return '◌'; return ''; }
function formatDelta(pull) { return '+' + Number(pull.additions || 0).toLocaleString() + ' −' + Number(pull.deletions || 0).toLocaleString(); }
function formatFileCount(count) { const value = Number(count || 0); const label = value === 1 ? 'file' : 'files'; return value.toLocaleString() + ' ' + label; }
function relativeTime(value) { const date = new Date(value); if (Number.isNaN(date.getTime())) return 'live'; const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000)); if (seconds < 60) return seconds + 's'; const minutes = Math.round(seconds / 60); if (minutes < 60) return minutes + 'm'; const hours = Math.round(minutes / 60); return hours < 48 ? hours + 'h' : Math.round(hours / 24) + 'd'; }
function renderCard(pull) {
  const route = routePrefix + pull.number;
  const stream = pull.associatedStream || pull.baseRef || 'No stream';
  const fileCount = formatFileCount(pull.changedFiles);
  const mobileMeta = '#' + pull.number + ' ' + stream;
  const subtitleText = stream + ' • ' + repoLabel + ' #' + pull.number + ' • ' + fileCount;
  return '<article class="post-item pr-row" role="link" tabindex="0" data-card-route="' + escapeText(route) + '" data-kind="' + escapeText(pull.kind) + '" data-state="' + escapeText(pull.lifecycleStatus) + '">' +
    renderAuthorAvatar(pull) +
    '<div class="pr-row-main"><h3 class="pr-title-line"><a href="' + escapeText(route) + '" data-pr-route="' + escapeText(route) + '">' + escapeText(pull.title) + '</a><span class="pr-title-meta pr-file-chip">' + escapeText(fileCount) + '</span></h3>' +
    '<p class="pr-subtitle" aria-label="' + escapeText(subtitleText) + '"><button class="stream-chip stream-compact-button" type="button" data-stream-filter="' + escapeText(stream) + '" title="Show stream task sessions">' + escapeText(stream) + '</button><span class="pr-subtitle-stream-separator" aria-hidden="true">•</span><span class="pr-subtitle-repo">' + escapeText(repoLabel) + ' #' + escapeText(pull.number) + '</span><span class="pr-mobile-meta">' + escapeText(mobileMeta) + '</span><span class="pr-subtitle-file-separator" aria-hidden="true">•</span><span class="pr-subtitle-file-count">' + escapeText(fileCount) + '</span></p></div>' +
    '<div class="pr-row-side"><span class="status-set"><span class="mergeability-icon mergeability-' + escapeText(pull.mergeability || 'unknown') + '" title="mergeability: ' + escapeText(pull.mergeability || 'unknown') + '">' + mergeabilityIcon(pull.mergeability) + '</span></span><span class="pr-delta">' + formatDelta(pull) + '</span><span class="pr-updated">' + relativeTime(pull.updatedAt) + '</span><span class="pr-mobile-files">' + escapeText(fileCount) + '</span></div></article>';
}
function renderAuthorAvatar(pull) {
  const author = pull.author || 'unknown';
  const avatarUrl = pull.authorAvatarUrl || '';
  if (avatarUrl) {
    return '<img class="pr-author-avatar" src="' + escapeText(avatarUrl) + '" alt="' + escapeText(author + ' avatar') + '" loading="lazy" referrerpolicy="no-referrer" />';
  }
  return '<span class="pr-author-avatar pr-author-avatar-fallback" aria-label="' + escapeText(author + ' avatar') + '">' + escapeText(authorInitials(author)) + '</span>';
}
function authorInitials(value) {
  const clean = String(value || '').replace(/[^a-z0-9]+/gi, ' ').trim();
  if (!clean) return '?';
  return clean.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function renderSection(section) {
  const currentLimit = Math.min(section.pulls.length, sectionLimits[section.id] || sectionPageSize);
  sectionLimits[section.id] = currentLimit;
  const visible = section.pulls.slice(0, currentLimit);
  const counter = section.id === 'streams' ? '<button class="section-count" type="button" data-toggle-streams aria-pressed="' + String(showAllStreams) + '" title="' + (showAllStreams ? 'Show open streams only' : 'Show all streams') + '">' + section.pulls.length + '</button>' : '<span class="section-count">' + section.pulls.length + '</span>';
  const pager = currentLimit < section.pulls.length ? '<div class="section-pager"><button class="load-more-button" type="button" data-load-more="' + section.id + '">Load more</button><span class="page-status">Showing ' + currentLimit + ' of ' + section.pulls.length + '</span></div>' : '';
  return '<details class="section pr-section" open data-section-id="' + section.id + '"><summary><h2>' + escapeText(section.title) + '</h2>' + counter + '</summary><div class="post-list">' + visible.map(renderCard).join('') + '</div>' + pager + '</details>';
}
function resetSectionLimits() { for (const key of Object.keys(sectionLimits)) delete sectionLimits[key]; }
function renderSections() {
  const sections = groupSections(visiblePulls());
  document.body.dataset.activeStream = activeStream;
  streamRow.hidden = !activeStream;
  streamLabel.textContent = activeStream || '';
  sectionsRoot.innerHTML = sections.length ? sections.map(renderSection).join('') : '<section class="section"><h2>No matching pull requests</h2><p class="muted">Try another filter, command search, or stream.</p></section>';
  document.querySelectorAll('[data-pr-route]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); openPull(link.getAttribute('data-pr-route')); }));
  document.querySelectorAll('[data-card-route]').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('a,button,input,textarea,select')) return;
      openPull(card.getAttribute('data-card-route'));
    });
    card.addEventListener('keydown', (event) => {
      if (event.target.closest('a,button,input,textarea,select')) return;
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPull(card.getAttribute('data-card-route')); }
    });
  });
  document.querySelectorAll('[data-stream-filter]').forEach((button) => button.addEventListener('click', (event) => { event.preventDefault(); activeStream = button.getAttribute('data-stream-filter') || ''; resetSectionLimits(); renderSections(); }));
  document.querySelectorAll('[data-toggle-streams]').forEach((button) => button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); showAllStreams = !showAllStreams; sectionLimits.streams = sectionPageSize; renderSections(); }));
  document.querySelectorAll('[data-load-more]').forEach((button) => button.addEventListener('click', () => { const id = button.getAttribute('data-load-more'); sectionLimits[id] = (sectionLimits[id] || sectionPageSize) + sectionPageSize; renderSections(); }));
  renderCommandResults();
}
function renderCommandResults() {
  if (!commandResults) return;
  const query = commandInput ? commandInput.value.trim() : '';
  const scoredPulls = pulls.map((pull) => ({ pull, score: scorePullRequestSearchValue(pull, query) })).filter((item) => !query || item.score > 0).sort((left, right) => right.score - left.score || new Date(right.pull.updatedAt).getTime() - new Date(left.pull.updatedAt).getTime()).slice(0, 8);
  commandResults.innerHTML = scoredPulls.length ? scoredPulls.map(({ pull }) => { const route = routePrefix + pull.number; const stream = pull.associatedStream || pull.baseRef || 'No stream'; return '<button class="command-item command-pr-item" type="button" data-command-route="' + escapeText(route) + '"><span class="command-key">#' + escapeText(pull.number) + '</span><span><strong>' + escapeText(pull.title) + '</strong><small>' + escapeText(stream + ' • ' + repoLabel + ' #' + pull.number) + '</small></span></button>'; }).join('') : '<div class="command-empty">No PRs match this command search.</div>';
}
function filterCommandPages() { const query = commandInput ? commandInput.value.trim() : ''; if (commandPages && commandPages.parentElement) commandPages.parentElement.hidden = Boolean(query); pageCommandItems.forEach((item) => { item.hidden = Boolean(query); }); }
function openCommandPalette() { commandPalette.hidden = false; commandBackdrop.hidden = false; document.body.dataset.commandPaletteState = 'open'; commandTriggers.forEach((trigger) => trigger.setAttribute('aria-expanded', 'true')); renderCommandResults(); filterCommandPages(); window.setTimeout(() => commandInput && commandInput.focus(), 0); }
function closeCommandPalette() { commandPalette.hidden = true; commandBackdrop.hidden = true; document.body.dataset.commandPaletteState = 'closed'; commandTriggers.forEach((trigger) => trigger.setAttribute('aria-expanded', 'false')); }
function updateActiveFilterButtons(filter) { document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item.dataset.filter === filter)); }
function runPageCommand(button) { const filter = button.getAttribute('data-command-filter'); const url = button.getAttribute('data-command-url') || '#pull-requests'; if (filter) { activeFilter = filter; updateActiveFilterButtons(filter); resetSectionLimits(); renderSections(); } closeCommandPalette(); if (url.startsWith('#')) { const sectionId = url.slice(1); const target = document.querySelector('[data-section-id="' + sectionId + '"]') || document.querySelector(url); if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else window.location.href = url; }
function readCachedIndex() { try { const cached = localStorage.getItem(cacheKey); return cached ? JSON.parse(cached) : null; } catch { localStorage.removeItem(cacheKey); return null; } }
function mergePullWithCache(pull, cachedPull) { if (!cachedPull) return pull; return { ...cachedPull, ...pull, additions: Number(pull.additions || 0) || Number(cachedPull.additions || 0), deletions: Number(pull.deletions || 0) || Number(cachedPull.deletions || 0), changedFiles: Number(pull.changedFiles || 0) || Number(cachedPull.changedFiles || 0), checkStatus: pull.checkStatus === 'unknown' ? cachedPull.checkStatus : pull.checkStatus, reviewStatus: pull.reviewStatus === 'unknown' || pull.reviewStatus === 'none' ? cachedPull.reviewStatus : pull.reviewStatus, mergeability: pull.mergeability === 'unknown' ? cachedPull.mergeability : pull.mergeability }; }
function mergeIndexWithCache(data, cached) { if (!cached || !Array.isArray(cached.pulls) || !Array.isArray(data.pulls)) return data; const cachedByNumber = new Map(cached.pulls.map((pull) => [pull.number, pull])); return { ...data, pulls: data.pulls.map((pull) => mergePullWithCache(pull, cachedByNumber.get(pull.number))) }; }
function applyIndexData(data) { pulls = Array.isArray(data.pulls) ? data.pulls : []; resetSectionLimits(); renderSections(); }
function clearStaleIndexCaches() { try { for (let index = localStorage.length - 1; index >= 0; index -= 1) { const key = localStorage.key(index); if (key && key.startsWith(staleCachePrefix) && key !== cacheKey) localStorage.removeItem(key); } } catch { } }
function loadCachedIndex() { clearStaleIndexCaches(); const cached = readCachedIndex(); if (cached) applyIndexData(cached); return cached; }
let lastIndexLoadAt = 0;
let indexLoadInFlight = null;
let currentIndexEtag = readInitialIndexEtag();
function readScriptJson(id) {
  const element = document.getElementById(id);
  if (!element || !element.textContent) return null;
  try { return JSON.parse(element.textContent); }
  catch { return null; }
}
function readInitialIndexData() { return readScriptJson('diff-cockpit-index-initial-data'); }
function readInitialIndexEtag() { return readScriptJson('diff-cockpit-index-initial-etag') || ''; }
function loadIndex(options = {}) {
  const initial = options.useCache === false ? null : readInitialIndexData();
  const cached = options.useCache === false ? null : (initial || loadCachedIndex());
  if (initial) applyIndexData(initial);
  if (indexLoadInFlight) return indexLoadInFlight;
  lastIndexLoadAt = Date.now();
  const headers = { accept: 'application/json' };
  if (currentIndexEtag) headers['If-None-Match'] = currentIndexEtag;
  indexLoadInFlight = fetch(apiPath, { headers, cache: 'no-cache' })
    .then((response) => {
      if (response.status === 304) return null;
      if (!response.ok) throw new Error('Live PR index fetch failed: ' + response.status);
      const etag = response.headers.get('etag') || '';
      return response.json().then((data) => ({ data, etag }));
    })
    .then((result) => {
      if (!result) return cached;
      if (result.etag) currentIndexEtag = result.etag;
      const merged = mergeIndexWithCache(result.data, cached);
      localStorage.setItem(cacheKey, JSON.stringify(merged));
      applyIndexData(merged);
      return merged;
    }, (error) => { if (!pulls.length) sectionsRoot.innerHTML = '<section class="section error"><h2>Could not load pull requests</h2><p>' + escapeText(error.message || error) + '</p></section>'; })
    .finally(() => { indexLoadInFlight = null; });
  return indexLoadInFlight;
}
function refreshIndexIfStale(minAgeMs = 10000) { if (document.hidden) return; if (Date.now() - lastIndexLoadAt < minAgeMs) return; loadIndex({ useCache: false }); }
document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => { activeFilter = button.dataset.filter; resetSectionLimits(); updateActiveFilterButtons(activeFilter); renderSections(); }));
clearStream.addEventListener('click', () => { activeStream = ''; resetSectionLimits(); renderSections(); });
commandTriggers.forEach((trigger) => trigger.addEventListener('click', () => { if (document.body.dataset.commandPaletteState === 'open') closeCommandPalette(); else openCommandPalette(); }));
if (commandClose) commandClose.addEventListener('click', closeCommandPalette);
if (commandBackdrop) commandBackdrop.addEventListener('click', closeCommandPalette);
if (commandPalette) commandPalette.addEventListener('click', (event) => { if (event.target === commandPalette) closeCommandPalette(); });
if (commandInput) commandInput.addEventListener('input', () => { activeQuery = commandInput.value; resetSectionLimits(); filterCommandPages(); window.clearTimeout(commandInput.dataset.timer); commandInput.dataset.timer = String(window.setTimeout(renderSections, 80)); });
if (commandResults) commandResults.addEventListener('click', (event) => { const button = event.target.closest('[data-command-route]'); if (button) openPull(button.getAttribute('data-command-route')); });
if (commandPages) commandPages.addEventListener('click', (event) => { const button = event.target.closest('[data-command-page]'); if (button) runPageCommand(button); });
if (commandInput) commandInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { const firstPr = commandResults && commandResults.querySelector('[data-command-route]'); const firstPage = commandPages && commandPages.querySelector('[data-command-page]:not([hidden])'); if (firstPr) openPull(firstPr.getAttribute('data-command-route')); else if (firstPage) runPageCommand(firstPage); } });
document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (document.body.dataset.commandPaletteState === 'open') closeCommandPalette(); else openCommandPalette(); return; } if (event.key === 'Escape' && document.body.dataset.commandPaletteState === 'open') closeCommandPalette(); });
window.addEventListener('focus', () => refreshIndexIfStale(5000));
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshIndexIfStale(5000); });
window.setInterval(() => refreshIndexIfStale(30000), 30000);
loadIndex();
`;
}
function renderReviewClientScript(apiPath: string): string {
  return `
const apiPath = ${JSON.stringify(apiPath)};
const state = { data: null, selected: null, diffModule: null, treeModule: null, activeFile: null, inlineCommentsVisible: true, currentView: false, observer: null, collapsedFolders: new Set(), expandedReviewItems: new Set(), drawerSections: { status: true, summary: true, prompt: false, checks: false, comments: false, commits: false } };
const els = {
  title: document.getElementById('pr-title'),
  meta: document.getElementById('pr-meta'),
  count: document.getElementById('file-count'),
  tree: document.getElementById('tree-root'),
  selected: document.getElementById('selected-file'),
  diff: document.getElementById('diff-root'),
  drawerToggle: document.getElementById('drawer-toggle'),
  navMergeability: document.getElementById('mergeability-nav-button'),
  navCommits: document.getElementById('commit-nav-button'),
  aiCommentsToggle: document.getElementById('ai-comments-toggle'),
  aiCommentsSidebar: document.getElementById('ai-comments-sidebar'),
  aiCommentsClose: document.getElementById('ai-comments-close'),
  aiCommentsSummary: document.getElementById('ai-comments-summary'),
  aiCommentsContent: document.getElementById('ai-comments-content'),
  drawerClose: document.getElementById('drawer-close'),
  copyAll: document.getElementById('copy-all-comments'),
  copyReviewLink: document.getElementById('copy-review-link'),
  copyCurrentCommitLink: document.getElementById('copy-current-commit-link'),
  openChatGpt: document.getElementById('open-chatgpt-prompt'),
  copyCodex: document.getElementById('copy-codex-prompt'),
  mergeabilityButton: document.getElementById('mergeability-button'),
  mergePrButton: document.getElementById('merge-pr-button'),
  drawerSummary: document.getElementById('drawer-summary'),
  drawerStatus: document.getElementById('drawer-status'),
  drawerPrompt: document.getElementById('drawer-prompt'),
  drawerChecks: document.getElementById('drawer-checks'),
  drawerComments: document.getElementById('drawer-comments'),
  drawerCommits: document.getElementById('drawer-commits'),
  drawerContent: document.getElementById('drawer-content'),
  filePane: document.getElementById('file-pane'),
  filePaneResizer: document.getElementById('file-pane-resizer'),
  mobileFilesToggle: document.getElementById('mobile-files-toggle'),
  mobileFileBackdrop: document.getElementById('mobile-file-backdrop'),
  commitPopover: document.getElementById('commit-popover'),
  mergeabilityPopover: document.getElementById('mergeability-popover'),
};

els.drawerToggle.addEventListener('click', () => preserveDiffViewport(() => setDrawer(document.body.dataset.reviewDrawer !== 'open')));
els.drawerClose.addEventListener('click', () => preserveDiffViewport(() => setDrawer(false)));
els.aiCommentsToggle.addEventListener('click', () => preserveDiffViewport(() => setAiSidebar(document.body.dataset.aiSidebar !== 'open')));
els.aiCommentsClose.addEventListener('click', () => preserveDiffViewport(() => setAiSidebar(false)));
els.mobileFilesToggle.addEventListener('click', () => preserveDiffViewport(() => setFilePaneDrawer(document.body.dataset.filePaneDrawer !== 'open')));
els.mobileFileBackdrop.addEventListener('click', () => preserveDiffViewport(() => setFilePaneDrawer(false)));
els.copyAll.addEventListener('click', () => copyText(buildCommentsMarkdown()));
els.copyReviewLink.addEventListener('click', () => copyReviewLink());
els.copyCurrentCommitLink.addEventListener('click', () => copyCurrentCommitLink());
document.addEventListener('click', (event) => {
  const sectionButton = event.target.closest('[data-drawer-section-toggle]');
  if (sectionButton) { event.preventDefault(); toggleDrawerSection(sectionButton.dataset.drawerSectionToggle); return; }
  const folderButton = event.target.closest('[data-folder-path]');
  if (folderButton) { toggleFolder(folderButton.dataset.folderPath); return; }
  const commitButton = event.target.closest('[data-open-commits]');
  if (commitButton) { toggleCommitPopover(); return; }
  const closeCommits = event.target.closest('[data-close-commits]');
  if (closeCommits) { closeCommitPopover(); return; }
  const mergeabilityButton = event.target.closest('[data-open-mergeability]');
  if (mergeabilityButton) { toggleMergeabilityPopover(); return; }
  const closeMergeability = event.target.closest('[data-close-mergeability]');
  if (closeMergeability) { closeMergeabilityPopover(); return; }
  const aiToggle = event.target.closest('[data-ai-review-toggle]');
  if (aiToggle) { toggleReviewItem(aiToggle.dataset.reviewItemId); return; }
  const aiCopyLink = event.target.closest('[data-ai-review-copy-link]');
  if (aiCopyLink) { copyReviewItemField(aiCopyLink.dataset.reviewItemId, 'link'); return; }
  const aiCopyBody = event.target.closest('[data-ai-review-copy-body]');
  if (aiCopyBody) { copyReviewItemField(aiCopyBody.dataset.reviewItemId, 'body'); return; }
  const aiCopyPrompt = event.target.closest('[data-ai-review-copy-prompt]');
  if (aiCopyPrompt) { copyReviewItemField(aiCopyPrompt.dataset.reviewItemId, 'prompt'); return; }
  const aiResolve = event.target.closest('[data-ai-review-resolve]');
  if (aiResolve) { resolveReviewItem(aiResolve.dataset.reviewItemId); return; }
  const jumpButton = event.target.closest('[data-comment-jump]');
  if (jumpButton) navigateToComment(jumpButton.dataset.commentFile, jumpButton.dataset.commentLine);
});
els.openChatGpt.addEventListener('click', () => openChatGptPrompt());
els.copyCodex.addEventListener('click', () => copyText(buildCodexPrompt()));

els.mergePrButton.addEventListener('click', () => mergePullRequest());
document.addEventListener('keydown', (event) => {
  if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  if (event.key === 'p') preserveDiffViewport(() => setDrawer(document.body.dataset.reviewDrawer !== 'open'));
  if (event.key === 'f') toggleFilePane();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'm') { event.preventDefault(); mergePullRequest(); return; }
  if (event.key === 'm') toggleMergeabilityPopover();
  if (event.key === 'v') toggleCurrentView();
  if (event.key === 'i') toggleInlineComments();
  if (event.key === 'c') copyText(buildCommentsMarkdown());
  if (event.key === 'g') openChatGptPrompt();
  if (event.key === 'Escape') { preserveDiffViewport(() => { setDrawer(false); setFilePaneDrawer(false); }); closeCommitPopover(); closeMergeabilityPopover(); }
});

let currentReviewEtag = readInitialReviewEtag();
const initialData = readInitialReviewData();
if (initialData) applyReviewData(initialData);
loadLiveData();
startReviewRevalidation();
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
function getReviewPane() {
  return els.diff.closest('.review-pane');
}

function captureDiffViewport() {
  const pane = getReviewPane();
  if (!pane) return null;
  const paneTop = pane.getBoundingClientRect().top;
  const stickyOffset = els.selected ? els.selected.offsetHeight + 8 : 48;
  const sections = Array.from(document.querySelectorAll('.diff-file'));
  let anchor = null;
  for (const section of sections) {
    const top = section.getBoundingClientRect().top - paneTop;
    if (top <= stickyOffset) anchor = section;
    else break;
  }
  return {
    scrollTop: pane.scrollTop,
    fileId: anchor ? anchor.id : '',
    offset: anchor ? anchor.getBoundingClientRect().top - paneTop : 0,
  };
}

function restoreDiffViewport(snapshot) {
  if (!snapshot) return;
  const restore = () => {
    const pane = getReviewPane();
    if (!pane) return;
    if (snapshot.fileId) {
      const anchor = document.getElementById(snapshot.fileId);
      if (anchor) {
        const paneTop = pane.getBoundingClientRect().top;
        const delta = anchor.getBoundingClientRect().top - paneTop - snapshot.offset;
        pane.scrollTop += delta;
        return;
      }
    }
    pane.scrollTop = snapshot.scrollTop;
  };
  window.requestAnimationFrame(() => { restore(); window.setTimeout(restore, 200); });
}

function preserveDiffViewport(callback) {
  const snapshot = captureDiffViewport();
  callback();
  restoreDiffViewport(snapshot);
}

function setDrawer(open) {
  document.body.dataset.reviewDrawer = open ? 'open' : 'closed';
  els.drawerToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.getElementById('review-drawer').setAttribute('aria-hidden', open ? 'false' : 'true');
}
function setAiSidebar(open) {
  document.body.dataset.aiSidebar = open ? 'open' : 'closed';
  els.aiCommentsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  els.aiCommentsSidebar.setAttribute('aria-hidden', open ? 'false' : 'true');
}
function setFilePaneDrawer(open) {
  if (open) document.body.dataset.filePaneCollapsed = 'false';
  document.body.dataset.filePaneDrawer = open ? 'open' : 'closed';
  els.mobileFilesToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  els.mobileFilesToggle.setAttribute('aria-label', open ? 'Close files' : 'Open files');
  els.mobileFilesToggle.textContent = open ? '×' : '▣';
}
function readInitialReviewData() {
  const element = document.getElementById('diff-cockpit-initial-data');
  if (!element || !element.textContent) return null;
  try { return JSON.parse(element.textContent); }
  catch { return null; }
}
function readInitialReviewEtag() {
  const element = document.getElementById('diff-cockpit-initial-etag');
  if (!element || !element.textContent) return '';
  try { return JSON.parse(element.textContent) || ''; }
  catch { return ''; }
}

function applyReviewData(data) {
  state.data = data;
  const previousFile = state.selected && state.selected.filename;
  const files = state.data.files || [];
  state.selected = files.find((file) => file.filename === previousFile) || files[0] || null;
  state.activeFile = state.selected ? state.selected.filename : null;
  renderHeader();
  renderTree();
  renderSelectedFile();
  renderLongDiffs();
  setupActiveFileObserver();
  renderDrawer();
  renderAiCommentsSidebar();
}

function startReviewRevalidation() {
  window.setInterval(() => {
    if (document.visibilityState === 'visible') loadLiveData();
  }, ${REVIEW_REVALIDATE_MS});
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadLiveData();
  });
}

function loadLiveData() {
  const headers = { accept: 'application/json' };
  if (currentReviewEtag) headers['If-None-Match'] = currentReviewEtag;
  fetch(apiPath, { headers, cache: 'no-cache' })
    .then((response) => {
      if (response.status === 304) return null;
      if (!response.ok) throw new Error('Live PR fetch failed: ' + response.status);
      const etag = response.headers.get('etag') || '';
      return response.json().then((data) => ({ data, etag }));
    })
    .then(
      (result) => {
        if (!result) return;
        if (result.etag) currentReviewEtag = result.etag;
        applyReviewData(result.data);
      },
      (error) => {
        if (!state.data) els.tree.textContent = error.message || String(error);
      },
    );
}

async function mergePullRequest() {
  if (!state.data?.pull) {
    renderMergeResult('Load PR data before merging.');
    return;
  }
  const pull = state.data.pull;
  if (!window.confirm('Merge PR #' + pull.number + ' into ' + pull.baseRef + '?')) return;
  renderMergeResult('Merging PR #' + pull.number + '…');
  try {
    const response = await fetch(apiPath + '/merge', { method: 'POST', headers: { accept: 'application/json' } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      renderMergeResult('Merge failed: ' + (result.error || response.status));
      return;
    }
    renderMergeResult(result.message || 'Merged.');
    loadLiveData();
  } catch {
    renderMergeResult('Merge failed.');
  }
}

function renderMergeResult(message) {
  els.mergeabilityPopover.hidden = false;
  els.mergeabilityPopover.innerHTML = '<div class="commit-popover-head"><strong>Merge PR</strong><button type="button" data-close-mergeability>Close</button></div><div class="commit-card"><p class="commit-title">' + escapeHtml(message) + '</p></div>';
}

function formatCountLabel(count, singular) {
  return count.toLocaleString() + ' ' + singular + (count === 1 ? '' : 's');
}

function renderHeader() {
  const pull = state.data.pull;
  const commentCount = state.data.comments ? state.data.comments.length : 0;
  const aiCommentCount = aiReviewItems().length;
  els.aiCommentsToggle.textContent = formatCountLabel(aiCommentCount, 'comment');
  els.title.textContent = pull.title;
  els.meta.textContent = '#' + pull.number + ' · ' + pull.state + (pull.draft ? ' · draft' : '') + ' · ' + pull.headRef + ' → ' + pull.baseRef + ' · by ' + pull.author + ' · ' + commentCount + ' review comments';
  els.count.textContent = String(state.data.files.length);
}

function renderTree() {
  els.tree.innerHTML = renderTreeNode(state.data.tree, 0);
  for (const button of els.tree.querySelectorAll('[data-file]')) {
    button.addEventListener('click', () => {
      state.selected = state.data.files.find((file) => file.filename === button.dataset.file);
      state.activeFile = state.selected ? state.selected.filename : state.activeFile;
      renderTree();
      renderSelectedFile();
      scrollToFile(state.selected);
      preserveDiffViewport(() => setFilePaneDrawer(false));
    });
  }
}

function renderTreeNode(node, depth) {
  if (node.type === 'root') return node.children.map((child) => renderTreeNode(child, depth)).join('');
  if (node.type === 'file') {
    const current = state.selected && state.selected.filename === node.file.filename;
    const visible = state.activeFile === node.file.filename;
    return '<div class="tree-branch tree-depth-' + Math.min(depth, 3) + '"><button class="tree-node file ' + (visible ? 'is-visible' : '') + '" type="button" data-file="' + escapeAttribute(node.file.filename) + '" aria-current="' + (current ? 'true' : 'false') + '"><span class="file-icon">' + escapeHtml(fileIcon(node.file.filename)) + '</span><span class="status">' + escapeHtml(statusToken(node.file.status)) + '</span><span class="tree-label">' + escapeHtml(node.name) + '</span><span class="tree-stats">+' + escapeHtml(node.file.additions) + ' −' + escapeHtml(node.file.deletions) + '</span>' + fileCommentBadge(node.file.filename) + '</button></div>';
  }
  const folderPath = node.path || node.name;
  const collapsed = state.collapsedFolders.has(folderPath);
  const children = collapsed ? '' : '<div class="tree-children">' + node.children.map((child) => renderTreeNode(child, depth + 1)).join('') + '</div>';
  return '<div class="tree-branch tree-depth-' + Math.min(depth, 3) + '"><button class="directory-toggle" type="button" data-folder-path="' + escapeAttribute(folderPath) + '" aria-expanded="' + String(!collapsed) + '"><span class="tree-twist">' + (collapsed ? '›' : '⌄') + '</span><span class="tree-label">' + escapeHtml(node.name) + '</span></button>' + children + '</div>';
}

function fileCommentBadge(filename) {
  const count = (state.data.comments || []).filter((comment) => comment.path === filename).length;
  return count ? ' <span class="badge">' + count + '</span>' : '';
}

function renderSelectedFile() {
  const active = state.data && state.activeFile ? state.data.files.find((file) => file.filename === state.activeFile) : null;
  const file = active || state.selected;
  if (!file) {
    els.selected.textContent = 'No changed files';
    return;
  }
  els.selected.textContent = 'Current file · ' + state.data.files.length + ' files · ' + file.filename + ' · +' + file.additions + ' −' + file.deletions;
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
  if (target) target.scrollIntoView({ block: 'start' });
}

function fileDomId(filename) {
  return 'file-' + String(filename || '').replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function aiReviewItems() {
  if (Array.isArray(state.data?.reviewItems)) return state.data.reviewItems;
  return (state.data?.comments || [])
    .filter((comment) => ['coderabbit', 'codex', 'claude'].includes(comment.provider))
    .map((comment) => ({
      id: comment.nodeId || comment.id,
      provider: comment.provider,
      source: comment.source,
      author: comment.author,
      body: comment.body,
      htmlUrl: comment.url,
      createdAt: comment.createdAt,
      path: comment.path,
      line: comment.line,
      isResolved: false,
      isOutdated: false,
      canResolve: false,
      resolutionSource: 'local',
    }));
}

function renderAiCommentsSidebar() {
  const items = aiReviewItems();
  const unresolved = items.filter((item) => !item.isResolved).length;
  els.aiCommentsSummary.textContent = formatCountLabel(items.length, 'comment') + ' · ' + unresolved.toLocaleString() + ' unresolved';
  els.aiCommentsContent.innerHTML = items.length ? items.map(renderAiReviewItem).join('') : '<div class="comment-card muted">No CodeRabbit or Codex comments found.</div>';
}

function renderAiReviewItem(item) {
  const expanded = state.expandedReviewItems.has(item.id);
  const stateClass = item.isResolved ? 'is-resolved' : 'is-unresolved';
  const stateLabel = item.isResolved ? 'resolved' : 'unresolved';
  const sourceLabel = item.canResolve ? 'GitHub thread' : 'local only';
  const location = item.path ? item.path + (item.line ? ':' + item.line : '') : 'conversation';
  const jump = item.path ? '<button class="ai-review-action" type="button" data-comment-jump data-comment-file="' + escapeAttribute(item.path) + '" data-comment-line="' + escapeAttribute(String(item.line || '')) + '">jump</button>' : '';
  const body = expanded ? '<div class="ai-review-expanded"><div class="comment-body">' + renderMarkdown(item.body) + '</div><div class="ai-review-actions"><button class="ai-review-action" type="button" data-ai-review-copy-link data-review-item-id="' + escapeAttribute(item.id) + '">copy link</button><button class="ai-review-action" type="button" data-ai-review-copy-body data-review-item-id="' + escapeAttribute(item.id) + '">copy body</button><button class="ai-review-action" type="button" data-ai-review-copy-prompt data-review-item-id="' + escapeAttribute(item.id) + '">copy prompt</button>' + jump + renderReviewResolveButton(item) + '</div></div>' : '';
  return '<article class="ai-review-card ' + stateClass + '"><button class="ai-review-summary" type="button" data-ai-review-toggle data-review-item-id="' + escapeAttribute(item.id) + '" aria-expanded="' + String(expanded) + '"><span class="badge">' + escapeHtml(item.provider) + '</span><span class="ai-review-main"><strong>' + escapeHtml(location) + '</strong><span>' + escapeHtml(previewText(item.body, 126)) + '</span></span><span class="badge">' + escapeHtml(stateLabel) + '</span><span class="badge">' + escapeHtml(sourceLabel) + '</span></button>' + body + '</article>';
}

function renderReviewResolveButton(item) {
  if (!item.canResolve || !item.threadId) return '<span class="badge">' + escapeHtml(item.resolutionSource || 'local') + '</span>';
  return '<button class="ai-review-action" type="button" data-ai-review-resolve data-review-item-id="' + escapeAttribute(item.id) + '">' + (item.isResolved ? 'mark unresolved' : 'mark resolved') + '</button>';
}

function toggleReviewItem(itemId) {
  if (!itemId) return;
  if (state.expandedReviewItems.has(itemId)) state.expandedReviewItems.delete(itemId);
  else state.expandedReviewItems.add(itemId);
  renderAiCommentsSidebar();
}

function findReviewItem(itemId) {
  return aiReviewItems().find((item) => item.id === itemId) || null;
}

function copyReviewItemField(itemId, field) {
  const item = findReviewItem(itemId);
  if (!item) return;
  if (field === 'link') { copyText(item.htmlUrl || ''); return; }
  if (field === 'body') { copyText(item.body || ''); return; }
  copyText('@agent please handle this review item.\\n\\n' + reviewItemMarkdown(item));
}

function reviewItemMarkdown(item) {
  const lines = ['Provider: ' + item.provider, 'State: ' + (item.isResolved ? 'resolved' : 'unresolved'), 'Source: ' + item.resolutionSource];
  if (item.path) lines.push('Location: ' + item.path + (item.line ? ':' + item.line : ''));
  if (item.htmlUrl) lines.push('URL: ' + item.htmlUrl);
  lines.push('', item.body || '');
  return lines.join('\\n');
}

async function resolveReviewItem(itemId) {
  const item = findReviewItem(itemId);
  if (!item || !item.canResolve || !item.threadId) return;
  const action = item.isResolved ? 'unresolve' : 'resolve';
  try {
    const response = await fetch(apiPath + '/review-threads/' + encodeURIComponent(item.threadId) + '/' + action, { method: 'POST', headers: { accept: 'application/json' } });
    if (!response.ok) return;
    item.isResolved = !item.isResolved;
    renderAiCommentsSidebar();
    loadLiveData();
  } catch {
    renderAiCommentsSidebar();
  }
}

function previewText(value, maxLength) {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  return compact.length > maxLength ? compact.slice(0, maxLength - 1) + '…' : compact;
}
function renderDrawer() {
  const comments = state.data.comments || [];
  const commits = reviewCommits();
  const checks = state.data.checks || [];
  const pull = state.data.pull;
  const mergeLabel = mergeabilityLabel(pull);
  const commentsLabel = comments.length.toLocaleString() + ' ' + (comments.length === 1 ? 'comment' : 'comments');
  const commitsLabel = commits.length.toLocaleString() + ' ' + (commits.length === 1 ? 'commit' : 'commits');
  const checksLabel = checks.length.toLocaleString() + ' ' + (checks.length === 1 ? 'check' : 'checks');
  els.navMergeability.textContent = mergeLabel;
  els.navMergeability.dataset.status = mergeLabel;
  els.navCommits.textContent = commitsLabel;
  const statusBody = '<div class="comment-card compact-status"><button class="badge summary-chip" type="button" data-open-mergeability>' + escapeHtml(mergeLabel) + '</button> <span class="badge">' + escapeHtml(pull.state) + '</span> <span class="badge">' + escapeHtml(pull.headRef || '') + ' -> ' + escapeHtml(pull.baseRef || '') + '</span></div>';
  const summaryBody = '<div class="comment-card review-summary-card"><button class="badge summary-chip" type="button" data-drawer-section-toggle="comments">' + escapeHtml(commentsLabel) + '</button> <button class="badge summary-chip" type="button" data-drawer-section-toggle="commits" data-open-commits>' + escapeHtml(commitsLabel) + '</button> <button class="badge summary-chip" type="button" data-drawer-section-toggle="checks">' + escapeHtml(checksLabel) + '</button> <button class="badge summary-chip" type="button" data-drawer-section-toggle="prompt">agent prompt</button></div>';
  const promptBody = '<div class="comment-card"><div class="comment-meta">Prompt preview</div><div class="comment-body prompt-preview">' + renderMarkdown(buildChatGptPrompt()) + '</div></div>';
  els.drawerStatus.innerHTML = renderDrawerSection('status', 'Status', statusBody, true);
  els.drawerSummary.innerHTML = renderDrawerSection('summary', 'Review summary', summaryBody, true);
  els.drawerPrompt.innerHTML = renderDrawerSection('prompt', 'Prompt for AI agents', promptBody, false);
  els.drawerChecks.innerHTML = renderDrawerSection('checks', 'Checks', checks.length ? checks.map(renderCheck).join('') : '<div class="comment-card muted">No checks found.</div>', false);
  els.drawerComments.innerHTML = renderDrawerSection('comments', 'Comments', comments.length ? comments.map(renderComment).join('') : '<div class="comment-card muted">No review comments found.</div>', false);
  els.drawerCommits.innerHTML = renderDrawerSection('commits', 'Commits', commits.length ? commits.map(renderCommit).join('') : '<div class="commit-card muted">No commits found for this PR.</div>', false);
}

function renderDrawerSection(sectionId, title, bodyHtml, defaultOpen) {
  const open = drawerSectionIsOpen(sectionId, defaultOpen);
  const stateLabel = open ? 'Hide' : 'Show';
  const caret = open ? '⌄' : '›';
  const body = open ? '<div class="drawer-section-body">' + bodyHtml + '</div>' : '';
  return '<div class="drawer-section-head"><button class="drawer-section-toggle" type="button" data-drawer-section-toggle="' + escapeAttribute(sectionId) + '" aria-expanded="' + String(open) + '"><span>' + escapeHtml(title) + '</span><span class="drawer-section-state">' + stateLabel + '</span><span class="drawer-section-caret">' + caret + '</span></button></div>' + body;
}

function drawerSectionIsOpen(sectionId, defaultOpen) {
  const value = state.drawerSections ? state.drawerSections[sectionId] : undefined;
  return typeof value === 'boolean' ? value : defaultOpen;
}

function toggleDrawerSection(sectionId) {
  if (!sectionId) return;
  const defaultOpen = sectionId === 'status' || sectionId === 'summary';
  state.drawerSections[sectionId] = !drawerSectionIsOpen(sectionId, defaultOpen);
  renderDrawer();
}

function renderComment(comment) {
  const location = comment.path ? ' · ' + comment.path + (comment.line ? ':' + comment.line : '') : '';
  const link = comment.url ? ' · <a href="' + escapeAttribute(comment.url) + '">open</a>' : '';
  const jump = comment.path ? ' <button class="comment-jump" type="button" data-comment-jump data-comment-file="' + escapeAttribute(comment.path) + '" data-comment-line="' + escapeAttribute(String(comment.line || '')) + '">jump</button>' : '';
  return '<article class="comment-card"><div class="comment-meta"><span class="badge">' + escapeHtml(comment.provider) + '</span> ' + escapeHtml(comment.author) + location + link + jump + '</div><div class="comment-body">' + renderMarkdown(comment.body) + '</div></article>';
}

function renderCommit(commit) {
  const link = commit.url ? '<a href="' + escapeAttribute(commit.url) + '">' + escapeHtml(commit.shortSha) + '</a>' : escapeHtml(commit.shortSha);
  return '<article class="commit-card"><div class="commit-meta">' + link + ' · ' + escapeHtml(commit.author) + ' · ' + escapeHtml(relativeCommitTime(commit.committedAt)) + ' · <span class="commit-delta">' + escapeHtml(formatCommitDelta(commit)) + '</span></div><p class="commit-title">' + escapeHtml(commit.message) + '</p></article>';
}

function sortCommitsNewestFirst(commits) {
  return [...commits].sort((left, right) => new Date(right.committedAt || 0).getTime() - new Date(left.committedAt || 0).getTime());
}

function reviewCommits() {
  if (Array.isArray(state.data?.commits) && state.data.commits.length) return sortCommitsNewestFirst(state.data.commits);
  if (Array.isArray(state.data?.streamCommits) && state.data.streamCommits.length) return sortCommitsNewestFirst(state.data.streamCommits);
  return [];
}
function toggleCommitPopover() {
  if (!els.commitPopover.hidden) { closeCommitPopover(); return; }
  renderCommitPopover();
}
function renderCommitPopover() {
  const commits = reviewCommits();
  els.commitPopover.hidden = false;
  closeMergeabilityPopover();
  els.commitPopover.innerHTML = '<div class="commit-popover-head"><strong>' + commits.length.toLocaleString() + ' ' + (commits.length === 1 ? 'commit' : 'commits') + '</strong><button type="button" data-close-commits>Close</button></div><div class="commit-popover-list">' + (commits.length ? commits.map(renderCommit).join('') : '<div class="commit-card muted">No commits found for this PR.</div>') + '</div>';
}

function closeCommitPopover() {
  els.commitPopover.hidden = true;
}
function mergeabilityLabel(pull) {
  const stateLabel = String(pull?.mergeableState || 'unknown').toLowerCase();
  const unmergeable = ['dirty'].includes(stateLabel) || pull?.mergeable === false;
  return unmergeable ? 'unmergeable' : 'mergeable';
}
function toggleMergeabilityPopover() {
  if (!els.mergeabilityPopover.hidden) { closeMergeabilityPopover(); return; }
  renderMergeabilityPopover();
}
function renderMergeabilityPopover() {
  closeCommitPopover();
  const pull = state.data?.pull || {};
  const files = state.data?.files || [];
  const stateLabel = String(pull.mergeableState || 'unknown').toLowerCase();
  const clean = mergeabilityLabel(pull) === 'mergeable';
  const dirty = !clean;
  const title = escapeHtml(mergeabilityLabel(pull));
  const fileList = dirty && files.length ? '<ul class="mergeability-files">' + files.map((file) => '<li>' + escapeHtml(file.filename) + '</li>').join('') + '</ul>' : '';
  const body = clean
    ? '<p class="muted">This PR is mergeable.</p>'
    : dirty
      ? '<p class="muted">Files to inspect before merging:</p>' + fileList
      : '<p class="muted">This PR is mergeable but GitHub reports state: ' + escapeHtml(stateLabel || 'unknown') + '.</p>';
  els.mergeabilityPopover.hidden = false;
  els.mergeabilityPopover.innerHTML = '<div class="commit-popover-head"><strong>' + title + '</strong><button type="button" data-close-mergeability>Close</button></div><div class="commit-card">' + body + '</div>';
}

function closeMergeabilityPopover() {
  els.mergeabilityPopover.hidden = true;
}

function relativeCommitTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'time unknown';
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return seconds + 's ago';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours + 'h ago';
  return Math.round(hours / 24) + 'd ago';
}

function formatCommitDelta(commit) {
  return '+' + Number(commit.additions || 0).toLocaleString() + ' −' + Number(commit.deletions || 0).toLocaleString();
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
  return renderMarkdownBlocks(String(markdown || ''));
}

function renderMarkdownBlocks(markdown) {
  const newline = String.fromCharCode(10);
  const lines = String(markdown || '').replaceAll(String.fromCharCode(13) + newline, newline).split(newline);
  const html = [];
  let paragraph = [];
  let listItems = [];
  let inCode = false;
  let codeLines = [];
  const codeFence = String.fromCharCode(96, 96, 96);
  function flushParagraph() {
    if (!paragraph.length) return;
    html.push('<p>' + renderInlineMarkdown(paragraph.join(' ')) + '</p>');
    paragraph = [];
  }
  function flushList() {
    if (!listItems.length) return;
    html.push('<ul>' + listItems.map((item) => '<li>' + renderInlineMarkdown(item) + '</li>').join('') + '</ul>');
    listItems = [];
  }
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(codeFence)) {
      if (inCode) {
        html.push('<pre><code>' + escapeHtml(codeLines.join(newline)) + '</code></pre>');
        codeLines = [];
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    if (trimmed === '<details>') {
      flushParagraph();
      flushList();
      html.push('<details class="markdown-details">');
      continue;
    }
    if (trimmed === '</details>') {
      flushParagraph();
      flushList();
      html.push('</details>');
      continue;
    }
    if (trimmed.startsWith('<summary>') && trimmed.endsWith('</summary>')) {
      flushParagraph();
      flushList();
      html.push('<summary>' + renderInlineMarkdown(trimmed.slice(9, -10)) + '</summary>');
      continue;
    }
    const headingLevel = markdownHeadingLevel(trimmed);
    if (headingLevel > 0) {
      flushParagraph();
      flushList();
      html.push('<h' + headingLevel + '>' + renderInlineMarkdown(trimmed.slice(headingLevel + 1)) + '</h' + headingLevel + '>');
      continue;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushParagraph();
      listItems.push(trimmed.slice(2));
      continue;
    }
    if (trimmed.startsWith('>')) {
      flushParagraph();
      flushList();
      html.push('<blockquote>' + renderInlineMarkdown(trimmed.slice(1).trim()) + '</blockquote>');
      continue;
    }
    paragraph.push(trimmed);
  }
  if (inCode) html.push('<pre><code>' + escapeHtml(codeLines.join(newline)) + '</code></pre>');
  flushParagraph();
  flushList();
  return html.join('');
}

function markdownHeadingLevel(value) {
  let level = 0;
  while (value.charAt(level) === '#') level += 1;
  return level > 0 && level <= 3 && value.charAt(level) === ' ' ? level : 0;
}

function renderInlineMarkdown(value) {
  const backtick = String.fromCharCode(96);
  return renderMarkdownLinks(replaceDelimited(replaceDelimited(escapeHtml(String(value || '')), backtick, '<code>', '</code>'), '**', '<strong>', '</strong>'));
}

function replaceDelimited(value, marker, openTag, closeTag) {
  let output = '';
  let cursor = 0;
  while (cursor < value.length) {
    const start = value.indexOf(marker, cursor);
    if (start === -1) return output + value.slice(cursor);
    const end = value.indexOf(marker, start + marker.length);
    if (end === -1) return output + value.slice(cursor);
    output += value.slice(cursor, start) + openTag + value.slice(start + marker.length, end) + closeTag;
    cursor = end + marker.length;
  }
  return output;
}

function renderMarkdownLinks(value) {
  let output = '';
  let cursor = 0;
  while (cursor < value.length) {
    const labelStart = value.indexOf('[', cursor);
    if (labelStart === -1) return output + value.slice(cursor);
    const labelEnd = value.indexOf(']', labelStart + 1);
    const urlStart = labelEnd >= 0 ? labelEnd + 1 : -1;
    if (labelEnd === -1 || value.charAt(urlStart) !== '(') {
      output += value.slice(cursor, labelStart + 1);
      cursor = labelStart + 1;
      continue;
    }
    const urlEnd = value.indexOf(')', urlStart + 1);
    if (urlEnd === -1) return output + value.slice(cursor);
    const label = value.slice(labelStart + 1, labelEnd);
    const url = value.slice(urlStart + 1, urlEnd);
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      output += value.slice(cursor, urlEnd + 1);
      cursor = urlEnd + 1;
      continue;
    }
    output += value.slice(cursor, labelStart) + '<a href="' + escapeAttribute(url) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    cursor = urlEnd + 1;
  }
  return output;
}

function navigateToComment(file, line) {
  const target = document.getElementById(fileDomId(file));
  if (target) target.scrollIntoView({ block: 'start' });
  const comment = document.querySelector('[data-comment-file="' + CSS.escape(file) + '"][data-comment-line="' + CSS.escape(String(line || '')) + '"]');
  if (comment) comment.scrollIntoView({ block: 'center' });
}

function setupCommentJumps() {
  document.querySelectorAll('[data-comment-jump]').forEach((button) => {
    button.addEventListener('click', () => navigateToComment(button.dataset.commentFile, button.dataset.commentLine));
  });
}

function setupActiveFileObserver() {
  if (state.observer) state.observer.disconnect();
  const reviewPane = els.diff.closest('.review-pane');
  state.observer = new IntersectionObserver(() => updateActiveFileFromViewport(), { root: reviewPane, threshold: 0.2 });
  document.querySelectorAll('.diff-file').forEach((section) => state.observer.observe(section));
  if (state.scrollHandler && reviewPane) reviewPane.removeEventListener('scroll', state.scrollHandler);
  state.scrollHandler = () => window.requestAnimationFrame(updateActiveFileFromViewport);
  if (reviewPane) reviewPane.addEventListener('scroll', state.scrollHandler, { passive: true });
  setupCommentJumps();
  updateActiveFileFromViewport();
}

function updateActiveFileFromViewport() {
  const reviewPane = els.diff.closest('.review-pane');
  const sections = Array.from(document.querySelectorAll('.diff-file'));
  if (!reviewPane || sections.length === 0) return;
  const paneTop = reviewPane.getBoundingClientRect().top;
  const stickyOffset = els.selected ? els.selected.offsetHeight + 8 : 48;
  let current = sections[0];
  for (const section of sections) {
    const top = section.getBoundingClientRect().top - paneTop;
    if (top <= stickyOffset) current = section;
    else break;
  }
  const matched = (state.data.files || []).find((item) => fileDomId(item.filename) === current.id);
  if (!matched || state.activeFile === matched.filename) return;
  state.activeFile = matched.filename;
  renderSelectedFile();
  renderTree();
  const button = els.tree.querySelector('[data-file="' + CSS.escape(matched.filename) + '"]');
  if (button) button.scrollIntoView({ block: 'nearest' });
}

function toggleFilePane() {
  preserveDiffViewport(() => {
    document.body.dataset.filePaneCollapsed = document.body.dataset.filePaneCollapsed === 'true' ? 'false' : 'true';
  });
}

function toggleFolder(folderPath) {
  if (!folderPath) return;
  if (state.collapsedFolders.has(folderPath)) state.collapsedFolders.delete(folderPath);
  else state.collapsedFolders.add(folderPath);
  renderTree();
}

function toggleCurrentView() {
  preserveDiffViewport(() => {
    state.currentView = !state.currentView;
    document.body.dataset.currentView = state.currentView ? 'current' : 'diff';
  });
}

function toggleInlineComments() {
  preserveDiffViewport(() => {
    state.inlineCommentsVisible = !state.inlineCommentsVisible;
    document.body.dataset.commentsVisible = state.inlineCommentsVisible ? 'true' : 'false';
  });
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
 

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
