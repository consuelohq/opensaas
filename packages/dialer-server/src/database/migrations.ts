import {
  initializeLeadConnectorPersistence,
  type LeadConnectorDatabase,
} from '@consuelo/lead-connector';

import { initializeCallOperationsPersistence } from '../call-operations/persistence';
import { initializeLeadConnectorDialerLearning } from '../runtime/lead-connector-learning';

export const DIALER_DATABASE_BASELINE_MIGRATION_ID =
  '20260810_001_standalone_dialer_baseline';
export const DIALER_DATABASE_PREDICTIVE_LEARNING_MIGRATION_ID =
  '20260815_002_predictive_learning_observations';
export const DIALER_DATABASE_CONTEXTUAL_SCIENCE_MIGRATION_ID =
  '20260815_003_contextual_predictive_science';

const CREATE_MIGRATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS consuelo_dialer_schema_migrations (
    migration_id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`;

const CREATE_PREDICTIVE_LEARNING_OBSERVATIONS_SQL = `
  CREATE TABLE IF NOT EXISTS dialer_learning_observations (
    workspace_id text NOT NULL,
    group_id text NOT NULL,
    position integer NOT NULL CHECK (position > 0),
    segment_id text NOT NULL,
    contact_id text NOT NULL,
    attempted_at timestamptz NOT NULL,
    response_at timestamptz,
    observed_until_at timestamptz,
    local_hour smallint NOT NULL CHECK (local_hour BETWEEN 0 AND 23),
    local_day_of_week smallint NOT NULL CHECK (local_day_of_week BETWEEN 0 AND 6),
    outcome_class text NOT NULL CHECK (
      outcome_class IN ('response', 'non_response', 'censored')
    ),
    censor_reason text CHECK (
      censor_reason IS NULL OR
      censor_reason IN ('competing_winner', 'ambiguous_termination')
    ),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, group_id, position),
    CHECK (
      (outcome_class = 'censored' AND censor_reason IS NOT NULL) OR
      (outcome_class <> 'censored' AND censor_reason IS NULL)
    ),
    CHECK (response_at IS NULL OR response_at >= attempted_at),
    CHECK (observed_until_at IS NULL OR observed_until_at >= attempted_at)
  )
`;

const CREATE_PREDICTIVE_LEARNING_CONTACT_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS dialer_learning_observations_contact_order_idx
    ON dialer_learning_observations (
      workspace_id, contact_id, attempted_at, group_id, position
    )
`;

const CREATE_PREDICTIVE_LEARNING_SEGMENT_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS dialer_learning_observations_segment_idx
    ON dialer_learning_observations (
      workspace_id, segment_id, attempted_at, group_id, position
    )
`;

const CREATE_PREDICTIVE_LEARNING_HAZARD_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS dialer_learning_observations_hazard_idx
    ON dialer_learning_observations (
      workspace_id,
      segment_id,
      local_day_of_week,
      local_hour,
      attempted_at,
      group_id,
      position
    )
`;

const ADD_CONTEXTUAL_OBSERVATION_FIELDS_SQL = `
  ALTER TABLE dialer_learning_observations
    ADD COLUMN IF NOT EXISTS feature_schema_version smallint,
    ADD COLUMN IF NOT EXISTS decision_id text,
    ADD COLUMN IF NOT EXISTS decision_context jsonb
`;

const CREATE_CONTEXTUAL_OBSERVATION_DECISION_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS dialer_learning_observations_decision_idx
    ON dialer_learning_observations (workspace_id, decision_id)
    WHERE decision_id IS NOT NULL
`;

const CREATE_PREDICTIVE_DECISIONS_SQL = `
  CREATE TABLE IF NOT EXISTS dialer_predictive_decisions (
    decision_id text PRIMARY KEY,
    workspace_id text NOT NULL,
    segment_id text NOT NULL,
    evaluated_at timestamptz NOT NULL,
    policy_version text NOT NULL,
    model_version text NOT NULL,
    feature_schema_version smallint NOT NULL CHECK (feature_schema_version > 0),
    policy_mode text NOT NULL CHECK (
      policy_mode IN ('deterministic', 'stochastic')
    ),
    eligible_candidates jsonb NOT NULL,
    ranked_candidates jsonb NOT NULL,
    suppressed_candidates jsonb NOT NULL,
    selected_contact_ids jsonb,
    selection_probabilities jsonb,
    selected_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (
      policy_mode <> 'deterministic' OR selection_probabilities IS NULL
    )
  )
`;

const CREATE_PREDICTIVE_DECISIONS_SCOPE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS dialer_predictive_decisions_scope_idx
    ON dialer_predictive_decisions (
      workspace_id, segment_id, evaluated_at DESC, decision_id
    )
`;

type Migration = {
  id: string;
  up: (database: LeadConnectorDatabase) => Promise<void>;
};

const migrations: readonly Migration[] = [
  {
    id: DIALER_DATABASE_BASELINE_MIGRATION_ID,
    up: async (database) => {
      try {
        await initializeLeadConnectorPersistence(database);
        await initializeLeadConnectorDialerLearning(database);
        await initializeCallOperationsPersistence(database);
      } catch (cause: unknown) {
        throw new Error('Failed to initialize standalone dialer schema', {
          cause,
        });
      }
    },
  },
  {
    id: DIALER_DATABASE_PREDICTIVE_LEARNING_MIGRATION_ID,
    up: async (database) => {
      try {
        await database.query(CREATE_PREDICTIVE_LEARNING_OBSERVATIONS_SQL);
        await database.query(CREATE_PREDICTIVE_LEARNING_CONTACT_INDEX_SQL);
        await database.query(CREATE_PREDICTIVE_LEARNING_SEGMENT_INDEX_SQL);
        await database.query(CREATE_PREDICTIVE_LEARNING_HAZARD_INDEX_SQL);
      } catch (cause: unknown) {
        throw new Error('Failed to initialize predictive learning schema', {
          cause,
        });
      }
    },
  },
  {
    id: DIALER_DATABASE_CONTEXTUAL_SCIENCE_MIGRATION_ID,
    up: async (database) => {
      try {
        await database.query(ADD_CONTEXTUAL_OBSERVATION_FIELDS_SQL);
        await database.query(CREATE_CONTEXTUAL_OBSERVATION_DECISION_INDEX_SQL);
        await database.query(CREATE_PREDICTIVE_DECISIONS_SQL);
        await database.query(CREATE_PREDICTIVE_DECISIONS_SCOPE_INDEX_SQL);
      } catch (cause: unknown) {
        throw new Error('Failed to initialize contextual predictive science schema', {
          cause,
        });
      }
    },
  },
];

export const migrateDialerDatabase = async (
  database: LeadConnectorDatabase,
): Promise<void> => {
  try {
    await database.query(CREATE_MIGRATION_TABLE_SQL);
    const result = await database.query<{ migration_id: string }>(
      `SELECT migration_id FROM consuelo_dialer_schema_migrations`,
    );
    const applied = new Set(result.rows.map((row) => row.migration_id));

    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      await migration.up(database);
      await database.query(
        `INSERT INTO consuelo_dialer_schema_migrations (migration_id)
         VALUES ($1)
         ON CONFLICT (migration_id) DO NOTHING`,
        [migration.id],
      );
    }
  } catch (cause: unknown) {
    throw new Error('Failed to migrate standalone dialer database', { cause });
  }
};
