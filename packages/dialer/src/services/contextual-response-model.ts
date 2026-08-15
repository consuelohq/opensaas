import type { PredictiveDecisionContext } from '../types.js';

type ContextualResponseExample = {
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
const FEATURE_COUNT = 15;

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

    const encoded = examples.map((example) => ({
      features: encodePredictiveContext(example.context),
      target: example.responded ? 1 : 0,
    }));
    const weights = Array.from({ length: FEATURE_COUNT }, () => 0);

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const gradient = Array.from({ length: FEATURE_COUNT }, () => 0);
      for (const example of encoded) {
        const prediction = sigmoid(dot(weights, example.features));
        const residual = prediction - example.target;
        for (let index = 0; index < FEATURE_COUNT; index += 1) {
          gradient[index] += residual * (example.features[index] ?? 0);
        }
      }

      const denominator = encoded.length;
      for (let index = 0; index < FEATURE_COUNT; index += 1) {
        const regularization = index === 0 ? 0 : l2Penalty * weights[index]!;
        const derivative = (gradient[index]! + regularization) / denominator;
        weights[index] -= learningRate * derivative;
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
