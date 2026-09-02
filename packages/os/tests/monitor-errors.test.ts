import { describe, expect, it } from 'vitest';

import {
  classifyTraceFailure,
  summarizeTraceFailures,
  type MonitorToolContract,
  type MonitorTraceFailure,
} from '../scripts/lib/monitor-errors';

const mutatingContract: MonitorToolContract = {
  name: 'fs.write',
  readOnly: false,
  mutating: true,
  sessionRequired: true,
};

const readContract: MonitorToolContract = {
  name: 'fs.read',
  readOnly: true,
  mutating: false,
  sessionRequired: false,
};

function failure(overrides: Partial<MonitorTraceFailure> = {}): MonitorTraceFailure {
  return {
    traceId: 'trc_test',
    ts: '2026-08-14T00:00:00.000Z',
    tool: 'fs.write',
    code: 'TASK_SESSION_REQUIRED',
    status: 'error',
    branch: 'main',
    ...overrides,
  };
}

describe('OS self-healing trace classification', () => {
  it('treats a required task session on a mutating tool as expected policy enforcement', () => {
    expect(classifyTraceFailure(failure(), mutatingContract)).toMatchObject({
      classification: 'expected-policy',
      actionable: false,
    });
  });

  it('detects runtime/contract drift when an observed session error contradicts the current read-only tool contract', () => {
    expect(
      classifyTraceFailure(
        failure({ tool: 'fs.read', code: 'TASK_SESSION_REQUIRED' }),
        readContract,
      ),
    ).toMatchObject({
      classification: 'runtime-contract-drift',
      actionable: true,
    });
  });

  it('treats a stale optional task session as caller input rather than runtime drift', () => {
    expect(
      classifyTraceFailure(
        failure({ tool: 'fs.read', code: 'TASK_SESSION_NOT_FOUND' }),
        readContract,
      ),
    ).toMatchObject({
      classification: 'caller-input',
      actionable: false,
    });
  });

  it('keeps safety blocks and validation errors out of the defect bucket unless current contracts contradict them', () => {
    expect(
      classifyTraceFailure(
        failure({ tool: 'fs.write', code: 'SAFETY_BLOCKED' }),
        mutatingContract,
      ).classification,
    ).toBe('expected-policy');
    expect(
      classifyTraceFailure(
        failure({ tool: 'github', code: 'VALIDATION_ERROR' }),
        undefined,
      ).classification,
    ).toBe('caller-input');
  });

  it('keeps explicit MCP authentication and scope enforcement out of the defect bucket', () => {
    for (const code of ['UNKNOWN_TOKEN', 'MISSING_SCOPE']) {
      expect(
        classifyTraceFailure(
          failure({
            tool: 'authorization.mcp',
            code,
            occurrences: 24,
          }),
          undefined,
        ),
      ).toMatchObject({ classification: 'expected-policy', actionable: false });
    }

    expect(
      classifyTraceFailure(
        failure({
          tool: 'authorization.mcp',
          code: 'OAUTH_INTROSPECTION_UNAVAILABLE',
          occurrences: 4,
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'defect-candidate', actionable: true });
  });

  it('keeps work-session and filesystem containment enforcement non-actionable without masking unrelated permission failures', () => {
    expect(
      classifyTraceFailure(
        failure({ tool: 'fs.write', code: 'WORK_SESSION_NOT_FOUND', occurrences: 27 }),
        mutatingContract,
      ),
    ).toMatchObject({ classification: 'caller-input', actionable: false });

    expect(
      classifyTraceFailure(
        failure({ tool: 'fs.write', code: 'PERMISSION_DENIED', occurrences: 54 }),
        mutatingContract,
      ),
    ).toMatchObject({ classification: 'expected-policy', actionable: false });

    for (const [tool, stderr] of [
      ['fs.write', 'PATH_OUTSIDE_ROOT: Path escapes the allowed root: ../outside.txt'],
      ['fs.apply_patch', 'error: unsafe mutation path resolves outside allowed root: escape/outside.txt'],
      ['fs.trash', 'failed to trash escape/outside.txt: unsafe mutation path resolves outside allowed root: escape/outside.txt'],
    ] as const) {
      expect(
        classifyTraceFailure(
          failure({ tool, code: 'COMMAND_FAILED', occurrences: 27, stderr }),
          mutatingContract,
        ),
      ).toMatchObject({ classification: 'expected-policy', actionable: false });
    }

    expect(
      classifyTraceFailure(
        failure({ tool: 'deployment.environment', code: 'PERMISSION_DENIED', occurrences: 4 }),
        undefined,
      ),
    ).toMatchObject({ classification: 'defect-candidate', actionable: true });
  });

  it('keeps explicit code.call validation failures in the caller-input bucket', () => {
    expect(
      classifyTraceFailure(
        failure({
          tool: 'code.call',
          code: 'CODE_CALL_VALIDATION_ERROR',
          occurrences: 6,
          affectedSessions: 3,
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'caller-input', actionable: false });
  });

  it('does not manufacture defects from recurring execution-wrapper child failures', () => {
    for (const tool of ['batch', 'code.call']) {
      expect(
        classifyTraceFailure(
          failure({
            tool,
            code: 'COMMAND_FAILED',
            occurrences: 12,
            affectedBranches: 4,
            affectedSessions: 4,
          }),
          undefined,
        ),
      ).toMatchObject({ classification: 'unknown', actionable: false });
    }
  });

  it('does not promote recurring code.call timeouts from arbitrary child commands into source defects', () => {
    expect(
      classifyTraceFailure(
        failure({
          tool: 'code.call',
          code: 'TIMEOUT',
          occurrences: 9,
          affectedBranches: 5,
          affectedSessions: 5,
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'unknown', actionable: false });
  });

  it('keeps substantive stream.sync merge-conflict state non-actionable without masking sync defects', () => {
    expect(
      classifyTraceFailure(
        failure({
          tool: 'stream.sync',
          code: 'COMMAND_FAILED',
          occurrences: 7,
          stderr: 'CONFLICT (content): Merge conflict in packages/workspace/test-selection.registry.json\nAutomatic merge failed; fix conflicts and then commit the result.',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'caller-input', actionable: false });

    expect(
      classifyTraceFailure(
        failure({
          tool: 'stream.sync',
          code: 'COMMAND_FAILED',
          occurrences: 7,
          stderr: 'stream sync failed before git merge because the helper crashed',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'defect-candidate', actionable: true });
  });

  it('keeps GitHub workflow-cancel operation-state rejections non-actionable without masking real wrapper failures', () => {
    for (const stderr of [
      'Cannot cancel a workflow run that is completed',
      'gh: Cannot cancel a workflow run that has not been queued yet. (HTTP 409)',
    ]) {
      expect(
        classifyTraceFailure(
          failure({
            tool: 'github',
            code: 'COMMAND_FAILED',
            occurrences: 4,
            stderr,
          }),
          undefined,
        ),
      ).toMatchObject({ classification: 'caller-input', actionable: false });
    }

    expect(
      classifyTraceFailure(
        failure({
          tool: 'github',
          code: 'COMMAND_FAILED',
          occurrences: 4,
          stderr: 'error: github wrapper exited before invoking gh',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'defect-candidate', actionable: true });
  });

  it('keeps release safety and active-lifecycle preconditions out of the defect bucket', () => {
    expect(
      classifyTraceFailure(
        failure({
          tool: 'release',
          code: 'COMMAND_FAILED',
          occurrences: 3,
          stderr: 'release refuses failed check Consuelo / verify',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'expected-policy', actionable: false });

    expect(
      classifyTraceFailure(
        failure({
          tool: 'release',
          code: 'COMMAND_FAILED',
          occurrences: 3,
          stderr: 'update local node to canary 0.1.84: {"error":{"code":"LIFECYCLE_FAILED","message":"native lifecycle operation native-example is already active"}}',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'transient', actionable: false });

    expect(
      classifyTraceFailure(
        failure({
          tool: 'release',
          code: 'COMMAND_FAILED',
          occurrences: 3,
          stderr: 'release orchestrator failed to parse its local state file',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'defect-candidate', actionable: true });
  });

  it('keeps GitHub not-yet-readable workflow state non-actionable without masking wrapper defects', () => {
    for (const stderr of [
      'job 99123 is still in progress; logs will be available when it is complete',
      "no checks reported on the 'stream/os' branch",
      "no required checks reported on the 'stream/os' branch",
    ]) {
      expect(
        classifyTraceFailure(
          failure({
            tool: 'github',
            code: 'COMMAND_FAILED',
            occurrences: 8,
            affectedSessions: 3,
            stderr,
          }),
          undefined,
        ),
      ).toMatchObject({ classification: 'caller-input', actionable: false });
    }

    expect(
      classifyTraceFailure(
        failure({
          tool: 'github',
          code: 'COMMAND_FAILED',
          occurrences: 8,
          affectedSessions: 3,
          stderr: 'error: github wrapper exited before invoking gh',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'defect-candidate', actionable: true });
  });

  it('keeps task.push publish-valid and branch-sync guards as expected policy', () => {
    for (const stderr of [
      'publish-valid verify required before task:push: missing .task/example/verify.json stamp. run: bun run verify',
      'publish-valid verify required before task:push: verify head mismatch: abc != def. run: bun run verify',
      'local task branch is not synced with origin/task/os/example (local abc != remote def); sync the task worktree before running task:push',
    ]) {
      expect(
        classifyTraceFailure(
          failure({
            tool: 'task.push',
            code: 'COMMAND_FAILED',
            occurrences: 10,
            affectedSessions: 4,
            stderr,
          }),
          undefined,
        ),
      ).toMatchObject({ classification: 'expected-policy', actionable: false });
    }

    expect(
      classifyTraceFailure(
        failure({
          tool: 'task.push',
          code: 'COMMAND_FAILED',
          occurrences: 10,
          affectedSessions: 4,
          stderr: 'task push failed to serialize the GitHub request',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'defect-candidate', actionable: true });
  });

  it('keeps deterministic task.push invocation mistakes in the caller-input bucket without masking missing remote branches', () => {
    for (const stderr of [
      'provide --changed, --files, or --files-json',
      'commit message does not match conventional format: Keep public connector available through restart',
    ]) {
      expect(
        classifyTraceFailure(
          failure({
            tool: 'task.push',
            code: 'COMMAND_FAILED',
            occurrences: 5,
            affectedBranches: 4,
            affectedSessions: 4,
            stderr,
          }),
          undefined,
        ),
      ).toMatchObject({ classification: 'caller-input', actionable: false });
    }

    expect(
      classifyTraceFailure(
        failure({
          tool: 'task.push',
          code: 'COMMAND_FAILED',
          occurrences: 3,
          affectedBranches: 3,
          affectedSessions: 3,
          stderr: 'remote branch not found: task/os/example',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'defect-candidate', actionable: true });
  });

  it('keeps session.start caller and managed-repository preconditions out of the defect bucket', () => {
    for (const stderr of [
      'work session path does not exist: /tmp/consuelo-missing-work-session',
      'missing required --area\ntask session start failed: task-start exited with code 1',
    ]) {
      expect(
        classifyTraceFailure(
          failure({
            tool: 'session.start',
            code: 'COMMAND_FAILED',
            occurrences: 7,
            stderr,
          }),
          undefined,
        ),
      ).toMatchObject({ classification: 'caller-input', actionable: false });
    }

    expect(
      classifyTraceFailure(
        failure({
          tool: 'session.start',
          code: 'COMMAND_FAILED',
          occurrences: 7,
          stderr: 'Work sessions cannot edit the managed repository or its task worktrees (/tmp/example). Use a taskSession for repository edits.',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'expected-policy', actionable: false });

    expect(
      classifyTraceFailure(
        failure({
          tool: 'session.start',
          code: 'COMMAND_FAILED',
          occurrences: 7,
          stderr: 'session start metadata store failed to parse its state',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'defect-candidate', actionable: true });
  });

  it('keeps task.pr substantive merge-conflict state non-actionable without masking lifecycle defects', () => {
    expect(
      classifyTraceFailure(
        failure({
          tool: 'task.pr',
          code: 'COMMAND_FAILED',
          occurrences: 9,
          affectedSessions: 6,
          stderr: 'task PR merge failed and metadata recovery did not apply: non-metadata conflicts present (original: github PUT /repos/consuelohq/opensaas/pulls/2301/merge -> 405 Pull Request has merge conflicts)',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'caller-input', actionable: false });

    expect(
      classifyTraceFailure(
        failure({
          tool: 'task.pr',
          code: 'COMMAND_FAILED',
          occurrences: 9,
          affectedSessions: 6,
          stderr: 'task PR merge failed because the metadata updater crashed',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'defect-candidate', actionable: true });
  });

  it('keeps obvious caller-caused filesystem command failures out of the defect bucket', () => {
    expect(
      classifyTraceFailure(
        failure({
          tool: 'fs.apply_patch',
          code: 'COMMAND_FAILED',
          occurrences: 6,
          affectedSessions: 3,
          stderr: 'error: patch hunk did not match: .task/example/workpad.md',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'caller-input', actionable: false });

    expect(
      classifyTraceFailure(
        failure({
          tool: 'fs.apply_patch',
          code: 'COMMAND_FAILED',
          occurrences: 2,
          affectedSessions: 2,
          stderr: 'error: invalid patch: missing *** Begin Patch',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'caller-input', actionable: false });

    expect(
      classifyTraceFailure(
        failure({
          tool: 'fs.list',
          code: 'COMMAND_FAILED',
          occurrences: 8,
          affectedBranches: 2,
          stderr: "[fd error]: Search path '/Users/example/missing' is not a directory.",
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'caller-input', actionable: false });

    expect(
      classifyTraceFailure(
        failure({
          tool: 'fs.read',
          code: 'COMMAND_FAILED',
          occurrences: 3,
          affectedBranches: 3,
          stderr: 'error: no active task found for branch "stream/os". run task:start first.',
        }),
        readContract,
      ),
    ).toMatchObject({ classification: 'caller-input', actionable: false });

    expect(
      classifyTraceFailure(
        failure({
          tool: 'fs.read',
          code: 'COMMAND_FAILED',
          occurrences: 3,
          affectedBranches: 2,
          stderr: 'error: filesystem reader exited unexpectedly',
        }),
        readContract,
      ),
    ).toMatchObject({ classification: 'defect-candidate', actionable: true });

    expect(
      classifyTraceFailure(
        failure({
          tool: 'fs.search',
          code: 'COMMAND_FAILED',
          occurrences: 4,
          affectedSessions: 1,
          stderr: 'error: search failed: rg: packages/os/server: No such file or directory (os error 2)',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'caller-input', actionable: false });

    expect(
      classifyTraceFailure(
        failure({
          tool: 'fs.search',
          code: 'COMMAND_FAILED',
          occurrences: 4,
          affectedSessions: 2,
          stderr: 'error: search failed: ripgrep exited without a status',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'defect-candidate', actionable: true });

    expect(
      classifyTraceFailure(
        failure({
          tool: 'fs.search',
          code: 'COMMAND_FAILED',
          occurrences: 8,
          affectedSessions: 5,
          stderr: 'error: search failed: rg: regex parse error:\n(?:waitFor()\n^\nerror: unclosed group',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'caller-input', actionable: false });

    expect(
      classifyTraceFailure(
        failure({
          tool: 'fs.list',
          code: 'COMMAND_FAILED',
          occurrences: 6,
          affectedSessions: 3,
          stderr: '[fd error]: regex parse error:\n*browser*\n^\nerror: repetition operator missing expression',
        }),
        undefined,
      ),
    ).toMatchObject({ classification: 'caller-input', actionable: false });
  });

  it('surfaces repeated command failures as defect candidates while keeping isolated timeouts transient', () => {
    expect(
      classifyTraceFailure(failure({ code: 'COMMAND_FAILED', occurrences: 9, affectedBranches: 3 }), undefined),
    ).toMatchObject({ classification: 'defect-candidate', actionable: true });
    expect(
      classifyTraceFailure(failure({ code: 'TIMEOUT', occurrences: 1 }), undefined),
    ).toMatchObject({ classification: 'transient', actionable: false });
  });

  it('summarizes classifications without equating every non-OK trace with a product defect', () => {
    const classified = [
      classifyTraceFailure(failure(), mutatingContract),
      classifyTraceFailure(failure({ tool: 'fs.read' }), readContract),
      classifyTraceFailure(failure({ code: 'TIMEOUT' }), undefined),
    ];
    expect(summarizeTraceFailures(classified)).toMatchObject({
      total: 3,
      expectedPolicy: 1,
      runtimeContractDrift: 1,
      transient: 1,
      actionable: 1,
    });
  });
});
