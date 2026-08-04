import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import {
  RedisParallelStore,
  type Dialer,
  type ParallelTelemetryRecord,
} from '@consuelo/dialer';

import {
  LeadConnectorConfig,
  LeadConnectorInstallationStore,
  type LeadConnectorCache,
  type LeadConnectorDatabase,
} from '@consuelo/lead-connector';

import { createEffectDialerApplication } from '../application';
import { recordLeadConnectorAttemptTelemetry } from './lead-connector-learning';
import {
  createRailwayDialerApplicationLayers,
  createRailwayLeadConnectorApplicationLayer,
  selectProviderDialerForGroup,
} from './railway';

class MemoryRedis {
  readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async getDelete(key: string): Promise<string | null> {
    const value = this.values.get(key) ?? null;
    this.values.delete(key);
    return value;
  }

  async set(
    key: string,
    value: string,
    ...args: unknown[]
  ): Promise<string | null> {
    if (args.includes('NX') && this.values.has(key)) return null;
    this.values.set(key, value);
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) count += this.values.delete(key) ? 1 : 0;
    return count;
  }

  async eval(): Promise<number> {
    return 0;
  }
}

const createDatabase = (): LeadConnectorDatabase => {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    query: async <T>(text: string, values: readonly unknown[] = []) => {
      if (text.includes('INSERT INTO consuelo_lead_connector_installations')) {
        const row = {
          installation_id: String(values[0]),
          workspace_id: String(values[1]),
          location_id: String(values[2]),
          access_token_ciphertext: String(values[3]),
          refresh_token_ciphertext: String(values[4]),
          expires_at: String(values[5]),
          scopes: JSON.parse(String(values[6])),
          connected_at: String(values[7]),
          updated_at: String(values[8]),
        };
        rows.set(String(values[1]), row);
        return { rows: [] as T[] };
      }
      if (text.includes('workspace_id = $1')) {
        const row = rows.get(String(values[0]));
        return { rows: row ? [row as T] : [] };
      }
      if (text.includes('location_id = $1')) {
        const row = [...rows.values()].find(
          (candidate) => candidate.location_id === values[0],
        );
        return { rows: row ? [row as T] : [] };
      }
      return { rows: [] as T[] };
    },
  };
};

const createPredictiveDatabase = (): LeadConnectorDatabase => ({
  query: async <T>(text: string) => {
    if (text.includes('FROM contact_attempt_ledger')) {
      return {
        rows: [
          {
            contact_id: 'contact-first',
            attempts_total: 0,
            last_attempt_at: null,
          },
          {
            contact_id: 'contact-winner',
            attempts_total: 1,
            last_attempt_at: null,
          },
        ] as T[],
      };
    }
    if (text.includes('FROM core.contact_attempt_hazard_hourly_mv')) {
      return {
        rows: [
          { attempt_number: 1, answer_rate: 0.1, sample_size: 100 },
          { attempt_number: 2, answer_rate: 0.8, sample_size: 100 },
        ] as T[],
      };
    }
    if (text.includes('FROM core.workspace_settings')) {
      return {
        rows: [
          {
            value_per_connection: 100,
            cost_per_attempt: 0.03,
          },
        ] as T[],
      };
    }
    return { rows: [] as T[] };
  },
});

const createLeadConnectorLearnedDatabase = (): LeadConnectorDatabase => ({
  query: async <T>(text: string) => {
    if (text.includes('FROM contact_attempt_ledger')) {
      return {
        rows: [
          {
            contact_id: 'contact-first',
            attempts_total: 0,
            last_attempt_at: null,
          },
          {
            contact_id: 'contact-winner',
            attempts_total: 1,
            last_attempt_at: null,
          },
        ] as T[],
      };
    }
    if (text.includes('FROM core.contact_attempt_hazard_hourly_mv')) {
      return { rows: [] as T[] };
    }
    if (text.includes('FROM consuelo_lead_connector_call_outcomes')) {
      return {
        rows: [
          { attempt_number: 1, answer_rate: 0.1, sample_size: 20 },
          { attempt_number: 2, answer_rate: 0.8, sample_size: 20 },
        ] as T[],
      };
    }
    if (text.includes('FROM core.workspace_settings')) {
      return { rows: [] as T[] };
    }
    return { rows: [] as T[] };
  },
});

const environment = {
  DATABASE_URL: 'postgres://fixture',
  REDIS_URL: 'redis://fixture',
  DIALER_SERVER_PUBLIC_URL: 'https://dialer.example.test',
  TWILIO_ACCOUNT_SID: 'AC_live_fixture',
  TWILIO_AUTH_TOKEN: 'live-token-fixture',
  LEADCONNECTOR_CLIENT_ID: 'client-id',
  LEADCONNECTOR_CLIENT_SECRET: 'client-secret',
  LEADCONNECTOR_REDIRECT_URI:
    'https://dialer.example.test/integrations/leadconnector/oauth/callback',
  LEADCONNECTOR_SCOPES: 'contacts.readonly,opportunities.readonly',
  LEADCONNECTOR_TOKEN_ENCRYPTION_KEY: 'lead-connector-token-encryption-fixture',
  LEADCONNECTOR_SHARED_SECRET: 'lead-connector-shared-secret-fixture',
};

const completedTelemetryRecord: ParallelTelemetryRecord = {
  group: {
    groupId: 'pg-learning',
    conferenceName: 'conference-learning',
    status: 'completed' as const,
    winnerSid: 'CA_answered',
    calls: [
      {
        callSid: 'CA_answered',
        customerNumber: '+15550100000',
        fromNumber: '+14155550100',
        position: 1,
        status: 'completed',
        amdResult: 'human' as const,
        contactId: 'contact-winner',
        dialStartedAt: '2026-08-01T12:00:00.000Z',
        answeredAt: '2026-08-01T12:00:05.000Z',
        terminatedAt: '2026-08-01T12:00:45.000Z',
      },
    ],
    workspaceId: 'workspace-1',
    queueId: 'queue-1',
    userId: 'user-1',
    createdAt: '2026-08-01T12:00:00.000Z',
    completedAt: '2026-08-01T12:00:45.000Z',
    profile: {
      id: 'balanced',
      fanout: 1,
      staggerMs: 0,
      amdPolicy: 'human-or-unknown' as const,
      terminationPolicy: 'winner-take-all' as const,
    },
    resolverReason: 'test',
    cleanupFailures: [],
  },
  telemetry: { winnerRate: 1, wastedLegs: 0, connectLatencyMs: 5_000 },
  success: true,
};

describe('LeadConnector dialer learning', () => {
  it('records an atomic attempt and outcome for every completed carrier leg', async () => {
    const writes: Array<{ text: string; values: readonly unknown[] }> = [];
    const database: LeadConnectorDatabase = {
      query: async <T>(text: string, values: readonly unknown[] = []) => {
        writes.push({ text, values });
        return { rows: [] as T[] };
      },
    };

    const recorded = await recordLeadConnectorAttemptTelemetry(
      database,
      completedTelemetryRecord,
    );

    expect(recorded).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0].text).toContain('INSERT INTO contact_attempt_ledger');
    expect(writes[0].text).toContain(
      'INSERT INTO consuelo_lead_connector_call_outcomes',
    );
    expect(writes[0].values).toEqual([
      'workspace-1',
      'contact-winner',
      '2026-08-01T12:00:00.000Z',
      'answered',
    ]);
  });

  it('does not fail carrier callback handling when learning persistence is unavailable', async () => {
    const database: LeadConnectorDatabase = {
      query: async () => {
        throw new Error('database unavailable');
      },
    };

    await expect(
      recordLeadConnectorAttemptTelemetry(
        database,
        completedTelemetryRecord,
        () => undefined,
      ),
    ).resolves.toBe(false);
  });
});

describe('Railway dialer-server runtime composition', () => {
  it('selects the test dialer for follow-up operations on test-mode groups', async () => {
    const redis = new MemoryRedis();
    const parallelStore = new RedisParallelStore(redis);
    const liveDialer = { parallel: {} } as unknown as Dialer;
    const testDialer = { parallel: {} } as unknown as Dialer;
    await parallelStore.setGroup(
      'group-test',
      JSON.stringify({ providerMode: 'twilio-test' }),
      60,
    );

    const selected = await selectProviderDialerForGroup(
      { liveDialer, testDialer, parallelStore },
      'group-test',
    );

    expect(selected).toBe(testDialer);
  });

  it('keeps existing groups without a provider mode on the live dialer', async () => {
    const redis = new MemoryRedis();
    const parallelStore = new RedisParallelStore(redis);
    const liveDialer = { parallel: {} } as unknown as Dialer;
    const testDialer = { parallel: {} } as unknown as Dialer;
    await parallelStore.setGroup('group-live', JSON.stringify({}), 60);

    const selected = await selectProviderDialerForGroup(
      { liveDialer, testDialer, parallelStore },
      'group-live',
    );

    expect(selected).toBe(liveDialer);
  });

  it('fails closed when a test-mode group outlives its test credentials', async () => {
    const redis = new MemoryRedis();
    const parallelStore = new RedisParallelStore(redis);
    const liveDialer = { parallel: {} } as unknown as Dialer;
    await parallelStore.setGroup(
      'group-test',
      JSON.stringify({ providerMode: 'twilio-test' }),
      60,
    );

    await expect(
      selectProviderDialerForGroup(
        { liveDialer, testDialer: null, parallelStore },
        'group-test',
      ),
    ).rejects.toThrow('Provider test credentials are not configured');
  });

  it('composes durable LeadConnector configuration and encrypted installation storage', async () => {
    const redis = new MemoryRedis();
    const database = createDatabase();
    const layer = await createRailwayLeadConnectorApplicationLayer(
      environment,
      {
        database,
        cache: redis as unknown as LeadConnectorCache,
      },
    );
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* LeadConnectorConfig;
        const installations = yield* LeadConnectorInstallationStore;
        yield* installations.save({
          installationId: 'installation-1',
          workspaceId: 'workspace-1',
          locationId: 'location-1',
          accessTokenCiphertext: 'encrypted-access',
          refreshTokenCiphertext: 'encrypted-refresh',
          expiresAt: '2026-07-25T00:00:00.000Z',
          scopes: ['contacts.readonly'],
          connectedAt: '2026-07-24T00:00:00.000Z',
          updatedAt: '2026-07-24T00:00:00.000Z',
        });
        return {
          clientId: config.clientId,
          installation: yield* installations.getByLocationId('location-1'),
        };
      }).pipe(Effect.provide(layer)),
    );
    expect(result.clientId).toBe('client-id');
    expect(result.installation).toMatchObject({
      installationId: 'installation-1',
      workspaceId: 'workspace-1',
      locationId: 'location-1',
    });
  });

  it('ranks predictive LeadConnector targets with shared model data before fanout', async () => {
    const redis = new MemoryRedis();
    const layers = await createRailwayDialerApplicationLayers(environment, {
      redis,
      database: createPredictiveDatabase(),
    });
    const application = createEffectDialerApplication(layers);
    const result = await Effect.runPromise(
      application.startCallSession({
        workspaceId: 'workspace-1',
        userId: 'provider-user-1',
        input: {
          source: 'queue',
          selectionStrategy: 'predictive',
          requestedFanout: 1,
          targetPhones: ['+15550100000', '+15550100001'],
          contactIds: ['contact-first', 'contact-winner'],
          callMode: 'mock',
        },
      }),
    );

    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]).toMatchObject({
      contactId: 'contact-winner',
      status: 'mocked',
    });
  });

  it('ranks predictive targets from LeadConnector learned outcomes without Twenty model rows', async () => {
    const redis = new MemoryRedis();
    const layers = await createRailwayDialerApplicationLayers(environment, {
      redis,
      database: createLeadConnectorLearnedDatabase(),
    });
    const application = createEffectDialerApplication(layers);
    const result = await Effect.runPromise(
      application.startCallSession({
        workspaceId: 'workspace-1',
        userId: 'provider-user-1',
        input: {
          source: 'queue',
          selectionStrategy: 'predictive',
          requestedFanout: 1,
          targetPhones: ['+15550100000', '+15550100001'],
          contactIds: ['contact-first', 'contact-winner'],
          callMode: 'mock',
        },
      }),
    );

    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]).toMatchObject({
      contactId: 'contact-winner',
      status: 'mocked',
    });
  });

  it('starts a mock standalone call session without Twenty or the compatibility API', async () => {
    const redis = new MemoryRedis();
    const layers = await createRailwayDialerApplicationLayers(environment, {
      redis,
    });
    const application = createEffectDialerApplication(layers);
    const result = await Effect.runPromise(
      application.startCallSession({
        workspaceId: 'workspace-1',
        userId: 'provider-user-1',
        input: {
          source: 'direct',
          selectionStrategy: 'single',
          requestedFanout: 1,
          targetPhone: '+15550100000',
          contactId: 'contact-1',
          callMode: 'mock',
        },
      }),
    );
    expect(result).toMatchObject({
      selectionStrategy: 'single',
      requestedFanout: 1,
      actualFanout: 1,
      status: 'mocked',
      calls: [{ contactId: 'contact-1', status: 'mocked' }],
    });
  });
});
