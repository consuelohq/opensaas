const fs = require('fs');
const path = require('path');
const { listWorktrees } = require('./git');
const { readValidTaskMetaForWorktree } = require('./task-meta');
const { listDurableTaskSessionMetadata } = require('./task-registry');
const { recoverDurableTaskSession } = require('./task-session');

function parseTaskSelectorPrefix(rawArgs) {
  const selector = {
    area: null,
    branch: null,
    prNumber: null,
    taskSession: null,
  };

  let index = 0;
  while (index < rawArgs.length) {
    const flag = rawArgs[index];

    if (flag === '--area' || flag === '--branch' || flag === '--pr' || flag === '--task-session') {
      const value = rawArgs[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`missing value for ${flag}`);
      }

      if (flag === '--area') selector.area = value;
      if (flag === '--branch') selector.branch = value;
      if (flag === '--pr') selector.prNumber = Number.parseInt(value, 10);
      if (flag === '--task-session') selector.taskSession = value;
      index += 2;
      continue;
    }

    break;
  }

  if (selector.prNumber !== null && !Number.isInteger(selector.prNumber)) {
    throw new Error('invalid --pr value');
  }

  return {
    selector,
    remainingArgs: rawArgs.slice(index),
  };
}

function getTaskPrNumber(task) {
  return task.meta.prNumber || task.meta.taskPrNumber || null;
}

function getTaskSession(task) {
  return task.meta.taskSession || null;
}

function getTaskLabel(task) {
  const prNumber = getTaskPrNumber(task);
  return [
    task.meta.area || 'unknown-area',
    task.meta.taskBranch || task.branch || 'unknown-branch',
    prNumber ? `#${prNumber}` : null,
    getTaskSession(task),
  ].filter(Boolean).join(' ');
}

function taskMatchesSelector(task, selector = {}) {
  if (selector.area && task.meta.area !== selector.area) return false;
  if (selector.branch && task.meta.taskBranch !== selector.branch && task.branch !== selector.branch) return false;
  if (selector.prNumber !== null && selector.prNumber !== undefined && getTaskPrNumber(task) !== selector.prNumber) return false;
  if (selector.taskSession && getTaskSession(task) !== selector.taskSession) return false;
  return true;
}

function getSelectorLabel(selector = {}) {
  const parts = [];
  if (selector.area) parts.push(`area "${selector.area}"`);
  if (selector.branch) parts.push(`branch "${selector.branch}"`);
  if (selector.prNumber !== null && selector.prNumber !== undefined) parts.push(`pr #${selector.prNumber}`);
  if (selector.taskSession) parts.push(`task session "${selector.taskSession}"`);
  return parts.length > 0 ? parts.join(', ') : 'any active task';
}

function selectTaskFromCandidatesResult(tasks, selector = {}) {
  const matches = tasks.filter((task) => taskMatchesSelector(task, selector));

  if (matches.length === 0) {
    return {
      task: null,
      error: `no active task found for ${getSelectorLabel(selector)}. run task:start first.`,
    };
  }

  if (matches.length > 1) {
    const labels = matches.map(getTaskLabel).join(', ');
    return {
      task: null,
      error: `multiple active tasks found (${labels}). use --branch <task-branch>, --pr <number>, or --task-session <id> to select one.`,
    };
  }

  return { task: matches[0], error: null };
}

function selectTaskFromCandidates(tasks, selector = {}) {
  const result = selectTaskFromCandidatesResult(tasks, selector);
  if (result.error) throw new Error(result.error);
  return result.task;
}

function normalizeComparablePath(filePath) {
  const resolved = path.resolve(filePath);
  try { return fs.realpathSync.native(resolved); } catch { return resolved; }
}

function registryMatchesWorktree(metadata, worktree) {
  if (!metadata || !worktree) return false;
  const branch = metadata.taskBranch || metadata.branch;
  const registeredPath = metadata.worktreePath || metadata.worktree;
  if (!branch || branch !== worktree.branch || !registeredPath) return false;
  return normalizeComparablePath(registeredPath) === normalizeComparablePath(worktree.path);
}

function findActiveTaskCandidates(repoRoot) {
  const worktrees = listWorktrees(repoRoot);
  const registry = listDurableTaskSessionMetadata();
  const tasks = [];

  for (const worktree of worktrees) {
    const localMeta = readValidTaskMetaForWorktree(worktree.path, worktree.branch);
    const durableMeta = registry.find((metadata) => registryMatchesWorktree(metadata, worktree)) || null;
    if (!localMeta && !durableMeta) continue;
    const meta = localMeta && durableMeta
      ? { ...durableMeta, ...localMeta, taskSession: durableMeta.taskSession || localMeta.taskSession }
      : localMeta || durableMeta;
    tasks.push({ worktreePath: worktree.path, meta, branch: worktree.branch });
  }

  return tasks;
}

function findActiveTaskResult(repoRoot, selector = {}) {
  const result = selectTaskFromCandidatesResult(findActiveTaskCandidates(repoRoot), selector);
  if (!result.task || !selector.taskSession) return result;
  try {
    const recovered = recoverDurableTaskSession(selector.taskSession);
    if (recovered) {
      result.task.meta = { ...result.task.meta, ...recovered };
      result.task.worktreePath = recovered.worktreePath || result.task.worktreePath;
    }
    return result;
  } catch (error) {
    return {
      task: null,
      error: `task session recovery failed for ${selector.taskSession}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function findActiveTask(repoRoot, selector = {}) {
  return selectTaskFromCandidates(findActiveTaskCandidates(repoRoot), selector);
}

module.exports = {
  findActiveTask,
  findActiveTaskCandidates,
  findActiveTaskResult,
  getTaskLabel,
  parseTaskSelectorPrefix,
  selectTaskFromCandidates,
  selectTaskFromCandidatesResult,
  taskMatchesSelector,
};
