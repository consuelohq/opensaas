const fs = require('fs');
const path = require('path');

const TASK_DIR = '.task';
const CURRENT_FILENAME = 'current.json';
const TASKS_DIR = 'tasks';

// .task/current.json — active task for this branch
function getCurrentMetaPath(worktreePath) {
  return path.join(worktreePath, TASK_DIR, CURRENT_FILENAME);
}

// .task/tasks/<area>/<slug>.json — durable per-task history
function getTaskHistoryPath(worktreePath, area, slug) {
  return path.join(worktreePath, TASK_DIR, TASKS_DIR, area, `${slug}.json`);
}

function writeTaskMeta(worktreePath, data) {
  // write .task/current.json
  const currentPath = getCurrentMetaPath(worktreePath);
  fs.mkdirSync(path.dirname(currentPath), { recursive: true });
  fs.writeFileSync(currentPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

  // write .task/tasks/<area>/<slug>.json if we have area info
  if (data.area && data.taskBranch) {
    const parts = data.taskBranch.split('/');
    const slug = parts[parts.length - 1];
    const historyPath = getTaskHistoryPath(worktreePath, data.area, slug);
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    fs.writeFileSync(historyPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
}

function readTaskMeta(worktreePath) {
  const currentPath = getCurrentMetaPath(worktreePath);
  if (!fs.existsSync(currentPath)) return null;
  return JSON.parse(fs.readFileSync(currentPath, 'utf8'));
}

function findTaskMeta(startDirectory) {
  let dir = path.resolve(startDirectory);

  while (true) {
    const currentPath = path.join(dir, TASK_DIR, CURRENT_FILENAME);
    if (fs.existsSync(currentPath)) {
      return { path: currentPath, dir, data: JSON.parse(fs.readFileSync(currentPath, 'utf8')) };
    }

    // fallback: check for legacy .task-meta.json
    const legacyPath = path.join(dir, '.task-meta.json');
    if (fs.existsSync(legacyPath)) {
      return { path: legacyPath, dir, data: JSON.parse(fs.readFileSync(legacyPath, 'utf8')) };
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

function validateBranchMatch(taskMeta, currentBranch) {
  if (!taskMeta || !taskMeta.data || !taskMeta.data.taskBranch) return;
  if (taskMeta.data.taskBranch !== currentBranch) {
    throw new Error(
      `.task/current.json belongs to branch ${taskMeta.data.taskBranch}, but current branch is ${currentBranch}.\n` +
      'this metadata was likely merged from another task.\n' +
      'run: bun run task:start -- --area <area> --title "<title>" to create a fresh task.',
    );
  }
}

// collect all .task/ files in the worktree for auto-include in pushes
function collectTaskMetaFiles(worktreePath, area) {
  const taskDir = path.join(worktreePath, TASK_DIR);
  if (!fs.existsSync(taskDir)) return [];

  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // skip other areas' task history when area is specified
        const rel = path.relative(taskDir, fullPath).split(path.sep).join('/');
        if (area && rel.startsWith(TASKS_DIR + '/') && !rel.startsWith(TASKS_DIR + '/' + area)) {
          continue;
        }
        walk(fullPath);
      } else {
        const repoPath = path.relative(worktreePath, fullPath).split(path.sep).join('/');
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
  collectTaskMetaFiles,
  findTaskMeta,
  readTaskMeta,
  saveTaskMetaMemory,
  validateBranchMatch,
  writeTaskMeta,
};
