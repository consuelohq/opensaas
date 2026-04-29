import { describe, expect, it } from 'vitest';

import { getCurrentTask, resolveTaskBranch } from '../../scripts/lib/facade/branch-resolver';
import { runBatch } from '../../scripts/lib/facade/batch';
import { executeTool, getToolManifestEntry, manifestEntries } from '../../scripts/lib/facade/executor';
import { getInputSchema } from '../../scripts/lib/facade/schemas';
import type { CommandPlan, ToolInput, ToolRunner } from '../../scripts/lib/facade/types';

const TEST_BRANCH = 'task/workspace-agents/test';
const TEST_UUID = 'abc123def4567890abc123def4567890';

function stableOptions(runner: ToolRunner, plans: CommandPlan[] = []) {
  return {
    cwd: '/tmp/not-a-repo',
    runner: async (plan: CommandPlan, timeoutMs: number) => {
      plans.push(plan);
      return runner(plan, timeoutMs);
    },
    branchResolver: ({ explicitBranch }: { explicitBranch?: string }) => ({
      ok: true as const,
      branch: explicitBranch || TEST_BRANCH,
      source: explicitBranch ? 'explicit' : 'test',
    }),
    now: () => 1000,
    randomUUID: () => TEST_UUID,
    currentTask: {
      branch: TEST_BRANCH,
      area: 'workspace-agents',
      prNumber: 225,
      worktree: '/tmp/worktree',
    },
    candidates: [
      {
        branch: TEST_BRANCH,
        area: 'workspace-agents',
        prNumber: 225,
        worktree: '/tmp/worktree',
      },
    ],
  };
}

function successfulRunner(): ToolRunner {
  return async () => ({
    stdout: JSON.stringify({ value: 'ok' }),
    stderr: '',
    exitCode: 0,
  });
}

function failingRunner(): ToolRunner {
  return async () => ({
    stdout: JSON.stringify({ value: 'failed' }),
    stderr: 'boom',
    exitCode: 2,
  });
}

function timeoutRunner(): ToolRunner {
  return async () => {
    throw { timedOut: true, message: 'timed out' };
  };
}

function passthroughRunner(): ToolRunner {
  return async () => ({
    stdout: JSON.stringify({
      ok: true,
      code: 'OK',
      message: 'passthrough',
      data: { value: 'ok' },
      stderr: '',
      exitCode: 0,
      durationMs: 4,
      traceId: 'trc_passthrough',
      apiVersion: '1.0.0',
    }),
    stderr: '',
    exitCode: 0,
  });
}

function exampleInput(entryName: string): ToolInput {
  const entry = manifestEntries.find((item) => item.name === entryName);
  if (!entry) throw new Error(`missing entry: ${entryName}`);
  const input = { ...entry.exampleInput };
  delete input.dryRun;
  return input;
}

function executableEntries() {
  return manifestEntries.filter((entry) => !entry.command.internal);
}

describe('typed facade executor', () => {
  it.each(executableEntries().map((entry) => entry.name))('returns a success envelope for %s', async (toolName) => {
    const result = await executeTool(toolName, exampleInput(toolName), stableOptions(successfulRunner()));
    expect(result).toMatchSnapshot();
  });

  it.each(executableEntries().map((entry) => entry.name))('returns a failure envelope for %s', async (toolName) => {
    const result = await executeTool(toolName, exampleInput(toolName), stableOptions(failingRunner()));
    expect(result).toMatchSnapshot();
  });

  it.each(executableEntries().map((entry) => entry.name))('returns a timeout envelope for %s', async (toolName) => {
    const result = await executeTool(toolName, exampleInput(toolName), stableOptions(timeoutRunner()));
    expect(result.code).toBe('TIMEOUT');
    expect(result.ok).toBe(false);
  });

  it.each(manifestEntries.map((entry) => entry.name))('validates input for %s', async (toolName) => {
    const entry = manifestEntries.find((item) => item.name === toolName);
    if (!entry) throw new Error(`missing entry: ${toolName}`);
    const schema = getInputSchema(entry.inputSchema);
    if (!schema || schema.safeParse({}).success) return;

    const result = await executeTool(toolName, {}, stableOptions(successfulRunner()));
    expect(result.code).toBe('VALIDATION_ERROR');
  });

  it.each(manifestEntries.filter((entry) => entry.capabilities.mutating && !entry.command.dryRunFlag).map((entry) => entry.name))('supports synthetic dry-run for %s', async (toolName) => {
    const plans: CommandPlan[] = [];
    const result = await executeTool(toolName, { ...exampleInput(toolName), dryRun: true }, stableOptions(successfulRunner(), plans));
    expect(result.code).toBe('DRY_RUN');
    expect(plans).toHaveLength(0);
  });

  it.each(manifestEntries.filter((entry) => entry.capabilities.mutating && entry.command.dryRunFlag).map((entry) => entry.name))('passes native dry-run through for %s', async (toolName) => {
    const plans: CommandPlan[] = [];
    const result = await executeTool(toolName, { ...exampleInput(toolName), dryRun: true }, stableOptions(successfulRunner(), plans));
    const entry = getToolManifestEntry(toolName);
    expect(result.code).toBe('OK');
    expect(plans[0].args).toContain(entry?.command.dryRunFlag);
  });

  it('passes request ids through the envelope', async () => {
    const result = await executeTool('fs.read', {
      ...exampleInput('fs.read'),
      requestId: 'req_123',
    }, stableOptions(successfulRunner()));
    expect(result.requestId).toBe('req_123');
  });

  it('passes request ids through nested tool envelopes', async () => {
    const result = await executeTool('mac.exec', {
      ...exampleInput('mac.exec'),
      requestId: 'req_passthrough',
    }, stableOptions(passthroughRunner()));
    expect(result.requestId).toBe('req_passthrough');
  });

  it('resolves unique script aliases from the manifest', () => {
    expect(getToolManifestEntry('decide-next')?.name).toBe('decideNext');
    expect(getToolManifestEntry('confidence-score')?.name).toBe('confidenceScore');
    expect(getToolManifestEntry('task:fs')).toBeNull();
  });
});

describe('branch resolver', () => {
  it('resolves pinned branch before current metadata', () => {
    const result = resolveTaskBranch({
      pinnedBranch: 'task/workspace-agents/pinned',
      currentTask: {
        branch: TEST_BRANCH,
        area: 'workspace-agents',
        worktree: '/tmp/worktree',
      },
    });
    expect(result).toEqual({
      ok: true,
      branch: 'task/workspace-agents/pinned',
      source: 'pinned',
    });
  });

  it('resolves current metadata when present', () => {
    const result = resolveTaskBranch({
      currentTask: {
        branch: TEST_BRANCH,
        area: 'workspace-agents',
        worktree: '/tmp/worktree',
      },
    });
    expect(result).toEqual({
      ok: true,
      branch: TEST_BRANCH,
      source: 'current.json',
      candidates: [
        {
          branch: TEST_BRANCH,
          area: 'workspace-agents',
          worktree: '/tmp/worktree',
        },
      ],
    });
  });

  it('returns ambiguity with candidates', () => {
    const result = resolveTaskBranch({
      currentTask: null,
      candidates: [
        { branch: TEST_BRANCH, area: 'workspace-agents', worktree: '/tmp/a' },
        { branch: 'task/workspace-agents/other', area: 'workspace-agents', worktree: '/tmp/b' },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('AMBIGUOUS_TASK_SELECTION');
      expect(result.candidates).toHaveLength(2);
    }
  });

  it('returns not found when no candidates exist', () => {
    const result = resolveTaskBranch({ currentTask: null, candidates: [] });
    expect(result).toEqual({
      ok: false,
      code: 'WORKTREE_NOT_FOUND',
      message: 'no active task worktree found; run task:start first or pass branch',
      candidates: [],
    });
  });

  it('returns the environment-selected current task before stale metadata', () => {
    const result = getCurrentTask({
      env: { TASK_BRANCH: 'task/workspace-agents/env' },
      currentTask: {
        branch: TEST_BRANCH,
        area: 'workspace-agents',
        worktree: '/tmp/stale',
      },
      candidates: [
        { branch: TEST_BRANCH, area: 'workspace-agents', worktree: '/tmp/stale' },
        { branch: 'task/workspace-agents/env', area: 'workspace-agents', worktree: '/tmp/env' },
      ],
    });
    expect(result).toEqual({
      branch: 'task/workspace-agents/env',
      area: 'workspace-agents',
      worktree: '/tmp/env',
    });
  });
});

describe('batch executor', () => {
  it('runs successful chains', async () => {
    const result = await runBatch([
      { tool: 'fs.read', input: exampleInput('fs.read') },
      { tool: 'fs.search', input: exampleInput('fs.search') },
    ], stableOptions(successfulRunner()));
    expect(result.ok).toBe(true);
    expect(result.data.completed).toBe(2);
  });

  it('stops after a failed step', async () => {
    const result = await runBatch([
      { tool: 'fs.read', args: exampleInput('fs.read') },
      { tool: 'fs.search', args: exampleInput('fs.search') },
    ], stableOptions(failingRunner()));
    expect(result.ok).toBe(false);
    expect(result.data.completed).toBe(1);
  });

  it('runs parallel read-only steps together', async () => {
    const plans: CommandPlan[] = [];
    const result = await runBatch([
      { tool: 'fs.read', input: exampleInput('fs.read'), parallel: true },
      { tool: 'fs.search', input: exampleInput('fs.search'), parallel: true },
    ], stableOptions(successfulRunner(), plans));
    expect(result.ok).toBe(true);
    expect(plans).toHaveLength(2);
  });
});

describe('composed and mac wrappers', () => {
  it('builds checkFiles command arguments', async () => {
    const plans: CommandPlan[] = [];
    const result = await executeTool('checkFiles', exampleInput('checkFiles'), stableOptions(successfulRunner(), plans));
    expect(result.ok).toBe(true);
    expect(plans[0].args).toContain('check-files');
    expect(plans[0].args).toContain('--stop-on-first-error');
  });

  it('passes editFlow dry-run to the native script', async () => {
    const plans: CommandPlan[] = [];
    const result = await executeTool('editFlow', { ...exampleInput('editFlow'), dryRun: true }, stableOptions(successfulRunner(), plans));
    expect(result.code).toBe('OK');
    expect(plans[0].args).toContain('--dry-run');
  });

  it('builds mac operation commands', async () => {
    const plans: CommandPlan[] = [];
    const result = await executeTool('mac.exec', exampleInput('mac.exec'), stableOptions(successfulRunner(), plans));
    expect(result.ok).toBe(true);
    expect(plans[0].args).toContain('mac');
    expect(plans[0].args).toContain('exec');
  });
});
