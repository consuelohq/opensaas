import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { CallbackPolicy, InboundQueuePolicy } from '@consuelo/dialer';
import {
  migrateDialerDatabase,
  rollbackDialerDatabaseMigration,
} from '../database/migrations';
import { CALLBACK_MIGRATION_ID } from './callback-migration';
import { CALLBACK_BOOKING_EVENTS_MIGRATION_ID } from './callback-booking-event-migration';
import { CUSTOMER_ENTRY_MIGRATION_ID } from './customer-entry-migration';
import { createPostgresInboundRouting } from './routing';
import { createPostgresRepCapacity } from './rep-capacity';
import { createCallbackRecipientCipher } from './callback-recipient-cipher';
import { createPostgresCallbacks } from './callbacks';

const port = Number(process.env.CONSUELO_RD6_PG_PORT);
const suite =
  Number.isInteger(port) && port > 1024 && port < 65536
    ? describe
    : describe.skip;
const base = Date.UTC(2026, 8, 13, 12, 0, 0);
const at = (seconds: number) => new Date(base + seconds * 1000).toISOString();
const queuePolicy: InboundQueuePolicy = {
  schemaVersion: 1,
  policyVersion: 'rd6-routing-v1',
  workspaceId: 'workspace',
  queueId: 'sales',
  timezone: 'UTC',
  weekly: [{ day: 0, startMinute: 0, endMinute: 1440 }],
  closedDates: [],
  emergencyClosed: false,
  maxWaitMilliseconds: 120000,
  maxOffers: 3,
  reofferMilliseconds: 1000,
  profiles: [{ repId: 'alice', skills: [] }],
};
const callbackPolicy: CallbackPolicy = {
  schemaVersion: 1,
  policyVersion: 'rd6-callback-v1',
  activationReference: 'fixture-activation',
  disclosure: 'We can call you back during this service window.',
  maxAttempts: 2,
  retryDelaysMilliseconds: [10_000],
  immediateWindowMilliseconds: 120_000,
  recipientRetentionMilliseconds: 180_000,
  customerRingSeconds: 20,
};

suite('RD6 callbacks with real Postgres', () => {
  let database = '';
  let admin: Pool;
  let pool: Pool;
  let seconds = 0;
  let callbacks: ReturnType<typeof createPostgresCallbacks>;
  let capacity: ReturnType<typeof createPostgresRepCapacity>;

  const now = () => at(seconds);
  const makeService = (calendar?: Parameters<typeof createPostgresCallbacks>[0]['calendar']) =>
    createPostgresCallbacks({
      pool,
      recipientCipher: createCallbackRecipientCipher(
        'fixture-callback-encryption-secret-0001',
      ),
      clock: now,
      consent: async () => ({
        allowed: true,
        evidenceReference: 'fixture-consent-evidence',
        reason: 'allowed',
      }),
      calendar,
    });

  beforeEach(async () => {
    seconds = 0;
    database = 'rd6_' + randomUUID().replaceAll('-', '');
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
    capacity = createPostgresRepCapacity(pool, { clock: now });
    let result = await capacity.execute({
      workspaceId: 'workspace',
      capacityId: 'slot',
      operationId: 'register',
      expectedVersion: 0,
      action: {
        type: 'register',
        repId: 'alice',
        policy: {
          offerMilliseconds: 12_000,
          presenceMilliseconds: 120_000,
          wrapUpMilliseconds: 5_000,
          cooldownMilliseconds: 1_000,
          escalationMilliseconds: 30_000,
        },
      },
    });
    result = await capacity.execute({
      workspaceId: 'workspace',
      capacityId: 'slot',
      operationId: 'ready',
      expectedVersion: result.state.version,
      action: {
        type: 'readiness',
        ready: true,
        endpoints: [{ endpointId: 'web', kind: 'browser', healthy: true }],
      },
    });
    expect(result.state.owner).toBeNull();
    callbacks = makeService();
  }, 30_000);

  afterEach(async () => {
    await pool?.end();
    await admin?.query('DROP DATABASE IF EXISTS ' + database);
    await admin?.end();
  }, 30_000);

  const request = async (suffix = 'one') =>
    callbacks.request({
      operationId: 'request-' + suffix,
      workspaceId: 'workspace',
      callbackId: 'callback-' + suffix,
      requestId: 'callback-request-' + suffix,
      sourceRequestId: null,
      numberId: 'number-one',
      queueId: 'sales',
      originalEnteredAt: at(0),
      consentReference: 'consent-' + suffix,
      recipient: '+18285550123',
      timezone: 'UTC',
      notBefore: at(10),
      deadline: at(90),
      metadata: {
        requiredSkills: [],
        ownerRepId: null,
        ownerStatus: 'missing',
      },
      policy: callbackPolicy,
    });

  it('retains the encrypted recipient through a later rescheduled window and purges afterward', async () => {
    await request();
    await callbacks.reschedule({ workspaceId: 'workspace', callbackId: 'callback-one',
      operationId: 'later-window', timezone: 'UTC', notBefore: at(600), deadline: at(900) });
    seconds = 300;
    const restarted = makeService();
    expect(await restarted.purgeRecipients('workspace')).toBe(0);
    expect(await restarted.readRecipient('workspace', 'callback-one')).toBe('+18285550123');
    expect((await restarted.read('workspace', 'callback-one'))!.recipientExpiresAt).toBe(at(1080));
    seconds = 1081;
    expect(await restarted.purgeRecipients('workspace')).toBe(1);
    await expect(restarted.reschedule({ workspaceId: 'workspace', callbackId: 'callback-one',
      operationId: 'purged-window', timezone: 'UTC', notBefore: at(1500), deadline: at(1800),
    })).rejects.toMatchObject({ cause: { message: 'Callback recipient has been purged' } });
  });

  it('does not reserve early and creates one attempt only after rep acceptance', async () => {
    const created = await request();
    expect(created.state.status).toBe('scheduled');
    expect(await callbacks.readRecipient('workspace', 'callback-one')).toBe(
      '+18285550123',
    );

    await callbacks.tick({ workspaceId: 'workspace', queueId: 'sales', cycleId: 'pre-due' });
    expect((await capacity.read('workspace', 'slot'))!.owner).toBeNull();
    expect((await callbacks.read('workspace', 'callback-one'))!.state.attempts).toHaveLength(0);

    seconds = 10;
    const offered = await callbacks.tick({
      workspaceId: 'workspace',
      queueId: 'sales',
      cycleId: 'due',
    });
    expect(offered.evaluation.action).toBe('offer');
    let slot = (await capacity.read('workspace', 'slot'))!;
    expect(slot.owner?.phase).toBe('offering');
    expect((await callbacks.read('workspace', 'callback-one'))!.state.attempts).toHaveLength(0);

    const owner = slot.owner!;
    const accepted = await capacity.execute({
      workspaceId: 'workspace',
      capacityId: 'slot',
      operationId: 'accept-rep',
      expectedVersion: slot.version,
      action: {
        type: 'accept',
        assignmentId: owner.assignmentId,
        generation: owner.generation,
        endpointId: 'web',
      },
    });
    expect(accepted.state.owner?.phase).toBe('connecting');

    await callbacks.tick({
      workspaceId: 'workspace',
      queueId: 'sales',
      cycleId: 'accepted',
    });
    const dialing = (await callbacks.read('workspace', 'callback-one'))!.state;
    expect(dialing.status).toBe('dialing');
    expect(dialing.attempts).toHaveLength(1);
    expect(dialing.attempts[0]?.assignmentId).toBe(owner.assignmentId);

    const commandCount = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM dialer_inbound_commands
       WHERE workspace_id='workspace' AND command->>'type'='start_callback'`,
    );
    expect(Number(commandCount.rows[0]!.count)).toBe(1);

    const restarted = makeService();
    await Promise.all([
      callbacks.tick({ workspaceId: 'workspace', queueId: 'sales', cycleId: 'restart-a' }),
      restarted.tick({ workspaceId: 'workspace', queueId: 'sales', cycleId: 'restart-b' }),
    ]);
    expect((await restarted.read('workspace', 'callback-one'))!.state.attempts).toHaveLength(1);
    const afterRestart = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM dialer_inbound_commands
       WHERE workspace_id='workspace' AND command->>'type'='start_callback'`,
    );
    expect(Number(afterRestart.rows[0]!.count)).toBe(1);
  });

  it('releases no-answer capacity, retries on policy backoff, and preserves original entry', async () => {
    await request();
    seconds = 10;
    await callbacks.tick({ workspaceId: 'workspace', queueId: 'sales', cycleId: 'due' });
    let slot = (await capacity.read('workspace', 'slot'))!;
    const owner = slot.owner!;
    slot = (
      await capacity.execute({
        workspaceId: 'workspace',
        capacityId: 'slot',
        operationId: 'accept-rep',
        expectedVersion: slot.version,
        action: {
          type: 'accept',
          assignmentId: owner.assignmentId,
          generation: owner.generation,
          endpointId: 'web',
        },
      })
    ).state;
    await callbacks.tick({ workspaceId: 'workspace', queueId: 'sales', cycleId: 'accepted' });
    const attempt = (await callbacks.read('workspace', 'callback-one'))!.state.attempts[0]!;

    seconds = 12;
    const retry = await callbacks.recordAttemptResult({
      workspaceId: 'workspace',
      callbackId: 'callback-one',
      operationId: 'no-answer-one',
      attemptId: attempt.attemptId,
      outcome: 'no_answer',
      reconciled: false,
    });
    expect(retry.state.status).toBe('retry_due');
    await callbacks.releaseAttemptCapacity({
      workspaceId: 'workspace',
      callbackId: 'callback-one',
      operationId: 'release-no-answer-one',
      outcome: 'no_effect',
    });
    expect((await capacity.read('workspace', 'slot'))!.owner).toBeNull();

    seconds = 21;
    await callbacks.tick({ workspaceId: 'workspace', queueId: 'sales', cycleId: 'before-retry' });
    expect((await capacity.read('workspace', 'slot'))!.owner).toBeNull();
    seconds = 22;
    await callbacks.tick({ workspaceId: 'workspace', queueId: 'sales', cycleId: 'retry-backoff-met' });
    expect((await capacity.read('workspace', 'slot'))!.owner).toBeNull();
    seconds = 23;
    await callbacks.tick({ workspaceId: 'workspace', queueId: 'sales', cycleId: 'rep-reoffer-due' });
    expect((await capacity.read('workspace', 'slot'))!.owner?.phase).toBe('offering');

    const rescheduleTarget = makeService();
    await callbacks.cancel({
      workspaceId: 'workspace',
      callbackId: 'callback-one',
      operationId: 'cancel-open-offer',
      reconciled: false,
    });
    expect((await rescheduleTarget.read('workspace', 'callback-one'))!.state.originalEnteredAt).toBe(at(0));
  });

  it('blocks rollback until callback obligations are terminal and retained recipients are purged', async () => {
    await rollbackDialerDatabaseMigration(pool, CALLBACK_BOOKING_EVENTS_MIGRATION_ID);
    await rollbackDialerDatabaseMigration(pool, CUSTOMER_ENTRY_MIGRATION_ID);
    await request();
    try {
      await rollbackDialerDatabaseMigration(pool, CALLBACK_MIGRATION_ID);
      throw new Error('Expected populated callback rollback to be blocked');
    } catch (error: unknown) {
      expect((error as Error).message).toBe(
        'Failed to roll back standalone dialer migration',
      );
      expect(((error as Error).cause as Error).message).toContain(
        'Drain callbacks and purge retained recipients',
      );
    }

    seconds = 30;
    await callbacks.cancel({
      workspaceId: 'workspace',
      callbackId: 'callback-one',
      operationId: 'rollback-cancel',
      reconciled: false,
    });
    expect((await callbacks.read('workspace', 'callback-one'))!.state.status).toBe(
      'cancelled',
    );
    try {
      await rollbackDialerDatabaseMigration(pool, CALLBACK_MIGRATION_ID);
      throw new Error('Expected retained callback recipient to block rollback');
    } catch (error: unknown) {
      expect((error as Error).message).toBe(
        'Failed to roll back standalone dialer migration',
      );
      expect(((error as Error).cause as Error).message).toContain(
        'Drain callbacks and purge retained recipients',
      );
    }

    seconds = 211;
    expect(await callbacks.purgeRecipients('workspace')).toBe(1);
    await rollbackDialerDatabaseMigration(pool, CALLBACK_MIGRATION_ID);
    const migration = await pool.query(
      'SELECT 1 FROM consuelo_dialer_schema_migrations WHERE migration_id=$1',
      [CALLBACK_MIGRATION_ID],
    );
    expect(migration.rowCount).toBe(0);
  });

  it('records calendar unavailability truthfully and purges recipients after retention', async () => {
    await request();
    expect(await callbacks.book('workspace', 'callback-one')).toEqual({
      status: 'unavailable',
      providerReference: null,
      evidenceReference: null,
    });

    const cancelledProviderBookings: string[] = [];
    const calendar = makeService({
      book: async () => ({
        status: 'confirmed',
        providerReference: 'calendar-event-1',
        evidenceReference: 'calendar-evidence-1',
      }),
      cancel: async (input) => {
        cancelledProviderBookings.push(input.providerReference);
        return {
          status: 'cancelled',
          providerReference: input.providerReference,
          evidenceReference: 'calendar-evidence-2',
        };
      },
    });
    await calendar.reschedule({
      workspaceId: 'workspace',
      callbackId: 'callback-one',
      operationId: 'reschedule-one',
      timezone: 'UTC',
      notBefore: at(20),
      deadline: at(80),
    });
    expect((await calendar.read('workspace', 'callback-one'))!.state).toMatchObject({
      revision: 2,
      originalEnteredAt: at(0),
      notBefore: at(20),
      deadline: at(80),
    });
    expect(await calendar.book('workspace', 'callback-one')).toEqual({
      status: 'confirmed',
      providerReference: 'calendar-event-1',
      evidenceReference: 'calendar-evidence-1',
    });

    await calendar.reschedule({
      workspaceId: 'workspace',
      callbackId: 'callback-one',
      operationId: 'reschedule-two',
      timezone: 'UTC',
      notBefore: at(30),
      deadline: at(85),
    });
    expect(cancelledProviderBookings).toEqual(['calendar-event-1']);
    const priorBooking = await pool.query<{ status: string }>(
      `SELECT status FROM dialer_callback_bookings
       WHERE workspace_id='workspace' AND callback_id='callback-one' AND revision=2`,
    );
    expect(priorBooking.rows[0]?.status).toBe('confirmed');
    const priorBookingEvents = await pool.query<{ event_kind: string }>(
      `SELECT event_kind FROM dialer_callback_booking_events
       WHERE workspace_id='workspace' AND callback_id='callback-one' AND revision=2
       ORDER BY recorded_at,event_kind`,
    );
    expect(priorBookingEvents.rows.map((row) => row.event_kind).sort()).toEqual([
      'cancel_dispatched',
      'cancelled',
    ]);
    expect(await calendar.book('workspace', 'callback-one')).toMatchObject({
      status: 'confirmed',
      providerReference: 'calendar-event-1',
    });

    seconds = 31;
    await calendar.cancel({
      workspaceId: 'workspace',
      callbackId: 'callback-one',
      operationId: 'cancel-one',
      reconciled: false,
    });
    expect(cancelledProviderBookings).toEqual([
      'calendar-event-1',
      'calendar-event-1',
    ]);
    expect((await calendar.read('workspace', 'callback-one'))!.state.status).toBe('cancelled');
    const finalBooking = await pool.query<{ status: string }>(
      `SELECT status FROM dialer_callback_bookings
       WHERE workspace_id='workspace' AND callback_id='callback-one' AND revision=3`,
    );
    expect(finalBooking.rows[0]?.status).toBe('confirmed');
    expect(await calendar.book('workspace', 'callback-one')).toMatchObject({
      status: 'cancelled',
      providerReference: 'calendar-event-1',
      evidenceReference: 'calendar-evidence-2',
    });
    seconds = 211;
    expect(await calendar.purgeRecipients('workspace')).toBe(1);
    expect((await calendar.read('workspace', 'callback-one'))!.recipientRetained).toBe(false);
    await expect(calendar.readRecipient('workspace', 'callback-one')).rejects.toThrow('purged');

    const raw = await pool.query<{ state: unknown; snapshot: unknown }>(
      `SELECT obligation.state,event.snapshot
       FROM dialer_callback_obligations obligation
       JOIN dialer_callback_events event USING(workspace_id,callback_id)
       WHERE obligation.workspace_id='workspace' AND obligation.callback_id='callback-one'`,
    );
    expect(JSON.stringify(raw.rows)).not.toContain('+18285550123');
  });

  it('reconciles a lost calendar cancellation after restart and restores management without duplicate effects', async () => {
    await request();
    let cancellations = 0;
    let resolved = false;
    let wrongReference = false;
    const reconciliationInputs: unknown[] = [];
    const adapter = {
      book: async () => ({ status: 'confirmed' as const, providerReference: 'booking-recovery', evidenceReference: 'booking-evidence' }),
      cancel: async () => { cancellations++; throw new Error('provider response lost'); },
      reconcileCancellation: async (input: unknown) => {
        reconciliationInputs.push(input);
        return resolved
          ? { status: 'cancelled' as const, providerReference: wrongReference ? 'different-booking' : 'booking-recovery', evidenceReference: 'reconciled-evidence' }
          : { status: 'unavailable' as const, providerReference: null, evidenceReference: null };
      },
    };
    const first = makeService(adapter);
    await first.book('workspace', 'callback-one');
    const command = { workspaceId: 'workspace', callbackId: 'callback-one', operationId: 'cancel-recovery', reconciled: false };
    await expect(first.cancel(command)).rejects.toThrow('provider response lost');
    const restarted = makeService(adapter);
    expect(await restarted.readBooking('workspace', 'callback-one', 1)).toMatchObject({ status: 'cancel_pending' });
    expect(reconciliationInputs).toHaveLength(1);
    resolved = true;
    wrongReference = true;
    await expect(restarted.cancel(command)).rejects.toThrow();
    expect(await pool.query("SELECT 1 FROM dialer_callback_booking_events WHERE event_kind='cancelled'").then((result) => result.rowCount)).toBe(0);
    wrongReference = false;
    expect(await restarted.readBooking('workspace', 'callback-one', 1)).toMatchObject({ status: 'cancelled', providerReference: 'booking-recovery' });
    await restarted.cancel(command);
    await restarted.cancel(command);
    expect((await restarted.read('workspace', 'callback-one'))?.state.status).toBe('cancelled');
    expect(cancellations).toBe(1);
    expect(reconciliationInputs[0]).toMatchObject({ workspaceId: 'workspace', callbackId: 'callback-one', revision: 1, providerReference: 'booking-recovery' });
    expect(await pool.query("SELECT 1 FROM dialer_callback_booking_events WHERE event_kind='cancelled'").then((result) => result.rowCount)).toBe(1);
  });

  it('does not repeat a provider cancellation after an uncertain dispatched effect', async () => {
    await request();
    let cancellations = 0;
    const calendar = makeService({
      book: async () => ({
        status: 'confirmed',
        providerReference: 'calendar-event-uncertain',
        evidenceReference: 'calendar-evidence-confirmed',
      }),
      cancel: async () => {
        cancellations++;
        throw new Error('provider response lost');
      },
    });
    await calendar.reschedule({
      workspaceId: 'workspace',
      callbackId: 'callback-one',
      operationId: 'reschedule-booking',
      timezone: 'UTC',
      notBefore: at(20),
      deadline: at(80),
    });
    await calendar.book('workspace', 'callback-one');

    await expect(
      calendar.cancel({
        workspaceId: 'workspace',
        callbackId: 'callback-one',
        operationId: 'cancel-uncertain',
        reconciled: false,
      }),
    ).rejects.toThrow('provider response lost');
    expect(cancellations).toBe(1);

    await expect(
      calendar.cancel({
        workspaceId: 'workspace',
        callbackId: 'callback-one',
        operationId: 'cancel-uncertain',
        reconciled: false,
      }),
    ).rejects.toThrow('outcome is unknown');
    expect(cancellations).toBe(1);
  });
});
