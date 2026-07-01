const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { createStore } = require('../index/store');
const { markFilesRead, getStatePaths, readReadLog } = require('./explore-state');

const EVIDENCE_LOG_VERSION = 1;

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function getRemoteUrl(repoRoot) {
  try {
    return execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || repoRoot;
  } catch {
    return repoRoot;
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function emptyLog(worktreeId) {
  return {
    version: EVIDENCE_LOG_VERSION,
    worktree_id: worktreeId || null,
    events: [],
    hypotheses: [],
    updated_at: null,
  };
}

function normalizeEvent(event, paths) {
  const occurredAt = event.occurred_at || new Date().toISOString();

  return {
    id: event.id || crypto.randomUUID(),
    occurred_at: occurredAt,
    type: event.type,
    source: event.source || null,
    question: event.question || null,
    action: event.action || null,
    file_path: event.file_path || null,
    status: event.status || null,
    confidence_delta: typeof event.confidence_delta === 'number' ? event.confidence_delta : null,
    worktree_id: event.worktree_id || paths.worktreeId || null,
    details: event.details || {},
  };
}

function getEvidenceLogPath(repoRoot) {
  return getStatePaths(repoRoot).evidenceLogPath;
}

function readEvidenceLog(repoRoot) {
  const paths = getStatePaths(repoRoot);
  const log = readJson(paths.evidenceLogPath, emptyLog(paths.worktreeId));

  return {
    ...emptyLog(paths.worktreeId),
    ...log,
    events: Array.isArray(log.events) ? log.events : [],
    hypotheses: Array.isArray(log.hypotheses) ? log.hypotheses : [],
  };
}

function writeEvidenceLog(repoRoot, log) {
  const paths = getStatePaths(repoRoot);
  writeJson(paths.evidenceLogPath, {
    ...log,
    updated_at: new Date().toISOString(),
  });
  return paths.evidenceLogPath;
}

function mirrorEventToStore(repoRoot, event) {
  let store = null;
  try {
    store = createStore(repoRoot, getRemoteUrl(repoRoot));
    store.insertEvidenceEvent(event);
    return store.dbPath;
  } catch (error /* unknown */) {
    throw new Error(`mirrorEventToStore failed: ${getErrorMessage(error)}`);
  } finally {
    if (store?.db) {
      store.db.close();
    }
  }
}

function appendEvidenceEvent(repoRoot, event, options = {}) {
  if (!event?.type) {
    throw new Error('evidence event requires type');
  }

  const paths = getStatePaths(repoRoot);
  const normalized = normalizeEvent(event, paths);
  const log = readEvidenceLog(repoRoot);

  if (!log.events.some((existing) => existing.id === normalized.id)) {
    log.events.push(normalized);
  }

  const evidenceLogPath = writeEvidenceLog(repoRoot, log);
  let mirroredTo = null;
  let mirrorError = null;

  if (options.mirror !== false) {
    try {
      mirroredTo = mirrorEventToStore(repoRoot, normalized);
    } catch (error /* unknown */) {
      mirrorError = getErrorMessage(error);
      if (options.requireMirror) {
        throw error;
      }
    }
  }

  return {
    event: normalized,
    evidenceLogPath,
    mirroredTo,
    mirrorError,
  };
}

function getReadFilesFromEvidence(repoRoot) {
  const evidence = readEvidenceLog(repoRoot);
  const readLog = readReadLog(repoRoot);
  const files = new Set(readLog.files || []);

  for (const event of evidence.events) {
    if (event.type === 'file.read' && event.file_path) {
      files.add(event.file_path);
    }
  }

  return files;
}

function markFileRead(repoRoot, filePath, details = {}) {
  markFilesRead(repoRoot, [filePath]);
  return appendEvidenceEvent(repoRoot, {
    type: 'file.read',
    source: details.source || 'manual',
    action: 'read',
    file_path: filePath,
    status: 'observed',
    confidence_delta: 0.03,
    details,
  });
}

function getEvidenceEvents(repoRoot, type = null) {
  const events = readEvidenceLog(repoRoot).events;
  return type ? events.filter((event) => event.type === type) : events;
}

function hasPassingConfirmation(events) {
  return events.some((event) => (
    event.type === 'verify.pass'
    || event.type === 'test.pass'
    || event.type === 'runtime.clean'
  ));
}

function hasFailingConfirmation(events) {
  return events.some((event) => (
    event.type === 'verify.fail'
    || event.type === 'test.fail'
    || event.type === 'runtime.error'
    || event.type === 'contradiction.detected'
  ));
}

module.exports = {
  appendEvidenceEvent,
  getEvidenceEvents,
  getEvidenceLogPath,
  getReadFilesFromEvidence,
  hasFailingConfirmation,
  hasPassingConfirmation,
  markFileRead,
  readEvidenceLog,
  writeEvidenceLog,
};
