import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import {
  migrateDialerDatabase, rollbackDialerDatabaseMigration,
  DIALER_DATABASE_LEARNING_INTEGRITY_MIGRATION_ID,
  DIALER_DATABASE_CONTEXTUAL_SCIENCE_HARDENING_MIGRATION_ID,
  DIALER_DATABASE_CONTEXTUAL_SCIENCE_MIGRATION_ID,
  DIALER_DATABASE_PREDICTIVE_LEARNING_MIGRATION_ID,
} from '../database/migrations';
import { INBOUND_MIGRATION_ID } from '../inbound/migration';
import { REP_CAPACITY_MIGRATION_ID } from '../inbound/rep-capacity-migration';

// The outer transaction restores this isolated fixture after exercising destructive down paths.
export const verifyLearningRollbackChain = async (pool: Pool): Promise<true> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const database = {
      query: <TRow>(text: string, values?: readonly unknown[]) =>
        client.query<Record<string, unknown>>(text, values ? [...values] : undefined)
          .then((result) => ({ rows: result.rows as TRow[], rowCount: result.rowCount })),
    };
    const baseline = await client.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM consuelo_lead_connector_call_outcomes',
    );
    const original = await client.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM dialer_learning_observations',
    );
    await client.query('SAVEPOINT newer_migration_guard');
    await assert.rejects(() => rollbackDialerDatabaseMigration(
      database, DIALER_DATABASE_CONTEXTUAL_SCIENCE_HARDENING_MIGRATION_ID,
    ));
    await client.query('ROLLBACK TO SAVEPOINT newer_migration_guard');
    for (const id of [REP_CAPACITY_MIGRATION_ID, INBOUND_MIGRATION_ID, DIALER_DATABASE_LEARNING_INTEGRITY_MIGRATION_ID,
      DIALER_DATABASE_CONTEXTUAL_SCIENCE_HARDENING_MIGRATION_ID, DIALER_DATABASE_CONTEXTUAL_SCIENCE_MIGRATION_ID]) {
      await rollbackDialerDatabaseMigration(database, id);
    }
    const retained = await client.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM dialer_learning_observations',
    );
    assert.equal(retained.rows[0]?.count, original.rows[0]?.count);
    const columns = await client.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM information_schema.columns WHERE table_name='dialer_learning_observations' AND column_name IN ('feature_schema_version','decision_id','decision_context')",
    );
    assert.equal(columns.rows[0]?.count, 0);
    const removedDecisions = await client.query<{ name: string | null }>(
      "SELECT to_regclass('dialer_predictive_decisions')::text AS name",
    );
    assert.equal(removedDecisions.rows[0]?.name, null);
    await rollbackDialerDatabaseMigration(database, DIALER_DATABASE_PREDICTIVE_LEARNING_MIGRATION_ID);
    const removed = await client.query<{ name: string | null }>(
      "SELECT to_regclass('dialer_learning_observations')::text AS name",
    );
    assert.equal(removed.rows[0]?.name, null);
    const ledger = await client.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM consuelo_dialer_schema_migrations',
    );
    assert.equal(ledger.rows[0]?.count, 1);
    await migrateDialerDatabase(database);
    const restored = await client.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM consuelo_dialer_schema_migrations',
    );
    assert.equal(restored.rows[0]?.count, 7);
    const emptyLearning = await client.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM dialer_learning_observations',
    );
    assert.equal(emptyLearning.rows[0]?.count, 0);
    const preserved = await client.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM consuelo_lead_connector_call_outcomes',
    );
    assert.equal(preserved.rows[0]?.count, baseline.rows[0]?.count);
    return true;
  } catch (cause: unknown) {
    throw new Error('Learning rollback chain proof failed', { cause });
  } finally {
    try { await client.query('ROLLBACK'); } finally { client.release(); }
  }
};
