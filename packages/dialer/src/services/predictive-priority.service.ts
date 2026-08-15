import type {
  PredictivePriorityInput,
  PredictivePriorityResult,
} from '../types.js';

const assertProbability = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a finite probability in [0, 1]`);
  }
};

const assertNonNegativeFinite = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number`);
  }
};

export class PredictivePriorityService {
  computePriority(input: PredictivePriorityInput): PredictivePriorityResult {
    assertProbability('answerProbability', input.answerProbability);
    const upperBound =
      input.answerProbabilityUpperBound ?? input.answerProbability;
    assertProbability('answerProbabilityUpperBound', upperBound);
    if (upperBound < input.answerProbability) {
      throw new RangeError(
        'answerProbabilityUpperBound must not be below answerProbability',
      );
    }
    assertNonNegativeFinite('valuePerConnection', input.valuePerConnection);
    assertNonNegativeFinite('costPerAttempt', input.costPerAttempt);

    const expectedReward =
      input.answerProbability * input.valuePerConnection;
    const optimisticReward = upperBound * input.valuePerConnection;
    const uncertaintyBonus = optimisticReward - expectedReward;

    return {
      score: optimisticReward - input.costPerAttempt,
      components: {
        expectedReward,
        optimisticReward,
        uncertaintyBonus,
        cost: input.costPerAttempt,
      },
    };
  }
}
