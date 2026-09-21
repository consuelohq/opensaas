import { createHash } from 'node:crypto';
import { protectTelephonyConfiguration } from '../inbound/telephony-configuration-store';
import { createInboundOperator } from '../inbound/operator';
import { Pool } from 'pg';
import { migrateDialerDatabase } from '../database/migrations';
import { createInboundTelephony } from '../inbound/telephony';
import { createOutboundCapacity } from '../inbound/outbound-capacity';
import { createTwilioInboundCarrier } from '../inbound/twilio-carrier';
import { parseTelephonyConfig } from '../inbound/telephony-config';
import { createCallbackRecipientCipher } from '../inbound/callback-recipient-cipher';
import { createPostgresRepCapacity } from '../inbound/rep-capacity';
import type { InboundEndpoint, InboundEnrichment } from '../inbound/telephony-contracts';
import {
  createCustomerEntryConsentAdapter,
  createInboundCustomerApplication,
} from '../inbound/customer-entry';

type Environment = Record<string, string | undefined>;
const DEFAULT_REP_POLICY = {
  offerMilliseconds: 12_000,
  presenceMilliseconds: 120_000,
  wrapUpMilliseconds: 30_000,
  cooldownMilliseconds: 5_000,
  escalationMilliseconds: 30_000,
} as const;

export const reconcileConfiguredRepCapacity = async (
  pool: Pool,
  endpoints: readonly InboundEndpoint[],
) => {
  try {
    const capacity = createPostgresRepCapacity(pool);
    const reps = [
      ...new Map(
        endpoints.map((endpoint) => [
          endpoint.workspaceId + ':' + endpoint.repId,
          { workspaceId: endpoint.workspaceId, repId: endpoint.repId },
        ]),
      ).values(),
    ];
    for (const rep of reps) {
      const existing = await pool.query<{ capacity_id: string }>(
        'SELECT capacity_id FROM dialer_rep_capacity WHERE workspace_id=$1 AND rep_id=$2',
        [rep.workspaceId, rep.repId],
      );
      if (existing.rows[0]) continue;
      await capacity.execute({
        workspaceId: rep.workspaceId,
        capacityId: rep.repId,
        operationId: 'runtime-register:' + rep.repId,
        expectedVersion: 0,
        action: {
          type: 'register',
          repId: rep.repId,
          policy: DEFAULT_REP_POLICY,
        },
      });
    }
  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('Configured rep reconciliation failed with a non-Error cause', {
      cause,
    });
  }
};

export const inboundEnabled = (environment: Environment) =>
  environment.DIALER_INBOUND_ENABLED === 'true';

export const hasEnabledCallbacks = (
  numbers: readonly { readonly enabled: boolean; readonly callback?: unknown }[],
) => numbers.some((number) => number.enabled && Boolean(number.callback));

export const hasEnabledCustomerEntry = (
  numbers: readonly { readonly enabled: boolean; readonly customerEntry?: unknown }[],
) => numbers.some((number) => number.enabled && Boolean(number.customerEntry));

export const createInboundRuntime = async (environment: Environment, enrich?: InboundEnrichment) => {
  if (!inboundEnabled(environment)) return undefined;
  const accountSid = environment.TWILIO_ACCOUNT_SID?.trim();
  const authToken = environment.TWILIO_AUTH_TOKEN?.trim();
  const publicUrl = environment.DIALER_SERVER_PUBLIC_URL?.trim();
  if (!accountSid || !authToken || !publicUrl || !environment.DATABASE_URL)
    throw new Error('Inbound runtime credentials are incomplete');
  const url = new URL(publicUrl);
  if (
    url.protocol !== 'https:' ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error('Inbound public URL must be a canonical HTTPS origin');
  const config = parseTelephonyConfig(
    environment.DIALER_INBOUND_CONFIG_JSON ?? '',
    accountSid,
  );
  const callbackEnabled = hasEnabledCallbacks(config.numbers);
  const callbackRecipientSecret =
    environment.DIALER_CALLBACK_RECIPIENT_SECRET?.trim();
  if (callbackEnabled && !callbackRecipientSecret)
    throw new Error(
      'DIALER_CALLBACK_RECIPIENT_SECRET is required when callbacks are enabled',
    );
  const callbackRecipientCipher = callbackRecipientSecret
    ? createCallbackRecipientCipher(callbackRecipientSecret)
    : undefined;
  const customerEntryEnabled = hasEnabledCustomerEntry(config.numbers);
  const customerEntrySecret = environment.DIALER_CUSTOMER_ENTRY_SECRET?.trim();
  if (customerEntryEnabled && !customerEntrySecret)
    throw new Error(
      'DIALER_CUSTOMER_ENTRY_SECRET is required when public customer entry is enabled',
    );
  const pool = new Pool({
    connectionString: environment.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 1500,
    statement_timeout: 3000,
    lock_timeout: 1500,
  });
  try {
    await migrateDialerDatabase(pool);
    for (const number of config.numbers.filter((number) => number.enabled)) {
      const queue = await pool.query(
        'SELECT queue_id FROM dialer_routing_queues WHERE workspace_id=$1 AND queue_id=$2',
        [number.workspaceId, number.queueId],
      );
      if (!queue.rowCount)
        throw new Error(
          'Configure the queue policy before enabling its inbound number',
        );
    }
    const configuredWorkspaces = [...new Set(config.numbers.map((number) => number.workspaceId))];
    // Disabled numbers can still own live legs or an uncertain external effect.
    const draining = await pool.query<{ workspace_id: string }>(
      `SELECT workspace_id FROM dialer_telephony_sessions
       WHERE workspace_id=ANY($1::text[]) AND mode <> 'ended'
       UNION
       SELECT workspace_id FROM dialer_rep_capacity
       WHERE workspace_id=ANY($1::text[]) AND snapshot->'owner' <> 'null'::jsonb`,
      [configuredWorkspaces],
    );
    const ownedWorkspaces = new Set([
      ...config.numbers.filter((number) => number.enabled).map((number) => number.workspaceId),
      ...draining.rows.map((row) => row.workspace_id),
    ]);
    await reconcileConfiguredRepCapacity(
      pool,
      config.endpoints.filter((endpoint) => ownedWorkspaces.has(endpoint.workspaceId)),
    );
    await protectTelephonyConfiguration(pool, config);
    const carrier = await createTwilioInboundCarrier(accountSid, authToken);
    const callbackConsent = customerEntryEnabled
      ? createCustomerEntryConsentAdapter({ pool })
      : undefined;
    const telephony = createInboundTelephony({
      pool,
      ...config,
      carrier,
      publicUrl,
      authToken,
      callbackRecipientCipher,
      callbackConsent,
      enrich,
    });
    const customer = customerEntryEnabled && customerEntrySecret
      ? createInboundCustomerApplication({
          pool,
          numbers: config.numbers,
          callbacks: telephony.callbacks,
          secret: customerEntrySecret,
          enrich,
        })
      : undefined;
    const outbound = createOutboundCapacity({ pool, carrier, accountSid });
    const ownsWorkspace = (workspaceId: string) =>
      ownedWorkspaces.has(workspaceId);
    let stopped = false;
    let active: Promise<void> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      if (active || timer || stopped) return;
      const run = () => {
        active = (async () => {
          try {
            const result = await telephony.tick();
            for (const workspaceId of ownedWorkspaces)
              await outbound.tick(workspaceId);
            if (result.failures)
              process.stderr.write(
                JSON.stringify({
                  event: 'dialer.inbound.reconciliation_partial',
                  failures: result.failures,
                }) + '\n',
              );
          } catch {
            process.stderr.write(
              JSON.stringify({ event: 'dialer.inbound.worker_failed' }) + '\n',
            );
          }
        })().finally(() => {
          active = undefined;
          if (!stopped)
            timer = setTimeout(() => {
              timer = undefined;
              run();
            }, 1000);
        });
      };
      run();
    };
    const close = async () => {
      try {
        stopped = true;
        if (timer) clearTimeout(timer);
        await active;
        await pool.end();
      } catch (cause: unknown) {
        if (cause instanceof Error) throw cause;
        throw new Error('Async operation rejected with a non-Error cause', {
          cause,
        });
      }
    };
    const admitOutboundRep = (input: Parameters<typeof outbound.admitRep>[0]) =>
      outbound.admitRep(input, [...ownedWorkspaces]);
    const operator = createInboundOperator(
      { pool, ...config, carrier, publicUrl, authToken },
      telephony,
    );
    return {
      ...telephony,
      operator,
      customer,
      outbound,
      admitOutboundRep,
      ownsWorkspace,
      start,
      close,
    };
  } catch (cause: unknown) {
    await pool.end();
    throw new Error('Inbound runtime composition failed', { cause });
  }
};
type Runtime = Awaited<ReturnType<typeof createInboundRuntime>>;
let shared: Promise<Runtime> | undefined;
let sharedKey: string | undefined;
export const getInboundRuntime = (
  environment: Environment,
  enrich?: InboundEnrichment,
): Promise<Runtime> => {
  if (!inboundEnabled(environment)) return Promise.resolve(undefined);
  const key = createHash('sha256')
    .update(
      JSON.stringify([
        environment.DATABASE_URL,
        environment.TWILIO_ACCOUNT_SID,
        environment.TWILIO_AUTH_TOKEN,
        environment.DIALER_SERVER_PUBLIC_URL,
        environment.DIALER_INBOUND_CONFIG_JSON,
        environment.DIALER_CALLBACK_RECIPIENT_SECRET,
        environment.DIALER_CUSTOMER_ENTRY_SECRET,
      ]),
    )
    .digest('hex');
  if (shared && sharedKey !== key)
    throw new Error('Inbound runtime configuration changed within one process');
  if (!shared) {
    sharedKey = key;
    shared = createInboundRuntime(environment, enrich).catch((cause) => {
      shared = undefined;
      sharedKey = undefined;
      throw cause;
    });
  }
  return shared;
};
