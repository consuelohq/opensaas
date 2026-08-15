export type PredictiveDecisionDatabase = {
  query<T>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
};

export type PredictivePolicyMode = 'deterministic' | 'stochastic';

export type PredictiveDecisionRecord = {
  decisionId: string;
  workspaceId: string;
  segmentId: string;
  evaluatedAt: string;
  policyVersion: string;
  modelVersion: string;
  featureSchemaVersion: number;
  policyMode: PredictivePolicyMode;
  eligible: readonly unknown[];
  ranked: readonly unknown[];
  suppressed: readonly unknown[];
  selectionProbabilities: Record<string, number> | null;
};

const RECORD_PREDICTIVE_DECISION_SQL = `
  INSERT INTO dialer_predictive_decisions (
    decision_id,
    workspace_id,
    segment_id,
    evaluated_at,
    policy_version,
    model_version,
    feature_schema_version,
    policy_mode,
    eligible_candidates,
    ranked_candidates,
    suppressed_candidates,
    selection_probabilities
  )
  VALUES (
    $1,
    $2,
    $3,
    $4::timestamptz,
    $5,
    $6,
    $7,
    $8,
    $9::jsonb,
    $10::jsonb,
    $11::jsonb,
    $12::jsonb
  )
  ON CONFLICT (decision_id) DO NOTHING
`;

export const recordPredictiveDecision = async (
  database: PredictiveDecisionDatabase,
  record: PredictiveDecisionRecord,
): Promise<void> => {
  try {
    await database.query(RECORD_PREDICTIVE_DECISION_SQL, [
      record.decisionId,
      record.workspaceId,
      record.segmentId,
      record.evaluatedAt,
      record.policyVersion,
      record.modelVersion,
      record.featureSchemaVersion,
      record.policyMode,
      JSON.stringify(record.eligible),
      JSON.stringify(record.ranked),
      JSON.stringify(record.suppressed),
      record.selectionProbabilities === null
        ? null
        : JSON.stringify(record.selectionProbabilities),
    ]);
  } catch (cause: unknown) {
    throw new Error('Failed to record predictive decision', { cause });
  }
};

const FINALIZE_PREDICTIVE_DECISION_SQL = `
  UPDATE dialer_predictive_decisions
  SET selected_contact_ids = $3::jsonb,
      selected_at = $4::timestamptz
  WHERE decision_id = $1 AND workspace_id = $2
`;

export const finalizePredictiveDecision = async (
  database: PredictiveDecisionDatabase,
  input: {
    workspaceId: string;
    decisionId: string;
    selectedContactIds: string[];
    selectedAt?: string;
  },
): Promise<void> => {
  try {
    await database.query(FINALIZE_PREDICTIVE_DECISION_SQL, [
      input.decisionId,
      input.workspaceId,
      JSON.stringify(input.selectedContactIds),
      input.selectedAt ?? new Date().toISOString(),
    ]);
  } catch (cause: unknown) {
    throw new Error('Failed to finalize predictive decision', { cause });
  }
};
