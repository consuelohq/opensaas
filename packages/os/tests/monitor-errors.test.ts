import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';

import { afterEach, describe, expect, it } from 'vitest';

import {
  classifyTraceFailure,
  summarizeTraceFailures,
  type MonitorToolContract,
  type MonitorTraceFailure,
} from '../scripts/lib/monitor-errors';
import { buildMonitorErrorsReport } from '../scripts/lib/monitor-errors-report';

let tempHome = '';

afterEach(() => {
  if (tempHome) rmSync(tempHome, { recursive: true, force: true });
  tempHome = '';
});

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

  it('persists the normalized 24h monitor report for artifact publication', () => {
    tempHome = mkdtempSync(join(tmpdir(), 'consuelo-monitor-errors-'));
    const traceDb = join(tempHome, 'traces.sqlite');
    const db = new Database(traceDb);
    db.run(`CREATE TABLE tool_traces (
      trace_id TEXT NOT NULL,
      ts TEXT NOT NULL,
      tool TEXT NOT NULL,
      code TEXT,
      status TEXT,
      branch TEXT,
      task_session TEXT
    )`);
    db.run(`INSERT INTO tool_traces VALUES (?, datetime('now'), ?, ?, ?, ?, ?)`, [
      'trc_persist', 'fs.read', 'TASK_SESSION_REQUIRED', 'error', 'main', null,
    ]);
    db.close();

    const report = buildMonitorErrorsReport({
      home: tempHome,
      env: { ...process.env, CONSUELO_TRACE_DB: traceDb },
      now: new Date('2026-08-14T01:00:00.000Z'),
    });

    expect(report.reportPath).toMatch(/monitor-errors\/.*\.json$/);
    const persisted = JSON.parse(readFileSync(report.reportPath, 'utf8')) as { summary: { runtimeContractDrift: number } };
    expect(persisted.summary.runtimeContractDrift).toBe(1);
  });
});
