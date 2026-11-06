import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  launchScenarios,
  createLaunchEvidence,
  formatLaunchReport,
  resolveScenarioSelection,
  sanitizeDiagnosticValue,
  validateLiveCallScope,
  type LaunchEvidence,
} from './launch-scenarios';

describe('Dialer launch scenario registry', () => {
  test('covers representative real-world human, concurrency, failure and commercial behavior', () => {
    const ids = launchScenarios.map((scenario) => scenario.id);
    expect(ids.length).toBeGreaterThanOrEqual(18);
    expect(new Set(ids).size).toBe(ids.length);
    const categories = new Set(launchScenarios.map((scenario) => scenario.category));
    for (const category of ['outbound', 'predictive', 'inbound', 'concurrency', 'recovery', 'crm', 'security', 'commercial']) {
      expect(categories.has(category as never)).toBe(true);
    }
    for (const scenario of launchScenarios) {
      expect(scenario.id).toMatch(/^S\d{2}$/);
      expect(scenario.title.length).toBeGreaterThan(12);
      expect(scenario.preconditions.length).toBeGreaterThan(0);
      expect(scenario.actions.length).toBeGreaterThan(1);
      expect(scenario.expected.length).toBeGreaterThan(0);
      expect(scenario.invariants.length).toBeGreaterThan(0);
      expect(scenario.diagnostics.length).toBeGreaterThan(0);
      expect(scenario.automation.every((testPath) => testPath.includes('.test.ts'))).toBe(true);
      for (const testPath of scenario.automation) {
        expect(existsSync(resolve(import.meta.dir, '../../../..', testPath))).toBe(true);
      }
    }
    expect(launchScenarios.filter((s) => s.requiresCarrier).length).toBeGreaterThanOrEqual(7);
    expect(launchScenarios.map((s) => s.automationConfidence)).not.toContain('live-proven');
  });

  test('selects requested IDs deterministically and rejects unknown or duplicate IDs', () => {
    expect(resolveScenarioSelection('S04,S01').map((scenario) => scenario.id)).toEqual(['S01', 'S04']);
    expect(resolveScenarioSelection('all').length).toBe(launchScenarios.length);
    expect(() => resolveScenarioSelection('S01,S01')).toThrow('Duplicate scenario');
    expect(() => resolveScenarioSelection('S99')).toThrow('Unknown scenario');
  });
});

describe('Evidence and test safety', () => {
  test('does not convert automated component success into an unverified live call pass', () => {
    expect(() => createLaunchEvidence({
      scenarioId: 'S01',
      lane: 'automated',
      outcome: 'passed',
      observation: 'unit tests passed',
    })).toThrow('test exit code');
    const record = createLaunchEvidence({
      scenarioId: 'S01',
      lane: 'automated',
      outcome: 'passed',
      observation: 'focused regression completed',
      testExitCode: 0,
      seed: 2601,
    });
    expect(record.lane).toBe('automated');
    expect(record.liveStatus).toBe('not-tested');
    expect(record.seed).toBe(2601);
    expect(record.outcome).toBe('passed');
    expect(() => createLaunchEvidence({
      scenarioId: 'S01',
      lane: 'manual',
      outcome: 'passed',
      observation: 'clicked around',
    })).toThrow('observer');
    expect(createLaunchEvidence({
      scenarioId: 'S01', lane: 'manual', outcome: 'failed', observer: 'tester',
      observation: 'lost call control after CRM navigation',
    }).liveStatus).toBe('unverified');
  });

  test('sanitizes numbers, provider SIDs, email, bearer tokens, credentials, and URL queries before writing evidence', () => {
    const sid = 'CA' + 'a'.repeat(32);
    const raw = {
      authorization: 'Bearer example-secret-value',
      cookie: 'session=abc123',
      apiKey: 'xyz',
      token: 'abc',
      body: 'to +17045550123 from +18285550198; sid ' + sid + '; rep a@b.com',
      url: 'https://calls.consuelohq.com/path?token=abc&email=a%40b.com',
      metadata: { note: 'Authorization: Bearer tokenvalue' },
    };
    const cleaned = sanitizeDiagnosticValue(raw);
    const output = JSON.stringify(cleaned);
    for (const prohibited of [
      'example-secret-value', 'session=abc123', 'xyz', 'abc123',
      '+17045550123', '+18285550198', sid, 'a@b.com',
      'tokenvalue', 'a%40b.com',
    ]) {
      expect(output.includes(prohibited)).toBe(false);
    }
    expect(output).toContain('[REDACTED]');
  });

  test('rejects broad live-call permissions; source, target, fanout, one initiation and consent scope are required', () => {
    const valid = {
      scenarioId: 'S01', source: '+17045550123', destination: '+18285550198',
      fanout: 1, approvalRef: 'specific-single-call-approval',
      recording: false, transcription: false, maxInitiations: 1,
    };
    expect(validateLiveCallScope(valid).maxInitiations).toBe(1);
    expect(() => validateLiveCallScope({ ...valid, fanout: 4 })).toThrow('fanout');
    expect(() => validateLiveCallScope({ ...valid, maxInitiations: 2 })).toThrow('one initiation');
    expect(() => validateLiveCallScope({ ...valid, approvalRef: '' })).toThrow('approval');
    expect(() => validateLiveCallScope({ ...valid, destination: 'test number' })).toThrow('E.164');
    expect(() => validateLiveCallScope({ ...valid, recording: true })).toThrow('separate consent');
    expect(() => validateLiveCallScope({ ...valid, scenarioId: 'S99' })).toThrow('Unknown scenario');
  });

  test('report separates manual evidence, automated coverage and untested work', () => {
    const records: LaunchEvidence[] = [
      createLaunchEvidence({scenarioId:'S01',lane:'automated',outcome:'passed',testExitCode:0,observation:'tests passed'}),
      createLaunchEvidence({scenarioId:'S01',lane:'manual',outcome:'blocked',observer:'ko',observation:'mic prompt'}),
      createLaunchEvidence({scenarioId:'S04',lane:'automated',outcome:'failed',testExitCode:1,observation:'winner duplicate'}),
    ];
    const report = formatLaunchReport(records);
    expect(report).toContain('S01');
    expect(report).toContain('S04');
    expect(report).toContain('blocked');
    expect(report).toContain('failed');
    expect(report).toContain('Not yet executed');
    expect(report).not.toContain('Launch ready');
  });
});
