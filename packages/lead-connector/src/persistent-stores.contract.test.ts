import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';

import {
  LeadConnectorInstallationStore,
  LeadConnectorOAuthStateStore,
  LeadConnectorWebhookEventStore,
  createPersistentLeadConnectorStoreLayer,
  initializeLeadConnectorPersistence,
  type LeadConnectorCache,
  type LeadConnectorDatabase,
  type LeadConnectorInstallation,
} from './index';

type Row = Record<string, unknown>;

const createHarness = () => {
  const rowsByWorkspace = new Map<string, Row>();
  const workspaceByLocation = new Map<string, string>();
  const sql: Array<{ text: string; values: readonly unknown[] }> = [];
  const cache = new Map<string, string>();
  const database: LeadConnectorDatabase = {
    query: async <T>(text: string, values: readonly unknown[] = []) => {
      sql.push({ text, values });
      if (text.includes('SELECT') && text.includes('workspace_id = $1')) {
        const row = rowsByWorkspace.get(String(values[0]));
        return { rows: row ? [row as T] : [] };
      }
      if (text.includes('SELECT') && text.includes('location_id = $1')) {
        const workspaceId = workspaceByLocation.get(String(values[0]));
        const row = workspaceId ? rowsByWorkspace.get(workspaceId) : null;
        return { rows: row ? [row as T] : [] };
      }
      if (text.includes('INSERT INTO consuelo_lead_connector_installations')) {
        const [
          installationId,
          workspaceId,
          locationId,
          access,
          refresh,
          expiresAt,
          scopes,
          connectedAt,
          updatedAt,
        ] = values.map(String);
        const previousWorkspace = workspaceByLocation.get(locationId);
        if (previousWorkspace && previousWorkspace !== workspaceId) {
          const error = Object.assign(new Error('duplicate location'), {
            code: '23505',
          });
          throw error;
        }
        const row = {
          installation_id: installationId,
          workspace_id: workspaceId,
          location_id: locationId,
          access_token_ciphertext: access,
          refresh_token_ciphertext: refresh,
          expires_at: expiresAt,
          scopes: JSON.parse(scopes),
          connected_at: connectedAt,
          updated_at: updatedAt,
        };
        rowsByWorkspace.set(workspaceId, row);
        workspaceByLocation.set(locationId, workspaceId);
        return { rows: [] as T[] };
      }
      if (text.includes('DELETE FROM consuelo_lead_connector_installations')) {
        const workspaceId = String(values[0]);
        const row = rowsByWorkspace.get(workspaceId);
        if (row) workspaceByLocation.delete(String(row.location_id));
        rowsByWorkspace.delete(workspaceId);
      }
      return { rows: [] as T[] };
    },
  };
  const cacheClient: LeadConnectorCache = {
    get: async (key) => cache.get(key) ?? null,
    getDelete: async (key) => {
      const value = cache.get(key) ?? null;
      cache.delete(key);
      return value;
    },
    set: async (key, value, options = {}) => {
      if (options.onlyIfAbsent && cache.has(key)) return false;
      cache.set(key, value);
      return true;
    },
    delete: async (key) => {
      cache.delete(key);
    },
  };
  return { database, cacheClient, sql, cache };
};

const installation: LeadConnectorInstallation = {
  installationId: 'installation-1',
  workspaceId: 'workspace-1',
  locationId: 'location-1',
  accessTokenCiphertext: 'encrypted-access',
  refreshTokenCiphertext: 'encrypted-refresh',
  expiresAt: '2026-07-25T00:00:00.000Z',
  scopes: ['contacts.readonly'],
  connectedAt: '2026-07-24T00:00:00.000Z',
  updatedAt: '2026-07-24T00:00:00.000Z',
};

describe('LeadConnector persistent runtime stores', () => {
  it('initializes durable installation schema and round-trips encrypted installation records', async () => {
    const harness = createHarness();
    await initializeLeadConnectorPersistence(harness.database);
    const layer = createPersistentLeadConnectorStoreLayer({
      database: harness.database,
      cache: harness.cacheClient,
    });
    await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* LeadConnectorInstallationStore;
        yield* store.save(installation);
        expect(yield* store.getByWorkspaceId('workspace-1')).toEqual(
          installation,
        );
        expect(yield* store.getByLocationId('location-1')).toEqual(
          installation,
        );
      }).pipe(Effect.provide(layer)),
    );
    expect(
      harness.sql.some((entry) =>
        entry.text.includes('CREATE TABLE IF NOT EXISTS'),
      ),
    ).toBe(true);
  });

  it('consumes OAuth state exactly once and claims duplicate webhooks atomically', async () => {
    const harness = createHarness();
    const layer = createPersistentLeadConnectorStoreLayer({
      database: harness.database,
      cache: harness.cacheClient,
      now: () => new Date('2026-07-24T00:00:00.000Z'),
    });
    await Effect.runPromise(
      Effect.gen(function* () {
        const oauth = yield* LeadConnectorOAuthStateStore;
        const webhooks = yield* LeadConnectorWebhookEventStore;
        yield* oauth.put({
          state: 'state-1',
          workspaceId: 'workspace-1',
          codeVerifier: 'verifier',
          redirectUri: 'https://dialer.test/oauth/callback',
          expiresAt: '2026-07-24T00:05:00.000Z',
        });
        expect(yield* oauth.consume('state-1')).toMatchObject({
          state: 'state-1',
        });
        expect(yield* oauth.consume('state-1')).toBeNull();
        expect(yield* webhooks.claim('event-1')).toBe(true);
        expect(yield* webhooks.claim('event-1')).toBe(false);
      }).pipe(Effect.provide(layer)),
    );
  });
});
