import type { BernoulliEstimate } from '../types.js';

const STANDARD_NORMAL_95_PERCENT = 1.959963984540054;

const assertCount = (name: string, value: number): void => {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
};

export const estimateBernoulliWilson = (
  successes: number,
  trials: number,
): BernoulliEstimate | null => {
  assertCount('successes', successes);
  assertCount('trials', trials);
  if (successes > trials) {
    throw new RangeError('successes must not exceed trials');
  }
  if (trials === 0) {
    return null;
  }

  const probability = successes / trials;
  const zSquared = STANDARD_NORMAL_95_PERCENT ** 2;
  const denominator = 1 + zSquared / trials;
  const center =
    (probability + zSquared / (2 * trials)) / denominator;
  const margin =
    (STANDARD_NORMAL_95_PERCENT *
      Math.sqrt(
        (probability * (1 - probability)) / trials +
          zSquared / (4 * trials ** 2),
      )) /
    denominator;

  return {
    successes,
    trials,
    probability,
    lowerBound: Math.min(probability, Math.max(0, center - margin)),
    upperBound: Math.max(probability, Math.min(1, center + margin)),
  };
};

export { STANDARD_NORMAL_95_PERCENT };
