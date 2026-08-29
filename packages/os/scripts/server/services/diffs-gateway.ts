import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

import {
  createGithubCodeBrowserLoader,
  createGithubCodeHistoryLoader,
  createGithubPullRequestIndexLoader,
  createGithubPullRequestLoader,
  renderCodeBrowserPage,
  renderHistoryPage,
  renderIndexPage,
  renderReviewPage,
  type CodeBrowserData,
  type CodeHistoryData,
  type PullRequestIndexData,
  type PullRequestReviewData,
  type RepoLocator,
} from '../vendor/diff-cockpit';
import {
  loadNodeYamlConfig,
  loadWorkspaceYamlConfig,
  resolveConsueloHomeLayout,
  type ConsueloWorkspaceYamlConfig,
} from '../../lib/consuelo-home';
import {
  withCredential,
  type CredentialBrokerPolicy,
} from '../../lib/credential-broker';
import {
  getGitHubSourceControlToken,
  githubInstallationConnectionId,
} from '../../lib/github-source-control-client';
import type { ControlPlaneAuditActor } from '../../lib/control-plane-audit';
import {
  buildWorkspaceSourceControlSnapshot,
  requireWorkspaceSourceControlCodePath,
  requireWorkspaceSourceControlRepository,
  sourceControlCacheNamespace,
  type RequiredWorkspaceSourceControlRepository,
  type WorkspaceSourceControlSnapshot,
} from '../../lib/source-control-config';
import {
  renderWorkspaceChromeBar,
  workspaceChromeClientScript,
  workspaceRouteSwitcherStyles,
  workspaceWindowShellStyles,
} from '../../lib/workspace-chrome';
import type { AuthenticatedMcpPrincipal } from '../security/authenticated-principal';

const DIFFS_PROVIDER_SCRIPT_ID = 'diffs-github-provider';
const READ_CACHE_TTL_MS = 30_000;
const CODE_CACHE_TTL_MS = 5 * 60_000;
const PRODUCT_READ_CACHE_MAX_ENTRIES = 256;
const GITHUB_MUTATION_TIMEOUT_MS = 15_000;

function renderWorkspaceDiffsDocument(html: string): string {
  const bodyMatch = /<body\b[^>]*>/i.exec(html);
  const headClose = html.toLowerCase().lastIndexOf('</head>');
  const bodyClose = html.toLowerCase().lastIndexOf('</body>');
  if (!bodyMatch || headClose < 0 || bodyClose < 0) {
    throw new DiffsGatewayError(
      'DIFFS_RENDER_INVALID',
      500,
      'Consuelo Diffs could not render inside the workspace shell.',
    );
  }

  const shellStyles = `
    :root { --site-color-paper:var(--paper,#faf7f2); --site-color-ink:var(--ink,#1c1a17); --site-color-canvas:#e9e4dc; }
    @media (prefers-color-scheme: dark) { :root { --site-color-canvas:#0d0d0c; } }
    ${workspaceWindowShellStyles()}
    ${workspaceRouteSwitcherStyles()}
    .workspace-diffs-view { min-width:0; min-height:0; }
    body.review-page .workspace-window { height:calc(100dvh - 28px); min-height:0; }
    body.review-page .workspace-diffs-view { height:100%; display:grid; grid-template-rows:auto minmax(0,1fr); overflow:hidden; }
    body.review-page .workspace-diffs-view > .layout { height:auto; min-height:0; }
    @media (max-width:900px) { body.review-page .workspace-window { height:100dvh; } }
  `;
  const styleTag = `<style id="consuelo-diffs-workspace-shell">${shellStyles.replaceAll('</style', '<\\/style')}</style>`;
  const chromeScript = `<script id="consuelo-diffs-workspace-chrome">${workspaceChromeClientScript().replaceAll('</script', '<\\/script')}</script>`;

  let framed = `${html.slice(0, headClose)}${styleTag}${html.slice(headClose)}`;
  const framedBodyMatch = /<body\b[^>]*>/i.exec(framed);
  if (!framedBodyMatch) {
    throw new DiffsGatewayError('DIFFS_RENDER_INVALID', 500, 'Consuelo Diffs body is unavailable.');
  }
  const bodyOpenEnd = framedBodyMatch.index + framedBodyMatch[0].length;
  framed = `${framed.slice(0, bodyOpenEnd)}<div class="workspace-window" data-workspace-shell>${renderWorkspaceChromeBar('diffs', 'Code')}<div class="workspace-view workspace-diffs-view" data-workspace-view>${framed.slice(bodyOpenEnd)}`;
  const framedBodyClose = framed.toLowerCase().lastIndexOf('</body>');
  return `${framed.slice(0, framedBodyClose)}</div></div>${chromeScript}${framed.slice(framedBodyClose)}`;
}

export class DiffsGatewayError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'DiffsGatewayError';
    this.code = code;
    this.status = status;
  }
}

type CacheEntry = { expiresAt: number; value: unknown };
const productReadCache = new Map<string, CacheEntry>();
type ManagedGitHubTokenEntry = { expiresAt: number; token: string };
const managedGitHubTokenCache = new Map<string, ManagedGitHubTokenEntry>();

function requireHome(home?: string): string {
  const resolved = home ?? process.env.CONSUELO_HOME ?? process.env.CONSUELO_OS_HOME;
  if (!resolved?.trim()) {
    throw new DiffsGatewayError('OS_HOME_REQUIRED', 500, 'Consuelo OS home is required for Diffs.');
  }
  return resolved;
}

function loadWorkspace(home: string, workspaceId: string): ConsueloWorkspaceYamlConfig {
  const layout = resolveConsueloHomeLayout(home);
  const workspacePath = layout.workspaceConfigPath(workspaceId);
  if (!fs.existsSync(workspacePath)) {
    throw new DiffsGatewayError(
      'WORKSPACE_NOT_FOUND',
      404,
      `Workspace configuration was not found for ${workspaceId}.`,
    );
  }
  return loadWorkspaceYamlConfig(workspacePath);
}

function requiredWorkspaceId(principal: AuthenticatedMcpPrincipal): string {
  const workspaceId = principal.workspaceId?.trim();
  if (!workspaceId) {
    throw new DiffsGatewayError('WORKSPACE_ID_REQUIRED', 403, 'Signed workspace identity is required.');
  }
  return workspaceId;
}

function actorFromPrincipal(
  principal: AuthenticatedMcpPrincipal,
  workspaceId: string,
  nodeId?: string,
): ControlPlaneAuditActor {
  return {
    actorType: principal.authMode === 'workspace-edge' ? 'user' : 'agent',
    actorId: principal.callerId || principal.subjectId || principal.principalKey,
    workspaceId,
    correlationId: randomUUID(),
    ...(nodeId ? { nodeId } : {}),
    ...(principal.appId ? { applicationId: principal.appId } : {}),
  };
}

function connectionPolicy(
  workspaceId: string,
  nodeId: string,
  connectionRef: string,
): CredentialBrokerPolicy {
  return {
    workspaceId,
    nodeId,
    grants: [{ bindingId: connectionRef, scriptIds: [DIFFS_PROVIDER_SCRIPT_ID] }],
  };
}

async function withGithubCredential<T>(input: {
  home: string;
  workspaceId: string;
  repository: RequiredWorkspaceSourceControlRepository;
  principal: AuthenticatedMcpPrincipal;
  operation: (token: string, cacheNamespace: string) => Promise<T>;
}): Promise<T> {
  const layout = resolveConsueloHomeLayout(input.home);
  const cacheNamespace = sourceControlCacheNamespace({
    workspaceId: input.workspaceId,
    connectionRef: input.repository.connectionRef,
    provider: input.repository.provider,
    owner: input.repository.owner,
    repo: input.repository.repository,
  });
  const managedConnectionId = githubInstallationConnectionId(input.repository.connectionRef);
  if (managedConnectionId) {
    try {
      const now = Date.now();
      const cached = managedGitHubTokenCache.get(managedConnectionId);
      if (cached && cached.expiresAt > now + 60_000) {
        return await input.operation(cached.token, cacheNamespace);
      }
      const credential = await getGitHubSourceControlToken({
        home: layout.home,
        connectionId: managedConnectionId,
      });
      const expiresAt = Date.parse(credential.expiresAt);
      managedGitHubTokenCache.set(managedConnectionId, {
        token: credential.token,
        expiresAt,
      });
      return await input.operation(credential.token, cacheNamespace);
    } catch (error: unknown) {
      if (error instanceof DiffsGatewayError) throw error;
      throw new DiffsGatewayError(
        'SOURCE_CONTROL_CONNECTION_UNAVAILABLE',
        503,
        `The GitHub connection for ${input.repository.nameWithOwner} is unavailable on this node.`,
      );
    }
  }
  if (!fs.existsSync(layout.nodeConfigPath)) {
    throw new DiffsGatewayError(
      'SOURCE_CONTROL_NODE_UNAVAILABLE',
      503,
      'This Consuelo node is not configured to resolve source-control credentials.',
    );
  }
  const nodeId = loadNodeYamlConfig(layout.nodeConfigPath).node.id;
  try {
    return await withCredential(
      {
        home: layout.home,
        nodeHome: layout.nodeDir,
        policy: connectionPolicy(input.workspaceId, nodeId, input.repository.connectionRef),
        actor: actorFromPrincipal(input.principal, input.workspaceId, nodeId),
        bindingId: input.repository.connectionRef,
        scriptId: DIFFS_PROVIDER_SCRIPT_ID,
      },
      (token) => input.operation(token, cacheNamespace),
    );
  } catch (error: unknown) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && ['CredentialMissing', 'UnknownBinding', 'ScriptNotPermitted'].includes(code)) {
      throw new DiffsGatewayError(
        'SOURCE_CONTROL_CONNECTION_UNAVAILABLE',
        503,
        `The source-control connection for ${input.repository.nameWithOwner} is unavailable on this node.`,
      );
    }
    throw error;
  }
}

function cacheKey(namespace: string, operation: string): string {
  return `${namespace}:${operation}`;
}

function pruneProductReadCache(now: number): void {
  for (const [cacheKeyValue, entry] of productReadCache.entries()) {
    if (entry.expiresAt <= now) productReadCache.delete(cacheKeyValue);
  }
  while (productReadCache.size >= PRODUCT_READ_CACHE_MAX_ENTRIES) {
    const oldestKey = productReadCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    productReadCache.delete(oldestKey);
  }
}

function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const existing = productReadCache.get(key);
  if (existing && existing.expiresAt > Date.now()) return Promise.resolve(existing.value as T);
  if (existing) productReadCache.delete(key);
  return loader()
    .then((value) => {
      const now = Date.now();
      pruneProductReadCache(now);
      productReadCache.set(key, { value, expiresAt: now + ttlMs });
      return value;
    })
    .catch((error: unknown) => {
      productReadCache.delete(key);
      throw error;
    });
}

function invalidateNamespace(namespace: string): void {
  for (const key of productReadCache.keys()) {
    if (key.startsWith(`${namespace}:`)) productReadCache.delete(key);
  }
}

function rebaseProductUrls<T>(value: T, repo: RepoLocator): T {
  const rawPrefix = `/${repo.owner}/${repo.repo}`;
  const encodedPrefix = `/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`;
  const visit = (input: unknown): unknown => {
    if (typeof input === 'string') {
      if (input.startsWith(encodedPrefix)) return `/diffs${input}`;
      if (encodedPrefix !== rawPrefix && input.startsWith(rawPrefix)) return `/diffs${input}`;
      return input;
    }
    if (Array.isArray(input)) return input.map(visit);
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.entries(input).map(([key, item]) => [key, visit(item)]));
    }
    return input;
  };
  return visit(value) as T;
}

function repositoryLocator(repository: RequiredWorkspaceSourceControlRepository): RepoLocator {
  return { owner: repository.owner, repo: repository.repository };
}

function requireRepository(
  config: ConsueloWorkspaceYamlConfig,
  owner?: string,
  repo?: string,
): RequiredWorkspaceSourceControlRepository {
  try {
    return requireWorkspaceSourceControlRepository(
      config,
      owner && repo ? { owner, repo } : undefined,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/connection/i.test(message)) {
      throw new DiffsGatewayError('SOURCE_CONTROL_CONNECTION_REQUIRED', 409, message);
    }
    if (/repository is not configured/i.test(message) || /default source-control project is not configured/i.test(message)) {
      throw new DiffsGatewayError('SOURCE_CONTROL_REPOSITORY_NOT_CONFIGURED', 404, message);
    }
    if (/provider/i.test(message)) {
      throw new DiffsGatewayError('SOURCE_CONTROL_PROVIDER_UNSUPPORTED', 409, message);
    }
    throw error;
  }
}

export function readDiffsWorkspaceSnapshot(input: {
  home?: string;
  principal: AuthenticatedMcpPrincipal;
}): WorkspaceSourceControlSnapshot {
  const home = requireHome(input.home);
  const workspaceId = requiredWorkspaceId(input.principal);
  return buildWorkspaceSourceControlSnapshot(loadWorkspace(home, workspaceId));
}

export function readDiffsRepository(input: {
  home?: string;
  principal: AuthenticatedMcpPrincipal;
  owner: string;
  repo: string;
}): RequiredWorkspaceSourceControlRepository {
  const home = requireHome(input.home);
  const workspaceId = requiredWorkspaceId(input.principal);
  return requireRepository(loadWorkspace(home, workspaceId), input.owner, input.repo);
}

export function loadDiffsPullRequestIndex(input: {
  home?: string;
  principal: AuthenticatedMcpPrincipal;
  owner: string;
  repo: string;
}): Promise<PullRequestIndexData> {
  const home = requireHome(input.home);
  const workspaceId = requiredWorkspaceId(input.principal);
  const repository = requireRepository(loadWorkspace(home, workspaceId), input.owner, input.repo);
  return withGithubCredential({
    home,
    workspaceId,
    repository,
    principal: input.principal,
    operation: (token, namespace) => cached(
      cacheKey(namespace, 'pulls'),
      READ_CACHE_TTL_MS,
      () => createGithubPullRequestIndexLoader({ token })(repositoryLocator(repository)),
    ).then((value) => rebaseProductUrls(value, repositoryLocator(repository))),
  });
}

export function loadDiffsPullRequest(input: {
  home?: string;
  principal: AuthenticatedMcpPrincipal;
  owner: string;
  repo: string;
  number: number;
}): Promise<PullRequestReviewData> {
  const home = requireHome(input.home);
  const workspaceId = requiredWorkspaceId(input.principal);
  const repository = requireRepository(loadWorkspace(home, workspaceId), input.owner, input.repo);
  return withGithubCredential({
    home,
    workspaceId,
    repository,
    principal: input.principal,
    operation: (token, namespace) => cached(
      cacheKey(namespace, `pull:${input.number}`),
      READ_CACHE_TTL_MS,
      () => createGithubPullRequestLoader({ token })({
        ...repositoryLocator(repository),
        number: input.number,
      }),
    ).then((value) => rebaseProductUrls(value, repositoryLocator(repository))),
  });
}

export function loadDiffsCode(input: {
  home?: string;
  principal: AuthenticatedMcpPrincipal;
  owner: string;
  repo: string;
  ref: string;
  path: string;
}): Promise<CodeBrowserData> {
  const home = requireHome(input.home);
  const workspaceId = requiredWorkspaceId(input.principal);
  const repository = requireRepository(loadWorkspace(home, workspaceId), input.owner, input.repo);
  const codePath = requireWorkspaceSourceControlCodePath(repository, input.path);
  return withGithubCredential({
    home,
    workspaceId,
    repository,
    principal: input.principal,
    operation: (token, namespace) => cached(
      cacheKey(namespace, `code:${input.ref}:${codePath}`),
      CODE_CACHE_TTL_MS,
      () => createGithubCodeBrowserLoader({ token })({
        ...repositoryLocator(repository),
        ref: input.ref,
        path: codePath,
      }),
    ).then((value) => rebaseProductUrls(value, repositoryLocator(repository))),
  });
}

export function loadDiffsHistory(input: {
  home?: string;
  principal: AuthenticatedMcpPrincipal;
  owner: string;
  repo: string;
  ref: string;
  path: string;
}): Promise<CodeHistoryData> {
  const home = requireHome(input.home);
  const workspaceId = requiredWorkspaceId(input.principal);
  const repository = requireRepository(loadWorkspace(home, workspaceId), input.owner, input.repo);
  const codePath = requireWorkspaceSourceControlCodePath(repository, input.path);
  return withGithubCredential({
    home,
    workspaceId,
    repository,
    principal: input.principal,
    operation: (token, namespace) => cached(
      cacheKey(namespace, `history:${input.ref}:${codePath}`),
      CODE_CACHE_TTL_MS,
      () => createGithubCodeHistoryLoader({ token })({
        ...repositoryLocator(repository),
        ref: input.ref,
        path: codePath,
      }),
    ).then((value) => rebaseProductUrls(value, repositoryLocator(repository))),
  });
}

function githubHeaders(token: string): HeadersInit {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'user-agent': 'consuelo-os-diffs',
    'x-github-api-version': '2022-11-28',
  };
}

async function githubPayload(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload = await response.json();
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

async function performGithubPullRequestMerge(input: {
  token: string;
  repository: RequiredWorkspaceSourceControlRepository;
  number: number;
}): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(input.repository.owner)}/${encodeURIComponent(input.repository.repository)}/pulls/${input.number}/merge`,
      {
        method: 'PUT',
        headers: { ...githubHeaders(input.token), 'content-type': 'application/json' },
        body: JSON.stringify({ merge_method: 'merge' }),
        signal: AbortSignal.timeout(GITHUB_MUTATION_TIMEOUT_MS),
      },
    );
    const payload = await githubPayload(response);
    if (!response.ok) {
      throw new DiffsGatewayError(
        'SOURCE_CONTROL_WRITE_FAILED',
        response.status,
        typeof payload.message === 'string' ? payload.message : `GitHub merge failed: ${response.status}`,
      );
    }
    return {
      ok: true,
      merged: payload.merged === true,
      sha: typeof payload.sha === 'string' ? payload.sha : '',
      message: typeof payload.message === 'string' ? payload.message : 'Merged',
    };
  } catch (error: unknown) {
    if (error instanceof DiffsGatewayError) throw error;
    throw new DiffsGatewayError('SOURCE_CONTROL_WRITE_FAILED', 502, 'GitHub merge request failed.');
  }
}

async function performGithubReviewThreadMutation(input: {
  token: string;
  threadId: string;
  action: 'resolve' | 'unresolve';
}): Promise<Record<string, unknown>> {
  try {
    const mutationName = input.action === 'resolve' ? 'resolveReviewThread' : 'unresolveReviewThread';
    const query = `mutation ConsueloDiffsReviewThread($threadId: ID!) { ${mutationName}(input: { threadId: $threadId }) { thread { id isResolved } } }`;
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { ...githubHeaders(input.token), 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables: { threadId: input.threadId } }),
      signal: AbortSignal.timeout(GITHUB_MUTATION_TIMEOUT_MS),
    });
    const payload = await githubPayload(response);
    if (!response.ok || Array.isArray(payload.errors)) {
      throw new DiffsGatewayError(
        'SOURCE_CONTROL_WRITE_FAILED',
        response.ok ? 502 : response.status,
        'GitHub review thread update failed.',
      );
    }
    return { ok: true, action: input.action, payload };
  } catch (error: unknown) {
    if (error instanceof DiffsGatewayError) throw error;
    throw new DiffsGatewayError('SOURCE_CONTROL_WRITE_FAILED', 502, 'GitHub review thread request failed.');
  }
}

export function mergeDiffsPullRequest(input: {
  home?: string;
  principal: AuthenticatedMcpPrincipal;
  owner: string;
  repo: string;
  number: number;
}): Promise<Record<string, unknown>> {
  const home = requireHome(input.home);
  const workspaceId = requiredWorkspaceId(input.principal);
  const repository = requireRepository(loadWorkspace(home, workspaceId), input.owner, input.repo);
  return withGithubCredential({
    home,
    workspaceId,
    repository,
    principal: input.principal,
    operation: (token, namespace) => performGithubPullRequestMerge({
      token,
      repository,
      number: input.number,
    }).then((result) => {
      invalidateNamespace(namespace);
      return result;
    }),
  });
}

export function mutateDiffsReviewThread(input: {
  home?: string;
  principal: AuthenticatedMcpPrincipal;
  owner: string;
  repo: string;
  number: number;
  threadId: string;
  action: 'resolve' | 'unresolve';
}): Promise<Record<string, unknown>> {
  const home = requireHome(input.home);
  const workspaceId = requiredWorkspaceId(input.principal);
  const repository = requireRepository(loadWorkspace(home, workspaceId), input.owner, input.repo);
  if (!input.threadId.trim()) {
    throw new DiffsGatewayError('INVALID_REVIEW_THREAD', 400, 'Review thread id is required.');
  }
  return withGithubCredential({
    home,
    workspaceId,
    repository,
    principal: input.principal,
    operation: (token, namespace) => performGithubReviewThreadMutation({
      token,
      threadId: input.threadId,
      action: input.action,
    }).then((result) => {
      invalidateNamespace(namespace);
      return result;
    }),
  });
}

function productRenderOptions(repository: RequiredWorkspaceSourceControlRepository) {
  return {
    mountPath: '/diffs',
    apiBasePath: '/gateway/diffs/repositories',
    writeApiBasePath: '/gateway/diffs/write/repositories',
    codeRoot: repository.codeRoots[0] ?? '',
    defaultBranch: repository.defaultBranch,
  };
}

export function renderDiffsIndex(input: {
  home?: string;
  principal: AuthenticatedMcpPrincipal;
  owner?: string;
  repo?: string;
}): string {
  const home = requireHome(input.home);
  const workspaceId = requiredWorkspaceId(input.principal);
  const config = loadWorkspace(home, workspaceId);
  const snapshot = buildWorkspaceSourceControlSnapshot(config);
  if (!snapshot.configured && !input.owner && !input.repo) return renderSourceControlSetupPage();
  const repository = requireRepository(config, input.owner, input.repo);
  return renderWorkspaceDiffsDocument(
    renderIndexPage(repositoryLocator(repository), null, '', productRenderOptions(repository)),
  );
}

export function renderDiffsReview(input: {
  home?: string;
  principal: AuthenticatedMcpPrincipal;
  owner: string;
  repo: string;
  number: number;
}): string {
  const home = requireHome(input.home);
  const workspaceId = requiredWorkspaceId(input.principal);
  const repository = requireRepository(loadWorkspace(home, workspaceId), input.owner, input.repo);
  return renderWorkspaceDiffsDocument(
    renderReviewPage(
      { ...repositoryLocator(repository), number: input.number },
      null,
      '',
      productRenderOptions(repository),
    ),
  );
}

export function renderDiffsCode(input: {
  home?: string;
  principal: AuthenticatedMcpPrincipal;
  owner: string;
  repo: string;
  ref: string;
  path: string;
}): string {
  const home = requireHome(input.home);
  const workspaceId = requiredWorkspaceId(input.principal);
  const repository = requireRepository(loadWorkspace(home, workspaceId), input.owner, input.repo);
  const codePath = requireWorkspaceSourceControlCodePath(repository, input.path);
  return renderWorkspaceDiffsDocument(
    renderCodeBrowserPage(
      repositoryLocator(repository),
      input.ref,
      codePath,
      productRenderOptions(repository),
    ),
  );
}

export function renderDiffsHistory(input: {
  home?: string;
  principal: AuthenticatedMcpPrincipal;
  owner: string;
  repo: string;
  ref: string;
  path: string;
}): string {
  const home = requireHome(input.home);
  const workspaceId = requiredWorkspaceId(input.principal);
  const repository = requireRepository(loadWorkspace(home, workspaceId), input.owner, input.repo);
  const codePath = requireWorkspaceSourceControlCodePath(repository, input.path);
  return renderWorkspaceDiffsDocument(
    renderHistoryPage(
      repositoryLocator(repository),
      input.ref,
      codePath,
      productRenderOptions(repository),
    ),
  );
}

export function renderSourceControlSetupPage(): string {
  return renderWorkspaceDiffsDocument(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Consuelo Diffs · Connect GitHub</title>
  <style>
    :root{color-scheme:light dark;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;--paper:#faf7f2;--ink:#1c1a17;background:var(--paper);color:var(--ink)}
    @media(prefers-color-scheme:dark){:root{--paper:#0f0f0d;--ink:#f7efe7}}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px}
    main{width:min(720px,calc(100% - 48px));margin:clamp(48px,10vh,120px) auto;border:1px solid color-mix(in srgb,currentColor 20%,transparent);padding:clamp(28px,6vw,64px)}
    p{line-height:1.6;max-width:60ch}a{color:inherit;text-underline-offset:4px}code{font:inherit}.button{display:inline-block;margin-top:8px;padding:10px 14px;border:1px solid currentColor;text-decoration:none}
  </style>
</head>
<body><main><p>Consuelo Diffs</p><h1>Connect GitHub</h1><p>Choose repositories on GitHub, then Consuelo will bring you back here with the selected repositories ready for Diffs.</p><a class="button" href="/gateway/configuration/source-control/github/connect?return_to=%2Fdiffs">Connect GitHub</a></main></body>
</html>`);
}

export function clearDiffsGatewayCacheForTests(): void {
  productReadCache.clear();
  managedGitHubTokenCache.clear();
}
