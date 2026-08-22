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
});
