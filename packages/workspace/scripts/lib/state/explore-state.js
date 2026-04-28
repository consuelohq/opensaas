const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { getCacheRoot } = require('../index/store');
const { getCurrentBranch } = require('../git');
const { findTaskMeta } = require('../task-meta');

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
  const paths = getStatePaths(repoRoot);
  return readJson(paths.exploreStatePath, null);
}

function writeExploreState(repoRoot, state) {
  const paths = getStatePaths(repoRoot);
  writeJson(paths.exploreStatePath, state);
  return paths.exploreStatePath;
}

function readReadLog(repoRoot) {
  const paths = getStatePaths(repoRoot);
  return readJson(paths.readLogPath, { files: [], updatedAt: null });
}

function writeReadLog(repoRoot, readLog) {
  const paths = getStatePaths(repoRoot);
  writeJson(paths.readLogPath, readLog);
  return paths.readLogPath;
}

function markFilesRead(repoRoot, files) {
  const readLog = readReadLog(repoRoot);
  const fileSet = new Set(readLog.files || []);
  for (const filePath of files) {
    fileSet.add(filePath);
  }

  const next = {
    files: Array.from(fileSet).sort(),
    updatedAt: new Date().toISOString(),
  };
  writeReadLog(repoRoot, next);
  return next;
}

module.exports = {
  getStatePaths,
  markFilesRead,
  readExploreState,
  readReadLog,
  writeExploreState,
  writeReadLog,
};
