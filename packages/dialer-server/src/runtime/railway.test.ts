import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';

import {
  LeadConnectorConfig,
  LeadConnectorInstallationStore,
  type LeadConnectorCache,
  type LeadConnectorDatabase,
} from '@consuelo/lead-connector';

import { createEffectDialerApplication } from '../application';
import {
  createRailwayDialerApplicationLayers,
  createRailwayLeadConnectorApplicationLayer,
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

describe('Railway dialer-server runtime composition', () => {
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
