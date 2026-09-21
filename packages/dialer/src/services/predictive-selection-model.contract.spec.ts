import type {
  HazardEstimate,
  PredictiveModelStore,
} from '../types';

import { CadenceOptimizerService } from './cadence-optimizer.service';
import { PredictiveSelectionModel } from './predictive-selection-model';

const buildStore = (overrides?: Partial<PredictiveModelStore>) => {
  const calls = {
    hazards: [] as Array<{
      workspaceId: string;
      segmentId: string;
      attemptNumbers: number[];
    }>,
    probabilities: [] as Array<{ workspaceId: string; segmentId: string }>,
    economics: [] as string[],
  };

  const store: PredictiveModelStore = {
    getHazardEstimates: async (query) => {
      calls.hazards.push(query);
      return [];
    },
    getAnswerProbabilities: async (query) => {
      calls.probabilities.push(query);
      return [];
    },
    getWorkspaceEconomics: async (workspaceId) => {
      calls.economics.push(workspaceId);
      return { valuePerConnection: 100, costPerAttempt: 0.03 };
    },
    ...overrides,
  };

  return { store, calls };
};

describe('mature predictive selection contract', () => {
  it('loads a workspace + segment scoped model and prefers the exact local hazard slot', async () => {
    const hazards: HazardEstimate[] = [
      {
        segmentId: 'hot-lead',
        attemptNumber: 1,
        hourOfDay: 10,
        dayOfWeek: 2,
        answerRate: 0.6,
        sampleSize: 100,
      },
      {
        segmentId: 'hot-lead',
        attemptNumber: 1,
        hourOfDay: 9,
        dayOfWeek: 2,
        answerRate: 0.9,
        sampleSize: 100,
      },
      {
        segmentId: 'hot-lead',
        attemptNumber: 2,
        hourOfDay: 15,
        dayOfWeek: 2,
        answerRate: 0.3,
        sampleSize: 80,
      },
    ];
    const { store, calls } = buildStore({
      getHazardEstimates: async (query) => {
        calls.hazards.push(query);
        return hazards;
      },
      getAnswerProbabilities: async (query) => {
        calls.probabilities.push(query);
        return [
          { attemptNumber: 1, probability: 0.5 },
          { attemptNumber: 2, probability: 0.25 },
        ];
      },
    });

    const result = await new PredictiveSelectionModel(store).rankCandidates({
      workspaceId: 'workspace-1',
      segmentId: 'hot-lead',
      localTimezone: 'UTC',
      callableWindowEndHour: 20,
      evaluatedAt: new Date('2026-04-14T10:00:00.000Z'),
      candidates: [
        {
          contactId: 'attempt-one',
          position: 1,
          attemptsUsed: 0,
          lastAttemptAt: null,
        },
        {
          contactId: 'attempt-two',
          position: 2,
          attemptsUsed: 1,
          lastAttemptAt: null,
        },
      ],
    });

    expect(calls.hazards).toEqual([
      {
        workspaceId: 'workspace-1',
        segmentId: 'hot-lead',
        attemptNumbers: [1, 2],
      },
    ]);
    expect(calls.probabilities).toEqual([
      { workspaceId: 'workspace-1', segmentId: 'hot-lead' },
    ]);
    expect(calls.economics).toEqual(['workspace-1']);
    expect(result.ranked.map((candidate) => candidate.contactId)).toEqual([
      'attempt-one',
      'attempt-two',
    ]);
    expect(result.ranked[0]).toMatchObject({
      contactId: 'attempt-one',
      nextAttemptNumber: 1,
      hazardSource: 'exact_local_slot',
    });
    expect(result.ranked[1]).toMatchObject({
      contactId: 'attempt-two',
      nextAttemptNumber: 2,
      hazardSource: 'attempt_fallback',
    });
  });

  it('suppresses only observed unprofitable attempts after attempt two', async () => {
    const { store } = buildStore({
      getHazardEstimates: async () => [
        {
          segmentId: 'renewal',
          attemptNumber: 3,
          hourOfDay: 10,
          dayOfWeek: 2,
          answerRate: 0.001,
          sampleSize: 100,
        },
        {
          segmentId: 'renewal',
          attemptNumber: 4,
          hourOfDay: 10,
          dayOfWeek: 2,
          answerRate: 0.15,
          sampleSize: 100,
        },
      ],
      getAnswerProbabilities: async () => [
        { attemptNumber: 3, probability: 0.0001 },
      ],
    });

    const result = await new PredictiveSelectionModel(store).rankCandidates({
      workspaceId: 'workspace-1',
      segmentId: 'renewal',
      localTimezone: 'UTC',
      callableWindowEndHour: 20,
      evaluatedAt: new Date('2026-04-14T10:00:00.000Z'),
      candidates: [
        {
          contactId: 'observed-stop',
          position: 1,
          attemptsUsed: 2,
          lastAttemptAt: null,
        },
        {
          contactId: 'missing-history-keeps-exploring',
          position: 2,
          attemptsUsed: 3,
          lastAttemptAt: null,
        },
      ],
    });

    expect(result.suppressed).toEqual([
      {
        contactId: 'observed-stop',
        position: 1,
        nextAttemptNumber: 3,
        reason: 'stopping_model',
        answerProbability: 0.0001,
        answerProbabilityUpperBound: 0.0001,
      },
    ]);
    expect(result.ranked.map((candidate) => candidate.contactId)).toEqual([
      'missing-history-keeps-exploring',
    ]);
  });

  it('uses confidence-aware exploration and FIFO ties without an arbitrary stale penalty', async () => {
    const { store } = buildStore({
      getHazardEstimates: async () => [
        {
          segmentId: 'all',
          attemptNumber: 1,
          hourOfDay: 10,
          dayOfWeek: 2,
          answerRate: 0.2,
          sampleSize: 100,
          lowerBound: 0.133366933,
          upperBound: 0.288829165,
        },
        {
          segmentId: 'all',
          attemptNumber: 2,
          hourOfDay: 10,
          dayOfWeek: 2,
          answerRate: 0.2,
          sampleSize: 5,
          lowerBound: 0.036224109,
          upperBound: 0.62446537,
        },
      ],
    });

    const result = await new PredictiveSelectionModel(store).rankCandidates({
      workspaceId: 'workspace-1',
      segmentId: 'all',
      localTimezone: 'UTC',
      callableWindowEndHour: 20,
      evaluatedAt: new Date('2026-04-14T10:00:00.000Z'),
      candidates: [
        {
          contactId: 'dense-recent',
          position: 2,
          attemptsUsed: 0,
          lastAttemptAt: new Date('2026-04-14T09:00:00.000Z'),
        },
        {
          contactId: 'sparse-explore',
          position: 3,
          attemptsUsed: 1,
          lastAttemptAt: null,
        },
        {
          contactId: 'dense-stale',
          position: 1,
          attemptsUsed: 0,
          lastAttemptAt: new Date('2026-04-11T09:00:00.000Z'),
        },
      ],
    });

    expect(result.ranked.map((candidate) => candidate.contactId)).toEqual([
      'sparse-explore',
      'dense-stale',
      'dense-recent',
    ]);
    const denseStale = result.ranked.find(
      (candidate) => candidate.contactId === 'dense-stale',
    );
    const denseRecent = result.ranked.find(
      (candidate) => candidate.contactId === 'dense-recent',
    );
    expect(denseStale?.score).toBeCloseTo(denseRecent?.score ?? Number.NaN, 12);
    expect(denseStale && 'staleDecayFactor' in denseStale).toBe(false);
  });
});

describe('mature cadence contract', () => {
  it('keeps provider-neutral age buckets and sparse-data fallback behavior', () => {
    const service = new CadenceOptimizerService();
    const learned = service.computeCadencePolicy({
      segmentId: 'hot-lead:fresh',
      ageBucket: 'fresh',
      hazardEstimates: [
        {
          segmentId: 'hot-lead:fresh',
          attemptNumber: 1,
          hourOfDay: 9,
          dayOfWeek: 1,
          answerRate: 0.3,
          sampleSize: 60,
        },
      ],
      economics: { valuePerConnection: 100, costPerAttempt: 0.03 },
    });
    const sparse = service.computeCadencePolicy({
      segmentId: 'hot-lead:aged',
      ageBucket: 'aged',
      hazardEstimates: [
        {
          segmentId: 'hot-lead:aged',
          attemptNumber: 1,
          hourOfDay: 9,
          dayOfWeek: 1,
          answerRate: 0.3,
          sampleSize: 10,
        },
      ],
      economics: { valuePerConnection: 100, costPerAttempt: 0.03 },
    });

    expect(learned.source).toBe('learned');
    expect(learned.maxAttemptsPerDay).toBeLessThanOrEqual(2);
    expect(sparse).toMatchObject({
      source: 'static_fallback',
      ageBucket: 'aged',
      maxAttemptsPerDay: 4,
      minSpacingMinutes: 120,
    });
  });
});
