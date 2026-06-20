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
const repoRoot = resolve(packageRoot, '..', '..');
const taskIntentScript = resolve(import.meta.dirname, '../scripts/task-intent.js');

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

  test('task.intent starts with advisory task-start lifecycle guidance', () => {
    const runtime = createWorkflowIntentRuntime({
      manifest: readManifest(),
      bundles: readBundles(),
    });

    const result = runtime.start({
      workflow: 'task',
      taskSession: 'tsk_intent_task',
      area: 'workspace-agents',
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

  test('manifest exposes task.intent as the workflow lifecycle entrypoint', () => {
    const intentEntry = readManifest().find((tool) => tool.workflowRole === 'intent.start');

    expect(intentEntry).toEqual(expect.objectContaining({
      name: 'task.intent',
      methodPath: ['task', 'intent'],
      command: expect.objectContaining({ script: 'task-intent' }),
    }));
  });

  test('task.intent resolves office workflow aliases from generated metadata', () => {
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

  test('task.intent dispatch requires taskSession for scoped hook events', () => {
    const runtime = createWorkflowIntentRuntime({ manifest: readManifest(), bundles: readBundles() });

    expect(() =>
      runtime.dispatch({
        event: { workflow: 'task', event: 'tool.postInvoke', tool: 'task.start' },
      }),
    ).toThrow('taskSession is required');
  });

  test('task.intent dispatch keeps concurrent task sessions isolated by taskSession and worktree', () => {
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
    expect(a.hookResult?.suggestedNextAction.tool).toBe('batch');
    expect(JSON.stringify(a.hookResult?.suggestedNextAction.input)).toContain('code.call');
    expect(JSON.stringify(a.hookResult?.suggestedNextAction.input)).toContain('explore');
    expect(JSON.stringify(a.hookResult?.suggestedNextAction.input)).toContain('Bun structured repo scanner');
    expect(JSON.stringify(a.hookResult?.suggestedNextAction.input)).toContain('Python targeted file/snippet ownership read');
    expect(b.hookResult?.suggestedNextAction.tool).toBe('batch');
  });

  test('repo root package script exposes workspace task-intent CLI help', () => {
    const result = spawnSync('bun', ['run', 'task-intent', '--', '--help'], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 10_000,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('usage: bun run task-intent -- <start|dispatch> [options]');
  });

  test('repo root package script starts the workspace task-intent bundle', () => {
    const result = spawnSync('bun', [
      'run',
      'task-intent',
      '--',
      'start',
      '--workflow',
      'task',
      '--area',
      'workspace-agents',
      '--title',
      'root intent smoke',
      '--json',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 10_000,
    });

    expect(result.status).toBe(0);
    const envelope = JSON.parse(result.stdout) as { workflow: string; manifestBundle?: { tools?: Array<{ name: string }> } };
    expect(envelope.workflow).toBe('task');
    expect(envelope.manifestBundle?.tools?.map((tool) => tool.name)).toEqual(expect.arrayContaining(['task.start']));
  });

  test('task-intent CLI rejects unknown actions', () => {
    const result = spawnSync(process.execPath, [taskIntentScript, 'unknown-action', '--json'], {
      cwd: packageRoot,
      encoding: 'utf8',
      timeout: 10_000,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown action: unknown-action');
  });
});
