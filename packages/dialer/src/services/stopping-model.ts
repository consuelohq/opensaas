import type { StoppingModelStore, StoppingThreshold } from '../types.js';

const MIN_ATTEMPTS_BEFORE_STOP = 2;

export const evaluateStoppingThreshold = (input: {
  segmentId: string;
  attemptNumber: number;
  answerProbability: number | undefined;
  answerProbabilityUpperBound?: number;
  valuePerConnection: number;
  costPerAttempt: number;
}): StoppingThreshold | null => {
  if (input.answerProbability === undefined) {
    return null;
  }

  const expectedValue = input.answerProbability * input.valuePerConnection;
  const decisionProbability =
    input.answerProbabilityUpperBound ?? input.answerProbability;
  const decisionExpectedValue =
    decisionProbability * input.valuePerConnection;

  return {
    segmentId: input.segmentId,
    attemptNumber: input.attemptNumber,
    answerProbability: input.answerProbability,
    expectedValue,
    decisionProbability,
    decisionExpectedValue,
    shouldStop:
      input.attemptNumber > MIN_ATTEMPTS_BEFORE_STOP &&
      decisionExpectedValue < input.costPerAttempt,
  };
};

export type StoppingModelInput = {
  workspaceId: string;
  segmentId: string;
  maxAttempts: number;
};

export class StoppingModelService {
  constructor(private readonly store: StoppingModelStore) {}

  async getStoppingThresholds(
    input: StoppingModelInput,
  ): Promise<StoppingThreshold[]> {
    try {
      const answerProbabilities = await this.store.getAnswerProbabilities(
        input.segmentId,
      );
      const economics = await this.store.getWorkspaceEconomics(input.workspaceId);

      const probabilityByAttempt = new Map<
        number,
        (typeof answerProbabilities)[number]
      >();
      for (const item of answerProbabilities) {
        probabilityByAttempt.set(item.attemptNumber, item);
      }

      const thresholds: StoppingThreshold[] = [];

      for (
        let attemptNumber = 1;
        attemptNumber <= input.maxAttempts;
        attemptNumber += 1
      ) {
        const evidence = probabilityByAttempt.get(attemptNumber);
        const threshold = evaluateStoppingThreshold({
          segmentId: input.segmentId,
          attemptNumber,
          answerProbability: evidence?.probability,
          answerProbabilityUpperBound: evidence?.upperBound,
          valuePerConnection: economics.valuePerConnection,
          costPerAttempt: economics.costPerAttempt,
        });

        if (threshold) {
          thresholds.push(threshold);
        }
      }

      return thresholds;
    } catch (cause: unknown) {
      throw new Error('Failed to calculate stopping thresholds', { cause });
    }
  }

  async getThresholdForAttempt(input: {
    workspaceId: string;
    segmentId: string;
    attemptNumber: number;
    maxAttempts: number;
  }): Promise<StoppingThreshold | null> {
    try {
      const answerProbabilities = await this.store.getAnswerProbabilities(
        input.segmentId,
      );
      const economics = await this.store.getWorkspaceEconomics(input.workspaceId);

      const probabilityByAttempt = new Map<
        number,
        (typeof answerProbabilities)[number]
      >();
      for (const item of answerProbabilities) {
        probabilityByAttempt.set(item.attemptNumber, item);
      }

      const evidence = probabilityByAttempt.get(input.attemptNumber);

      return evaluateStoppingThreshold({
        segmentId: input.segmentId,
        attemptNumber: input.attemptNumber,
        answerProbability: evidence?.probability,
        answerProbabilityUpperBound: evidence?.upperBound,
        valuePerConnection: economics.valuePerConnection,
        costPerAttempt: economics.costPerAttempt,
      });
    } catch (cause: unknown) {
      throw new Error('Failed to calculate stopping threshold for attempt', {
        cause,
      });
    }
  }
}
