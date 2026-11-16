import { describe, expect, it } from 'bun:test';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scenarios } from './fixtures';
import { observeScenario } from './observer';
import {
  serializeBenchmark,
  summarizeBenchmark,
  writePrivateReport,
} from './artifact';

describe('private replay artifact', () => {
  it('writes only a closed-schema report, owner-only, without overwriting prior runs', () => {
    const directory = mkdtempSync(join(tmpdir(), 'synthetic-replay-'));
    try {
      const report = {
        schemaVersion: 1 as const,
        seed: 17,
        outcomes: [observeScenario(scenarios[0]!, [])],
      };
      const file = writePrivateReport(directory, report);
      expect(statSync(file).mode & 0o777).toBe(0o600);
      expect(
        JSON.parse(readFileSync(file, 'utf8')).outcomes[0].scenarioId,
      ).toBe('S001');
      expect(() => writePrivateReport(directory, report)).toThrow();
      expect(readFileSync(file, 'utf8')).not.toContain(scenarios[0]!.text);
      const link = join(directory, 'link');
      symlinkSync(directory, link);
      expect(() => writePrivateReport(link, report)).toThrow();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps measured times and lane metadata in a closed benchmark schema', () => {
    const outcome = observeScenario(scenarios[0]!, []);
    const report = {
      schemaVersion: 1 as const,
      seed: 17,
      lane: 'rules' as const,
      concurrency: 1 as const,
      results: [
        {
          scenarioId: outcome.scenarioId,
          outcome,
          ingestWallMs: 2,
          settleWallMs: 3,
          firstCueWallMs: null,
          selectorRequests: null,
        },
      ],
    };
    expect(JSON.parse(serializeBenchmark(report)).results[0].settleWallMs).toBe(
      3,
    );
    expect(() =>
      serializeBenchmark({
        ...report,
        lane: 'customer secret',
      } as unknown as typeof report),
    ).toThrow();
    const tampered = { ...report.results[0]!, arbitrary: 'secret' };
    expect(() =>
      serializeBenchmark({ ...report, results: [tampered] }),
    ).toThrow();
    expect(() =>
      serializeBenchmark({
        ...report,
        results: [{ ...report.results[0]!, settleWallMs: 1 }],
      }),
    ).toThrow();
    expect(summarizeBenchmark(report)).toMatchObject({
      ingestWallMs: { count: 1, p50: 2, p95: 2, p99: 2 },
      selectorRequests: null,
    });
    expect(
      summarizeBenchmark({ ...report, results: [] }).selectorRequests,
    ).toBeNull();
  });
});
