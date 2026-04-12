import type { StoppingModelStore, StoppingThreshold } from '../types.js';

const MIN_ATTEMPTS_BEFORE_STOP = 2;

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
    const answerProbabilities = await this.store.getAnswerProbabilities(
      input.segmentId,
    );
    const economics = await this.store.getWorkspaceEconomics(input.workspaceId);

    const probabilityByAttempt = new Map<number, number>(
      answerProbabilities.map((item) => [item.attemptNumber, item.probability]),
    );

    const thresholds: StoppingThreshold[] = [];

    for (let attemptNumber = 1; attemptNumber <= input.maxAttempts; attemptNumber += 1) {
      const answerProbability = probabilityByAttempt.get(attemptNumber) ?? 0;
      const expectedValue = answerProbability * economics.valuePerConnection;
      const shouldStop =
        attemptNumber > MIN_ATTEMPTS_BEFORE_STOP &&
        expectedValue < economics.costPerAttempt;

      thresholds.push({
        segmentId: input.segmentId,
        attemptNumber,
        answerProbability,
        expectedValue,
        shouldStop,
      });
    }

    return thresholds;
  }

  async getThresholdForAttempt(input: {
    workspaceId: string;
    segmentId: string;
    attemptNumber: number;
    maxAttempts: number;
  }): Promise<StoppingThreshold | null> {
    const thresholds = await this.getStoppingThresholds({
      workspaceId: input.workspaceId,
      segmentId: input.segmentId,
      maxAttempts: input.maxAttempts,
    });

    return (
      thresholds.find((threshold) => threshold.attemptNumber === input.attemptNumber) ??
      null
    );
  }
}
