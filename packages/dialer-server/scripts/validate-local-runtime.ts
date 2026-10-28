import { Effect } from 'effect';
import {
  LeadConnectorInstallationStore,
  LeadConnectorOAuthStateStore,
  LeadConnectorWebhookEventStore,
} from '@consuelo/lead-connector';
import { createEffectDialerApplication } from '../src/application.js';
import {
  createRailwayDialerApplicationLayers,
  createRailwayLeadConnectorApplicationLayer,
} from '../src/runtime/railway.js';

const { Pool } = await import('pg');
const Redis = (await import('ioredis')).default;
const pool = new Pool({ connectionString: 'postgresql://localhost/postgres' });
const rawRedis = new Redis('redis://127.0.0.1:6379');
type RedisSet = (
  key: string,
  value: string,
  ...args: Array<string | number>
) => Promise<string | null>;
const setRedis = rawRedis.set.bind(rawRedis) as unknown as RedisSet;
const database = {
  query: <T>(text: string, values?: readonly unknown[]) =>
    pool.query<T>(text, values as unknown[] | undefined),
};
const cache = {
  get: (key: string) => rawRedis.get(key),
  getDelete: (key: string) =>
    rawRedis
      .eval(
        "local value=redis.call('GET',KEYS[1]); if value then redis.call('DEL',KEYS[1]); end; return value",
        1,
        key,
      )
      .then((value) => (typeof value === 'string' ? value : null)),
  set: (
    key: string,
    value: string,
    options: { ttlSeconds?: number; onlyIfAbsent?: boolean } = {},
  ) => {
    const args: Array<string | number> = [];
    if (options.ttlSeconds) args.push('EX', options.ttlSeconds);
    if (options.onlyIfAbsent) args.push('NX');
    return setRedis(key, value, ...args).then((result) => result === 'OK');
  },
  delete: (key: string) => rawRedis.del(key).then(() => undefined),
};
const redis = {
  get: (key: string) => rawRedis.get(key),
  set: (key: string, value: string, ...args: unknown[]) =>
    setRedis(key, value, ...(args as Array<string | number>)),
  del: (...keys: string[]) => rawRedis.del(...keys),
  eval: (script: string, numberOfKeys: number, ...args: unknown[]) =>
    rawRedis.eval(script, numberOfKeys, ...args).then(Number),
};
const environment = {
  DATABASE_URL: 'postgresql://localhost/postgres',
  REDIS_URL: 'redis://127.0.0.1:6379',
  DIALER_SERVER_PUBLIC_URL: 'https://dialer.local.test',
  TWILIO_ACCOUNT_SID: 'AC00000000000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'fixture-token',
  LEADCONNECTOR_CLIENT_ID: 'fixture-client',
  LEADCONNECTOR_CLIENT_SECRET: 'fixture-secret',
  LEADCONNECTOR_REDIRECT_URI:
    'https://dialer.local.test/integrations/leadconnector/oauth/callback',
  LEADCONNECTOR_SCOPES: 'contacts.readonly,opportunities.readonly',
  LEADCONNECTOR_TOKEN_ENCRYPTION_KEY:
    'local-lead-connector-token-encryption-key',
  LEADCONNECTOR_SHARED_SECRET: 'local-lead-connector-shared-secret',
};
const workspaceId = 'branch-seven-local-runtime';
const locationId = 'branch-seven-local-location';
try {
  const leadLayer = await createRailwayLeadConnectorApplicationLayer(
    environment,
    { database, cache },
  );
  const lead = await Effect.runPromise(
    Effect.gen(function* () {
      const installations = yield* LeadConnectorInstallationStore;
      const oauth = yield* LeadConnectorOAuthStateStore;
      const webhooks = yield* LeadConnectorWebhookEventStore;
      yield* installations.save({
        installationId: 'local-installation',
        workspaceId,
        locationId,
        accessTokenCiphertext: 'encrypted-access',
        refreshTokenCiphertext: 'encrypted-refresh',
        expiresAt: '2026-07-25T00:00:00.000Z',
        scopes: ['contacts.readonly'],
        connectedAt: '2026-07-24T00:00:00.000Z',
        updatedAt: '2026-07-24T00:00:00.000Z',
      });
      yield* oauth.put({
        state: 'local-state',
        workspaceId,
        codeVerifier: 'verifier',
        redirectUri: 'https://dialer.local.test/callback',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
      return {
        installation: yield* installations.getByLocationId(locationId),
        oauthFirst: yield* oauth.consume('local-state'),
        oauthSecond: yield* oauth.consume('local-state'),
        webhookFirst: yield* webhooks.claim('local-event'),
        webhookSecond: yield* webhooks.claim('local-event'),
      };
    }).pipe(Effect.provide(leadLayer)),
  );
  const dialerLayers = await createRailwayDialerApplicationLayers(environment, {
    redis,
  });
  const call = await Effect.runPromise(
    createEffectDialerApplication(dialerLayers).startCallSession({
      workspaceId,
      userId: 'local-user',
      input: {
        source: 'direct',
        selectionStrategy: 'single',
        requestedFanout: 1,
        targetPhone: '+15550100000',
        contactId: 'contact-local',
        callMode: 'mock',
      },
    }),
  );
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      installationScoped: lead.installation?.workspaceId === workspaceId,
      oauthSingleUse: Boolean(lead.oauthFirst) && lead.oauthSecond === null,
      webhookIdempotent:
        lead.webhookFirst === true && lead.webhookSecond === false,
      mockCall: call.status === 'mocked' && call.actualFanout === 1,
    })}\n`,
  );
} finally {
  await pool.query(
    'DELETE FROM consuelo_lead_connector_installations WHERE workspace_id = $1',
    [workspaceId],
  );
  const keys = await rawRedis.keys('consuelo:leadconnector:*');
  if (keys.length > 0) await rawRedis.del(...keys);
  await rawRedis.quit();
  await pool.end();
}
process.exit(0);
