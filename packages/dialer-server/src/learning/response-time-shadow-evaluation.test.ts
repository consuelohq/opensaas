import { describe, expect, it } from 'bun:test';

import type { LeadConnectorDatabase } from '@consuelo/lead-connector';
import { evaluateResponseTimeHazardShadow } from './response-time-shadow-evaluation';

const decisionContext = (localHour: number) => ({
  schemaVersion: 2,
  capturedAt: '2026-08-15T12:00:00.000Z',
  timezone: 'UTC',
  timezoneSource: 'workspace_fallback',
  localHour,
  localDayOfWeek: 6,
  attemptsUsed: 0,
  attemptsToday: 0,
  attemptsThisWeek: 0,
  minutesSinceLastAttempt: null,
  localPresenceRequested: true,
  source: { opportunityValue: 500, opportunityStatus: 'open' },
  d3: {
    nextAttemptNumber: 1,
    answerProbability: 0.5,
    answerProbabilityUpperBound: 0.7,
    score: 69,
    hazardSource: 'exact_local_slot',
    suppressed: false,
  },
});

type ResponseTimeFixtureRow = {
  attempted_at: string;
  response_at: string | null;
  observed_until_at: string;
  outcome_class: string;
  censor_reason: string | null;
  decision_context: ReturnType<typeof decisionContext>;
};

const createRows = (count: number) =>
  Array.from({ length: count }, (_, index): ResponseTimeFixtureRow => {
    const attemptedAt = new Date(Date.UTC(2026, 7, 1, 0, index)).getTime();
    const highResponseContext = index % 2 === 0;
    if (highResponseContext) {
      return {
        attempted_at: new Date(attemptedAt).toISOString(),
        response_at: new Date(attemptedAt + 4_000).toISOString(),
        observed_until_at: new Date(attemptedAt + 4_000).toISOString(),
        outcome_class: 'response',
        censor_reason: null,
        decision_context: decisionContext(11),
      };
    }
    return {
      attempted_at: new Date(attemptedAt).toISOString(),
      response_at: null,
      observed_until_at: new Date(attemptedAt + 20_000).toISOString(),
      outcome_class: 'non_response',
      censor_reason: null,
      decision_context: decisionContext(3),
    };
  });

describe('response-time hazard shadow evaluation', () => {
  it('trains on event-time evidence and evaluates response-by-horizon only when the holdout outcome is observed', async () => {
    const rows = createRows(200);
    rows[181] = {
      ...rows[181]!,
      observed_until_at: new Date(
        new Date(rows[181]!.attempted_at).getTime() + 6_000,
      ).toISOString(),
      outcome_class: 'censored',
      censor_reason: 'competing_winner',
    };
    const calls: Array<{ text: string; values: readonly unknown[] }> = [];
    const database: LeadConnectorDatabase = {
      query: async <T>(text: string, values: readonly unknown[] = []) => {
        calls.push({ text, values });
        return { rows: rows as T[] };
      },
    };

    const report = await evaluateResponseTimeHazardShadow(database, {
      workspaceId: 'workspace-1',
      segmentId: 'segment-1',
      minSampleSize: 100,
      trainingFraction: 0.8,
      intervalMs: 5_000,
      horizonMs: 20_000,
    });

    expect(report.status).toBe('evaluated');
    if (report.status !== 'evaluated') return;
    expect(report.trainingSampleSize).toBe(160);
    expect(report.holdoutSampleSize).toBe(40);
    expect(report.earlyCensoredHoldoutCount).toBe(1);
    expect(report.evaluableHoldoutSampleSize).toBe(39);
    expect(report.metrics.brierScore).toBeLessThan(0.15);
    expect(report.calibration.length).toBeGreaterThan(0);
    expect(Number.isFinite(report.predictionDriftPsi)).toBe(true);

    const query = calls[0]!;
    expect(query.text).toContain('response_at');
    expect(query.text).toContain('observed_until_at');
    expect(query.text).toContain('feature_schema_version = 2');
    expect(query.text).toContain('ORDER BY attempted_at');
    expect(query.values).toEqual(['workspace-1', 'segment-1']);
  });

  it('reports insufficient data instead of fitting a survival model on a tiny sample', async () => {
    const database: LeadConnectorDatabase = {
      query: async <T>() => ({ rows: createRows(20) as T[] }),
    };

    await expect(
      evaluateResponseTimeHazardShadow(database, {
        workspaceId: 'workspace-1',
        segmentId: 'segment-1',
        minSampleSize: 100,
        intervalMs: 5_000,
        horizonMs: 20_000,
      }),
    ).resolves.toEqual({
      status: 'insufficient_data',
      sampleSize: 20,
      requiredSampleSize: 100,
    });
  });
});
