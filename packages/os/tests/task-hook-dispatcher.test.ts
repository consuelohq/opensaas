import { describe, expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  createOsHookDispatcher,
  dispatchHookEvent,
  renderHookResult,
} from '../hooks/dispatcher.js';

const actualManifestPath = resolve(import.meta.dirname, '../tooling/dev-tool-manifest.json');
const taskHookScript = resolve(import.meta.dirname, '../scripts/task-hook.js');
const taskStartScript = resolve(import.meta.dirname, '../scripts/task-start.js');

describe('OS hook dispatcher', () => {
  test('dispatches task workflow events using the current manifest without hard-coded action output', () => {
    const result = dispatchHookEvent({
      manifestPath: actualManifestPath,
      event: {
        event: 'tool.postInvoke',
        tool: 'task.start',
        workflow: 'task',
        result: {
          taskSession: 'tsk_dispatch',
          area: 'os',
          branch: 'task/os/dispatcher-example',
          worktreePath: '/tmp/dispatcher-example',
        },
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        workflow: 'task',
        stage: 'workpad-bootstrap',
        requiredNextAction: expect.objectContaining({
          capability: 'workpad.write',
          tool: 'fs.write',
          inputSchema: 'FsWriteInput',
          source: 'manifest',
          taskSessionPlacement: 'top-level',
          taskSession: 'tsk_dispatch',
        }),
      }),
    );
    expect(result.requiredNextAction.input.path).toBe('.task/os/dispatcher-example/workpad.md');
    expect(JSON.stringify(result)).not.toContain('fs.put');
  });

  test('returns null for unrelated events before scripts inject task guidance', () => {
    const dispatcher = createOsHookDispatcher({ manifestPath: actualManifestPath });

    expect(
      dispatcher.dispatch({
        event: 'chat.message',
        workflow: 'general',
        state: { text: 'summarize this' },
      }),
    ).toBeNull();
  });

  test('renders dispatcher guidance as concise agent-readable hook output', () => {
    const rendered = renderHookResult({
      workflow: 'task',
      stage: 'stream-context',
      requiredNextAction: {
        capability: 'stream.context',
        tool: 'stream.context',
        inputSchema: 'StreamInput',
        source: 'manifest',
        input: { area: 'os' },
      },
      notes: ['This hook is event scoped.'],
    });

    expect(rendered).toContain('# Hook result: task / stream-context');
    expect(rendered).toContain('tool: stream.context');
    expect(rendered).toContain('inputSchema: StreamInput');
    expect(rendered).toContain('event scoped');
  });

  test('task-start script emits post-start guidance through the dispatcher', () => {
    const source = readFileSync(taskStartScript, 'utf8');

    expect(source).toContain("require('../hooks/dispatcher.js')");
    expect(source).toContain('dispatchHookEvent({');
    expect(source).toContain("event: 'tool.postInvoke'");
    expect(source).toContain("tool: 'task.start'");
    expect(source).toContain("workflow: 'task'");
    expect(source).toContain('task hook guidance failed');
    expect(source).toContain('renderHookResult(guidance)');
    expect(source).not.toContain("getTaskHookGuidance('after-task-start'");
  });

  test('task-hook CLI dispatches event JSON while preserving legacy stage mode', () => {
    const dir = mkdtempSync(join(tmpdir(), 'os-hook-event-'));
    const eventPath = join(dir, 'event.json');
    writeFileSync(
      eventPath,
      JSON.stringify({
        event: 'tool.preInvoke',
        tool: 'task.start',
        workflow: 'task',
        state: { area: 'os', hasStreamContext: false },
      }),
      'utf8',
    );

    const eventResult = spawnSync(process.execPath, [taskHookScript, '--event-json', eventPath, '--json'], {
      cwd: resolve(import.meta.dirname, '..'),
      encoding: 'utf8',
      timeout: 10_000,
    });

    expect(eventResult.status).toBe(0);
    const parsed = JSON.parse(eventResult.stdout);
    expect(parsed.stage).toBe('stream-context');
    expect(parsed.requiredNextAction).toEqual(
      expect.objectContaining({
        capability: 'stream.context',
        tool: 'stream.context',
        source: 'manifest',
      }),
    );

    const legacyResult = spawnSync(process.execPath, [taskHookScript, 'unknown-task-tool', '--requested-tool', 'task.finish', '--json'], {
      cwd: resolve(import.meta.dirname, '..'),
      encoding: 'utf8',
      timeout: 10_000,
    });

    expect(legacyResult.status).toBe(0);
    expect(JSON.parse(legacyResult.stdout).stage).toBe('unknown-task-tool');
  });
});
