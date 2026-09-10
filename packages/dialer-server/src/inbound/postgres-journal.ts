import { createHash } from 'node:crypto';
import { Effect, Layer } from 'effect';
import type { Pool, PoolClient } from 'pg';
import {
  applyInboundEvent,
  decodeInboundCommit,
  InboundJournal,
  InboundOutbox,
  InboundPersistenceError,
  replayInboundEvents,
  type InboundCommit,
  type InboundCommitResult,
  type InboundEvent,
  type InboundKind,
  type InboundSnapshot,
  type InboundStoredCommand,
  type InboundCommandStatus,
} from '@consuelo/dialer';

const canonical = (value: unknown): string => {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return (
    '{' +
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => JSON.stringify(key) + ':' + canonical(item))
      .join(',') +
    '}'
  );
};

const transaction = async <TResult>(
  pool: Pool,
  workspaceId: string,
  operation: (client: PoolClient) => Promise<TResult>,
): Promise<TResult> => {
  const client = await pool.connect();
  let discardConnection = false;
  try {
    await client.query('BEGIN');
    // A short per-tenant authority transaction also serializes creation of absent rows.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      ['inbound:' + workspaceId],
    );
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (cause: unknown) {
    try {
      await client.query('ROLLBACK');
    } catch {
      discardConnection = true;
    }
    throw new InboundPersistenceError('Inbound transaction failed', { cause });
  } finally {
    client.release(discardConnection);
  }
};

const readSnapshot = async (
  client: PoolClient,
  workspaceId: string,
  kind: InboundKind,
  entityId: string,
) => {
  try {
    const result = await client.query<{ snapshot: InboundSnapshot }>(
      'SELECT snapshot FROM dialer_inbound_entities WHERE workspace_id=$1 AND kind=$2 AND entity_id=$3',
      [workspaceId, kind, entityId],
    );
    return result.rows[0]?.snapshot ?? null;
  } catch (cause: unknown) {
    throw new InboundPersistenceError('Inbound state read failed', { cause });
  }
};

const persistLinks = async (client: PoolClient, snapshot: InboundSnapshot) => {
  try {
    const identity = snapshot.identity;
    const links: { relation: string; kind: InboundKind; id: string }[] = [];
    if ('requestId' in identity)
      links.push({
        relation: 'request',
        kind: 'request',
        id: identity.requestId,
      });
    if (identity.kind === 'assignment')
      links.push({
        relation: 'capacity',
        kind: 'capacity',
        id: identity.capacityId,
      });
    if (identity.kind === 'bridge')
      links.push(
        {
          relation: 'assignment',
          kind: 'assignment',
          id: identity.assignmentId,
        },
        { relation: 'caller', kind: 'leg', id: identity.callerLegId },
        { relation: 'rep', kind: 'leg', id: identity.repLegId },
      );
    for (const link of links) {
      const target = await readSnapshot(
        client,
        snapshot.workspaceId,
        link.kind,
        link.id,
      );
      if (!target) throw new Error('Missing same-tenant entity reference');
      if (
        identity.kind === 'bridge' &&
        'requestId' in target.identity &&
        target.identity.requestId !== identity.requestId
      )
        throw new Error('Bridge crosses requests');
      if (
        identity.kind === 'bridge' &&
        target.identity.kind === 'leg' &&
        target.identity.role !== (link.relation === 'caller' ? 'caller' : 'rep')
      )
        throw new Error('Invalid bridge participant role');
      await client.query(
        'INSERT INTO dialer_inbound_links(workspace_id,entity_kind,entity_id,relation,target_kind,target_id) VALUES($1,$2,$3,$4,$5,$6)',
        [
          snapshot.workspaceId,
          identity.kind,
          snapshot.entityId,
          link.relation,
          link.kind,
          link.id,
        ],
      );
    }
  } catch (cause: unknown) {
    throw new InboundPersistenceError('Inbound references are invalid', {
      cause,
    });
  }
};

const persistDecision = async (client: PoolClient, input: InboundCommit) => {
  try {
    const decision = input.decision;
    if (!decision) return;
    const request = await readSnapshot(
      client,
      input.workspaceId,
      'request',
      decision.requestId,
    );
    if (
      !request ||
      request.identity.kind !== 'request' ||
      decision.queueId !== request.identity.queueId ||
      decision.requestState !== request.state ||
      decision.requestVersion !== request.version ||
      !['created', 'queued', 'offering'].includes(request.state) ||
      decision.waitingMilliseconds !==
        Date.parse(decision.decidedAt) -
          Date.parse(request.identity.enteredAt) ||
      decision.decidedAt < request.updatedAt ||
      decision.decidedAt < request.createdAt ||
      decision.decidedAt > input.events[0]!.observedAt
    )
      throw new Error('Invalid decision request/time');
    const candidates = new Set<string>();
    for (const candidate of decision.candidates) {
      if (candidates.has(candidate.capacityId))
        throw new Error('Duplicate decision candidate');
      candidates.add(candidate.capacityId);
      const capacity = await readSnapshot(
        client,
        input.workspaceId,
        'capacity',
        candidate.capacityId,
      );
      if (
        !capacity ||
        capacity.identity.kind !== 'capacity' ||
        capacity.identity.repId !== candidate.repId ||
        capacity.version !== candidate.capacityVersion ||
        capacity.state !== candidate.capacityState ||
        capacity.updatedAt > decision.decidedAt
      )
        throw new Error('Invalid decision capacity snapshot');
    }
    if (
      decision.proposedCapacityId !== null &&
      !decision.candidates.some(
        (candidate) =>
          candidate.capacityId === decision.proposedCapacityId &&
          candidate.eligible,
      )
    )
      throw new Error('Ineligible decision proposal');
    await client.query(
      'INSERT INTO dialer_inbound_decisions(workspace_id,decision_id,request_id,decision,source,event_key) VALUES($1,$2,$3,$4,$5,$6)',
      [
        input.workspaceId,
        decision.decisionId,
        decision.requestId,
        JSON.stringify(decision),
        input.fact.source,
        input.fact.eventKey,
      ],
    );
  } catch (cause: unknown) {
    throw new InboundPersistenceError('Inbound decision is invalid', { cause });
  }
};

export const createPostgresInboundJournal = (pool: Pool) => {
  const commit = async (raw: InboundCommit): Promise<InboundCommitResult> => {
    try {
      const input = decodeInboundCommit(raw);
      const digest = createHash('sha256')
        .update(
          canonical({
            fact: input.fact,
            events: input.events.map(
              ({
                eventId: _id,
                expectedVersion: _version,
                observedAt: _observed,
                ...fact
              }) => fact,
            ),
          }),
        )
        .digest('hex');
      return await transaction(pool, input.workspaceId, async (client) => {
        try {
          const existing = await client.query<{
            digest: string;
            result: InboundCommitResult;
          }>(
            'SELECT digest,result FROM dialer_inbound_facts WHERE workspace_id=$1 AND source=$2 AND event_key=$3',
            [input.workspaceId, input.fact.source, input.fact.eventKey],
          );
          if (existing.rows[0]) {
            if (existing.rows[0].digest !== digest)
              throw new Error('Provider deduplication identity collision');
            return { ...existing.rows[0].result, duplicate: true };
          }
          await client.query(
            'INSERT INTO dialer_inbound_facts(workspace_id,source,event_key,digest,fact) VALUES($1,$2,$3,$4,$5)',
            [
              input.workspaceId,
              input.fact.source,
              input.fact.eventKey,
              digest,
              JSON.stringify(input.fact),
            ],
          );
          // Decision features describe pre-transition state and cannot see outcomes from this commit.
          await persistDecision(client, input);
          const snapshots: InboundSnapshot[] = [];
          const accepted = new Map<string, InboundEvent>();
          for (const event of input.events) {
            if (
              event.workspaceId !== input.workspaceId ||
              event.occurredAt !== input.fact.occurredAt
            )
              throw new Error('Fact scope/time mismatch');
            const previous = await readSnapshot(
              client,
              input.workspaceId,
              event.kind,
              event.entityId,
            );
            const next = applyInboundEvent(previous, event);
            if (next.applied) {
              await client.query(
                'INSERT INTO dialer_inbound_entities(workspace_id,kind,entity_id,version,snapshot) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,kind,entity_id) DO UPDATE SET version=EXCLUDED.version,snapshot=EXCLUDED.snapshot',
                [
                  input.workspaceId,
                  event.kind,
                  event.entityId,
                  next.snapshot.version,
                  JSON.stringify(next.snapshot),
                ],
              );
              if (!previous) await persistLinks(client, next.snapshot);
              accepted.set(event.eventId, event);
            }
            await client.query(
              'INSERT INTO dialer_inbound_events(workspace_id,event_id,kind,entity_id,source,event_key,event,applied) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
              [
                input.workspaceId,
                event.eventId,
                event.kind,
                event.entityId,
                input.fact.source,
                input.fact.eventKey,
                JSON.stringify(event),
                next.applied,
              ],
            );
            snapshots.push(next.snapshot);
          }
          for (const command of input.commands) {
            const event = accepted.get(command.eventId);
            if (
              !event ||
              event.kind !== command.kind ||
              event.entityId !== command.entityId
            )
              throw new Error('Command requires an applied causal event');
            const valid =
              command.type === 'notify' ||
              (command.type === 'offer' &&
                event.kind === 'assignment' &&
                event.to === 'offering') ||
              (command.type === 'bridge' &&
                event.kind === 'bridge' &&
                event.to === 'connecting') ||
              (command.type === 'terminate_leg' && event.kind === 'leg') ||
              (command.type === 'start_callback' &&
                event.kind === 'callback' &&
                event.to === 'dialing') ||
              (command.type === 'reconcile' && event.to === 'unknown');
            if (!valid)
              throw new Error(
                'Command does not match the lifecycle transition',
              );
            await client.query(
              'INSERT INTO dialer_inbound_commands(workspace_id,command_id,event_id,command) VALUES($1,$2,$3,$4)',
              [
                input.workspaceId,
                command.commandId,
                command.eventId,
                JSON.stringify(command),
              ],
            );
            await client.query(
              "INSERT INTO dialer_inbound_command_events(workspace_id,command_id,version,status,reconciled) VALUES($1,$2,1,'pending',false)",
              [input.workspaceId, command.commandId],
            );
          }
          const result: InboundCommitResult = { duplicate: false, snapshots };
          await client.query(
            'UPDATE dialer_inbound_facts SET result=$4 WHERE workspace_id=$1 AND source=$2 AND event_key=$3',
            [
              input.workspaceId,
              input.fact.source,
              input.fact.eventKey,
              JSON.stringify(result),
            ],
          );
          return result;
        } catch (cause: unknown) {
          throw new InboundPersistenceError('Inbound fact transaction failed', {
            cause,
          });
        }
      });
    } catch (cause: unknown) {
      throw new InboundPersistenceError('Inbound fact commit failed', {
        cause,
      });
    }
  };

  const replay = async (
    workspaceId: string,
    kind: InboundKind,
    entityId: string,
  ) => {
    try {
      const rows = await pool.query<{ event: InboundEvent }>(
        'SELECT event FROM dialer_inbound_events WHERE workspace_id=$1 AND kind=$2 AND entity_id=$3 ORDER BY sequence',
        [workspaceId, kind, entityId],
      );
      return replayInboundEvents(rows.rows.map((row) => row.event));
    } catch (cause: unknown) {
      throw new InboundPersistenceError('Inbound replay failed', { cause });
    }
  };

  const updateCommand = (
    workspaceId: string,
    commandId: string,
    expectedVersion: number,
    status: InboundCommandStatus,
    reconciled = false,
  ): Promise<InboundStoredCommand> =>
    transaction(pool, workspaceId, async (client) => {
      try {
        const rows = await client.query<{
          command: InboundStoredCommand['command'];
          version: number;
          status: InboundCommandStatus;
        }>(
          'SELECT command,version,status FROM dialer_inbound_commands WHERE workspace_id=$1 AND command_id=$2',
          [workspaceId, commandId],
        );
        const previous = rows.rows[0];
        const allowed =
          previous?.status === 'pending'
            ? ['dispatched']
            : previous?.status === 'dispatched'
              ? ['succeeded', 'failed', 'unknown']
              : previous?.status === 'unknown' && reconciled
                ? ['succeeded', 'failed']
                : [];
        if (
          !previous ||
          previous.version !== expectedVersion ||
          !allowed.includes(status)
        )
          throw new Error('Invalid command outcome or version');
        const version = previous.version + 1;
        await client.query(
          'UPDATE dialer_inbound_commands SET version=$3,status=$4 WHERE workspace_id=$1 AND command_id=$2',
          [workspaceId, commandId, version, status],
        );
        await client.query(
          'INSERT INTO dialer_inbound_command_events(workspace_id,command_id,version,status,reconciled) VALUES($1,$2,$3,$4,$5)',
          [workspaceId, commandId, version, status, reconciled],
        );
        return { workspaceId, command: previous.command, version, status };
      } catch (cause: unknown) {
        throw new InboundPersistenceError('Inbound command outcome failed', {
          cause,
        });
      }
    });

  const listCommands = async (
    workspaceId: string,
    status: InboundCommandStatus,
    afterCommandId = '',
  ) => {
    try {
      const rows = await pool.query<{
        command: InboundStoredCommand['command'];
        version: number;
        status: InboundCommandStatus;
      }>(
        'SELECT command,version,status FROM dialer_inbound_commands WHERE workspace_id=$1 AND status=$2 AND command_id>$3 ORDER BY command_id LIMIT 100',
        [workspaceId, status, afterCommandId],
      );
      return rows.rows.map((row) => ({ ...row, workspaceId }));
    } catch (cause: unknown) {
      throw new InboundPersistenceError('Inbound outbox read failed', {
        cause,
      });
    }
  };
  return { commit, replay, updateCommand, listCommands };
};

export const createPostgresInboundJournalLayer = (pool: Pool) => {
  const journal = createPostgresInboundJournal(pool);
  return Layer.succeed(InboundJournal, {
    commit: (input) =>
      Effect.tryPromise({
        try: () => journal.commit(input),
        catch: (cause) =>
          new InboundPersistenceError('Inbound commit failed', { cause }),
      }),
    replay: (workspaceId, kind, entityId) =>
      Effect.tryPromise({
        try: () => journal.replay(workspaceId, kind, entityId),
        catch: (cause) =>
          new InboundPersistenceError('Inbound replay failed', { cause }),
      }),
  });
};

export const createPostgresInboundOutboxLayer = (pool: Pool) => {
  const journal = createPostgresInboundJournal(pool);
  return Layer.succeed(InboundOutbox, {
    list: (workspaceId, status, afterCommandId) =>
      Effect.tryPromise({
        try: () => journal.listCommands(workspaceId, status, afterCommandId),
        catch: (cause) =>
          new InboundPersistenceError('Inbound outbox read failed', { cause }),
      }),
    transition: (workspaceId, commandId, expectedVersion, status, reconciled) =>
      Effect.tryPromise({
        try: () =>
          journal.updateCommand(
            workspaceId,
            commandId,
            expectedVersion,
            status,
            reconciled,
          ),
        catch: (cause) =>
          new InboundPersistenceError('Inbound command transition failed', {
            cause,
          }),
      }),
  });
};
