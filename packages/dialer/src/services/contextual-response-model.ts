import type { PredictiveDecisionContext } from '../types.js';

export type ContextualResponseExample = {
  context: PredictiveDecisionContext;
  responded: boolean;
};

type ContextualResponseFitOptions = {
  l2Penalty?: number;
  learningRate?: number;
  iterations?: number;
};

type ContextualEconomicsInput = {
  responseProbability: number;
  opportunityValue: number;
  closeRate: number;
  costPerAttempt: number;
};

const TWO_PI = Math.PI * 2;
const DEFAULT_L2_PENALTY = 1;
const DEFAULT_LEARNING_RATE = 0.1;
const DEFAULT_ITERATIONS = 400;

const finite = (name: string, value: number): number => {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
};

const probability = (name: string, value: number): number => {
  finite(name, value);
  if (value < 0 || value > 1) {
    throw new RangeError(`${name} must be in [0, 1]`);
  }
  return value;
};

const nonNegative = (name: string, value: number): number => {
  finite(name, value);
  if (value < 0) throw new RangeError(`${name} must be non-negative`);
  return value;
};

const boundedLog = (value: number, scale: number): number =>
  Math.min(Math.log1p(Math.max(value, 0)) / scale, 2);

export const encodePredictiveContext = (
  context: PredictiveDecisionContext,
): number[] => {
  const hourRadians = (TWO_PI * context.localHour) / 24;
  const dayRadians = (TWO_PI * context.localDayOfWeek) / 7;
  const minutes = context.minutesSinceLastAttempt;
  const opportunityValue = context.source.opportunityValue;

  return [
    1,
    Math.sin(hourRadians),
    Math.cos(hourRadians),
    Math.sin(dayRadians),
    Math.cos(dayRadians),
    boundedLog(context.attemptsUsed, Math.log(11)),
    boundedLog(context.attemptsToday, Math.log(6)),
    boundedLog(context.attemptsThisWeek, Math.log(21)),
    minutes === null ? 0 : boundedLog(minutes, Math.log(60 * 24 * 8)),
    minutes === null ? 1 : 0,
    opportunityValue === null || opportunityValue === undefined
      ? 0
      : boundedLog(opportunityValue, Math.log(100_001)),
    opportunityValue === null || opportunityValue === undefined ? 1 : 0,
    context.timezoneSource === 'contact' ? 1 : 0,
    context.localPresenceRequested ? 1 : 0,
    context.source.opportunityStatus?.toLowerCase() === 'open' ? 1 : 0,
  ];
};

const sigmoid = (value: number): number => {
  if (value >= 0) {
    const exponent = Math.exp(-value);
    return 1 / (1 + exponent);
  }
  const exponent = Math.exp(value);
  return exponent / (1 + exponent);
};

const dot = (weights: readonly number[], features: readonly number[]): number =>
  weights.reduce((sum, weight, index) => sum + weight * (features[index] ?? 0), 0);

const encodedExamples = (examples: readonly ContextualResponseExample[]) => {
  const encoded = examples.map((example) => ({
    features: encodePredictiveContext(example.context),
    target: example.responded ? 1 : 0,
  }));
  const featureCount = encoded[0]?.features.length ?? 0;
  if (featureCount === 0) {
    throw new RangeError('contextual response training requires features');
  }
  if (encoded.some((example) => example.features.length !== featureCount)) {
    throw new RangeError('contextual response feature dimensions must match');
  }
  return { encoded, featureCount };
};

const validateWeightShape = (
  weights: readonly number[],
  featureCount: number,
) => {
  if (weights.length !== featureCount || weights.some((weight) => !Number.isFinite(weight))) {
    throw new RangeError('contextual response weights must match finite feature dimensions');
  }
};

export const contextualResponseObjective = (
  weights: readonly number[],
  examples: readonly ContextualResponseExample[],
  l2Penalty = DEFAULT_L2_PENALTY,
): number => {
  if (examples.length === 0) {
    throw new RangeError('contextual response objective requires observations');
  }
  const lambda = nonNegative('l2Penalty', l2Penalty);
  const { encoded, featureCount } = encodedExamples(examples);
  validateWeightShape(weights, featureCount);
  const epsilon = 1e-15;
  const meanNll =
    encoded.reduce((sum, example) => {
      const predicted = Math.min(
        Math.max(sigmoid(dot(weights, example.features)), epsilon),
        1 - epsilon,
      );
      return (
        sum -
        (example.target * Math.log(predicted) +
          (1 - example.target) * Math.log(1 - predicted))
      );
    }, 0) / encoded.length;
  const penalty = weights
    .slice(1)
    .reduce((sum, weight) => sum + weight * weight, 0);
  return meanNll + (lambda / 2) * penalty;
};

export const contextualResponseGradient = (
  weights: readonly number[],
  examples: readonly ContextualResponseExample[],
  l2Penalty = DEFAULT_L2_PENALTY,
): number[] => {
  if (examples.length === 0) {
    throw new RangeError('contextual response gradient requires observations');
  }
  const lambda = nonNegative('l2Penalty', l2Penalty);
  const { encoded, featureCount } = encodedExamples(examples);
  validateWeightShape(weights, featureCount);
  const gradient = Array.from({ length: featureCount }, () => 0);
  for (const example of encoded) {
    const residual = sigmoid(dot(weights, example.features)) - example.target;
    for (let index = 0; index < featureCount; index += 1) {
      gradient[index] += residual * example.features[index]!;
    }
  }
  return gradient.map((value, index) =>
    value / encoded.length + (index === 0 ? 0 : lambda * weights[index]!),
  );
};

export class ContextualResponseModel {
  private constructor(private readonly weights: readonly number[]) {}

  static fit(
    examples: readonly ContextualResponseExample[],
    options: ContextualResponseFitOptions = {},
  ): ContextualResponseModel {
    if (examples.length === 0) {
      throw new RangeError('contextual response training requires observations');
    }
    const l2Penalty = nonNegative(
      'l2Penalty',
      options.l2Penalty ?? DEFAULT_L2_PENALTY,
    );
    const learningRate = nonNegative(
      'learningRate',
      options.learningRate ?? DEFAULT_LEARNING_RATE,
    );
    if (learningRate === 0) {
      throw new RangeError('learningRate must be positive');
    }
    const iterations = options.iterations ?? DEFAULT_ITERATIONS;
    if (!Number.isInteger(iterations) || iterations < 1) {
      throw new RangeError('iterations must be a positive integer');
    }

    const { featureCount } = encodedExamples(examples);
    const weights = Array.from({ length: featureCount }, () => 0);

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const gradient = contextualResponseGradient(weights, examples, l2Penalty);
      for (let index = 0; index < featureCount; index += 1) {
        weights[index] -= learningRate * gradient[index]!;
      }
    }

    return new ContextualResponseModel(weights);
  }

  predictProbability(context: PredictiveDecisionContext): number {
    return sigmoid(dot(this.weights, encodePredictiveContext(context)));
  }
}

export const scoreContextualCandidateEconomics = (
  input: ContextualEconomicsInput,
) => {
  const responseProbability = probability(
    'responseProbability',
    input.responseProbability,
  );
  const opportunityValue = nonNegative('opportunityValue', input.opportunityValue);
  const closeRate = probability('closeRate', input.closeRate);
  const costPerAttempt = nonNegative('costPerAttempt', input.costPerAttempt);
  const valuePerConnection = opportunityValue * closeRate;
  const expectedValue = responseProbability * valuePerConnection;

  return {
    responseProbability,
    valuePerConnection,
    expectedValue,
    costPerAttempt,
    expectedNetValue: expectedValue - costPerAttempt,
  };
};
