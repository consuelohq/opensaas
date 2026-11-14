import { describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scenarios } from './fixtures';
import { observeScenario } from './observer';
import {
  serializeProviderReport,
  writePrivateProviderReport,
  type ProviderReport,
} from './provider-artifact';
describe('provider result artifact', () => {
  it('is closed, bounded, private, and excludes transcript text', () => {
    const outcome = observeScenario(scenarios[0]!, []);
    const report: ProviderReport = {
      schemaVersion: 1,
      lane: 'provider-synthetic',
      fingerprint: 'a'.repeat(64),
      seed: 17,
      logicalConcurrency: 20,
      maxRequests: 1,
      reservationPerRequestNanoUsd: 5,
      attempts: 1,
      reservedNanoUsd: 5,
      spentNanoUsd: 0,
      maxReservedNanoUsd: 5,
      settlements: 0,
      halted: false,
      physicalUnsettled: 0,
      queuedAtFinish: 0,
      unreconciledCharges: 1,
      refused: 0,
      metadataResponses: 0,
      promptTokenReports: 0,
      promptTokensReported: null,
      completionTokenReports: 0,
      completionTokensReported: null,
      costReports: 0,
      results: [
        {
          scenarioId: outcome.scenarioId,
          outcome,
          wallOutcome: outcome,
          ingestWallMs: 1,
          settleWallMs: 2,
          firstCueWallMs: null,
          selectorRequests: 1,
          selectorMetrics: {
            discards: 0,
            failures: 0,
            checkpoints: 0,
            queueRejected: 0,
          },
        },
      ],
    };
    const directory = mkdtempSync(join(tmpdir(), 'provider-report-'));
    try {
      const path = writePrivateProviderReport(directory, report);
      expect(statSync(path).mode & 0o777).toBe(0o600);
      expect(readFileSync(path, 'utf8')).not.toContain(scenarios[0]!.text);
      expect(() => writePrivateProviderReport(directory, report)).toThrow();
      expect(() =>
        serializeProviderReport({
          ...report,
          rawPrompt: 'secret',
        } as ProviderReport),
      ).toThrow();
      expect(() =>
        serializeProviderReport({ ...report, unreconciledCharges: 0 }),
      ).toThrow();
      expect(() =>
        serializeProviderReport({
          ...report,
          results: [{ ...report.results[0]!, scenarioId: 'raw transcript' }],
        }),
      ).toThrow();
      expect(() =>
        serializeProviderReport({
          ...report,
          results: [
            {
              ...report.results[0]!,
              wallOutcome: { ...outcome, firstCueMs: 6000 },
            },
          ],
        }),
      ).toThrow();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
