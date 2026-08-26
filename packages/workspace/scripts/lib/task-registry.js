const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { getConsueloHome } = require('./paths');

const TASK_SESSION_PATTERN = /^tsk_[A-Za-z0-9_-]{4,200}$/;
const TASK_REGISTRY_LOCK_STALE_MS = 60_000;
const TASK_REGISTRY_LOCK_RETRIES = 200;
const TASK_REGISTRY_LOCK_WAIT_MS = 5;

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

function sleepSync(milliseconds) {
  const waitArray = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(waitArray, 0, 0, milliseconds);
}

function withTaskSessionLock(taskSession, options, callback) {
  if (options?._lockHeld) return callback();
  const filePath = getDurableTaskSessionPath(taskSession, options?.home);
  const lockPath = `${filePath}.lock`;
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < TASK_REGISTRY_LOCK_RETRIES; attempt += 1) {
    try {
      fs.mkdirSync(lockPath, { mode: 0o700 });
      try {
        fs.writeFileSync(path.join(lockPath, 'owner.json'), `${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })}\n`, { mode: 0o600 });
      } catch {}
      try {
        return callback();
      } finally {
        fs.rmSync(lockPath, { recursive: true, force: true });
      }
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      try {
        const ageMs = Date.now() - fs.statSync(lockPath).mtimeMs;
        if (ageMs > TASK_REGISTRY_LOCK_STALE_MS) {
          fs.rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {}
      sleepSync(TASK_REGISTRY_LOCK_WAIT_MS);
    }
  }
  throw new Error(`timed out acquiring durable task registry lock for ${taskSession}`);
}

function nowIso(now = Date.now) {
  const value = typeof now === 'function' ? now() : now;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('invalid task registry timestamp');
  return date.toISOString();
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
  const repoRoot = metadata.repoRoot ? String(metadata.repoRoot).trim() : null;
  if (repoRoot && !path.isAbsolute(repoRoot)) throw new Error('task session repoRoot must be absolute when provided');
  return {
    ...metadata,
    taskSession,
    taskBranch,
    branch: taskBranch,
    worktreePath: path.resolve(worktreePath),
    worktree: path.resolve(worktreePath),
    ...(repoRoot ? { repoRoot: path.resolve(repoRoot) } : {}),
    status: metadata.status || 'active',
  };
}

function writeDurableTaskSessionMetadata(metadata, options = {}) {
  const base = normalizeDurableTaskMetadata(metadata);
  return withTaskSessionLock(base.taskSession, options, () => {
    const timestamp = nowIso(options.now);
    const normalized = {
      ...base,
      createdAt: base.createdAt || timestamp,
      lastActiveAt: base.lastActiveAt || base.updatedAt || base.createdAt || timestamp,
      updatedAt: timestamp,
    };
    const filePath = getDurableTaskSessionPath(normalized.taskSession, options.home);
    atomicWriteJson(filePath, normalized);
    return { ...normalized, registryPath: filePath };
  });
}

function transitionDurableTaskSessionMetadata(taskSession, expectedStatus, update, options = {}) {
  const expected = validateTaskSession(taskSession);
  return withTaskSessionLock(expected, options, () => {
    const current = readDurableTaskSessionMetadata(expected, options);
    if (!current) throw new Error(`durable task session not found: ${expected}`);
    const allowed = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    if (allowed.length > 0 && !allowed.includes(current.status)) {
      throw new Error(`durable task session ${expected} expected status ${allowed.join('|')} but found ${current.status}`);
    }
    if (options.expectedUpdatedAt !== undefined && current.updatedAt !== options.expectedUpdatedAt) {
      throw new Error(`durable task session ${expected} expected updatedAt ${options.expectedUpdatedAt} but found ${current.updatedAt || '(missing)'}`);
    }
    const patch = typeof update === 'function' ? update(current) : update;
    return writeDurableTaskSessionMetadata({ ...current, ...patch, taskSession: expected }, { ...options, _lockHeld: true });
  });
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

function touchDurableTaskSessionMetadata(taskSession, options = {}) {
  const expected = validateTaskSession(taskSession);
  return withTaskSessionLock(expected, options, () => {
    const metadata = readDurableTaskSessionMetadata(expected, options);
    if (!metadata) return null;
    const timestamp = nowIso(options.now);
    return writeDurableTaskSessionMetadata({
      ...metadata,
      lastActiveAt: timestamp,
    }, { ...options, _lockHeld: true, now: () => Date.parse(timestamp) });
  });
}

function deleteDurableTaskSessionMetadata(taskSession, options = {}) {
  const expected = validateTaskSession(taskSession);
  return withTaskSessionLock(expected, options, () => {
    const filePath = getDurableTaskSessionPath(expected, options.home);
    fs.rmSync(filePath, { force: true });
    return filePath;
  });
}

module.exports = {
  deleteDurableTaskSessionMetadata,
  getDurableTaskRegistryRoot,
  getDurableTaskSessionPath,
  listDurableTaskSessionMetadata,
  readDurableTaskSessionMetadata,
  touchDurableTaskSessionMetadata,
  transitionDurableTaskSessionMetadata,
  validateTaskSession,
  writeDurableTaskSessionMetadata,
};
