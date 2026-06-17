import { describe, expect, test } from 'vitest';

import {
  getTaskHookGuidance,
  renderTaskHookGuidance,
} from '../hooks/task/guidance.js';

describe('Workspace task hook guidance', () => {
  test('after-task-start preserves task skill wording and gives concrete Workspace calls', () => {
    const guidance = getTaskHookGuidance('after-task-start', {
      area: 'workspace-agents',
      taskSession: 'tsk_example',
      worktreePath: '/tmp/example-worktree',
    });

    expect(guidance.title).toBe('Task started — preserve task-scoped workflow');
    expect(guidance.skillAnchors).toContain(
      'stream.context → task.start → scoped workpad + test-first contract → decision-engine research → focused red test or no-test waiver → implementation → focused green test → validation / verify → task.push → task.pr → stream review PR → task.finish',
    );
    expect(guidance.skillAnchors).toContain(
      'For task-scoped work, `task.start` returns `data.taskSession`.',
    );
    expect(guidance.skillAnchors).toContain(
      'Pass `taskSession` at the top level of every task-scoped `workspace.call`:',
    );
    expect(guidance.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'workspace.call',
          input: expect.objectContaining({
            tool: 'fs.read',
            taskSession: 'tsk_example',
          }),
        }),
        expect.objectContaining({
          command: 'workspace.call',
          input: expect.objectContaining({
            tool: 'code.run',
            taskSession: 'tsk_example',
          }),
        }),
      ]),
    );
    expect(JSON.stringify(guidance)).toContain('Test-first contract');
  });

  test('before-production-edit forces test-first or waiver guidance', () => {
    const rendered = renderTaskHookGuidance(
      getTaskHookGuidance('before-production-edit', { area: 'workspace-agents' }),
    );

    expect(rendered).toContain('For non-trivial code changes, implementation must not begin');
    expect(rendered).toContain('focused test has been written or updated and run red');
    expect(rendered).toContain('no-test waiver explains why no test is appropriate');
    expect(rendered).not.toContain('please');
  });

  test('unknown-task-tool guidance keeps tools.search as the recovery path', () => {
    const guidance = getTaskHookGuidance('unknown-task-tool', {
      requestedTool: 'task.finish',
    });

    expect(guidance.actions).toContainEqual(
      expect.objectContaining({
        command: 'workspace.call',
        input: expect.objectContaining({
          tool: 'tools.search',
          input: { query: 'task.finish' },
        }),
      }),
    );
    expect(renderTaskHookGuidance(guidance)).toContain('task.finish');
  });
});
