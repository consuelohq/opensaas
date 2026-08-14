import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readArtifactCatalog, resolveArtifactCurrentIndex } from '../scripts/lib/artifacts';
import {
  createDailyScheduleEntry,
  renderDailySchedulesIndex,
  type DailyScheduleEntry,
} from '../scripts/lib/daily-schedules';
import { publishDailySchedule, publishDailyScheduleBundle } from '../scripts/lib/daily-schedules-publisher';

let tempHome = '';

afterEach(() => {
  if (tempHome) rmSync(tempHome, { recursive: true, force: true });
  tempHome = '';
});

describe('Daily Schedules artifact model', () => {
  const entries: DailyScheduleEntry[] = [
    createDailyScheduleEntry({
      date: '2026-08-14',
      kind: 'security-scan',
      title: 'Security scan',
      href: '/daily-schedules/2026-08-14/security-scan/',
    }),
    createDailyScheduleEntry({
      date: '2026-08-14',
      kind: 'security-workpad',
      title: 'Security workpad',
      href: '/daily-schedules/2026-08-14/security/',
    }),
    createDailyScheduleEntry({
      date: '2026-08-14',
      kind: 'self-healing-report',
      title: 'Self-healing report',
      href: '/daily-schedules/2026-08-14/self-healing-report/',
    }),
    createDailyScheduleEntry({
      date: '2026-08-14',
      kind: 'self-healing-workpad',
      title: 'Self-healing workpad',
      href: '/daily-schedules/2026-08-14/self-healing/',
    }),
    createDailyScheduleEntry({
      date: '2026-08-13',
      kind: 'security-scan',
      title: 'Security scan',
      href: '/daily-schedules/2026-08-13/security-scan/',
    }),
  ];

  it('keeps the four schedule entry kinds explicit and validates ISO dates', () => {
    expect(entries.map((entry) => entry.kind)).toEqual([
      'security-scan',
      'security-workpad',
      'self-healing-report',
      'self-healing-workpad',
      'security-scan',
    ]);
    expect(() =>
      createDailyScheduleEntry({
        date: '08/14/2026',
        kind: 'security-scan',
        title: 'bad',
        href: '/bad',
      }),
    ).toThrow(/YYYY-MM-DD/);
  });

  it('renders a link-first index ordered by date with date and kind filters', () => {
    const html = renderDailySchedulesIndex(entries, { title: 'Daily Schedules' });
    expect(html).toContain('Daily Schedules');
    expect(html).toContain('data-schedule-date="2026-08-14"');
    expect(html).toContain('data-schedule-kind="security-scan"');
    expect(html).toContain('security-workpad');
    expect(html).toContain('self-healing-report');
    expect(html).toContain('self-healing-workpad');
    expect(html.indexOf('2026-08-14')).toBeLessThan(html.indexOf('2026-08-13'));
    expect(html).toContain('type="date"');
    expect(html).toContain('<select');
    expect(html).toContain('href="/daily-schedules/2026-08-14/security-scan/"');
  });

  it('renders an empty configured archive without inventing schedule entries', () => {
    const html = renderDailySchedulesIndex([], { title: 'Daily Schedules' });
    expect(html).toContain('No schedule entries yet');
    expect(html).not.toContain('security-scan</a>');
  });

  it('publishes durable dated details and refreshes one filterable index in an isolated Consuelo home', () => {
    tempHome = mkdtempSync(join(tmpdir(), 'consuelo-daily-schedules-'));
    const scanPath = join(tempHome, 'scan.json');
    const securityPath = join(tempHome, 'security.md');
    const healingPath = join(tempHome, 'healing.md');
    writeFileSync(scanPath, JSON.stringify({ summary: { total: 0 }, findings: [] }), 'utf8');
    writeFileSync(securityPath, '# Security\nNo actionable findings today.\n', 'utf8');
    writeFileSync(healingPath, '# Self-healing\nNo high-confidence fix today.\n', 'utf8');

    publishDailySchedule({
      home: tempHome,
      date: '2026-08-14',
      kind: 'security-scan',
      sourceFile: scanPath,
      now: new Date('2026-08-14T01:00:00.000Z'),
    });
    publishDailySchedule({
      home: tempHome,
      date: '2026-08-14',
      kind: 'security-workpad',
      sourceFile: securityPath,
      now: new Date('2026-08-14T01:01:00.000Z'),
    });
    const result = publishDailySchedule({
      home: tempHome,
      date: '2026-08-14',
      kind: 'self-healing-workpad',
      sourceFile: healingPath,
      now: new Date('2026-08-14T01:02:00.000Z'),
    });

    expect(result).toMatchObject({
      indexUrl: '/artifacts/daily-schedules',
      entryCount: 3,
    });
    const catalog = readArtifactCatalog(tempHome);
    expect(catalog.entries.filter((entry) => entry.category.startsWith('daily-schedule:'))).toHaveLength(3);
    expect(catalog.entries.filter((entry) => entry.category === 'daily-schedules')).toHaveLength(1);

    const indexHtml = readFileSync(resolveArtifactCurrentIndex(tempHome, '/daily-schedules'), 'utf8');
    expect(indexHtml).toContain('data-schedule-date="2026-08-14"');
    expect(indexHtml).toContain('data-schedule-kind="security-scan"');
    expect(indexHtml).toContain('data-schedule-kind="security-workpad"');
    expect(indexHtml).toContain('data-schedule-kind="self-healing-workpad"');
    expect(indexHtml).toContain('/artifacts/daily-schedules/2026-08-14/security-scan');

    const updated = publishDailySchedule({
      home: tempHome,
      date: '2026-08-14',
      kind: 'security-workpad',
      content: '# Security\nOne reviewed fix opened as a PR.\n',
      format: 'markdown',
      now: new Date('2026-08-14T01:03:00.000Z'),
    });
    expect(updated.entryCount).toBe(3);
    const updatedCatalog = readArtifactCatalog(tempHome);
    const workpad = updatedCatalog.entries.find((entry) => entry.path === '/daily-schedules/2026-08-14/security');
    expect(workpad?.versionCount).toBe(2);
  });

  it('publishes one report and the existing generated task workpad as a schedule bundle', () => {
    tempHome = mkdtempSync(join(tmpdir(), 'consuelo-daily-schedules-bundle-'));
    const reportPath = join(tempHome, 'monitor.json');
    const workpadPath = join(tempHome, 'workpad.md');
    writeFileSync(reportPath, JSON.stringify({
      generatedAt: '2026-08-14T01:00:00.000Z',
      window: '24h',
      summary: { total: 9, actionable: 2, expectedPolicy: 4, callerInput: 2, transient: 1, runtimeContractDrift: 0, defectCandidate: 2, external: 0, unknown: 0 },
      groups: [],
    }), 'utf8');
    writeFileSync(workpadPath, '# generated task workpad\n\n## current status\n\nReviewed two defect candidates.\n', 'utf8');

    const result = publishDailyScheduleBundle({
      home: tempHome,
      schedule: 'self-healing',
      reportFile: reportPath,
      workpadFile: workpadPath,
      date: '2026-08-14',
      now: new Date('2026-08-14T01:10:00.000Z'),
    });

    expect(result.entries).toHaveLength(2);
    expect(result.entries.map((entry) => entry.kind)).toEqual(['self-healing-report', 'self-healing-workpad']);
    const catalog = readArtifactCatalog(tempHome);
    expect(catalog.entries.find((entry) => entry.path === '/daily-schedules/2026-08-14/self-healing-report')).toBeTruthy();
    expect(catalog.entries.find((entry) => entry.path === '/daily-schedules/2026-08-14/self-healing')).toBeTruthy();

    const reportHtml = readFileSync(resolveArtifactCurrentIndex(tempHome, '/daily-schedules/2026-08-14/self-healing-report'), 'utf8');
    expect(reportHtml).toContain('aria-label="Self-healing error classification distribution"');
    expect(reportHtml).toContain('Compared with');
    expect(reportHtml).not.toContain('legend');
  });

  it('validates the publish contract before creating any artifact state', () => {
    tempHome = mkdtempSync(join(tmpdir(), 'consuelo-daily-schedules-invalid-'));
    expect(() => publishDailySchedule({
      home: tempHome,
      date: '08/14/2026',
      kind: 'security-workpad',
      content: 'bad date',
    })).toThrow(/YYYY-MM-DD/);
    expect(() => publishDailySchedule({
      home: tempHome,
      date: '2026-08-14',
      kind: 'security-workpad',
      sourceFile: '/tmp/example.md',
      content: 'ambiguous',
    })).toThrow(/exactly one/);
    expect(readArtifactCatalog(tempHome).entries).toHaveLength(0);
  });
});
