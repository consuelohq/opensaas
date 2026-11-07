import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
} from 'bun:test';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { Effect } from 'effect';
import type {
  DialerTeamView,
  LeadConnectorTeamMember,
} from '@consuelo/lead-connector';
import type {
  InboundQueuePolicy,
  RepCapacityState,
  RepCapacityAction,
} from '@consuelo/dialer';
import { migrateDialerDatabase } from '../database/migrations';
import { initializeCommercialPersistence } from './persistence';
import { createTeamAccessService } from './team';
import { createPostgresInboundRouting } from '../inbound/routing';
import { createPostgresRepCapacity } from '../inbound/rep-capacity';
import { createPostgresInboundJournal } from '../inbound/postgres-journal';
const port = Number(process.env.CONSUELO_RD5_PG_PORT);
const suite =
  Number.isInteger(port) && port > 1024 && port < 65536
    ? describe
    : describe.skip;
suite('transactional CRM team access', () => {
  const db = 'rd5_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({
    host: '127.0.0.1',
    port,
    user: 'postgres',
    database: 'postgres',
  });
  const pool = new Pool({
    host: '127.0.0.1',
    port,
    user: 'postgres',
    database: db,
    max: 8,
  });
  const identity = {
    workspaceId: 'company',
    locationId: 'location',
    installationId: 'installation',
    userId: 'admin',
    role: 'admin',
    contextType: 'location' as const,
  };
  let members: LeadConnectorTeamMember[];
  let workspaceId: string;
  let actor: typeof identity;
  const service = createTeamAccessService({
    pool,
    directory: async () => structuredClone(members),
  });
  const queue = (workspace: string): InboundQueuePolicy => ({
    schemaVersion: 1,
    policyVersion: 'initial',
    workspaceId: workspace,
    queueId: 'sales',
    timezone: 'UTC',
    weekly: [],
    closedDates: [],
    emergencyClosed: false,
    maxWaitMilliseconds: 120000,
    maxOffers: 3,
    reofferMilliseconds: 10000,
    profiles: [],
  });
  beforeAll(async () => {
    await admin.query('CREATE DATABASE ' + db);
    await migrateDialerDatabase(pool);
    await Effect.runPromise(
      initializeCommercialPersistence({
        query: async (s, v) => {
          const r = await pool.query(s, v ? [...v] : []);
          return { rows: r.rows, rowCount: r.rowCount ?? undefined };
        },
      }),
    );
  }, 30000);
  afterAll(async () => {
    await pool.end();
    await admin.query('DROP DATABASE IF EXISTS ' + db);
    await admin.end();
  });
  beforeEach(async () => {
    workspaceId = 'company-' + randomUUID();
    actor = {
      ...identity,
      workspaceId,
      locationId: 'location-' + randomUUID(),
    };
    members = [
      { id: 'admin', name: 'Admin', role: 'admin', canCall: true },
      { id: 'alice', name: 'Alice', role: 'user', canCall: true },
      { id: 'bob', name: 'Bob', role: 'user', canCall: true },
    ];
    await pool.query(
      `INSERT INTO consuelo_lead_connector_installations(installation_id,workspace_id,location_id,access_token_ciphertext,refresh_token_ciphertext,expires_at,connected_at,updated_at) VALUES($1,$2,$3,'fixture','fixture',now()+interval '1 hour',now(),now())`,
      [actor.installationId, workspaceId, actor.locationId],
    );
    await createPostgresInboundRouting(pool).configureQueue(
      queue(workspaceId),
      0,
    );
  });
  const paid = async (seats = 1) => {
    const id = randomUUID(),
      sub = 'sub-' + id;
    await pool.query(
      `INSERT INTO dialer_workspace_subscriptions(workspace_id,provider_subscription_id,status) VALUES($1,$2,'active')`,
      [workspaceId, sub],
    );
    await pool.query(
      `INSERT INTO dialer_public_purchases(id,selection,claim_hash,origin,provider_subscription_id,provider_status,paid_at,claimed_workspace_id,entitlement_selection) VALUES($1,'{}','fixture','https://fixture.test',$2,'active',now(),$3,$4)`,
      [id, sub, workspaceId, JSON.stringify({ plan: 'professional', seats })],
    );
  };
  const change = (
    v: DialerTeamView,
    userId: string,
    enabled = true,
    queueIds = enabled ? ['sales'] : [],
  ) => ({
    revision: v.revision,
    directoryVersion: v.directoryVersion,
    userId,
    enabled,
    queueIds,
  });
  it('lists named CRM members and commits purchased access, real queue membership and away capacity together', async () => {
    await paid();
    const first = await service.read(actor);
    expect(first.members.map((m) => m.name)).toEqual(['Admin', 'Alice', 'Bob']);
    expect(first.paidSeats).toBe(1);
    const next = await service.update(actor, change(first, 'alice'));
    expect(next.assignedSeats).toBe(1);
    expect(next.members.find((m) => m.id === 'alice')).toMatchObject({
      assigned: true,
      queueIds: ['sales'],
      capacityState: 'away',
    });
    expect(
      (
        await pool.query(
          'SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1',
          [workspaceId],
        )
      ).rows[0].snapshot.ready,
    ).toBe(false);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM dialer_team_access_events WHERE workspace_id=$1',
          [workspaceId],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it('supports a maximum-length CRM identity and retains immutable assignment evidence', async () => {
    await paid();
    const id = 'r'.repeat(160);
    members.push({
      id,
      name: 'Long identity rep',
      role: 'user',
      canCall: true,
    });
    await service.update(actor, change(await service.read(actor), id));
    const rep = (
      await pool.query<{ snapshot: RepCapacityState }>(
        'SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1 AND rep_id=$2',
        [workspaceId, id],
      )
    ).rows[0]!.snapshot;
    expect(rep.capacityId.length).toBeLessThanOrEqual(160);
    await expect(
      pool.query(
        'DELETE FROM dialer_team_access_events WHERE workspace_id=$1',
        [workspaceId],
      ),
    ).rejects.toThrow('immutable');
  });
  it('serializes competing admins without over-allocating paid quantity or silently overwriting a view', async () => {
    await paid();
    const first = await service.read(actor);
    const results = await Promise.allSettled([
      service.update(actor, change(first, 'alice')),
      service.update(actor, change(first, 'bob')),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const current = await service.read(actor);
    expect(current.assignedSeats).toBe(1);
    await expect(
      service.update(
        actor,
        change(
          current,
          current.members.find((m) => !m.assigned && m.id !== 'admin')!.id,
        ),
      ),
    ).rejects.toThrow('TEAM_SEAT_LIMIT');
  });
  it('rejects foreign users, forged scopes/plans, stale CRM roles, stale directory and removed installation', async () => {
    await paid(3);
    let first = await service.read(actor);
    await expect(
      service.update(actor, change(first, 'foreign')),
    ).rejects.toThrow('TEAM_MEMBER_INELIGIBLE');
    await expect(
      service.update(actor, change(first, 'foreign', false)),
    ).rejects.toThrow('TEAM_MEMBER_INELIGIBLE');
    await expect(
      service.update(actor, {
        ...change(first, 'alice'),
        workspaceId: 'foreign',
      }),
    ).rejects.toThrow('INVALID_TEAM_CHANGE');
    await expect(
      service.update(actor, { ...change(first, 'alice'), planCode: 'power' }),
    ).rejects.toThrow('INVALID_TEAM_CHANGE');
    members[0]!.role = 'user';
    await expect(service.update(actor, change(first, 'alice'))).rejects.toThrow(
      'ADMIN_REQUIRED',
    );
    members[0]!.role = 'admin';
    members[1]!.canCall = false;
    await expect(service.update(actor, change(first, 'alice'))).rejects.toThrow(
      'TEAM_VIEW_CHANGED',
    );
    await expect(
      service.read({ ...actor, locationId: 'foreign' }),
    ).rejects.toThrow('TEAM_INSTALLATION_CHANGED');
    await pool.query(
      'DELETE FROM consuelo_lead_connector_installations WHERE workspace_id=$1',
      [workspaceId],
    );
    await expect(service.update(actor, change(first, 'bob'))).rejects.toThrow(
      'TEAM_INSTALLATION_CHANGED',
    );
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM dialer_team_seats WHERE workspace_id=$1',
          [workspaceId],
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it('leaves Starter personal access free but cannot assign free extra seats or nonexistent queues', async () => {
    let first = await service.read(actor);
    expect(first.members.find((m) => m.id === 'admin')?.starter).toBe(true);
    await expect(service.update(actor, change(first, 'alice'))).rejects.toThrow(
      'TEAM_PAID_ACCESS_REQUIRED',
    );
    await expect(
      service.update(actor, change(first, 'admin', true, ['invented'])),
    ).rejects.toThrow('TEAM_QUEUE_NOT_FOUND');
    const next = await service.update(actor, change(first, 'admin'));
    expect(next.paidSeats).toBe(0);
    expect(next.assignedSeats).toBe(0);
    expect(next.members.find((m) => m.id === 'admin')?.queueIds).toEqual([
      'sales',
    ]);
  });
  it('rechecks the signed paid projection after a downgrade and preserves existing assignments', async () => {
    await paid(2);
    let view = await service.update(
      actor,
      change(await service.read(actor), 'alice'),
    );
    await pool.query(
      `UPDATE dialer_public_purchases SET entitlement_selection=jsonb_set(entitlement_selection,'{seats}','1'::jsonb),generation=generation+1 WHERE claimed_workspace_id=$1`,
      [workspaceId],
    );
    await expect(service.update(actor, change(view, 'bob'))).rejects.toThrow(
      'TEAM_VIEW_CHANGED',
    );
    view = await service.read(actor);
    await expect(service.update(actor, change(view, 'bob'))).rejects.toThrow(
      'TEAM_SEAT_LIMIT',
    );
    expect(view.assignedSeats).toBe(1);
  });
  it('revokes readiness and new offers while preserving an escaped unknown owner across process recreation', async () => {
    await paid();
    let view = await service.update(
      actor,
      change(await service.read(actor), 'alice'),
    );
    const capacity = createPostgresRepCapacity(pool);
    let rep = (
      await pool.query<{ snapshot: RepCapacityState }>(
        "SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1 AND rep_id='alice'",
        [workspaceId],
      )
    ).rows[0]!.snapshot;
    const execute = async (action: RepCapacityAction) => {
      rep = (
        await capacity.execute({
          workspaceId,
          capacityId: rep.capacityId,
          operationId: randomUUID(),
          expectedVersion: rep.version,
          action,
        })
      ).state;
    };
    await execute({
      type: 'readiness',
      ready: true,
      endpoints: [{ endpointId: 'web:alice', kind: 'browser', healthy: true }],
    });
    const journal = createPostgresInboundJournal(pool);
    const at = new Date().toISOString();
    await journal.commit({
      workspaceId,
      fact: {
        source: 'fixture',
        eventKey: 'caller',
        occurredAt: at,
        classification: 'create',
      },
      commands: [],
      events: [
        {
          schemaVersion: 1,
          workspaceId,
          entityId: 'caller',
          eventId: 'caller',
          kind: 'request',
          expectedVersion: 0,
          occurredAt: at,
          observedAt: at,
          to: 'created',
          evidence: 'none',
          identity: { kind: 'request', queueId: 'sales', enteredAt: at },
        },
      ],
    });
    await execute({
      type: 'offer',
      assignmentId: 'offer',
      requestId: 'caller',
      direction: 'inbound',
      endpointIds: ['web:alice'],
    });
    const command = (await journal.listCommands(workspaceId, 'pending')).find(
      (c) => c.command.type === 'offer',
    )!;
    await execute({
      type: 'dispatch',
      assignmentId: 'offer',
      generation: rep.generation,
      commandId: command.command.commandId,
    });
    await execute({
      type: 'unknown',
      assignmentId: 'offer',
      generation: rep.generation,
    });
    const owner = structuredClone(rep.owner);
    view = await service.update(
      actor,
      change(await service.read(actor), 'alice', false),
    );
    expect(view.assignedSeats).toBe(0);
    rep = (await createPostgresRepCapacity(pool).read(
      workspaceId,
      rep.capacityId,
    ))!;
    expect(rep.ready).toBe(false);
    expect(rep.owner).toEqual(owner);
    await expect(
      execute({
        type: 'readiness',
        ready: true,
        endpoints: [
          { endpointId: 'web:alice', kind: 'browser', healthy: true },
        ],
      }),
    ).rejects.toThrow();
    await expect(
      service.assertCanCall({ ...actor, userId: 'alice' }),
    ).rejects.toThrow('TEAM_ACCESS_REVOKED');
    await expect(
      execute({
        type: 'reconcile',
        assignmentId: 'offer',
        generation: rep.generation,
        outcome: 'no_effect',
        evidenceId: 'provider-lookup',
      }),
    ).rejects.toThrow();
    await journal.updateCommand(
      workspaceId,
      command.command.commandId,
      2,
      'unknown',
    );
    await journal.updateCommand(
      workspaceId,
      command.command.commandId,
      3,
      'failed',
      true,
    );
    await execute({
      type: 'reconcile',
      assignmentId: 'offer',
      generation: rep.generation,
      outcome: 'no_effect',
      evidenceId: 'provider-lookup',
    });
    expect(rep.owner).toBeNull();
    expect(rep.ready).toBe(false);
  });
});
