import type { PredictiveModelStore } from '../types';

import { RetryDecisionModel } from './retry-decision-model';

const buildStore = (overrides?: Partial<PredictiveModelStore>): PredictiveModelStore => ({
  getHazardEstimates: async () => [],
  getAnswerProbabilities: async () => [],
  getWorkspaceEconomics: async () => ({
    valuePerConnection: 100,
    costPerAttempt: 0.03,
  }),
  ...overrides,
});

describe('mature retry decision contract', () => {
  it('separates whether to retry from the learned preferred timing window', async () => {
    const model = new RetryDecisionModel(
      buildStore({
        getAnswerProbabilities: async () => [
          { attemptNumber: 3, probability: 0.05 },
        ],
        getHazardEstimates: async () => [
          {
            segmentId: 'high-value',
            attemptNumber: 3,
            hourOfDay: 9,
            dayOfWeek: 1,
            answerRate: 0.25,
            sampleSize: 30,
          },
          {
            segmentId: 'high-value',
            attemptNumber: 3,
            hourOfDay: 15,
            dayOfWeek: 2,
            answerRate: 0.45,
            sampleSize: 25,
          },
        ],
      }),
    );

    await expect(
      model.evaluate({
        workspaceId: 'workspace-1',
        segmentId: 'high-value',
        outcome: 'no_human_answer',
        attemptsUsed: 2,
        maxAttempts: 6,
      }),
    ).resolves.toEqual({
      shouldRetry: true,
      nextAttemptNumber: 3,
      reason: 'positive_expected_value',
      preferredWindow: { hour: 15, dayOfWeek: 2 },
      timingSource: 'learned_hazard',
    });
  });

  it('keeps retrying within the cap when stopping evidence is missing', async () => {
    const model = new RetryDecisionModel(
      buildStore({
        getHazardEstimates: async () => [
          {
            segmentId: 'new-segment',
            attemptNumber: 3,
            hourOfDay: 11,
            dayOfWeek: 3,
            answerRate: 0.5,
            sampleSize: 10,
          },
        ],
      }),
    );

    await expect(
      model.evaluate({
        workspaceId: 'workspace-1',
        segmentId: 'new-segment',
        outcome: 'no_human_answer',
        attemptsUsed: 2,
        maxAttempts: 4,
      }),
    ).resolves.toEqual({
      shouldRetry: true,
      nextAttemptNumber: 3,
      reason: 'insufficient_stopping_data',
      preferredWindow: null,
      timingSource: 'insufficient_hazard_data',
    });
  });

  it('stops on answered calls, the attempt cap, or observed negative expected value', async () => {
    const model = new RetryDecisionModel(
      buildStore({
        getAnswerProbabilities: async () => [
          { attemptNumber: 3, probability: 0.0001 },
        ],
      }),
    );

    await expect(
      model.evaluate({
        workspaceId: 'workspace-1',
        segmentId: 'renewal',
        outcome: 'human_answered',
        attemptsUsed: 1,
        maxAttempts: 4,
      }),
    ).resolves.toMatchObject({
      shouldRetry: false,
      reason: 'answered',
      preferredWindow: null,
      timingSource: 'none',
    });

    await expect(
      model.evaluate({
        workspaceId: 'workspace-1',
        segmentId: 'renewal',
        outcome: 'no_human_answer',
        attemptsUsed: 4,
        maxAttempts: 4,
      }),
    ).resolves.toMatchObject({
      shouldRetry: false,
      reason: 'max_attempts_reached',
    });

    await expect(
      model.evaluate({
        workspaceId: 'workspace-1',
        segmentId: 'renewal',
        outcome: 'no_human_answer',
        attemptsUsed: 2,
        maxAttempts: 4,
      }),
    ).resolves.toMatchObject({
      shouldRetry: false,
      nextAttemptNumber: 3,
      reason: 'expected_value_below_attempt_cost',
      preferredWindow: null,
      timingSource: 'none',
    });
  });
});
