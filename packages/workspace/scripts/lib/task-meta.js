const fs = require('fs');
const path = require('path');

const TASK_META_FILENAME = '.task-meta.json';

function writeTaskMeta(worktreePath, data) {
  const filePath = path.join(worktreePath, TASK_META_FILENAME);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function readTaskMeta(worktreePath) {
  const filePath = path.join(worktreePath, TASK_META_FILENAME);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findTaskMeta(startDirectory) {
  let dir = path.resolve(startDirectory);

  while (true) {
    const filePath = path.join(dir, TASK_META_FILENAME);
    if (fs.existsSync(filePath)) {
      return { path: filePath, dir, data: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
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
    // non-critical — don't fail the task start if memory save fails
  }
}

module.exports = {
  findTaskMeta,
  readTaskMeta,
  saveTaskMetaMemory,
  writeTaskMeta,
};
