const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { getCacheRoot } = require('../index/store');
const { getCurrentBranch } = require('../git');
const { findTaskMeta } = require('../task-meta');
const calibration = require('./explore-calibration.v1.json');
const {
  buildHypothesesFromResults,
  updateHypothesesWithEvents: updateHypotheses,
} = require('./explore-hypothesis-model');

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

function getStateDirectory(repoRoot) {
  const branch = getCurrentBranch(repoRoot);
  const taskMeta = findTaskMeta(repoRoot, { currentBranch: branch });

  if (taskMeta?.dir) {
    return {
      stateDir: path.join(taskMeta.dir, '.task'),
      taskMeta,
      worktreeId: taskMeta.data?.taskBranch || null,
    };
  }

  const cacheRoot = getCacheRoot(repoRoot, getRemoteUrl(repoRoot));
  return {
    stateDir: path.join(cacheRoot, 'session'),
    taskMeta: null,
    worktreeId: null,
  };
}

function getStatePaths(repoRoot) {
  const state = getStateDirectory(repoRoot);
  return {
    ...state,
    exploreStatePath: path.join(state.stateDir, 'explore-state.json'),
    evidenceLogPath: path.join(state.stateDir, 'evidence-log.json'),
    readLogPath: path.join(state.stateDir, 'read-log.json'),
  };
}

function readExploreState(repoRoot) {
  return readJson(getStatePaths(repoRoot).exploreStatePath, null);
}

function writeExploreState(repoRoot, state) {
  const statePath = getStatePaths(repoRoot).exploreStatePath;
  writeJson(statePath, state);
  return statePath;
}

function buildInvestigationHypotheses(results, previousHypotheses = []) {
  const fresh = buildHypothesesFromResults(results || [], calibration);
  if (!Array.isArray(previousHypotheses) || previousHypotheses.length === 0) return fresh;

  const previousByRoot = new Map(previousHypotheses.map((hypothesis) => [hypothesis.root_path, hypothesis]));
  return fresh.map((hypothesis) => {
    const previous = previousByRoot.get(hypothesis.root_path);
    if (!previous) return hypothesis;
    return {
      ...hypothesis,
      read_paths: previous.read_paths || [],
      explicit_relevant_paths: previous.explicit_relevant_paths || [],
      explicit_irrelevant_paths: previous.explicit_irrelevant_paths || [],
      support_state: previous.support_state || hypothesis.support_state,
    };
  });
}

function updateHypothesesWithEvents(state, events = []) {
  const migratedState = state?.hypothesis_version === 1 && Array.isArray(state.hypotheses)
    ? state
    : {
        ...state,
        hypothesis_version: 1,
        hypotheses: buildInvestigationHypotheses(state?.results || [], []),
        hypothesis_event_ids: [],
      };
  return updateHypotheses(migratedState, events, calibration);
}

function readReadLog(repoRoot) {
  return readJson(getStatePaths(repoRoot).readLogPath, { files: [], updatedAt: null });
}

function writeReadLog(repoRoot, readLog) {
  const readLogPath = getStatePaths(repoRoot).readLogPath;
  writeJson(readLogPath, readLog);
  return readLogPath;
}

function markFilesRead(repoRoot, files) {
  const readLog = readReadLog(repoRoot);
  const fileSet = new Set(readLog.files || []);
  for (const filePath of files) fileSet.add(filePath);
  const next = {
    files: Array.from(fileSet).sort(),
    updatedAt: new Date().toISOString(),
  };
  writeReadLog(repoRoot, next);
  return next;
}

module.exports = {
  buildInvestigationHypotheses,
  getStatePaths,
  markFilesRead,
  readExploreState,
  readReadLog,
  updateHypothesesWithEvents,
  writeExploreState,
  writeReadLog,
};
