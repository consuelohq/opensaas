import { expect, test } from 'vitest';

import publishScope from '../scripts/lib/publish-scope.js';
import taskPush from '../scripts/task-push.js';
import streamSync from '../scripts/stream-sync.js';

const { classifyPublishPath, createPublishPlan, classifyStreamConflicts } = publishScope;
const { buildTaskPushPublishPlan } = taskPush;
const { buildStreamConflictResolution } = streamSync;

const taskContext = {
  area: 'diff-cockpit',
  taskBranch: 'task/diff-cockpit/fix-scroll-navigation',
};

test('classifies area, task metadata, shared, and out-of-area paths', () => {
  expect(classifyPublishPath('packages/diff-cockpit/src/index.ts', taskContext).kind).toBe('area');
  expect(classifyPublishPath('.task/diff-cockpit/fix-scroll-navigation/workpad.md', taskContext).kind).toBe('metadata');
  expect(classifyPublishPath('.task/tasks/diff-cockpit/fix-scroll-navigation.json', taskContext).kind).toBe('metadata');
  expect(classifyPublishPath('package.json', taskContext).kind).toBe('shared');
  expect(classifyPublishPath('packages/os/scripts/install.ts', taskContext).kind).toBe('out-of-area');
  expect(classifyPublishPath('.task/os/other/workpad.md', taskContext).kind).toBe('out-of-area');
});

test('builds a soft-pruned publish plan without mutating local files', () => {
  const plan = createPublishPlan([
    { path: 'packages/diff-cockpit/src/index.ts', content: 'ok', deleted: false },
    { path: '.task/diff-cockpit/fix-scroll-navigation/workpad.md', content: 'ok', deleted: false },
    { path: 'packages/os/scripts/install.ts', content: 'stale', deleted: false },
    { path: '.task/os/other/workpad.md', content: 'stale', deleted: false },
  ], taskContext);

  expect(plan.files.map((file) => file.path)).toEqual([
    'packages/diff-cockpit/src/index.ts',
    '.task/diff-cockpit/fix-scroll-navigation/workpad.md',
  ]);
  expect(plan.pruned.map((file) => file.path)).toEqual([
    'packages/os/scripts/install.ts',
    '.task/os/other/workpad.md',
  ]);
});

test('task-push exposes the same filtered publish plan', () => {
  const plan = buildTaskPushPublishPlan({
    files: [
      { path: 'packages/diff-cockpit/src/index.ts', content: 'ok', deleted: false },
      { path: 'packages/os/scripts/install.ts', content: 'stale', deleted: false },
    ],
    area: 'diff-cockpit',
    taskBranch: 'task/diff-cockpit/fix-scroll-navigation',
  });

  expect(plan.files.map((file) => file.path)).toEqual(['packages/diff-cockpit/src/index.ts']);
  expect(plan.pruned.map((file) => file.path)).toEqual(['packages/os/scripts/install.ts']);
});

test('stream sync can auto-prune out-of-area conflicts but not in-area conflicts', () => {
  const outOfArea = classifyStreamConflicts([
    'packages/os/scripts/install.ts',
    '.task/os/other/workpad.md',
  ], { area: 'diff-cockpit' });

  expect(outOfArea.canAutoResolve).toBe(true);
  expect(outOfArea.prunablePaths).toEqual(['packages/os/scripts/install.ts', '.task/os/other/workpad.md']);
  expect(outOfArea.manualPaths).toEqual([]);

  const inArea = buildStreamConflictResolution([
    'packages/diff-cockpit/src/index.ts',
    'packages/os/scripts/install.ts',
  ], { area: 'diff-cockpit' });

  expect(inArea.canAutoResolve).toBe(false);
  expect(inArea.manualPaths).toEqual(['packages/diff-cockpit/src/index.ts']);
  expect(inArea.prunablePaths).toEqual(['packages/os/scripts/install.ts']);
});
