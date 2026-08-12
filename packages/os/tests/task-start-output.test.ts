import { describe, expect, it } from 'vitest';

const { createWorkflowIntentRuntime } = require('../hooks/intent.js');
const { compactTaskStartOutput } = require('../scripts/lib/task-start-output.js');

function workflowStart() {
  return createWorkflowIntentRuntime().start({
    workflow: 'task',
    taskSession: 'tsk_compact_output',
    area: 'os',
    title: 'compact task start output',
    branch: 'task/os/compact-task-start-output',
    worktreePath: '/tmp/compact-task-start-output',
    taskResult: {
      area: 'os',
      branch: 'task/os/compact-task-start-output',
      worktreePath: '/tmp/compact-task-start-output',
      taskSession: 'tsk_compact_output',
    },
  });
}

describe('OS task.start public output', () => {
  it('keeps workflow guidance actionable without returning full tool definitions or discovery programs', () => {
    const start = workflowStart();
    const full = {
      taskSession: 'tsk_compact_output',
      workflow: start.workflow,
      requestedWorkflow: start.requestedWorkflow,
      manifestBundle: start.manifestBundle,
      hookEvent: start.hookEvent,
      hookResult: start.hookResult,
    };

    const compact = compactTaskStartOutput(full);
    const serialized = JSON.stringify(compact);

    expect(compact.manifestBundle.aliases).toEqual(start.manifestBundle.aliases);
    expect(compact.manifestBundle.tools.map((tool: { name: string }) => tool.name)).toEqual(
      expect.arrayContaining(['task.start', 'code.run', 'code.call']),
    );
    expect(compact.hookResult.contextInjection).toEqual(expect.objectContaining({
      taskSession: 'tsk_compact_output',
      worktreePath: '/tmp/compact-task-start-output',
    }));
    expect(compact.hookResult.requiredNextAction).toEqual(expect.objectContaining({
      capability: 'workpad.write',
      tool: 'fs.write',
      taskSession: 'tsk_compact_output',
      input: expect.objectContaining({ append: true, mkdirs: true }),
    }));
    expect(serialized).not.toContain('definition');
    expect(serialized).not.toContain('Bun structured repo scanner');
    expect(serialized.length).toBeLessThan(JSON.stringify(full).length / 3);
  });
});
