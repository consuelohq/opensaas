import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { BranchResolution, TaskCandidate } from './types';

type WorktreeEntry = {
  path: string;
  branch: string;
};

type TaskMeta = {
  area?: string;
  taskBranch?: string;
  branch?: string;
  prNumber?: number;
  taskPrNumber?: number;
  worktreePath?: string;
};

export type ResolveTaskBranchOptions = {
  explicitBranch?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  currentTask?: TaskCandidate | null;
  candidates?: TaskCandidate[];
};

export function getAreaFromBranch(branch: string): string | null {
  const match = branch.match(/^task\/([^/]+)\//);
  if (match) return match[1];
  const streamMatch = branch.match(/^stream\/([^/]+)$/);
  return streamMatch ? streamMatch[1] : null;
}

function getSlugFromBranch(branch: string): string | null {
  const match = branch.match(/^task\/[^/]+\/(.+)$/);
  return match ? match[1].split('/').filter(Boolean).join('-') : null;
}

function getTaskCurrentPath(worktreePath: string, branch: string): string | null {
  const area = getAreaFromBranch(branch);
  const slug = getSlugFromBranch(branch);
  if (!area || !slug) return null;
  return path.join(worktreePath, '.task', area, slug, 'current.json');
}

function listScopedCurrentPaths(worktreePath: string): string[] {
  const taskRoot = path.join(worktreePath, '.task');
  if (!fs.existsSync(taskRoot)) return [];
  const paths: string[] = [];
  for (const areaEntry of fs.readdirSync(taskRoot, { withFileTypes: true })) {
    if (!areaEntry.isDirectory()) continue;
    if (areaEntry.name === 'tasks' || areaEntry.name === 'reviews') continue;
    const areaPath = path.join(taskRoot, areaEntry.name);
    for (const taskEntry of fs.readdirSync(areaPath, { withFileTypes: true })) {
      if (!taskEntry.isDirectory()) continue;
      const currentPath = path.join(areaPath, taskEntry.name, 'current.json');
      if (fs.existsSync(currentPath)) paths.push(currentPath);
    }
  }
  return paths;
}

export function resolveTaskBranch(options: ResolveTaskBranchOptions = {}): BranchResolution {
  if (options.explicitBranch) {
    return { ok: true, branch: options.explicitBranch, source: 'explicit' };
  }

  const envBranch = options.env?.TASK_BRANCH;
  if (envBranch) {
    return { ok: true, branch: envBranch, source: 'env' };
  }

  const currentTask = options.currentTask === undefined
    ? readCurrentTask(options.cwd || process.cwd())
    : options.currentTask;
  if (currentTask) {
    return { ok: true, branch: currentTask.branch, source: 'current.json', candidates: [currentTask] };
  }

  const candidates = options.candidates || findActiveTaskCandidates(options.cwd || process.cwd());
  if (candidates.length === 1) {
    return { ok: true, branch: candidates[0].branch, source: 'single-worktree', candidates };
  }

  if (candidates.length > 1) {
    return {
      ok: false,
      code: 'AMBIGUOUS_TASK_SELECTION',
      message: 'multiple active task worktrees found; pass taskSession or explicit branch/taskWorktree',
      candidates,
    };
  }

  return {
    ok: false,
    code: 'WORKTREE_NOT_FOUND',
    message: 'no active task worktree found; run task.start and pass taskSession, or pass explicit branch/taskWorktree',
    candidates: [],
  };
}

export function getCurrentTask(options: ResolveTaskBranchOptions = {}): TaskCandidate | null {
  const resolution = resolveTaskBranch(options);
  if (!resolution.ok) return null;
  return (options.candidates || findActiveTaskCandidates(options.cwd || process.cwd()))
    .find((candidate) => candidate.branch === resolution.branch) || {
      branch: resolution.branch,
      area: getAreaFromBranch(resolution.branch) || 'unknown',
      worktree: '',
    };
}

export function findActiveTaskCandidates(cwd: string): TaskCandidate[] {
  const repoRoot = resolveGitRoot(cwd);
  const worktrees = listWorktrees(repoRoot);
  const candidates: TaskCandidate[] = [];

  for (const worktree of worktrees) {
    if (worktree.path === repoRoot) continue;
    const meta = readTaskMeta(worktree.path, worktree.branch);
    if (!meta) continue;
    const branch = meta.taskBranch || meta.branch || worktree.branch;
    if (branch !== worktree.branch) continue;
    candidates.push({
      branch,
      area: meta.area || getAreaFromBranch(branch) || 'unknown',
      prNumber: meta.prNumber || meta.taskPrNumber,
      worktree: meta.worktreePath || worktree.path,
    });
  }
  return candidates;
}

function readCurrentTask(cwd: string): TaskCandidate | null {
  const repoRoot = resolveGitRoot(cwd);
  const currentBranch = getCurrentBranch(repoRoot);
  const meta = readTaskMeta(repoRoot, currentBranch);
  if (!meta) return null;
  const branch = meta.taskBranch || meta.branch;
  if (!branch) return null;
  const candidates = findActiveTaskCandidates(cwd);
  return candidates.find((candidate) => candidate.branch === branch) || null;
}

function listWorktrees(repoRoot: string): WorktreeEntry[] {
  const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const entries: WorktreeEntry[] = [];
  let currentPath: string | null = null;
  let currentBranch: string | null = null;
  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (currentPath && currentBranch) entries.push({ path: currentPath, branch: currentBranch });
      currentPath = line.slice('worktree '.length);
      currentBranch = null;
      continue;
    }
    if (line.startsWith('branch ')) currentBranch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
  }
  if (currentPath && currentBranch) entries.push({ path: currentPath, branch: currentBranch });
  return entries;
}

function readTaskMeta(worktreePath: string, expectedBranch?: string | null): TaskMeta | null {
  const paths = [
    ...(expectedBranch ? [getTaskCurrentPath(worktreePath, expectedBranch)] : []),
    ...listScopedCurrentPaths(worktreePath),
    path.join(worktreePath, '.task', 'current.json'),
  ].filter((filePath): filePath is string => Boolean(filePath));
  for (const filePath of Array.from(new Set(paths))) {
    const meta = readJsonFile<TaskMeta>(filePath);
    if (!meta) continue;
    const branch = meta.taskBranch || meta.branch;
    if (expectedBranch && branch && branch !== expectedBranch) continue;
    return meta;
  }
  return null;
}

function readJsonFile<TValue>(filePath: string): TValue | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TValue;
  } catch {
    return null;
  }
}

function getCurrentBranch(cwd: string): string | null {
  try {
    return execFileSync('git', ['branch', '--show-current'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch {
    return null;
  }
}

function resolveGitRoot(cwd: string): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}
