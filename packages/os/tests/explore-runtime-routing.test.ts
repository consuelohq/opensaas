import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { executeTool, getToolManifestEntry } from '../scripts/lib/facade/executor';
import type { CommandPlan, ToolRunner } from '../scripts/lib/facade/types';

function runner(plans: CommandPlan[]): ToolRunner {
  return async (plan) => {
    plans.push(plan);
    return {
      stdout: JSON.stringify({ ok: true, results: [] }),
      stderr: '',
      exitCode: 0,
    };
  };
}

describe('installed Explore facade routing', () => {
  it('marks Explore runtime-owned and executes it from the installed OS package root', async () => {
    const entry = getToolManifestEntry('explore');
    expect(entry).not.toBeNull();
    expect(entry?.command.executionScope).toBe('runtime');

    const plans: CommandPlan[] = [];
    const result = await executeTool('explore', {
      query: 'where is Explore retrieval implemented',
      budget: 5,
    }, {
      cwd: '/tmp/unrelated-caller-repository',
      runner: runner(plans),
      now: () => 1000,
      randomUUID: () => 'abc123def4567890abc123def4567890',
    });

    expect(result.ok).toBe(true);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.command).toBe('bun');
    expect(plans[0]?.args.slice(0, 2)).toEqual(['run', 'explore']);
    expect(plans[0]?.cwd.split(path.sep).slice(-2).join('/')).toBe('packages/os');
  });
});
