const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TASK_DIR = '.task';
const CURRENT_FILENAME = 'current.json';
const SESSION_FILENAME = 'session.json';
const VERIFY_FILENAME = 'verify.json';
const WORKPAD_FILENAME = 'workpad.md';
const TASKS_DIR = 'tasks';
const REVIEWS_DIR = 'reviews';
const CURRENT_META_PATH = `${TASK_DIR}/${CURRENT_FILENAME}`;
const WORKPAD_PATH = `${TASK_DIR}/${WORKPAD_FILENAME}`;

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

function getCurrentBranchSafe(cwd) {
  try {
    return execFileSync('git', ['branch', '--show-current'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch {
    return null;
  }
}

function parseTaskBranch(taskBranch) {
  if (!taskBranch) return null;
  const parts = String(taskBranch).split('/');
  if (parts[0] !== 'task' || !parts[1] || !parts[2]) return null;
  return { area: parts[1], slug: parts.slice(2).join('/') };
}

function getTaskSlug(taskBranch) {
  const parsed = parseTaskBranch(taskBranch);
  return parsed ? parsed.slug : null;
}

function getTaskArea(taskBranch) {
  const parsed = parseTaskBranch(taskBranch);
  return parsed ? parsed.area : null;
}

function safeTaskPathPart(value) {
  return String(value || '').split('/').filter(Boolean).join('-');
}

function getTaskAreaSlug(taskBranchOrMeta) {
  const taskBranch = typeof taskBranchOrMeta === 'string'
    ? taskBranchOrMeta
    : taskBranchOrMeta?.taskBranch || taskBranchOrMeta?.branch || null;
  const parsed = parseTaskBranch(taskBranch);
  if (!parsed) return null;
  return {
    area: safeTaskPathPart((typeof taskBranchOrMeta === 'object' && taskBranchOrMeta?.area) || parsed.area),
    slug: safeTaskPathPart(parsed.slug),
    taskBranch,
  };
}

function getTaskDirectory(worktreePath, taskBranchOrMeta) {
  const parts = getTaskAreaSlug(taskBranchOrMeta);
  if (!parts) return null;
  return path.join(worktreePath, TASK_DIR, parts.area, parts.slug);
}

function getTaskFilePath(worktreePath, taskBranchOrMeta, fileName) {
  const directory = getTaskDirectory(worktreePath, taskBranchOrMeta);
  return directory ? path.join(directory, fileName) : path.join(worktreePath, TASK_DIR, fileName);
}

function getTaskCurrentMetaPath(worktreePath, taskBranchOrMeta) {
  return getTaskFilePath(worktreePath, taskBranchOrMeta, CURRENT_FILENAME);
}

function getTaskSessionPath(worktreePath, taskBranchOrMeta) {
  return getTaskFilePath(worktreePath, taskBranchOrMeta, SESSION_FILENAME);
}

function getTaskVerifyPath(worktreePath, taskBranchOrMeta) {
  return getTaskFilePath(worktreePath, taskBranchOrMeta, VERIFY_FILENAME);
}

function getTaskWorkpadPath(worktreePath, taskBranchOrMeta) {
  return getTaskFilePath(worktreePath, taskBranchOrMeta, WORKPAD_FILENAME);
}

function getTaskReviewsDir(worktreePath, taskBranchOrMeta) {
  const directory = getTaskDirectory(worktreePath, taskBranchOrMeta);
  return directory ? path.join(directory, REVIEWS_DIR) : path.join(worktreePath, TASK_DIR, REVIEWS_DIR);
}

function getTaskStateDir(worktreePath, taskBranchOrMeta) {
  return getTaskDirectory(worktreePath, taskBranchOrMeta) || path.join(worktreePath, TASK_DIR);
}

function getTaskHistoryPath(worktreePath, area, slug) {
  return path.join(worktreePath, TASK_DIR, TASKS_DIR, area, `${slug}.json`);
}

function getTaskHistoryPathForMeta(worktreePath, taskMeta) {
  const parts = getTaskAreaSlug(taskMeta);
  return parts ? getTaskHistoryPath(worktreePath, parts.area, parts.slug) : null;
}

function getInvalidTaskMetaReason(taskMeta) {
  if (!taskMeta || !taskMeta.taskBranch) return 'missing taskBranch';
  if (!parseTaskBranch(taskMeta.taskBranch)) return `invalid taskBranch "${taskMeta.taskBranch}"`;
  return null;
}

function getTaskMetaBranchMismatch(taskMeta, currentBranch) {
  const invalidReason = getInvalidTaskMetaReason(taskMeta);
  if (invalidReason) return { expectedBranch: null, currentBranch, invalidReason };
  if (!currentBranch) return null;
  if (taskMeta.taskBranch === currentBranch) return null;
  return { expectedBranch: taskMeta.taskBranch, currentBranch };
}

function isTaskMetaValidForBranch(taskMeta, currentBranch) {
  return getTaskMetaBranchMismatch(taskMeta, currentBranch) === null;
}

function dedupePaths(paths) {
  return Array.from(new Set(paths.filter(Boolean)));
}

function listScopedCurrentMetaPaths(worktreePath) {
  const taskRoot = path.join(worktreePath, TASK_DIR);
  if (!fs.existsSync(taskRoot)) return [];
  const paths = [];
  for (const areaEntry of fs.readdirSync(taskRoot, { withFileTypes: true })) {
    if (!areaEntry.isDirectory()) continue;
    if (areaEntry.name === TASKS_DIR || areaEntry.name === REVIEWS_DIR) continue;
    const areaPath = path.join(taskRoot, areaEntry.name);
    for (const taskEntry of fs.readdirSync(areaPath, { withFileTypes: true })) {
      if (!taskEntry.isDirectory()) continue;
      const currentPath = path.join(areaPath, taskEntry.name, CURRENT_FILENAME);
      if (fs.existsSync(currentPath)) paths.push(currentPath);
    }
  }
  return paths;
}

function readTaskMetaRecordFromPath(filePath, directory, expectedBranch, includeStale) {
  if (!fs.existsSync(filePath)) return null;
  const data = readJsonFile(filePath);
  if (!data || getInvalidTaskMetaReason(data)) return null;
  const mismatch = getTaskMetaBranchMismatch(data, expectedBranch);
  const record = { path: filePath, dir: directory, data, stale: Boolean(mismatch), mismatch };
  if (mismatch && !includeStale) return null;
  return record;
}

function findTaskMetaInDirectory(directory, options = {}) {
  const expectedBranch = options.taskBranch || options.branch || options.currentBranch || getCurrentBranchSafe(directory);
  const candidatePaths = [];
  const scopedLookupBranch = options.taskBranch || options.branch || expectedBranch;
  const shouldSearchScopedMetadata = Boolean(
    options.taskBranch ||
    options.branch ||
    (typeof scopedLookupBranch === 'string' && scopedLookupBranch.startsWith('task/'))
  );
  if (options.taskBranch || options.branch) candidatePaths.push(getTaskCurrentMetaPath(directory, options.taskBranch || options.branch));
  if (expectedBranch) candidatePaths.push(getTaskCurrentMetaPath(directory, expectedBranch));
  if (shouldSearchScopedMetadata) candidatePaths.push(...listScopedCurrentMetaPaths(directory));
  candidatePaths.push(path.join(directory, TASK_DIR, CURRENT_FILENAME));
  candidatePaths.push(path.join(directory, '.task-meta.json'));
  const staleRecords = [];
  for (const candidatePath of dedupePaths(candidatePaths)) {
    const record = readTaskMetaRecordFromPath(candidatePath, directory, expectedBranch, Boolean(options.includeStale));
    if (!record) continue;
    if (!record.stale) return record;
    staleRecords.push(record);
  }
  return options.includeStale ? staleRecords[0] || null : null;
}

function writeTaskMeta(worktreePath, data) {
  const currentPath = getTaskCurrentMetaPath(worktreePath, data);
  fs.mkdirSync(path.dirname(currentPath), { recursive: true });
  fs.writeFileSync(currentPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  const historyPath = getTaskHistoryPathForMeta(worktreePath, data);
  if (historyPath) {
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    fs.writeFileSync(historyPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
}

function readTaskMeta(worktreePath, options = {}) {
  return findTaskMetaInDirectory(worktreePath, options)?.data || null;
}

function readValidTaskMetaForWorktree(worktreePath, branch) {
  const taskMeta = readTaskMeta(worktreePath, { currentBranch: branch, taskBranch: branch });
  if (!taskMeta) return null;
  if (!isTaskMetaValidForBranch(taskMeta, branch)) return null;
  return taskMeta;
}

function findTaskMeta(startDirectory, options = {}) {
  let dir = path.resolve(startDirectory);
  while (true) {
    const record = findTaskMetaInDirectory(dir, options);
    if (record) return record;
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
      `task metadata belongs to branch ${mismatch.expectedBranch}, but current branch is ${mismatch.currentBranch}.\n` +
      'this metadata was likely merged from another task.\n' +
      'run: bun run task:start -- --area <area> --title "<title>" to create a fresh task.',
    );
  }
}

function collectFilesUnderDirectory(worktreePath, directory, options = {}) {
  if (!directory || !fs.existsSync(directory)) return [];
  const files = [];
  const includeVerify = options.includeVerify !== false;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(fullPath); continue; }
      const repoPath = normalizeRepoPath(path.relative(worktreePath, fullPath));
      if (!includeVerify && repoPath.endsWith(`/${VERIFY_FILENAME}`)) continue;
      files.push({ path: repoPath, content: fs.readFileSync(fullPath, 'utf8'), deleted: false });
    }
  }
  walk(directory);
  return files;
}

function collectTaskMetaFiles(worktreePath, area, taskBranch, options = {}) {
  const files = [];
  const scopedDir = getTaskDirectory(worktreePath, { area, taskBranch });
  if (scopedDir && fs.existsSync(scopedDir)) {
    files.push(...collectFilesUnderDirectory(worktreePath, scopedDir, options));
    const historyPath = getTaskHistoryPathForMeta(worktreePath, { area, taskBranch });
    if (historyPath && fs.existsSync(historyPath)) {
      files.push({ path: normalizeRepoPath(path.relative(worktreePath, historyPath)), content: fs.readFileSync(historyPath, 'utf8'), deleted: false });
    }
    return files;
  }
  const legacyTaskDir = path.join(worktreePath, TASK_DIR);
  if (!fs.existsSync(legacyTaskDir)) return [];
  const taskSlug = getTaskSlug(taskBranch);
  const includeVerify = options.includeVerify !== false;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const rel = normalizeRepoPath(path.relative(legacyTaskDir, fullPath));
        if (area && rel.startsWith(TASKS_DIR + '/') && !rel.startsWith(TASKS_DIR + '/' + area)) continue;
        walk(fullPath);
        continue;
      }
      const repoPath = normalizeRepoPath(path.relative(worktreePath, fullPath));
      const taskHistoryPrefix = area ? `${TASK_DIR}/${TASKS_DIR}/${area}/` : null;
      if (taskHistoryPrefix && taskSlug && repoPath.startsWith(taskHistoryPrefix) && repoPath !== `${taskHistoryPrefix}${taskSlug}.json`) continue;
      if (!includeVerify && repoPath === `${TASK_DIR}/${VERIFY_FILENAME}`) continue;
      if (repoPath.startsWith(`${TASK_DIR}/${REVIEWS_DIR}/`)) continue;
      files.push({ path: repoPath, content: fs.readFileSync(fullPath, 'utf8'), deleted: false });
    }
  }
  walk(legacyTaskDir);
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
    return execFileSync('git', ['-C', worktreePath, 'show', `:${stage}:${repoPath}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function selectTaskMetaCandidate(candidates, currentBranch) {
  if (candidates.length === 0) return null;
  const scored = candidates.map((candidate) => {
    const taskMeta = candidate.data;
    let score = getMetaTimestamp(taskMeta);
    if (currentBranch && taskMeta.taskBranch === currentBranch) score += 3000000000000;
    if (currentBranch && currentBranch.startsWith('stream/') && (taskMeta.stream === currentBranch || taskMeta.baseBranch === currentBranch)) score += 2000000000000;
    if (taskMeta.taskBranch && candidate.workpadBranch === taskMeta.taskBranch) score += 1000000000000;
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
    if (selectedTaskBranch && branch === selectedTaskBranch) score += 2000000000000;
    return { ...candidate, branch, score };
  });
  scored.sort((left, right) => right.score - left.score);
  return scored[0];
}

function isAutoResolvableTaskMetadataPath(filePath) {
  const repoPath = normalizeRepoPath(filePath);
  return repoPath === CURRENT_META_PATH || repoPath === WORKPAD_PATH;
}

function isOnlyTaskMetadataConflict(conflictFiles) {
  return conflictFiles.length > 0 && conflictFiles.every(isAutoResolvableTaskMetadataPath);
}

function resolveTaskMetadataConflicts(worktreePath, conflictFiles, options = {}) {
  const normalizedConflictFiles = conflictFiles.map(normalizeRepoPath);
  const unsupportedFiles = normalizedConflictFiles.filter((filePath) => !isAutoResolvableTaskMetadataPath(filePath));
  if (unsupportedFiles.length > 0) return { resolved: false, reason: 'non-metadata conflicts present', unsupportedFiles };
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
    if (!selected) return { resolved: false, reason: 'could not parse task metadata conflict' };
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
    if (!selected) return { resolved: false, reason: 'could not read workpad conflict' };
    const workpadPath = path.join(worktreePath, WORKPAD_PATH);
    fs.mkdirSync(path.dirname(workpadPath), { recursive: true });
    fs.writeFileSync(workpadPath, selected.content.endsWith('\n') ? selected.content : selected.content + '\n', 'utf8');
    selectedWorkpadSource = selected.source;
  }
  execFileSync('git', ['-C', worktreePath, 'add', ...normalizedConflictFiles], { stdio: ['ignore', 'ignore', 'pipe'] });
  return { resolved: true, files: normalizedConflictFiles, selectedTaskBranch, selectedCurrentSource, selectedWorkpadSource };
}

async function saveTaskMetaMemory(taskMeta) {
  const memoryDir = path.join(process.env.HOME || '/tmp', '.kiro', 'workspace-tasks');
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
  CURRENT_META_PATH,
  TASK_DIR,
  WORKPAD_PATH,
  collectTaskMetaFiles,
  findTaskMeta,
  getTaskArea,
  getTaskAreaSlug,
  getTaskCurrentMetaPath,
  getTaskDirectory,
  getTaskFilePath,
  getTaskHistoryPath,
  getTaskReviewsDir,
  getTaskSessionPath,
  getTaskSlug,
  getTaskStateDir,
  getInvalidTaskMetaReason,
  getTaskMetaBranchMismatch,
  getTaskVerifyPath,
  getTaskWorkpadPath,
  isAutoResolvableTaskMetadataPath,
  isOnlyTaskMetadataConflict,
  isTaskMetaValidForBranch,
  readTaskMeta,
  readValidTaskMetaForWorktree,
  resolveTaskMetadataConflicts,
  saveTaskMetaMemory,
  validateBranchMatch,
  writeTaskMeta,
};
