jest.mock(
  '@consuelo/dialer',
  () => ({
    StoppingModelService: class {
      private readonly store: {
        getAnswerProbabilities: (segmentId: string) => Promise<
          { attemptNumber: number; probability: number }[]
        >;
        getWorkspaceEconomics: (workspaceId: string) => Promise<{
          valuePerConnection: number;
          costPerAttempt: number;
        }>;
      };

      constructor(store: {
        getAnswerProbabilities: (segmentId: string) => Promise<
          { attemptNumber: number; probability: number }[]
        >;
        getWorkspaceEconomics: (workspaceId: string) => Promise<{
          valuePerConnection: number;
          costPerAttempt: number;
        }>;
      }) {
        this.store = store;
      }

      async getThresholdForAttempt(input: {
        workspaceId: string;
        segmentId: string;
        attemptNumber: number;
      }) {
        const answerProbabilities = await this.store.getAnswerProbabilities(
          input.segmentId,
        );
        const economics = await this.store.getWorkspaceEconomics(input.workspaceId);
        const attemptProbability =
          answerProbabilities.find(
            (item: { attemptNumber: number }) =>
              item.attemptNumber === input.attemptNumber,
          )?.probability ?? null;

        if (attemptProbability === null) {
          return null;
        }

        const expectedValue = attemptProbability * economics.valuePerConnection;

        return {
          attemptNumber: input.attemptNumber,
          answerProbability: attemptProbability,
          expectedValue,
          shouldStop: input.attemptNumber > 2 && expectedValue < economics.costPerAttempt,
        };
      }
    },
  }),
  { virtual: true },
);

import type { StoppingModelStore } from '@consuelo/dialer';

import { evaluateRetryPolicy } from 'src/engine/core-modules/consuelo-api/services/retry-policy';

describe('evaluateRetryPolicy', () => {
  const baseInput = {
    workspaceId: 'workspace-1',
    segmentId: 'segment-1',
    outcome: 'no-answer',
    isHighPriority: true,
    attemptsUsed: 1,
    maxAttempts: 3,
    localTimezone: 'America/New_York',
    evaluatedAt: new Date('2026-01-01T15:00:00.000Z'),
  };

  const defaultStore: StoppingModelStore = {
    getAnswerProbabilities: jest.fn().mockResolvedValue([
      { attemptNumber: 2, probability: 0.05 },
    ]),
    getWorkspaceEconomics: jest.fn().mockResolvedValue({
      valuePerConnection: 100,
      costPerAttempt: 0.03,
    }),
  };

  it('should retry when expected value is positive', async () => {
    const result = await evaluateRetryPolicy(baseInput, defaultStore);

    expect(result.shouldRetry).toBe(true);
    expect(result.retryStrategy).toBe('double-dial-no-answer');
  });

  it('should stop retrying when expected value is negative', async () => {
    const store: StoppingModelStore = {
      getAnswerProbabilities: jest
        .fn()
        .mockResolvedValue([{ attemptNumber: 3, probability: 0.0001 }]),
      getWorkspaceEconomics: jest.fn().mockResolvedValue({
        valuePerConnection: 100,
        costPerAttempt: 0.03,
      }),
    };

    const result = await evaluateRetryPolicy(
      { ...baseInput, attemptsUsed: 2 },
      store,
    );

    expect(result).toMatchObject({
      shouldRetry: false,
      retryReason: 'expected_value_below_attempt_cost',
    });
  });

  it('should fallback to max attempt cap behavior when stopping data is missing', async () => {
    const store: StoppingModelStore = {
      getAnswerProbabilities: jest.fn().mockResolvedValue([]),
      getWorkspaceEconomics: jest.fn().mockResolvedValue({
        valuePerConnection: 100,
        costPerAttempt: 0.03,
      }),
    };

    const result = await evaluateRetryPolicy(baseInput, store);

    expect(result.shouldRetry).toBe(true);
  });
});
