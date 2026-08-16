import {
  classifyLearningObservation,
  resolveLocalCalendarSlot,
  type ParallelTelemetryRecord,
} from '@consuelo/dialer';
import type { LeadConnectorDatabase } from '@consuelo/lead-connector';

const CREATE_ATTEMPT_LEDGER_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS contact_attempt_ledger (
    workspace_id text NOT NULL,
    contact_id text NOT NULL,
    last_attempt_at timestamptz,
    attempts_total integer NOT NULL DEFAULT 0,
    attempts_today integer NOT NULL DEFAULT 0,
    attempts_this_week integer NOT NULL DEFAULT 0,
    outcomes jsonb NOT NULL DEFAULT '[]'::jsonb,
    day_window_start timestamptz NOT NULL DEFAULT date_trunc('day', now()),
    week_window_start timestamptz NOT NULL DEFAULT date_trunc('week', now()),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, contact_id)
  )
`;

const CREATE_ATTEMPT_LEDGER_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_contact_attempt_ledger_last_attempt
    ON contact_attempt_ledger (workspace_id, last_attempt_at DESC)
`;

const CREATE_OUTCOMES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS consuelo_lead_connector_call_outcomes (
    id bigserial PRIMARY KEY,
    workspace_id text NOT NULL,
    contact_id text NOT NULL,
    attempted_at timestamptz NOT NULL,
    attempt_number integer NOT NULL,
    outcome text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`;

const CREATE_OUTCOMES_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS consuelo_lead_connector_call_outcomes_model_idx
    ON consuelo_lead_connector_call_outcomes (
      workspace_id,
      attempt_number,
      attempted_at DESC
    )
`;

export const initializeLeadConnectorDialerLearning = (
  database: LeadConnectorDatabase,
): Promise<void> =>
  database
    .query(CREATE_ATTEMPT_LEDGER_TABLE_SQL)
    .then(() => database.query(CREATE_ATTEMPT_LEDGER_INDEX_SQL))
    .then(() => database.query(CREATE_OUTCOMES_TABLE_SQL))
    .then(() => database.query(CREATE_OUTCOMES_INDEX_SQL))
    .then(() => undefined);

const outcomeForCall = (
  record: ParallelTelemetryRecord,
  call: ParallelTelemetryRecord['group']['calls'][number],
): string => {
  if (call.callSid === record.group.winnerSid) {
    const humanLike =
      call.amdResult === 'human' ||
      (record.group.profile.amdPolicy === 'human-or-unknown' &&
        call.amdResult === 'unknown');
    if (humanLike) return 'answered';
  }
  const normalized = call.status.trim().toLowerCase();
  return normalized || 'unknown';
};

const RECORD_ATTEMPT_SQL = `
  WITH canonical_insert AS (
    INSERT INTO dialer_learning_observations (
      workspace_id,
      group_id,
      position,
      segment_id,
      contact_id,
      attempted_at,
      response_at,
      observed_until_at,
      local_hour,
      local_day_of_week,
      outcome_class,
      censor_reason,
      feature_schema_version,
      decision_id,
      decision_context
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6::timestamptz,
      $7::timestamptz,
      $8::timestamptz,
      $9,
      $10,
      $11,
      $12,
      $13,
      $14,
      $15::jsonb
    )
    ON CONFLICT (workspace_id, group_id, position) DO NOTHING
    RETURNING workspace_id, contact_id, attempted_at
  ),
  updated_ledger AS (
    INSERT INTO contact_attempt_ledger (
      workspace_id,
      contact_id,
      last_attempt_at,
      attempts_total,
      attempts_today,
      attempts_this_week,
      outcomes,
      day_window_start,
      week_window_start,
      updated_at
    )
    SELECT
      workspace_id,
      contact_id,
      attempted_at,
      1,
      1,
      1,
      jsonb_build_array($16::text),
      date_trunc('day', attempted_at),
      date_trunc('week', attempted_at),
      now()
    FROM canonical_insert
    ON CONFLICT (workspace_id, contact_id)
    DO UPDATE SET
      last_attempt_at = GREATEST(
        contact_attempt_ledger.last_attempt_at,
        EXCLUDED.last_attempt_at
      ),
      attempts_total = contact_attempt_ledger.attempts_total + 1,
      attempts_today = CASE
        WHEN contact_attempt_ledger.day_window_start
          < date_trunc('day', EXCLUDED.last_attempt_at)
          THEN 1
        ELSE contact_attempt_ledger.attempts_today + 1
      END,
      attempts_this_week = CASE
        WHEN contact_attempt_ledger.week_window_start
          < date_trunc('week', EXCLUDED.last_attempt_at)
          THEN 1
        ELSE contact_attempt_ledger.attempts_this_week + 1
      END,
      outcomes = jsonb_build_array($16::text)
        || contact_attempt_ledger.outcomes,
      day_window_start = GREATEST(
        contact_attempt_ledger.day_window_start,
        date_trunc('day', EXCLUDED.last_attempt_at)
      ),
      week_window_start = GREATEST(
        contact_attempt_ledger.week_window_start,
        date_trunc('week', EXCLUDED.last_attempt_at)
      ),
      updated_at = now()
    RETURNING attempts_total
  )
  INSERT INTO consuelo_lead_connector_call_outcomes (
    workspace_id,
    contact_id,
    attempted_at,
    attempt_number,
    outcome
  )
  SELECT $1, $5, $6::timestamptz, attempts_total, $16
  FROM updated_ledger
`;

type LearningWarningLogger = (
  message: string,
  details: { workspaceId: string; groupId: string; error: string },
) => void;

export const recordLeadConnectorAttemptTelemetry = async (
  database: LeadConnectorDatabase,
  record: ParallelTelemetryRecord,
  logWarning?: LearningWarningLogger,
  options: { timezone?: string } = {},
): Promise<boolean> => {
  const calls = record.group.calls.filter(
    (call): call is typeof call & { contactId: string } => Boolean(call.contactId),
  );
  try {
    await Promise.all(
      calls.map((call) => {
        const classification = classifyLearningObservation(record.group, call);
        const localSlot = resolveLocalCalendarSlot(
          call.dialStartedAt,
          options.timezone ?? 'UTC',
        );
        const segmentId =
          record.group.campaignSegment?.trim() || record.group.queueId;
        const observedUntilAt =
          call.terminatedAt ??
          call.answeredAt ??
          record.group.completedAt ??
          null;
        const persistedDecisionContext = call.decisionContext
          ? JSON.stringify({
              ...call.decisionContext,
              realized: {
                profileId: record.group.profile.id,
                fanout: record.group.profile.fanout,
                staggerMs: record.group.profile.staggerMs,
                parallelPosition: call.position,
              },
            })
          : null;

        return database.query(RECORD_ATTEMPT_SQL, [
          record.group.workspaceId,
          record.group.groupId,
          call.position,
          segmentId,
          call.contactId,
          call.dialStartedAt,
          classification.outcomeClass === 'response'
            ? (call.answeredAt ?? null)
            : null,
          observedUntilAt,
          localSlot.hourOfDay,
          localSlot.dayOfWeek,
          classification.outcomeClass,
          classification.censorReason,
          call.decisionContext?.schemaVersion ?? null,
          call.predictiveDecisionId ?? null,
          persistedDecisionContext,
          outcomeForCall(record, call),
        ]);
      }),
    );
    return true;
  } catch (cause: unknown) {
    logWarning?.('[dialer] LeadConnector learning persistence unavailable', {
      workspaceId: record.group.workspaceId,
      groupId: record.group.groupId,
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return false;
  }
};
