const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { getConsueloHome } = require('./paths');

const TASK_SESSION_PATTERN = /^tsk_[A-Za-z0-9_-]{4,200}$/;

function validateTaskSession(taskSession) {
  const value = String(taskSession || '').trim();
  if (!TASK_SESSION_PATTERN.test(value)) {
    throw new Error('taskSession must be a valid tsk_ session identifier');
  }
  return value;
}

function getDurableTaskRegistryRoot(home = getConsueloHome()) {
  return path.join(path.resolve(home), 'node', 'tasks', 'registry');
}

function getDurableTaskSessionPath(taskSession, home = getConsueloHome()) {
  return path.join(getDurableTaskRegistryRoot(home), `${validateTaskSession(taskSession)}.json`);
}

function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    try { fs.rmSync(temporaryPath, { force: true }); } catch {}
  }
}

function normalizeDurableTaskMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('task session metadata must be an object');
  }
  const taskSession = validateTaskSession(metadata.taskSession);
  const taskBranch = String(metadata.taskBranch || metadata.branch || '').trim();
  const worktreePath = String(metadata.worktreePath || metadata.worktree || '').trim();
  if (!taskBranch.startsWith('task/')) throw new Error('task session metadata requires a task branch');
  if (!worktreePath || !path.isAbsolute(worktreePath)) throw new Error('task session metadata requires an absolute worktree path');
  return {
    ...metadata,
    taskSession,
    taskBranch,
    branch: taskBranch,
    worktreePath: path.resolve(worktreePath),
    worktree: path.resolve(worktreePath),
  };
}

function writeDurableTaskSessionMetadata(metadata, options = {}) {
  const normalized = { ...normalizeDurableTaskMetadata(metadata), updatedAt: new Date().toISOString() };
  const filePath = getDurableTaskSessionPath(normalized.taskSession, options.home);
  atomicWriteJson(filePath, normalized);
  return { ...normalized, registryPath: filePath };
}

function readDurableTaskSessionMetadata(taskSession, options = {}) {
  const expected = validateTaskSession(taskSession);
  const filePath = getDurableTaskSessionPath(expected, options.home);
  if (!fs.existsSync(filePath)) return null;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`failed to parse durable task session metadata ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const normalized = normalizeDurableTaskMetadata(parsed);
  if (normalized.taskSession !== expected) {
    throw new Error(`durable task session identity mismatch for ${expected}`);
  }
  return { ...normalized, registryPath: filePath };
}

function listDurableTaskSessionMetadata(options = {}) {
  const root = getDurableTaskRegistryRoot(options.home);
  if (!fs.existsSync(root)) return [];
  const sessions = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const taskSession = entry.name.slice(0, -5);
    if (!TASK_SESSION_PATTERN.test(taskSession)) continue;
    try {
      const metadata = readDurableTaskSessionMetadata(taskSession, options);
      if (metadata) sessions.push(metadata);
    } catch {
      // Ignore corrupt unrelated registry entries during discovery; explicit lookup remains fail-closed.
    }
  }
  return sessions;
}

module.exports = {
  getDurableTaskRegistryRoot,
  getDurableTaskSessionPath,
  listDurableTaskSessionMetadata,
  readDurableTaskSessionMetadata,
  validateTaskSession,
  writeDurableTaskSessionMetadata,
};
