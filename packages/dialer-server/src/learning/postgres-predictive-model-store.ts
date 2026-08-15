import {
  estimateBernoulliWilson,
  type AttemptAnswerProbability,
  type HazardEstimate,
  type PredictiveHazardQuery,
  type PredictiveModelQuery,
  type PredictiveModelStore,
  type WorkspaceDialerEconomics,
} from '@consuelo/dialer';

export type PredictiveLearningDatabase = {
  query<T>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
};

type AggregateRow = {
  attempt_number: string | number;
  successes: string | number;
  trials: string | number;
};

type HazardAggregateRow = AggregateRow & {
  local_hour: string | number;
  local_day_of_week: string | number;
};

type EconomicsRow = {
  avg_deal_value: string | number | null;
  avg_close_rate: string | number | null;
  cost_per_attempt: string | number | null;
};

const ATTEMPT_PROBABILITIES_SQL = `
  WITH prepared AS (
    SELECT
      observations.workspace_id,
      observations.contact_id,
      observations.segment_id,
      observations.outcome_class,
      observations.attempted_at,
      observations.group_id,
      observations.position,
      ledger.attempts_total,
      COUNT(*) OVER (
        PARTITION BY observations.workspace_id, observations.contact_id
      )::integer AS canonical_attempt_count
    FROM dialer_learning_observations AS observations
    LEFT JOIN contact_attempt_ledger AS ledger
      ON ledger.workspace_id = observations.workspace_id
     AND ledger.contact_id = observations.contact_id
    WHERE observations.workspace_id = $1
  ),
  ordered AS (
    SELECT
      segment_id,
      outcome_class,
      (
        GREATEST(COALESCE(attempts_total, canonical_attempt_count) - canonical_attempt_count, 0)
        + ROW_NUMBER() OVER (
            PARTITION BY workspace_id, contact_id
            ORDER BY attempted_at, group_id, position
          )
      )::integer AS attempt_number
    FROM prepared
  )
  SELECT
    attempt_number,
    COUNT(*) FILTER (WHERE outcome_class = 'response')::integer AS successes,
    COUNT(*) FILTER (
      WHERE outcome_class IN ('response', 'non_response')
    )::integer AS trials
  FROM ordered
  WHERE segment_id = $2
  GROUP BY attempt_number
  HAVING COUNT(*) FILTER (
    WHERE outcome_class IN ('response', 'non_response')
  ) > 0
  ORDER BY attempt_number
`;

const HAZARD_ESTIMATES_SQL = `
  WITH prepared AS (
    SELECT
      observations.workspace_id,
      observations.contact_id,
      observations.segment_id,
      observations.outcome_class,
      observations.local_hour,
      observations.local_day_of_week,
      observations.attempted_at,
      observations.group_id,
      observations.position,
      ledger.attempts_total,
      COUNT(*) OVER (
        PARTITION BY observations.workspace_id, observations.contact_id
      )::integer AS canonical_attempt_count
    FROM dialer_learning_observations AS observations
    LEFT JOIN contact_attempt_ledger AS ledger
      ON ledger.workspace_id = observations.workspace_id
     AND ledger.contact_id = observations.contact_id
    WHERE observations.workspace_id = $1
  ),
  ordered AS (
    SELECT
      segment_id,
      outcome_class,
      local_hour,
      local_day_of_week,
      (
        GREATEST(COALESCE(attempts_total, canonical_attempt_count) - canonical_attempt_count, 0)
        + ROW_NUMBER() OVER (
            PARTITION BY workspace_id, contact_id
            ORDER BY attempted_at, group_id, position
          )
      )::integer AS attempt_number
    FROM prepared
  )
  SELECT
    attempt_number,
    local_hour,
    local_day_of_week,
    COUNT(*) FILTER (WHERE outcome_class = 'response')::integer AS successes,
    COUNT(*) FILTER (
      WHERE outcome_class IN ('response', 'non_response')
    )::integer AS trials
  FROM ordered
  WHERE segment_id = $2
    AND attempt_number = ANY($3::integer[])
  GROUP BY attempt_number, local_hour, local_day_of_week
  HAVING COUNT(*) FILTER (
    WHERE outcome_class IN ('response', 'non_response')
  ) > 0
  ORDER BY attempt_number, local_day_of_week, local_hour
`;

const WORKSPACE_ECONOMICS_SQL = `
  SELECT avg_deal_value, avg_close_rate, cost_per_attempt
  FROM dialer_workspace_settings
  WHERE workspace_id = $1
  LIMIT 1
`;

const parseNonNegativeInteger = (name: string, value: string | number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
};

const parseFinite = (name: string, value: string | number | null) => {
  if (value === null) {
    throw new Error(`${name} is not configured`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be finite`);
  }
  return parsed;
};

const estimateAggregate = (
  row: AggregateRow,
): Omit<AttemptAnswerProbability, 'attemptNumber'> => {
  const successes = parseNonNegativeInteger('successes', row.successes);
  const trials = parseNonNegativeInteger('trials', row.trials);
  const estimate = estimateBernoulliWilson(successes, trials);
  if (!estimate) {
    throw new Error('aggregate trials must be positive');
  }
  return {
    probability: estimate.probability,
    successes,
    trials,
    lowerBound: estimate.lowerBound,
    upperBound: estimate.upperBound,
  };
};

export const createPostgresPredictiveModelStore = (
  database: PredictiveLearningDatabase,
): PredictiveModelStore => ({
  getAnswerProbabilities: async (
    query: PredictiveModelQuery,
  ): Promise<AttemptAnswerProbability[]> => {
    try {
      const result = await database.query<AggregateRow>(
        ATTEMPT_PROBABILITIES_SQL,
        [query.workspaceId, query.segmentId],
      );
      return result.rows.map((row) => ({
        attemptNumber: parseNonNegativeInteger(
          'attempt_number',
          row.attempt_number,
        ),
        ...estimateAggregate(row),
      }));
    } catch (cause: unknown) {
      throw new Error('Failed to load predictive attempt probabilities', {
        cause,
      });
    }
  },

  getHazardEstimates: async (
    query: PredictiveHazardQuery,
  ): Promise<HazardEstimate[]> => {
    try {
      if (query.attemptNumbers.length === 0) {
        return [];
      }
      const result = await database.query<HazardAggregateRow>(
        HAZARD_ESTIMATES_SQL,
        [query.workspaceId, query.segmentId, query.attemptNumbers],
      );
      return result.rows.map((row) => {
        const estimate = estimateAggregate(row);
        return {
          segmentId: query.segmentId,
          attemptNumber: parseNonNegativeInteger(
            'attempt_number',
            row.attempt_number,
          ),
          hourOfDay: parseNonNegativeInteger('local_hour', row.local_hour),
          dayOfWeek: parseNonNegativeInteger(
            'local_day_of_week',
            row.local_day_of_week,
          ),
          answerRate: estimate.probability,
          sampleSize: estimate.trials ?? 0,
          successes: estimate.successes,
          trials: estimate.trials,
          lowerBound: estimate.lowerBound,
          upperBound: estimate.upperBound,
        };
      });
    } catch (cause: unknown) {
      throw new Error('Failed to load predictive local hazard estimates', {
        cause,
      });
    }
  },

  getWorkspaceEconomics: async (
    workspaceId: string,
  ): Promise<WorkspaceDialerEconomics> => {
    try {
      const result = await database.query<EconomicsRow>(WORKSPACE_ECONOMICS_SQL, [
        workspaceId,
      ]);
      const row = result.rows[0];
      if (!row) {
        throw new Error('workspace dialer economics are not configured');
      }
      const averageDealValue = parseFinite(
        'avg_deal_value',
        row.avg_deal_value,
      );
      const averageCloseRate = parseFinite(
        'avg_close_rate',
        row.avg_close_rate,
      );
      const costPerAttempt = parseFinite(
        'cost_per_attempt',
        row.cost_per_attempt,
      );
      if (averageDealValue < 0) {
        throw new RangeError('avg_deal_value must be non-negative');
      }
      if (averageCloseRate < 0 || averageCloseRate > 1) {
        throw new RangeError('avg_close_rate must be in [0, 1]');
      }
      if (costPerAttempt < 0) {
        throw new RangeError('cost_per_attempt must be non-negative');
      }

      return {
        valuePerConnection: averageDealValue * averageCloseRate,
        costPerAttempt,
      };
    } catch (cause: unknown) {
      throw new Error('Failed to load configured workspace dialer economics', {
        cause,
      });
    }
  },
});
