import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';

type PersistenceModule = {
  COMMERCIAL_SCHEMA_STATEMENTS: readonly string[];
  initializeCommercialPersistence: (client: {
    query: (sql: string, parameters?: readonly unknown[]) => Promise<unknown>;
  }) => Effect.Effect<void, unknown>;
  createCommercialPersistence: (client: {
    query: (sql: string, parameters?: readonly unknown[]) => Promise<{
      rows: unknown[];
      rowCount?: number;
    }>;
  }) => {
    claimProviderEvent: (input: {
      workspaceId: string;
      source: string;
      sourceId: string;
    }) => Effect.Effect<boolean, unknown>;
    saveSeatAssignment: (input: {
      workspaceId: string;
      userId: string;
      planCode: string;
    }) => Effect.Effect<void, unknown>;
    listActiveNumbersForUser: (
      workspaceId: string,
      userId: string,
    ) => Effect.Effect<unknown[], unknown>;
  };
};

const loadPersistence = async (): Promise<PersistenceModule> =>
  (await import('./commercial/persistence.ts')) as PersistenceModule;

describe('commercial persistence contracts', () => {
  it('owns every required commercial relation with tenant and provider idempotency constraints', async () => {
    const module = await loadPersistence();
    const schema = module.COMMERCIAL_SCHEMA_STATEMENTS.join('\n').toLowerCase();

    for (const relation of [
      'dialer_plan_catalog',
      'dialer_workspace_subscriptions',
      'dialer_workspace_subscription_items',
      'dialer_team_seats',
      'dialer_workspace_telephony_accounts',
      'dialer_phone_numbers',
      'dialer_usage_events',
      'dialer_provider_webhook_events',
      'dialer_installation_lifecycle_events',
    ]) {
      expect(schema).toContain(relation);
    }
    expect(schema).toContain('workspace_id');
    expect(schema).toContain('unique');
    expect(schema).toContain('source_id');
    expect(schema).toContain('check');
    expect(schema).not.toContain('drop table');
  });

  it('initializes the schema deterministically and safely more than once', async () => {
    const module = await loadPersistence();
    const query = mock(
      async (_sql: string, _parameters?: readonly unknown[]) => ({ rows: [] }),
    );
    const client = { query };

    await Effect.runPromise(module.initializeCommercialPersistence(client));
    await Effect.runPromise(module.initializeCommercialPersistence(client));

    expect(query).toHaveBeenCalledTimes(
      module.COMMERCIAL_SCHEMA_STATEMENTS.length * 2,
    );
    for (const [statement] of query.mock.calls) {
      expect(String(statement).toLowerCase()).toContain('if not exists');
    }
  });

  it('uses bound tenant parameters and atomically claims provider events', async () => {
    const module = await loadPersistence();
    const calls: Array<{ sql: string; parameters?: readonly unknown[] }> = [];
    const query = mock(async (sql: string, parameters?: readonly unknown[]) => {
      calls.push({ sql, parameters });
      if (sql.includes('dialer_provider_webhook_events')) {
        return { rows: [{ inserted: true }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    const persistence = module.createCommercialPersistence({ query });

    expect(
      await Effect.runPromise(
        persistence.claimProviderEvent({
          workspaceId: 'workspace-one',
          source: 'stripe',
          sourceId: 'evt_123',
        }),
      ),
    ).toBe(true);
    await Effect.runPromise(
      persistence.saveSeatAssignment({
        workspaceId: 'workspace-one',
        userId: 'user-one',
        planCode: 'standard',
      }),
    );
    await Effect.runPromise(
      persistence.listActiveNumbersForUser('workspace-one', 'user-one'),
    );

    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const call of calls) {
      expect(call.sql).not.toContain('workspace-one');
      expect(call.parameters).toContain('workspace-one');
    }
    expect(
      calls.find((call) =>
        call.sql.includes('dialer_provider_webhook_events'),
      )?.sql.toLowerCase(),
    ).toContain('on conflict');
  });
});
