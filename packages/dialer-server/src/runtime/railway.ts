import { randomUUID } from 'node:crypto';

import {
  CallerIdLockService,
  Dialer,
  DialerCallRepository,
  DialerCallRuntime,
  DialerIdGenerator,
  DialerInfrastructureError,
  DialerRequestError,
  DialerTargetRepository,
  ParallelCompatibilityRuntime,
  RedisLockStore,
  RedisParallelStore,
  type CallableTarget,
  type DialerCallRepositoryService,
  type DialerCallRuntimeService,
  type DialerTargetRepositoryService,
  type ParallelCompatibilityRuntimeService,
  type ParallelDialProfile,
  type ParallelProviderMode,
  type ParallelTelemetryRecord,
  type RedisParallelClient,
} from '@consuelo/dialer';
import {
  createLeadConnectorConfigLayer,
  createLeadConnectorFetchTransportLayer,
  createLeadConnectorTokenCipherLayer,
  createLeadConnectorUserContextDecoderLayer,
  createLeadConnectorWebhookVerifierLayer,
  createPersistentLeadConnectorStoreLayer,
  liveLeadConnectorClockLayer,
  liveLeadConnectorRandomLayer,
  type LeadConnectorCache,
  type LeadConnectorDatabase,
} from '@consuelo/lead-connector';
import { Effect, Layer } from 'effect';
import type StripeSdk from 'stripe';

import type { DialerApplicationLayers } from '../application';
import { createStripeCommercialBilling } from '../billing/stripe';
import { createCallOperationsApplication } from '../call-operations/application';
import { createCommercialApplication } from '../commercial/application';
import { initializeCommercialPersistence } from '../commercial/persistence';
import { createTwilioCommercialNumberProvider } from '../numbers/commercial-provider';
import { createTransferApplication } from '../transfers/application';
import { createPostgresTransferRepository } from '../transfers/persistence';
import { createGroqSpeechToTextProvider } from '../call-operations/groq';
import {
  createPostgresCallOperationsRepository,
  initializeCallOperationsPersistence,
} from '../call-operations/persistence';
import { migrateDialerDatabase } from '../database/migrations';
import type { LeadConnectorApplicationLayer } from '../lead-connector-application';
import { loadDialerPlanCatalog } from '../plans/catalog';
import {
  buildProviderGroupOptions,
  resolveProviderCallerId,
  resolveTwilioProviderCredentials,
} from './twilio-provider-mode';
import {
  recordLeadConnectorAttemptTelemetry,
} from './lead-connector-learning';
import { rankPredictiveLeadConnectorTargets } from './predictive-target-ranking';

import { normalizeAsyncError } from '../errors/normalize-async-error';

export type RailwayEnvironment = Record<string, string | undefined>;

export type RailwayRedisClient = RedisParallelClient;

export type RailwayRuntimeResources = {
  database?: LeadConnectorDatabase;
  cache?: LeadConnectorCache;
  redis?: RailwayRedisClient;
};

type PgPoolLike = {
  query: <T>(
    text: string,
    values?: readonly unknown[],
  ) => Promise<{ rows: T[]; rowCount?: number | null }>;
};

type IoredisLike = {
  get: (key: string) => Promise<string | null>;
  set: (
    key: string,
    value: string,
    ...args: unknown[]
  ) => Promise<string | null>;
  del: (...keys: string[]) => Promise<number>;
  eval: (
    script: string,
    numberOfKeys: number,
    ...args: unknown[]
  ) => Promise<unknown>;
};

const required = (environment: RailwayEnvironment, key: string): string => {
  const value = environment[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
};

const commaSeparated = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const positiveInteger = (
  environment: RailwayEnvironment,
  key: string,
  fallback: number,
): number => {
  const value = Number(environment[key] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }
  return value;
};

const normalizePhone = (value: unknown): string => {
  const normalized = String(value ?? '').replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new DialerRequestError({
      code: 'INVALID_PHONE_NUMBER',
      message: 'Phone number must use E.164 format',
      retryable: false,
    });
  }
  return normalized;
};

const infrastructureFailure = (
  operation: string,
  cause: unknown,
): DialerInfrastructureError =>
  new DialerInfrastructureError({
    operation,
    message: cause instanceof Error ? cause.message : String(cause),
    retryable: true,
    cause,
  });

const tryEffect = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => infrastructureFailure(operation, cause),
  });

const writeRuntimeEvent = (event: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify(event)}\n`);
};

const syncEffect = <A>(operation: string, run: () => A) =>
  Effect.try({
    try: run,
    catch: (cause) =>
      cause instanceof DialerRequestError
        ? cause
        : infrastructureFailure(operation, cause),
  });

const profileRegistry: Record<string, ParallelDialProfile> = {
  balanced: {
    id: 'balanced',
    fanout: 3,
    staggerMs: 500,
    amdPolicy: 'human-or-unknown',
    terminationPolicy: 'winner-take-all',
  },
  aggressive: {
    id: 'aggressive',
    fanout: 4,
    staggerMs: 250,
    amdPolicy: 'human-only',
    terminationPolicy: 'winner-take-all',
  },
  conservative: {
    id: 'conservative',
    fanout: 2,
    staggerMs: 900,
    amdPolicy: 'human-or-unknown',
    terminationPolicy: 'winner-take-all',
  },
};

const selectedProfile = (profileId: string | undefined): ParallelDialProfile =>
  profileRegistry[profileId ?? 'balanced'] ?? profileRegistry.balanced;

const createRedisAdapters = (redis: IoredisLike) => ({
  redis: {
    get: (key: string) => redis.get(key),
    set: (key: string, value: string, ...args: unknown[]) =>
      redis.set(key, value, ...args),
    del: (...keys: string[]) => redis.del(...keys),
    eval: (script: string, numberOfKeys: number, ...args: unknown[]) =>
      redis.eval(script, numberOfKeys, ...args).then(Number),
  } satisfies RailwayRedisClient,
  cache: {
    get: (key: string) => redis.get(key),
    getDelete: (key: string) =>
      redis
        .eval(
          "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value",
          1,
          key,
        )
        .then((result) => (typeof result === 'string' ? result : null)),
    set: (
      key: string,
      value: string,
      options: { ttlSeconds?: number; onlyIfAbsent?: boolean } = {},
    ) => {
      const args: unknown[] = [];
      if (options.ttlSeconds) args.push('EX', options.ttlSeconds);
      if (options.onlyIfAbsent) args.push('NX');
      return redis.set(key, value, ...args).then((result) => result === 'OK');
    },
    delete: (key: string) => redis.del(key).then(() => undefined),
  } satisfies LeadConnectorCache,
});

let sharedResources:
  | Promise<{
      database: LeadConnectorDatabase;
      redis: RailwayRedisClient;
      cache: LeadConnectorCache;
    }>
  | undefined;

const createSharedResources = async (environment: RailwayEnvironment) => {
  if (!sharedResources) {
    sharedResources = (async () => {
      const [{ Pool }, RedisModule] = await Promise.all([
        import('pg'),
        import('ioredis'),
      ]);
      const pool = new Pool({
        connectionString: required(environment, 'DATABASE_URL'),
        max: Number(environment.DIALER_SERVER_DATABASE_POOL_SIZE ?? '10'),
      }) as PgPoolLike;
      const Redis = RedisModule.default;
      const redis = new Redis(required(environment, 'REDIS_URL'), {
        maxRetriesPerRequest: 2,
        lazyConnect: true,
      }) as unknown as IoredisLike & { connect: () => Promise<void> };
      await redis.connect();
      const adapters = createRedisAdapters(redis);
      return {
        database: {
          query: (text, values) => pool.query(text, values),
        } satisfies LeadConnectorDatabase,
        ...adapters,
      };
    })().catch((cause) => {
      sharedResources = undefined;
      throw cause;
    });
  }
  return sharedResources;
};

const resolveLeadConnectorResources = (
  environment: RailwayEnvironment,
  resources: RailwayRuntimeResources,
) => {
  if (resources.database && resources.cache) {
    return Promise.resolve({
      database: resources.database,
      cache: resources.cache,
    });
  }
  return createSharedResources(environment).then((shared) => ({
    database: shared.database,
    cache: shared.cache,
  }));
};

export const createRailwayLeadConnectorApplicationLayer = async (
  environment: RailwayEnvironment,
  resources: RailwayRuntimeResources = {},
): Promise<LeadConnectorApplicationLayer> => {
  try {
    const resolved = await resolveLeadConnectorResources(
      environment,
      resources,
    );
    await migrateDialerDatabase(resolved.database);
    const scopes = commaSeparated(environment.LEADCONNECTOR_SCOPES);
    if (scopes.length === 0)
      throw new Error('LEADCONNECTOR_SCOPES is required');
    return Layer.mergeAll(
      createLeadConnectorConfigLayer({
        clientId: required(environment, 'LEADCONNECTOR_CLIENT_ID'),
        clientSecret: required(environment, 'LEADCONNECTOR_CLIENT_SECRET'),
        redirectUri: required(environment, 'LEADCONNECTOR_REDIRECT_URI'),
        scopes,
        apiBaseUrl: environment.LEADCONNECTOR_API_BASE_URL,
        authorizationUrl: environment.LEADCONNECTOR_AUTHORIZATION_URL,
        tokenRefreshSkewSeconds: Number(
          environment.LEADCONNECTOR_TOKEN_REFRESH_SKEW_SECONDS ?? '300',
        ),
        userType: 'Location',
      }),
      createLeadConnectorFetchTransportLayer(fetch),
      createLeadConnectorTokenCipherLayer(
        required(environment, 'LEADCONNECTOR_TOKEN_ENCRYPTION_KEY'),
      ),
      createLeadConnectorUserContextDecoderLayer(
        required(environment, 'LEADCONNECTOR_SHARED_SECRET'),
      ),
      createLeadConnectorWebhookVerifierLayer({
        currentPublicKey: environment.LEADCONNECTOR_WEBHOOK_PUBLIC_KEY,
        legacyPublicKey: environment.LEADCONNECTOR_LEGACY_WEBHOOK_PUBLIC_KEY,
      }),
      createPersistentLeadConnectorStoreLayer({
        database: resolved.database,
        cache: resolved.cache,
      }),
      liveLeadConnectorClockLayer,
      liveLeadConnectorRandomLayer,
    );
  } catch (cause: unknown) {
    throw new Error('LeadConnector runtime composition failed', { cause });
  }
};

export const createRailwayCallOperationsApplication = async (
  environment: RailwayEnvironment,
  resources: RailwayRuntimeResources = {},
) => {
  try {
    const shared = resources.database
      ? null
      : await createSharedResources(environment);
    const database = resources.database ?? shared!.database;
    await migrateDialerDatabase(database);
    const repository = createPostgresCallOperationsRepository(database);
    const recovered = await Effect.runPromise(
      repository.recoverInterruptedTranscriptions(),
    );
    if (recovered > 0) {
      writeRuntimeEvent({
        event: 'dialer.transcription.recovered',
        count: recovered,
      });
    }
    const publicUrl = required(environment, 'DIALER_SERVER_PUBLIC_URL');
    const streamUrl = new URL('/webhooks/twilio/media', publicUrl);
    streamUrl.protocol = streamUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const chunkBytes = positiveInteger(
      environment,
      'DIALER_TRANSCRIPTION_CHUNK_BYTES',
      160_000,
    );
    const maxBufferBytesPerTrack = positiveInteger(
      environment,
      'DIALER_TRANSCRIPTION_MAX_BUFFER_BYTES',
      240_000,
    );
    if (maxBufferBytesPerTrack < chunkBytes) {
      throw new Error(
        'DIALER_TRANSCRIPTION_MAX_BUFFER_BYTES must be at least DIALER_TRANSCRIPTION_CHUNK_BYTES',
      );
    }
    return createCallOperationsApplication({
      repository,
      speechToTextProvider: createGroqSpeechToTextProvider({
        apiKey: environment.GROQ_API_KEY?.trim() ?? '',
        baseUrl: environment.GROQ_API_BASE_URL?.trim(),
      }),
      config: {
        model:
          environment.GROQ_TRANSCRIPTION_MODEL?.trim() ??
          'whisper-large-v3-turbo',
        chunkBytes,
        maxBufferBytesPerTrack,
        providerTimeoutMs: positiveInteger(
          environment,
          'DIALER_TRANSCRIPTION_TIMEOUT_MS',
          30_000,
        ),
        maxConcurrentTranscriptions: positiveInteger(
          environment,
          'DIALER_TRANSCRIPTION_MAX_CONCURRENCY',
          4,
        ),
        maxSessions: positiveInteger(
          environment,
          'DIALER_TRANSCRIPTION_MAX_SESSIONS',
          100,
        ),
        streamUrl: streamUrl.toString(),
      },
    });
  } catch (cause: unknown) {
    throw new Error('Call operations runtime composition failed', { cause });
  }
};

export const createRailwayCommercialApplication = async (
  environment: RailwayEnvironment,
  resources: RailwayRuntimeResources = {},
) => {
  try {
    const shared = resources.database
      ? null
      : await createSharedResources(environment);
    const database = resources.database ?? shared!.database;
    const sqlClient = {
      query: async (sql: string, parameters?: readonly unknown[]) => {
        try {
          const result = (await database.query(sql, parameters)) as {
            rows: unknown[];
            rowCount?: number | null;
          };
          return {
            rows: result.rows,
            ...(result.rowCount === null || result.rowCount === undefined
              ? {}
              : { rowCount: result.rowCount }),
          };
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      },
    };
    await Effect.runPromise(initializeCommercialPersistence(sqlClient));
    const [{ default: Stripe }, { default: twilio }] = await Promise.all([
      import('stripe'),
      import('twilio'),
    ]);
    const stripe = new Stripe(required(environment, 'STRIPE_SECRET_KEY'));
    const masterAccountSid = required(environment, 'TWILIO_ACCOUNT_SID');
    const masterAuthToken = required(environment, 'TWILIO_AUTH_TOKEN');
    const masterTwilio = twilio(masterAccountSid, masterAuthToken);
    const publicUrl = required(
      environment,
      'DIALER_SERVER_PUBLIC_URL',
    ).replace(/\/$/, '');
    if (!publicUrl.startsWith('https://')) {
      throw new Error('DIALER_SERVER_PUBLIC_URL must use HTTPS');
    }
    const billing = createStripeCommercialBilling({
      client: {
        customers: {
          create: async (parameters, options) => {
            try {
              const customer = await stripe.customers.create(
                parameters as StripeSdk.CustomerCreateParams,
                options as StripeSdk.RequestOptions | undefined,
              );
              return { id: customer.id };
            } catch (cause: unknown) {
              throw normalizeAsyncError(cause);
            }
          },
        },
        checkout: {
          sessions: {
            create: async (parameters, options) => {
              try {
                const session = await stripe.checkout.sessions.create(
                  parameters as StripeSdk.Checkout.SessionCreateParams,
                  options as StripeSdk.RequestOptions | undefined,
                );
                return { id: session.id, url: session.url };
              } catch (cause: unknown) {
                throw normalizeAsyncError(cause);
              }
            },
          },
        },
        billingPortal: {
          sessions: {
            create: async (parameters) => {
              try {
                const session = await stripe.billingPortal.sessions.create(
                  parameters as unknown as StripeSdk.BillingPortal.SessionCreateParams,
                );
                return { id: session.id, url: session.url };
              } catch (cause: unknown) {
                throw normalizeAsyncError(cause);
              }
            },
          },
        },
        invoices: {
          createPreview: async (parameters) => {
            try {
              const preview = await stripe.invoices.createPreview(
                parameters as StripeSdk.InvoiceCreatePreviewParams,
              );
              return {
                amount_due: preview.amount_due,
                currency: preview.currency,
                period_end: preview.period_end,
              };
            } catch (cause: unknown) {
              throw normalizeAsyncError(cause);
            }
          },
        },
        subscriptions: {
          retrieve: async (subscriptionId) => {
            try {
              const subscription =
                await stripe.subscriptions.retrieve(subscriptionId);
              if ('deleted' in subscription && subscription.deleted) {
                throw new Error('STRIPE_SUBSCRIPTION_DELETED');
              }
              return {
                id: subscription.id,
                items: {
                  data: subscription.items.data.map((item) => ({
                    id: item.id,
                    price: { id: item.price.id },
                  })),
                },
              };
            } catch (cause: unknown) {
              throw normalizeAsyncError(cause);
            }
          },
          update: (subscriptionId, parameters, options) =>
            stripe.subscriptions.update(
              subscriptionId,
              parameters,
              options,
            ),
        },
        webhooks: {
          constructEvent: (rawBody, signature, secret) => {
            const event = stripe.webhooks.constructEvent(
              rawBody,
              signature,
              secret,
            );
            return { id: event.id, type: event.type, data: event.data };
          },
        },
      },
      webhookSecret: required(environment, 'STRIPE_WEBHOOK_SECRET'),
    });
    const numbers = createTwilioCommercialNumberProvider({
      database: sqlClient,
      publicUrl,
      createSubaccount: (friendlyName) =>
        masterTwilio.api.v2010.accounts.create({ friendlyName }),
      accountClient: (accountSid) => {
        const client = twilio(masterAccountSid, masterAuthToken, {
          accountSid,
        });
        const incomingPhoneNumbers = Object.assign(
          (providerNumberId: string) => ({
            remove: () => client.incomingPhoneNumbers(providerNumberId).remove(),
          }),
          {
            create: async (request: {
              phoneNumber: string;
              friendlyName: string;
              voiceUrl: string;
              voiceMethod: 'POST';
            }) => {
              try {
                const created = await client.incomingPhoneNumbers.create(request);
                return { sid: created.sid, phoneNumber: created.phoneNumber };
              } catch (cause: unknown) {
                throw normalizeAsyncError(cause);
              }
            },
          },
        );
        return {
          availablePhoneNumbers: (country: string) => ({
            local: {
              list: async (request: {
                areaCode?: number;
                contains?: string;
                limit: number;
              }) => {
                try {
                  const available = await client
                    .availablePhoneNumbers(country)
                    .local.list(request);
                  return available.map((number) => ({
                    phoneNumber: number.phoneNumber,
                    friendlyName: number.friendlyName,
                    locality: number.locality,
                    region: number.region,
                    rateCenter: number.rateCenter,
                  }));
                } catch (cause: unknown) {
                  throw normalizeAsyncError(cause);
                }
              },
            },
          }),
          incomingPhoneNumbers,
        };
      },
    });
    return createCommercialApplication({
      database: sqlClient,
      catalog: loadDialerPlanCatalog(environment),
      billing,
      billingReturnUrl: (
        environment.DIALER_BILLING_RETURN_URL ?? `${publicUrl}/admin`
      ).replace(/\/$/, ''),
      numbers,
      usage: {
        getCompletion: async (providerCallId) => {
          try {
            const call = await masterTwilio.calls(providerCallId).fetch();
            const customerConnectedSeconds = Math.max(
              0,
              Number(call.duration ?? 0),
            );
            const providerPrice = Number(call.price ?? 0);
            return {
              customerConnectedSeconds,
              agentConnectedSeconds: 0,
              providerCostMicros: Number.isFinite(providerPrice)
                ? Math.round(Math.abs(providerPrice) * 1_000_000)
                : 0,
              occurredAt: (call.dateUpdated ?? new Date()).toISOString(),
            };
          } catch (cause: unknown) {
            throw normalizeAsyncError(cause);
          }
        },
      },
    });
  } catch (cause: unknown) {
    throw new Error('Commercial dialer runtime composition failed', { cause });
  }
};

const safeNumbers = (
  environment: RailwayEnvironment,
  key: string,
): Set<string> => new Set(commaSeparated(environment[key]).map(normalizePhone));

const createDialerRuntime = (
  environment: RailwayEnvironment,
  redis: RailwayRedisClient,
) => {
  const publicUrl = required(environment, 'DIALER_SERVER_PUBLIC_URL').replace(
    /\/$/,
    '',
  );
  if (!publicUrl.startsWith('https://')) {
    throw new Error('DIALER_SERVER_PUBLIC_URL must use HTTPS');
  }
  const parallelStore = new RedisParallelStore(redis);
  const liveDialer = new Dialer(
    {
      credentials: resolveTwilioProviderCredentials(environment, 'live'),
      baseUrl: publicUrl,
      defaultNumber: environment.TWILIO_DEFAULT_NUMBER,
    },
    parallelStore,
  );
  const lockService = new CallerIdLockService(
    new RedisLockStore(required(environment, 'REDIS_URL')),
  );
  liveDialer.withCallerIdLock(lockService);
  const testDialer =
    environment.TWILIO_TEST_ACCOUNT_SID && environment.TWILIO_TEST_AUTH_TOKEN
      ? new Dialer(
          {
            credentials: resolveTwilioProviderCredentials(
              environment,
              'twilio-test',
            ),
            baseUrl: publicUrl,
          },
          parallelStore,
        )
      : null;
  testDialer?.withCallerIdLock(lockService);
  return { publicUrl, liveDialer, testDialer, lockService, parallelStore };
};

type ProviderDialerSelectionRuntime = Pick<
  ReturnType<typeof createDialerRuntime>,
  'liveDialer' | 'testDialer' | 'parallelStore'
>;

const readProviderModeForGroup = (
  runtime: ProviderDialerSelectionRuntime,
  groupId: string,
): Promise<ParallelProviderMode> =>
  runtime.parallelStore.getGroup(groupId).then((raw) => {
    if (!raw) return 'live';
    const parsed = JSON.parse(raw) as { providerMode?: unknown };
    if (parsed.providerMode === undefined || parsed.providerMode === 'live') {
      return 'live';
    }
    if (parsed.providerMode === 'twilio-test') return 'twilio-test';
    throw new Error('Parallel group has an invalid provider mode');
  });

export const selectProviderDialerForGroup = (
  runtime: ProviderDialerSelectionRuntime,
  groupId: string,
): Promise<Dialer> =>
  readProviderModeForGroup(runtime, groupId).then((providerMode) => {
    if (providerMode === 'live') return runtime.liveDialer;
    if (!runtime.testDialer) {
      throw new Error('Provider test credentials are not configured');
    }
    return runtime.testDialer;
  });

const selectProviderDialerForCall = (
  runtime: ProviderDialerSelectionRuntime,
  callSid: string,
): Promise<Dialer> =>
  runtime.parallelStore
    .getCallMapping(callSid)
    .then((groupId) =>
      groupId
        ? selectProviderDialerForGroup(runtime, groupId)
        : runtime.liveDialer,
    );

export const createRailwayTransferApplication = async (
  environment: RailwayEnvironment,
  resources: RailwayRuntimeResources = {},
) => {
  try {
    const shared = resources.database && resources.redis
      ? null
      : await createSharedResources(environment);
    const database = resources.database ?? shared!.database;
    const redis = resources.redis ?? shared!.redis;
    await initializeCallOperationsPersistence(database);
    const runtime = createDialerRuntime(environment, redis);
    const repository = createPostgresTransferRepository(database);
    const publicUrl = required(environment, 'DIALER_SERVER_PUBLIC_URL');
    if (!publicUrl.startsWith('https://')) {
      throw new Error('DIALER_SERVER_PUBLIC_URL must use HTTPS');
    }
    return createTransferApplication({
      loadGroup: (groupId, workspaceId) =>
        selectProviderDialerForGroup(runtime, groupId).then((dialer) =>
          dialer.parallel.getGroupForWorkspace(groupId, workspaceId),
        ),
      selectDialer: (groupId) =>
        selectProviderDialerForGroup(runtime, groupId),
      repository,
      publicUrl,
      generateId: () => 'transfer_' + randomUUID(),
    });
  } catch (cause: unknown) {
    throw new Error('Transfer runtime composition failed', { cause });
  }
};

export const createRailwayDialerApplicationLayers = async (
  environment: RailwayEnvironment,
  resources: RailwayRuntimeResources = {},
): Promise<DialerApplicationLayers> => {
  try {
    const shared = resources.redis
      ? null
      : await createSharedResources(environment);
    const redis = resources.redis ?? shared!.redis;
    const database = resources.database ?? shared?.database ?? null;
    if (database) {
      await migrateDialerDatabase(database);
    }
    const runtime = createDialerRuntime(environment, redis);
    const publicUrl = required(environment, 'DIALER_SERVER_PUBLIC_URL').replace(
      /\/$/,
      '',
    );
    if (!publicUrl.startsWith('https://')) {
      throw new Error('DIALER_SERVER_PUBLIC_URL must use HTTPS');
    }
    const recordingStatusCallbackUrl =
      publicUrl + '/webhooks/twilio/recording-status';
    const pendingQueues = new Map<string, CallableTarget[]>();
    const safeTo = safeNumbers(
      environment,
      'CONSUELO_SCENARIO_SAFE_TO_NUMBERS',
    );
    const safeFrom = safeNumbers(
      environment,
      'CONSUELO_SCENARIO_SAFE_FROM_NUMBERS',
    );

    const targets: DialerTargetRepositoryService = {
      resolveInputQueueId: ({ workspaceId, userId, input }) =>
        syncEffect('resolve-input-queue', () => {
          const queueId = input.queueId
            ? `leadconnector:${userId}:${input.queueId}`
            : `leadconnector:${userId}:${randomUUID()}`;
          const phones = input.targetPhones ?? [];
          const contactIds = input.contactIds ?? [];
          const selected = phones.map((phone, index) => ({
            contactId: contactIds[index] ?? `leadconnector:${randomUUID()}`,
            phone: normalizePhone(phone),
          }));
          if (selected.length > 0) {
            pendingQueues.set(`${workspaceId}:${queueId}`, selected);
          }
          return queueId;
        }),
      resolveDirectTargets: ({ input }) =>
        syncEffect('resolve-direct-target', () => [
          {
            contactId: input.contactId ?? `leadconnector:${randomUUID()}`,
            phone: normalizePhone(input.targetPhone),
          },
        ]),
      resolveQueueTargets: ({
        workspaceId,
        queueId,
        requestedFanout,
        fallbackPhonesByContactId,
      }) =>
        tryEffect('resolve-queue-targets', () => {
          const key = `${workspaceId}:${queueId}`;
          const pending = pendingQueues.get(key) ?? [];
          pendingQueues.delete(key);
          const fallback = [...fallbackPhonesByContactId.entries()].map(
            ([contactId, phone]) => ({
              contactId,
              phone: normalizePhone(phone),
            }),
          );
          const candidates = pending.length > 0 ? pending : fallback;
          const ranking = database
            ? rankPredictiveLeadConnectorTargets({
                database,
                workspaceId,
                targets: candidates,
                timezone:
                  environment.DIALER_LOCAL_TIMEZONE ?? 'America/New_York',
                callableWindowEndHour: Number(
                  environment.DIALER_CALLABLE_WINDOW_END_HOUR ?? '20',
                ),
                onFallback: (details) =>
                  writeRuntimeEvent({
                    event: 'dialer.predictive.fifo_fallback',
                    ...details,
                  }),
              })
            : Promise.resolve(candidates);
          return ranking.then((ranked) => ranked.slice(0, requestedFanout));
        }),
      createDirectQueue: () => Effect.succeed(`direct:${randomUUID()}`),
    };

    const calls: DialerCallRepositoryService = {
      createMockCalls: ({ targets: selected, callerIds }) =>
        Effect.succeed(
          selected.map((target, index) => ({
            callSid: `mock_${randomUUID().replaceAll('-', '')}`,
            contactId: target.contactId,
            customerNumber: target.phone,
            callerId: callerIds[index],
            status: 'mocked',
            position: index + 1,
          })),
        ),
    };

    const callRuntime: DialerCallRuntimeService = {
      assertSafeTargetsAllowed: ({ targets: selected }) =>
        syncEffect('validate-safe-targets', () => {
          if (safeTo.size === 0) {
            throw new DialerRequestError({
              code: 'LIVE_ALLOWLIST_REQUIRED',
              message: 'Live dialer allowlist is required',
              retryable: false,
            });
          }
          for (const target of selected) {
            if (!safeTo.has(target.phone)) {
              throw new DialerRequestError({
                code: 'TARGET_NOT_ALLOWLISTED',
                message: 'Target phone number is not allowlisted',
                retryable: false,
              });
            }
          }
        }),
      resolveCallerIds: (input) =>
        Effect.gen(function* () {
          if (input.callMode === 'mock') {
            const configured = [...safeFrom];
            return configured.length > 0
              ? configured.slice(0, input.targets.length)
              : Array.from(
                  { length: input.targets.length },
                  (_, index) => `+141555501${String(index).padStart(2, '0')}`,
                );
          }
          const requestedCallerId = resolveProviderCallerId(
            input.callMode,
            input.callerIdNumber,
          );
          if (requestedCallerId) {
            const normalized = normalizePhone(requestedCallerId);
            if (input.enforceScenarioAllowlist && !safeFrom.has(normalized)) {
              return yield* Effect.fail(
                new DialerRequestError({
                  code: 'CALLER_ID_NOT_ALLOWLISTED',
                  message: 'Caller ID number is not allowlisted',
                  retryable: false,
                }),
              );
            }
            return [normalized];
          }
          const commercialEnabled =
            environment.DIALER_COMMERCIAL_ENABLED?.trim().toLowerCase() ===
            'true';
          const numbers = commercialEnabled && database
            ? yield* tryEffect('list-commercial-caller-ids', async () => {
            try {
              const result = await database.query<{
                phone_number: string;
                provider_number_id: string | null;
              }>(
                `SELECT phone_number, provider_number_id
                 FROM dialer_phone_numbers
                 WHERE workspace_id = $1 AND user_id = $2
                   AND status = 'active'
                 ORDER BY phone_number`,
                [input.workspaceId, input.userId],
              );
              return result.rows.map((number) => ({
                phoneNumber: number.phone_number,
                areaCode: number.phone_number.slice(2, 5),
                isPrimary: false,
                isActive: true,
                twilioSid: number.provider_number_id ?? '',
              }));
            } catch (cause: unknown) {
              throw normalizeAsyncError(cause);
            }
          })
            : yield* tryEffect('list-caller-ids', () =>
                runtime.liveDialer.listNumbers(),
              );
          const available = [];
          for (const number of numbers) {
            const phone = normalizePhone(number.phoneNumber);
            if (safeFrom.size > 0 && !safeFrom.has(phone)) continue;
            if (
              yield* tryEffect('check-caller-id-lock', () =>
                runtime.lockService.isNumberAvailable(phone),
              )
            ) {
              available.push({ ...number, phoneNumber: phone });
            }
          }
          if (!input.preferLocalPresence) {
            return available
              .slice(0, input.targets.length)
              .map((number) => number.phoneNumber);
          }
          const selected: string[] = [];
          const remaining = [...available];
          for (const target of input.targets) {
            if (remaining.length === 0) break;
            const resolution = yield* tryEffect('resolve-local-presence', () =>
              runtime.liveDialer.resolveCallerId(
                {
                  to: target.phone,
                  from: '',
                  localPresence: true,
                },
                {
                  numbers: remaining,
                  primaryNumber: remaining.find((number) => number.isPrimary),
                },
              ),
            );
            const resolved = resolution.callerIdNumber;
            if (!resolved) continue;
            selected.push(resolved);
            const index = remaining.findIndex(
              (number) => number.phoneNumber === normalizePhone(resolved),
            );
            if (index >= 0) remaining.splice(index, 1);
          }
          return selected;
        }),
      initiateProviderCalls: (input) =>
        Effect.gen(function* () {
          const dialer =
            input.callMode === 'twilio-test'
              ? runtime.testDialer
              : runtime.liveDialer;
          if (!dialer) {
            return yield* Effect.fail(
              new DialerRequestError({
                code: 'PROVIDER_TEST_CREDENTIALS_REQUIRED',
                message: 'Provider test credentials are not configured',
                retryable: false,
              }),
            );
          }
          const pendingSid = `pending:${input.sessionId}`;
          const acquired: string[] = [];
          let groupId: string | null = null;
          const create = Effect.gen(function* () {
            for (const callerId of input.callerIds) {
              const locked = yield* tryEffect('acquire-caller-id-lock', () =>
                runtime.lockService.acquireLock(
                  callerId,
                  input.userId,
                  pendingSid,
                ),
              );
              if (!locked) {
                return yield* Effect.fail(
                  new DialerRequestError({
                    code: 'CALLER_ID_LOCKED',
                    message: 'Caller ID is in use',
                    retryable: false,
                  }),
                );
              }
              acquired.push(callerId);
            }
            const result = yield* tryEffect('initiate-provider-calls', () =>
              dialer.parallel.initiateGroup(
                buildProviderGroupOptions(input, runtime.publicUrl),
              ),
            );
            groupId = result.groupId;
            for (const call of result.calls) {
              const transferred = yield* tryEffect(
                'transfer-caller-id-lock',
                () =>
                  runtime.lockService.transferLock(
                    call.fromNumber,
                    pendingSid,
                    call.callSid,
                  ),
              );
              if (!transferred) {
                return yield* Effect.fail(
                  new DialerRequestError({
                    code: 'CALLER_ID_LOCK_TRANSFER_FAILED',
                    message: 'Caller ID lock transfer failed',
                    retryable: false,
                  }),
                );
              }
            }
            return {
              twilioGroupId: result.groupId,
              calls: result.calls.map((call) => ({
                callSid: call.callSid,
                contactId:
                  input.targets[call.position - 1]?.contactId ??
                  `leadconnector:${call.position}`,
                customerNumber: call.customerNumber,
                callerId: call.fromNumber,
                status: call.status,
                position: call.position,
              })),
            };
          });
          return yield* create.pipe(
            Effect.tapError(() =>
              Effect.promise(async () => {
                if (groupId) {
                  await dialer.parallel
                    .terminateGroup(groupId)
                    .catch(() => undefined);
                }
                await Promise.all(
                  acquired.map((number) =>
                    runtime.lockService.releaseLockByNumber(number),
                  ),
                );
              }),
            ),
          );
        }),
    };

    const parallel: ParallelCompatibilityRuntimeService = {
      normalizeCustomerNumber: (value) =>
        syncEffect('normalize-customer-number', () => normalizePhone(value)),
      resolveStrategy: (input) =>
        Effect.succeed({
          profile: selectedProfile(input.profileId),
          reason: input.profileId
            ? 'explicit-profile-id'
            : 'standalone-default',
          scope: 'global',
        }),
      listNumbers: () =>
        tryEffect('list-numbers', () => runtime.liveDialer.listNumbers()),
      resolveCallerId: ({ customerNumber, pool }) =>
        tryEffect('resolve-caller-id', () =>
          runtime.liveDialer
            .resolveCallerId(
              { to: customerNumber, from: '', localPresence: true },
              pool,
            )
            .then(
              (resolved) =>
                resolved.callerIdNumber ??
                pool.primaryNumber?.phoneNumber ??
                '',
            ),
        ),
      acquireCallerIdLock: (input) =>
        tryEffect('acquire-caller-id-lock', () =>
          runtime.lockService.acquireLock(
            input.phoneNumber,
            input.userId,
            input.callSid,
          ),
        ),
      transferCallerIdLock: (input) =>
        tryEffect('transfer-caller-id-lock', () =>
          runtime.lockService.transferLock(
            input.phoneNumber,
            input.expectedCallSid,
            input.callSid,
          ),
        ),
      refreshCallerIdLock: (call) =>
        tryEffect('refresh-caller-id-lock', () =>
          runtime.lockService
            .refreshLock(call.fromNumber, call.callSid)
            .then(() => undefined),
        ),
      releaseCallerIdLocks: (numbers) =>
        tryEffect('release-caller-id-locks', () =>
          Promise.all(
            [...new Set(numbers)].map((number) =>
              runtime.lockService.releaseLockByNumber(number),
            ),
          ).then(() => undefined),
        ),
      initiateGroup: (options) =>
        tryEffect('initiate-group', () =>
          runtime.liveDialer.parallel.initiateGroup(options),
        ),
      terminateGroup: (groupId) =>
        tryEffect('terminate-group', () =>
          selectProviderDialerForGroup(runtime, groupId).then((dialer) =>
            dialer.parallel.terminateGroup(groupId),
          ),
        ),
      validateRequirements: (current, required) => ({
        valid: current >= required,
        required,
        current,
        missing: Math.max(0, required - current),
      }),
      startCallRecording: ({ callSid }) =>
        tryEffect('start-call-recording', async () => {
          try {
            const dialer = await selectProviderDialerForCall(runtime, callSid);
            return dialer.startCallRecording({
              callSid,
              recordingStatusCallbackUrl,
            });
          } catch (cause: unknown) {
            throw normalizeAsyncError(cause);
          }
        }),
      handleStatusCallback: (input) =>
        tryEffect('handle-status-callback', () =>
          selectProviderDialerForCall(runtime, input.callSid).then((dialer) =>
            dialer.parallel.handleStatusCallback(
              input.callSid,
              input.callStatus,
              input.answeredBy,
            ),
          ),
        ),
      getGroupIdForCall: (callSid) =>
        tryEffect('get-group-id-for-call', () =>
          runtime.liveDialer.parallel.getGroupIdForCall(callSid),
        ),
      getGroup: (groupId) =>
        tryEffect('get-group', () =>
          selectProviderDialerForGroup(runtime, groupId).then((dialer) =>
            dialer.parallel.getGroup(groupId),
          ),
        ),
      getReleasableNumbers: (group) =>
        runtime.liveDialer.parallel.getReleasableNumbers(group),
      getGroupForWorkspace: (groupId, workspaceId) =>
        tryEffect('get-group-for-workspace', () =>
          selectProviderDialerForGroup(runtime, groupId).then((dialer) =>
            dialer.parallel.getGroupForWorkspace(groupId, workspaceId),
          ),
        ),
      generateCustomerTwiml: (callSid) =>
        tryEffect('generate-customer-twiml', () =>
          selectProviderDialerForCall(runtime, callSid).then((dialer) =>
            dialer.parallel.generateCustomerTwiml(callSid),
          ),
        ),
      terminateGroupForWorkspace: (groupId, workspaceId) =>
        tryEffect('terminate-group-for-workspace', () =>
          selectProviderDialerForGroup(runtime, groupId).then((dialer) =>
            dialer.parallel.terminateGroupForWorkspace(groupId, workspaceId),
          ),
        ),
      retryPendingCleanup: (groupId) =>
        tryEffect('retry-pending-cleanup', () =>
          selectProviderDialerForGroup(runtime, groupId).then((dialer) =>
            dialer.parallel.retryPendingCleanup(groupId),
          ),
        ),
      claimTelemetryEmission: (groupId) =>
        tryEffect('claim-telemetry-emission', () =>
          runtime.liveDialer.parallel.markTelemetryEmittedIfAbsent(groupId),
        ),
      recordTelemetry: (record: ParallelTelemetryRecord) =>
        tryEffect('record-telemetry', () => {
          const persistence = database
            ? recordLeadConnectorAttemptTelemetry(
                database,
                record,
                (_message, details) =>
                  writeRuntimeEvent({
                    event: 'dialer.learning.persistence_unavailable',
                    ...details,
                  }),
                {
                  timezone:
                    environment.DIALER_LOCAL_TIMEZONE ?? 'America/New_York',
                },
              )
            : Promise.resolve(true);
          return persistence.then(() => {
            writeRuntimeEvent({
              event: 'dialer.parallel.completed',
              groupId: record.group.groupId,
              workspaceId: record.group.workspaceId,
              profileId: record.group.profile.id,
              success: record.success,
              winnerRate: record.telemetry.winnerRate,
            });
          });
        }),
    };

    return {
      startLayer: Layer.mergeAll(
        Layer.succeed(DialerTargetRepository, targets),
        Layer.succeed(DialerCallRepository, calls),
        Layer.succeed(DialerCallRuntime, callRuntime),
        Layer.succeed(DialerIdGenerator, {
          generateParallelGroupId: Effect.sync(() => `pg_${randomUUID()}`),
          generateDialerSessionId: Effect.sync(() => `session_${randomUUID()}`),
        }),
      ),
      parallelLayer: Layer.succeed(ParallelCompatibilityRuntime, parallel),
    };
  } catch (cause: unknown) {
    throw new Error('Dialer runtime composition failed', { cause });
  }
};

export const createDialerApplicationLayers =
  createRailwayDialerApplicationLayers;
export const createLeadConnectorApplicationLayer =
  createRailwayLeadConnectorApplicationLayer;
export const createCallOperationsApplicationRuntime =
  createRailwayCallOperationsApplication;
export const createCommercialApplicationRuntime =
  createRailwayCommercialApplication;
export const createTransferApplicationRuntime =
  createRailwayTransferApplication;
