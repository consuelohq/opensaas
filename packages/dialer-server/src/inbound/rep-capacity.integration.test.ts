import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type {
  RepCapacityAction,
  RepCapacityInput,
  RepCapacityState,
  InboundCommit,
} from '@consuelo/dialer';
import { createPostgresRepCapacity } from './rep-capacity';
import { createPostgresInboundJournal } from './postgres-journal';
import {
  migrateDialerDatabase,
  rollbackDialerDatabaseMigration,
} from '../database/migrations';
import {
  CREATE_REP_CAPACITY_SQL,
  REP_CAPACITY_MIGRATION_ID,
} from './rep-capacity-migration';

const port = Number(process.env.CONSUELO_RD3_PG_PORT);
const enabled = Number.isInteger(port) && port > 1024 && port < 65536;
const suite = enabled ? describe : describe.skip;
const policy = {
  offerMilliseconds: 12_000,
  presenceMilliseconds: 60_000,
  wrapUpMilliseconds: 30_000,
  cooldownMilliseconds: 5_000,
  escalationMilliseconds: 20_000,
};
const at = (seconds: number) =>
  new Date(Date.UTC(2026, 8, 10, 12, 0, seconds)).toISOString();

suite('Postgres shared rep capacity', () => {
  const database = 'rd3_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({
    host: '127.0.0.1',
    port,
    database: 'postgres',
    user: 'postgres',
  });
  const pool = new Pool({
    host: '127.0.0.1',
    port,
    database,
    user: 'postgres',
    max: 12,
  });
  let seconds = 0;
  const service = createPostgresRepCapacity(pool, { clock: () => at(seconds) });
  const secondService = createPostgresRepCapacity(pool, {
    clock: () => at(seconds),
  });
  const journal = createPostgresInboundJournal(pool);
  const workspaceId = 'capacity-test';
  beforeAll(async () => {
    await admin.query('CREATE DATABASE ' + database);
    await migrateDialerDatabase(pool);
  }, 30_000);
  afterAll(async () => {
    await pool.end();
    await admin.query('DROP DATABASE IF EXISTS ' + database);
    await admin.end();
  });
  const request = async (id: string) => {
    const commit: InboundCommit = {
      workspaceId,
      fact: {
        source: 'fixture',
        eventKey: id,
        occurredAt: at(0),
        classification: 'create',
      },
      commands: [],
      events: [
        {
          schemaVersion: 1,
          workspaceId,
          entityId: id,
          eventId: id,
          kind: 'request',
          expectedVersion: 0,
          occurredAt: at(0),
          observedAt: at(0),
          to: 'created',
          evidence: 'none',
          identity: { kind: 'request', queueId: 'queue', enteredAt: at(0) },
        },
      ],
    };
    await journal.commit(commit);
  };
  const execute = (
    state: RepCapacityState,
    action: RepCapacityAction,
    operationId = randomUUID(),
  ) =>
    service.execute({
      workspaceId,
      capacityId: state.capacityId,
      operationId,
      expectedVersion: state.version,
      action,
    });
  const ready = async (id: string) => {
    seconds = 0;
    let { state } = await service.execute({
      workspaceId,
      capacityId: id,
      operationId: randomUUID(),
      expectedVersion: 0,
      action: { type: 'register', repId: id, policy },
    });
    ({ state } = await execute(state, {
      type: 'readiness',
      ready: true,
      endpoints: [
        { endpointId: 'web', kind: 'browser', healthy: true },
        { endpointId: 'phone', kind: 'phone', healthy: true },
      ],
    }));
    return state;
  };
  const makeOffer = async (state: RepCapacityState, id: string) => {
    await request(id);
    seconds = 1;
    return execute(state, {
      type: 'offer',
      assignmentId: id + '-assignment',
      requestId: id,
      direction: 'inbound',
      endpointIds: ['web', 'phone'],
    });
  };
  const fence = (state: RepCapacityState) => ({
    assignmentId: state.owner!.assignmentId,
    generation: state.generation,
  });

  it('commits one winner across competing inbound and outbound connections', async () => {
    const state = await ready('race');
    await request('inbound-request');
    await request('outbound-request');
    seconds = 1;
    const inputs: RepCapacityInput[] = ['inbound', 'outbound'].map(
      (direction) => ({
        workspaceId,
        capacityId: state.capacityId,
        operationId: randomUUID(),
        expectedVersion: state.version,
        action: {
          type: 'offer',
          direction: direction as 'inbound' | 'outbound',
          assignmentId: direction + '-assignment',
          requestId: direction + '-request',
          endpointIds: ['web'],
        },
      }),
    );
    const results = await Promise.allSettled([
      service.execute(inputs[0]!),
      secondService.execute(inputs[1]!),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const owner = (await service.read(workspaceId, 'race'))!;
    expect(owner.owner).not.toBeNull();
    expect((await journal.replay(workspaceId, 'capacity', 'race'))?.state).toBe(
      'reserved',
    );
    await execute(owner, { type: 'cancel', ...fence(owner) });
  });

  it('accepts one endpoint transactionally and keeps the exact idempotent result', async () => {
    const { state } = await makeOffer(
      await ready('endpoints'),
      'endpoint-request',
    );
    seconds = 2;
    const input: RepCapacityInput = {
      workspaceId,
      capacityId: state.capacityId,
      operationId: randomUUID(),
      expectedVersion: state.version,
      action: { type: 'accept', ...fence(state), endpointId: 'web' },
    };
    const phoneInput: RepCapacityInput = {
      ...input,
      operationId: randomUUID(),
      action: { type: 'accept', ...fence(state), endpointId: 'phone' },
    };
    const results = await Promise.allSettled([
      service.execute(input),
      secondService.execute(phoneInput),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const winner = (await service.read(workspaceId, state.capacityId))!;
    const successfulInput =
      winner.owner?.winnerEndpointId === 'web' ? input : phoneInput;
    expect((await service.execute(successfulInput)).duplicate).toBe(true);
    await expect(
      service.execute({ ...successfulInput, capacityId: 'different' }),
    ).rejects.toThrow();
    expect(await service.replay(workspaceId, state.capacityId)).toEqual(winner);
    const count = await pool.query(
      'SELECT count(*)::int AS n FROM dialer_inbound_commands',
    );
    await service.replay(workspaceId, state.capacityId);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM dialer_inbound_commands',
        )
      ).rows,
    ).toEqual(count.rows);
    await execute(winner, { type: 'cancel', ...fence(winner) });
  });

  it('protects escaped offers through expiry, process recreation, and reconciliation', async () => {
    let { state } = await makeOffer(await ready('escaped'), 'escaped-request');
    const commands = await journal.listCommands(workspaceId, 'pending');
    const offer = commands.find(
      (command) =>
        command.command.type === 'offer' &&
        command.command.entityId === state.owner?.assignmentId,
    )!;
    await expect(
      journal.updateCommand(
        workspaceId,
        offer.command.commandId,
        offer.version,
        'dispatched',
      ),
    ).rejects.toThrow();
    seconds = 2;
    ({ state } = await execute(state, {
      type: 'dispatch',
      ...fence(state),
      commandId: offer.command.commandId,
    }));
    seconds = 13;
    ({ state } = await execute(state, { type: 'expire', ...fence(state) }));
    expect(state.owner?.phase).toBe('unknown');
    const recovered = createPostgresRepCapacity(pool, {
      clock: () => at(seconds),
    });
    expect(await recovered.read(workspaceId, state.capacityId)).toEqual(state);
    await expect(
      execute(state, {
        type: 'reconcile',
        ...fence(state),
        outcome: 'no_effect',
        evidenceId: 'query',
      }),
    ).rejects.toThrow();
    await journal.updateCommand(
      workspaceId,
      offer.command.commandId,
      2,
      'unknown',
    );
    await journal.updateCommand(
      workspaceId,
      offer.command.commandId,
      3,
      'failed',
      true,
    );
    ({ state } = await execute(state, {
      type: 'reconcile',
      ...fence(state),
      outcome: 'no_effect',
      evidenceId: 'query',
    }));
    expect(state.owner).toBeNull();
    expect(
      (await journal.replay(workspaceId, 'capacity', state.capacityId))?.state,
    ).toBe('available');
  });

  it('rolls back commands, projections and capacity together on invalid request or tenant', async () => {
    const state = await ready('rollback');
    await expect(
      execute(state, {
        type: 'offer',
        requestId: 'missing',
        assignmentId: 'missing-assignment',
        direction: 'outbound',
        endpointIds: ['web'],
      }),
    ).rejects.toThrow();
    expect(await service.read(workspaceId, state.capacityId)).toEqual(state);
    await expect(
      service.execute({
        workspaceId: 'other',
        capacityId: state.capacityId,
        operationId: randomUUID(),
        expectedVersion: state.version,
        action: { type: 'readiness', ready: true, endpoints: [] },
      }),
    ).rejects.toThrow();
    const commit: InboundCommit = {
      workspaceId,
      fact: {
        source: 'bypass',
        eventKey: 'bypass',
        occurredAt: at(0),
        classification: 'reserve',
      },
      commands: [],
      events: [
        {
          schemaVersion: 1,
          workspaceId,
          entityId: state.capacityId,
          eventId: 'bypass-event',
          kind: 'capacity',
          expectedVersion: 1,
          occurredAt: at(0),
          observedAt: at(0),
          to: 'reserved',
          evidence: 'none',
        },
      ],
    };
    await expect(journal.commit(commit)).rejects.toThrow();
    expect(await service.read(workspaceId, state.capacityId)).toEqual(state);
  });

  it('rejects acceptance after caller abandonment without losing the reservation', async () => {
    let { state } = await makeOffer(
      await ready('abandonment'),
      'abandoned-request',
    );
    seconds = 2;
    await journal.commit({
      workspaceId,
      fact: {
        source: 'caller',
        eventKey: 'caller-ended',
        occurredAt: at(2),
        classification: 'hangup',
      },
      commands: [],
      events: [
        {
          schemaVersion: 1,
          workspaceId,
          entityId: 'abandoned-request',
          eventId: 'queue-before-hangup',
          kind: 'request',
          expectedVersion: 1,
          occurredAt: at(2),
          observedAt: at(2),
          to: 'queued',
          evidence: 'none',
        },
        {
          schemaVersion: 1,
          workspaceId,
          entityId: 'abandoned-request',
          eventId: 'caller-hangup',
          kind: 'request',
          expectedVersion: 2,
          occurredAt: at(2),
          observedAt: at(2),
          to: 'abandoned',
          evidence: 'none',
        },
      ],
    });
    await expect(
      execute(state, { type: 'accept', ...fence(state), endpointId: 'web' }),
    ).rejects.toThrow();
    expect(await service.read(workspaceId, state.capacityId)).toEqual(state);
    ({ state } = await execute(state, { type: 'cancel', ...fence(state) }));
    expect(state.owner).toBeNull();
  });

  it('authorizes the bridge generation and keeps wrap-up occupied after an uncertain connection', async () => {
    let { state } = await makeOffer(await ready('bridge'), 'bridge-request');
    seconds = 2;
    ({ state } = await execute(state, {
      type: 'accept',
      ...fence(state),
      endpointId: 'web',
    }));
    await journal.commit({
      workspaceId,
      fact: {
        source: 'media-fixture',
        eventKey: 'bridge-ready',
        occurredAt: at(2),
        classification: 'bridge-ready',
      },
      events: [
        {
          schemaVersion: 1,
          workspaceId,
          entityId: 'caller-leg',
          eventId: 'caller-leg-event',
          kind: 'leg',
          expectedVersion: 0,
          occurredAt: at(2),
          observedAt: at(2),
          to: 'ringing',
          evidence: 'none',
          identity: {
            kind: 'leg',
            requestId: 'bridge-request',
            role: 'caller',
          },
        },
        {
          schemaVersion: 1,
          workspaceId,
          entityId: 'rep-leg',
          eventId: 'rep-leg-event',
          kind: 'leg',
          expectedVersion: 0,
          occurredAt: at(2),
          observedAt: at(2),
          to: 'ringing',
          evidence: 'none',
          identity: { kind: 'leg', requestId: 'bridge-request', role: 'rep' },
        },
        {
          schemaVersion: 1,
          workspaceId,
          entityId: 'bridge-attempt',
          eventId: 'bridge-created',
          kind: 'bridge',
          expectedVersion: 0,
          occurredAt: at(2),
          observedAt: at(2),
          to: 'pending',
          evidence: 'none',
          identity: {
            kind: 'bridge',
            requestId: 'bridge-request',
            assignmentId: state.owner!.assignmentId,
            callerLegId: 'caller-leg',
            repLegId: 'rep-leg',
          },
        },
        {
          schemaVersion: 1,
          workspaceId,
          entityId: 'bridge-attempt',
          eventId: 'bridge-started',
          kind: 'bridge',
          expectedVersion: 1,
          occurredAt: at(2),
          observedAt: at(2),
          to: 'connecting',
          evidence: 'none',
        },
      ],
      commands: [
        {
          commandId: 'bridge-effect',
          eventId: 'bridge-started',
          kind: 'bridge',
          entityId: 'bridge-attempt',
          type: 'bridge',
        },
      ],
    });
    seconds = 3;
    ({ state } = await execute(state, {
      type: 'dispatch',
      ...fence(state),
      commandId: 'bridge-effect',
    }));
    await journal.commit({
      workspaceId,
      fact: {
        source: 'media-fixture',
        eventKey: 'second-bridge',
        occurredAt: at(3),
        classification: 'bridge-ready',
      },
      events: [
        {
          schemaVersion: 1,
          workspaceId,
          entityId: 'second-bridge',
          eventId: 'second-created',
          kind: 'bridge',
          expectedVersion: 0,
          occurredAt: at(3),
          observedAt: at(3),
          to: 'pending',
          evidence: 'none',
          identity: {
            kind: 'bridge',
            requestId: 'bridge-request',
            assignmentId: state.owner!.assignmentId,
            callerLegId: 'caller-leg',
            repLegId: 'rep-leg',
          },
        },
        {
          schemaVersion: 1,
          workspaceId,
          entityId: 'second-bridge',
          eventId: 'second-started',
          kind: 'bridge',
          expectedVersion: 1,
          occurredAt: at(3),
          observedAt: at(3),
          to: 'connecting',
          evidence: 'none',
        },
      ],
      commands: [
        {
          commandId: 'second-effect',
          eventId: 'second-started',
          kind: 'bridge',
          entityId: 'second-bridge',
          type: 'bridge',
        },
      ],
    });
    await expect(
      execute(state, {
        type: 'dispatch',
        ...fence(state),
        commandId: 'second-effect',
      }),
    ).rejects.toThrow();
    await journal.updateCommand(workspaceId, 'bridge-effect', 2, 'succeeded');
    seconds = 4;
    ({ state } = await execute(state, {
      type: 'reconcile',
      ...fence(state),
      outcome: 'connected',
      evidenceId: 'both-participants',
    }));
    expect(
      (await journal.replay(workspaceId, 'capacity', state.capacityId))?.state,
    ).toBe('connected');
    seconds = 5;
    ({ state } = await execute(state, { type: 'unknown', ...fence(state) }));
    await expect(
      execute(state, {
        type: 'reconcile',
        ...fence(state),
        outcome: 'no_effect',
        evidenceId: 'contradictory',
      }),
    ).rejects.toThrow();
    seconds = 6;
    ({ state } = await execute(state, {
      type: 'reconcile',
      ...fence(state),
      outcome: 'ended',
      evidenceId: 'all-ended',
    }));
    expect(state.owner?.phase).toBe('wrap_up');
    expect(
      (await journal.replay(workspaceId, 'capacity', state.capacityId))?.state,
    ).toBe('wrap_up');
    await expect(
      execute(state, {
        type: 'finish_wrap_up',
        ...fence(state),
        manual: false,
      }),
    ).rejects.toThrow();
    seconds = 36;
    ({ state } = await execute(state, {
      type: 'finish_wrap_up',
      ...fence(state),
      manual: false,
    }));
    expect(state.owner).toBeNull();
    expect(await service.replay(workspaceId, state.capacityId)).toEqual(state);
  });

  it('discovers durable owners after restart with bounded tenant-scoped pages', async () => {
    const first = (
      await makeOffer(await ready('recovery-a'), 'recovery-request-a')
    ).state;
    const second = (
      await makeOffer(await ready('recovery-b'), 'recovery-request-b')
    ).state;
    const recovered = createPostgresRepCapacity(pool);
    const page = await recovered.list({
      workspaceId,
      ownedOnly: true,
      limit: 1,
    });
    expect(page).toHaveLength(1);
    expect(page[0]?.capacityId).toBe('recovery-a');
    const next = await recovered.list({
      workspaceId,
      ownedOnly: true,
      afterCapacityId: page[0]!.capacityId,
      limit: 1,
    });
    expect(next[0]?.capacityId).toBe('recovery-b');
    expect(
      await recovered.list({
        workspaceId: 'other',
        ownedOnly: true,
        limit: 10,
      }),
    ).toEqual([]);
    await expect(
      recovered.list({ workspaceId, limit: 1001 }),
    ).rejects.toThrow();
    await execute(first, { type: 'cancel', ...fence(first) });
    await execute(second, { type: 'cancel', ...fence(second) });
  });

  it('preserves identity uniqueness, history immutability and populated migration rollback', async () => {
    await pool.query(CREATE_REP_CAPACITY_SQL);
    const state = await ready('migration');
    await expect(
      service.execute({
        workspaceId,
        capacityId: 'alias',
        operationId: randomUUID(),
        expectedVersion: 0,
        action: { type: 'register', repId: state.repId, policy },
      }),
    ).rejects.toThrow();
    await expect(
      pool.query(
        'UPDATE dialer_rep_capacity_events SET digest=$1 WHERE workspace_id=$2',
        ['changed', workspaceId],
      ),
    ).rejects.toThrow();
    let offered = (await makeOffer(state, 'migration-request')).state;
    await expect(
      rollbackDialerDatabaseMigration(pool, REP_CAPACITY_MIGRATION_ID),
    ).rejects.toThrow();
    offered = (await execute(offered, { type: 'cancel', ...fence(offered) }))
      .state;
    expect(offered.owner).toBeNull();
    await rollbackDialerDatabaseMigration(pool, REP_CAPACITY_MIGRATION_ID);
    expect(
      (await pool.query("SELECT to_regclass('dialer_rep_capacity') AS name"))
        .rows[0].name,
    ).toBeNull();
    expect(
      (await journal.replay(workspaceId, 'request', 'migration-request'))
        ?.state,
    ).toBe('created');
    await migrateDialerDatabase(pool);
    expect(
      (await pool.query("SELECT to_regclass('dialer_rep_capacity') AS name"))
        .rows[0].name,
    ).toBe('dialer_rep_capacity');
    seconds = 20;
    let restored = (
      await service.execute({
        workspaceId,
        capacityId: state.capacityId,
        operationId: randomUUID(),
        expectedVersion: 0,
        action: { type: 'register', repId: state.repId, policy },
      })
    ).state;
    expect(restored.generation).toBe(1);
    restored = (
      await execute(restored, {
        type: 'readiness',
        ready: true,
        endpoints: [{ endpointId: 'web', kind: 'browser', healthy: true }],
      })
    ).state;
    await request('after-rollback');
    restored = (
      await execute(restored, {
        type: 'offer',
        assignmentId: 'after-rollback-assignment',
        requestId: 'after-rollback',
        direction: 'outbound',
        endpointIds: ['web'],
      })
    ).state;
    expect(restored.generation).toBe(2);
    await expect(
      execute(restored, {
        type: 'accept',
        assignmentId: 'migration-request-assignment',
        generation: 1,
        endpointId: 'web',
      }),
    ).rejects.toThrow();
    await execute(restored, { type: 'cancel', ...fence(restored) });
  });
});
