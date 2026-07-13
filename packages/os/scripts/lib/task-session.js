const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const SESSION_FILENAME = 'session.json';

function writeStderr(message = '') {
  process.stderr.write(`${message}\n`);
}

function getTaskSlug(taskBranch) {
  const parts = String(taskBranch || '').split('/');
  return parts[parts.length - 1] || 'task';
}

function getTaskArea(taskBranch) {
  const parts = String(taskBranch || '').split('/');
  if (parts[0] === 'task' && parts[1]) {
    return parts[1];
  }

  return null;
}

function sanitizeTmuxPart(value) {
  return String(value || 'task')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'task';
}

function getTaskSessionHandle(taskBranch) {
  const digest = crypto.createHash('sha256').update(taskBranch).digest('hex').slice(0, 12);
  return `tsk_${digest}`;
}

function getTmuxSessionName(area, taskBranch) {
  const slug = sanitizeTmuxPart(getTaskSlug(taskBranch));
  const safeArea = sanitizeTmuxPart(area || 'workspace');
  const digest = crypto.createHash('sha256').update(taskBranch).digest('hex').slice(0, 8);
  return `opensaas-${safeArea}-${slug}-${digest}`;
}

function getTaskSessionPath(worktreePath) {
  return path.join(worktreePath, '.task', SESSION_FILENAME);
}

function runTmux(args, options = {}) {
  return childProcess.spawnSync('tmux', args, {
    stdio: options.stdio || 'ignore',
    encoding: 'utf8',
  });
}

function isTmuxAvailable() {
  const result = childProcess.spawnSync('tmux', ['-V'], { stdio: 'ignore' });
  return result.status === 0;
}

function assertTmuxAvailable() {
  if (!isTmuxAvailable()) {
    throw new Error('tmux is required for task sessions but was not found on PATH');
  }
}

function getTmuxSessionStatus(tmuxSession) {
  const result = runTmux([
    'has-session',
    '-t',
    tmuxSession,
  ], { stdio: 'pipe' });

  return {
    code: result.status === null ? 1 : result.status,
    stderr: result.stderr || '',
  };
}

function tmuxSessionExists(tmuxSession) {
  return getTmuxSessionStatus(tmuxSession).code === 0;
}

function ensureTmuxSession(tmuxSession, worktreePath, taskBranch) {
  assertTmuxAvailable();

  if (tmuxSessionExists(tmuxSession)) {
    return { created: false };
  }

  const result = runTmux([
    'new-session',
    '-d',
    '-s',
    tmuxSession,
    '-c',
    worktreePath,
    'env',
    `TASK_BRANCH=${taskBranch}`,
    `TASK_WORKTREE=${worktreePath}`,
    'bash',
    '-lc',
    'exec bash',
  ], { stdio: 'pipe' });

  if (result.status !== 0) {
    const detail = result.stderr || result.stdout || `exit ${result.status}`;
    throw new Error(`failed to create tmux task session ${tmuxSession}: ${detail}`);
  }

  return { created: true };
}

function buildTaskSessionMetadata({ area, stream, taskBranch, worktreePath, prNumber, prUrl }, tmuxCreated = false) {
  const taskSession = getTaskSessionHandle(taskBranch);
  const tmuxSession = getTmuxSessionName(area, taskBranch);

  return {
    taskSession,
    tmuxSession,
    area,
    stream,
    taskBranch,
    branch: taskBranch,
    worktreePath,
    worktree: worktreePath,
    prNumber,
    prUrl,
    createdAt: new Date().toISOString(),
    tmuxCreated,
  };
}

function ensureTaskTmuxSession({ area, taskBranch, worktreePath }) {
  const tmuxSession = getTmuxSessionName(area, taskBranch);
  return {
    taskSession: getTaskSessionHandle(taskBranch),
    tmuxSession,
    ...ensureTmuxSession(tmuxSession, worktreePath, taskBranch),
  };
}

function writeTaskSessionMetadata(input, tmuxCreated = false) {
  const metadata = buildTaskSessionMetadata(input, tmuxCreated);
  const sessionPath = getTaskSessionPath(input.worktreePath);
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(sessionPath, JSON.stringify(metadata, null, 2) + '\n', 'utf8');
  return metadata;
}

function createTaskSessionMetadata(input) {
  const tmux = ensureTaskTmuxSession(input);
  return writeTaskSessionMetadata(input, tmux.created);
}

function readTaskSessionMetadata(worktreePath) {
  const sessionPath = getTaskSessionPath(worktreePath);
  if (!fs.existsSync(sessionPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  } catch (error) {
    writeStderr(`warning: failed to parse task session metadata ${sessionPath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function asMetadataRecords(metadata) {
  if (!metadata) {
    return [];
  }

  if (Array.isArray(metadata)) {
    return metadata.filter(Boolean);
  }

  return [metadata];
}

function getMetadataBranch(metadata) {
  return metadata.taskBranch || metadata.branch || null;
}

function getMetadataWorktree(metadata) {
  return metadata.worktreePath || metadata.worktree || null;
}

function normalizeComparablePath(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    return fs.realpathSync.native(resolvedPath);
  } catch {
    return resolvedPath;
  }
}

function pathsMatch(first, second) {
  if (!first || !second) {
    return true;
  }

  return normalizeComparablePath(first) === normalizeComparablePath(second);
}

function isCompatibleTaskMetadata(metadata, expected = {}) {
  const metadataBranch = getMetadataBranch(metadata);
  if (expected.branch && metadataBranch && metadataBranch !== expected.branch) {
    return false;
  }

  const metadataWorktree = getMetadataWorktree(metadata);
  if (expected.worktreePath && metadataWorktree && !pathsMatch(metadataWorktree, expected.worktreePath)) {
    return false;
  }

  return true;
}

function resolveTaskTmuxSession(metadata, expected = {}) {
  const records = asMetadataRecords(metadata).filter((record) => isCompatibleTaskMetadata(record, expected));

  for (const record of records) {
    if (typeof record.tmuxSession === 'string' && record.tmuxSession.trim()) {
      return {
        tmuxSession: record.tmuxSession.trim(),
        taskSession: record.taskSession || null,
        taskBranch: getMetadataBranch(record),
        worktreePath: getMetadataWorktree(record),
        source: 'tmuxSession',
      };
    }
  }

  for (const record of records) {
    const taskBranch = getMetadataBranch(record);
    if (!taskBranch) {
      continue;
    }

    const expectedTaskSession = getTaskSessionHandle(taskBranch);
    if (record.taskSession && record.taskSession !== expectedTaskSession) {
      continue;
    }

    const area = record.area || getTaskArea(taskBranch);
    if (!area) {
      continue;
    }

    return {
      tmuxSession: getTmuxSessionName(area, taskBranch),
      taskSession: record.taskSession || expectedTaskSession,
      taskBranch,
      worktreePath: getMetadataWorktree(record),
      source: 'derived-task-branch',
    };
  }

  return null;
}

function warnOnce(warnings, warn, message) {
  warnings.push(message);
  if (warn) {
    warn(message);
  }
}

function terminateTaskTmuxSession(metadata, options = {}) {
  const warnings = [];
  const dryRun = Boolean(options.dryRun);
  const target = resolveTaskTmuxSession(metadata, {
    branch: options.branch,
    worktreePath: options.worktreePath,
  });

  if (!target) {
    return {
      status: 'no-session-metadata',
      terminated: false,
      dryRun,
      tmuxSession: null,
      warnings,
    };
  }

  if (dryRun) {
    return {
      ...target,
      status: 'would-terminate',
      terminated: false,
      dryRun: true,
      warnings,
    };
  }

  if (!isTmuxAvailable()) {
    warnOnce(warnings, options.warn, `warning: tmux unavailable; could not clean task session ${target.tmuxSession}`);
    return {
      ...target,
      status: 'tmux-unavailable',
      terminated: false,
      dryRun: false,
      warnings,
    };
  }

  const sessionStatus = getTmuxSessionStatus(target.tmuxSession);
  if (sessionStatus.code === 1) {
    return {
      ...target,
      status: 'not-found',
      terminated: false,
      dryRun: false,
      warnings,
    };
  }

  if (sessionStatus.code !== 0) {
    const detail = sessionStatus.stderr || 'no stderr';
    warnOnce(
      warnings,
      options.warn,
      `warning: failed to inspect task tmux session ${target.tmuxSession}: exit ${sessionStatus.code}: ${detail}`,
    );
    return {
      ...target,
      status: 'inspect-failed',
      terminated: false,
      dryRun: false,
      warnings,
    };
  }

  const result = runTmux(['kill-session', '-t', target.tmuxSession], { stdio: 'pipe' });
  if (result.status !== 0) {
    const detail = result.stderr || result.stdout || `exit ${result.status}`;
    warnOnce(warnings, options.warn, `warning: failed to clean task tmux session ${target.tmuxSession}: ${detail}`);
    return {
      ...target,
      status: 'terminate-failed',
      terminated: false,
      dryRun: false,
      warnings,
    };
  }

  return {
    ...target,
    status: 'terminated',
    terminated: true,
    dryRun: false,
    warnings,
  };
}

module.exports = {
  assertTmuxAvailable,
  buildTaskSessionMetadata,
  createTaskSessionMetadata,
  ensureTaskTmuxSession,
  getTaskSessionHandle,
  getTaskSessionPath,
  getTmuxSessionName,
  getTmuxSessionStatus,
  isTmuxAvailable,
  readTaskSessionMetadata,
  resolveTaskTmuxSession,
  terminateTaskTmuxSession,
  tmuxSessionExists,
  writeTaskSessionMetadata,
};
