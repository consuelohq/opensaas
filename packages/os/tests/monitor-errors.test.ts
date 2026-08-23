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
