const fs = require('fs');
const path = require('path');

const { getConsueloHome } = require('./paths');
const { listDurableTaskSessionMetadata } = require('./task-registry');
const { evictDurableTaskWorktree, getTaskInactivityAgeMs } = require('./task-worktree-eviction');

const DEFAULT_TASK_EVICTION_IDLE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TASK_GC_INTERVAL_MS = 60 * 60 * 1000;

function normalizePath(value) {
  if (!value) return null;
  const resolved = path.resolve(value);
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

function runTaskWorktreeGc(options = {}) {
  const home = options.home || getConsueloHome();
  const idleMs = options.idleMs ?? DEFAULT_TASK_EVICTION_IDLE_MS;
  if (!Number.isFinite(idleMs) || idleMs < 0) throw new Error('task GC idleMs must be a non-negative number');
  const nowValue = typeof options.now === 'function' ? options.now() : (options.now ?? Date.now());
  const nowMs = nowValue instanceof Date ? nowValue.getTime() : Number(nowValue);
  if (!Number.isFinite(nowMs)) throw new Error('task GC now must resolve to a timestamp');
  const currentWorktree = normalizePath(options.currentWorktreePath);
  const evict = options.evict || evictDurableTaskWorktree;
  const result = {
    scanned: 0,
    idleMs,
    evicted: [],
    skipped: [],
    errors: [],
  };

  for (const metadata of listDurableTaskSessionMetadata({ home })) {
    result.scanned += 1;
    const taskSession = metadata.taskSession;
    const worktreePath = metadata.worktreePath || metadata.worktree;
    if (metadata.status !== 'active') {
      result.skipped.push({ taskSession, reason: 'not-active', status: metadata.status });
      continue;
    }
    if (!worktreePath || !fs.existsSync(worktreePath)) {
      result.skipped.push({ taskSession, reason: 'worktree-missing' });
      continue;
    }
    if (currentWorktree && normalizePath(worktreePath) === currentWorktree) {
      result.skipped.push({ taskSession, reason: 'current-worktree' });
      continue;
    }
    const inactiveMs = getTaskInactivityAgeMs(metadata, nowMs);
    if (inactiveMs < idleMs) {
      result.skipped.push({ taskSession, reason: 'recent', inactiveMs });
      continue;
    }
    try {
      const evicted = evict({
        taskSession,
        home,
        now: () => nowMs,
      });
      result.evicted.push({
        taskSession,
        taskBranch: metadata.taskBranch,
        worktreePath,
        inactiveMs,
        recovery: evicted.recovery || null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({ taskSession, taskBranch: metadata.taskBranch, message });
      if (options.onError) options.onError(error, metadata);
    }
  }
  return result;
}

module.exports = {
  DEFAULT_TASK_EVICTION_IDLE_MS,
  DEFAULT_TASK_GC_INTERVAL_MS,
  runTaskWorktreeGc,
};
