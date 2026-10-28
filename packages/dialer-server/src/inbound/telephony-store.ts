import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type {
  InboundEvent,
  InboundSnapshot,
  InboundCommand,
  RepCapacityState,
} from '@consuelo/dialer';
import {
  commitInboundFactOnClient,
  readInboundSnapshot,
} from './postgres-journal';
import { routingTime } from './routing-store';
import type { TelephonySession, TelephonyEffect } from './telephony-contracts';

export const telephonyId = (...parts: string[]) =>
  'tel:' + createHash('sha256').update(JSON.stringify(parts)).digest('hex');
export const moveTelephonyEntity = async (
  client: PoolClient,
  workspaceId: string,
  kind: InboundEvent['kind'],
  entityId: string,
  to: string,
  options: {
    identity?: InboundEvent['identity'];
    evidence?: InboundEvent['evidence'];
    command?: InboundCommand['type'];
    commandId?: string;
    clock?: () => string;
  } = {},
): Promise<InboundSnapshot> => {
  const before = await readInboundSnapshot(
    client,
    workspaceId,
    kind,
    entityId,
  ).catch((cause: unknown) => {
    if (cause instanceof Error) throw cause;
    throw new Error('Async operation rejected with a non-Error cause', {
      cause,
    });
  });
  if (before && (options.identity || before.state === to)) return before;
  const at = await routingTime(client, options.clock);
  const eventId = 'tel:' + randomUUID();
  const event: InboundEvent = {
    schemaVersion: 1,
    workspaceId,
    entityId,
    kind,
    eventId,
    expectedVersion: before?.version ?? 0,
    observedAt: at,
    occurredAt: at,
    to,
    evidence: options.evidence ?? 'none',
    ...(!before && options.identity ? { identity: options.identity } : {}),
  };
  const result = await commitInboundFactOnClient(client, {
    workspaceId,
    fact: {
      source: 'telephony-v1',
      eventKey: eventId,
      occurredAt: at,
      classification: to,
    },
    events: [event],
    commands: options.command
      ? [
          {
            commandId:
              options.commandId ?? telephonyId(entityId, options.command),
            entityId,
            kind,
            eventId,
            type: options.command,
          },
        ]
      : [],
  });
  return result.snapshots[0]!;
};
export const readTelephonySession = async (
  pool: Pool | PoolClient,
  workspaceId: string,
  requestId: string,
) =>
  (
    await pool
      .query<TelephonySession>(
        'SELECT * FROM dialer_telephony_sessions WHERE workspace_id=$1 AND request_id=$2',
        [workspaceId, requestId],
      )
      .catch((cause: unknown) => {
        if (cause instanceof Error) throw cause;
        throw new Error('Async operation rejected with a non-Error cause', {
          cause,
        });
      })
  ).rows[0] ?? null;
export const readTelephonyEffects = async (
  pool: Pool | PoolClient,
  workspaceId: string,
  assignmentId: string,
) =>
  (
    await pool.query<TelephonyEffect>(
      'SELECT * FROM dialer_telephony_effects WHERE workspace_id=$1 AND assignment_id=$2 ORDER BY effect_id',
      [workspaceId, assignmentId],
    )
  ).rows;
export const readTelephonyCapacity = async (
  client: PoolClient,
  workspaceId: string,
  capacityId: string,
) =>
  (
    await client.query<{ snapshot: RepCapacityState }>(
      'SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1 AND capacity_id=$2',
      [workspaceId, capacityId],
    )
  ).rows[0]?.snapshot ?? null;
export const insertTelephonyEffect = async (
  client: PoolClient,
  effect: TelephonyEffect,
) => {
  try {
    await client.query(
      'INSERT INTO dialer_telephony_effects(workspace_id,effect_id,request_id,assignment_id,command_id,endpoint_id,kind,status,call_sid) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING',
      [
        effect.workspace_id,
        effect.effect_id,
        effect.request_id,
        effect.assignment_id,
        effect.command_id,
        effect.endpoint_id,
        effect.kind,
        effect.status,
        effect.call_sid,
      ],
    );
  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('Async operation rejected with a non-Error cause', {
      cause,
    });
  }
};
export const recordTelephonyFact = async (
  client: PoolClient,
  workspaceId: string,
  requestId: string,
  key: string,
  classification: string,
) => {
  try {
    const result = await client.query(
      'INSERT INTO dialer_telephony_facts(workspace_id,fact_id,request_id,classification) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [workspaceId, telephonyId(key), requestId, classification],
    );
    return result.rowCount === 1;
  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('Async operation rejected with a non-Error cause', {
      cause,
    });
  }
};
