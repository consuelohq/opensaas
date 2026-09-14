import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { CallbackPolicy, InboundQueuePolicy } from '@consuelo/dialer';

import { migrateDialerDatabase } from '../database/migrations';
import { createCallbackRecipientCipher } from './callback-recipient-cipher';
import { createPostgresCallbacks } from './callbacks';
import {
  createCustomerEntryConsentAdapter,
  createInboundCustomerApplication,
} from './customer-entry';
import { createPostgresInboundRouting } from './routing';
import type { InboundNumber } from './telephony-contracts';

const port = Number(process.env.CONSUELO_RD7B_PG_PORT);
const suite =
  Number.isInteger(port) && port > 1024 && port < 65536
    ? describe
    : describe.skip;
const base = Date.UTC(2026, 8, 13, 12, 0, 0);
const at = (seconds: number) => new Date(base + seconds * 1000).toISOString();
const queuePolicy: InboundQueuePolicy = {
  schemaVersion: 1,
  policyVersion: 'rd7b-routing-v1',
  workspaceId: 'workspace',
  queueId: 'sales',
  timezone: 'UTC',
  weekly: [{ day: 0, startMinute: 0, endMinute: 1440 }],
  closedDates: [],
  emergencyClosed: false,
  maxWaitMilliseconds: 120_000,
  maxOffers: 3,
  reofferMilliseconds: 1_000,
  profiles: [],
};
const callbackPolicy: CallbackPolicy = {
  schemaVersion: 1,
  policyVersion: 'rd6-callback-v1',
  activationReference: 'fixture-activation',
  disclosure: 'We can call you back during this staffed service window.',
  maxAttempts: 2,
  retryDelaysMilliseconds: [10_000],
  immediateWindowMilliseconds: 120_000,
  recipientRetentionMilliseconds: 180_000,
  customerRingSeconds: 20,
};
const number: InboundNumber = {
  numberId: 'number-one',
  workspaceId: 'workspace',
  queueId: 'sales',
  accountSid: 'account',
  did: '+15550100123',
  enabled: true,
  maxActiveRequests: 10,
  callback: callbackPolicy,
  customerEntry: {
    publicId: 'sales',
    rateWindowMilliseconds: 60_000,
    maxRequestsPerClient: 1,
    maxRequestsPerNumber: 2,
  },
  voicemail: null,
};

suite('RD7B customer entry with real Postgres', () => {
  let database = '';
  let admin: Pool;
  let pool: Pool;
  let seconds = 0;
  const now = () => at(seconds);

  const makeApplication = () => {
    const consent = createCustomerEntryConsentAdapter({ pool, clock: now });
    const callbacks = createPostgresCallbacks({
      pool,
      recipientCipher: createCallbackRecipientCipher(
        'fixture-callback-encryption-secret-rd7b',
      ),
      clock: now,
      consent,
    });
    return createInboundCustomerApplication({
      pool,
      numbers: [number],
      callbacks,
      secret: 'fixture-customer-entry-capability-secret-rd7b',
      clock: now,
    });
  };

  beforeEach(async () => {
    seconds = 0;
    database = 'rd7b_' + randomUUID().replaceAll('-', '');
    admin = new Pool({
      host: '127.0.0.1',
      port,
      database: 'postgres',
      user: 'postgres',
    });
    await admin.query('CREATE DATABASE ' + database);
    pool = new Pool({
      host: '127.0.0.1',
      port,
      database,
      user: 'postgres',
      max: 10,
    });
    await migrateDialerDatabase(pool);
    const routing = createPostgresInboundRouting(pool, { clock: now });
    await routing.configureQueue(queuePolicy, 0);
  }, 30_000);

  afterEach(async () => {
    await pool?.end();
    await admin?.query('DROP DATABASE IF EXISTS ' + database);
    await admin?.end();
  }, 30_000);

  it('deduplicates public requests, persists explicit permission, and survives restart', async () => {
    const application = makeApplication();
    const publicSnapshot = await application.snapshot('sales');
    expect(publicSnapshot).toMatchObject({
      publicId: 'sales',
      phoneNumber: '+15550100123',
      timezone: 'UTC',
      staffAvailableNow: false,
      callback: { available: true },
    });
    expect(JSON.stringify(publicSnapshot)).not.toContain('workspace');
    expect(JSON.stringify(publicSnapshot)).not.toContain('number-one');

    const input = {
      phoneNumber: '+15550100999',
      permissionAccepted: true as const,
      idempotencyKey: 'request-12345678',
      mode: 'immediate' as const,
    };
    const [first, duplicate] = await Promise.all([
      application.requestCallback('sales', '203.0.113.10', input),
      application.requestCallback('sales', '203.0.113.10', input),
    ]);
    expect(duplicate).toEqual(first);
    expect(first.managementToken.length).toBeGreaterThanOrEqual(32);
    expect(first.callback.status).toBe('scheduled');
    expect(first.booking.status).toBe('unavailable');

    const rows = await pool.query<{
      admissions: string;
      consents: string;
      obligations: string;
    }>(`SELECT
      (SELECT count(*)::text FROM dialer_customer_callback_admission) admissions,
      (SELECT count(*)::text FROM dialer_customer_callback_consents) consents,
      (SELECT count(*)::text FROM dialer_callback_obligations) obligations`);
    expect(rows.rows[0]).toEqual({ admissions: '1', consents: '1', obligations: '1' });

    const raw = await pool.query(
      `SELECT row_to_json(admission)::text value FROM dialer_customer_callback_admission admission
       UNION ALL
       SELECT row_to_json(consent)::text value FROM dialer_customer_callback_consents consent`,
    );
    expect(JSON.stringify(raw.rows)).not.toContain('+15550100999');
    expect(JSON.stringify(raw.rows)).not.toContain('203.0.113.10');

    await expect(
      application.requestCallback('sales', '203.0.113.10', {
        ...input,
        idempotencyKey: 'request-87654321',
      }),
    ).rejects.toThrow('CUSTOMER_CALLBACK_RATE_LIMITED');

    const secondClient = await application.requestCallback(
      'sales',
      '203.0.113.11',
      {
        ...input,
        phoneNumber: '+15550100997',
        idempotencyKey: 'request-second-123',
      },
    );
    expect(secondClient.callback.status).toBe('scheduled');
    await expect(
      application.requestCallback('sales', '203.0.113.12', {
        ...input,
        phoneNumber: '+15550100996',
        idempotencyKey: 'request-third-1234',
      }),
    ).rejects.toThrow('CUSTOMER_CALLBACK_RATE_LIMITED');

    const restarted = makeApplication();
    expect(
      await restarted.readCallback('sales', first.managementToken),
    ).toMatchObject({ callback: { status: 'scheduled' } });
    await expect(
      restarted.readCallback('sales', first.managementToken + 'x'),
    ).rejects.toThrow();
  });

  it('uses server-authored service windows for reschedule and cancels the RD6 obligation', async () => {
    const application = makeApplication();
    const created = await application.requestCallback('sales', '203.0.113.11', {
      phoneNumber: '+15550100998',
      permissionAccepted: true,
      idempotencyKey: 'request-abcdefgh',
      mode: 'immediate',
    });
    const snapshot = await application.snapshot('sales');
    const future = snapshot.callback.serviceWindows.find(
      (window) => window.startsAt > at(0),
    );
    expect(future).toBeDefined();
    const later = snapshot.callback.serviceWindows.find(
      (window) => window.startsAt > future!.startsAt,
    );
    expect(later).toBeDefined();

    const rescheduled = await application.rescheduleCallback(
      'sales',
      created.managementToken,
      future!.id,
    );
    expect(rescheduled.callback).toMatchObject({
      status: 'scheduled',
      notBefore: future!.startsAt,
      deadline: future!.endsAt,
    });
    expect(rescheduled.booking.status).toBe('unavailable');

    expect(
      (
        await application.rescheduleCallback(
          'sales',
          created.managementToken,
          later!.id,
        )
      ).callback.notBefore,
    ).toBe(later!.startsAt);
    expect(
      (
        await application.rescheduleCallback(
          'sales',
          created.managementToken,
          future!.id,
        )
      ).callback.notBefore,
    ).toBe(future!.startsAt);

    seconds = 301;
    expect(
      (await application.readCallback('sales', created.managementToken)).callback
        .status,
    ).toBe('scheduled');

    const cancelled = await application.cancelCallback(
      'sales',
      created.managementToken,
    );
    expect(cancelled.callback.status).toBe('cancelled');
    expect(
      (await application.readCallback('sales', created.managementToken)).callback
        .status,
    ).toBe('cancelled');
  });
});
