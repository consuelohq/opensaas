import { describe, expect, it } from 'bun:test';

import type { LeadConnectorDatabase } from '@consuelo/lead-connector';

import {
  DIALER_DATABASE_BASELINE_MIGRATION_ID,
  migrateDialerDatabase,
} from './migrations';

const createDatabaseHarness = () => {
  const applied = new Set<string>();
  const calls: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: LeadConnectorDatabase = {
    query: async <T>(text: string, values: readonly unknown[] = []) => {
      calls.push({ text, values });
      if (
        text.includes(
          'SELECT migration_id FROM consuelo_dialer_schema_migrations',
        )
      ) {
        return {
          rows: [...applied].map((migration_id) => ({ migration_id })) as T[],
        };
      }
      if (
        text.includes('INSERT INTO consuelo_dialer_schema_migrations') &&
        values[0]
      ) {
        applied.add(String(values[0]));
      }
      return { rows: [] as T[] };
    },
  };
  return { database, calls, applied };
};

describe('dialer database migrations', () => {
  it('owns the complete standalone Postgres schema without Twenty compatibility tables', async () => {
    const harness = createDatabaseHarness();

    await migrateDialerDatabase(harness.database);

    const sql = harness.calls.map((call) => call.text).join('\n');
    expect(sql).toContain('consuelo_dialer_schema_migrations');
    expect(sql).toContain('consuelo_lead_connector_installations');
    expect(sql).toContain('contact_attempt_ledger');
    expect(sql).toContain('consuelo_lead_connector_call_outcomes');
    expect(sql).toContain('dialer_workspace_settings');
    expect(sql).toContain('dialer_call_sessions');
    expect(sql).toContain('dialer_call_legs');
    expect(sql).toContain('dialer_transcript_segments');
    expect(sql).toContain('dialer_call_events');
    expect(sql).not.toContain('core.workspace_settings');
    expect(sql).not.toContain('core.contact_attempt_hazard_hourly_mv');
    expect(harness.applied).toEqual(
      new Set([DIALER_DATABASE_BASELINE_MIGRATION_ID]),
    );
  });

  it('adopts an existing schema once and skips an already-applied baseline', async () => {
    const harness = createDatabaseHarness();

    await migrateDialerDatabase(harness.database);
    await migrateDialerDatabase(harness.database);

    const callSessionCreates = harness.calls.filter((call) =>
      call.text.includes('CREATE TABLE IF NOT EXISTS dialer_call_sessions'),
    );
    const migrationInserts = harness.calls.filter((call) =>
      call.text.includes('INSERT INTO consuelo_dialer_schema_migrations'),
    );

    expect(callSessionCreates).toHaveLength(1);
    expect(migrationInserts).toHaveLength(1);
  });
});
