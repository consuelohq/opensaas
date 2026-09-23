import type { PredictiveModelStore } from '../types';
import { PredictiveSelectionModel } from './predictive-selection-model';

const store = (overrides: Partial<PredictiveModelStore>): PredictiveModelStore => ({
  getHazardEstimates: async () => [],
  getAnswerProbabilities: async () => [],
  getWorkspaceEconomics: async () => ({
    valuePerConnection: 100,
    costPerAttempt: 1,
  }),
  ...overrides,
});

describe('scientific predictive selection contract', () => {
  it('uses calibrated upper probability evidence for exploration rather than an arbitrary sample-size bonus', async () => {
    const model = new PredictiveSelectionModel(
      store({
        getHazardEstimates: async () => [
          {
            segmentId: 'segment-1',
            attemptNumber: 1,
            hourOfDay: 12,
            dayOfWeek: 6,
            answerRate: 0.2,
            sampleSize: 100,
            lowerBound: 0.133366933,
            upperBound: 0.288829165,
          },
          {
            segmentId: 'segment-1',
            attemptNumber: 2,
            hourOfDay: 12,
            dayOfWeek: 6,
            answerRate: 0.2,
            sampleSize: 5,
            lowerBound: 0.036224109,
            upperBound: 0.62446537,
          },
        ],
      }),
    );

    const result = await model.rankCandidates({
      workspaceId: 'workspace-1',
      segmentId: 'segment-1',
      localTimezone: 'UTC',
      callableWindowEndHour: 20,
      evaluatedAt: new Date('2026-08-15T12:00:00.000Z'),
      candidates: [
        {
          contactId: 'dense',
          position: 1,
          attemptsUsed: 0,
          lastAttemptAt: null,
        },
        {
          contactId: 'uncertain',
          position: 2,
          attemptsUsed: 1,
          lastAttemptAt: null,
        },
      ],
    });

    expect(result.ranked.map((candidate) => candidate.contactId)).toEqual([
      'uncertain',
      'dense',
    ]);
    expect(result.ranked[0]!.score).toBeGreaterThan(result.ranked[1]!.score);
  });

  it('does not change an otherwise identical priority because a contact is older than 48 hours', async () => {
    const model = new PredictiveSelectionModel(
      store({
        getHazardEstimates: async () => [
          {
            segmentId: 'segment-1',
            attemptNumber: 1,
            hourOfDay: 12,
            dayOfWeek: 6,
            answerRate: 0.25,
            sampleSize: 100,
            lowerBound: 0.175452,
            upperBound: 0.343044,
          },
        ],
      }),
    );

    const result = await model.rankCandidates({
      workspaceId: 'workspace-1',
      segmentId: 'segment-1',
      localTimezone: 'UTC',
      callableWindowEndHour: 20,
      evaluatedAt: new Date('2026-08-15T12:00:00.000Z'),
      candidates: [
        {
          contactId: 'stale-first',
          position: 1,
          attemptsUsed: 0,
          lastAttemptAt: new Date('2026-08-10T12:00:00.000Z'),
        },
        {
          contactId: 'recent-second',
          position: 2,
          attemptsUsed: 0,
          lastAttemptAt: new Date('2026-08-15T11:00:00.000Z'),
        },
      ],
    });

    expect(result.ranked.map((candidate) => candidate.contactId)).toEqual([
      'stale-first',
      'recent-second',
    ]);
    expect(result.ranked[0]!.score).toBeCloseTo(result.ranked[1]!.score, 12);
    expect('staleDecayFactor' in result.ranked[0]!).toBe(false);
  });

  it('preserves FIFO for a decision set when any candidate lacks comparable hazard evidence', async () => {
    const model = new PredictiveSelectionModel(
      store({
        getHazardEstimates: async () => [
          {
            segmentId: 'segment-1',
            attemptNumber: 1,
            hourOfDay: 12,
            dayOfWeek: 6,
            answerRate: 0.2,
            sampleSize: 100,
            lowerBound: 0.133366933,
            upperBound: 0.288829165,
          },
        ],
      }),
    );

    const result = await model.rankCandidates({
      workspaceId: 'workspace-1',
      segmentId: 'segment-1',
      localTimezone: 'UTC',
      callableWindowEndHour: 20,
      evaluatedAt: new Date('2026-08-15T12:00:00.000Z'),
      candidates: [
        { contactId: 'supported-first', position: 1, attemptsUsed: 0, lastAttemptAt: null },
        { contactId: 'missing-second', position: 2, attemptsUsed: 1, lastAttemptAt: null },
      ],
    });

    expect(result.ranked.map((candidate) => candidate.contactId)).toEqual([
      'supported-first',
      'missing-second',
    ]);
    expect(result.ranked[1]).toMatchObject({
      hazardSource: 'missing',
      answerProbability: 0,
    });
  });

});

  it('uses aggregate attempt evidence rather than a peak slot for an unobserved calling time', async () => {
    const model = new PredictiveSelectionModel(store({
      getHazardEstimates: async () => [{ segmentId: 'segment-1', attemptNumber: 1,
        hourOfDay: 18, dayOfWeek: 6, answerRate: 0.9, sampleSize: 10, upperBound: 0.99 }],
      getAnswerProbabilities: async () => [{ attemptNumber: 1, probability: 0.2,
        trials: 100, upperBound: 0.29 }],
    }));
    const result = await model.rankCandidates({ workspaceId: 'workspace-1', segmentId: 'segment-1',
      localTimezone: 'UTC', callableWindowEndHour: 20, evaluatedAt: new Date('2026-08-15T12:00:00.000Z'),
      candidates: [{ contactId: 'contact', position: 1, attemptsUsed: 0, lastAttemptAt: null }] });
    expect(result.ranked[0]).toMatchObject({ hazardSource: 'attempt_fallback',
      answerProbability: 0.2, answerProbabilityUpperBound: 0.29 });
  });
