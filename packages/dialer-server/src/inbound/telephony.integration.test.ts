import { CALLBACK_MIGRATION_ID } from './callback-migration';
import { CUSTOMER_ENTRY_MIGRATION_ID } from './customer-entry-migration';
import { protectTelephonyConfiguration } from './telephony-configuration-store';
import { createInboundOperator } from './operator';
import { createInboundRoutes } from '../routes/inbound';
import { createLeadConnectorInboundOperatorApi } from '../../../lead-connector/src/embed/inbound-operator';
import { createInboundOperatorRoutes } from '../routes/inbound-operator';
import { Hono } from 'hono';
import {
  createAuthenticationMiddleware,
  type DialerVariables,
} from '../middleware/auth';
import { createHmac } from 'node:crypto';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  migrateDialerDatabase,
  rollbackDialerDatabaseMigration,
} from '../database/migrations';
import { createOutboundCapacity } from './outbound-capacity';
import { createInboundTelephony } from './telephony';
import { createPostgresRepCapacity } from './rep-capacity';
import { createPostgresInboundRouting } from './routing';
import { createPostgresInboundJournal } from './postgres-journal';
import { telephonyId } from './telephony-store';
import { TELEPHONY_MIGRATION_ID } from './telephony-migration';
import type {
  InboundCarrier,
  InboundNumber,
  CarrierCall,
} from './telephony-contracts';

const port = Number(process.env.CONSUELO_RD5_PG_PORT);
const suite = Number.isInteger(port) && port > 1024 ? describe : describe.skip;
suite('inbound runtime with real Postgres and simulated carrier', () => {
  let pool: Pool, admin: Pool, database: string;
  let milliseconds: number;
  let service: ReturnType<typeof createInboundTelephony>;
  let capacity: ReturnType<typeof createPostgresRepCapacity>;
  let journal: ReturnType<typeof createPostgresInboundJournal>;
  let offers: number, redirects: number, lostOffer: boolean;
  let calls: Map<string, CarrierCall>;
  let participants: { callSid: string; muted: boolean; hold: boolean }[];
  let latestOfferUrl: string;
  const number: InboundNumber = {
    numberId: 'number-one',
    workspaceId: 'workspace',
    queueId: 'sales',
    accountSid: 'account',
    did: 'fixture-did',
    enabled: true,
    maxActiveRequests: 10,
    voicemail: {
      disclosure: 'Please leave a message. We retain it for one day.',
      maxSeconds: 30,
      retentionMilliseconds: 86400000,
    },
  };
  const clock = () => new Date(milliseconds).toISOString();
  let carrier: InboundCarrier;
  beforeAll(async () => {
    database = 'rd5_' + randomUUID().replaceAll('-', '');
    admin = new Pool({
      host: '127.0.0.1',
      port,
      user: 'postgres',
      database: 'postgres',
    });
    await admin.query('CREATE DATABASE ' + database);
    pool = new Pool({
      host: '127.0.0.1',
      port,
      user: 'postgres',
      database,
      max: 10,
    });
    await migrateDialerDatabase(pool);
  }, 30000);
  afterAll(async () => {
    await pool?.end();
    await admin?.query('DROP DATABASE IF EXISTS ' + database);
    await admin?.end();
  }, 30000);
  beforeEach(async () => {
    // Each case gets an independent tenant, with database recreation preserving production migration code.
    await pool.end();
    await admin.query('DROP DATABASE ' + database);
    await admin.query('CREATE DATABASE ' + database);
    pool = new Pool({
      host: '127.0.0.1',
      port,
      user: 'postgres',
      database,
      max: 10,
    });
    await migrateDialerDatabase(pool);
    milliseconds = Date.UTC(2026, 8, 13, 12);
    offers = 0;
    redirects = 0;
    lostOffer = false;
    latestOfferUrl = '';
    calls = new Map([
      [
        'caller',
        { sid: 'caller', accountSid: 'account', status: 'in-progress' },
      ],
    ]);
    participants = [];
    carrier = {
      offer: async (input) => {
        offers++;
        latestOfferUrl = input.url;
        const call = {
          sid: 'rep-call-' + offers,
          accountSid: 'account',
          status: 'in-progress',
        };
        calls.set(call.sid, call);
        if (lostOffer) throw new Error('response lost');
        return call;
      },
      redirect: async () => {
        redirects++;
      },
      end: async (sid) => {
        calls.set(sid, { sid, accountSid: 'account', status: 'completed' });
      },
      call: async (sid) => {
        const call = calls.get(sid);
        if (!call) throw new Error('provider unavailable');
        return call;
      },
      participants: async () => participants,
      recording: async () => ({
        accountSid: 'account',
        callSid: 'caller',
        status: 'completed',
      }),
      deleteRecording: async () => {},
    };
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
      authToken: 'secret',
      clock,
    });
    capacity = createPostgresRepCapacity(pool, { clock });
    journal = createPostgresInboundJournal(pool);
    await createPostgresInboundRouting(pool, { clock }).configureQueue(
      {
        schemaVersion: 1,
        policyVersion: 'fifo',
        workspaceId: 'workspace',
        queueId: 'sales',
        timezone: 'UTC',
        weekly: [{ day: 0, startMinute: 0, endMinute: 1440 }],
        closedDates: [],
        emergencyClosed: false,
        maxWaitMilliseconds: 120000,
        maxOffers: 2,
        reofferMilliseconds: 1000,
        profiles: [{ repId: 'alice', skills: [] }],
      },
      0,
    );
    await capacity.execute({
      workspaceId: 'workspace',
      capacityId: 'slot',
      operationId: 'register',
      expectedVersion: 0,
      action: {
        type: 'register',
        repId: 'alice',
        policy: {
          offerMilliseconds: 12000,
          presenceMilliseconds: 120000,
          wrapUpMilliseconds: 5000,
          cooldownMilliseconds: 1000,
          escalationMilliseconds: 30000,
        },
      },
    });
    await capacity.execute({
      workspaceId: 'workspace',
      capacityId: 'slot',
      operationId: 'ready',
      expectedVersion: 1,
      action: {
        type: 'readiness',
        ready: true,
        endpoints: [{ endpointId: 'browser', kind: 'browser', healthy: true }],
      },
    });
  }, 30000);
  const incoming = () =>
    service.handle('number-one', 'incoming', {
      AccountSid: 'account',
      CallSid: 'caller',
      Direction: 'inbound',
      To: 'fixture-did',
    });
  const tick = async () => {
    const result = await service.tick();
    expect(result.failures).toBe(0);
  };
  const accept = async () => {
    const state = await capacity.read('workspace', 'slot');
    const owner = state!.owner!;
    await service.handle(
      'number-one',
      'screen',
      { AccountSid: 'account', CallSid: 'rep-call-1' },
      decodeURIComponent(latestOfferUrl.split('/').at(-1)!),
    );
    return service.accept({
      workspaceId: 'workspace',
      userId: 'alice',
      capacityId: 'slot',
      assignmentId: owner.assignmentId,
      generation: owner.generation,
      endpointId: 'browser',
      callSid: 'rep-call-1',
    });
  };

  it('reconciles outbound participants and holds wrap-up in the shared authority', async () => {
    const outbound = createOutboundCapacity({
      pool,
      carrier,
      accountSid: 'account',
      clock,
    });
    await outbound.begin({
      workspaceId: 'workspace',
      userId: 'alice',
      sessionId: 'outbound-complete',
      plannedCalls: 1,
    });
    calls.set('customer', {
      sid: 'customer',
      accountSid: 'account',
      status: 'in-progress',
    });
    calls.set('rep', {
      sid: 'rep',
      accountSid: 'account',
      status: 'in-progress',
    });
    await outbound.progress('workspace', 'outbound-complete', {
      groupId: 'group',
      conferenceName: 'conference',
      calls: [{ callSid: 'customer' }],
    });
    await outbound.complete('workspace', 'outbound-complete');
    await outbound.admitRep(
      {
        sessionId: 'outbound-complete',
        clientIdentity: 'alice',
        callSid: 'rep',
        accountSid: 'account',
      },
      ['workspace'],
    );
    await expect(
      outbound.admitRep(
        {
          sessionId: 'outbound-complete',
          clientIdentity: 'bob',
          callSid: 'rep',
          accountSid: 'account',
        },
        ['workspace'],
      ),
    ).rejects.toThrow();
    participants = [
      { callSid: 'customer', muted: false, hold: false },
      { callSid: 'rep', muted: false, hold: false },
    ];
    await outbound.tick('workspace');
    expect((await capacity.read('workspace', 'slot'))!.owner!.phase).toBe(
      'connected',
    );
    calls.set('customer', {
      sid: 'customer',
      accountSid: 'account',
      status: 'completed',
    });
    await outbound.tick('workspace');
    await outbound.tick('workspace');
    expect((await capacity.read('workspace', 'slot'))!.owner!.phase).toBe(
      'wrap_up',
    );
    milliseconds += 6000;
    await tick();
    expect((await capacity.read('workspace', 'slot'))!.owner).toBeNull();
  });
  it('rejects identity changes during live work but allows admission to be disabled', async () => {
    const config = {
      numbers: [number],
      endpoints: [
        {
          workspaceId: 'workspace',
          repId: 'alice',
          endpointId: 'browser',
          kind: 'browser' as const,
          address: 'alice',
        },
      ],
    };
    await protectTelephonyConfiguration(pool, config);
    await incoming();
    await protectTelephonyConfiguration(pool, {
      ...config,
      numbers: [{ ...number, enabled: false }],
    });
    await expect(
      protectTelephonyConfiguration(pool, {
        ...config,
        endpoints: [{ ...config.endpoints[0]!, address: 'changed' }],
      }),
    ).rejects.toThrow();
  });
  it('returns a bounded fallback and never creates a callback without explicit choice', async () => {
    await incoming();
    milliseconds += 121000;
    await tick();
    const id = telephonyId('account', 'caller');
    await service.handle(
      'number-one',
      'wait',
      { AccountSid: 'account', CallSid: 'caller' },
      id,
    );
    milliseconds += 20001;
    expect(
      await service.handle(
        'number-one',
        'wait',
        { AccountSid: 'account', CallSid: 'caller' },
        id,
      ),
    ).toContain('<Hangup');
    expect((await journal.replay('workspace', 'request', id))!.state).toBe(
      'overflowed',
    );
  });
  it('admits signed public requests and serves the real RD7A authenticated adapter', async () => {
    const operator = createInboundOperator(
      {
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
        authToken: 'secret',
        clock,
      },
      service,
    );
    const app = new Hono<{ Variables: DialerVariables }>();
    app.route('/', createInboundRoutes(service));
    app.use(
      '/v1/*',
      createAuthenticationMiddleware({
        authenticate: async (request) =>
          request.headers.get('authorization') === 'Bearer fixture-session'
            ? { workspaceId: 'workspace', userId: 'alice' }
            : null,
      }),
    );
    app.route('/', createInboundOperatorRoutes(operator));
    const path = '/webhooks/twilio/inbound/number-one';
    const facts = {
      AccountSid: 'account',
      CallSid: 'caller',
      Direction: 'inbound',
      To: 'fixture-did',
    };
    const signature = createHmac('sha1', 'secret')
      .update(
        'https://voice.example' +
          path +
          Object.keys(facts)
            .sort()
            .map((key) => key + facts[key as keyof typeof facts])
            .join(''),
      )
      .digest('base64');
    const response = await app.request(path, {
      method: 'POST',
      body: new URLSearchParams(facts),
      headers: { 'x-twilio-signature': signature },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Please hold');
    await tick();
    expect((await app.request('/v1/inbound/operator/snapshot')).status).toBe(
      401,
    );
    const api = createLeadConnectorInboundOperatorApi({
      baseUrl: 'https://voice.example',
      fetch: async (input, init) => app.request(String(input), init),
    });
    api.setSessionToken('fixture-session');
    const snapshot = await api.getSnapshot();
    expect(snapshot.rep.repId).toBe('alice');
    expect(snapshot.offers.length).toBe(1);
    const offer = snapshot.offers[0]!;
    const secondTab = createLeadConnectorInboundOperatorApi({
      baseUrl: 'https://voice.example',
      fetch: async (input, init) => app.request(String(input), init),
    });
    secondTab.setSessionToken('fixture-session');
    const tabInputs = [
      {
        assignmentId: offer.assignmentId,
        generation: offer.generation,
        endpointId: 'browser',
        attemptId: 'tab-one-accept',
      },
      {
        assignmentId: offer.assignmentId,
        generation: offer.generation,
        endpointId: 'browser',
        attemptId: 'tab-two-accept',
      },
    ] as const;
    const attempts = await Promise.all([
      api.acceptOffer(tabInputs[0]),
      secondTab.acceptOffer(tabInputs[1]),
    ]);
    expect(attempts.filter((attempt) => attempt.accepted)).toHaveLength(1);
    expect(attempts.map((attempt) => attempt.status).sort()).toEqual([
      'accepted',
      'stale',
    ]);
    const winningIndex = attempts.findIndex((attempt) => attempt.accepted);
    expect(attempts[winningIndex]!.snapshot!.rep.capacityPhase).toBe(
      'connecting',
    );
    const retried = await [api, secondTab][winningIndex]!.acceptOffer(
      tabInputs[winningIndex]!,
    );
    expect(retried.accepted).toBe(true);
    expect(retried.snapshot!.rep.capacityPhase).toBe('connecting');
    await expect(
      api.updateConfiguration(snapshot.configuration),
    ).rejects.toThrow();
  });
  it('commits only one winner across concurrent browser and phone acceptance', async () => {
    const endpoints = [
      {
        workspaceId: 'workspace',
        repId: 'alice',
        endpointId: 'browser',
        kind: 'browser' as const,
        address: 'alice',
      },
      {
        workspaceId: 'workspace',
        repId: 'alice',
        endpointId: 'phone',
        kind: 'phone' as const,
        address: 'fixture-phone',
      },
    ];
    service = createInboundTelephony({
      pool,
      numbers: [number],
      endpoints,
      carrier,
      publicUrl: 'https://voice.example',
      authToken: 'secret',
      clock,
    });
    await capacity.execute({
      workspaceId: 'workspace',
      capacityId: 'slot',
      expectedVersion: 2,
      operationId: 'both-devices',
      action: {
        type: 'readiness',
        ready: true,
        endpoints: endpoints.map((endpoint) => ({
          endpointId: endpoint.endpointId,
          kind: endpoint.kind,
          healthy: true,
        })),
      },
    });
    await incoming();
    await tick();
    expect(offers).toBe(2);
    const row = (await capacity.read('workspace', 'slot'))!;
    const effects = (
      await pool.query<{
        endpoint_id: string;
        effect_id: string;
        call_sid: string;
      }>(
        "SELECT endpoint_id,effect_id,call_sid FROM dialer_telephony_effects WHERE kind='offer'",
      )
    ).rows;
    const browser = effects.find((effect) => effect.endpoint_id === 'browser')!,
      phone = effects.find((effect) => effect.endpoint_id === 'phone')!;
    await Promise.allSettled([
      service.accept({
        workspaceId: 'workspace',
        userId: 'alice',
        capacityId: 'slot',
        assignmentId: row.owner!.assignmentId,
        generation: row.generation,
        endpointId: 'browser',
        callSid: browser.call_sid,
      }),
      service.handle(
        'number-one',
        'accept',
        { AccountSid: 'account', CallSid: phone.call_sid, Digits: '1' },
        phone.effect_id,
      ),
    ]);
    const owner = (await capacity.read('workspace', 'slot'))!.owner!;
    expect(
      owner.endpoints.filter((endpoint) => endpoint.status === 'accepted')
        .length,
    ).toBe(1);
    await tick();
    await tick();
    const loser = effects.find(
      (effect) => effect.endpoint_id !== owner.winnerEndpointId,
    )!;
    expect(calls.get(loser.call_sid)!.status).toBe('completed');
  });
  it('protects and drains an uncertain bridge without reporting connection', async () => {
    let fail = true;
    carrier.redirect = async () => {
      redirects++;
      if (fail) {
        fail = false;
        throw new Error('bridge response lost');
      }
    };
    await incoming();
    await tick();
    await accept();
    await tick();
    expect((await capacity.read('workspace', 'slot'))!.owner!.phase).toBe(
      'unknown',
    );
    for (let i = 0; i < 5; i++) await tick();
    expect((await capacity.read('workspace', 'slot'))!.owner).toBeNull();
    expect(
      (await journal.replay(
        'workspace',
        'request',
        telephonyId('account', 'caller'),
      ))!.state,
    ).toBe('provider_failure');
    expect(
      [...calls.values()].every((call) => call.status === 'completed'),
    ).toBe(true);
  });
  it('restarts after bridge claim and dispatches each pending effect once', async () => {
    await incoming();
    await tick();
    await accept();
    await service.commands.prepare((await capacity.read('workspace', 'slot'))!);
    const restarted = createInboundTelephony({
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
      authToken: 'secret',
      clock,
    });
    await Promise.all([service.tick(), restarted.tick()]);
    expect(redirects).toBe(2);
    await restarted.tick();
    expect(redirects).toBe(2);
  });
  it('does not promise a callback when RD6 activation is disabled on the number', async () => {
    await incoming();
    milliseconds += 121000;
    await tick();
    const id = telephonyId('account', 'caller');
    const fallback = await service.handle(
      'number-one',
      'wait',
      { AccountSid: 'account', CallSid: 'caller' },
      id,
    );
    expect(fallback).toContain('No representative');
    expect(fallback).not.toContain('request a callback');
    const unsupported = await service.handle(
      'number-one',
      'wait',
      { AccountSid: 'account', CallSid: 'caller', Digits: '1' },
      id,
    );
    expect(unsupported).not.toContain('request has been saved');
    await service.handle('number-one', 'caller-status', {
      AccountSid: 'account',
      CallSid: 'caller',
      CallStatus: 'completed',
    });
    expect((await journal.replay('workspace', 'request', id))!.state).toBe(
      'abandoned',
    );
  });
  it('accepts late voicemail completion and deletes it on its retention deadline', async () => {
    let deleted = 0;
    carrier.deleteRecording = async () => {
      deleted++;
    };
    await incoming();
    const id = telephonyId('account', 'caller');
    await service.handle(
      'number-one',
      'wait',
      { AccountSid: 'account', CallSid: 'caller', Digits: '2' },
      id,
    );
    await service.handle('number-one', 'caller-status', {
      AccountSid: 'account',
      CallSid: 'caller',
      CallStatus: 'completed',
    });
    await service.handle(
      'number-one',
      'recording',
      {
        AccountSid: 'account',
        CallSid: 'caller',
        RecordingStatus: 'completed',
        RecordingSid: 'recording-late',
      },
      id,
    );
    milliseconds += 86400001;
    await tick();
    await tick();
    expect(deleted).toBe(1);
  });
  it('rolls an empty telephony schema down and up while protecting immutable facts', async () => {
    await rollbackDialerDatabaseMigration(pool, CUSTOMER_ENTRY_MIGRATION_ID);
    await rollbackDialerDatabaseMigration(pool, CALLBACK_MIGRATION_ID);
    await rollbackDialerDatabaseMigration(pool, TELEPHONY_MIGRATION_ID);
    await migrateDialerDatabase(pool);
    await incoming();
    await service.handle('number-one', 'caller-status', {
      AccountSid: 'account',
      CallSid: 'caller',
      CallStatus: 'completed',
    });
    await expect(
      pool.query("UPDATE dialer_telephony_facts SET classification='changed'"),
    ).rejects.toThrow('immutable');
  });
  it('shares capacity with outbound and retains partial creation uncertainty', async () => {
    const outbound = createOutboundCapacity({
      pool,
      carrier,
      accountSid: 'account',
      clock,
    });
    await outbound.begin({
      workspaceId: 'workspace',
      userId: 'alice',
      sessionId: 'outbound-session',
      plannedCalls: 2,
    });
    await incoming();
    await tick();
    expect(offers).toBe(0);
    await expect(
      outbound.begin({
        workspaceId: 'workspace',
        userId: 'alice',
        sessionId: 'another',
        plannedCalls: 1,
      }),
    ).rejects.toThrow();
    await outbound.progress('workspace', 'outbound-session', {
      groupId: 'group',
      conferenceName: 'conference',
      calls: [{ callSid: 'rep-call-1' }],
    });
    calls.set('rep-call-1', {
      sid: 'rep-call-1',
      accountSid: 'account',
      status: 'completed',
    });
    await outbound.unknown('workspace', 'outbound-session');
    await outbound.tick('workspace');
    expect((await capacity.read('workspace', 'slot'))!.owner!.phase).toBe(
      'unknown',
    );
  });
  it('admits a duplicate incoming call once and never redials the caller', async () => {
    await Promise.all([incoming(), incoming()]);
    await tick();
    await tick();
    expect(offers).toBe(1);
    expect(redirects).toBe(0);
    expect(
      (await pool.query('SELECT * FROM dialer_telephony_sessions')).rowCount,
    ).toBe(1);
  });
  it('connects only after acceptance and both unmuted participants, then wraps up', async () => {
    await incoming();
    await tick();
    await accept();
    await tick();
    expect(redirects).toBe(2);
    expect((await capacity.read('workspace', 'slot'))!.owner!.phase).toBe(
      'connecting',
    );
    participants = [
      { callSid: 'caller', muted: false, hold: false },
      { callSid: 'rep-call-1', muted: true, hold: false },
    ];
    await tick();
    expect((await capacity.read('workspace', 'slot'))!.owner!.phase).toBe(
      'connecting',
    );
    participants[1]!.muted = false;
    await tick();
    expect((await capacity.read('workspace', 'slot'))!.owner!.phase).toBe(
      'connected',
    );
    calls.set('caller', {
      sid: 'caller',
      accountSid: 'account',
      status: 'completed',
    });
    await tick();
    await tick();
    await tick();
    expect((await capacity.read('workspace', 'slot'))!.owner!.phase).toBe(
      'wrap_up',
    );
    milliseconds += 6000;
    await tick();
    expect((await capacity.read('workspace', 'slot'))!.owner).toBeNull();
  });
  it('protects unknown create outcomes across restart and never creates another offer', async () => {
    lostOffer = true;
    await incoming();
    await service.tick();
    expect((await capacity.read('workspace', 'slot'))!.owner!.phase).toBe(
      'unknown',
    );
    milliseconds += 15000;
    const restarted = createInboundTelephony({
      pool,
      numbers: [number],
      endpoints: [],
      carrier,
      publicUrl: 'https://voice.example',
      authToken: 'secret',
      clock,
    });
    await restarted.tick();
    await restarted.tick();
    expect(offers).toBe(1);
    expect((await capacity.read('workspace', 'slot'))!.owner).not.toBeNull();
  });
  it('rejects stale and cross-rep acceptance and cleans an abandoned caller', async () => {
    await incoming();
    await tick();
    const state = (await capacity.read('workspace', 'slot'))!;
    await expect(
      service.accept({
        workspaceId: 'workspace',
        userId: 'bob',
        capacityId: 'slot',
        assignmentId: state.owner!.assignmentId,
        generation: state.owner!.generation,
        endpointId: 'browser',
        callSid: 'rep-call-1',
      }),
    ).rejects.toThrow();
    await service.handle('number-one', 'caller-status', {
      AccountSid: 'account',
      CallSid: 'caller',
      CallStatus: 'completed',
    });
    calls.set('caller', {
      sid: 'caller',
      accountSid: 'account',
      status: 'completed',
    });
    await tick();
    await tick();
    await tick();
    expect((await capacity.read('workspace', 'slot'))!.owner).toBeNull();
    expect(redirects).toBe(0);
    expect(
      (await journal.replay(
        'workspace',
        'request',
        telephonyId('account', 'caller'),
      ))!.state,
    ).toBe('abandoned');
  });
  it('persists explicit voicemail selection without recording an ordinary call', async () => {
    expect(await incoming()).not.toContain('<Record');
    const xml = await service.handle(
      'number-one',
      'wait',
      { AccountSid: 'account', CallSid: 'caller', Digits: '2' },
      telephonyId('account', 'caller'),
    );
    expect(xml).toContain('<Record');
    await service.handle(
      'number-one',
      'recording',
      {
        AccountSid: 'account',
        CallSid: 'caller',
        RecordingStatus: 'completed',
        RecordingSid: 'recording-one',
      },
      telephonyId('account', 'caller'),
    );
    expect(
      (await pool.query('SELECT * FROM dialer_telephony_voicemail')).rowCount,
    ).toBe(1);
  });
  it('refuses rollback while a live caller or uncertain effect exists', async () => {
    await rollbackDialerDatabaseMigration(pool, CUSTOMER_ENTRY_MIGRATION_ID);
    await rollbackDialerDatabaseMigration(pool, CALLBACK_MIGRATION_ID);
    await incoming();
    await expect(
      rollbackDialerDatabaseMigration(pool, TELEPHONY_MIGRATION_ID),
    ).rejects.toThrow();
  });
});
