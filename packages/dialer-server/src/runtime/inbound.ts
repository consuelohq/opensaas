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

type Environment = Record<string, string | undefined>;
export const inboundEnabled = (environment: Environment) =>
  environment.DIALER_INBOUND_ENABLED === 'true';
export const createInboundRuntime = async (environment: Environment) => {
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
  const callbackEnabled = config.numbers.some((number) => Boolean(number.callback));
  const callbackRecipientSecret =
    environment.DIALER_CALLBACK_RECIPIENT_SECRET?.trim();
  if (callbackEnabled && !callbackRecipientSecret)
    throw new Error(
      'DIALER_CALLBACK_RECIPIENT_SECRET is required when callbacks are enabled',
    );
  const callbackRecipientCipher = callbackRecipientSecret
    ? createCallbackRecipientCipher(callbackRecipientSecret)
    : undefined;
  const pool = new Pool({
    connectionString: environment.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 1500,
    statement_timeout: 3000,
    lock_timeout: 1500,
  });
  try {
    await migrateDialerDatabase(pool);
    for (const number of config.numbers) {
      const queue = await pool.query(
        'SELECT queue_id FROM dialer_routing_queues WHERE workspace_id=$1 AND queue_id=$2',
        [number.workspaceId, number.queueId],
      );
      if (!queue.rowCount)
        throw new Error(
          'Configure the queue policy before enabling its inbound number',
        );
    }
    await protectTelephonyConfiguration(pool, config);
    const carrier = await createTwilioInboundCarrier(accountSid, authToken);
    const telephony = createInboundTelephony({
      pool,
      ...config,
      carrier,
      publicUrl,
      authToken,
      callbackRecipientCipher,
    });
    const outbound = createOutboundCapacity({ pool, carrier, accountSid });
    const ownsWorkspace = (workspaceId: string) =>
      config.numbers.some((number) => number.workspaceId === workspaceId);
    let stopped = false;
    let active: Promise<void> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      if (active || timer || stopped) return;
      const run = () => {
        active = (async () => {
          try {
            const result = await telephony.tick();
            for (const workspaceId of new Set(
              config.numbers.map((number) => number.workspaceId),
            ))
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
      outbound.admitRep(input, [
        ...new Set(config.numbers.map((number) => number.workspaceId)),
      ]);
    const operator = createInboundOperator(
      { pool, ...config, carrier, publicUrl, authToken },
      telephony,
    );
    return {
      ...telephony,
      operator,
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
      ]),
    )
    .digest('hex');
  if (shared && sharedKey !== key)
    throw new Error('Inbound runtime configuration changed within one process');
  if (!shared) {
    sharedKey = key;
    shared = createInboundRuntime(environment).catch((cause) => {
      shared = undefined;
      sharedKey = undefined;
      throw cause;
    });
  }
  return shared;
};
