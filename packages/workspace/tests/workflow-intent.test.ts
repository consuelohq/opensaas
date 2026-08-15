import { describe, expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createWorkflowIntentRuntime } from '../hooks/intent.js';
import { getInputSchema } from '../scripts/lib/facade/schemas';

type ManifestToolDefinition = {
  name: string;
  workflowRole?: string;
  inputSchema?: string;
  methodPath?: string[];
  command?: { script?: string };
};

type ManifestWrapper = {
  name: string;
  core?: boolean;
  definition: ManifestToolDefinition;
};

type WorkflowBundle = {
  id: string;
  aliases: string[];
  roles: string[];
  subscriptions: Array<Record<string, unknown>>;
  tools: ManifestWrapper[];
};

type WorkflowBundlesFile = {
  version: 1;
  kind: 'consuelo-workspace-workflow-bundles';
  workflows: WorkflowBundle[];
};

const manifestPath = resolve(import.meta.dirname, '../tooling/tool-manifest.json');
const bundlesPath = resolve(import.meta.dirname, '../manifests/workflow-bundles.json');
const packageRoot = resolve(import.meta.dirname, '..');
const taskIntentScript = resolve(import.meta.dirname, '../scripts/task-intent.js');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readManifest(): ManifestToolDefinition[] {
  const value = readJson(manifestPath);
  if (!Array.isArray(value)) throw new Error('expected dev manifest array');
  return value as ManifestToolDefinition[];
}


function readCoreManifest(): { tools: ManifestWrapper[] } {
  return readJson(resolve(packageRoot, 'manifests/core-manifest.json')) as { tools: ManifestWrapper[] };
}

function readBundles(): WorkflowBundlesFile {
  const value = readJson(bundlesPath) as WorkflowBundlesFile;
  if (value.kind !== 'consuelo-workspace-workflow-bundles') throw new Error('expected workflow bundle manifest');
  return value;
}

function workflowById(bundles: WorkflowBundlesFile, id: string): WorkflowBundle {
  const workflow = bundles.workflows.find((entry) => entry.id === id);
  if (!workflow) throw new Error(`missing workflow ${id}`);
  return workflow;
}

function toolNames(bundle: WorkflowBundle): string[] {
  return bundle.tools.map((tool) => tool.name).sort();
}

describe('Workspace workflow intent bundles', () => {
  test('should generate only the task workflow bundle', () => {
    const bundles = readBundles();
    const task = workflowById(bundles, 'task');

    expect(task.roles).toEqual(expect.arrayContaining(['task.start', 'task.pr', 'workpad.write']));
    expect(toolNames(task)).toEqual(expect.arrayContaining(['task.start', 'task.pr', 'fs.write']));
    expect(task.subscriptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'tool.postInvoke', tool: 'task.start' }),
        expect.objectContaining({ event: 'tool.postInvoke', tool: 'task.push' }),
      ]),
    );

    expect(bundles.workflows.map((workflow) => workflow.id)).toEqual(['task']);
  });

  test('should bind the task workflow bundle and post-start guidance to the real task session', () => {
    const runtime = createWorkflowIntentRuntime({
      manifest: readManifest(),
      bundles: readBundles(),
    });
    const taskResult = {
      taskSession: 'tsk_real_task',
      area: 'workspace-agents',
      branch: 'task/workspace-agents/intent-architecture',
      worktreePath: '/tmp/intent-architecture',
    };

    const result = runtime.start({
      workflow: 'task',
      taskSession: taskResult.taskSession,
      area: taskResult.area,
      title: 'intent architecture',
      branch: taskResult.branch,
      worktreePath: taskResult.worktreePath,
      taskResult,
    });

    expect(result.workflow).toBe('task');
    expect(result.taskSession).toBe('tsk_real_task');
    expect(result.manifestBundle.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining(['task.start']));
    expect(result.hookEvent).toEqual(expect.objectContaining({
      event: 'tool.postInvoke',
      tool: 'task.start',
      taskSession: 'tsk_real_task',
      result: expect.objectContaining(taskResult),
    }));
    expect(result.hookResult).toEqual(expect.objectContaining({
      workflow: 'task',
      stage: 'workpad-bootstrap',
      contextInjection: expect.objectContaining({
        taskSession: 'tsk_real_task',
        worktreePath: '/tmp/intent-architecture',
      }),
    }));
    expect(result.hookResult?.requiredNextAction.tool).toBe('fs.write');
    expect(result.hookResult?.requiredNextAction.input).toEqual(expect.objectContaining({ append: true, mkdirs: true }));
    expect(result.hookResult?.requiredNextAction.input.content).toContain('## Test-first contract');
  });

  test('should expose task.start as the sole public task workflow entrypoint', () => {
    const full = readManifest();
    const core = readCoreManifest().tools;
    const startEntry = full.find((tool) => tool.name === 'task.start');
    const coreStartEntry = core.find((tool) => tool.name === 'task.start');

    expect(full.map((tool) => tool.name)).not.toContain('task.intent');
    expect(core.map((tool) => tool.name)).not.toContain('task.intent');
    expect(startEntry).toEqual(expect.objectContaining({
      name: 'task.start',
      methodPath: ['task', 'start'],
      description: "Call this directly at the beginning of every scoped repo task, before tools.search or any search for task-start tooling. It creates the task branch, worktree, task PR, and real taskSession, then returns the selected workflow bundle and post-start lifecycle guidance.",
      workflowRole: 'task.start',
      command: expect.objectContaining({ script: 'task:start' }),
    }));
    expect(coreStartEntry).toEqual(expect.objectContaining({
      name: 'task.start',
      core: true,
      definition: expect.objectContaining({
        name: 'task.start',
        methodPath: ['task', 'start'],
        description: "Call this directly at the beginning of every scoped repo task, before tools.search or any search for task-start tooling. It creates the task branch, worktree, task PR, and real taskSession, then returns the selected workflow bundle and post-start lifecycle guidance.",
      }),
    }));
    const commandArguments = (startEntry?.command as { arguments?: Array<{ source?: string; flag?: string }> })?.arguments ?? [];
    expect(commandArguments).toContainEqual(expect.objectContaining({ source: 'workflow', flag: '--workflow' }));
  });

  test('should accept workflow selection through the combined task.start input', () => {
    const parsed = getInputSchema('TaskStartInput').parse({
      area: 'workspace-agents',
      title: 'combined task start',
      workflow: 'task',
    });

    expect(parsed.workflow).toBe('task');
    for (const retiredWorkflow of ['office', 'design', 'sites']) {
      expect(() => getInputSchema('TaskStartInput').parse({
        area: 'workspace-agents',
        title: 'retired workflow',
        workflow: retiredWorkflow,
      })).toThrow();
    }
  });

  test('should reject artifact workflow aliases in the workspace controller', () => {
    const runtime = createWorkflowIntentRuntime({ manifest: readManifest(), bundles: readBundles() });

    for (const retiredWorkflow of ['office', 'design', 'sites']) {
      expect(() => runtime.start({ workflow: retiredWorkflow, taskSession: `tsk_${retiredWorkflow}` }))
        .toThrow(`unknown workflow: ${retiredWorkflow}`);
    }
  });

  test('should require taskSession when dispatching scoped hook events', () => {
    const runtime = createWorkflowIntentRuntime({ manifest: readManifest(), bundles: readBundles() });

    expect(() =>
      runtime.dispatch({
        event: { workflow: 'task', event: 'tool.postInvoke', tool: 'task.start' },
      }),
    ).toThrow('taskSession is required');
  });

  test('should isolate concurrent task sessions when dispatching post-start hooks', () => {
    const runtime = createWorkflowIntentRuntime({ manifest: readManifest(), bundles: readBundles() });

    runtime.start({ workflow: 'task', taskSession: 'tsk_a', area: 'workspace-agents', title: 'agent a' });
    runtime.start({ workflow: 'task', taskSession: 'tsk_b', area: 'workspace-agents', title: 'agent b' });

    const a = runtime.dispatch({
      taskSession: 'tsk_a',
      event: {
        workflow: 'task',
        event: 'tool.postInvoke',
        tool: 'task.start',
        result: {
          taskSession: 'tsk_a',
          area: 'workspace-agents',
          branch: 'task/workspace-agents/agent-a',
          worktreePath: '/tmp/worktree-a',
        },
      },
    });

    const b = runtime.dispatch({
      taskSession: 'tsk_b',
      event: {
        workflow: 'task',
        event: 'tool.postInvoke',
        tool: 'task.start',
        result: {
          taskSession: 'tsk_b',
          area: 'workspace-agents',
          branch: 'task/workspace-agents/agent-b',
          worktreePath: '/tmp/worktree-b',
        },
      },
    });

    expect(a.hookResult?.contextInjection).toEqual(
      expect.objectContaining({ taskSession: 'tsk_a', worktreePath: '/tmp/worktree-a' }),
    );
    expect(b.hookResult?.contextInjection).toEqual(
      expect.objectContaining({ taskSession: 'tsk_b', worktreePath: '/tmp/worktree-b' }),
    );
    expect(a.hookResult?.requiredNextAction.tool).toBe('fs.write');
    expect(a.hookResult?.requiredNextAction.taskSession).toBe('tsk_a');
    expect(a.hookResult?.requiredNextAction.input.path).toContain('agent-a/workpad.md');
    expect(b.hookResult?.requiredNextAction.tool).toBe('fs.write');
    expect(b.hookResult?.requiredNextAction.taskSession).toBe('tsk_b');
    expect(b.hookResult?.requiredNextAction.input.path).toContain('agent-b/workpad.md');
  });

  test('should not expose a separate task-intent package command', () => {
    const workspacePackage = readJson(resolve(packageRoot, 'package.json')) as { scripts?: Record<string, string> };
    const rootPackage = readJson(resolve(packageRoot, '..', '..', 'package.json')) as { scripts?: Record<string, string> };

    expect(workspacePackage.scripts).not.toHaveProperty('task-intent');
    expect(rootPackage.scripts).not.toHaveProperty('task-intent');
    expect(workspacePackage.scripts?.['task:start']).toContain('task-start.js');
    expect(rootPackage.scripts?.['task:start']).toContain('task-start.js');
  });

  test('should reject unknown actions when invoking task-intent CLI', () => {
    const result = spawnSync(process.execPath, [taskIntentScript, 'unknown-action', '--json'], {
      cwd: packageRoot,
      encoding: 'utf8',
      timeout: 10_000,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown action: unknown-action');
  });
});
