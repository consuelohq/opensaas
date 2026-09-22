import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type {
  CallbackPolicy,
  InboundQueuePolicy,
  RepCapacityState,
} from '@consuelo/dialer';
import { migrateDialerDatabase } from '../database/migrations';
import { createCallbackRecipientCipher } from './callback-recipient-cipher';
import { createPostgresCallbacks } from './callbacks';
import { createInboundTelephony } from './telephony';
import { createPostgresInboundRouting } from './routing';
import { createPostgresRepCapacity } from './rep-capacity';
import { telephonyId } from './telephony-store';
import type {
  CarrierCall,
  InboundCarrier,
  InboundNumber,
} from './telephony-contracts';

const port = Number(process.env.CONSUELO_RD6_PG_PORT);
const suite =
  Number.isInteger(port) && port > 1024 && port < 65536
    ? describe
    : describe.skip;
const base = Date.UTC(2026, 8, 13, 12, 0, 0);
const at = (seconds: number) => new Date(base + seconds * 1000).toISOString();
const queuePolicy: InboundQueuePolicy = {
  schemaVersion: 1,
  policyVersion: 'rd6-fifo-v1',
  workspaceId: 'workspace',
  queueId: 'sales',
  timezone: 'UTC',
  weekly: [{ day: 0, startMinute: 0, endMinute: 1440 }],
  closedDates: [],
  emergencyClosed: false,
  maxWaitMilliseconds: 120_000,
  maxOffers: 3,
  reofferMilliseconds: 1_000,
  profiles: [{ repId: 'alice', skills: [] }],
};
const callbackPolicy: CallbackPolicy = {
  schemaVersion: 1,
  policyVersion: 'rd6-callback-v1',
  activationReference: 'fixture-activation',
  disclosure: 'We can call you back and keep your place.',
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
  did: '+18285550000',
  enabled: true,
  maxActiveRequests: 10,
  callback: callbackPolicy,
  voicemail: null,
};

suite('RD6 callback telephony with real Postgres and simulated carrier', () => {
  let database = '';
  let admin: Pool;
  let pool: Pool;
  let seconds = 0;
  let calls: Map<string, CarrierCall>;
  let offerTargets: string[];
  let offerUrls: string[];
  let redirects: string[];
  let participants: { callSid: string; muted: boolean; hold: boolean }[];
  let carrier: InboundCarrier;
  let loseCustomerResponse: boolean;
  let loseRepRedirectResponse: boolean;
  let failEndFor: string | null;
  let capacity: ReturnType<typeof createPostgresRepCapacity>;
  let service: ReturnType<typeof createInboundTelephony>;
  let callbacks: ReturnType<typeof createPostgresCallbacks>;
  const cipher = createCallbackRecipientCipher(
    'fixture-callback-encryption-secret-0001',
  );
  const clock = () => at(seconds);

  beforeEach(async () => {
    seconds = 0;
    database = 'rd6_tel_' + randomUUID().replaceAll('-', '');
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
    offerTargets = [];
    offerUrls = [];
    redirects = [];
    participants = [];
    calls = new Map();
    loseCustomerResponse = false;
    loseRepRedirectResponse = false;
    failEndFor = null;
    let sequence = 0;
    carrier = {
      offer: async (input) => {
        sequence++;
        offerTargets.push(input.to);
        offerUrls.push(input.url);
        const sid = input.to.startsWith('client:')
          ? `rep-call-${sequence}`
          : `customer-call-${sequence}`;
        const call: CarrierCall = {
          sid,
          accountSid: 'account',
          status: 'in-progress',
        };
        calls.set(sid, call);
        if (!input.to.startsWith('client:') && loseCustomerResponse) {
          loseCustomerResponse = false;
          throw new Error('provider accepted customer dial but response was lost');
        }
        return call;
      },
      redirect: async (sid) => {
        redirects.push(sid);
        if (loseRepRedirectResponse) {
          loseRepRedirectResponse = false;
          throw new Error('provider accepted rep redirect but response was lost');
        }
      },
      end: async (sid) => {
        if (failEndFor === sid)
          throw new Error('provider termination result is unknown');
        calls.set(sid, { sid, accountSid: 'account', status: 'completed' });
      },
      call: async (sid) => {
        const call = calls.get(sid);
        if (!call) throw new Error('provider call is unavailable');
        return call;
      },
      participants: async () => participants,
      recording: async () => ({
        accountSid: 'account',
        callSid: 'unused',
        status: 'completed',
      }),
      deleteRecording: async () => {},
    };
    await createPostgresInboundRouting(pool, { clock }).configureQueue(
      queuePolicy,
      0,
    );
    capacity = createPostgresRepCapacity(pool, { clock });
    let registered = await capacity.execute({
      workspaceId: 'workspace',
      capacityId: 'slot',
      expectedVersion: 0,
      operationId: 'register',
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
    registered = await capacity.execute({
      workspaceId: 'workspace',
      capacityId: 'slot',
      expectedVersion: registered.state.version,
      operationId: 'ready',
      action: {
        type: 'readiness',
        ready: true,
        endpoints: [{ endpointId: 'browser', kind: 'browser', healthy: true }],
      },
    });
    expect(registered.state.owner).toBeNull();
    service = createInboundTelephony({
      pool,
      numbers: [number],
      endpoints: [
        {
          workspaceId: 'workspace',
          repId: 'alice',
          endpointId: 'browser',
          kind: 'browser',
          address: 'alice',
        },
      ],
      carrier,
      publicUrl: 'https://voice.example',
      authToken: 'fixture-auth-token',
      callbackRecipientCipher: cipher,
      clock,
    });
    callbacks = createPostgresCallbacks({
      pool,
      recipientCipher: cipher,
      clock,
      consent: async () => ({
        allowed: true,
        evidenceReference: 'fixture-consent-evidence',
        reason: 'allowed',
      }),
    });
  }, 30_000);

  afterEach(async () => {
    await pool?.end();
    await admin?.query('DROP DATABASE IF EXISTS ' + database);
    await admin?.end();
  }, 30_000);

  const requestCallback = () =>
    callbacks.request({
      operationId: 'request-one',
      workspaceId: 'workspace',
      callbackId: 'callback-one',
      requestId: 'callback-request-one',
      sourceRequestId: null,
      numberId: 'number-one',
      queueId: 'sales',
      originalEnteredAt: at(0),
      consentReference: 'consent-one',
      recipient: '+18285550123',
      timezone: 'UTC',
      notBefore: at(0),
      deadline: at(90),
      metadata: {
        requiredSkills: [],
        ownerRepId: null,
        ownerStatus: 'missing',
      },
      policy: callbackPolicy,
    });

  const acceptLatestRep = async () => {
    const state = (await capacity.read('workspace', 'slot'))!;
    const owner = state.owner!;
    const repSid = [...calls.keys()].filter((sid) => sid.startsWith('rep-call-')).at(-1)!;
    const latestUrl = offerUrls.at(-1)!;
    await service.handle(
      'number-one',
      'screen',
      { AccountSid: 'account', CallSid: repSid },
      decodeURIComponent(latestUrl.split('/').at(-1)!),
    );
    await service.accept({
      workspaceId: 'workspace',
      userId: 'alice',
      capacityId: 'slot',
      assignmentId: owner.assignmentId,
      generation: owner.generation,
      endpointId: 'browser',
      callSid: repSid,
    });
    return { owner, repSid };
  };

  it('dials the rep first, customer second, and converges duplicate worker ticks', async () => {
    await requestCallback();
    await service.tick();
    expect(offerTargets).toEqual(['client:alice']);
    expect((await callbacks.read('workspace', 'callback-one'))!.state.attempts).toHaveLength(0);

    const { repSid } = await acceptLatestRep();
    await service.tick();
    expect(redirects).toContain(repSid);
    expect(offerTargets).toEqual(['client:alice', '+18285550123']);
    expect((await callbacks.read('workspace', 'callback-one'))!.state.status).toBe('dialing');

    await Promise.all([service.tick(), service.tick()]);
    expect(offerTargets).toEqual(['client:alice', '+18285550123']);
    const customerSid = [...calls.keys()].find((sid) => sid.startsWith('customer-call-'))!;
    const join = await service.handle(
      'number-one',
      'callback-join',
      { AccountSid: 'account', CallSid: customerSid },
      'callback-one',
    );
    expect(join).toContain('<Conference');
    participants = [
      { callSid: repSid, muted: false, hold: false },
      { callSid: customerSid, muted: false, hold: false },
    ];
    await service.tick();
    expect((await capacity.read('workspace', 'slot'))!.owner?.phase).toBe('connected');
    expect((await callbacks.read('workspace', 'callback-one'))!.state.status).toBe('connected');

    calls.set(customerSid, {
      sid: customerSid,
      accountSid: 'account',
      status: 'completed',
    });
    participants = [];
    await service.tick();
    expect(calls.get(repSid)?.status).toBe('completed');
    expect((await capacity.read('workspace', 'slot'))!.owner?.phase).toBe('wrap_up');
    await service.tick();
    expect((await callbacks.read('workspace', 'callback-one'))!.state.status).toBe('fulfilled');
  });

  it('recovers a lost customer-create response from signed provider correlation after restart', async () => {
    await requestCallback();
    await service.tick();
    const { repSid } = await acceptLatestRep();
    loseCustomerResponse = true;
    await service.tick();
    expect(offerTargets.filter((target) => target === '+18285550123')).toHaveLength(1);
    expect((await capacity.read('workspace', 'slot'))!.owner?.phase).toBe('unknown');
    expect((await callbacks.read('workspace', 'callback-one'))!.state.status).toBe('unknown');

    const customerSid = [...calls.keys()].find((sid) => sid.startsWith('customer-call-'))!;
    service = createInboundTelephony({
      pool,
      numbers: [number],
      endpoints: [
        {
          workspaceId: 'workspace',
          repId: 'alice',
          endpointId: 'browser',
          kind: 'browser',
          address: 'alice',
        },
      ],
      carrier,
      publicUrl: 'https://voice.example',
      authToken: 'fixture-auth-token',
      callbackRecipientCipher: cipher,
      clock,
    });
    await service.handle(
      'number-one',
      'callback-status',
      { AccountSid: 'account', CallSid: customerSid, CallStatus: 'in-progress' },
      'callback-one',
    );
    participants = [
      { callSid: repSid, muted: false, hold: false },
      { callSid: customerSid, muted: false, hold: false },
    ];
    await service.tick();
    expect(offerTargets.filter((target) => target === '+18285550123')).toHaveLength(1);
    expect((await capacity.read('workspace', 'slot'))!.owner?.phase).toBe('connected');
    expect((await callbacks.read('workspace', 'callback-one'))!.state.status).toBe('connected');
  });

  it('reconciles a lost rep-bridge response before starting the customer dial', async () => {
    await requestCallback();
    await service.tick();
    const { repSid } = await acceptLatestRep();
    loseRepRedirectResponse = true;
    await service.tick();
    expect((await capacity.read('workspace', 'slot'))!.owner?.phase).toBe('unknown');
    expect((await callbacks.read('workspace', 'callback-one'))!.state.status).toBe('unknown');
    expect(redirects.filter((sid) => sid === repSid)).toHaveLength(2);
    expect(offerTargets.filter((target) => target === '+18285550123')).toHaveLength(1);

    participants = [{ callSid: repSid, muted: false, hold: false }];
    await service.tick();
    expect(offerTargets.filter((target) => target === '+18285550123')).toHaveLength(1);
  });

  it('does not mark a callback connected until both participants are audible', async () => {
    await requestCallback();
    await service.tick();
    const { repSid } = await acceptLatestRep();
    await service.tick();
    const customerSid = [...calls.keys()].find((sid) => sid.startsWith('customer-call-'))!;
    await service.handle(
      'number-one',
      'callback-join',
      { AccountSid: 'account', CallSid: customerSid },
      'callback-one',
    );
    participants = [
      { callSid: repSid, muted: true, hold: false },
      { callSid: customerSid, muted: false, hold: false },
    ];
    await service.tick();
    expect((await capacity.read('workspace', 'slot'))!.owner?.phase).not.toBe('connected');
    expect((await callbacks.read('workspace', 'callback-one'))!.state.status).not.toBe('connected');

    participants[0] = { callSid: repSid, muted: false, hold: false };
    await service.tick();
    expect((await capacity.read('workspace', 'slot'))!.owner?.phase).toBe('connected');
    expect((await callbacks.read('workspace', 'callback-one'))!.state.status).toBe('connected');
  });

  it('keeps connected capacity fenced until an ambiguous surviving-leg termination is proven terminal', async () => {
    await requestCallback();
    await service.tick();
    const { repSid } = await acceptLatestRep();
    await service.tick();
    const customerSid = [...calls.keys()].find((sid) => sid.startsWith('customer-call-'))!;
    await service.handle(
      'number-one',
      'callback-join',
      { AccountSid: 'account', CallSid: customerSid },
      'callback-one',
    );
    participants = [
      { callSid: repSid, muted: false, hold: false },
      { callSid: customerSid, muted: false, hold: false },
    ];
    await service.tick();
    expect((await capacity.read('workspace', 'slot'))!.owner?.phase).toBe('connected');

    calls.set(customerSid, {
      sid: customerSid,
      accountSid: 'account',
      status: 'completed',
    });
    participants = [];
    failEndFor = repSid;
    await service.tick();
    expect(calls.get(repSid)?.status).toBe('in-progress');
    expect((await capacity.read('workspace', 'slot'))!.owner).not.toBeNull();

    failEndFor = null;
    await service.tick();
    expect(calls.get(repSid)?.status).toBe('completed');
    expect((await capacity.read('workspace', 'slot'))!.owner?.phase).toBe('wrap_up');
  });

  it('turns an authenticated DTMF callback choice into a durable encrypted obligation before hangup', async () => {
    calls.set('live-caller', {
      sid: 'live-caller',
      accountSid: 'account',
      status: 'in-progress',
    });
    const incoming = await service.handle('number-one', 'incoming', {
      AccountSid: 'account',
      CallSid: 'live-caller',
      Direction: 'inbound',
      To: '+18285550000',
      From: '+18285550123',
    });
    expect(incoming).toContain('We can call you back and keep your place.');
    const sourceRequestId = telephonyId('account', 'live-caller');
    const response = await service.handle(
      'number-one',
      'wait',
      {
        AccountSid: 'account',
        CallSid: 'live-caller',
        Digits: '1',
        From: '+18285550123',
      },
      sourceRequestId,
    );
    expect(response).toContain('callback request has been saved');
    const callbackId = telephonyId(sourceRequestId, 'callback');
    const persisted = await service.callbacks!.read('workspace', callbackId);
    expect(persisted?.state).toMatchObject({
      sourceRequestId,
      status: 'scheduled',
      originalEnteredAt: at(0),
      timezone: 'UTC',
    });
    expect(await service.callbacks!.readRecipient('workspace', callbackId)).toBe(
      '+18285550123',
    );
    const stored = await pool.query<{ state: unknown; snapshot: unknown }>(
      `SELECT obligation.state,event.snapshot
       FROM dialer_callback_obligations obligation
       JOIN dialer_callback_events event USING(workspace_id,callback_id)
       WHERE obligation.workspace_id='workspace' AND obligation.callback_id=$1`,
      [callbackId],
    );
    expect(JSON.stringify(stored.rows)).not.toContain('+18285550123');
  });

  it('turns customer no-answer into a bounded retry and releases rep capacity', async () => {
    await requestCallback();
    await service.tick();
    const { repSid } = await acceptLatestRep();
    await service.tick();
    const customerSid = [...calls.keys()].find((sid) => sid.startsWith('customer-call-'))!;
    calls.set(customerSid, {
      sid: customerSid,
      accountSid: 'account',
      status: 'no-answer',
    });
    await service.tick();
    expect(calls.get(repSid)?.status).toBe('completed');
    expect((await capacity.read('workspace', 'slot'))!.owner).toBeNull();
    expect((await callbacks.read('workspace', 'callback-one'))!.state).toMatchObject({
      status: 'retry_due',
      originalEnteredAt: at(0),
    });
    expect((await callbacks.read('workspace', 'callback-one'))!.state.attempts).toHaveLength(1);
    const customerOffers = offerTargets.filter((target) => target === '+18285550123');
    expect(customerOffers).toHaveLength(1);
  });

  it('cancels a provider-escaped rep offer before acceptance without losing capacity', async () => {
    await requestCallback();
    await service.tick();
    const repSid = [...calls.keys()].find((sid) => sid.startsWith('rep-call-'))!;
    const before = (await capacity.read('workspace', 'slot'))!;
    expect(before.owner?.phase).toBe('offering');
    expect(before.owner?.externalStarted).toBe(true);

    const pending = await callbacks.cancel({
      workspaceId: 'workspace',
      callbackId: 'callback-one',
      operationId: 'cancel-one',
      reconciled: false,
    });
    expect(pending.state.status).toBe('cancel_pending');
    expect((await capacity.read('workspace', 'slot'))!.owner?.phase).toBe('unknown');

    await service.tick();
    expect(calls.get(repSid)?.status).toBe('completed');
    expect((await capacity.read('workspace', 'slot'))!.owner).toBeNull();
    expect((await callbacks.read('workspace', 'callback-one'))!.state.status).toBe('cancelled');
    expect(offerTargets.filter((target) => target === '+18285550123')).toHaveLength(0);
  });
});
