import { describe, expect, it } from 'bun:test';

import type { LeadConnectorDatabase } from '@consuelo/lead-connector';
import { evaluateContextualPredictiveShadow } from './contextual-shadow-evaluation';

const context = (input: {
  capturedAt: string;
  localHour: number;
  d3Probability: number;
  hazardSource?: 'exact_local_slot' | 'attempt_fallback' | 'missing';
}) => ({
  schemaVersion: 2,
  capturedAt: input.capturedAt,
  timezone: 'UTC',
  timezoneSource: 'workspace_fallback',
  localHour: input.localHour,
  localDayOfWeek: 6,
  attemptsUsed: 0,
  attemptsToday: 0,
  attemptsThisWeek: 0,
  minutesSinceLastAttempt: null,
  localPresenceRequested: true,
  source: {
    pipelineId: 'pipeline-1',
    stageId: 'stage-1',
    opportunityStatus: 'open',
    opportunityValue: input.localHour === 11 ? 1_000 : 500,
  },
  d3: {
    nextAttemptNumber: 1,
    answerProbability: input.d3Probability,
    answerProbabilityUpperBound: Math.min(input.d3Probability + 0.1, 1),
    score: input.d3Probability * 100,
    hazardSource: input.hazardSource ?? 'exact_local_slot',
    suppressed: false,
  },
});

const createRows = (count: number) =>
  Array.from({ length: count }, (_, index) => {
    const highResponseContext = index % 2 === 0;
    const attemptedAt = new Date(
      Date.UTC(2026, 7, 1, 0, index),
    ).toISOString();
    return {
      attempted_at: attemptedAt,
      outcome_class: highResponseContext ? 'response' : 'non_response',
      decision_context: context({
        capturedAt: attemptedAt,
        localHour: highResponseContext ? 11 : 3,
        d3Probability: 0.5,
      }),
    };
  });

describe('contextual predictive shadow evaluation', () => {
  it('trains only on earlier observations and evaluates the D4 challenger against D3 on holdout data', async () => {
    const calls: Array<{ text: string; values: readonly unknown[] }> = [];
    const database: LeadConnectorDatabase = {
      query: async <T>(text: string, values: readonly unknown[] = []) => {
        calls.push({ text, values });
        if (text.includes('FROM dialer_learning_observations')) {
          return { rows: createRows(200) as T[] };
        }
        if (text.includes('FROM dialer_workspace_settings')) {
          return {
            rows: [
              { avg_close_rate: '0.2', cost_per_attempt: '2' },
            ] as T[],
          };
        }
        return { rows: [] as T[] };
      },
    };

    const report = await evaluateContextualPredictiveShadow(database, {
      workspaceId: 'workspace-1',
      segmentId: 'segment-1',
      minSampleSize: 100,
      trainingFraction: 0.8,
    });

    expect(report.status).toBe('evaluated');
    if (report.status !== 'evaluated') return;
    expect(report.comparison).not.toBeNull();
    if (!report.comparison) {
      throw new Error('synthetic holdout must have comparable D3 forecasts');
    }
    expect(report.trainingSampleSize).toBe(160);
    expect(report.holdoutSampleSize).toBe(40);
    expect(report.comparison.challenger.brierScore).toBeLessThan(
      report.comparison.control.brierScore,
    );
    expect(report.comparison.brierImprovement).toBeGreaterThan(0);
    expect(report.calibration.length).toBeGreaterThan(0);
    expect(Number.isFinite(report.predictionDriftPsi)).toBe(true);
    expect(report.candidateEconomics).toEqual(
      expect.objectContaining({
        sampleSize: 40,
        closeRate: 0.2,
        costPerAttempt: 2,
      }),
    );
    if (!report.candidateEconomics?.challenger) {
      throw new Error('synthetic holdout must have candidate economics');
    }
    expect(
      report.candidateEconomics.challenger.valueWeightedBrier ?? 1,
    ).toBeLessThan(report.candidateEconomics.control?.valueWeightedBrier ?? 1);
    expect(
      Number.isFinite(
        report.candidateEconomics.challenger.meanExpectedNetValue,
      ),
    ).toBe(true);

    const observationQuery = calls.find((call) =>
      call.text.includes('FROM dialer_learning_observations'),
    );
    expect(observationQuery?.text).toContain('feature_schema_version = 2');
    expect(observationQuery?.text).toContain('decision_context IS NOT NULL');
    expect(observationQuery?.text).toContain(
      "outcome_class IN ('response', 'non_response')",
    );
    expect(observationQuery?.text).toContain('ORDER BY attempted_at');
    expect(observationQuery?.values).toEqual(['workspace-1', 'segment-1']);
  });

  it('refuses to manufacture challenger evidence from a tiny sample', async () => {
    const database: LeadConnectorDatabase = {
      query: async <T>() => ({ rows: createRows(20) as T[] }),
    };

    await expect(
      evaluateContextualPredictiveShadow(database, {
        workspaceId: 'workspace-1',
        segmentId: 'segment-1',
        minSampleSize: 100,
      }),
    ).resolves.toEqual({
      status: 'insufficient_data',
      sampleSize: 20,
      requiredSampleSize: 100,
    });
  });

  it('does not score D3 missing evidence as a zero-probability control forecast', async () => {
    const rows = createRows(100).map((row) => ({
      ...row,
      decision_context: {
        ...(row.decision_context as ReturnType<typeof context>),
        d3: {
          ...(row.decision_context as ReturnType<typeof context>).d3,
          answerProbability: 0,
          answerProbabilityUpperBound: 1,
          hazardSource: 'missing' as const,
        },
      },
    }));
    const database: LeadConnectorDatabase = {
      query: async <T>(text: string) =>
        text.includes('FROM dialer_workspace_settings')
          ? ({
              rows: [
                { avg_close_rate: '0.2', cost_per_attempt: '2' },
              ] as T[],
            } as { rows: T[] })
          : ({ rows: rows as T[] } as { rows: T[] }),
    };

    const report = await evaluateContextualPredictiveShadow(database, {
      workspaceId: 'workspace-1',
      segmentId: 'segment-1',
      minSampleSize: 100,
    });

    expect(report.status).toBe('evaluated');
    if (report.status !== 'evaluated') return;
    expect(report.controlComparableSampleSize).toBe(0);
    expect(report.comparison).toBeNull();
    expect(report.calibration.length).toBeGreaterThan(0);
    expect(report.candidateEconomics?.control).toBeNull();
  });
});
