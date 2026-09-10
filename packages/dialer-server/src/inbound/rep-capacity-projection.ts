import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type {
  InboundEvent,
  InboundCommand,
  InboundKind,
  InboundSnapshot,
  RepCapacityEvent,
  RepCapacityState,
} from '@consuelo/dialer';
import { InboundPersistenceError } from '@consuelo/dialer';
import {
  commitInboundFactOnClient,
  readInboundSnapshot,
} from './postgres-journal';

export const capacityEventId = (operationId: string, suffix: string) =>
  'capacity:' +
  createHash('sha256')
    .update(operationId + ':' + suffix)
    .digest('hex');

export const projectRepCapacity = async (
  client: PoolClient,
  previous: RepCapacityState | null,
  next: RepCapacityState,
  event: RepCapacityEvent,
) => {
  try {
    const events: InboundEvent[] = [];
    const commands: InboundCommand[] = [];
    const current = new Map<string, InboundSnapshot | null>();
    const move = async (
      kind: InboundKind,
      entityId: string,
      to: string,
      evidence: InboundEvent['evidence'] = 'none',
      identity?: InboundEvent['identity'],
    ) => {
      try {
        const key = kind + ':' + entityId;
        const before = current.has(key)
          ? current.get(key)!
          : await readInboundSnapshot(
              client,
              event.workspaceId,
              kind,
              entityId,
            );
        const item: InboundEvent = {
          schemaVersion: 1,
          eventId: capacityEventId(event.operationId, String(events.length)),
          workspaceId: event.workspaceId,
          entityId,
          kind,
          expectedVersion: before?.version ?? 0,
          occurredAt: event.at,
          observedAt: event.at,
          to,
          evidence,
          ...(identity ? { identity } : {}),
        };
        events.push(item);
        current.set(key, {
          ...(before ?? {}),
          identity: identity ?? before!.identity,
          workspaceId: event.workspaceId,
          entityId,
          schemaVersion: 1,
          state: to,
          version: (before?.version ?? 0) + (before?.state === to ? 0 : 1),
          createdAt: before?.createdAt ?? event.at,
          updatedAt: event.at,
          lastOccurredAt: event.at,
        });
        return item;
      } catch (cause: unknown) {
        throw new InboundPersistenceError(
          'Capacity projection transition failed',
          { cause },
        );
      }
    };
    const notify = (item: InboundEvent, type: InboundCommand['type']) =>
      commands.push({
        commandId: capacityEventId(event.operationId, type),
        eventId: item.eventId,
        kind: item.kind,
        entityId: item.entityId,
        type,
      });
    let capacity = await readInboundSnapshot(
      client,
      event.workspaceId,
      'capacity',
      event.capacityId,
    );
    if (!previous) {
      if (capacity) {
        if (
          capacity.identity.kind !== 'capacity' ||
          capacity.identity.repId !== next.repId ||
          capacity.state !== 'available'
        )
          throw new InboundPersistenceError(
            'Capacity identity cannot be safely adopted',
          );
      }
      await move(
        'capacity',
        event.capacityId,
        'available',
        'none',
        capacity ? undefined : { kind: 'capacity', repId: next.repId, slot: 0 },
      );
    } else if (event.action.type === 'offer' && next.owner) {
      const request = await readInboundSnapshot(
        client,
        event.workspaceId,
        'request',
        next.owner.requestId,
      );
      if (
        !request ||
        !['created', 'queued', 'offering'].includes(request.state)
      )
        throw new InboundPersistenceError('Request cannot receive an offer');
      const reserved = await move('capacity', event.capacityId, 'reserved');
      notify(reserved, 'notify');
      const assignment = await move(
        'assignment',
        next.owner.assignmentId,
        'offering',
        'none',
        {
          kind: 'assignment',
          requestId: next.owner.requestId,
          capacityId: event.capacityId,
          generation: next.generation,
          offerExpiresAt: next.owner.offerExpiresAt,
        },
      );
      notify(assignment, 'offer');
    } else if (previous.owner) {
      const owner = previous.owner;
      let assignment = await readInboundSnapshot(
        client,
        event.workspaceId,
        'assignment',
        owner.assignmentId,
      );
      if (!capacity || !assignment)
        throw new InboundPersistenceError('Capacity projection is missing');
      const assignmentMove = async (
        to: string,
        evidence: InboundEvent['evidence'] = 'none',
      ) => {
        try {
          const item = await move(
            'assignment',
            owner.assignmentId,
            to,
            evidence,
          );
          assignment = current.get('assignment:' + owner.assignmentId)!;
          return item;
        } catch (cause: unknown) {
          throw new InboundPersistenceError(
            'Capacity assignment projection failed',
            { cause },
          );
        }
      };
      if (event.action.type === 'accept')
        notify(await assignmentMove('accepted'), 'notify');
      if (
        (next.owner?.phase === 'connecting' &&
          event.action.type === 'dispatch') ||
        next.owner?.phase === 'connected' ||
        (next.owner?.phase === 'unknown' && owner.winnerEndpointId)
      ) {
        if (assignment!.state === 'accepted')
          await assignmentMove('connecting');
      }
      if (
        next.owner?.phase === 'connected' &&
        assignment!.state !== 'connected'
      )
        await assignmentMove('connected', 'participants_confirmed');
      if (next.owner?.phase === 'unknown' && assignment!.state === 'connecting')
        await assignmentMove('unknown');
      if (!next.owner || next.owner.phase === 'wrap_up') {
        if (assignment!.state === 'offering')
          await assignmentMove(
            event.action.type === 'expire'
              ? 'expired'
              : event.action.type === 'decline'
                ? 'declined'
                : 'cancelled',
          );
        else if (assignment!.state === 'accepted')
          await assignmentMove('cancelled', 'reconciled_no_effect');
        else if (['connecting', 'unknown'].includes(assignment!.state))
          await assignmentMove('failed', 'reconciled_ended');
        else if (assignment!.state === 'connected')
          await assignmentMove('ended', 'reconciled_ended');
      }
      const desired = !next.owner
        ? 'available'
        : next.owner.phase === 'offering'
          ? 'reserved'
          : next.owner.phase === 'unknown' && capacity.state === 'connected'
            ? 'connected'
            : next.owner.phase;
      if (
        capacity.state === 'reserved' &&
        ['connecting', 'unknown', 'connected'].includes(desired)
      ) {
        await move('capacity', event.capacityId, 'connecting');
        capacity = current.get('capacity:' + event.capacityId)!;
      }
      if (capacity.state !== desired) {
        const item = await move(
          'capacity',
          event.capacityId,
          desired,
          desired === 'connected'
            ? 'participants_confirmed'
            : desired === 'available'
              ? 'reconciled_ended'
              : 'none',
        );
        if (desired === 'unknown') notify(item, 'reconcile');
        else if (!commands.some((command) => command.type === 'notify'))
          notify(item, 'notify');
      }
    }
    if (!events.length)
      await move('capacity', event.capacityId, capacity?.state ?? 'available');
    return await commitInboundFactOnClient(client, {
      workspaceId: event.workspaceId,
      fact: {
        source: 'rep-capacity-v1',
        eventKey: event.operationId,
        occurredAt: event.at,
        classification: event.action.type,
      },
      events,
      commands,
    });
  } catch (cause: unknown) {
    throw new InboundPersistenceError('Capacity projection failed', { cause });
  }
};

export const claimRepCapacityCommand = async (
  client: PoolClient,
  state: RepCapacityState,
  commandId: string,
) => {
  try {
    const row = await client.query<{
      command: InboundCommand;
      version: number;
      status: string;
    }>(
      'SELECT command,version,status FROM dialer_inbound_commands WHERE workspace_id=$1 AND command_id=$2',
      [state.workspaceId, commandId],
    );
    const stored = row.rows[0];
    if (!stored || stored.status !== 'pending' || !state.owner)
      throw new InboundPersistenceError('Command is not dispatchable');
    const assignment = await readInboundSnapshot(
      client,
      state.workspaceId,
      'assignment',
      state.owner.assignmentId,
    );
    if (
      assignment?.identity.kind !== 'assignment' ||
      assignment.identity.capacityId !== state.capacityId ||
      assignment.identity.generation !== state.owner.generation ||
      assignment.identity.requestId !== state.owner.requestId
    )
      throw new InboundPersistenceError(
        'Command has a stale assignment generation',
      );
    const command = stored.command;
    if (command.type === 'offer') {
      if (
        command.kind !== 'assignment' ||
        command.entityId !== state.owner.assignmentId ||
        state.owner.phase !== 'offering'
      )
        throw new InboundPersistenceError(
          'Offer command does not own capacity',
        );
    } else if (command.type === 'bridge') {
      const competing = await client.query(
        `SELECT 1 FROM dialer_inbound_commands command
         JOIN dialer_inbound_entities bridge ON bridge.workspace_id=command.workspace_id
           AND bridge.kind='bridge' AND bridge.entity_id=command.command->>'entityId'
         WHERE command.workspace_id=$1 AND command.command->>'type'='bridge'
           AND bridge.snapshot->'identity'->>'assignmentId'=$2
           AND command.status IN ('dispatched','unknown','succeeded') LIMIT 1`,
        [state.workspaceId, state.owner.assignmentId],
      );
      if (competing.rowCount)
        throw new InboundPersistenceError(
          'Assignment already owns a bridge command',
        );
      const bridge = await readInboundSnapshot(
        client,
        state.workspaceId,
        'bridge',
        command.entityId,
      );
      if (
        command.kind !== 'bridge' ||
        bridge?.identity.kind !== 'bridge' ||
        bridge.identity.assignmentId !== state.owner.assignmentId ||
        bridge.state !== 'connecting' ||
        !state.owner.winnerEndpointId ||
        state.owner.phase !== 'connecting'
      )
        throw new InboundPersistenceError(
          'Bridge command does not own capacity',
        );
      const caller = await readInboundSnapshot(
        client,
        state.workspaceId,
        'leg',
        bridge.identity.callerLegId,
      );
      const rep = await readInboundSnapshot(
        client,
        state.workspaceId,
        'leg',
        bridge.identity.repLegId,
      );
      if (
        !caller ||
        !rep ||
        ['ended', 'failed'].includes(caller.state) ||
        ['ended', 'failed'].includes(rep.state)
      )
        throw new InboundPersistenceError('Bridge participant already ended');
    } else
      throw new InboundPersistenceError('Not a capacity-bound carrier command');
    await client.query(
      'UPDATE dialer_inbound_commands SET version=version+1,status=$3 WHERE workspace_id=$1 AND command_id=$2',
      [state.workspaceId, commandId, 'dispatched'],
    );
    await client.query(
      'INSERT INTO dialer_inbound_command_events(workspace_id,command_id,version,status,reconciled) VALUES($1,$2,$3,$4,false)',
      [state.workspaceId, commandId, stored.version + 1, 'dispatched'],
    );
  } catch (cause: unknown) {
    throw new InboundPersistenceError('Capacity command claim failed', {
      cause,
    });
  }
};
