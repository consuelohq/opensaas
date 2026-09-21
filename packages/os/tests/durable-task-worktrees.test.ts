import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

import paths from '../scripts/lib/paths.js';
import taskRegistry from '../scripts/lib/task-registry.js';
import taskSession from '../scripts/lib/task-session.js';

const trackedEnvKeys = [
  'CONSUELO_HOME',
  'CONSUELO_OS_HOME',
  'WORKSPACE_WORKTREE_ROOT',
  'OPENSAAS_WORKTREE_ROOT',
] as const;
const originalEnv = Object.fromEntries(trackedEnvKeys.map((key) => [key, process.env[key]]));

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of trackedEnvKeys) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('task worktrees default to durable Consuelo node storage without changing generic temp worktrees', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'durable-task-home-'));
  try {
    process.env.CONSUELO_HOME = home;
    expect(paths.getTaskWorktreeRoot()).toBe(path.join(home, 'node', 'tasks', 'worktrees'));
    expect(paths.getWorktreeRoot()).toBe(path.join(os.tmpdir(), 'opensaas-worktrees'));

    process.env.OPENSAAS_WORKTREE_ROOT = '/tmp/legacy-task-root';
    expect(paths.getTaskWorktreeRoot()).toBe('/tmp/legacy-task-root');
    process.env.WORKSPACE_WORKTREE_ROOT = '/tmp/explicit-task-root';
    expect(paths.getTaskWorktreeRoot()).toBe('/tmp/explicit-task-root');
    expect(paths.getTaskWorktreeRoot('/tmp/cli-task-root')).toBe('/tmp/cli-task-root');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('durable registry round-trips taskSession metadata outside the worktree', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'durable-task-registry-'));
  try {
    process.env.CONSUELO_HOME = home;
    const meta = {
      area: 'workspace-agent',
      stream: 'stream/workspace-agent',
      taskBranch: 'task/workspace-agent/example',
      taskSession: taskSession.getTaskSessionHandle('task/workspace-agent/example'),
      tmuxSession: 'task-example',
      worktreePath: '/tmp/example-worktree',
    };
    taskRegistry.writeDurableTaskSessionMetadata(meta);
    expect(taskRegistry.readDurableTaskSessionMetadata(meta.taskSession)).toMatchObject(meta);
    expect(taskRegistry.getDurableTaskSessionPath(meta.taskSession)).toContain(path.join('node', 'tasks', 'registry'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
