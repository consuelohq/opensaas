import { describe, expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
  kind: 'consuelo-os-workflow-bundles';
  workflows: WorkflowBundle[];
};

const manifestPath = resolve(import.meta.dirname, '../manifests/generated/tool.manifest.json');
const bundlesPath = resolve(import.meta.dirname, '../workflows/generated/workflow-bundles.json');
const packageRoot = resolve(import.meta.dirname, '..');
const taskIntentScript = resolve(import.meta.dirname, '../scripts/task-intent.js');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readManifest(): ManifestToolDefinition[] {
  const value = readJson(manifestPath) as { kind?: string; tools?: ManifestWrapper[] };
  if (value.kind !== 'consuelo-os-tool-manifest' || !Array.isArray(value.tools)) {
    throw new Error('expected generated tool manifest');
  }
  return value.tools.map((entry) => entry.definition);
}


function readCoreManifest(): { tools: ManifestWrapper[] } {
  return readJson(resolve(packageRoot, 'manifests/generated/core.manifest.json')) as { tools: ManifestWrapper[] };
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
  test('uses the canonical TypeScript workflow source and generated output paths', async () => {
    const source = await import('../workflows/workflows');
    expect(source.workflows.map((workflow) => workflow.id)).toEqual(['task', 'artifacts', 'media']);
    expect(existsSync(resolve(packageRoot, 'workflows/generated/workflow-bundles.json'))).toBe(true);
    expect(existsSync(resolve(packageRoot, 'tooling'))).toBe(false);
  });
  test('should generate task and artifacts workflow bundles when loading workflow metadata', () => {
    const bundles = readBundles();
    const task = workflowById(bundles, 'task');
    const artifacts = workflowById(bundles, 'artifacts');

    expect(task.roles).toEqual(expect.arrayContaining(['task.start', 'task.pr', 'workpad.write']));
    expect(toolNames(task)).toEqual(expect.arrayContaining(['task.start', 'task.pr', 'fs.write']));
    expect(task.subscriptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'tool.postInvoke', tool: 'task.start' }),
        expect.objectContaining({ event: 'tool.postInvoke', tool: 'task.push' }),
      ]),
    );

    expect(artifacts.aliases).toEqual([]);
    expect(artifacts.roles).toEqual(expect.arrayContaining(['artifacts.publish', 'artifacts.generate.website']));
    expect(toolNames(artifacts)).toEqual(expect.arrayContaining(['artifacts.publish', 'artifacts.generateWebsite']));
  });

  test('should bind the task workflow bundle and post-start guidance to the real task session', () => {
    const runtime = createWorkflowIntentRuntime({
      manifest: readManifest(),
      bundles: readBundles(),
    });
    const taskResult = {
      taskSession: 'tsk_real_task',
      area: 'os',
      branch: 'task/os/intent-architecture',
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

  test('should use a branch-shaped task handle when task intent has not started a task yet', () => {
    const runtime = createWorkflowIntentRuntime({
      manifest: readManifest(),
      bundles: readBundles(),
    });

    const result = runtime.start({
      workflow: 'task',
      area: 'os',
      title: 'intent architecture',
    });

    expect(result.taskSession).toBe('task/os/intent-architecture');
    expect(result.hookEvent).toEqual(expect.objectContaining({ taskSession: 'task/os/intent-architecture' }));
  });

  test('should expose task.start as the compatibility public task workflow entrypoint', () => {
    const full = readManifest();
    const core = readCoreManifest().tools;
    const startEntry = full.find((tool) => tool.name === 'task.start');
    const coreStartEntry = core.find((tool) => tool.name === 'task.start');

    expect(full.map((tool) => tool.name)).not.toContain('task.intent');
    expect(core.map((tool) => tool.name)).not.toContain('task.intent');
    expect(startEntry).toEqual(expect.objectContaining({
      name: 'task.start',
      methodPath: ['task', 'start'],
      description: 'Compatibility alias for session.start({ kind: "task" }). Existing callers remain supported; new agents should prefer session.start for task creation.',
      workflowRole: 'task.start',
      command: expect.objectContaining({ script: 'task:start' }),
    }));
    expect(coreStartEntry).toEqual(expect.objectContaining({
      name: 'task.start',
      core: true,
      definition: expect.objectContaining({
        name: 'task.start',
        methodPath: ['task', 'start'],
        description: 'Compatibility alias for session.start({ kind: "task" }). Existing callers remain supported; new agents should prefer session.start for task creation.',
      }),
    }));
    const commandArguments = (startEntry?.command as { arguments?: Array<{ source?: string; flag?: string }> })?.arguments ?? [];
    expect(commandArguments).toContainEqual(expect.objectContaining({ source: 'workflow', flag: '--workflow' }));
  });

  test('should accept workflow selection through the combined task.start input', () => {
    const parsed = getInputSchema('TaskStartInput').parse({
      area: 'os',
      title: 'combined task start',
      workflow: 'media',
    });

    expect(parsed.workflow).toBe('media');
  });

  test('should expose only the canonical artifacts workflow without legacy aliases', () => {
    const runtime = createWorkflowIntentRuntime({ manifest: readManifest(), bundles: readBundles() });

    const artifacts = runtime.start({ workflow: 'artifacts', taskSession: 'tsk_artifacts' });

    expect(artifacts.workflow).toBe('artifacts');
    expect(artifacts.requestedWorkflow).toBe('artifacts');
    expect(artifacts.manifestBundle.aliases).toEqual([]);
    expect(artifacts.manifestBundle.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['artifacts.publish', 'artifacts.generateWebsite']),
    );
    for (const legacy of ['office', 'design', 'sites']) {
      expect(() => runtime.start({ workflow: legacy, taskSession: `tsk_${legacy}` })).toThrow(`unknown workflow: ${legacy}`);
    }
  });

  test('should reject workflow bundles disabled by the manifest overlay', () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-disabled-workflow-'));
    const overlayPath = join(home, 'security', 'overrides', 'manifest.overlay.json');
    mkdirSync(join(home, 'security', 'overrides'), { recursive: true });
    writeFileSync(overlayPath, JSON.stringify({
      version: 1,
      disabledSkills: [],
      disabledTools: [],
      disabledWorkflows: ['task'],
      updatedAt: '2026-07-16T00:00:00.000Z',
    }), 'utf8');
    const runtime = createWorkflowIntentRuntime({
      manifest: readManifest(),
      bundles: readBundles(),
      overlayHome: home,
    });

    expect(() => runtime.start({ workflow: 'task', taskSession: 'tsk_disabled' }))
      .toThrow('workflow disabled: task');
    expect(() => runtime.bundleFor('task')).toThrow('workflow disabled: task');
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
    expect(a.hookResult?.requiredNextAction.tool).toBe('fs.write');
    expect(a.hookResult?.requiredNextAction.taskSession).toBe('tsk_a');
    expect(a.hookResult?.requiredNextAction.input.path).toContain('agent-a/workpad.md');
    expect(b.hookResult?.requiredNextAction.tool).toBe('fs.write');
    expect(b.hookResult?.requiredNextAction.taskSession).toBe('tsk_b');
    expect(b.hookResult?.requiredNextAction.input.path).toContain('agent-b/workpad.md');
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
