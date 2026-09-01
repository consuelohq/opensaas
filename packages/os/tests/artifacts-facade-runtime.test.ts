import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { executeTool, getToolManifestEntry } from '../scripts/lib/facade/executor';
import type { CommandPlan, ToolRunner } from '../scripts/lib/facade/types';

function runner(plans: CommandPlan[]): ToolRunner {
  return async (plan) => {
    plans.push(plan);
    return { stdout: JSON.stringify({ ok: true }), stderr: '', exitCode: 0 };
  };
}

describe('Artifacts facade runtime ownership', () => {
  for (const toolName of ['artifacts.check', 'artifacts.refresh']) {
    it(`${toolName} executes from the packaged OS runtime`, async () => {
      const entry = getToolManifestEntry(toolName);
      expect(entry?.command.executionScope).toBe('runtime');

      const plans: CommandPlan[] = [];
      const result = await executeTool(toolName, {}, {
        cwd: '/tmp/not-a-repo',
        runner: runner(plans),
        now: () => 1000,
        randomUUID: () => 'abc123def4567890abc123def4567890',
      });

      expect(result.ok).toBe(true);
      expect(plans).toHaveLength(1);
      expect(plans[0].cwd.split(path.sep).slice(-2).join('/')).toBe('packages/os');
    });
  }

  it('keeps all Artifacts package commands runtime-owned', () => {
    const representativeCommands = [
      'artifacts.publish',
      'artifacts.generateWebsite',
      'artifacts.uiStatus',
      'artifacts.upstreamStatus',
    ];
    for (const toolName of representativeCommands) {
      expect(getToolManifestEntry(toolName)?.command.executionScope).toBe('runtime');
    }
  });
});
