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

type GithubLoaderOptions = {
  fetcher?: Fetcher;
  token?: string;
  cache?: EdgeCache;
};

type DiffCockpitEnv = {
  GITHUB_TOKEN?: string;
  GH_TOKEN?: string;
  DIFF_COCKPIT_DEFAULT_REPO?: string;
  DIFF_COCKPIT_REFRESH_TOKEN?: string;
};

type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

const DEFAULT_OWNER = 'consuelohq';
const DEFAULT_REPO = 'opensaas';
const COCKPIT_ORIGIN = 'https://diffs.consuelohq.com';
const MAX_PAGES = 10;
const INDEX_FRONT_PAGE_PULL_LIMIT = 30;
const INDEX_MAX_PAGES = 1;
const INDEX_ENRICH_LIMIT = 10;
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
    const pullsJson = await fetchJsonArrayPages(
      fetcher,
      `${apiBase}/pulls?state=all&sort=updated&direction=desc`,
      headers,
      'GitHub pull requests fetch failed',
      { maxPages: INDEX_MAX_PAGES },
    );
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
  const mainCodePath = `/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/tree/main/packages`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Consolidate Diffs · ${escapeHtml(repoLabel)}</title>
  <style>${renderStyles()}</style>
</head>
<body class="index-page" data-api-path="${escapeAttribute(apiPath)}" data-active-stream="" data-command-palette-state="closed">
  <div class="shell index-shell">
    <div class="wiki-topbar" data-pagefind-ignore>
      <a class="brand" href="/">Consolidate Diffs</a>
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
  <script type="module">${renderIndexClientScript(apiPath, repo)}</script>
</body>
</html>`;
}

export function renderReviewPage(locator: PullRequestLocator, initialData: PullRequestReviewData | null = null): string {
  const apiPath = `/api/${encodeURIComponent(locator.owner)}/${encodeURIComponent(
    locator.repo,
  )}/pull/${locator.number}`;
  const githubUrl = `https://github.com/${locator.owner}/${locator.repo}/pull/${locator.number}`;
  const graphiteUrl = `https://app.graphite.com/github/pr/${locator.owner}/${locator.repo}/${locator.number}`;
  const diffsHubUrl = `https://diffshub.com/${locator.owner}/${locator.repo}/pull/${locator.number}`;
  const initialDataScript = initialData
    ? `  <script id="diff-cockpit-initial-data" type="application/json">${escapeScriptJson(initialData)}</script>\n`
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
<body class="review-page" data-review-drawer="closed" data-file-pane-collapsed="false" data-file-pane-drawer="closed" data-comments-visible="true" data-current-view="diff" data-api-path="${escapeAttribute(apiPath)}">
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
      <button id="drawer-toggle" type="button" aria-expanded="false">Drawer</button>
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
    <button id="mobile-files-toggle" class="mobile-files-toggle" type="button" aria-label="Open files" aria-expanded="false">▣</button>
    <button id="mobile-file-backdrop" class="mobile-file-backdrop" type="button" aria-label="Close files"></button>
    <section class="review-pane" aria-label="File diff">
      <div id="selected-file" class="selected-file">Select a file</div>
      <div id="diff-root" class="diff-root" data-diffs-library="@pierre/diffs"></div>
    </section>
    <aside id="review-drawer" class="review-drawer" aria-label="Review drawer" aria-hidden="true">
      <div class="drawer-head">
        <strong>drawer</strong>
        <button id="drawer-close" type="button">Close</button>
      </div>
      <div id="drawer-content" class="drawer-content">
        <div class="action-grid" aria-label="Review actions">
          <button id="copy-all-comments" class="action-button" type="button" title="Copy all review comments">□ Copy all</button>
          <button id="open-chatgpt-prompt" class="action-button" type="button">Open ChatGPT</button>
          <button id="copy-codex-prompt" class="action-button" type="button">Copy Codex</button>
          <button id="mergeability-button" class="action-button" type="button">Mergeability</button>
          <button id="merge-pr-button" class="action-button" type="button">Merge PR</button>
        </div>
        <p class="muted">Keyboard: <span class="kbd">d</span> drawer · <span class="kbd">f</span> files · <span class="kbd">m</span> mergeability · <span class="kbd">⌘M</span> merge PR · <span class="kbd">v</span> current view · <span class="kbd">i</span> inline comments · <span class="kbd">c</span> copy comments · <span class="kbd">g</span> ChatGPT · <span class="kbd">Esc</span> close</p>
        <div id="drawer-status" class="drawer-section"><h2>Status</h2><div class="comment-card muted">Loading PR status…</div></div>
        <div id="drawer-checks" class="drawer-section"><h2>Checks</h2><div class="comment-card muted">Loading checks…</div></div>
        <div id="drawer-summary" class="drawer-section"><h2>Review summary</h2><div class="comment-card muted">Loading review context…</div></div>
        <div id="drawer-comments" class="drawer-section"><h2>Comments</h2><div class="comment-card muted">No comments loaded yet.</div></div>
        <div id="drawer-commits" class="drawer-section"><h2>Recent stream commits</h2><div class="commit-card muted">No stream commits loaded yet.</div></div>
      </div>
    </aside>
    <div id="commit-popover" class="commit-popover" role="dialog" aria-label="Stream commits" hidden></div>
    <div id="mergeability-popover" class="commit-popover" role="dialog" aria-label="Mergeability" hidden></div>
  </main>
${initialDataScript}  <script type="module">${renderReviewClientScript(apiPath)}</script>
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
      <a class="brand" href="/">Consolidate Diffs</a>
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
      <a class="brand" href="/">Consolidate Diffs</a>
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

      if (url.pathname === '/healthz') {
        return new Response('ok', { headers: { 'content-type': 'text/plain' } });
      }

      if (url.pathname === '/internal/cache/refresh') {
        return handleCacheRefresh({ request, env, ctx, defaultRepo, indexLoader, reviewLoader, codeLoader, historyLoader, edgeCache });
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
          return getOrSetCachedJson(edgeCache, cacheRequest, request, async () => codeLoader(locator));
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
          return getOrSetCachedJson(edgeCache, cacheRequest, request, async () => historyLoader(locator));
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
          return getOrSetCachedJson(edgeCache, cacheRequest, request, async () => indexLoader(repo));
        } catch (error: unknown) {
          return json({ error: getErrorMessage(error) }, 502);
        }
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
          return getOrSetCachedJson(edgeCache, cacheRequest, request, async () => reviewLoader(locator));
        } catch (error: unknown) {
          return json({ error: getErrorMessage(error) }, 502);
        }
      }

      if (url.pathname === '/') {
        return html(renderIndexPage(parseRepoLocator('', defaultRepo)));
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
      const reviewApiUrl = new URL(`${url.origin}/api/${encodeURIComponent(locator.owner)}/${encodeURIComponent(locator.repo)}/pull/${locator.number}`);
      const initialData = await readCachedJsonData<PullRequestReviewData>(edgeCache, makeApiCacheRequest(reviewApiUrl));
      return html(renderReviewPage(locator, initialData));
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
  const pulls: PullRequestSummary[] = [];
  let after: string | null = null;
  for (let page = 1; page <= INDEX_MAX_PAGES; page += 1) {
    try {
      const response = await fetcher('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          ...createGithubHeaders(token),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          query: GRAPHQL_PULL_REQUEST_INDEX_QUERY,
          variables: { owner: repo.owner, name: repo.repo, after, first: INDEX_FRONT_PAGE_PULL_LIMIT },
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
      const connection = optionalRecord(repository?.pullRequests);
      const nodes = Array.isArray(connection?.nodes) ? connection.nodes : [];
      pulls.push(...nodes.map((node) => normalizeGraphqlPullRequestSummary(repo, node)));
      const pageInfo = optionalRecord(connection?.pageInfo);
      if (!booleanValue(pageInfo?.hasNextPage)) {
        break;
      }
      after = stringValue(pageInfo?.endCursor, '');
      if (!after) {
        warnings.push('GitHub GraphQL pagination stopped without an end cursor');
        break;
      }
    } catch (error: unknown) {
      warnings.push(`GitHub GraphQL pull request fetch failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }
  return {
    repo,
    pulls,
    updatedAt: deriveIndexUpdatedAt(pulls),
    warnings,
  };
}

const GRAPHQL_PULL_REQUEST_INDEX_QUERY = `
query DiffCockpitPullRequests($owner: String!, $name: String!, $after: String, $first: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: $first, after: $after, states: [OPEN, CLOSED, MERGED], orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
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
        author { login }
        headRefName
        headRefOid
        baseRefName
        baseRefOid
      }
    }
  }
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
    mergeability: normalizeMergeability(pull, lifecycleStatus),
  };
}

function normalizeMergeability(pull: GitHubPullRequest, lifecycleStatus: PullRequestLifecycleStatus): PullRequestMergeability {
  if (lifecycleStatus === 'merged') return 'merged';
  if (lifecycleStatus === 'closed') return 'closed';
  if (lifecycleStatus === 'draft') return 'draft';
  const state = pull.mergeableState.toLowerCase();
  if (['dirty', 'blocked', 'behind', 'unstable'].includes(state)) return 'conflicts';
  if (state === 'clean' || state === 'has_hooks') return 'mergeable';
  if (state && state !== 'unknown') return 'conflicts';
  if (pull.mergeable === true) return 'mergeable';
  if (pull.mergeable === false) return 'conflicts';
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
      pulls: scoped.filter((pull) => pull.lifecycleStatus === 'open' || pull.lifecycleStatus === 'draft'),
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

  if (deps.ctx) {
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
    const homepageRequest = new Request(homepageUrl, { headers: { accept: 'application/json' } });
    const homepageData = await deps.indexLoader(repo);
    await replaceCachedJson(deps.edgeCache, homepageRequest, cachedJson(homepageData, homepageRequest));
    const [codeResults, pullResults] = await Promise.all([
      Promise.all(codePaths.map((path) => refreshCodePathCache(deps, repo, path, requestOrigin))),
      Promise.all(pullNumbers.map((pullNumber) => refreshPullCache(deps, repo, pullNumber, requestOrigin))),
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
    const codeRequest = new Request(codeUrl, { headers: { accept: 'application/json' } });
    const historyRequest = new Request(historyUrl, { headers: { accept: 'application/json' } });
    const [codeData, historyData] = await Promise.all([
      deps.codeLoader({ owner: repo.owner, repo: repo.repo, ref: 'main', path }),
      deps.historyLoader({ owner: repo.owner, repo: repo.repo, ref: 'main', path }),
    ]);
    await Promise.all([
      replaceCachedJson(deps.edgeCache, codeRequest, cachedJson(codeData, codeRequest)),
      replaceCachedJson(deps.edgeCache, historyRequest, cachedJson(historyData, historyRequest)),
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
    const pullRequest = new Request(pullUrl, { headers: { accept: 'application/json' } });
    const pullData = await deps.reviewLoader({ owner: repo.owner, repo: repo.repo, number: pullNumber });
    await replaceCachedJson(deps.edgeCache, pullRequest, cachedJson(pullData, pullRequest));
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

const MEMORY_JSON_CACHE_TTL_MS = 5 * 60 * 1000;
const memoryJsonCache = new Map<string, MemoryCachedJson>();

function makeApiCacheRequest(url: URL): Request {
  return new Request(url.toString(), { headers: { accept: 'application/json' } });
}

async function getOrSetCachedJson(
  edgeCache: EdgeCache | null,
  cacheRequest: Request,
  clientRequest: Request,
  load: () => Promise<unknown>,
): Promise<Response> {
  try {
    const cached = await readCachedJson(edgeCache, cacheRequest, clientRequest);
    if (cached) return cached;
    const memoryCached = readMemoryCachedJson(cacheRequest, clientRequest);
    if (memoryCached) return memoryCached;
    const response = cachedJson(await load(), clientRequest);
    const cacheWriteStatus = await replaceCachedJson(edgeCache, cacheRequest, response);
    response.headers.set('x-diff-cockpit-cache-write', cacheWriteStatus);
    return response;
  } catch (error: unknown) {
    throw new Error(`failed to build cached JSON response: ${getErrorMessage(error)}`);
  }
}

async function readCachedJsonData<T>(edgeCache: EdgeCache | null, cacheRequest: Request): Promise<T | null> {
  try {
    if (edgeCache) {
      const cached = await edgeCache.match(cacheRequest);
      if (cached?.status === 200) {
        void writeMemoryCachedJson(cacheRequest, cached.clone());
        return await cached.clone().json() as T;
      }
    }
  } catch {
    // Fall through to the isolate-local cache.
  }
  return readMemoryCachedJsonData<T>(cacheRequest);
}
async function readCachedJson(edgeCache: EdgeCache | null, cacheRequest: Request, clientRequest: Request): Promise<Response | null> {
  try {
    if (edgeCache) {
      const cached = await edgeCache.match(cacheRequest);
      if (cached) {
        if (cached.status === 200) void writeMemoryCachedJson(cacheRequest, cached.clone());
        const etag = cached.headers.get('etag') || '';
        if (etag && clientRequest.headers.get('if-none-match') === etag) {
          return cachedJsonNotModified(etag);
        }
        return cached;
      }
    }
  } catch {
    // Fall through to the isolate-local cache.
  }
  return readMemoryCachedJson(cacheRequest, clientRequest);
}

async function replaceCachedJson(edgeCache: EdgeCache | null, cacheRequest: Request, response: Response): Promise<string> {
  if (response.status !== 200) return 'skip-status';
  await writeMemoryCachedJson(cacheRequest, response);
  try {
    if (!edgeCache) return 'memory';
    const cacheResponse = await cloneCacheableResponse(response);
    await edgeCache.put(cacheRequest, cacheResponse);
    return 'edge';
  } catch (error: unknown) {
    return `edge-error:${getErrorMessage(error).slice(0, 160)}`;
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
    return cachedJsonNotModified(cached.etag);
  }
  return cachedJsonBody(cached.body, cached.etag);
}

function readMemoryCachedJsonData<T>(cacheRequest: Request): T | null {
  const cached = getMemoryCachedJson(cacheRequest);
  if (!cached) return null;
  try {
    return JSON.parse(cached.body) as T;
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

function cachedJsonBody(body: string, etag: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      etag,
      'cache-control': 'public, max-age=30, s-maxage=300, stale-while-revalidate=1800',
      vary: 'Accept',
    },
  });
}

function cachedJsonNotModified(etag: string): Response {
  return new Response(null, {
    status: 304,
    headers: {
      etag,
      'cache-control': 'public, max-age=30, s-maxage=300, stale-while-revalidate=1800',
      vary: 'Accept',
    },
  });
}

function getDefaultEdgeCache(): EdgeCache | null {
  const maybeCaches = globalThis.caches as (CacheStorage & { default?: EdgeCache }) | undefined;
  return maybeCaches?.default ?? null;
}

function cachedJson(data: unknown, request: Request): Response {
  const body = JSON.stringify(data, null, 2);
  const etag = makeWeakEtag(body);
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        etag,
        'cache-control': 'public, max-age=30, s-maxage=300, stale-while-revalidate=1800',
        vary: 'Accept',
      },
    });
  }
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      etag,
      'cache-control': 'public, max-age=30, s-maxage=300, stale-while-revalidate=1800',
      vary: 'Accept',
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
:root { color-scheme: light; --paper:#f8f1e7; --surface:#fffaf3; --ink:#251d17; --muted:#6f6256; --quiet:#9b8d7f; --line:#decfbc; --soft:#efe3d2; --accent:#78533d; --accent-soft:#ead5bd; --danger:#9b2d2d; }
@media (prefers-color-scheme: dark) {
  :root { color-scheme: dark; --paper:#070a0d; --surface:#0b0f13; --ink:#edf1f5; --muted:#a2abb4; --quiet:#737c85; --line:#20262d; --soft:#12181e; --accent:#d4d8dd; --accent-soft:#1b222a; --danger:#ff9d9d; }
}
* { box-sizing:border-box; }
html { scroll-behavior:smooth; background:var(--paper); }
html, body, button, a { -webkit-tap-highlight-color: transparent; }
body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:var(--paper); }
::selection { background:var(--accent-soft); color:var(--ink); }
a { color:inherit; text-decoration:none; }
a:hover, button:hover, .brand:hover, .post-item h3 a:hover, .footer-links a:hover { color:var(--accent); text-decoration-line:underline; text-decoration-style:dotted; text-decoration-thickness:1px; text-underline-offset:4px; }
button { appearance:none; border:0; background:transparent; color:var(--ink); padding:0; font:inherit; cursor:pointer; }
button:focus:not(:focus-visible), a:focus:not(:focus-visible) { outline:none; }
button:focus-visible, a:focus-visible, .search-input:focus-visible { outline:2px solid var(--accent-soft); outline-offset:3px; }
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
.command-panel { width:min(640px, calc(100vw - 32px)); max-height:min(760px, calc(100vh - 80px)); overflow:auto; border:1px solid var(--line); border-radius:16px; background:var(--surface); box-shadow:0 24px 80px rgba(0,0,0,.42); }
.command-panel-head { display:flex; justify-content:space-between; gap:18px; padding:18px; border-bottom:1px solid var(--line); }
.command-kicker, .command-section-title { margin:0 0 6px; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
.command-panel h2 { margin:0 0 6px; font-size:30px; }
.command-caption { margin:0; color:var(--muted); font-size:13px; }
.command-close { color:var(--muted); }
.command-input-row { display:block; padding:14px 18px; border-bottom:1px solid var(--line); }
.command-input { width:100%; border:1px solid var(--line); border-radius:10px; background:var(--paper); color:var(--ink); padding:12px 14px; font:inherit; font-size:15px; outline:none; }
.command-input:focus { border-color:var(--accent); }
.command-section { padding:12px; border-bottom:1px solid var(--line); }
.command-list { display:grid; gap:6px; }
.command-item { width:100%; min-height:52px; display:grid; grid-template-columns:54px minmax(0,1fr); align-items:center; gap:12px; padding:9px 10px; border:1px solid transparent; border-radius:11px; text-align:left; }
.command-item:hover, .command-item:focus-visible { border-color:var(--line); background:var(--soft); text-decoration:none; }
.command-item strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:650; }
.command-item small { display:block; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--muted); }
.command-empty { padding:14px 10px; color:var(--muted); }
.command-foot { display:flex; gap:14px; justify-content:flex-end; padding:10px 14px; color:var(--quiet); font-size:12px; }
.mobile-command-fab { display:none; position:fixed; right:18px; bottom:18px; z-index:35; width:56px; height:56px; align-items:center; justify-content:center; border:1px solid var(--line); border-radius:999px; background:var(--surface); box-shadow:0 12px 30px rgba(0,0,0,.3); font-weight:800; }

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
.code-body pre { margin:0; font:13px/1.6 "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace; white-space:pre; }
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
.post-item:hover { background:var(--soft); }
.post-item h3 { margin:0; font-size:15px; line-height:1.35; letter-spacing:-.01em; font-weight:500; }
.post-meta { color:var(--quiet); font-size:13px; line-height:1.35; }
.post-item p { margin:0; color:var(--quiet); font-size:13px; line-height:1.55; overflow-wrap:anywhere; }
.pr-row-main { min-width:0; display:grid; gap:2px; }
.pr-title-line { display:flex; align-items:baseline; gap:10px; min-width:0; flex-wrap:wrap; }
.pr-title-line a { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pr-title-meta { color:var(--quiet); font-size:12px; font-weight:400; white-space:nowrap; }
.pr-subtitle { display:flex; align-items:center; gap:7px; min-width:0; color:var(--muted); font-size:13px; }
.pr-subtitle span { white-space:nowrap; }
.pr-row-side { display:grid; grid-template-columns:auto 120px 54px; align-items:center; justify-content:end; gap:12px; color:var(--quiet); font-size:13px; white-space:nowrap; min-width:260px; }
.status-set { display:inline-flex; align-items:center; gap:6px; }
.pr-delta { min-width:112px; text-align:right; color:var(--quiet); font-variant-numeric:tabular-nums; }
.pr-updated { min-width:42px; text-align:right; color:var(--quiet); font-variant-numeric:tabular-nums; }
.mergeability-icon, .review-icon, .check-icon { display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border:1px solid var(--line); border-radius:999px; font-size:11px; flex:0 0 auto; }
.mergeability-icon:empty, .review-icon:empty, .check-icon:empty { display:none; }
.mergeability-icon.mergeability-mergeable { color:#2f8a44; }
.mergeability-icon.mergeability-conflicts { color:#bc3b3b; }
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
.review-page { overflow:hidden; --file-pane-width:330px; }
.topbar { height:76px; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 18px; border-bottom:1px solid var(--line); background:var(--paper); }
.eyebrow { margin:0 0 4px; font-size:12px; color:var(--quiet); text-transform:uppercase; letter-spacing:.08em; }
.review-topbar h1 { margin:0; font-size:18px; line-height:1.2; letter-spacing:-.02em; }
#pr-meta { margin:4px 0 0; font-size:13px; }
.links { display:flex; align-items:center; gap:12px; white-space:nowrap; font-size:13px; }
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
.diff-fallback { margin:0; padding:0 0 18px; background:transparent; overflow:visible; max-width:100%; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word; font:13px/1.58 "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
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
.review-drawer { position:absolute; top:0; right:0; width:min(480px, 92vw); height:100%; transform:translateX(100%); transition:transform .16s ease; background:var(--surface); border-left:1px solid var(--line); box-shadow:-18px 0 45px rgba(0, 0, 0, .22); z-index:5; overflow:auto; }
body[data-review-drawer="open"] .review-drawer { transform:translateX(0); }
.drawer-head { position:sticky; top:0; z-index:2; display:flex; justify-content:space-between; align-items:center; padding:14px; border-bottom:1px solid var(--line); background:var(--surface); }
.drawer-content { padding:14px; display:grid; gap:16px; }
.action-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; }
.action-button { display:flex; justify-content:center; align-items:center; min-height:38px; border:1px solid var(--line); border-radius:10px; background:var(--paper); }
.drawer-section { border:1px solid var(--line); border-radius:12px; background:var(--paper); overflow:hidden; }
.drawer-section h2 { margin:0; padding:12px 12px 8px; font-size:13px; color:var(--ink); }
.comment-card, .commit-card { padding:10px 12px; border-top:1px solid var(--line); }
.summary-chip { margin-right:6px; cursor:pointer; }
.commit-popover { position:absolute; right:18px; top:88px; z-index:8; width:min(520px, calc(100vw - 36px)); max-height:min(620px, calc(100vh - 120px)); overflow:auto; border:1px solid var(--line); border-radius:14px; background:var(--surface); box-shadow:0 18px 50px rgba(0,0,0,.24); }
.commit-popover[hidden] { display:none; }
.commit-popover-head { position:sticky; top:0; z-index:1; display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 14px; border-bottom:1px solid var(--line); background:var(--surface); }
.commit-popover-list { display:grid; }
.commit-title { margin:0 0 4px; font-weight:650; }
.commit-delta { color:var(--quiet); }
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
  .pr-row-side { grid-template-columns:auto auto auto; justify-content:flex-start; flex-wrap:wrap; min-width:0; }
  .command-button { display:none; }
  .mobile-command-fab { display:flex; }
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
const cacheSchemaVersion = 'v2-mergeability';
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
const kindMatchesFilter = (pull) => activeFilter === 'all' || pull.kind === activeFilter || (activeFilter === 'failing' && (pull.mergeability === 'conflicts' || pull.checkStatus === 'failure')) || (activeFilter === 'open' && pull.lifecycleStatus === 'open') || (activeFilter === 'draft' && pull.lifecycleStatus === 'draft');
const queryMatchesPull = (pull) => !activeQuery.trim() || scorePullRequestSearchValue(pull, activeQuery) > 0;
function visiblePulls() { return pulls.filter((pull) => kindMatchesFilter(pull) && queryMatchesPull(pull) && (!activeStream || pull.associatedStream === activeStream)); }
function groupSections(source) {
  return [
    { id: 'streams', title: 'Streams', pulls: source.filter((pull) => pull.kind === 'stream' && (showAllStreams || pull.lifecycleStatus === 'open' || pull.lifecycleStatus === 'draft')) },
    { id: 'recently-merged', title: 'Merging and recently merged', pulls: source.filter((pull) => pull.lifecycleStatus === 'merged') },
    { id: 'open', title: 'Open', pulls: source.filter((pull) => pull.lifecycleStatus === 'open' || pull.lifecycleStatus === 'draft') },
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
  const subtitleText = stream + ' • ' + repoLabel + ' #' + pull.number + ' • ' + formatFileCount(pull.changedFiles);
  return '<article class="post-item pr-row" data-kind="' + escapeText(pull.kind) + '" data-state="' + escapeText(pull.lifecycleStatus) + '">' +
    '<div class="pr-row-main"><h3 class="pr-title-line"><a href="' + escapeText(route) + '" data-pr-route="' + escapeText(route) + '">' + escapeText(pull.title) + '</a></h3>' +
    '<p class="pr-subtitle" aria-label="' + escapeText(subtitleText) + '"><button class="stream-chip stream-compact-button" type="button" data-stream-filter="' + escapeText(stream) + '" title="Show stream task sessions">' + escapeText(stream) + '</button><span aria-hidden="true">•</span><span>' + escapeText(repoLabel) + ' #' + escapeText(pull.number) + '</span><span aria-hidden="true">•</span><span>' + escapeText(formatFileCount(pull.changedFiles)) + '</span></p></div>' +
    '<div class="pr-row-side"><span class="status-set"><span class="mergeability-icon mergeability-' + escapeText(pull.mergeability || 'unknown') + '" title="mergeability: ' + escapeText(pull.mergeability || 'unknown') + '">' + mergeabilityIcon(pull.mergeability) + '</span><span class="review-icon review-' + escapeText(pull.reviewStatus || 'unknown') + '" title="review: ' + escapeText(pull.reviewStatus || 'unknown') + '">' + reviewIcon(pull.reviewStatus) + '</span><span class="check-icon check-' + escapeText(pull.checkStatus || 'unknown') + '" title="checks: ' + escapeText(pull.checkStatus || 'unknown') + '">' + checkIcon(pull.checkStatus) + '</span></span><span class="pr-delta">' + formatDelta(pull) + '</span><span class="pr-updated">' + relativeTime(pull.updatedAt) + '</span></div></article>';
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
function filterCommandPages() { const query = commandInput ? commandInput.value.trim() : ''; pageCommandItems.forEach((item) => { const label = item.getAttribute('data-command-label') || item.textContent || ''; item.hidden = Boolean(query) && scoreSearchValue(label, query.toLowerCase(), normalizeSearchValue(query), splitSearchTokens(query), 1) === 0; }); }
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
function loadIndex() { const cached = loadCachedIndex(); fetch(apiPath, { headers: { accept: 'application/json' }, cache: 'no-cache' }).then((response) => { if (!response.ok) throw new Error('Live PR index fetch failed: ' + response.status); return response.json(); }).then((data) => { const merged = mergeIndexWithCache(data, cached); localStorage.setItem(cacheKey, JSON.stringify(merged)); applyIndexData(merged); }, (error) => { if (!pulls.length) sectionsRoot.innerHTML = '<section class="section error"><h2>Could not load pull requests</h2><p>' + escapeText(error.message || error) + '</p></section>'; }); }
document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => { activeFilter = button.dataset.filter; resetSectionLimits(); updateActiveFilterButtons(activeFilter); renderSections(); }));
clearStream.addEventListener('click', () => { activeStream = ''; resetSectionLimits(); renderSections(); });
commandTriggers.forEach((trigger) => trigger.addEventListener('click', () => { if (document.body.dataset.commandPaletteState === 'open') closeCommandPalette(); else openCommandPalette(); }));
if (commandClose) commandClose.addEventListener('click', closeCommandPalette);
if (commandBackdrop) commandBackdrop.addEventListener('click', closeCommandPalette);
if (commandInput) commandInput.addEventListener('input', () => { activeQuery = commandInput.value; resetSectionLimits(); filterCommandPages(); window.clearTimeout(commandInput.dataset.timer); commandInput.dataset.timer = String(window.setTimeout(renderSections, 80)); });
if (commandResults) commandResults.addEventListener('click', (event) => { const button = event.target.closest('[data-command-route]'); if (button) openPull(button.getAttribute('data-command-route')); });
if (commandPages) commandPages.addEventListener('click', (event) => { const button = event.target.closest('[data-command-page]'); if (button) runPageCommand(button); });
if (commandInput) commandInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { const firstPr = commandResults && commandResults.querySelector('[data-command-route]'); const firstPage = commandPages && commandPages.querySelector('[data-command-page]:not([hidden])'); if (firstPr) openPull(firstPr.getAttribute('data-command-route')); else if (firstPage) runPageCommand(firstPage); } });
document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (document.body.dataset.commandPaletteState === 'open') closeCommandPalette(); else openCommandPalette(); return; } if (event.key === 'Escape' && document.body.dataset.commandPaletteState === 'open') closeCommandPalette(); });
loadIndex();
`;
}
function renderReviewClientScript(apiPath: string): string {
  return `
const apiPath = ${JSON.stringify(apiPath)};
const state = { data: null, selected: null, diffModule: null, treeModule: null, activeFile: null, inlineCommentsVisible: true, currentView: false, observer: null, collapsedFolders: new Set() };
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
  mergeabilityButton: document.getElementById('mergeability-button'),
  mergePrButton: document.getElementById('merge-pr-button'),
  drawerSummary: document.getElementById('drawer-summary'),
  drawerStatus: document.getElementById('drawer-status'),
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

els.drawerToggle.addEventListener('click', () => {
  setDrawer(document.body.dataset.reviewDrawer !== 'open');
});
els.drawerClose.addEventListener('click', () => setDrawer(false));
els.mobileFilesToggle.addEventListener('click', () => setFilePaneDrawer(document.body.dataset.filePaneDrawer !== 'open'));
els.mobileFileBackdrop.addEventListener('click', () => setFilePaneDrawer(false));
els.copyAll.addEventListener('click', () => copyText(buildCommentsMarkdown()));
document.addEventListener('click', (event) => {
  const folderButton = event.target.closest('[data-folder-path]');
  if (folderButton) { toggleFolder(folderButton.dataset.folderPath); return; }
  const commitButton = event.target.closest('[data-open-commits]');
  if (commitButton) { renderCommitPopover(); return; }
  const closeCommits = event.target.closest('[data-close-commits]');
  if (closeCommits) { closeCommitPopover(); return; }
  const mergeabilityButton = event.target.closest('[data-open-mergeability]');
  if (mergeabilityButton) { renderMergeabilityPopover(); return; }
  const closeMergeability = event.target.closest('[data-close-mergeability]');
  if (closeMergeability) { closeMergeabilityPopover(); return; }
  const jumpButton = event.target.closest('[data-comment-jump]');
  if (jumpButton) navigateToComment(jumpButton.dataset.commentFile, jumpButton.dataset.commentLine);
});
els.openChatGpt.addEventListener('click', () => openChatGptPrompt());
els.copyCodex.addEventListener('click', () => copyText(buildCodexPrompt()));
els.mergeabilityButton.addEventListener('click', () => renderMergeabilityPopover());
els.mergePrButton.addEventListener('click', () => mergePullRequest());
document.addEventListener('keydown', (event) => {
  if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  if (event.key === 'd') setDrawer(document.body.dataset.reviewDrawer !== 'open');
  if (event.key === 'f') toggleFilePane();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'm') { event.preventDefault(); mergePullRequest(); return; }
  if (event.key === 'm') renderMergeabilityPopover();
  if (event.key === 'v') toggleCurrentView();
  if (event.key === 'i') toggleInlineComments();
  if (event.key === 'c') copyText(buildCommentsMarkdown());
  if (event.key === 'g') openChatGptPrompt();
  if (event.key === 'Escape') { setDrawer(false); setFilePaneDrawer(false); closeCommitPopover(); closeMergeabilityPopover(); }
});

const initialData = readInitialReviewData();
if (initialData) applyReviewData(initialData);
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
}

function loadLiveData() {
  fetch(apiPath, { headers: { accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error('Live PR fetch failed: ' + response.status);
      return response.json();
    })
    .then(
      (data) => {
        applyReviewData(data);
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

function renderHeader() {
  const pull = state.data.pull;
  const commentCount = state.data.comments ? state.data.comments.length : 0;
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
      setFilePaneDrawer(false);
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
  els.drawerStatus.innerHTML = '<h2>Status</h2><div class="comment-card"><span class="badge">' + escapeHtml(pull.state) + '</span> <button class="badge summary-chip" type="button" data-open-mergeability>mergeability: ' + escapeHtml(pull.mergeableState || 'unknown') + '</button> <span class="badge">open: ' + escapeHtml(String(pull.state === 'open')) + '</span></div>';
  els.drawerChecks.innerHTML = '<h2>Checks</h2>' + (checks.length ? checks.map(renderCheck).join('') : '<div class="comment-card muted">No checks found.</div>');
  els.drawerSummary.innerHTML = '<h2>Review summary</h2><div class="comment-card"><span class="badge">' + comments.length + ' comments</span> <button class="badge summary-chip" type="button" data-open-commits>' + commits.length + ' stream commits</button></div>';
  els.drawerComments.innerHTML = '<h2>Comments</h2>' + (comments.length ? comments.map(renderComment).join('') : '<div class="comment-card muted">No review comments found.</div>');
  els.drawerCommits.innerHTML = '<h2>Recent stream commits</h2>' + (commits.length ? commits.map(renderCommit).join('') : '<div class="commit-card muted">No stream commits found for this head branch.</div>');
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

function renderCommitPopover() {
  const commits = state.data?.streamCommits || [];
  els.commitPopover.hidden = false;
  els.commitPopover.innerHTML = '<div class="commit-popover-head"><strong>stream commits</strong><button type="button" data-close-commits>Close</button></div><div class="commit-popover-list">' + (commits.length ? commits.map(renderCommit).join('') : '<div class="commit-card muted">No stream commits found.</div>') + '</div>';
}

function closeCommitPopover() {
  els.commitPopover.hidden = true;
}
function renderMergeabilityPopover() {
  const pull = state.data?.pull || {};
  const files = state.data?.files || [];
  const stateLabel = String(pull.mergeableState || 'unknown').toLowerCase();
  const clean = stateLabel === 'clean';
  const dirty = ['dirty', 'blocked'].includes(stateLabel) || pull.mergeable === false;
  const title = clean ? 'clean' : escapeHtml(stateLabel || 'unknown');
  const fileList = dirty && files.length ? '<ul class="mergeability-files">' + files.map((file) => '<li>' + escapeHtml(file.filename) + '</li>').join('') + '</ul>' : '';
  const body = clean
    ? '<p class="muted">This PR reports a clean merge state.</p>'
    : dirty
      ? '<p class="muted">Files to inspect before merging:</p>' + fileList
      : '<p class="muted">This PR is mergeable but GitHub reports state: ' + escapeHtml(stateLabel || 'unknown') + '.</p>';
  els.mergeabilityPopover.hidden = false;
  els.mergeabilityPopover.innerHTML = '<div class="commit-popover-head"><strong>Mergeability</strong><button type="button" data-close-mergeability>Close</button></div><div class="commit-card"><p class="commit-title">' + title + '</p>' + body + '</div>';
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
  document.body.dataset.filePaneCollapsed = document.body.dataset.filePaneCollapsed === 'true' ? 'false' : 'true';
}

function toggleFolder(folderPath) {
  if (!folderPath) return;
  if (state.collapsedFolders.has(folderPath)) state.collapsedFolders.delete(folderPath);
  else state.collapsedFolders.add(folderPath);
  renderTree();
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
 

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
