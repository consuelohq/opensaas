import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';

import taskMeta from '../scripts/lib/task-meta.js';

const { collectTaskMetaFiles, findTaskMeta, readValidTaskMetaForWorktree } = taskMeta;
const tempRoots = [];

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'task-meta-test-'));
  tempRoots.push(root);
  return root;
}

function writeFile(root, filePath, content = '{}\n') {
  const absolutePath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
  return absolutePath;
}

function writeScopedCurrent(repoRoot) {
  const taskPath = writeFile(repoRoot, '.task/os-skills/example-task/current.json', JSON.stringify({
    area: 'os-skills',
    taskBranch: 'task/os-skills/example-task',
    taskSession: 'tsk_example',
    worktreePath: repoRoot,
  }, null, 2));
  return { taskPath, data: JSON.parse(fs.readFileSync(taskPath, 'utf8')) };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test('findTaskMeta ignores invalid root metadata on main', () => {
  const repoRoot = makeRepo();
  writeFile(repoRoot, '.task/current.json', JSON.stringify({
    area: 'diff-cockpit',
    stream: 'stream/diff-cockpit',
    taskBranch: 'main',
    baseBranch: 'stream/diff-cockpit',
  }, null, 2));

  expect(findTaskMeta(repoRoot, { currentBranch: 'main', includeStale: true })).toBeNull();
  expect(findTaskMeta(repoRoot, { currentBranch: 'main' })).toBeNull();
});

test('findTaskMeta ignores invalid legacy metadata on main', () => {
  const repoRoot = makeRepo();
  writeFile(repoRoot, '.task-meta.json', JSON.stringify({
    taskBranch: 'main',
    baseBranch: 'stream/os',
  }, null, 2));

  expect(findTaskMeta(repoRoot, { currentBranch: 'main', includeStale: true })).toBeNull();
});

test('findTaskMeta discovers scoped current task metadata for the current branch', () => {
  const repoRoot = makeRepo();
  const { taskPath } = writeScopedCurrent(repoRoot);

  const result = findTaskMeta(repoRoot, { currentBranch: 'task/os-skills/example-task' });

  expect(result).toMatchObject({
    path: taskPath,
    dir: repoRoot,
    stale: false,
    data: {
      area: 'os-skills',
      taskBranch: 'task/os-skills/example-task',
    },
  });
});


test('explore preserves underlying failures in stderr diagnostics', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'scripts', 'explore.js'), 'utf8');
  expect(source).toContain('function formatErrorDetails(error)');
  expect(source).toContain('explore failed: ${formatErrorDetails(error)}');
});

test('readValidTaskMetaForWorktree reads scoped task metadata', () => {
  const repoRoot = makeRepo();
  const { data } = writeScopedCurrent(repoRoot);

  expect(readValidTaskMetaForWorktree(repoRoot, 'task/os-skills/example-task')).toMatchObject(data);
});

test('collectTaskMetaFiles only includes metadata for the selected task', () => {
  const repoRoot = makeRepo();
  writeScopedCurrent(repoRoot);
  writeFile(repoRoot, '.task/os-skills/example-task/workpad.md', '# current\n');
  writeFile(repoRoot, '.task/os-skills/other-task/current.json', '{}\n');
  writeFile(repoRoot, '.task/design/other-design/current.json', '{}\n');
  writeFile(repoRoot, '.task/tasks/os-skills/example-task.json', '{}\n');
  writeFile(repoRoot, '.task/tasks/os-skills/other-task.json', '{}\n');

  const files = collectTaskMetaFiles(repoRoot, 'os-skills', 'task/os-skills/example-task')
    .map((file) => file.path)
    .sort();

  expect(files).toEqual([
    '.task/os-skills/example-task/current.json',
    '.task/os-skills/example-task/workpad.md',
    '.task/tasks/os-skills/example-task.json',
  ]);
});
