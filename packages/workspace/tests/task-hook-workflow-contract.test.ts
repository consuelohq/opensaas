import { describe, expect, test } from 'vitest';

const TASK_SKILL_EXCERPT = `
stream.context → task.start → scoped workpad + test-first contract → decision-engine research → focused red test or no-test waiver → implementation → focused green test → validation / verify → task.push → task.pr → stream review PR → task.finish

For task-scoped work, task.start returns data.taskSession.
Pass taskSession at the top level of every task-scoped workspace.call.
Every task must keep its task-local scoped workpad current enough for another agent to continue without chat history.
For non-trivial code changes, implementation must not begin until the scoped workpad contains a Test-first contract and either a focused test has been written or updated and run red, or a no-test waiver explains why no test is appropriate and what validation replaces it.
task.pr must promote the task into the stream and return the stream review PR unless Ko explicitly asks for task-only mode.
`;

type ManifestTool = {
  name: string;
  inputSchema: string;
  defaultTimeout: number;
  sessionRequired: boolean;
  workflowRole?: string;
  command?: Record<string, unknown>;
};

const manifestFixture: ManifestTool[] = [
  tool('stream.inspect', 'stream.context', false, 'StreamContextInput'),
  tool('task.begin', 'task.start', false, 'TaskStartInput'),
  tool('fs.put', 'workpad.write', true, 'FsWriteInput'),
  tool('code.evaluate', 'decision.research', true, 'CodeRunInput'),
  tool('task.run', 'test.run', true, 'TaskExecInput'),
  tool('git.delta', 'diff.inspect', true, 'GitDiffInput'),
  tool('review.check', 'validation.review', true, 'ReviewRunInput'),
  tool('verify.check', 'validation.verify', true, 'VerifyInput'),
  tool('task.publish', 'task.push', true, 'TaskPushInput'),
  tool('task.promote', 'task.pr', true, 'TaskPrInput'),
  tool('task.close', 'task.finish', true, 'BranchInput'),
  tool('tools.find', 'tool.search', false, 'ToolsSearchInput'),
];

function tool(name: string, workflowRole: string, sessionRequired: boolean, inputSchema: string): ManifestTool {
  return {
    name,
    workflowRole,
    inputSchema,
    sessionRequired,
    defaultTimeout: sessionRequired ? 120000 : 30000,
    command: { script: name.replace('.', ':') },
  };
}

async function loadWorkflowModule() {
  try {
    return await import('../hooks/task/workflow.js');
  } catch (error: unknown) {
    throw new Error(
      `Expected packages/workspace/hooks/task/workflow.js to export the manifest-driven task hook workflow contract. Original import error: ${String(error)}`,
    );
  }
}

describe('Workspace manifest-driven task workflow hooks contract', () => {
  test('exposes the complete task workflow as ordered subscribable stages from the skill text', async () => {
    const { createTaskWorkflowHookRegistry } = await loadWorkflowModule();
    const registry = createTaskWorkflowHookRegistry({ manifest: manifestFixture, skillText: TASK_SKILL_EXCERPT });

    expect(registry.workflow('task').stages.map((stage: { id: string }) => stage.id)).toEqual([
      'stream-context',
      'task-start',
      'workpad-bootstrap',
      'test-contract',
      'decision-research',
      'focused-red-or-waiver',
      'implementation',
      'focused-green',
      'validation',
      'task-push',
      'task-pr',
      'stream-review-pr',
      'task-finish',
    ]);

    expect(registry.workflow('task').stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'test-contract',
          requiredSkillAnchors: expect.arrayContaining([
            expect.stringContaining('Test-first contract'),
            expect.stringContaining('focused test'),
            expect.stringContaining('no-test waiver'),
          ]),
        }),
        expect.objectContaining({
          id: 'task-pr',
          requiredSkillAnchors: expect.arrayContaining([
            expect.stringContaining('stream review PR'),
          ]),
        }),
      ]),
    );

    expect(registry.subscriptions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'workflow.intent.task.detected', workflow: 'task' }),
        expect.objectContaining({ event: 'tool.preInvoke', tool: 'task.start' }),
        expect.objectContaining({ event: 'tool.postInvoke', tool: 'task.start' }),
        expect.objectContaining({ event: 'tool.preInvoke', tool: 'task.push' }),
        expect.objectContaining({ event: 'tool.postInvoke', tool: 'task.pr' }),
      ]),
    );
    expect(registry.subscriptions().map((subscription: { event: string }) => subscription.event)).not.toContain('before-task-start');
  });

  test('does not emit task guidance for unrelated non-task events', async () => {
    const { createTaskWorkflowHookRegistry } = await loadWorkflowModule();
    const registry = createTaskWorkflowHookRegistry({ manifest: manifestFixture, skillText: TASK_SKILL_EXCERPT });

    expect(
      registry.handle({
        event: 'tool.preInvoke',
        tool: 'fs.read',
        workflow: 'general',
        state: { area: 'workspace-agents' },
      }),
    ).toBeNull();

    expect(
      registry.handle({
        event: 'chat.message',
        workflow: 'general',
        state: { text: 'summarize this file' },
      }),
    ).toBeNull();
  });

  test('pre-task-start guidance requires stream context through the current manifest contract, not hard-coded tool names', async () => {
    const { createTaskWorkflowHookRegistry } = await loadWorkflowModule();
    const registry = createTaskWorkflowHookRegistry({ manifest: manifestFixture, skillText: TASK_SKILL_EXCERPT });

    const guidance = registry.handle({
      event: 'tool.preInvoke',
      tool: 'task.start',
      workflow: 'task',
      state: { area: 'workspace-agents', title: 'implement later', hasStreamContext: false },
    });

    expect(guidance).toEqual(
      expect.objectContaining({
        workflow: 'task',
        stage: 'stream-context',
        event: 'tool.preInvoke',
        blockedAction: expect.objectContaining({ requestedTool: 'task.start' }),
        requiredNextAction: expect.objectContaining({
          capability: 'stream.context',
          tool: 'stream.inspect',
          inputSchema: 'StreamContextInput',
          source: 'manifest',
          input: { area: 'workspace-agents' },
        }),
      }),
    );

    expect(guidance.requiredNextAction.tool).toBe('stream.inspect');
    expect(guidance.blockedAction.requestedTool).toBe('task.start');
  });

  test('post-task-start guidance injects task session and workpad bootstrap at the tool layer', async () => {
    const { createTaskWorkflowHookRegistry } = await loadWorkflowModule();
    const registry = createTaskWorkflowHookRegistry({ manifest: manifestFixture, skillText: TASK_SKILL_EXCERPT });

    const guidance = registry.handle({
      event: 'tool.postInvoke',
      tool: 'task.start',
      workflow: 'task',
      result: {
        taskSession: 'tsk_abc123',
        area: 'workspace-agents',
        branch: 'task/workspace-agents/example',
        worktreePath: '/tmp/example',
      },
    });

    expect(guidance).toEqual(
      expect.objectContaining({
        workflow: 'task',
        stage: 'workpad-bootstrap',
        contextInjection: expect.objectContaining({
          taskSession: 'tsk_abc123',
          worktreePath: '/tmp/example',
          requiredBeforeProductionEdit: expect.stringContaining('Test-first contract'),
        }),
        requiredNextAction: expect.objectContaining({
          capability: 'workpad.write',
          tool: 'fs.put',
          source: 'manifest',
          taskSessionPlacement: 'top-level',
          taskSession: 'tsk_abc123',
        }),
      }),
    );

    expect(guidance.requiredNextAction.input.path).toBe('.task/workspace-agents/example/workpad.md');
    expect(guidance.requiredNextAction.input.content).toContain('Test-first contract');
  });

  test('publish guidance is a staged plan from validation to stream review PR and task finish', async () => {
    const { createTaskWorkflowHookRegistry } = await loadWorkflowModule();
    const registry = createTaskWorkflowHookRegistry({ manifest: manifestFixture, skillText: TASK_SKILL_EXCERPT });

    const guidance = registry.handle({
      event: 'workflow.stage.ready',
      workflow: 'task',
      stage: 'validation',
      state: {
        area: 'workspace-agents',
        taskSession: 'tsk_publish',
        base: 'origin/stream/workspace-agents',
        changedFiles: ['packages/workspace/tests/task-hook-workflow-contract.test.ts'],
      },
    });

    expect(guidance.orderedActions.map((action: { capability: string }) => action.capability)).toEqual([
      'diff.inspect',
      'validation.review',
      'validation.verify',
      'task.push',
      'task.pr',
    ]);
    expect(guidance.orderedActions.map((action: { tool: string }) => action.tool)).toEqual([
      'git.delta',
      'review.check',
      'verify.check',
      'task.publish',
      'task.promote',
    ]);
    expect(guidance.orderedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskSession: 'tsk_publish', taskSessionPlacement: 'top-level' }),
        expect.objectContaining({ capability: 'task.pr', input: { ready: true } }),
      ]),
    );
    expect(guidance.notes.join('\n')).toContain('stream review PR');
  });

  test('falls back to the manifest-provided tool search capability when a gated task capability is missing', async () => {
    const { createTaskWorkflowHookRegistry } = await loadWorkflowModule();
    const manifestWithoutFinish = manifestFixture.filter((entry) => entry.workflowRole !== 'task.finish');
    const registry = createTaskWorkflowHookRegistry({ manifest: manifestWithoutFinish, skillText: TASK_SKILL_EXCERPT });

    const guidance = registry.handle({
      event: 'workflow.stage.ready',
      workflow: 'task',
      stage: 'task-finish',
      state: { taskSession: 'tsk_finish' },
    });

    expect(guidance.requiredNextAction).toEqual(
      expect.objectContaining({
        capability: 'tool.search',
        tool: 'tools.find',
        source: 'manifest',
        input: { query: 'task.finish' },
      }),
    );
    expect(JSON.stringify(guidance)).not.toContain('tools.search');
  });
});

