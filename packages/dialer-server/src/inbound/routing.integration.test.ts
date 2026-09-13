import { TELEPHONY_MIGRATION_ID } from './telephony-migration';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type {
  InboundCommit,
  InboundQueuePolicy,
  RoutingRequestMetadata,
  RepCapacityState,
} from '@consuelo/dialer';
import {
  evaluateInboundRouting,
  type InboundRoutingFrame,
} from '@consuelo/dialer';
import {
  migrateDialerDatabase,
  rollbackDialerDatabaseMigration,
} from '../database/migrations';
import { createPostgresInboundJournal } from './postgres-journal';
import { createPostgresRepCapacity } from './rep-capacity';
import { createPostgresInboundRouting } from './routing';
import { ROUTING_MIGRATION_ID } from './routing-migration';

const port = Number(process.env.CONSUELO_RD4_PG_PORT);
const suite =
  Number.isInteger(port) && port > 1024 && port < 65536
    ? describe
    : describe.skip;
const at = (seconds: number) =>
  new Date(Date.UTC(2026, 8, 13, 12, 0, seconds)).toISOString();
const metadata: RoutingRequestMetadata = {
  requiredSkills: [],
  ownerRepId: null,
  ownerStatus: 'missing',
  kind: 'live',
  notBefore: null,
  deadline: null,
};
const policy: InboundQueuePolicy = {
  schemaVersion: 1,
  policyVersion: 'fifo-owner-v1',
  workspaceId: 'routing-fixture',
  queueId: 'sales',
  timezone: 'UTC',
  weekly: [{ day: 0, startMinute: 0, endMinute: 1440 }],
  closedDates: [],
  emergencyClosed: false,
  maxWaitMilliseconds: 120000,
  maxOffers: 2,
  reofferMilliseconds: 10000,
  profiles: [
    { repId: 'alice', skills: ['spanish'] },
    { repId: 'bob', skills: [] },
  ],
};

suite('transactional inbound routing', () => {
  let database: string;
  let admin: Pool;
  let pool: Pool;
  let seconds = 0;
  let routing: ReturnType<typeof createPostgresInboundRouting>;
  let capacity: ReturnType<typeof createPostgresRepCapacity>;
  let journal: ReturnType<typeof createPostgresInboundJournal>;
  beforeEach(async () => {
    seconds = 0;
    database = 'rd4_' + randomUUID().replaceAll('-', '');
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
    routing = createPostgresInboundRouting(pool, { clock: () => at(seconds) });
    capacity = createPostgresRepCapacity(pool, { clock: () => at(seconds) });
    journal = createPostgresInboundJournal(pool);
    await routing.configureQueue(policy, 0);
  }, 30000);
  afterEach(async () => {
    await pool?.end();
    await admin?.query('DROP DATABASE IF EXISTS ' + database);
    await admin?.end();
  }, 30000);
  const request = async (
    id: string,
    extra: Partial<RoutingRequestMetadata> = {},
  ) => {
    const input: InboundCommit = {
      workspaceId: policy.workspaceId,
      fact: {
        source: 'routing-fixture',
        eventKey: id,
        occurredAt: at(0),
        classification: 'created',
      },
      commands: [],
      events: [
        {
          schemaVersion: 1,
          eventId: id,
          workspaceId: policy.workspaceId,
          entityId: id,
          kind: 'request',
          expectedVersion: 0,
          occurredAt: at(0),
          observedAt: at(0),
          to: 'created',
          evidence: 'none',
          identity: {
            kind: 'request',
            queueId: policy.queueId,
            enteredAt: at(0),
          },
        },
      ],
    };
    await journal.commit(input);
    await routing.configureRequest(
      policy.workspaceId,
      id,
      { ...metadata, ...extra },
      0,
    );
  };
  const ready = async (repId: string) => {
    let { state } = await capacity.execute({
      workspaceId: policy.workspaceId,
      capacityId: repId,
      expectedVersion: 0,
      operationId: randomUUID(),
      action: {
        type: 'register',
        repId,
        policy: {
          offerMilliseconds: 12000,
          presenceMilliseconds: 60000,
          cooldownMilliseconds: 5000,
          wrapUpMilliseconds: 10000,
          escalationMilliseconds: 20000,
        },
      },
    });
    ({ state } = await capacity.execute({
      workspaceId: policy.workspaceId,
      capacityId: repId,
      expectedVersion: state.version,
      operationId: randomUUID(),
      action: {
        type: 'readiness',
        ready: true,
        endpoints: [{ endpointId: 'web', kind: 'browser', healthy: true }],
      },
    }));
    return state;
  };
  const tick = (decisionId: string = randomUUID()) =>
    routing.tick({
      workspaceId: policy.workspaceId,
      queueId: policy.queueId,
      decisionId,
    });
  const action = (
    state: RepCapacityState,
    change: Parameters<typeof capacity.execute>[0]['action'],
  ) =>
    capacity.execute({
      workspaceId: policy.workspaceId,
      capacityId: state.capacityId,
      expectedVersion: state.version,
      operationId: randomUUID(),
      action: change,
    });
  const abandon = async (id: string) => {
    const previous = await journal.replay(policy.workspaceId, 'request', id);
    await journal.commit({
      workspaceId: policy.workspaceId,
      fact: {
        source: 'routing-fixture',
        eventKey: 'end-' + id,
        occurredAt: at(seconds),
        classification: 'abandoned',
      },
      commands: [],
      events: [
        ...(previous!.state === 'created'
          ? [
              {
                schemaVersion: 1 as const,
                eventId: 'queue-' + id,
                workspaceId: policy.workspaceId,
                entityId: id,
                kind: 'request' as const,
                expectedVersion: previous!.version,
                occurredAt: at(seconds),
                observedAt: at(seconds),
                to: 'queued',
                evidence: 'none' as const,
              },
            ]
          : []),
        {
          schemaVersion: 1,
          eventId: 'end-' + id,
          workspaceId: policy.workspaceId,
          entityId: id,
          kind: 'request',
          expectedVersion:
            previous!.version + (previous!.state === 'created' ? 1 : 0),
          occurredAt: at(seconds),
          observedAt: at(seconds),
          to: 'abandoned',
          evidence: 'none',
        },
      ],
    });
  };
  it('commits one reservation for duplicate ticks and replays immutable decision evidence', async () => {
    await request('caller', { ownerRepId: 'bob', ownerStatus: 'known' });
    await ready('alice');
    await ready('bob');
    seconds = 1;
    const [first, second] = await Promise.all([tick('same'), tick('same')]);
    expect([first.duplicate, second.duplicate].sort()).toEqual([false, true]);
    expect(first.reservation?.capacityId).toBe('bob');
    expect(second.reservation).toEqual(first.reservation);
    const stored = await routing.readDecision(policy.workspaceId, 'same');
    const frame = stored!.frame as InboundRoutingFrame & {
      evaluation: unknown;
    };
    expect(evaluateInboundRouting(frame)).toEqual(first.evaluation);
    expect(
      frame.capacities.find((rep) => rep.repId === 'bob')?.owner,
    ).toBeNull();
    expect(
      (await capacity.read(policy.workspaceId, 'bob'))?.owner?.assignmentId,
    ).toBe(first.reservation?.assignmentId);
    await expect(
      pool.query("UPDATE dialer_routing_decisions SET result='{}'"),
    ).rejects.toThrow();
    expect(await routing.readDecision('other', 'same')).toBeNull();
    await expect(
      routing.tick({
        workspaceId: policy.workspaceId,
        queueId: 'other',
        decisionId: 'same',
      }),
    ).rejects.toThrow();
  });
  it('does not split a reservation from its evidence when persistence fails', async () => {
    await request('rollback');
    await ready('alice');
    seconds = 1;
    await pool.query(
      "CREATE FUNCTION reject_routing_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture persistence failure'; END $$",
    );
    await pool.query(
      'CREATE TRIGGER reject_routing BEFORE INSERT ON dialer_routing_decisions FOR EACH ROW EXECUTE FUNCTION reject_routing_fixture()',
    );
    await expect(tick('rollback')).rejects.toThrow();
    expect(
      (await capacity.read(policy.workspaceId, 'alice'))?.owner,
    ).toBeNull();
    expect(
      (await journal.listCommands(policy.workspaceId, 'pending')).filter(
        (command) => command.command.type === 'offer',
      ),
    ).toHaveLength(0);
    expect(
      await routing.readDecision(policy.workspaceId, 'rollback'),
    ).toBeNull();
    await pool.query('DROP TRIGGER reject_routing ON dialer_routing_decisions');
    expect((await tick('rollback')).reservation).not.toBeNull();
  });
  it('expires safe offers, moves to another rep and bounds attempts across recreation', async () => {
    await request('caller', { ownerRepId: 'alice', ownerStatus: 'known' });
    await ready('alice');
    await ready('bob');
    seconds = 1;
    expect((await tick()).reservation?.capacityId).toBe('alice');
    seconds = 13;
    routing = createPostgresInboundRouting(pool, { clock: () => at(seconds) });
    expect((await tick()).reservation?.capacityId).toBe('bob');
    seconds = 25;
    const fallback = await tick('bounded');
    expect(fallback.evaluation.reason).toBe('max_offers');
    expect(fallback.reservation).toBeNull();
    expect(
      await routing.listFallbacks(policy.workspaceId, policy.queueId),
    ).toEqual([{ request_id: 'caller', fallback_decision_id: 'bounded' }]);
    expect((await tick()).evaluation.requestId).toBeNull();
    await abandon('caller');
    expect(
      await routing.listFallbacks(policy.workspaceId, policy.queueId),
    ).toHaveLength(0);
  });
  it('protects dispatched offers through expiry and escalation without reoffering', async () => {
    await request('caller');
    await ready('alice');
    seconds = 1;
    const first = await tick();
    let state = (await capacity.read(policy.workspaceId, 'alice'))!;
    const offer = (
      await journal.listCommands(policy.workspaceId, 'pending')
    ).find((command) => command.command.type === 'offer')!;
    seconds = 2;
    ({ state } = await action(state, {
      type: 'dispatch',
      assignmentId: first.reservation!.assignmentId,
      generation: first.reservation!.generation,
      commandId: offer.command.commandId,
    }));
    seconds = 13;
    expect((await tick()).reservation).toBeNull();
    expect(
      (await capacity.read(policy.workspaceId, 'alice'))?.owner?.phase,
    ).toBe('unknown');
    seconds = 33;
    await tick();
    expect(
      (await capacity.read(policy.workspaceId, 'alice'))?.owner?.escalatedAt,
    ).toBe(at(33));
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM dialer_rep_capacity_events WHERE event->'action'->>'type'='offer'",
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it('does not resurrect abandoned callers and records unserviceable predecessors', async () => {
    await request('a', { requiredSkills: ['french'] });
    await request('b', { requiredSkills: ['spanish'] });
    await ready('alice');
    await ready('bob');
    seconds = 1;
    const decision = await tick();
    expect(decision.evaluation.requestId).toBe('b');
    expect(decision.evaluation.considered[0]?.reason).toBe('no_capacity');
    await abandon('a');
    expect((await tick()).reservation).toBeNull();
  });
  it('keeps callback not-before, config versions, fallback and replay after restart', async () => {
    await request('callback', {
      kind: 'callback',
      notBefore: at(10),
      deadline: at(20),
    });
    await ready('alice');
    seconds = 1;
    expect((await tick()).evaluation.reason).toBe('not_due');
    await expect(
      routing.configureQueue({ ...policy, emergencyClosed: true }, 0),
    ).rejects.toThrow();
    await routing.configureQueue({ ...policy, emergencyClosed: true }, 1);
    seconds = 10;
    const decision = await tick('closed');
    expect(decision.evaluation.reason).toBe('closed');
    routing = createPostgresInboundRouting(pool);
    expect(
      (await routing.readDecision(policy.workspaceId, 'closed'))?.result,
    ).toEqual(decision);
    expect(
      await routing.listFallbacks(policy.workspaceId, policy.queueId),
    ).toHaveLength(1);
  });
  it('preserves one owner under independent routing worker processes', async () => {
    await request('a');
    await request('b');
    await ready('alice');
    const source = `import {Pool} from 'pg';import {createPostgresInboundRouting} from './packages/dialer-server/src/inbound/routing.ts';
 const [port,database,decisionId]=process.argv.slice(1);
 if(!/^rd4_[a-f0-9]+$/.test(database)||Number(port)<=1024)throw new Error('Invalid isolated fixture');
 const pool=new Pool({host:'127.0.0.1',port:Number(port),database,user:'postgres'});
 try{const result=await createPostgresInboundRouting(pool,{clock:()=> '2026-09-13T12:00:01.000Z'}).tick({workspaceId:'routing-fixture',queueId:'sales',decisionId});process.stdout.write(JSON.stringify(result));}finally{await pool.end();}`;
    const workers = ['worker-a', 'worker-b'].map((id) =>
      Bun.spawn([process.execPath, '-e', source, String(port), database, id], {
        stdout: 'pipe',
        stderr: 'pipe',
      }),
    );
    const results = await Promise.all(
      workers.map(async (worker) => {
        const [code, stdout, stderr] = await Promise.all([
          worker.exited,
          new Response(worker.stdout).text(),
          new Response(worker.stderr).text(),
        ]);
        expect(code, stderr).toBe(0);
        return JSON.parse(stdout) as { reservation: unknown };
      }),
    );
    expect(
      results.filter((result) => result.reservation !== null),
    ).toHaveLength(1);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM dialer_routing_decisions',
        )
      ).rows[0].n,
    ).toBe(2);
  }, 30000);
  it('rejects future request evidence without reserving capacity', async () => {
    await request('future');
    await ready('alice');
    await journal.commit({
      workspaceId: policy.workspaceId,
      fact: {
        source: 'routing-fixture',
        eventKey: 'future-queued',
        occurredAt: at(20),
        classification: 'queued',
      },
      commands: [],
      events: [
        {
          schemaVersion: 1,
          eventId: 'future-queued',
          workspaceId: policy.workspaceId,
          entityId: 'future',
          kind: 'request',
          expectedVersion: 1,
          occurredAt: at(20),
          observedAt: at(20),
          to: 'queued',
          evidence: 'none',
        },
      ],
    });
    seconds = 1;
    await expect(tick('future')).rejects.toThrow();
    expect(
      (await capacity.read(policy.workspaceId, 'alice'))?.owner,
    ).toBeNull();
    expect(await routing.readDecision(policy.workspaceId, 'future')).toBeNull();
  });
  it('rejects rollback with active routing and preserves older journal after safe down/up', async () => {
    await request('caller');
    await ready('alice');
    seconds = 1;
    const decision = await tick();
    expect(decision.reservation).not.toBeNull();
    await expect(
      rollbackDialerDatabaseMigration(pool, ROUTING_MIGRATION_ID),
    ).rejects.toThrow();
    const state = (await capacity.read(policy.workspaceId, 'alice'))!;
    await action(state, {
      type: 'cancel',
      assignmentId: state.owner!.assignmentId,
      generation: state.generation,
    });
    await expect(
      rollbackDialerDatabaseMigration(pool, ROUTING_MIGRATION_ID),
    ).rejects.toThrow();
    await abandon('caller');
    const history = await journal.replay(
      policy.workspaceId,
      'request',
      'caller',
    );
    await rollbackDialerDatabaseMigration(pool, TELEPHONY_MIGRATION_ID);
    await rollbackDialerDatabaseMigration(pool, ROUTING_MIGRATION_ID);
    await migrateDialerDatabase(pool);
    expect(
      await journal.replay(policy.workspaceId, 'request', 'caller'),
    ).toEqual(history);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM dialer_routing_decisions',
        )
      ).rows[0].n,
    ).toBe(0);
  });
});
