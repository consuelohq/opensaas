import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { Effect } from 'effect';

import { discoverStreamAreas } from './inventory';
import { readStreamInstructionsEffect } from './instructions';
import type { StreamInstructionResult } from './types';

const require = createRequire(import.meta.url);
const { getToken, listPullRequests } = require('../github.js');
const { fetchOrigin, listWorktrees, refExists, runGit, runGitMaybe } = require('../git.js');
const { DEFAULT_REPO, resolveGitRoot } = require('../paths.js');
const { getDefaultStreamBranch, normalizeArea, parseStreamBranchName, parseTaskBranchName } = require('../validation.js');
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, '..', '..', '..');

type AheadBehind = { ahead: number; behind: number };
type WorktreeRecord = {
  branch?: string;
  path: string;
  detached?: boolean;
  prunable?: boolean;
  locked?: boolean;
};
type RelatedWorktree = {
  branch: string;
  path: string;
  current: boolean;
  detached: boolean;
  prunable: boolean;
  locked: boolean;
  missingPath: boolean;
};
type GitHubPullRequest = {
  number: number;
  title: string;
  html_url: string;
  head?: { ref: string };
  base?: { ref: string };
  user?: { login: string };
  draft?: boolean;
};
type PullRequestSummary = {
  number: number;
  title: string;
  url: string;
  branch: string | null;
  author: string | null;
  draft: boolean;
};
type PullRequestIndex = {
  skipped: boolean;
  reason: string | null;
  byBase: Map<string, PullRequestSummary[]>;
};
type StreamListEntry = {
  area: string;
  stream: string;
  discoveredFrom: string[];
  instructions: StreamInstructionResult;
  local: { exists: boolean; ref: string };
  remote: { exists: boolean; ref: string };
  aheadBehind: AheadBehind | null;
  worktrees: { count: number; staleCount: number; items: RelatedWorktree[] };
  taskBranches: { localCount: number; branches: string[] };
  pullRequests: {
    skipped: boolean;
    reason: string | null;
    count: number;
    items: PullRequestSummary[];
  };
  warnings: string[];
};
export type StreamListResult = {
  repo: string;
  repoRoot: string;
  generatedAt: string;
  filters: { area: string | null; all: boolean };
  fetch: { skipped: boolean; success: boolean; reason: string | null };
  streams: StreamListEntry[];
  summary: { streamCount: number; warningCount: number };
};

export function fetchOriginWithFallback(fetcher: () => unknown): StreamListResult['fetch'] {
  try {
    fetcher();
    return { skipped: false, success: true, reason: null };
  } catch (cause: unknown) {
    return {
      skipped: false,
      success: false,
      reason: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

function listRefs(repoRoot: string, refs: string[]): string[] {
  const output = runGitMaybe(['for-each-ref', '--format=%(refname:short)', ...refs], { cwd: repoRoot }) || '';
  return output.split('\n').map((value: string) => value.trim()).filter(Boolean);
}

function getAheadBehind(repoRoot: string, streamBranch: string): AheadBehind | null {
  const localRef = `refs/heads/${streamBranch}`;
  const remoteRef = `refs/remotes/origin/${streamBranch}`;
  if (!refExists(repoRoot, localRef) || !refExists(repoRoot, remoteRef)) return null;
  const output = runGit(['rev-list', '--left-right', '--count', `${localRef}...${remoteRef}`], { cwd: repoRoot });
  const [ahead, behind] = output.split(/\s+/).map((value: string) => Number.parseInt(value, 10));
  return { ahead: Number.isFinite(ahead) ? ahead : 0, behind: Number.isFinite(behind) ? behind : 0 };
}

function relatedWorktrees(
  allWorktrees: WorktreeRecord[],
  area: string,
  currentDirectory: string,
): RelatedWorktree[] {
  return allWorktrees.filter((worktree) => {
    if (!worktree.branch) return false;
    return parseTaskBranchName(worktree.branch)?.area === area || parseStreamBranchName(worktree.branch)?.area === area;
  }).map((worktree) => ({
    branch: worktree.branch as string,
    path: worktree.path,
    current: path.resolve(worktree.path) === path.resolve(currentDirectory),
    detached: Boolean(worktree.detached),
    prunable: Boolean(worktree.prunable),
    locked: Boolean(worktree.locked),
    missingPath: !fs.existsSync(worktree.path),
  }));
}

async function openPullRequestsByBase(repository: string): Promise<PullRequestIndex> {
  try {
    const token = getToken() as string;
    const pullRequests = await listPullRequests({ token, repository, state: 'open' }) as GitHubPullRequest[];
    const byBase = new Map<string, PullRequestSummary[]>();
    for (const pullRequest of pullRequests) {
      const base = pullRequest.base?.ref;
      if (!base) continue;
      const items = byBase.get(base) || [];
      items.push({
        number: pullRequest.number,
        title: pullRequest.title,
        url: pullRequest.html_url,
        branch: pullRequest.head?.ref ?? null,
        author: pullRequest.user?.login ?? null,
        draft: Boolean(pullRequest.draft),
      });
      byBase.set(base, items);
    }
    return { skipped: false, reason: null, byBase };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : 'github request failed';
    return {
      skipped: true,
      reason: reason.includes('missing github token') ? 'missing github token' : reason,
      byBase: new Map<string, PullRequestSummary[]>(),
    };
  }
}

function streamWarnings(stream: Omit<StreamListEntry, 'warnings'>): string[] {
  const result: string[] = [];
  if (!stream.local.exists) result.push('local stream missing');
  if (!stream.remote.exists) result.push('remote stream missing');
  if (stream.local.exists && !stream.remote.exists) result.push('local branch detached from remote');
  if (stream.aheadBehind?.ahead > 0 && stream.aheadBehind?.behind > 0) result.push('local stream diverged from remote');
  else if (stream.aheadBehind?.behind > 0) result.push('local stream behind remote');
  else if (stream.aheadBehind?.ahead > 0) result.push('local stream ahead of remote');
  if (stream.worktrees.staleCount > 0) result.push('stale worktrees');
  return result;
}

export function buildStreamListEffect(input: { area?: string; repo?: string; all?: boolean }) {
  return Effect.gen(function* () {
    const repo = input.repo || DEFAULT_REPO;
    const repoRoot = resolveGitRoot(process.cwd());
    const requestedArea = input.area ? normalizeArea(input.area) : undefined;
    const fetchResult = yield* Effect.sync(() => fetchOriginWithFallback(() => fetchOrigin(repoRoot)));
    const localBranches = listRefs(repoRoot, ['refs/heads/stream']);
    const remoteRefs = listRefs(repoRoot, ['refs/remotes/origin/stream']);
    const remoteBranches = remoteRefs.map((branch) => branch.replace(/^origin\//, ''));
    const areas = discoverStreamAreas({ localBranches, remoteBranches, requestedArea });
    const localTasks = listRefs(repoRoot, ['refs/heads/task']);
    const allWorktrees = listWorktrees(repoRoot) as WorktreeRecord[];
    const prs = yield* Effect.promise(() => openPullRequestsByBase(repo));
    const streams = yield* Effect.all(areas.map((area) => Effect.gen(function* () {
      const stream = getDefaultStreamBranch(area);
      const instructions = yield* readStreamInstructionsEffect({ streamsRoot: path.join(packageRoot, 'streams'), area });
      const localExists = refExists(repoRoot, `refs/heads/${stream}`);
      const remoteExists = refExists(repoRoot, `refs/remotes/origin/${stream}`);
      const worktreeItems = relatedWorktrees(allWorktrees, area, process.cwd());
      const taskBranches = localTasks.filter((branch) => parseTaskBranchName(branch)?.area === area);
      const openPullRequests = prs.byBase.get(stream) || [];
      const baseEntry: Omit<StreamListEntry, 'warnings'> = {
        area,
        stream,
        discoveredFrom: [
          ...(localBranches.includes(stream) ? ['local-branch'] : []),
          ...(remoteBranches.includes(stream) ? ['remote-branch'] : []),
        ],
        instructions,
        local: { exists: localExists, ref: `refs/heads/${stream}` },
        remote: { exists: remoteExists, ref: `refs/remotes/origin/${stream}` },
        aheadBehind: getAheadBehind(repoRoot, stream),
        worktrees: {
          count: worktreeItems.length,
          staleCount: worktreeItems.filter((entry) => entry.prunable || entry.detached || entry.missingPath).length,
          items: worktreeItems,
        },
        taskBranches: { localCount: taskBranches.length, branches: taskBranches },
        pullRequests: prs.skipped
          ? { skipped: true, reason: prs.reason, count: 0, items: [] }
          : { skipped: false, reason: null, count: openPullRequests.length, items: openPullRequests },
      };
      return { ...baseEntry, warnings: streamWarnings(baseEntry) } satisfies StreamListEntry;
    })), { concurrency: 'unbounded' });
    return {
      repo,
      repoRoot,
      generatedAt: new Date().toISOString(),
      filters: { area: requestedArea ?? null, all: Boolean(input.all) },
      fetch: fetchResult,
      streams,
      summary: {
        streamCount: streams.length,
        warningCount: streams.reduce((count, stream) => count + stream.warnings.length, 0),
      },
    } satisfies StreamListResult;
  });
}

function line(value = ''): void {
  process.stdout.write(`${value}\n`);
}

export function printStreamList(result: StreamListResult, json: boolean, all: boolean): void {
  if (json) {
    line(JSON.stringify(result, null, 2));
    return;
  }
  line(`repo: ${result.repo}`);
  line(`streams: ${result.summary.streamCount}`);
  for (const stream of result.streams) {
    line(`${stream.stream}  instructions=${stream.instructions.exists ? 'yes' : 'no'}  local=${stream.local.exists ? 'yes' : 'no'}  remote=${stream.remote.exists ? 'yes' : 'no'}  warnings=${stream.warnings.join('; ') || '-'}`);
    if (all && stream.instructions.exists) line(`  instructions: ${stream.instructions.path}`);
  }
}
