const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SESSION_FILENAME = 'session.json';

function writeStderr(message = '') {
  process.stderr.write(`${message}\n`);
}

function getTaskSlug(taskBranch) {
  const parts = String(taskBranch || '').split('/');
  return parts[parts.length - 1] || 'task';
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
  return spawnSync('tmux', args, {
    stdio: options.stdio || 'ignore',
    encoding: 'utf8',
  });
}

function isTmuxAvailable() {
  const result = spawnSync('tmux', ['-V'], { stdio: 'ignore' });
  return result.status === 0;
}

function assertTmuxAvailable() {
  if (!isTmuxAvailable()) {
    throw new Error('tmux is required for task sessions but was not found on PATH');
  }
}

function tmuxSessionExists(tmuxSession) {
  const result = runTmux([
    'has-session',
    '-t',
    tmuxSession,
  ]);
  return result.status === 0;
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

module.exports = {
  assertTmuxAvailable,
  buildTaskSessionMetadata,
  createTaskSessionMetadata,
  ensureTaskTmuxSession,
  getTaskSessionHandle,
  getTaskSessionPath,
  getTmuxSessionName,
  readTaskSessionMetadata,
  writeTaskSessionMetadata,
};
