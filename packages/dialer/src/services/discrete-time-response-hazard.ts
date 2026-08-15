import type {
  PredictiveDecisionContext,
} from '../types.js';
import type { ResponseTimeObservation } from '../domain/learning-observation.js';
import { encodePredictiveContext } from './contextual-response-model.js';

export type DiscreteTimeHazardConfiguration = {
  intervalMs: number;
  horizonMs: number;
};

export type DiscreteTimeHazardPeriod = {
  intervalIndex: number;
  eventObserved: boolean;
};

type DiscreteTimeResponseExample = {
  context: PredictiveDecisionContext;
  observation: ResponseTimeObservation;
};

type DiscreteTimeResponseFitOptions = DiscreteTimeHazardConfiguration & {
  l2Penalty?: number;
  learningRate?: number;
  iterations?: number;
};

const DEFAULT_L2_PENALTY = 1;
const DEFAULT_LEARNING_RATE = 0.1;
const DEFAULT_ITERATIONS = 400;

const validateConfiguration = (
  configuration: DiscreteTimeHazardConfiguration,
): { intervalMs: number; horizonMs: number; intervalCount: number } => {
  const { intervalMs, horizonMs } = configuration;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new RangeError('intervalMs must be positive and finite');
  }
  if (!Number.isFinite(horizonMs) || horizonMs <= 0) {
    throw new RangeError('horizonMs must be positive and finite');
  }
  const intervalCount = Math.ceil(horizonMs / intervalMs);
  if (intervalCount < 1) {
    throw new RangeError('hazard configuration must define at least one interval');
  }
  return { intervalMs, horizonMs, intervalCount };
};

export const expandDiscreteTimeObservation = (
  observation: ResponseTimeObservation,
  configuration: DiscreteTimeHazardConfiguration,
): DiscreteTimeHazardPeriod[] => {
  const { intervalMs, horizonMs, intervalCount } =
    validateConfiguration(configuration);
  if (!Number.isFinite(observation.durationMs) || observation.durationMs < 0) {
    throw new RangeError('observation durationMs must be non-negative and finite');
  }

  const periods: DiscreteTimeHazardPeriod[] = [];
  if (observation.eventObserved && observation.durationMs < horizonMs) {
    const eventInterval = Math.min(
      Math.floor(observation.durationMs / intervalMs),
      intervalCount - 1,
    );
    for (let index = 0; index < eventInterval; index += 1) {
      periods.push({ intervalIndex: index, eventObserved: false });
    }
    periods.push({ intervalIndex: eventInterval, eventObserved: true });
    return periods;
  }

  const observedDuration = Math.min(observation.durationMs, horizonMs);
  const completedIntervals = Math.min(
    Math.floor(observedDuration / intervalMs),
    intervalCount,
  );
  for (let index = 0; index < completedIntervals; index += 1) {
    periods.push({ intervalIndex: index, eventObserved: false });
  }
  return periods;
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

const encodeHazardPeriod = (
  context: PredictiveDecisionContext,
  intervalIndex: number,
  intervalCount: number,
): number[] => {
  if (!Number.isInteger(intervalIndex) || intervalIndex < 0 || intervalIndex >= intervalCount) {
    throw new RangeError('intervalIndex is outside the configured hazard horizon');
  }
  const contextualFeatures = encodePredictiveContext(context);
  const baselineHazard = Array.from({ length: intervalCount }, () => 0);
  baselineHazard[intervalIndex] = 1;

  // The contextual intercept is removed because the interval indicators already
  // supply a non-parametric baseline hazard for every discrete time period.
  return [...contextualFeatures.slice(1), ...baselineHazard];
};

export class DiscreteTimeResponseHazardModel {
  private constructor(
    private readonly weights: readonly number[],
    readonly intervalMs: number,
    readonly horizonMs: number,
    private readonly intervalCount: number,
  ) {}

  static fit(
    examples: readonly DiscreteTimeResponseExample[],
    options: DiscreteTimeResponseFitOptions,
  ): DiscreteTimeResponseHazardModel {
    if (examples.length === 0) {
      throw new RangeError('discrete-time hazard training requires observations');
    }
    const { intervalMs, horizonMs, intervalCount } =
      validateConfiguration(options);
    const l2Penalty = options.l2Penalty ?? DEFAULT_L2_PENALTY;
    const learningRate = options.learningRate ?? DEFAULT_LEARNING_RATE;
    const iterations = options.iterations ?? DEFAULT_ITERATIONS;
    if (!Number.isFinite(l2Penalty) || l2Penalty < 0) {
      throw new RangeError('l2Penalty must be non-negative and finite');
    }
    if (!Number.isFinite(learningRate) || learningRate <= 0) {
      throw new RangeError('learningRate must be positive and finite');
    }
    if (!Number.isInteger(iterations) || iterations < 1) {
      throw new RangeError('iterations must be a positive integer');
    }

    const rows = examples.flatMap((example) =>
      expandDiscreteTimeObservation(example.observation, {
        intervalMs,
        horizonMs,
      }).map((period) => ({
        features: encodeHazardPeriod(
          example.context,
          period.intervalIndex,
          intervalCount,
        ),
        target: period.eventObserved ? 1 : 0,
      })),
    );
    if (rows.length === 0) {
      throw new RangeError(
        'discrete-time hazard training requires at least one fully observed period or event interval',
      );
    }

    const featureCount = rows[0]!.features.length;
    const weights = Array.from({ length: featureCount }, () => 0);
    const contextualFeatureCount = featureCount - intervalCount;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const gradient = Array.from({ length: featureCount }, () => 0);
      for (const row of rows) {
        const prediction = sigmoid(dot(weights, row.features));
        const residual = prediction - row.target;
        for (let index = 0; index < featureCount; index += 1) {
          gradient[index] += residual * (row.features[index] ?? 0);
        }
      }

      for (let index = 0; index < featureCount; index += 1) {
        // Shrink contextual effects. The interval-specific baseline hazard is
        // intentionally left unpenalized so time shape is not forced linear.
        const regularization =
          index < contextualFeatureCount ? l2Penalty * weights[index]! : 0;
        weights[index] -=
          learningRate * (gradient[index]! + regularization) / rows.length;
      }
    }

    return new DiscreteTimeResponseHazardModel(
      weights,
      intervalMs,
      horizonMs,
      intervalCount,
    );
  }

  predictIntervalHazards(context: PredictiveDecisionContext): number[] {
    return Array.from({ length: this.intervalCount }, (_value, intervalIndex) =>
      sigmoid(
        dot(
          this.weights,
          encodeHazardPeriod(context, intervalIndex, this.intervalCount),
        ),
      ),
    );
  }

  predictResponseByHorizonProbability(
    context: PredictiveDecisionContext,
  ): number {
    const survivalProbability = this.predictIntervalHazards(context).reduce(
      (survival, hazard) => survival * (1 - hazard),
      1,
    );
    return 1 - survivalProbability;
  }
}
