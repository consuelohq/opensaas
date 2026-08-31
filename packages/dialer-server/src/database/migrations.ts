import {
  initializeLeadConnectorPersistence,
  type LeadConnectorDatabase,
} from '@consuelo/lead-connector';

import { initializeCallOperationsPersistence } from '../call-operations/persistence';
import { initializeLeadConnectorDialerLearning } from '../runtime/lead-connector-learning';

export const DIALER_DATABASE_BASELINE_MIGRATION_ID =
  '20260810_001_standalone_dialer_baseline';

const CREATE_MIGRATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS consuelo_dialer_schema_migrations (
    migration_id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
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
