import { describe, expect, it } from 'vitest';

import { executeTool } from '../../scripts/lib/facade/executor';
import type { CommandPlan, ToolRunner } from '../../scripts/lib/facade/types';

const TEST_UUID = 'abc123def4567890abc123def4567890';

function stableOptions(runner: ToolRunner) {
  return {
    cwd: '/tmp/not-a-repo',
    runner,
    branchResolver: ({ explicitBranch }: { explicitBranch?: string }) => ({
      ok: true as const,
      branch: explicitBranch || 'task/workspace-agents/test',
      source: explicitBranch ? 'explicit' : 'test',
    }),
    now: () => 1000,
    randomUUID: () => TEST_UUID,
    currentTask: null,
    candidates: [],
  };
}

function successfulRunner(): ToolRunner {
  return async (_plan: CommandPlan) => ({
    stdout: JSON.stringify({ value: 'ok' }),
    stderr: '',
    exitCode: 0,
  });
}

describe('workspace tool not found recovery', () => {
  it('returns compact help recovery for guessed discovery tools', async () => {
    const result = await executeTool('tools.list', {}, stableOptions(successfulRunner()));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
    expect(result.message).toContain('workspace --help');
    expect(result.data).toMatchObject({
      attemptedTool: 'tools.list',
      helpCommands: expect.arrayContaining(['workspace --help']),
    });
  });

  it('suggests family help for typo in known tool family', async () => {
    const result = await executeTool('browser.evl', {}, stableOptions(successfulRunner()));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
    expect(result.message).toContain('workspace browser --help');
    expect(result.data).toMatchObject({
      attemptedTool: 'browser.evl',
      helpCommands: expect.arrayContaining(['workspace browser --help']),
    });
  });

  it('keeps valid tools on the normal dispatch path', async () => {
    const result = await executeTool('status', {}, stableOptions(successfulRunner()));

    expect(result.ok).toBe(true);
    expect(result.code).toBe('OK');
  });
});
