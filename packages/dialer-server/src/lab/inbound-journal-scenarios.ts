import assert from 'node:assert/strict';
import { Effect } from 'effect';
import type { Pool } from 'pg';
import {
  commitInboundFact,
  type InboundCommit,
  type InboundEvent,
} from '@consuelo/dialer';
import {
  createPostgresInboundJournal,
  createPostgresInboundJournalLayer,
} from '../inbound/postgres-journal';

const at = '2026-09-10T00:00:00.000Z';
const workspaceId = 'rd1-isolated-tenant';
const event = (overrides: Partial<InboundEvent> = {}): InboundEvent => ({
  schemaVersion: 1,
  workspaceId,
  eventId: 'create-request',
  entityId: 'request-1',
  kind: 'request',
  expectedVersion: 0,
  occurredAt: at,
  observedAt: at,
  to: 'created',
  evidence: 'none',
  identity: { kind: 'request', queueId: 'queue-1', enteredAt: at },
  ...overrides,
});
const commit = (
  events: InboundEvent[],
  overrides: Partial<InboundCommit> = {},
): InboundCommit => ({
  workspaceId,
  fact: {
    source: 'simulator',
    eventKey: events[0]!.eventId,
    occurredAt: at,
    classification: 'normalized',
  },
  events,
  commands: [],
  ...overrides,
});

// Called only by the isolated lab; the pool is created by its ephemeral service owner.
export const runInboundJournalScenarios = async (pool: Pool) => {
  let assertions = 0;
  const check = (value: unknown, message: string) => {
    assert.ok(value, message);
    assertions += 1;
  };
  const reject = async (operation: () => Promise<unknown>) => {
    await assert.rejects(operation);
    assertions += 1;
  };
  const journal = createPostgresInboundJournal(pool);
  const count = (
    table:
      | 'dialer_inbound_events'
      | 'dialer_inbound_commands'
      | 'dialer_inbound_facts',
  ) => {
    const queries = {
      dialer_inbound_events:
        'SELECT COUNT(*)::int AS count FROM dialer_inbound_events WHERE workspace_id=$1',
      dialer_inbound_commands:
        'SELECT COUNT(*)::int AS count FROM dialer_inbound_commands WHERE workspace_id=$1',
      dialer_inbound_facts:
        'SELECT COUNT(*)::int AS count FROM dialer_inbound_facts WHERE workspace_id=$1',
    };
    return pool
      .query<{ count: number }>(queries[table], [workspaceId])
      .then((result) => result.rows[0]!.count);
  };
  try {
    await Effect.runPromise(
      commitInboundFact(commit([event()])).pipe(
        Effect.provide(createPostgresInboundJournalLayer(pool)),
      ),
    );
    await journal.commit(
      commit([
        event({
          kind: 'capacity',
          eventId: 'create-capacity',
          entityId: 'slot-1',
          identity: { kind: 'capacity', repId: 'rep-1', slot: 0 },
          to: 'available',
        }),
      ]),
    );
    await reject(() =>
      journal.commit(
        commit([
          event({
            kind: 'capacity',
            eventId: 'duplicate-slot',
            entityId: 'slot-2',
            identity: { kind: 'capacity', repId: 'rep-1', slot: 0 },
            to: 'available',
          }),
        ]),
      ),
    );
    const queued = event({
      eventId: 'queued',
      expectedVersion: 1,
      identity: undefined,
      to: 'queued',
    });
    const queuedInput = commit([queued], {
      commands: [
        {
          commandId: 'notify-1',
          eventId: 'queued',
          entityId: 'request-1',
          kind: 'request',
          type: 'notify',
        },
      ],
      decision: {
        schemaVersion: 1,
        decisionId: 'decision-1',
        requestId: 'request-1',
        policyVersion: 'fixture-v1',
        decidedAt: at,
        queueId: 'queue-1',
        queueVersion: 0,
        requestState: 'created',
        requestVersion: 1,
        waitingMilliseconds: 0,
        candidates: [
          {
            repId: 'rep-1',
            capacityId: 'slot-1',
            capacityVersion: 1,
            capacityState: 'available',
            eligible: true,
            reasons: ['available'],
          },
        ],
        proposedCapacityId: 'slot-1',
      },
    });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => journal.commit(queuedInput)),
    );
    check(
      results.filter((result) => !result.duplicate).length === 1,
      'one duplicate fact owner',
    );
    check(
      (await count('dialer_inbound_commands')) === 1,
      'duplicate facts do not duplicate commands',
    );
    check(
      (await count('dialer_inbound_events')) === 3,
      'duplicate facts do not duplicate events',
    );
    await reject(() =>
      journal.commit({
        ...queuedInput,
        events: [{ ...queued, to: 'rejected' }],
      }),
    );
    const race = await Promise.allSettled(
      ['offer-a', 'offer-b'].map((eventId) =>
        journal.commit(
          commit([
            event({
              eventId,
              expectedVersion: 2,
              identity: undefined,
              to: 'offering',
            }),
          ]),
        ),
      ),
    );
    const concurrentWinners = race.filter(
      (result) => result.status === 'fulfilled',
    ).length;
    check(concurrentWinners === 1, 'one version writer');
    await reject(() =>
      journal.commit(
        commit(
          [
            event({
              eventId: 'invalid-bridge-command',
              expectedVersion: 3,
              identity: undefined,
              to: 'queued',
            }),
          ],
          {
            commands: [
              {
                commandId: 'invalid-bridge-command',
                eventId: 'invalid-bridge-command',
                entityId: 'request-1',
                kind: 'request',
                type: 'bridge',
              },
            ],
          },
        ),
      ),
    );
    const before = await count('dialer_inbound_events');
    const beforeFacts = await count('dialer_inbound_facts');
    await reject(() =>
      journal.commit(
        commit(
          [
            event({
              eventId: 'rollback-first',
              expectedVersion: 3,
              identity: undefined,
              to: 'queued',
            }),
            event({
              eventId: 'rollback-second',
              expectedVersion: 4,
              identity: undefined,
              to: 'completed',
            }),
          ],
          {
            commands: [
              {
                commandId: 'rollback-command',
                eventId: 'rollback-first',
                entityId: 'request-1',
                kind: 'request',
                type: 'notify',
              },
            ],
          },
        ),
      ),
    );
    check(
      (await count('dialer_inbound_events')) === before,
      'invalid plan rolls back all history',
    );
    check(
      (await count('dialer_inbound_facts')) === beforeFacts,
      'invalid plan does not consume fact',
    );
    check(
      (await journal.replay(workspaceId, 'request', 'request-1'))?.version ===
        3,
      'invalid plan rolls back materialization',
    );
    check(
      (await count('dialer_inbound_commands')) === 1,
      'invalid plan cannot leak commands',
    );
    await reject(() =>
      journal.commit(
        commit([
          event({ eventId: 'cross-tenant', workspaceId: 'another-tenant' }),
        ]),
      ),
    );
    await reject(() =>
      journal.commit(
        commit([
          event({
            eventId: 'missing-request',
            kind: 'leg',
            entityId: 'bad-leg',
            identity: {
              kind: 'leg',
              requestId: 'foreign-request',
              role: 'caller',
            },
            to: 'ringing',
          }),
        ]),
      ),
    );
    await reject(() =>
      journal.commit(
        commit(
          [
            event({
              eventId: 'pii-event',
              expectedVersion: 3,
              identity: undefined,
              to: 'queued',
            }),
          ],
          {
            fact: {
              source: 'simulator',
              eventKey: 'pii',
              occurredAt: at,
              classification: 'normalized',
              ...{ phoneNumber: '+15555550123' },
            },
          },
        ),
      ),
    );
    await journal.commit(
      commit([
        event({
          eventId: 'create-leg',
          kind: 'leg',
          entityId: 'leg-1',
          identity: { kind: 'leg', requestId: 'request-1', role: 'caller' },
          to: 'ringing',
        }),
      ]),
    );
    await journal.commit(
      commit([
        event({
          eventId: 'end-leg',
          kind: 'leg',
          entityId: 'leg-1',
          expectedVersion: 1,
          identity: undefined,
          to: 'ended',
        }),
      ]),
    );
    const late = commit([
      event({
        eventId: 'late-answer',
        kind: 'leg',
        entityId: 'leg-1',
        expectedVersion: 2,
        identity: undefined,
        to: 'answered',
      }),
    ]);
    await journal.commit(late);
    check(
      (await journal.replay(workspaceId, 'leg', 'leg-1'))?.state === 'ended',
      'late answer cannot revive leg',
    );
    await reject(() =>
      journal.commit({
        ...late,
        fact: { ...late.fact, eventKey: 'late-command' },
        events: [{ ...late.events[0]!, eventId: 'late-command' }],
        commands: [
          {
            commandId: 'late-command',
            eventId: 'late-command',
            entityId: 'leg-1',
            kind: 'leg',
            type: 'notify',
          },
        ],
      }),
    );
    const beforeReplay = await count('dialer_inbound_commands');
    const recovered = createPostgresInboundJournal(pool);
    const replayed = await recovered.replay(
      workspaceId,
      'request',
      'request-1',
    );
    const materialized = await pool.query<{ snapshot: unknown }>(
      "SELECT snapshot FROM dialer_inbound_entities WHERE workspace_id=$1 AND kind='request' AND entity_id='request-1'",
      [workspaceId],
    );
    assert.deepEqual(replayed, materialized.rows[0]?.snapshot);
    assertions += 1;
    check(
      (await count('dialer_inbound_commands')) === beforeReplay,
      'replay issues no effects',
    );
    check(
      (await recovered.replay('another-tenant', 'request', 'request-1')) ===
        null,
      'replay tenant isolation',
    );
    await reject(() =>
      pool.query(
        'UPDATE dialer_inbound_decisions SET decision=decision WHERE workspace_id=$1',
        [workspaceId],
      ),
    );
    await reject(() =>
      pool.query('DELETE FROM dialer_inbound_events WHERE workspace_id=$1', [
        workspaceId,
      ]),
    );
    const claims = await Promise.allSettled(
      [1, 2].map(() =>
        journal.updateCommand(workspaceId, 'notify-1', 1, 'dispatched'),
      ),
    );
    check(
      claims.filter((result) => result.status === 'fulfilled').length === 1,
      'one outbox dispatch claimant',
    );
    check(
      (await journal.listCommands(workspaceId, 'pending')).length === 0,
      'claimed command is not pending',
    );
    await journal.updateCommand(workspaceId, 'notify-1', 2, 'unknown');
    check(
      (await journal.listCommands(workspaceId, 'unknown'))[0]?.version === 3,
      'recovery can find unknown commands',
    );
    check(
      (await journal.listCommands('another-tenant', 'unknown')).length === 0,
      'outbox read tenant isolation',
    );
    await reject(() =>
      journal.updateCommand(workspaceId, 'notify-1', 3, 'dispatched'),
    );
    await reject(() =>
      journal.updateCommand(workspaceId, 'notify-1', 3, 'failed'),
    );
    await journal.updateCommand(workspaceId, 'notify-1', 3, 'succeeded', true);
    await reject(() =>
      journal.updateCommand(workspaceId, 'notify-1', 4, 'failed', true),
    );
    const outcomes = await pool.query<{ status: string }>(
      'SELECT status FROM dialer_inbound_command_events WHERE workspace_id=$1 AND command_id=$2 ORDER BY version',
      [workspaceId, 'notify-1'],
    );
    assert.deepEqual(
      outcomes.rows.map((row) => row.status),
      ['pending', 'dispatched', 'unknown', 'succeeded'],
    );
    assertions += 1;
    return { assertions, concurrentWinners, replayWithoutEffects: true };
  } catch (cause: unknown) {
    throw new Error('Isolated inbound journal scenario failed', { cause });
  }
};
