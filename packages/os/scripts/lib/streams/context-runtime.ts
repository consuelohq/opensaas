import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { Effect } from 'effect';

import { readStreamInstructionsEffect } from './instructions';
import { filterRecentWorkpads } from './workpads';
import type { StreamInstructionResult, StreamWorkpad, WorkpadRow } from './types';

const require = createRequire(import.meta.url);
const { getToken, listPullRequests } = require('../github.js');
const { fetchOrigin, listWorktrees, refExists, runGit } = require('../git.js');
const { DEFAULT_REPO, resolveGitRoot } = require('../paths.js');
const {
  assertStreamBranchName,
  getDefaultStreamBranch,
  normalizeArea,
  parseStreamBranchName,
  parseTaskBranchName,
} = require('../validation.js');

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, '..', '..', '..');

export type StreamContextArgs = {
  area: string;
  stream?: string;
  repo?: string;
};

type MemoryEnv = { url?: string; key?: string };
type StreamDecision = { title: string; date: string };
type AheadBehind = { ahead: number; behind: number };
type StreamWorktree = { branch: string; path: string };
type PullRequestSummary = {
  number: number;
  title: string;
  url: string;
  branch: string;
  author: string | null;
};
type RecentWorkpadsResult = {
  skipped: boolean;
  reason: string | null;
  workpads: StreamWorkpad[];
};
type OpenTaskPullRequestsResult = {
  skipped: boolean;
  reason: string | null;
  pullRequests: PullRequestSummary[];
};
export type StreamContextResult = {
  area: string;
  stream: string;
  instructions: StreamInstructionResult;
  decisions: StreamDecision[];
  openTaskPullRequests: OpenTaskPullRequestsResult;
  recentCommits: string[];
  recentWorkpads: RecentWorkpadsResult;
  aheadBehind: AheadBehind | null;
  worktrees: StreamWorktree[];
};

type GitHubPullRequest = {
  number: number;
  title: string;
  html_url: string;
  head?: { ref: string };
  user?: { login: string };
};

function loadEnv(): MemoryEnv {
  const envPaths = [path.join(packageRoot, '.env'), path.join(packageRoot, '..', '.env')];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, 'utf8');
    const url = (content.match(/SUPABASE_URL=(.+)/) || [])[1];
    const key = (content.match(/SUPABASE_KEY=(.+)/) || [])[1];
    if (url && key) return { url: url.trim(), key: key.trim() };
  }
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY,
  };
}

async function fetchMemoryRows(
  env: Required<MemoryEnv>,
  filters: Record<string, string>,
  limit: number,
): Promise<WorkpadRow[]> {
  try {
    const url = new URL(`${env.url}/rest/v1/memories`);
    url.searchParams.set('select', 'title,content,category,created_at');
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    url.searchParams.set('order', 'created_at.desc');
    url.searchParams.set('limit', String(limit));
    const response = await fetch(url.toString(), {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    });
    if (!response.ok) return [];
    return await response.json() as WorkpadRow[];
  } catch (_error: unknown) {
    return [];
  }
}

async function getRecentWorkpads(
  area: string,
  streamBranch: string,
  limit = 3,
): Promise<RecentWorkpadsResult> {
  try {
    const env = loadEnv();
    if (!env.url || !env.key) {
      return { skipped: true, reason: 'missing supabase credentials', workpads: [] };
    }
    const normalizedArea = normalizeArea(area);
    const taskBranchPrefix = `task/${normalizedArea}/`;
    const queryLimit = Math.max(limit * 5, 15);
    const queries = [
      { category: 'eq.workpad', title: `ilike.*${taskBranchPrefix}*` },
      { category: 'eq.workpad', content: `ilike.*${streamBranch}*` },
      { category: 'not.eq.stream-decision', title: `ilike.*${taskBranchPrefix}*` },
      { category: 'not.eq.stream-decision', content: `ilike.*${streamBranch}*` },
    ];
    const rows: WorkpadRow[] = [];
    for (const filters of queries) rows.push(...await fetchMemoryRows(env as Required<MemoryEnv>, filters, queryLimit));
    return {
      skipped: false,
      reason: null,
      workpads: filterRecentWorkpads(rows, normalizedArea, streamBranch, limit),
    };
  } catch (error: unknown) {
    return {
      skipped: true,
      reason: error instanceof Error ? error.message : 'workpad lookup failed',
      workpads: [],
    };
  }
}

async function getStreamDecisions(area: string, limit = 10): Promise<StreamDecision[]> {
  try {
    const env = loadEnv();
    if (!env.url || !env.key) return [];
    const url = new URL(`${env.url}/rest/v1/memories`);
    url.searchParams.set('select', 'title,created_at');
    url.searchParams.set('category', 'eq.stream-decision');
    url.searchParams.set('title', `ilike.*${area}*`);
    url.searchParams.set('order', 'created_at.desc');
    url.searchParams.set('limit', String(limit));
    const response = await fetch(url.toString(), {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    });
    if (!response.ok) return [];
    const rows = await response.json() as Array<{ title: string; created_at?: string }>;
    return rows.map((row) => ({
      title: row.title,
      date: row.created_at ? row.created_at.slice(0, 10) : '',
    }));
  } catch (_error: unknown) {
    return [];
  }
}

function getRecentCommits(repoRoot: string, streamBranch: string): string[] {
  const candidates = [`refs/remotes/origin/${streamBranch}`, `refs/heads/${streamBranch}`];
  const ref = candidates.find((candidate) => refExists(repoRoot, candidate));
  if (!ref) return [];
  const output = runGit(['log', '--format=%h %ai %s', '-25', ref], { cwd: repoRoot });
  return output ? output.split('\n').filter(Boolean) : [];
}

function getAheadBehind(repoRoot: string, streamBranch: string): AheadBehind | null {
  const localRef = `refs/heads/${streamBranch}`;
  const remoteRef = `refs/remotes/origin/${streamBranch}`;
  if (!refExists(repoRoot, localRef) || !refExists(repoRoot, remoteRef)) return null;
  const output = runGit(['rev-list', '--left-right', '--count', `${localRef}...${remoteRef}`], { cwd: repoRoot });
  const [ahead, behind] = output.split(/\s+/).map((value: string) => Number.parseInt(value, 10));
  return { ahead: Number.isFinite(ahead) ? ahead : 0, behind: Number.isFinite(behind) ? behind : 0 };
}

function getAreaWorktrees(repoRoot: string, area: string): StreamWorktree[] {
  return (listWorktrees(repoRoot) as Array<{ branch?: string; path: string }>)
    .filter((worktree) => {
      if (!worktree.branch) return false;
      const taskBranch = parseTaskBranchName(worktree.branch);
      if (taskBranch?.area === area) return true;
      const streamBranch = parseStreamBranchName(worktree.branch);
      return Boolean(streamBranch?.area === area);
    })
    .map((worktree) => ({ branch: worktree.branch as string, path: worktree.path }))
    .sort((left, right) => left.branch.localeCompare(right.branch));
}

async function getOpenTaskPullRequests(
  repo: string,
  area: string,
  streamBranch: string,
): Promise<OpenTaskPullRequestsResult> {
  try {
    const token = getToken() as string;
    const pullRequests = await listPullRequests({ token, repository: repo, state: 'open', base: streamBranch }) as GitHubPullRequest[];
    return {
      skipped: false,
      reason: null,
      pullRequests: pullRequests
        .filter((pullRequest) => pullRequest.head?.ref.startsWith(`task/${area}/`))
        .map((pullRequest) => ({
          number: pullRequest.number,
          title: pullRequest.title,
          url: pullRequest.html_url,
          branch: pullRequest.head?.ref ?? '',
          author: pullRequest.user?.login ?? null,
        })),
    };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : 'github request failed';
    return {
      skipped: true,
      reason: reason.includes('missing github token') ? 'missing github token' : reason,
      pullRequests: [],
    };
  }
}

export function buildStreamContextEffect(input: StreamContextArgs) {
  return Effect.gen(function* () {
    const area = normalizeArea(input.area);
    const stream = input.stream || getDefaultStreamBranch(area);
    const repo = input.repo || DEFAULT_REPO;
    assertStreamBranchName(stream, area);
    const repoRoot = resolveGitRoot(process.cwd());
    yield* Effect.try({
      try: () => fetchOrigin(repoRoot),
      catch: (cause) => new Error(`git fetch origin failed: ${cause instanceof Error ? cause.message : String(cause)}`),
    });
    const instructions = yield* readStreamInstructionsEffect({ streamsRoot: path.join(packageRoot, 'streams'), area });
    const [decisions, openTaskPullRequests, recentWorkpads] = yield* Effect.all([
      Effect.promise(() => getStreamDecisions(area)),
      Effect.promise(() => getOpenTaskPullRequests(repo, area, stream)),
      Effect.promise(() => getRecentWorkpads(area, stream)),
    ], { concurrency: 'unbounded' });
    return {
      area,
      stream,
      instructions,
      decisions,
      openTaskPullRequests,
      recentCommits: getRecentCommits(repoRoot, stream),
      recentWorkpads,
      aheadBehind: getAheadBehind(repoRoot, stream),
      worktrees: getAreaWorktrees(repoRoot, area),
    } satisfies StreamContextResult;
  });
}

function writeLine(value = ''): void {
  process.stdout.write(`${value}\n`);
}

function writeInstructions(result: StreamInstructionResult): void {
  writeLine('');
  writeLine('stream instructions:');
  if (!result.exists) {
    writeLine('  - none (optional)');
    return;
  }
  writeLine(`  path: ${result.path}`);
  writeLine('');
  process.stdout.write(result.content);
  if (!result.content.endsWith('\n')) process.stdout.write('\n');
}

export function printStreamContext(result: StreamContextResult, json: boolean): void {
  if (json) {
    writeLine(JSON.stringify(result, null, 2));
    return;
  }
  writeLine(`stream: ${result.stream}`);
  if (result.aheadBehind) writeLine(`ahead/behind vs origin: ${result.aheadBehind.ahead}/${result.aheadBehind.behind}`);
  else writeLine('ahead/behind vs origin: unavailable');
  writeInstructions(result.instructions);
  writeLine('');
  writeLine('stream decisions:');
  if (result.decisions.length === 0) writeLine('  - none yet');
  else for (const decision of result.decisions) writeLine(`  - ${decision.title}  (${decision.date})`);
  writeLine('');
  writeLine('local worktrees:');
  if (result.worktrees.length === 0) writeLine('  - none');
  else for (const worktree of result.worktrees) writeLine(`  - ${worktree.branch} -> ${worktree.path}`);
  writeLine('');
  writeLine('open task prs:');
  if (result.openTaskPullRequests.skipped) writeLine(`  - skipped (${result.openTaskPullRequests.reason})`);
  else if (result.openTaskPullRequests.pullRequests.length === 0) writeLine('  - none');
  else for (const pullRequest of result.openTaskPullRequests.pullRequests) writeLine(`  - #${pullRequest.number} ${pullRequest.branch} :: ${pullRequest.title}`);
  writeLine('');
  writeLine(`recent workpads (${result.recentWorkpads.workpads.length}):`);
  if (result.recentWorkpads.skipped) writeLine(`  - skipped (${result.recentWorkpads.reason})`);
  else if (result.recentWorkpads.workpads.length === 0) writeLine('  - none');
  else {
    for (const workpad of result.recentWorkpads.workpads) {
      writeLine(`  - [${workpad.category}] ${workpad.title} (${workpad.date})`);
      process.stdout.write(workpad.content);
      if (!workpad.content.endsWith('\n')) process.stdout.write('\n');
    }
  }
  writeLine('');
  writeLine(`recent commits (${result.recentCommits.length}):`);
  if (result.recentCommits.length === 0) writeLine('  - none');
  else for (const commit of result.recentCommits) writeLine(`  - ${commit}`);
}
