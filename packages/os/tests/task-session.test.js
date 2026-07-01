import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

import taskSession from '../scripts/lib/task-session.js';

const {
  assertTmuxAvailable,
  getTaskSessionHandle,
  getTmuxSessionName,
  resolveTaskTmuxSession,
  terminateTaskTmuxSession,
} = taskSession;

afterEach(() => {
  vi.restoreAllMocks();
});

function withSpawnSync(mock, callback) {
  vi.spyOn(childProcess, 'spawnSync').mockImplementation(mock);
  return callback();
}

test('assertTmuxAvailable delegates to the tmux availability check', () => {
  withSpawnSync(() => ({ status: 0 }), () => {
    expect(() => assertTmuxAvailable()).not.toThrow();
  });
});

test('resolveTaskTmuxSession prefers explicit tmux metadata', () => {
  const result = resolveTaskTmuxSession([
    {
      taskBranch: 'task/workspace-agents/example',
      taskSession: getTaskSessionHandle('task/workspace-agents/example'),
      tmuxSession: 'explicit-session',
      worktreePath: '/tmp/example',
    },
  ], {
    branch: 'task/workspace-agents/example',
    worktreePath: '/tmp/example',
  });

  expect(result.tmuxSession).toBe('explicit-session');
  expect(result.source).toBe('tmuxSession');
});

test('resolveTaskTmuxSession derives a bounded session from compatible task metadata', () => {
  const taskBranch = 'task/workspace-agents/example';
  const result = resolveTaskTmuxSession([
    {
      area: 'workspace-agents',
      taskBranch,
      taskSession: getTaskSessionHandle(taskBranch),
      worktreePath: '/tmp/example',
    },
  ], {
    branch: taskBranch,
    worktreePath: '/tmp/example',
  });

  expect(result.tmuxSession).toBe(getTmuxSessionName('workspace-agents', taskBranch));
  expect(result.source).toBe('derived-task-branch');
});

test('resolveTaskTmuxSession accepts realpath-equivalent worktree metadata', () => {
  const taskBranch = 'task/workspace-agents/example';
  const realWorktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'task-session-real-'));
  const linkedWorktreePath = `${realWorktreePath}-link`;

  try {
    fs.symlinkSync(realWorktreePath, linkedWorktreePath, 'dir');
    const result = resolveTaskTmuxSession([
      {
        taskBranch,
        tmuxSession: 'explicit-session',
        worktreePath: linkedWorktreePath,
      },
    ], {
      branch: taskBranch,
      worktreePath: realWorktreePath,
    });

    expect(result.tmuxSession).toBe('explicit-session');
  } finally {
    try {
      fs.unlinkSync(linkedWorktreePath);
    } catch {}
    fs.rmSync(realWorktreePath, { force: true, recursive: true });
  }
});

test('resolveTaskTmuxSession ignores metadata for a different task branch', () => {
  const result = resolveTaskTmuxSession([
    {
      taskBranch: 'task/workspace-agents/other',
      tmuxSession: 'other-session',
    },
  ], {
    branch: 'task/workspace-agents/example',
  });

  expect(result).toBeNull();
});

test('terminateTaskTmuxSession reports dry run without invoking tmux', () => {
  const calls = [];
  const result = withSpawnSync((command, args) => {
    calls.push({ command, args });
    return { status: 0 };
  }, () => terminateTaskTmuxSession({ tmuxSession: 'explicit-session' }, { dryRun: true }));

  expect(result.status).toBe('would-terminate');
  expect(result.tmuxSession).toBe('explicit-session');
  expect(result.terminated).toBe(false);
  expect(calls).toEqual([]);
});

test('terminateTaskTmuxSession warns and continues when tmux is unavailable', () => {
  const warnings = [];
  const result = withSpawnSync((command, args) => {
    expect(command).toBe('tmux');
    expect(args).toEqual(['-V']);
    return { status: 1 };
  }, () => terminateTaskTmuxSession(
    { tmuxSession: 'explicit-session' },
    { warn: (message) => warnings.push(message) },
  ));

  expect(result.status).toBe('tmux-unavailable');
  expect(result.terminated).toBe(false);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toMatch(/tmux unavailable/);
});

test('terminateTaskTmuxSession continues when no tmux session exists', () => {
  const calls = [];
  const result = withSpawnSync((command, args) => {
    calls.push(args);
    if (args[0] === '-V') return { status: 0 };
    if (args[0] === 'has-session') return { status: 1 };
    throw new Error(`unexpected tmux call ${args.join(' ')}`);
  }, () => terminateTaskTmuxSession({ tmuxSession: 'explicit-session' }));

  expect(result.status).toBe('not-found');
  expect(result.terminated).toBe(false);
  expect(calls).toEqual([
    ['-V'],
    ['has-session', '-t', 'explicit-session'],
  ]);
});



test('terminateTaskTmuxSession warns when tmux has-session returns an unexpected failure', () => {
  const warnings = [];
  const calls = [];
  const result = withSpawnSync((command, args) => {
    calls.push(args);
    if (args[0] === '-V') return { status: 0 };
    if (args[0] === 'has-session') return { status: 2, stderr: 'server unavailable' };
    throw new Error(`unexpected tmux call ${args.join(' ')}`);
  }, () => terminateTaskTmuxSession(
    { tmuxSession: 'explicit-session' },
    { warn: (message) => warnings.push(message) },
  ));

  expect(result.status).toBe('inspect-failed');
  expect(result.terminated).toBe(false);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain('exit 2: server unavailable');
  expect(calls).toEqual([
    ['-V'],
    ['has-session', '-t', 'explicit-session'],
  ]);
});

test('terminateTaskTmuxSession closes an explicit existing tmux session', () => {
  const calls = [];
  const result = withSpawnSync((command, args) => {
    calls.push(args);
    if (args[0] === '-V') return { status: 0 };
    if (args[0] === 'has-session') return { status: 0 };
    if (args[0] === 'kill-session') return { status: 0 };
    throw new Error(`unexpected tmux call ${args.join(' ')}`);
  }, () => terminateTaskTmuxSession({ tmuxSession: 'explicit-session' }));

  expect(result.status).toBe('terminated');
  expect(result.terminated).toBe(true);
  expect(calls).toEqual([
    ['-V'],
    ['has-session', '-t', 'explicit-session'],
    ['kill-session', '-t', 'explicit-session'],
  ]);
});
