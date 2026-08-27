import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildMonitorErrorsReport } from '../scripts/lib/monitor-errors-report';
import { recordToolTraceSafely } from '../scripts/lib/trace-persistence';

describe('monitor errors report trace selection', () => {
  it('uses the persisted ok bit rather than free-form status/code text to select failures', async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), 'consuelo-monitor-errors-'));
    const env = { CONSUELO_HOME: home, CONSUELO_TRACE_DB: '', TRACE_DB: '' };
    try {
      for (let index = 0; index < 3; index += 1) {
        expect(recordToolTraceSafely({
          traceId: `trc_success_${index}`,
          source: 'test',
          tool: 'tools.search',
          status: 'success',
          ok: true,
          code: 'OK',
        }, { env })).toBe(true);
      }
      expect(recordToolTraceSafely({
        traceId: 'trc_failure',
        source: 'test',
        tool: 'tools.search',
        status: 'error',
        ok: false,
        code: 'COMMAND_FAILED',
      }, { env })).toBe(true);

      const report = buildMonitorErrorsReport({ home, env });

      expect(report.summary.total).toBe(1);
      expect(report.groups).toHaveLength(1);
      expect(report.groups[0]).toMatchObject({
        traceId: 'trc_failure',
        code: 'COMMAND_FAILED',
        occurrences: 1,
      });
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it('preserves persisted stderr so classification can distinguish caller failures', async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), 'consuelo-monitor-errors-'));
    const env = { CONSUELO_HOME: home, CONSUELO_TRACE_DB: '', TRACE_DB: '' };
    try {
      expect(recordToolTraceSafely({
        traceId: 'trc_patch_mismatch',
        source: 'test',
        tool: 'fs.apply_patch',
        status: 'error',
        ok: false,
        code: 'COMMAND_FAILED',
        stderr: 'error: patch hunk did not match: .task/example/workpad.md',
      }, { env })).toBe(true);

      const report = buildMonitorErrorsReport({ home, env });

      expect(report.groups).toHaveLength(1);
      expect(report.groups[0]).toMatchObject({
        traceId: 'trc_patch_mismatch',
        classification: 'caller-input',
        actionable: false,
      });
      expect(report.groups[0]).not.toHaveProperty('stderr');
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it('does not let the latest deterministic caller failure absorb unrelated failures with the same tool and code', async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), 'consuelo-monitor-errors-'));
    const env = { CONSUELO_HOME: home, CONSUELO_TRACE_DB: '', TRACE_DB: '' };
    try {
      for (let index = 0; index < 3; index += 1) {
        expect(recordToolTraceSafely({
          traceId: `trc_search_runtime_${index}`,
          source: 'test',
          tool: 'fs.search',
          taskSession: `tsk_runtime_${index}`,
          branch: `task/test/runtime-${index}`,
          status: 'error',
          ok: false,
          code: 'COMMAND_FAILED',
          stderr: 'error: search failed: ripgrep exited without a status',
        }, { env })).toBe(true);
      }
      expect(recordToolTraceSafely({
        traceId: 'trc_search_missing_path',
        source: 'test',
        tool: 'fs.search',
        taskSession: 'tsk_caller',
        branch: 'task/test/caller',
        status: 'error',
        ok: false,
        code: 'COMMAND_FAILED',
        stderr: 'error: search failed: rg: packages/os/missing: No such file or directory (os error 2)',
      }, { env })).toBe(true);

      const report = buildMonitorErrorsReport({ home, env });

      expect(report.groups).toHaveLength(2);
      expect(report.groups).toEqual(expect.arrayContaining([
        expect.objectContaining({
          classification: 'defect-candidate',
          actionable: true,
          occurrences: 3,
        }),
        expect.objectContaining({
          traceId: 'trc_search_missing_path',
          classification: 'caller-input',
          actionable: false,
          occurrences: 1,
        }),
      ]));
      expect(report.groups.every((group) => !Object.hasOwn(group, 'stderr'))).toBe(true);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
