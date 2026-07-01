const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TASK_DIR = '.task';
const CURRENT_FILENAME = 'current.json';
const TASKS_DIR = 'tasks';
const CURRENT_META_PATH = `${TASK_DIR}/${CURRENT_FILENAME}`;
const WORKPAD_PATH = `${TASK_DIR}/workpad.md`;
const AUTO_RESOLVABLE_TASK_META_CONFLICTS = new Set([
  CURRENT_META_PATH,
  WORKPAD_PATH,
]);

// .task/current.json — active task for this branch
function getCurrentMetaPath(worktreePath) {
  return path.join(worktreePath, TASK_DIR, CURRENT_FILENAME);
}

// .task/tasks/<area>/<slug>.json — durable per-task history
function getTaskHistoryPath(worktreePath, area, slug) {
  return path.join(worktreePath, TASK_DIR, TASKS_DIR, area, `${slug}.json`);
}

function normalizeRepoPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function safeParseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function readJsonFile(filePath) {
  return safeParseJson(fs.readFileSync(filePath, 'utf8'));
}

function getTaskSlug(taskBranch) {
  if (!taskBranch) return null;
  const parts = taskBranch.split('/');
  return parts[parts.length - 1] || null;
}

function getTaskMetaBranchMismatch(taskMeta, currentBranch) {
  if (!taskMeta || !taskMeta.taskBranch || !currentBranch) return null;
  if (taskMeta.taskBranch === currentBranch) return null;
  return {
    expectedBranch: taskMeta.taskBranch,
    currentBranch,
  };
}

function isTaskMetaValidForBranch(taskMeta, currentBranch) {
  return getTaskMetaBranchMismatch(taskMeta, currentBranch) === null;
}

function writeTaskMeta(worktreePath, data) {
  // write .task/current.json
  const currentPath = getCurrentMetaPath(worktreePath);
  fs.mkdirSync(path.dirname(currentPath), { recursive: true });
  fs.writeFileSync(currentPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

  // write .task/tasks/<area>/<slug>.json if we have area info
  if (data.area && data.taskBranch) {
    const slug = getTaskSlug(data.taskBranch);
    const historyPath = getTaskHistoryPath(worktreePath, data.area, slug);
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    fs.writeFileSync(historyPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
}

function readTaskMeta(worktreePath) {
  const currentPath = getCurrentMetaPath(worktreePath);
  if (!fs.existsSync(currentPath)) return null;
  return readJsonFile(currentPath);
}

function readValidTaskMetaForWorktree(worktreePath, branch) {
  const scoped = findTaskMeta(worktreePath, { currentBranch: branch });
  const taskMeta = scoped ? scoped.data : readTaskMeta(worktreePath);
  if (!taskMeta) return null;
  if (!isTaskMetaValidForBranch(taskMeta, branch)) return null;
  return taskMeta;
}

function findScopedTaskMetaInDirectory(dir, options = {}) {
  const taskDir = path.join(dir, TASK_DIR);
  if (!fs.existsSync(taskDir)) return null;

  const candidates = [];
  for (const areaEntry of fs.readdirSync(taskDir, { withFileTypes: true })) {
    if (!areaEntry.isDirectory() || areaEntry.name === TASKS_DIR || areaEntry.name === 'reviews') continue;
    const areaDir = path.join(taskDir, areaEntry.name);
    for (const taskEntry of fs.readdirSync(areaDir, { withFileTypes: true })) {
      if (!taskEntry.isDirectory()) continue;
      const currentPath = path.join(areaDir, taskEntry.name, CURRENT_FILENAME);
      if (!fs.existsSync(currentPath)) continue;
      const data = readJsonFile(currentPath);
      if (!data) continue;
      const mismatch = getTaskMetaBranchMismatch(data, options.currentBranch);
      if (mismatch && !options.includeStale) continue;
      candidates.push({ path: currentPath, dir, data, stale: Boolean(mismatch), mismatch });
    }
  }

  if (candidates.length === 0) return null;
  if (options.currentBranch) {
    const exact = candidates.find((candidate) => candidate.data && candidate.data.taskBranch === options.currentBranch);
    if (exact) return exact;
  }

  candidates.sort((left, right) => getMetaTimestamp(right.data) - getMetaTimestamp(left.data));
  return candidates[0];
}

function findTaskMeta(startDirectory, options = {}) {
  let dir = path.resolve(startDirectory);

  while (true) {
    const currentPath = path.join(dir, TASK_DIR, CURRENT_FILENAME);
    if (fs.existsSync(currentPath)) {
      const data = readJsonFile(currentPath);
      const mismatch = getTaskMetaBranchMismatch(data, options.currentBranch);
      const record = { path: currentPath, dir, data, stale: Boolean(mismatch), mismatch };
      if (mismatch && !options.includeStale) return null;
      return record;
    }

    // fallback: check for legacy .task-meta.json
    const legacyPath = path.join(dir, '.task-meta.json');
    if (fs.existsSync(legacyPath)) {
      const data = readJsonFile(legacyPath);
      const mismatch = getTaskMetaBranchMismatch(data, options.currentBranch);
      const record = { path: legacyPath, dir, data, stale: Boolean(mismatch), mismatch };
      if (mismatch && !options.includeStale) return null;
      return record;
    }

    const scoped = findScopedTaskMetaInDirectory(dir, options);
    if (scoped) return scoped;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

function validateBranchMatch(taskMeta, currentBranch) {
  if (!taskMeta || !taskMeta.data || !taskMeta.data.taskBranch) return;
  const mismatch = getTaskMetaBranchMismatch(taskMeta.data, currentBranch);
  if (mismatch) {
    throw new Error(
      `.task/current.json belongs to branch ${mismatch.expectedBranch}, but current branch is ${mismatch.currentBranch}.\n` +
      'this metadata was likely merged from another task.\n' +
      'run: bun run task:start -- --area <area> --title "<title>" to create a fresh task.',
    );
  }
}

// collect current-task .task/ files in the worktree for auto-include in pushes
function collectTaskMetaFiles(worktreePath, area, taskBranch, options = {}) {
  const taskDir = path.join(worktreePath, TASK_DIR);
  if (!fs.existsSync(taskDir)) return [];

  const files = [];
  const taskSlug = getTaskSlug(taskBranch);
  const includeVerify = options.includeVerify !== false;

  function addFileIfExists(repoPath) {
    const fullPath = path.join(worktreePath, repoPath);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return;
    if (!includeVerify && repoPath.endsWith('/verify.json')) return;
    files.push({
      path: repoPath,
      content: fs.readFileSync(fullPath, 'utf8'),
      deleted: false,
    });
  }

  if (area && taskSlug) {
    const scopedTaskDir = path.join(taskDir, area, taskSlug);
    if (fs.existsSync(scopedTaskDir)) {
      for (const entry of fs.readdirSync(scopedTaskDir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        addFileIfExists(`${TASK_DIR}/${area}/${taskSlug}/${entry.name}`);
      }
    }
    addFileIfExists(`${TASK_DIR}/${TASKS_DIR}/${area}/${taskSlug}.json`);
    return files;
  }

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        const repoPath = path.relative(worktreePath, fullPath).split(path.sep).join('/');
        if (!includeVerify && repoPath === `${TASK_DIR}/verify.json`) continue;
        if (repoPath.startsWith(`${TASK_DIR}/reviews/`)) continue;
        files.push({
          path: repoPath,
          content: fs.readFileSync(fullPath, 'utf8'),
          deleted: false,
        });
      }
    }
  }

  walk(taskDir);
  return files;
}

function getMetaTimestamp(taskMeta) {
  if (!taskMeta) return 0;
  for (const key of ['updatedAt', 'taskPrMergedAt', 'createdAt']) {
    const value = taskMeta[key];
    if (!value) continue;
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return 0;
}

function getWorkpadBranch(content) {
  if (!content) return null;
  const backtickMatch = content.match(/^branch:\s*`([^`]+)`/m);
  if (backtickMatch) return backtickMatch[1];
  const plainMatch = content.match(/^branch:\s*([^\s]+)/m);
  return plainMatch ? plainMatch[1] : null;
}

function getWorkpadTimestamp(content) {
  if (!content) return 0;
  const startedMatch = content.match(/^started:\s*(.+)$/m);
  if (!startedMatch) return 0;
  const timestamp = Date.parse(startedMatch[1]);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getConflictStageContent(worktreePath, stage, repoPath) {
  try {
    return execFileSync('git', ['-C', worktreePath, 'show', `:${stage}:${repoPath}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function selectTaskMetaCandidate(candidates, currentBranch) {
  if (candidates.length === 0) return null;

  const scored = candidates.map((candidate) => {
    const taskMeta = candidate.data;
    let score = getMetaTimestamp(taskMeta);

    if (currentBranch && taskMeta.taskBranch === currentBranch) {
      score += 3000000000000;
    }

    if (currentBranch && currentBranch.startsWith('stream/') && (taskMeta.stream === currentBranch || taskMeta.baseBranch === currentBranch)) {
      score += 2000000000000;
    }

    if (taskMeta.taskBranch && candidate.workpadBranch === taskMeta.taskBranch) {
      score += 1000000000000;
    }

    return { ...candidate, score };
  });

  scored.sort((left, right) => right.score - left.score);
  return scored[0];
}

function selectWorkpadCandidate(candidates, selectedTaskBranch) {
  if (candidates.length === 0) return null;

  const scored = candidates.map((candidate) => {
    let score = getWorkpadTimestamp(candidate.content);
    const branch = getWorkpadBranch(candidate.content);
    if (selectedTaskBranch && branch === selectedTaskBranch) {
      score += 2000000000000;
    }
    return { ...candidate, branch, score };
  });

  scored.sort((left, right) => right.score - left.score);
  return scored[0];
}

function isOnlyTaskMetadataConflict(conflictFiles) {
  return conflictFiles.length > 0 && conflictFiles.every((filePath) => AUTO_RESOLVABLE_TASK_META_CONFLICTS.has(normalizeRepoPath(filePath)));
}

function resolveTaskMetadataConflicts(worktreePath, conflictFiles, options = {}) {
  const normalizedConflictFiles = conflictFiles.map(normalizeRepoPath);
  const unsupportedFiles = normalizedConflictFiles.filter((filePath) => !AUTO_RESOLVABLE_TASK_META_CONFLICTS.has(filePath));

  if (unsupportedFiles.length > 0) {
    return {
      resolved: false,
      reason: 'non-metadata conflicts present',
      unsupportedFiles,
    };
  }

  const currentBranch = options.currentBranch || '';
  let selectedTaskBranch = options.taskBranch || null;
  let selectedCurrentSource = null;

  if (normalizedConflictFiles.includes(CURRENT_META_PATH)) {
    const workpadBranchesBySource = new Map();
    if (normalizedConflictFiles.includes(WORKPAD_PATH)) {
      for (const source of ['ours', 'theirs']) {
        const stage = source === 'ours' ? 2 : 3;
        workpadBranchesBySource.set(source, getWorkpadBranch(getConflictStageContent(worktreePath, stage, WORKPAD_PATH)));
      }
    }

    const candidates = [];
    for (const source of ['ours', 'theirs']) {
      const stage = source === 'ours' ? 2 : 3;
      const content = getConflictStageContent(worktreePath, stage, CURRENT_META_PATH);
      const data = content ? safeParseJson(content) : null;
      if (!data) continue;
      candidates.push({ source, content, data, workpadBranch: workpadBranchesBySource.get(source) });
    }

    const selected = selectTaskMetaCandidate(candidates, currentBranch);
    if (!selected) {
      return { resolved: false, reason: 'could not parse task metadata conflict' };
    }

    const currentPath = path.join(worktreePath, CURRENT_META_PATH);
    fs.mkdirSync(path.dirname(currentPath), { recursive: true });
    fs.writeFileSync(currentPath, JSON.stringify(selected.data, null, 2) + '\n', 'utf8');
    selectedTaskBranch = selected.data.taskBranch || selectedTaskBranch;
    selectedCurrentSource = selected.source;
  }

  let selectedWorkpadSource = null;
  if (normalizedConflictFiles.includes(WORKPAD_PATH)) {
    const candidates = [];
    for (const source of ['ours', 'theirs']) {
      const stage = source === 'ours' ? 2 : 3;
      const content = getConflictStageContent(worktreePath, stage, WORKPAD_PATH);
      if (!content) continue;
      candidates.push({ source, content });
    }

    const selected = selectWorkpadCandidate(candidates, selectedTaskBranch);
    if (!selected) {
      return { resolved: false, reason: 'could not read workpad conflict' };
    }

    const workpadPath = path.join(worktreePath, WORKPAD_PATH);
    fs.mkdirSync(path.dirname(workpadPath), { recursive: true });
    fs.writeFileSync(workpadPath, selected.content.endsWith('\n') ? selected.content : selected.content + '\n', 'utf8');
    selectedWorkpadSource = selected.source;
  }

  execFileSync('git', ['-C', worktreePath, 'add', ...normalizedConflictFiles], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  return {
    resolved: true,
    files: normalizedConflictFiles,
    selectedTaskBranch,
    selectedCurrentSource,
    selectedWorkpadSource,
  };
}

async function saveTaskMetaMemory(taskMeta) {
  const memoryDir = path.join(
    process.env.HOME || '/tmp',
    '.kiro',
    'workspace-tasks',
  );

  try {
    fs.mkdirSync(memoryDir, { recursive: true });
    const slug = taskMeta.taskBranch.replace(/\//g, '-');
    const filePath = path.join(memoryDir, `${slug}.json`);
    fs.writeFileSync(filePath, JSON.stringify(taskMeta, null, 2) + '\n', 'utf8');
  } catch {
    // non-critical
  }
}

module.exports = {
  AUTO_RESOLVABLE_TASK_META_CONFLICTS,
  collectTaskMetaFiles,
  findTaskMeta,
  findScopedTaskMetaInDirectory,
  getTaskMetaBranchMismatch,
  isOnlyTaskMetadataConflict,
  isTaskMetaValidForBranch,
  readTaskMeta,
  readValidTaskMetaForWorktree,
  resolveTaskMetadataConflicts,
  saveTaskMetaMemory,
  validateBranchMatch,
  writeTaskMeta,
};
