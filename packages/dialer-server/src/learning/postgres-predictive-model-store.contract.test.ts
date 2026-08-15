import { describe, expect, it } from 'bun:test';

import { createPostgresPredictiveModelStore } from './postgres-predictive-model-store';

type QueryCall = { text: string; values: readonly unknown[] };

const createDatabase = () => {
  const calls: QueryCall[] = [];
  return {
    calls,
    database: {
      query: async <T>(text: string, values: readonly unknown[] = []) => {
        calls.push({ text, values });
        if (text.includes('FROM dialer_workspace_settings')) {
          return {
            rows: [
              {
                avg_deal_value: '2500',
                avg_close_rate: '0.08',
                cost_per_attempt: '0.03',
              },
            ] as T[],
          };
        }
        if (text.includes('local_hour') && text.includes('local_day_of_week')) {
          return {
            rows: [
              {
                attempt_number: '2',
                local_hour: '10',
                local_day_of_week: '3',
                successes: '8',
                trials: '20',
              },
            ] as T[],
          };
        }
        return {
          rows: [
            { attempt_number: '1', successes: '3', trials: '10' },
            { attempt_number: '2', successes: '8', trials: '20' },
          ] as T[],
        };
      },
    },
  };
};

describe('Postgres predictive model store contract', () => {
  it('derives attempt order chronologically before excluding censored outcomes', async () => {
    const harness = createDatabase();
    const store = createPostgresPredictiveModelStore(harness.database);

    const estimates = await store.getAnswerProbabilities({
      workspaceId: 'workspace-1',
      segmentId: 'segment-1',
    });

    expect(estimates[0]).toMatchObject({
      attemptNumber: 1,
      probability: 0.3,
      successes: 3,
      trials: 10,
    });
    expect(estimates[0]!.lowerBound).toBeLessThan(0.3);
    expect(estimates[0]!.upperBound).toBeGreaterThan(0.3);

    const statement = harness.calls.find((call) =>
      call.text.includes('ROW_NUMBER() OVER'),
    );
    expect(statement?.text).toContain('PARTITION BY workspace_id, contact_id');
    expect(statement?.text).toContain('ORDER BY attempted_at, group_id, position');
    expect(statement?.text).toContain(
      "COUNT(*) FILTER (WHERE outcome_class = 'response')",
    );
    expect(statement?.text).toContain(
      "outcome_class IN ('response', 'non_response')",
    );
    expect(statement?.values).toEqual(['workspace-1', 'segment-1']);
  });

  it('uses stored local calendar bins and returns Wilson evidence for requested attempts', async () => {
    const harness = createDatabase();
    const store = createPostgresPredictiveModelStore(harness.database);

    const hazards = await store.getHazardEstimates({
      workspaceId: 'workspace-1',
      segmentId: 'segment-1',
      attemptNumbers: [2],
    });

    expect(hazards).toHaveLength(1);
    expect(hazards[0]).toMatchObject({
      segmentId: 'segment-1',
      attemptNumber: 2,
      hourOfDay: 10,
      dayOfWeek: 3,
      answerRate: 0.4,
      sampleSize: 20,
      successes: 8,
      trials: 20,
    });
    expect(hazards[0]!.lowerBound).toBeLessThan(0.4);
    expect(hazards[0]!.upperBound).toBeGreaterThan(0.4);

    const statement = harness.calls.find((call) =>
      call.text.includes('local_hour') && call.text.includes('local_day_of_week'),
    );
    expect(statement?.text).toContain('local_hour');
    expect(statement?.text).toContain('local_day_of_week');
    expect(statement?.text).not.toContain('AT TIME ZONE');
    expect(statement?.values).toEqual(['workspace-1', 'segment-1', [2]]);
  });

  it('maps configured workspace economics without provider-specific model state', async () => {
    const harness = createDatabase();
    const store = createPostgresPredictiveModelStore(harness.database);

    await expect(store.getWorkspaceEconomics('workspace-1')).resolves.toEqual({
      valuePerConnection: 200,
      costPerAttempt: 0.03,
    });
  });

  it('fails instead of inventing economics when workspace evidence is absent', async () => {
    const store = createPostgresPredictiveModelStore({
      query: async <T>() => ({ rows: [] as T[] }),
    });

    await expect(store.getWorkspaceEconomics('workspace-missing')).rejects.toThrow(
      'Failed to load configured workspace dialer economics',
    );
  });
});
