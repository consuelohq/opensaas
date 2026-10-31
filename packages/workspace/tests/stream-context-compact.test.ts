import { describe, expect, test } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { compactStreamContext } = require('../scripts/lib/stream-context-compact.js');

function fixture() {
  const prs = Array.from({ length: 67 }, (_, i) => ({
    number: 2750 - i,
    title: i === 0 ? 'Fix standalone cloud work sessions and bundled skill entrypoints' : 'Task ' + i + ': descriptive PR title',
    url: 'https://github.com/consuelohq/opensaas/pull/' + (2750 - i),
    branch: 'task/os/slug-' + i,
    author: i === 2 ? 'teammate' : 'kokayicobb',
  }));
  return {
    area: 'os',
    stream: 'stream/os',
    instructions: { exists: false, path: '/home/missing/AGENTS.md', content: '' },
    decisions: [],
    aheadBehind: { ahead: 0, behind: 123 },
    openTaskPullRequests: { skipped: false, reason: null, pullRequests: prs },
    recentCommits: Array.from({ length: 25 }, (_, i) => 'a1b2c3' + i + ' 2026-10-31 03:02:15 -0400 fix(os): commit ' + i),
    recentWorkpads: {
      skipped: false, reason: null,
      workpads: Array.from({ length: 3 }, (_, i) => ({
        title: 'workpad: task/os/example-' + i, date: '2026-10-31',
        category: 'workpad', content: 'long workpad\n'.repeat(900),
      })),
    },
    worktrees: Array.from({ length: 14 }, (_, i) => ({
      branch: 'task/os/example-' + i, path: '/Users/test/.consuelo/node/tasks/worktrees/task-os-example-' + i,
    })),
  };
}

describe('compact stream.context result', () => {
  test('provides PR number/title once, omitting repetitive URL and branch, and attributes exceptional authors', () => {
    const compact = compactStreamContext(fixture());
    const prs = compact.openTaskPullRequests;
    expect(prs.total).toBe(67);
    expect(prs.omitted).toBe(55);
    expect(prs.usualAuthor).toBe('kokayicobb');
    expect(prs.pullRequests).toHaveLength(12);
    expect(prs.pullRequests[0]).toEqual({ number: 2750, title: 'Fix standalone cloud work sessions and bundled skill entrypoints' });
    expect(prs.pullRequests[1]).toEqual({ number: 2749, title: 'Task 1: descriptive PR title' });
    expect(prs.pullRequests[2]).toEqual({ number: 2748, title: 'Task 2: descriptive PR title', author: 'teammate' });
    expect(prs.pullRequests.every((pr) => !('url' in pr) && !('branch' in pr))).toBe(true);
  });

  test('preserves meaningful stream metadata and hides vacant instructions and decisions', () => {
    const result = compactStreamContext(fixture());
    expect(result.stream).toBe('stream/os');
    expect(result.area).toBe('os');
    expect(result.aheadBehind).toEqual({ ahead: 0, behind: 123 });
    expect(result).not.toHaveProperty('instructions');
    expect(result).not.toHaveProperty('decisions');
    expect(result.worktrees.total).toBe(14);
    expect(result.recentWorkpads.workpads).toHaveLength(3);
    expect(result.recentWorkpads.workpads[0]).toEqual({ title: 'workpad: task/os/example-0', date: '2026-10-31' });
    expect(result.recentWorkpads.workpads[0]).not.toHaveProperty('content');
    expect(result.recentCommitCount).toBe(25);
    expect(result.recentCommits).toHaveLength(8);
    expect(result.recentCommits[0]).toBe('a1b2c30 fix(os): commit 0');
    expect(result.detailHint).toContain('full: true');
  });

  test('retains actual stream instructions, decisions, and unavailability information when present', () => {
    const input = fixture();
    input.instructions = { exists: true, path: 'areas/os/AGENTS.md', content: 'Important safety constraint.' };
    input.decisions = [{ title: 'Never merge main without approval', date: '2026-10-31' }];
    input.openTaskPullRequests = { skipped: true, reason: 'missing github token', pullRequests: [] };
    input.recentWorkpads = { skipped: true, reason: 'missing supabase credentials', workpads: [] };
    const result = compactStreamContext(input);
    expect(result.instructions).toEqual(input.instructions);
    expect(result.decisions).toEqual(input.decisions);
    expect(result.openTaskPullRequests).toMatchObject({ total: 0, skipped: true, reason: 'missing github token', pullRequests: [] });
    expect(result.recentWorkpads).toMatchObject({ skipped: true, reason: 'missing supabase credentials', workpads: [] });
  });

  test('never removes original data from full mode, including all 67 PR identities, all workpads and worktrees', () => {
    const original = fixture();
    const full = compactStreamContext(original, { full: true });
    expect(full).toEqual(original);
    expect(full.openTaskPullRequests.pullRequests[66]).toHaveProperty('branch', 'task/os/slug-66');
    expect(full.recentWorkpads.workpads[2].content.length).toBeGreaterThan(5000);
  });

  test('OS-owned stream.context and workspace context formatter stay equivalent for compact and full modes', () => {
    const { compactStreamContext: osCompact } = require('../../os/scripts/lib/streams/context-compact.js');
    const input = fixture();
    expect(osCompact(input)).toEqual(compactStreamContext(input));
    expect(osCompact(input, { full: true })).toEqual(input);
    const root = path.resolve(import.meta.dirname, '../../..');
    const osCli = fs.readFileSync(path.join(root, 'packages/os/scripts/lib/streams/cli.ts'), 'utf8');
    const osRuntime = fs.readFileSync(path.join(root, 'packages/os/scripts/lib/streams/context-runtime.ts'), 'utf8');
    const osTaskStart = fs.readFileSync(path.join(root, 'packages/os/scripts/task-start.js'), 'utf8');
    expect(osCli).toContain("new Set(['--json', '--help', '--full'])");
    expect(osRuntime).toContain('compactStreamContext(result, { full })');
    expect(osTaskStart).toContain('result?.openTaskPullRequests?.total');
  });

  test('shrinks a representative verbose stream context by at least 85% without losing full retrieval', () => {
    const raw = fixture();
    const before = Buffer.byteLength(JSON.stringify(raw));
    const after = Buffer.byteLength(JSON.stringify(compactStreamContext(raw)));
    expect(after).toBeLessThan(before * 0.15);
  });

  test('the CLI, typed tool, and task.start preflight expose and consume full and total correctly', () => {
    const root = path.resolve(import.meta.dirname, '../../..');
    const script = fs.readFileSync(path.join(root, 'packages/workspace/scripts/stream-context.js'), 'utf8');
    const start = fs.readFileSync(path.join(root, 'packages/workspace/scripts/task-start.js'), 'utf8');
    const handler = fs.readFileSync(path.join(root, 'packages/os/tools/stream/handler.ts'), 'utf8');
    const workspaceSchema = fs.readFileSync(path.join(root, 'packages/workspace/scripts/lib/facade/schemas.ts'), 'utf8');
    const osSchema = fs.readFileSync(path.join(root, 'packages/os/scripts/lib/facade/schemas.ts'), 'utf8');
    expect(script).toContain("case '--full':");
    expect(script).toContain('compactStreamContext(');
    expect(start).toContain('result?.openTaskPullRequests?.total');
    expect(handler).toContain('"source": "full"');
    expect(workspaceSchema).toContain('full: z.boolean().optional()');
    expect(osSchema).toContain('full: z.boolean().optional()');
  });
});


test('OS stream-context sources have a focused critical selector instead of falling back to full OS package tests', () => {
  const root = path.resolve(import.meta.dirname, '../../..');
  const rules = JSON.parse(fs.readFileSync(path.join(root, 'packages/workspace/test-selection.rules.json'), 'utf8'));
  const rule = rules.rules.find((candidate: { id: string }) => candidate.id === 'os-stream-context-compact');
  expect(rule).toBeDefined();
  expect(rule.critical).toBe(true);
  for (const source of [
    'packages/os/scripts/lib/streams/cli.ts',
    'packages/os/scripts/lib/streams/context-runtime.ts',
    'packages/os/scripts/lib/streams/context-compact.js',
    'packages/os/tools/stream/handler.ts',
  ]) {
    expect(rule.source).toContain(source);
  }
  expect(rule.tests.some((suite: { command: string[] }) => suite.command.includes('packages/workspace/tests/stream-context-compact.test.ts'))).toBe(true);
});
