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

function clampBelief(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0.01, Math.min(0.99, value));
}

function buildBeliefsFromResults(results, previousBeliefs = {}) {
  const beliefs = {};

  for (const result of results || []) {
    const previous = previousBeliefs[result.path] || null;
    const prior = clampBelief(Number(result.belief_prior ?? result.score ?? previous?.prior ?? 0));
    beliefs[result.path] = {
      prior,
      posterior: clampBelief(Number(previous?.posterior ?? prior)),
      observations: Array.isArray(previous?.observations) ? previous.observations : [],
    };
  }

  return beliefs;
}

function getNeighborMap(results) {
  const neighbors = new Map();
  const resultPaths = new Set((results || []).map((result) => result.path));

  for (const result of results || []) {
    if (!neighbors.has(result.path)) neighbors.set(result.path, new Set());
    for (const connection of result.graph_connections || []) {
      if (!resultPaths.has(connection)) continue;
      neighbors.get(result.path).add(connection);
      if (!neighbors.has(connection)) neighbors.set(connection, new Set());
      neighbors.get(connection).add(result.path);
    }
  }

  return neighbors;
}

function observeBelief(belief, event, multiplier, reason) {
  belief.posterior = clampBelief(belief.posterior * multiplier);
  belief.observations = [
    ...belief.observations,
    {
      event_id: event.id,
      multiplier,
      reason,
      type: event.type,
    },
  ].slice(-25);
}

function applyToFileAndNeighbors(beliefs, neighbors, filePath, event, fileMultiplier, neighborMultiplier, reason) {
  if (beliefs[filePath]) {
    observeBelief(beliefs[filePath], event, fileMultiplier, reason);
  }

  for (const neighbor of neighbors.get(filePath) || []) {
    if (beliefs[neighbor]) {
      observeBelief(beliefs[neighbor], event, neighborMultiplier, `${reason} via graph neighbor`);
    }
  }
}

function isConnectedRead(filePath, nextEvent, neighbors) {
  return nextEvent?.type === 'file.read'
    && nextEvent.file_path
    && (neighbors.get(filePath) || new Set()).has(nextEvent.file_path);
}

function inferReadRelevant(event, nextEvent, state, neighbors) {
  if (typeof event.details?.relevant === 'boolean') return event.details.relevant;
  if (nextEvent?.type === 'file.relevant' && nextEvent.file_path === event.file_path) return true;
  if (nextEvent?.type === 'file.irrelevant' && nextEvent.file_path === event.file_path) return false;
  if (isConnectedRead(event.file_path, nextEvent, neighbors)) return true;
  if (nextEvent?.type === 'explore.result' && nextEvent.question && state.query && nextEvent.question !== state.query) return false;
  return true;
}

function getExploitCluster(state) {
  const target = state.exploitation?.target || state.results?.[0]?.path || null;
  return new Set([
    target,
    ...(state.exploitation?.context_files || []),
  ].filter(Boolean));
}

function updateBeliefsWithEvents(state, events = []) {
  const results = state?.results || [];
  const beliefs = buildBeliefsFromResults(results, state?.beliefs || {});
  const neighbors = getNeighborMap(results);
  const appliedEventIds = new Set(state?.belief_event_ids || []);

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!event?.id || appliedEventIds.has(event.id)) continue;

    if (event.type === 'file.read' && event.file_path) {
      const relevant = inferReadRelevant(event, events[index + 1], state, neighbors);
      applyToFileAndNeighbors(
        beliefs,
        neighbors,
        event.file_path,
        event,
        relevant ? 1.15 : 0.80,
        relevant ? 1.05 : 0.95,
        relevant ? 'file read looked relevant' : 'file read looked not useful',
      );
      appliedEventIds.add(event.id);
      continue;
    }

    if ((event.type === 'file.relevant' || event.type === 'file.irrelevant') && event.file_path) {
      const relevant = event.type === 'file.relevant';
      applyToFileAndNeighbors(
        beliefs,
        neighbors,
        event.file_path,
        event,
        relevant ? 1.15 : 0.80,
        relevant ? 1.05 : 0.95,
        relevant ? 'manual relevant mark' : 'manual irrelevant mark',
      );
      appliedEventIds.add(event.id);
      continue;
    }

    if ((event.type === 'test.pass' || event.type === 'test.fail') && event.file_path) {
      applyToFileAndNeighbors(
        beliefs,
        neighbors,
        event.file_path,
        event,
        event.type === 'test.pass' ? 1.20 : 0.70,
        event.type === 'test.pass' ? 1.10 : 0.90,
        event.type === 'test.pass' ? 'test passed' : 'test failed',
      );
      appliedEventIds.add(event.id);
      continue;
    }

    if (event.type === 'verify.pass' || event.type === 'verify.fail') {
      const multiplier = event.type === 'verify.pass' ? 1.10 : 0.85;
      for (const filePath of getExploitCluster(state)) {
        if (beliefs[filePath]) {
          observeBelief(beliefs[filePath], event, multiplier, event.type === 'verify.pass' ? 'verify passed exploit cluster' : 'verify failed exploit cluster');
        }
      }
      appliedEventIds.add(event.id);
    }
  }

  return {
    ...state,
    belief_event_ids: Array.from(appliedEventIds),
    beliefs,
    beliefs_updated_at: new Date().toISOString(),
  };
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
  buildBeliefsFromResults,
  getStatePaths,
  markFilesRead,
  readExploreState,
  readReadLog,
  updateBeliefsWithEvents,
  writeExploreState,
  writeReadLog,
};
