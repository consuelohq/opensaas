import {
  ContextualResponseModel,
  buildCalibrationBins,
  compareProbabilisticModels,
  populationStabilityIndex,
  scoreContextualCandidateEconomics,
  splitTemporalEvaluationExamples,
  type PredictiveDecisionContext,
  type PredictiveHazardSource,
  type PredictiveSourceContext,
  type PredictiveTimezoneSource,
} from '@consuelo/dialer';

export type ContextualShadowEvaluationDatabase = {
  query<T>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
};

type ContextualObservationRow = {
  attempted_at: string | Date;
  outcome_class: string;
  decision_context: unknown;
};

type ContextualShadowExample = {
  evaluatedAt: string;
  context: PredictiveDecisionContext;
  responded: boolean;
};

type ContextualShadowEvaluationOptions = {
  workspaceId: string;
  segmentId: string;
  minSampleSize?: number;
  trainingFraction?: number;
};

type WorkspaceEconomicsRow = {
  avg_close_rate: string | number | null;
  cost_per_attempt: string | number | null;
};

const DEFAULT_MIN_SAMPLE_SIZE = 100;
const DEFAULT_TRAINING_FRACTION = 0.8;
const PSI_EDGES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

const WORKSPACE_ECONOMICS_SQL = `
  SELECT avg_close_rate, cost_per_attempt
  FROM dialer_workspace_settings
  WHERE workspace_id = $1
  LIMIT 1
`;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;

const requiredString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`decision_context.${key} must be a non-empty string`);
  }
  return value;
};

const requiredNumber = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`decision_context.${key} must be finite`);
  }
  return value;
};

const optionalString = (
  record: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const optionalNullableString = (
  record: Record<string, unknown>,
  key: string,
): string | null | undefined => {
  const value = record[key];
  if (value === null) return null;
  return optionalString(record, key);
};

const optionalNullableNumber = (
  record: Record<string, unknown>,
  key: string,
): number | null | undefined => {
  const value = record[key];
  if (value === null) return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const parseSourceContext = (value: unknown): PredictiveSourceContext => {
  const record = asRecord(value);
  if (!record) return {};
  return {
    opportunityId: optionalString(record, 'opportunityId'),
    pipelineId: optionalString(record, 'pipelineId'),
    stageId: optionalString(record, 'stageId'),
    opportunityStatus: optionalNullableString(record, 'opportunityStatus'),
    opportunityValue: optionalNullableNumber(record, 'opportunityValue'),
    contactTimezone: optionalString(record, 'contactTimezone'),
  };
};

export const parsePredictiveDecisionContext = (
  value: unknown,
): PredictiveDecisionContext => {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  const record = asRecord(parsed);
  if (!record || record.schemaVersion !== 2) {
    throw new Error('decision_context must use feature schema version 2');
  }
  const d3 = asRecord(record.d3);
  if (!d3) throw new Error('decision_context.d3 is required');
  const timezoneSource = requiredString(record, 'timezoneSource');
  if (timezoneSource !== 'contact' && timezoneSource !== 'workspace_fallback') {
    throw new Error('decision_context.timezoneSource is invalid');
  }
  const hazardSource = d3.hazardSource;
  if (
    hazardSource !== null &&
    hazardSource !== 'exact_local_slot' &&
    hazardSource !== 'attempt_fallback' &&
    hazardSource !== 'missing'
  ) {
    throw new Error('decision_context.d3.hazardSource is invalid');
  }
  if (typeof d3.suppressed !== 'boolean') {
    throw new Error('decision_context.d3.suppressed must be boolean');
  }
  const score = d3.score;
  if (score !== null && (typeof score !== 'number' || !Number.isFinite(score))) {
    throw new Error('decision_context.d3.score must be finite or null');
  }
  const minutesSinceLastAttempt = record.minutesSinceLastAttempt;
  if (
    minutesSinceLastAttempt !== null &&
    (typeof minutesSinceLastAttempt !== 'number' ||
      !Number.isFinite(minutesSinceLastAttempt))
  ) {
    throw new Error(
      'decision_context.minutesSinceLastAttempt must be finite or null',
    );
  }
  if (typeof record.localPresenceRequested !== 'boolean') {
    throw new Error('decision_context.localPresenceRequested must be boolean');
  }

  return {
    schemaVersion: 2,
    capturedAt: requiredString(record, 'capturedAt'),
    timezone: requiredString(record, 'timezone'),
    timezoneSource: timezoneSource as PredictiveTimezoneSource,
    localHour: requiredNumber(record, 'localHour'),
    localDayOfWeek: requiredNumber(record, 'localDayOfWeek'),
    attemptsUsed: requiredNumber(record, 'attemptsUsed'),
    attemptsToday: requiredNumber(record, 'attemptsToday'),
    attemptsThisWeek: requiredNumber(record, 'attemptsThisWeek'),
    minutesSinceLastAttempt,
    localPresenceRequested: record.localPresenceRequested,
    source: parseSourceContext(record.source),
    d3: {
      nextAttemptNumber: requiredNumber(d3, 'nextAttemptNumber'),
      answerProbability: requiredNumber(d3, 'answerProbability'),
      answerProbabilityUpperBound: requiredNumber(
        d3,
        'answerProbabilityUpperBound',
      ),
      score,
      hazardSource: hazardSource as PredictiveHazardSource | null,
      suppressed: d3.suppressed,
    },
  };
};

const toIsoString = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('contextual observation attempted_at is invalid');
  }
  return date.toISOString();
};

const parseWorkspaceEconomics = (
  row: WorkspaceEconomicsRow | undefined,
): { closeRate: number; costPerAttempt: number } | null => {
  if (!row) return null;
  const closeRate = Number(row.avg_close_rate);
  const costPerAttempt = Number(row.cost_per_attempt);
  if (
    !Number.isFinite(closeRate) ||
    closeRate < 0 ||
    closeRate > 1 ||
    !Number.isFinite(costPerAttempt) ||
    costPerAttempt < 0
  ) {
    return null;
  }
  return { closeRate, costPerAttempt };
};

const mean = (values: readonly number[]): number => {
  if (values.length === 0) throw new RangeError('cannot average an empty sample');
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

type EconomicPrediction = {
  responded: boolean;
  probability: number;
  opportunityValue: number;
};

const summarizeCandidateEconomics = (
  predictions: readonly EconomicPrediction[],
  economics: { closeRate: number; costPerAttempt: number },
) => {
  if (predictions.length === 0) return null;
  const scored = predictions.map((prediction) => ({
    prediction,
    economics: scoreContextualCandidateEconomics({
      responseProbability: prediction.probability,
      opportunityValue: prediction.opportunityValue,
      closeRate: economics.closeRate,
      costPerAttempt: economics.costPerAttempt,
    }),
  }));
  const weightedTerms = scored.map(({ prediction, economics: score }) => ({
    weight: score.valuePerConnection,
    squaredError:
      (prediction.probability - (prediction.responded ? 1 : 0)) ** 2,
  }));
  const totalWeight = weightedTerms.reduce((sum, term) => sum + term.weight, 0);
  return {
    valueWeightedBrier:
      totalWeight > 0
        ? weightedTerms.reduce(
            (sum, term) => sum + term.weight * term.squaredError,
            0,
          ) / totalWeight
        : null,
    meanExpectedNetValue: mean(
      scored.map(({ economics: score }) => score.expectedNetValue),
    ),
    responseWeightedNetValueProxy: mean(
      scored.map(({ prediction, economics: score }) =>
        (prediction.responded ? score.valuePerConnection : 0) -
        score.costPerAttempt,
      ),
    ),
  };
};

export const evaluateContextualPredictiveShadow = async (
  database: ContextualShadowEvaluationDatabase,
  options: ContextualShadowEvaluationOptions,
) => {
  try {
  const minSampleSize = options.minSampleSize ?? DEFAULT_MIN_SAMPLE_SIZE;
  if (!Number.isInteger(minSampleSize) || minSampleSize < 2) {
    throw new RangeError('minSampleSize must be an integer of at least 2');
  }
  const result = await database.query<ContextualObservationRow>(
    `SELECT attempted_at, outcome_class, decision_context
     FROM dialer_learning_observations
     WHERE workspace_id = $1
       AND segment_id = $2
       AND feature_schema_version = 2
       AND decision_context IS NOT NULL
       AND outcome_class IN ('response', 'non_response')
     ORDER BY attempted_at, group_id, position`,
    [options.workspaceId, options.segmentId],
  );
  const examples: ContextualShadowExample[] = result.rows.map((row) => ({
    evaluatedAt: toIsoString(row.attempted_at),
    context: parsePredictiveDecisionContext(row.decision_context),
    responded: row.outcome_class === 'response',
  }));

  if (examples.length < minSampleSize) {
    return {
      status: 'insufficient_data' as const,
      sampleSize: examples.length,
      requiredSampleSize: minSampleSize,
    };
  }

  const economicsResult = await database.query<WorkspaceEconomicsRow>(
    WORKSPACE_ECONOMICS_SQL,
    [options.workspaceId],
  );
  const workspaceEconomics = parseWorkspaceEconomics(economicsResult.rows[0]);

  const split = splitTemporalEvaluationExamples(
    examples,
    options.trainingFraction ?? DEFAULT_TRAINING_FRACTION,
  );
  const model = ContextualResponseModel.fit(split.training);
  const trainingPredictions = split.training.map((example) =>
    model.predictProbability(example.context),
  );
  const holdout = split.holdout.map((example) => ({
    context: example.context,
    hazardSource: example.context.d3.hazardSource,
    responded: example.responded,
    controlProbability: example.context.d3.answerProbability,
    challengerProbability: model.predictProbability(example.context),
  }));
  const controlComparableHoldout = holdout.filter(
    (prediction) => prediction.hazardSource !== 'missing',
  );
  const comparison =
    controlComparableHoldout.length > 0
      ? compareProbabilisticModels(controlComparableHoldout)
      : null;
  const calibration = buildCalibrationBins(
    holdout.map((prediction) => ({
      probability: prediction.challengerProbability,
      responded: prediction.responded,
    })),
  );
  const economicHoldout = holdout.flatMap((prediction) => {
    const opportunityValue = prediction.context.source.opportunityValue;
    if (
      opportunityValue === null ||
      opportunityValue === undefined ||
      !Number.isFinite(opportunityValue) ||
      opportunityValue < 0
    ) {
      return [];
    }
    return [{ ...prediction, opportunityValue }];
  });
  const candidateEconomics = workspaceEconomics
    ? {
        sampleSize: economicHoldout.length,
        closeRate: workspaceEconomics.closeRate,
        costPerAttempt: workspaceEconomics.costPerAttempt,
        challenger: summarizeCandidateEconomics(
          economicHoldout.map((prediction) => ({
            responded: prediction.responded,
            probability: prediction.challengerProbability,
            opportunityValue: prediction.opportunityValue,
          })),
          workspaceEconomics,
        ),
        control: summarizeCandidateEconomics(
          economicHoldout
            .filter((prediction) => prediction.hazardSource !== 'missing')
            .map((prediction) => ({
              responded: prediction.responded,
              probability: prediction.controlProbability,
              opportunityValue: prediction.opportunityValue,
            })),
          workspaceEconomics,
        ),
        interpretation: 'descriptive_not_causal' as const,
      }
    : null;

  return {
    status: 'evaluated' as const,
    trainingSampleSize: split.training.length,
    holdoutSampleSize: split.holdout.length,
    controlComparableSampleSize: controlComparableHoldout.length,
    comparison,
    calibration,
    candidateEconomics,
    predictionDriftPsi: populationStabilityIndex(
      trainingPredictions,
      holdout.map((prediction) => prediction.challengerProbability),
      PSI_EDGES,
    ),
  };
  } catch (cause: unknown) {
    throw new Error('Failed to evaluate contextual predictive shadow', {
      cause,
    });
  }
};
