import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

function writeTaskSession(tempRoot: string, taskSession: string, branch: string = TEST_BRANCH): void {
  mkdirSync(join(tempRoot, '.task'), { recursive: true });
  writeFileSync(join(tempRoot, '.task', 'session.json'), JSON.stringify({
    taskSession,
    tmuxSession: 'opensaas-test',
    branch,
    worktree: tempRoot,
  }, null, 2));
}

function executableEntries() {
  return manifestEntries.filter((entry) => !entry.command.internal && entry.sessionRequired !== true);
}

describe('typed facade executor', () => {
  it('provides fs.patch facade guidance with the fs.apply_patch manifest entry', async () => {
    const result = await executeTool('fs.patch', { path: 'tmp/example.txt' }, stableOptions(successfulRunner()));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
    expect(result.message).toContain('fs.patch is not an OS tool');
    expect(result.message).toContain('fs.apply_patch');

    const data = result.data as {
      requestedTool?: string;
      replacementTool?: string;
      manifestEntry?: {
        name?: string;
        inputSchema?: string;
        command?: { subcommand?: string };
      };
    };

    expect(data.requestedTool).toBe('fs.patch');
    expect(data.replacementTool).toBe('fs.apply_patch');
    expect(data.manifestEntry?.name).toBe('fs.apply_patch');
    expect(data.manifestEntry?.inputSchema).toBe('FsApplyPatchInput');
    expect(data.manifestEntry?.command?.subcommand).toBe('apply-patch');
  });

  it('keeps generic unknown tool messages compact', async () => {
    const result = await executeTool('missing.tool', {}, stableOptions(successfulRunner()));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
    expect(result.message).toBe('unknown tool: missing.tool');
    expect(result.data).toBeNull();
  });

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

  it.each(manifestEntries.filter((entry) => entry.name !== 'worker.call' && entry.capabilities.mutating && !entry.command.dryRunFlag && entry.sessionRequired !== true).map((entry) => entry.name))('supports synthetic dry-run for %s', async (toolName) => {
    const plans: CommandPlan[] = [];
    const result = await executeTool(toolName, { ...exampleInput(toolName), dryRun: true }, stableOptions(successfulRunner(), plans));
    expect(result.code).toBe('DRY_RUN');
    expect(plans).toHaveLength(0);
  });

  it.each(manifestEntries.filter((entry) => entry.capabilities.mutating && entry.command.dryRunFlag && entry.sessionRequired !== true).map((entry) => entry.name))('passes native dry-run through for %s', async (toolName) => {
    const plans: CommandPlan[] = [];
    const result = await executeTool(toolName, { ...exampleInput(toolName), dryRun: true }, stableOptions(successfulRunner(), plans));
    const entry = getToolManifestEntry(toolName);
    expect(result.code).toBe('OK');
    expect(plans[0].args).toContain(entry?.command.dryRunFlag);
  });

  it('should route fs.apply_patch when task session metadata is present', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'consuelo-os-apply-patch-'));
    const taskSession = 'tsk_apply_patch_test';
    const plans: CommandPlan[] = [];

    try {
      writeTaskSession(tempRoot, taskSession);
      const result = await executeTool('fs.apply_patch', {
        taskSession,
        patchText: '*** Begin Patch\n*** End Patch',
        dryRun: true,
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: tempRoot,
      });

      expect(result.ok).toBe(true);
      expect(result.code).toBe('OK');
      expect(plans).toHaveLength(1);
      expect(plans[0].args).toContain('apply-patch');
      expect(plans[0].args).toContain('--patch-text');
      expect(plans[0].args).toContain('--dry-run');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });


  it('passes request ids through the envelope', async () => {
    const result = await executeTool('fs.read', {
      ...exampleInput('fs.read'),
      requestId: 'req_123',
    }, stableOptions(successfulRunner()));
    expect(result.requestId).toBe('req_123');
    expect(result.now).toBe('1970-01-01T00:00:01.000Z');
  });

  it('plans fs.read with offset and limit page semantics', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-read-page-'));
    try {
      writeTaskSession(tempRoot, 'tsk_read_page');
      const plans: CommandPlan[] = [];
      const result = await executeTool('fs.read', {
        taskSession: 'tsk_read_page',
        path: 'packages/os/scripts/fs.js',
        offset: 5,
        limit: 20,
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      expect(plans[0].args).toContain('--offset');
      expect(plans[0].args).toContain('5');
      expect(plans[0].args).toContain('--limit');
      expect(plans[0].args).toContain('20');
      expect(plans[0].args).toContain('--json');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('plans fs.read multi-file input through files-json', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-read-multi-'));
    try {
      writeTaskSession(tempRoot, 'tsk_read_multi');
      const plans: CommandPlan[] = [];
      const result = await executeTool('fs.read', {
        taskSession: 'tsk_read_multi',
        files: [
          { path: 'src/a.ts', offset: 1, limit: 80 },
          { path: 'src/b.ts', offset: 100, limit: 60 },
        ],
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      const filesJsonIndex = plans[0].args.indexOf('--files-json');
      expect(filesJsonIndex).toBeGreaterThan(-1);
      expect(JSON.parse(plans[0].args[filesJsonIndex + 1])).toEqual([
        { path: 'src/a.ts', offset: 1, limit: 80 },
        { path: 'src/b.ts', offset: 100, limit: 60 },
      ]);
      expect(plans[0].args).toContain('--json');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects mixed fs read pagination modes', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-read-mixed-page-'));
    try {
      writeTaskSession(tempRoot, 'tsk_read_mixed_page');
      const plans: CommandPlan[] = [];
      for (const topLevelPage of [{ offset: 10 }, { limit: 5 }, { from: 2 }, { to: 4 }]) {
        const result = await executeTool('fs.read', {
          taskSession: 'tsk_read_mixed_page',
          files: [{ path: 'src/a.ts', offset: 1, limit: 2 }],
          ...topLevelPage,
        }, {
          ...stableOptions(successfulRunner(), plans),
          cwd: tempRoot,
          currentTask: null,
          candidates: [],
        });

        expect(result.ok).toBe(false);
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.message).toContain('top-level pagination fields cannot be used with files');
      }
      expect(plans).toHaveLength(0);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('requires taskSession before repo fs fallback for sessionRequired tools', async () => {
    const plans: CommandPlan[] = [];
    const result = await executeTool('fs.read', {
      path: 'AGENTS.md',
    }, {
      ...stableOptions(successfulRunner(), plans),
      branchResolver: () => ({
        ok: false,
        code: 'WORKTREE_NOT_FOUND',
        message: 'no active task worktree found; run task:start first or pass branch',
        candidates: [],
      }),
      currentTask: null,
      candidates: [],
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('TASK_SESSION_REQUIRED');
    expect(plans).toHaveLength(0);
  });

  it('requires taskSession for sessionRequired tools', async () => {
    const result = await executeTool('fs.read', {
      path: 'AGENTS.md',
    }, {
      ...stableOptions(successfulRunner()),
      currentTask: null,
      candidates: [],
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('TASK_SESSION_REQUIRED');
  });

  it('uses options.env worktree root for taskSession discovery', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-session-env-'));
    const worktreeRoot = join(tempRoot, 'custom-worktrees');
    const worktree = join(worktreeRoot, 'task-workspace-agents-env');
    mkdirSync(join(worktree, '.task'), { recursive: true });
    writeFileSync(join(worktree, '.task', 'session.json'), JSON.stringify({
      taskSession: 'tsk_env_root',
      tmuxSession: 'opensaas-env',
      branch: 'task/workspace-agents/env-root',
      worktree,
    }, null, 2));

    try {
      const plans: CommandPlan[] = [];
      const result = await executeTool('fs.read', {
        taskSession: 'tsk_env_root',
        path: 'AGENTS.md',
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: join(tempRoot, 'empty-cwd'),
        env: { ...process.env, WORKSPACE_WORKTREE_ROOT: worktreeRoot },
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      expect(plans[0].env.TASK_BRANCH).toBe('task/workspace-agents/env-root');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('resolves taskSession metadata before branch planning', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-session-'));
    const previousRoot = process.env.WORKSPACE_WORKTREE_ROOT;
    process.env.WORKSPACE_WORKTREE_ROOT = join(tempRoot, 'worktrees');
    try {
      mkdirSync(join(tempRoot, '.task'), { recursive: true });
      writeFileSync(join(tempRoot, '.task', 'session.json'), JSON.stringify({
        taskSession: 'tsk_test',
        tmuxSession: 'opensaas-test',
        branch: 'task/workspace-agents/session-test',
        worktree: tempRoot,
      }, null, 2));

      const plans: CommandPlan[] = [];
      const result = await executeTool('fs.read', {
        taskSession: 'tsk_test',
        path: 'AGENTS.md',
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      expect(plans[0].env.TASK_BRANCH).toBe('task/workspace-agents/session-test');
      expect(plans[0].args).toContain('--branch');
      expect(plans[0].args).toContain('task/workspace-agents/session-test');
    } finally {
      if (previousRoot === undefined) delete process.env.WORKSPACE_WORKTREE_ROOT;
      else process.env.WORKSPACE_WORKTREE_ROOT = previousRoot;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('resolves review.run branch from taskSession before validation', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-review-session-'));
    const previousRoot = process.env.WORKSPACE_WORKTREE_ROOT;
    process.env.WORKSPACE_WORKTREE_ROOT = join(tempRoot, 'worktrees');
    try {
      mkdirSync(join(tempRoot, '.task'), { recursive: true });
      writeFileSync(join(tempRoot, '.task', 'session.json'), JSON.stringify({
        taskSession: 'tsk_review',
        tmuxSession: 'opensaas-review',
        branch: 'task/workspace-agents/review-session',
        worktree: tempRoot,
      }, null, 2));

      const plans: CommandPlan[] = [];
      const result = await executeTool('review.run', {
        taskSession: 'tsk_review',
        noTests: true,
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      expect(plans[0].env.TASK_BRANCH).toBe('task/workspace-agents/review-session');
      expect(plans[0].env.TASK_WORKTREE).toBe(tempRoot);
      expect(plans[0].args).toContain('--no-tests');
    } finally {
      if (previousRoot === undefined) delete process.env.WORKSPACE_WORKTREE_ROOT;
      else process.env.WORKSPACE_WORKTREE_ROOT = previousRoot;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('passes the taskSession worktree to audit', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-audit-session-'));
    try {
      const callerCwd = join(tempRoot, 'caller');
      const worktreeRoot = join(tempRoot, 'worktrees');
      const worktree = join(worktreeRoot, 'task-workspace-agents-audit');
      mkdirSync(callerCwd, { recursive: true });
      writeTaskSession(worktree, 'tsk_audit', 'task/workspace-agents/audit-session');

      const plans: CommandPlan[] = [];
      const result = await executeTool('audit', {
        taskSession: 'tsk_audit',
        scripts: true,
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: callerCwd,
        env: { ...process.env, WORKSPACE_WORKTREE_ROOT: worktreeRoot },
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      expect(plans[0].cwd).toBe(callerCwd);
      expect(plans[0].env.TASK_BRANCH).toBe('task/workspace-agents/audit-session');
      expect(plans[0].env.TASK_WORKTREE).toBe(worktree);
      expect(plans[0].args).toContain('audit');
      expect(plans[0].args).toContain('--scripts');
      expect(plans[0].args).not.toContain('--branch');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('allows matching taskSession and branch for code.call', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-code-call-session-'));
    try {
      writeTaskSession(tempRoot, 'tsk_code_call', TEST_BRANCH);
      const result = await executeTool('code.call', {
        taskSession: 'tsk_code_call',
        branch: TEST_BRANCH,
        language: 'python',
        mode: 'read',
        code: 'import os\nprint(os.environ["TASK_BRANCH"])\nprint(os.environ["TASK_WORKTREE"])',
        cwd: tempRoot,
      }, { ...stableOptions(successfulRunner()), cwd: tempRoot });

      expect(result.ok).toBe(true);
      expect(result.code).toBe('OK');
      expect(result.data?.stdout?.trim().split('\n')).toEqual([TEST_BRANCH, tempRoot]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('does not perform ambient task selection for http without task context', async () => {
    const plans: CommandPlan[] = [];
    const result = await executeTool('http', {
      url: 'https://example.com',
    }, {
      ...stableOptions(successfulRunner(), plans),
      branchResolver: () => ({
        ok: false,
        code: 'AMBIGUOUS_TASK_SELECTION',
        message: 'multiple active task worktrees match; pass taskSession',
        candidates: [
          { branch: 'task/os/one', area: 'os', worktree: '/tmp/one' },
          { branch: 'task/os/two', area: 'os', worktree: '/tmp/two' },
        ],
      }),
      currentTask: null,
      candidates: [
        { branch: 'task/os/one', area: 'os', worktree: '/tmp/one' },
        { branch: 'task/os/two', area: 'os', worktree: '/tmp/two' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe('OK');
    expect(plans).toHaveLength(1);
    expect(plans[0].args).toEqual(['run', 'fs', '--', 'http', 'https://example.com']);
  });

  it('does not perform ambient task selection for code.call without task context', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-code-call-no-session-'));
    try {
      const result = await executeTool('code.call', {
        language: 'python',
        mode: 'read',
        code: 'print("standalone")',
        cwd: tempRoot,
      }, {
        ...stableOptions(successfulRunner()),
        cwd: tempRoot,
        branchResolver: () => ({
          ok: false,
          code: 'AMBIGUOUS_TASK_SELECTION',
          message: 'multiple active task worktrees match; pass taskSession',
          candidates: [
            { branch: 'task/os/one', area: 'os', worktree: '/tmp/one' },
            { branch: 'task/os/two', area: 'os', worktree: '/tmp/two' },
          ],
        }),
        currentTask: null,
        candidates: [
          { branch: 'task/os/one', area: 'os', worktree: '/tmp/one' },
          { branch: 'task/os/two', area: 'os', worktree: '/tmp/two' },
        ],
      });

      expect(result.ok).toBe(true);
      expect(result.code).toBe('OK');
      expect(result.data?.stdout?.trim()).toBe('standalone');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('runs code.call edit mode inside an explicit task worktree', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-code-call-edit-session-'));
    try {
      writeTaskSession(tempRoot, 'tsk_code_call_edit', TEST_BRANCH);
      const result = await executeTool('code.call', {
        taskSession: 'tsk_code_call_edit',
        language: 'python',
        mode: 'edit',
        code: 'from pathlib import Path\nPath("edited.txt").write_text("changed")\nprint("edited")',
        cwd: tempRoot,
      }, { ...stableOptions(successfulRunner()), cwd: tempRoot });

      expect(result.ok).toBe(true);
      expect(result.code).toBe('OK');
      expect(result.data?.stdout?.trim()).toBe('edited');
      expect(result.data?.filesChanged).toContain('edited.txt');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects mismatched taskSession and branch', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-session-conflict-'));
    try {
      writeTaskSession(tempRoot, 'tsk_conflict', TEST_BRANCH);
      const result = await executeTool('code.call', {
        taskSession: 'tsk_conflict',
        branch: 'task/workspace-agents/other',
        language: 'python',
        mode: 'read',
        code: 'print("blocked")',
        cwd: tempRoot,
      }, { ...stableOptions(successfulRunner()), cwd: tempRoot });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('VALIDATION_ERROR');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails unknown taskSession handles deterministically', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-session-missing-'));
    const previousRoot = process.env.WORKSPACE_WORKTREE_ROOT;
    process.env.WORKSPACE_WORKTREE_ROOT = join(tempRoot, 'worktrees');
    try {
      const result = await executeTool('fs.read', {
        taskSession: 'tsk_missing_isolated',
        path: 'AGENTS.md',
      }, {
        ...stableOptions(successfulRunner()),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('TASK_SESSION_NOT_FOUND');
    } finally {
      if (previousRoot === undefined) delete process.env.WORKSPACE_WORKTREE_ROOT;
      else process.env.WORKSPACE_WORKTREE_ROOT = previousRoot;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('passes request ids through nested tool envelopes', async () => {
    const result = await executeTool('mac.exec', {
      ...exampleInput('mac.exec'),
      requestId: 'req_passthrough',
    }, stableOptions(passthroughRunner()));
    expect(result.requestId).toBe('req_passthrough');
    expect(result.now).toBe('1970-01-01T00:00:01.000Z');
  });

  it('includes now on validation failures', async () => {
    const result = await executeTool('fs.read', {}, stableOptions(successfulRunner()));
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.now).toBe('1970-01-01T00:00:01.000Z');
  });

  it('resolves unique script aliases from the manifest', () => {
    expect(getToolManifestEntry('decide-next')?.name).toBe('decideNext');
    expect(getToolManifestEntry('confidence-score')?.name).toBe('confidenceScore');
    expect(getToolManifestEntry('task:fs')).toBeNull();
  });
});

describe('branch resolver', () => {
  it('resolves explicit branch before current metadata', () => {
    const result = resolveTaskBranch({
      explicitBranch: 'task/workspace-agents/pinned',
      currentTask: {
        branch: TEST_BRANCH,
        area: 'workspace-agents',
        worktree: '/tmp/worktree',
      },
    });
    expect(result).toEqual({
      ok: true,
      branch: 'task/workspace-agents/pinned',
      source: 'explicit',
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
      message: 'no active task worktree found; run task.start and pass taskSession, or pass explicit branch/taskWorktree',
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
      { tool: 'status', input: exampleInput('status') },
      { tool: 'stream.list', input: exampleInput('stream.list') },
    ], stableOptions(successfulRunner()));
    expect(result.ok).toBe(true);
    expect(result.data.completed).toBe(2);
    expect(result.now).toBe('1970-01-01T00:00:01.000Z');
  });

  it('stops after a failed step', async () => {
    const result = await runBatch([
      { tool: 'status', args: exampleInput('status') },
      { tool: 'stream.list', args: exampleInput('stream.list') },
    ], stableOptions(failingRunner()));
    expect(result.ok).toBe(false);
    expect(result.data.completed).toBe(1);
  });

  it('runs parallel read-only steps together', async () => {
    const plans: CommandPlan[] = [];
    const result = await runBatch([
      { tool: 'status', input: exampleInput('status'), parallel: true },
      { tool: 'stream.list', input: exampleInput('stream.list'), parallel: true },
    ], stableOptions(successfulRunner(), plans));
    expect(result.ok).toBe(true);
    expect(plans).toHaveLength(2);
  });
});

describe('composed and mac wrappers', () => {
  it('builds checkFiles command arguments', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-check-files-'));
    try {
      writeTaskSession(tempRoot, 'tsk_check_files');
      const plans: CommandPlan[] = [];
      const input = { ...exampleInput('checkFiles'), taskSession: 'tsk_check_files' };
      delete input.branch;
      const result = await executeTool('checkFiles', input, { ...stableOptions(successfulRunner(), plans), cwd: tempRoot });
      expect(result.ok).toBe(true);
      expect(plans[0].args).toContain('check-files');
      expect(plans[0].args).toContain('--stop-on-first-error');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('passes editFlow dry-run to the native script', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-edit-flow-'));
    try {
      writeTaskSession(tempRoot, 'tsk_edit_flow');
      const plans: CommandPlan[] = [];
      const input = { ...exampleInput('editFlow'), taskSession: 'tsk_edit_flow', dryRun: true };
      delete input.branch;
      const result = await executeTool('editFlow', input, { ...stableOptions(successfulRunner(), plans), cwd: tempRoot });
      expect(result.code).toBe('OK');
      expect(plans[0].args).toContain('--dry-run');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('builds mac operation commands', async () => {
    const plans: CommandPlan[] = [];
    const result = await executeTool('mac.exec', exampleInput('mac.exec'), stableOptions(successfulRunner(), plans));
    expect(result.ok).toBe(true);
    expect(plans[0].args).toContain('mac');
    expect(plans[0].args).toContain('exec');
  });
});

