import { expect, test } from 'vitest';

import taskSelection from '../scripts/lib/task-selection.js';

const {
  parseTaskSelectorPrefix,
  taskMatchesSelector,
} = taskSelection;

test('parseTaskSelectorPrefix accepts task session selectors', () => {
  const result = parseTaskSelectorPrefix([
    '--task-session',
    'tsk_abc123',
    '--message',
    'docs(os): example',
  ]);

  expect(result.selector).toMatchObject({
    taskSession: 'tsk_abc123',
  });
  expect(result.remainingArgs).toEqual(['--message', 'docs(os): example']);
});

test('taskMatchesSelector can select by task session', () => {
  const task = {
    branch: 'task/os-skills/example',
    meta: {
      area: 'os-skills',
      taskBranch: 'task/os-skills/example',
      prNumber: 123,
      taskSession: 'tsk_example',
    },
  };

  expect(taskMatchesSelector(task, { taskSession: 'tsk_example' })).toBe(true);
  expect(taskMatchesSelector(task, { taskSession: 'tsk_other' })).toBe(false);
});
