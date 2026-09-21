#!/usr/bin/env bun

const {
  DEFAULT_TASK_EVICTION_IDLE_MS,
  runTaskWorktreeGc,
} = require('./lib/task-worktree-gc');

function readNonNegativeInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function main() {
  const idleMs = readNonNegativeInteger(
    'CONSUELO_TASK_WORKTREE_EVICT_AFTER_MS',
    DEFAULT_TASK_EVICTION_IDLE_MS,
  );
  const result = runTaskWorktreeGc({
    idleMs,
    onError(error, metadata) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[Consuelo OS] task worktree GC failed for ${metadata.taskBranch}: ${message}\n`);
    },
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.errors.length > 0) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[Consuelo OS] task worktree GC failed: ${message}\n`);
  process.exit(1);
}
