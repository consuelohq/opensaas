import { TEAM_ACCESS_MIGRATION_ID } from '../commercial/team-schema';
import { REP_DEVICES_MIGRATION_ID } from '../inbound/rep-devices';
import type { Pool } from 'pg';
import {
  DIALER_DATABASE_LEAD_CONNECTOR_COMPANY_CREDENTIALS_MIGRATION_ID,
  OUTBOUND_ACCOUNT_OWNERSHIP_MIGRATION_ID,
} from '../database/migrations';
import { COACHING_SCRIPTS_MIGRATION_ID } from '../coaching/scripts';
import { NATIVE_BILLING_MIGRATION_ID } from '../billing/native-billing-store';
export const assertDisposableInboundDatabase = (name: string) => {
  if (!/^rd[3456]_[0-9a-f]{32}$/.test(name))
    throw new Error(
      'Historical rollback fixture requires its owned disposable database',
    );
};
// Forward-only application tables stay intact; isolate the historical down-chain
// under test, as the existing disposable learning lab already does.
export const prepareHistoricalInboundRollback = async (pool: Pool) => {
  try {
    const { rows } = await pool.query<{ name: string }>(
      'SELECT current_database() AS name',
    );
    assertDisposableInboundDatabase(rows[0]?.name ?? '');
    await pool.query(
      'DELETE FROM consuelo_dialer_schema_migrations WHERE migration_id=ANY($1::text[])',
      [
        [
          DIALER_DATABASE_LEAD_CONNECTOR_COMPANY_CREDENTIALS_MIGRATION_ID,
          COACHING_SCRIPTS_MIGRATION_ID,
          NATIVE_BILLING_MIGRATION_ID,
          REP_DEVICES_MIGRATION_ID,
          TEAM_ACCESS_MIGRATION_ID,
          OUTBOUND_ACCOUNT_OWNERSHIP_MIGRATION_ID,
        ],
      ],
    );
  } catch (cause: unknown) {
    throw new Error('Historical disposable fixture setup failed', { cause });
  }
};
