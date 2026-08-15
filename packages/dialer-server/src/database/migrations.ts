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
