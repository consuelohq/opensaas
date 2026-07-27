import { Effect } from 'effect';
import Redis from 'ioredis';

import { createEffectDialerApplication } from '../src/application.js';
import { createRailwayDialerApplicationLayers } from '../src/runtime/railway.js';
import {
  TWILIO_TEST_FROM_NUMBER,
  describeProviderModeEvidence,
} from '../src/runtime/twilio-provider-mode.js';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const firstNumber = (name: string): string => {
  const value = required(name)
    .split(',')
    .map((entry) => entry.trim())
    .find(Boolean);
  if (!value) throw new Error(`${name} does not contain a number`);
  return value;
};

const redact = (value: string): string =>
  value.replace(/\+[1-9]\d{7,14}/g, '[REDACTED_PHONE]');

const writeJson = (value: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`);
};

const redisClient = new Redis(required('REDIS_URL'));
type RedisSet = (
  key: string,
  value: string,
  ...args: Array<string | number>
) => Promise<string | null>;
const setRedis = redisClient.set.bind(redisClient) as unknown as RedisSet;
const redis = {
  get: (key: string) => redisClient.get(key),
  set: (key: string, value: string, ...args: unknown[]) =>
    setRedis(key, value, ...(args as Array<string | number>)),
  del: (...keys: string[]) => redisClient.del(...keys),
  eval: (script: string, numberOfKeys: number, ...args: unknown[]) =>
    redisClient.eval(script, numberOfKeys, ...args).then(Number),
};

try {
  const layers = await createRailwayDialerApplicationLayers(process.env, {
    redis,
  });
  const application = createEffectDialerApplication(layers);
  try {
    const result = await Effect.runPromise(
      application.startCallSession({
        workspaceId: 'provider-test-workspace',
        userId: 'provider-test-user',
        input: {
          source: 'direct',
          selectionStrategy: 'single',
          requestedFanout: 1,
          targetPhone: firstNumber('CONSUELO_SCENARIO_SAFE_TO_NUMBERS'),
          contactId: 'provider-test-contact',
          callerIdNumber: TWILIO_TEST_FROM_NUMBER,
          callMode: 'twilio-test',
        },
      }),
    );
    writeJson({
      ok: true,
      providerReached: true,
      outcome: 'accepted',
      status: result.status,
      actualFanout: result.actualFanout,
      ...describeProviderModeEvidence('twilio-test'),
    });
  } catch (error: unknown) {
    const record =
      error && typeof error === 'object'
        ? (error as Record<string, unknown>)
        : {};
    const cause =
      record.cause && typeof record.cause === 'object'
        ? (record.cause as Record<string, unknown>)
        : {};
    const message =
      error instanceof Error
        ? error.message
        : typeof record.message === 'string'
          ? record.message
          : 'Provider test request failed';
    writeJson({
      ok: true,
      providerReached:
        record.operation === 'initiate-provider-calls' ||
        typeof cause.code === 'number' ||
        typeof cause.status === 'number' ||
        /verified for your account|twilio|phone number provided/i.test(message),
      outcome: 'rejected',
      errorTag: String(record._tag ?? 'UnknownError'),
      operation: String(record.operation ?? ''),
      providerCode: typeof cause.code === 'number' ? cause.code : undefined,
      providerStatus:
        typeof cause.status === 'number' ? cause.status : undefined,
      message: redact(message),
      ...describeProviderModeEvidence('twilio-test'),
    });
  }

  for (const key of await redisClient.keys(
    'consuelo:dialer:parallel:group:*',
  )) {
    const raw = await redisClient.get(key);
    if (!raw) continue;
    const group = JSON.parse(raw) as {
      groupId?: string;
      workspaceId?: string;
      calls?: Array<{ callSid?: string }>;
    };
    if (group.workspaceId !== 'provider-test-workspace') continue;
    const callKeys = (group.calls ?? [])
      .map((call) => call.callSid)
      .filter((callSid): callSid is string => Boolean(callSid))
      .map((callSid) => `consuelo:dialer:parallel:call:${callSid}`);
    await redisClient.del(
      key,
      `consuelo:dialer:parallel:winner:${group.groupId ?? ''}`,
      ...callKeys,
    );
  }

  const remainingLocks = await redisClient.keys('caller-id-lock:*');
  writeJson({
    lockCleanup: remainingLocks.length === 0,
    remainingLockCount: remainingLocks.length,
  });
} finally {
  await redisClient.quit();
}

process.exit(0);
