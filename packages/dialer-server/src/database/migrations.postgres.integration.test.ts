import {COACHING_SCRIPTS_MIGRATION_ID} from '../coaching/scripts';
import { describe, expect, it } from 'bun:test';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Effect, Layer } from 'effect';
import { Pool } from 'pg';

import {
  LeadConnectorClock,
  LeadConnectorCompanyCredentialStore,
  LeadConnectorConfig,
  LeadConnectorHttpTransport,
  LeadConnectorTokenCipher,
  createLeadConnectorUserContextDecoderLayer,
  createPersistentLeadConnectorStoreLayer,
  exchangeLeadConnectorEmbedContext,
} from '@consuelo/lead-connector';
import {
  DIALER_DATABASE_LEAD_CONNECTOR_COMPANY_CREDENTIALS_MIGRATION_ID,
  migrateDialerDatabase,
  rollbackDialerDatabaseMigration,
} from './migrations';

// Opt in to a disposable *local* PostgreSQL process. Never use DATABASE_URL
// or a running customer database for destructive old-schema fixture setup.
const integrationEnabled =
  process.env.CONSUELO_RUN_LEAD_CONNECTOR_UPGRADE_POSTGRES === '1';
const suite = integrationEnabled ? describe : describe.skip;

const run = async (args: string[]): Promise<string> => {
  const processHandle = Bun.spawn(args, {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
    processHandle.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`Command ${args[0]} failed (${exitCode}): ${stderr || stdout}`);
  }
  return stdout.trim();
};

const reservePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('No loopback port allocated'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });

const encryptFixtureContext = (secret: string, context: unknown): string => {
  const salt = randomBytes(8);
  const secretBytes = Buffer.from(secret, 'utf8');
  let derived = Buffer.alloc(0);
  let previous = Buffer.alloc(0);
  while (derived.length < 48) {
    previous = createHash('md5')
      .update(Buffer.concat([previous, secretBytes, salt]))
      .digest();
    derived = Buffer.concat([derived, previous]);
  }
  const cipher = createCipheriv('aes-256-cbc', derived.subarray(0, 32), derived.subarray(32, 48));
  return Buffer.concat([
    Buffer.from('Salted__', 'utf8'),
    salt,
    cipher.update(JSON.stringify(context), 'utf8'),
    cipher.final(),
  ]).toString('base64');
};

suite('LeadConnector company credential upgrades with isolated PostgreSQL', () => {
  it('preserves existing installations, old ledger timestamps and recovered credentials, and bootstraps signed context', async () => {
    const root = await mkdtemp(join(tmpdir(), 'consuelo-lc-upgrade-'));
    const pgConfig = Bun.which('pg_config');
    let pgCtl: string | undefined;
    let started = false;
    let pool: Pool | undefined;
    try {
      if (!pgConfig) throw new Error('PostgreSQL 16+ pg_config is required for this opt-in suite');
      const binDir = await run([pgConfig, '--bindir']);
      const initDb = join(binDir, 'initdb');
      pgCtl = join(binDir, 'pg_ctl');
      const dataDirectory = join(root, 'postgres');
      const port = await reservePort();
      await run([initDb, '-D', dataDirectory, '--auth=trust', '--username=postgres', '--no-locale']);
      await run([
        pgCtl, '-D', dataDirectory, '-l', join(root, 'postgres.log'),
        '-o', `-h 127.0.0.1 -p ${port} -F`, '-w', 'start',
      ]);
      started = true;
      pool = new Pool({
        host: '127.0.0.1',
        port,
        user: 'postgres',
        database: 'postgres',
        max: 4,
      });

      // Reconstruct exactly the old applied-ledger state in this fresh cluster.
      // The production runner always creates the current schema on fresh DBs,
      // so remove only 014 and its table in this *disposable* fixture.
      await migrateDialerDatabase(pool);
      await pool.query(
        `INSERT INTO consuelo_lead_connector_installations
         (installation_id,workspace_id,location_id,access_token_ciphertext,
          refresh_token_ciphertext,expires_at,scopes,connected_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
        [
          'installation-1', 'company-1', 'location-1',
          'installation-access-ciphertext', 'installation-refresh-ciphertext',
          '2027-01-01T00:00:00.000Z', JSON.stringify(['contacts.readonly']),
          '2026-10-28T10:00:00.000Z', '2026-10-29T12:00:00.000Z',
        ],
      );
      await pool.query(
        'DELETE FROM consuelo_dialer_schema_migrations WHERE migration_id = ANY($1::text[])',
        [[DIALER_DATABASE_LEAD_CONNECTOR_COMPANY_CREDENTIALS_MIGRATION_ID,COACHING_SCRIPTS_MIGRATION_ID,'20261031_016_native_billing']],
      );
      await pool.query('DROP TABLE consuelo_lead_connector_company_credentials');

      const installationsBefore = (await pool.query(
        'SELECT * FROM consuelo_lead_connector_installations ORDER BY workspace_id',
      )).rows;
      const oldLedger = (await pool.query(
        'SELECT migration_id, applied_at FROM consuelo_dialer_schema_migrations ORDER BY migration_id',
      )).rows;
      expect(oldLedger).toHaveLength(13);
      expect((await pool.query<{ name: string | null }>(
        "SELECT to_regclass('consuelo_lead_connector_company_credentials')::text AS name",
      )).rows[0]?.name).toBeNull();

      // Actual upgrade path: migration 001 is already applied; only 014 runs.
      await migrateDialerDatabase(pool);
      expect((await pool.query<{ name: string | null }>(
        "SELECT to_regclass('consuelo_lead_connector_company_credentials')::text AS name",
      )).rows[0]?.name).toBe('consuelo_lead_connector_company_credentials');
      expect((await pool.query(
        'SELECT * FROM consuelo_lead_connector_installations ORDER BY workspace_id',
      )).rows).toEqual(installationsBefore);
      const ledgerAfterUpgrade = (await pool.query(
        'SELECT migration_id, applied_at FROM consuelo_dialer_schema_migrations ORDER BY migration_id',
      )).rows;
      expect(ledgerAfterUpgrade).toHaveLength(16);
      expect(ledgerAfterUpgrade.slice(0, 13)).toEqual(oldLedger);

      await migrateDialerDatabase(pool);
      expect((await pool.query(
        'SELECT migration_id, applied_at FROM consuelo_dialer_schema_migrations ORDER BY migration_id',
      )).rows).toEqual(ledgerAfterUpgrade);

      // Manual-recovery state: a customer has credentials in the table, but
      // their older ledger does not yet contain 014. Reapplying must not
      // overwrite encrypted tokens or metadata.
      await pool.query(
        `INSERT INTO consuelo_lead_connector_company_credentials
         (company_id,access_token_ciphertext,refresh_token_ciphertext,
          expires_at,scopes,connected_at,updated_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
        [
          'company-1', 'recovered-access-ciphertext', 'recovered-refresh-ciphertext',
          '2027-01-01T00:00:00.000Z', JSON.stringify(['contacts.readonly']),
          '2026-10-28T10:00:00.000Z', '2026-10-29T11:00:00.000Z',
        ],
      );
      const recoveredBefore = (await pool.query(
        'SELECT * FROM consuelo_lead_connector_company_credentials',
      )).rows;
      await pool.query(
        'DELETE FROM consuelo_dialer_schema_migrations WHERE migration_id = $1',
        [DIALER_DATABASE_LEAD_CONNECTOR_COMPANY_CREDENTIALS_MIGRATION_ID],
      );
      await migrateDialerDatabase(pool);
      expect((await pool.query(
        'SELECT * FROM consuelo_lead_connector_company_credentials',
      )).rows).toEqual(recoveredBefore);
      expect((await pool.query(
        'SELECT migration_id, applied_at FROM consuelo_dialer_schema_migrations WHERE migration_id <> $1 ORDER BY migration_id',
        [DIALER_DATABASE_LEAD_CONNECTOR_COMPANY_CREDENTIALS_MIGRATION_ID],
      )).rows).toEqual(ledgerAfterUpgrade.filter(row=>row.migration_id!==DIALER_DATABASE_LEAD_CONNECTOR_COMPANY_CREDENTIALS_MIGRATION_ID));

      const secret = 'fixture-only-leadconnector-context-secret';
      const layer = Layer.mergeAll(
        createPersistentLeadConnectorStoreLayer({
          database: pool,
          cache: {
            get: async () => null,
            getDelete: async () => null,
            set: async () => true,
            delete: async () => undefined,
          },
        }),
        createLeadConnectorUserContextDecoderLayer(secret),
        Layer.succeed(LeadConnectorConfig, {
          clientId: 'test-client',
          clientSecret: 'test-client-secret',
          redirectUri: 'https://example.test/callback',
          scopes: ['contacts.readonly'],
          authorizationUrl: 'https://example.test/oauth',
          apiBaseUrl: 'https://example.test',
          tokenRefreshSkewSeconds: 300,
          userType: 'Location' as const,
        }),
        Layer.succeed(LeadConnectorClock, {
          now: Effect.succeed(new Date('2026-10-29T15:00:00.000Z')),
        }),
        Layer.succeed(LeadConnectorTokenCipher, {
          encrypt: (value: string) => Effect.succeed(value),
          decrypt: (value: string) => Effect.succeed(value),
        }),
        Layer.succeed(LeadConnectorHttpTransport, {
          request: () => Effect.die('Provider request must not occur'),
        }),
      );
      const storedCompany = await Effect.runPromise(
        Effect.gen(function* () {
          const credentials = yield* LeadConnectorCompanyCredentialStore;
          return yield* credentials.getByCompanyId('company-1');
        }).pipe(Effect.provide(layer)),
      );
      expect(storedCompany?.accessTokenCiphertext).toBe('recovered-access-ciphertext');
      expect(storedCompany?.refreshTokenCiphertext).toBe('recovered-refresh-ciphertext');

      const identity = await Effect.runPromise(
        exchangeLeadConnectorEmbedContext({
          encryptedData: encryptFixtureContext(secret, {
            userId: 'provider-user-1',
            companyId: 'company-1',
            role: 'user',
            type: 'location',
            activeLocation: 'location-1',
            versionId: 'version-1',
            appStatus: 'installed',
          }),
        }).pipe(Effect.provide(layer)),
      );
      expect(identity).toEqual({
        workspaceId: 'company-1',
        userId: 'provider-user-1',
        installationId: 'installation-1',
        locationId: 'location-1',
        role: 'user',
        contextType: 'location',
      });

      await expect(
        rollbackDialerDatabaseMigration(
          pool,
          DIALER_DATABASE_LEAD_CONNECTOR_COMPANY_CREDENTIALS_MIGRATION_ID,
        ),
      ).rejects.toThrow('This migration has no supported rollback');
      expect((await pool.query(
        'SELECT * FROM consuelo_lead_connector_company_credentials',
      )).rows).toEqual(recoveredBefore);
      await migrateDialerDatabase(pool);
      expect((await pool.query(
        'SELECT * FROM consuelo_lead_connector_company_credentials',
      )).rows).toEqual(recoveredBefore);
    } finally {
      await pool?.end();
      if (started && pgCtl) {
        await run([pgCtl, '-D', join(root, 'postgres'), '-m', 'fast', '-w', 'stop']);
      }
      await rm(root, { recursive: true, force: true });
    }
  }, 120_000);
});
