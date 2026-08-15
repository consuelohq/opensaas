import {
  DiscreteTimeResponseHazardModel,
  buildCalibrationBins,
  buildResponseTimeObservation,
  evaluateProbabilisticPredictions,
  populationStabilityIndex,
  splitTemporalEvaluationExamples,
  type LearningCensorReason,
  type LearningObservationClassification,
  type LearningOutcomeClass,
  type PredictiveDecisionContext,
  type ResponseTimeObservation,
} from '@consuelo/dialer';

import { parsePredictiveDecisionContext } from './contextual-shadow-evaluation';

export type ResponseTimeShadowEvaluationDatabase = {
  query<T>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
};

type ResponseTimeObservationRow = {
  attempted_at: string | Date;
  response_at: string | Date | null;
  observed_until_at: string | Date | null;
  outcome_class: string;
  censor_reason: string | null;
  decision_context: unknown;
};

type ResponseTimeShadowExample = {
  evaluatedAt: string;
  context: PredictiveDecisionContext;
  observation: ResponseTimeObservation;
};

type ResponseTimeShadowEvaluationOptions = {
  workspaceId: string;
  segmentId: string;
  minSampleSize?: number;
  trainingFraction?: number;
  intervalMs?: number;
  horizonMs?: number;
};

const DEFAULT_MIN_SAMPLE_SIZE = 100;
const DEFAULT_TRAINING_FRACTION = 0.8;
const DEFAULT_INTERVAL_MS = 5_000;
const DEFAULT_HORIZON_MS = 30_000;
const PSI_EDGES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

const parseOutcomeClass = (value: string): LearningOutcomeClass => {
  if (value === 'response' || value === 'non_response' || value === 'censored') {
    return value;
  }
  throw new Error(`Unsupported learning outcome class: ${value}`);
};

const parseCensorReason = (
  outcomeClass: LearningOutcomeClass,
  value: string | null,
): LearningCensorReason | null => {
  if (outcomeClass !== 'censored') {
    if (value !== null) {
      throw new Error('uncensored observations must not have a censor reason');
    }
    return null;
  }
  if (value === 'competing_winner' || value === 'ambiguous_termination') {
    return value;
  }
  throw new Error('censored observations require a supported censor reason');
};

const toIsoString = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('response-time observation attempted_at is invalid');
  }
  return date.toISOString();
};

const toResponseTimeExample = (
  row: ResponseTimeObservationRow,
): ResponseTimeShadowExample => {
  const outcomeClass = parseOutcomeClass(row.outcome_class);
  const classification: LearningObservationClassification = {
    outcomeClass,
    censorReason: parseCensorReason(outcomeClass, row.censor_reason),
  };
  return {
    evaluatedAt: toIsoString(row.attempted_at),
    context: parsePredictiveDecisionContext(row.decision_context),
    observation: buildResponseTimeObservation(
      row.attempted_at,
      row.response_at,
      row.observed_until_at,
      classification,
    ),
  };
};

const isOutcomeObservedByHorizon = (
  observation: ResponseTimeObservation,
  horizonMs: number,
): boolean => observation.eventObserved || observation.durationMs >= horizonMs;

const respondedByHorizon = (
  observation: ResponseTimeObservation,
  horizonMs: number,
): boolean => observation.eventObserved && observation.durationMs < horizonMs;

export const evaluateResponseTimeHazardShadow = async (
  database: ResponseTimeShadowEvaluationDatabase,
  options: ResponseTimeShadowEvaluationOptions,
) => {
  try {
  const minSampleSize = options.minSampleSize ?? DEFAULT_MIN_SAMPLE_SIZE;
  const trainingFraction = options.trainingFraction ?? DEFAULT_TRAINING_FRACTION;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const horizonMs = options.horizonMs ?? DEFAULT_HORIZON_MS;
  if (!Number.isInteger(minSampleSize) || minSampleSize < 2) {
    throw new RangeError('minSampleSize must be an integer of at least 2');
  }

  const result = await database.query<ResponseTimeObservationRow>(
    `SELECT
       attempted_at,
       response_at,
       observed_until_at,
       outcome_class,
       censor_reason,
       decision_context
     FROM dialer_learning_observations
     WHERE workspace_id = $1
       AND segment_id = $2
       AND feature_schema_version = 2
       AND decision_context IS NOT NULL
     ORDER BY attempted_at, group_id, position`,
    [options.workspaceId, options.segmentId],
  );
  const examples = result.rows.map(toResponseTimeExample);
  if (examples.length < minSampleSize) {
    return {
      status: 'insufficient_data' as const,
      sampleSize: examples.length,
      requiredSampleSize: minSampleSize,
    };
  }

  const split = splitTemporalEvaluationExamples(examples, trainingFraction);
  const model = DiscreteTimeResponseHazardModel.fit(split.training, {
    intervalMs,
    horizonMs,
  });
  const trainingPredictions = split.training.map((example) =>
    model.predictResponseByHorizonProbability(example.context),
  );
  const holdoutPredictions = split.holdout.map((example) => ({
    example,
    probability: model.predictResponseByHorizonProbability(example.context),
  }));
  const evaluable = holdoutPredictions.filter(({ example }) =>
    isOutcomeObservedByHorizon(example.observation, horizonMs),
  );
  if (evaluable.length === 0) {
    return {
      status: 'insufficient_evaluable_holdout' as const,
      trainingSampleSize: split.training.length,
      holdoutSampleSize: split.holdout.length,
      earlyCensoredHoldoutCount: split.holdout.length,
      intervalMs,
      horizonMs,
      estimand: 'response_by_horizon' as const,
    };
  }
  const predictions = evaluable.map(({ example, probability }) => ({
    probability,
    responded: respondedByHorizon(example.observation, horizonMs),
  }));

  return {
    status: 'evaluated' as const,
    estimand: 'response_by_horizon' as const,
    intervalMs,
    horizonMs,
    trainingSampleSize: split.training.length,
    holdoutSampleSize: split.holdout.length,
    evaluableHoldoutSampleSize: evaluable.length,
    earlyCensoredHoldoutCount: split.holdout.length - evaluable.length,
    metrics: evaluateProbabilisticPredictions(predictions),
    calibration: buildCalibrationBins(predictions),
    predictionDriftPsi: populationStabilityIndex(
      trainingPredictions,
      holdoutPredictions.map(({ probability }) => probability),
      PSI_EDGES,
    ),
  };
  } catch (cause: unknown) {
    throw new Error('Failed to evaluate response-time hazard shadow', { cause });
  }
};
