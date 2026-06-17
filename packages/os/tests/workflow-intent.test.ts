import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createWorkflowIntentRuntime } from '../hooks/intent.js';

type ManifestToolDefinition = {
  name: string;
  workflowRole?: string;
  inputSchema?: string;
};

type ManifestWrapper = {
  name: string;
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
  kind: 'consuelo-os-workflow-bundles';
  workflows: WorkflowBundle[];
};

const manifestPath = resolve(import.meta.dirname, '../tooling/dev-tool-manifest.json');
const bundlesPath = resolve(import.meta.dirname, '../manifests/workflow-bundles.json');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readManifest(): ManifestToolDefinition[] {
  const value = readJson(manifestPath);
  if (!Array.isArray(value)) throw new Error('expected dev manifest array');
  return value as ManifestToolDefinition[];
}

function readBundles(): WorkflowBundlesFile {
  const value = readJson(bundlesPath) as WorkflowBundlesFile;
  if (value.kind !== 'consuelo-os-workflow-bundles') throw new Error('expected workflow bundle manifest');
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

describe('OS workflow intent bundles', () => {
  test('generated workflow bundles include task and office without changing get_steering profiles', () => {
    const bundles = readBundles();
    const task = workflowById(bundles, 'task');
    const office = workflowById(bundles, 'office');

    expect(task.roles).toEqual(expect.arrayContaining(['task.start', 'task.pr', 'workpad.write']));
    expect(toolNames(task)).toEqual(expect.arrayContaining(['task.start', 'task.pr', 'fs.write']));
    expect(task.subscriptions).toEqual(
      expect.arrayContaining([expect.objectContaining({ event: 'tool.postInvoke', tool: 'task.start' })]),
    );

    expect(office.aliases).toEqual(expect.arrayContaining(['design', 'sites']));
    expect(office.roles).toEqual(expect.arrayContaining(['office.publish', 'office.generate.website']));
    expect(toolNames(office)).toEqual(expect.arrayContaining(['design.publish', 'office.generateWebsite']));
  });

  test('intent.start returns a task workflow manifest bundle and first scoped hook result', () => {
    const runtime = createWorkflowIntentRuntime({
      manifest: readManifest(),
      bundles: readBundles(),
    });

    const result = runtime.start({
      workflow: 'task',
      taskSession: 'tsk_intent_task',
      area: 'os',
      title: 'intent architecture',
    });

    expect(result.workflow).toBe('task');
    expect(result.taskSession).toBe('tsk_intent_task');
    expect(result.manifestBundle.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining(['task.start']));
    expect(result.hookResult).toEqual(
      expect.objectContaining({
        workflow: 'task',
        stage: 'stream-context',
        requiredNextAction: expect.objectContaining({
          capability: 'stream.context',
          tool: 'stream.context',
        }),
      }),
    );
    expect(result.hookEvent).toEqual(expect.objectContaining({ taskSession: 'tsk_intent_task' }));
  });

  test('intent.start resolves office workflow aliases from generated metadata', () => {
    const runtime = createWorkflowIntentRuntime({ manifest: readManifest(), bundles: readBundles() });

    const design = runtime.start({ workflow: 'design', taskSession: 'tsk_design' });
    const sites = runtime.start({ workflow: 'sites', taskSession: 'tsk_sites' });

    expect(design.workflow).toBe('office');
    expect(design.requestedWorkflow).toBe('design');
    expect(sites.workflow).toBe('office');
    expect(design.manifestBundle.aliases).toEqual(expect.arrayContaining(['design', 'sites']));
    expect(design.manifestBundle.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['design.publish', 'office.generateWebsite']),
    );
  });

  test('intent.dispatch requires taskSession for scoped hook events', () => {
    const runtime = createWorkflowIntentRuntime({ manifest: readManifest(), bundles: readBundles() });

    expect(() =>
      runtime.dispatch({
        event: { workflow: 'task', event: 'tool.postInvoke', tool: 'task.start' },
      }),
    ).toThrow('taskSession is required');
  });

  test('intent.dispatch keeps concurrent task sessions isolated by taskSession and worktree', () => {
    const runtime = createWorkflowIntentRuntime({ manifest: readManifest(), bundles: readBundles() });

    runtime.start({ workflow: 'task', taskSession: 'tsk_a', area: 'os', title: 'agent a' });
    runtime.start({ workflow: 'task', taskSession: 'tsk_b', area: 'os', title: 'agent b' });

    const a = runtime.dispatch({
      taskSession: 'tsk_a',
      event: {
        workflow: 'task',
        event: 'tool.postInvoke',
        tool: 'task.start',
        result: {
          taskSession: 'tsk_a',
          area: 'os',
          branch: 'task/os/agent-a',
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
          area: 'os',
          branch: 'task/os/agent-b',
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
    expect(a.hookResult?.requiredNextAction.input.path).toBe('.task/os/agent-a/workpad.md');
    expect(b.hookResult?.requiredNextAction.input.path).toBe('.task/os/agent-b/workpad.md');
  });
});
