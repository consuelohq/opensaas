import { describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runComparison } from './compare';

describe('bounded production replay comparison', () => {
  it('runs both lanes at each concurrency and writes six private closed reports', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'coaching-comparison-'));
    try {
      const reports = await runComparison(directory, 17);
      expect(reports).toHaveLength(6);
      for (const { path, report } of reports) {
        expect(report.results).toHaveLength(72);
        expect(statSync(path).mode & 0o777).toBe(0o600);
        const json = readFileSync(path, 'utf8');
        expect(JSON.parse(json)).toEqual(report);
        expect(json).not.toContain('premium is too expensive');
        expect(
          report.results.every((result) => result.selectorRequests !== null),
        ).toBe(true);
        if (report.lane === 'rules')
          expect(
            report.results.every((result) => result.selectorRequests === 0),
          ).toBe(true);
      }
      expect(
        reports
          .filter(({ report }) => report.lane === 'mock-selector')
          .some(({ report }) =>
            report.results.some((result) => result.selectorRequests! > 0),
          ),
      ).toBe(true);
      await expect(runComparison(directory, 17)).rejects.toThrow();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
