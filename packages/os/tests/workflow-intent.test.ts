import { describe, expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createWorkflowIntentRuntime } from '../hooks/intent.js';

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
  kind: 'consuelo-os-workflow-bundles';
  workflows: WorkflowBundle[];
};

const manifestPath = resolve(import.meta.dirname, '../tooling/dev-tool-manifest.json');
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
  return readJson(resolve(packageRoot, 'manifests/core.manifest.json')) as { tools: ManifestWrapper[] };
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
  test('should generate task and office workflow bundles when loading workflow metadata', () => {
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

  test('should return advisory task-start guidance when starting task intent', () => {
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
        stage: 'task-start-guidance',
        advisory: expect.objectContaining({ suggestedNextTool: 'stream.context' }),
      }),
    );
    expect(result.hookResult?.blockedAction).toBeUndefined();
    expect(result.hookResult?.requiredNextAction).toBeUndefined();
    expect(JSON.stringify(result.hookResult)).toContain('startFrom');
    expect(JSON.stringify(result.hookResult)).toContain('main');
    expect(JSON.stringify(result.hookResult)).toContain('stream');
    expect(result.hookEvent).toEqual(expect.objectContaining({ taskSession: 'tsk_intent_task' }));
  });

  test('should expose task.intent when reading the full and core manifests', () => {
    const intentEntry = readManifest().find((tool) => tool.workflowRole === 'intent.start');
    const coreIntentEntry = readCoreManifest().tools.find((tool) => tool.definition.workflowRole === 'intent.start');

    expect(intentEntry).toEqual(expect.objectContaining({
      name: 'task.intent',
      methodPath: ['task', 'intent'],
      command: expect.objectContaining({ script: 'task-intent' }),
    }));
    expect(coreIntentEntry).toEqual(expect.objectContaining({
      name: 'task.intent',
      core: true,
      definition: expect.objectContaining({
        name: 'task.intent',
        methodPath: ['task', 'intent'],
        command: expect.objectContaining({ script: 'task-intent' }),
      }),
    }));
  });

  test('should resolve office aliases when starting design or sites intent', () => {
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
    expect(a.hookResult?.suggestedNextAction.tool).toBe('batch');
    expect(JSON.stringify(a.hookResult?.suggestedNextAction.input)).toContain('code.call');
    expect(JSON.stringify(a.hookResult?.suggestedNextAction.input)).toContain('explore');
    expect(JSON.stringify(a.hookResult?.suggestedNextAction.input)).toContain('Bun structured repo scanner');
    expect(JSON.stringify(a.hookResult?.suggestedNextAction.input)).toContain('Python targeted file/snippet ownership read');
    expect(b.hookResult?.suggestedNextAction.tool).toBe('batch');
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
