import { createHash } from 'node:crypto';
import { Effect, Layer } from 'effect';
import type { Pool } from 'pg';
import {
  applyRepCapacityAction,
  decodeRepCapacityInput,
  replayRepCapacityEvents,
  RepCapacity,
  InboundPersistenceError,
  type RepCapacityEvent,
  type RepCapacityInput,
  type RepCapacityState,
  type RepCapacityResult,
  type RepCapacityQuery,
} from '@consuelo/dialer';
import { settleCapacityCommands } from './rep-capacity-commands';
import {
  withInboundTransaction,
  readInboundSnapshot,
} from './postgres-journal';
import {
  projectRepCapacity,
  claimRepCapacityCommand,
} from './rep-capacity-projection';

const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return (
    '{' +
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => JSON.stringify(key) + ':' + canonical(item))
      .join(',') +
    '}'
  );
};
export const createPostgresRepCapacity = (
  pool: Pool,
  options: { clock?: () => string } = {},
) => {
  const execute = async (raw: RepCapacityInput): Promise<RepCapacityResult> => {
    try {
      const input = decodeRepCapacityInput(raw);
      const digest = createHash('sha256')
        .update(canonical(input))
        .digest('hex');
      return await withInboundTransaction(
        pool,
        input.workspaceId,
        async (client) => {
          try {
            const existing = await client.query<{
              digest: string;
              snapshot: RepCapacityState;
            }>(
              'SELECT digest,snapshot FROM dialer_rep_capacity_events WHERE workspace_id=$1 AND operation_id=$2',
              [input.workspaceId, input.operationId],
            );
            if (existing.rows[0]) {
              if (existing.rows[0].digest !== digest)
                throw new InboundPersistenceError(
                  'Capacity operation identity collision',
                );
              return { duplicate: true, state: existing.rows[0].snapshot };
            }
            const row = await client.query<{ snapshot: RepCapacityState }>(
              'SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1 AND capacity_id=$2',
              [input.workspaceId, input.capacityId],
            );
            const previous = row.rows[0]?.snapshot ?? null;
            // Sample authority time after acquiring the lock, never from a device click timestamp.
            const clock = await client.query<{ now: Date }>(
              'SELECT clock_timestamp() AS now',
            );
            let generationFloor: number | undefined;
            if (!previous && input.action.type === 'register') {
              const history = await client.query<{
                generation: string | null;
                active: string;
              }>(
                `SELECT max((snapshot->'identity'->>'generation')::numeric)::text AS generation,
              count(*) FILTER (WHERE snapshot->>'state' NOT IN ('declined','expired','cancelled','failed','ended'))::text AS active
             FROM dialer_inbound_entities WHERE workspace_id=$1 AND kind='assignment'
               AND snapshot->'identity'->>'capacityId'=$2`,
                [input.workspaceId, input.capacityId],
              );
              generationFloor = Number(history.rows[0]?.generation ?? 0);
              if (
                Number(history.rows[0]?.active ?? 0) !== 0 ||
                !Number.isSafeInteger(generationFloor)
              )
                throw new InboundPersistenceError(
                  'Historical assignments prevent safe registration',
                );
            }
            const event: RepCapacityEvent = {
              ...input,
              schemaVersion: 1,
              at: options.clock?.() ?? clock.rows[0]!.now.toISOString(),
              ...(generationFloor === undefined ? {} : { generationFloor }),
            };
            if (
              previous?.owner &&
              ['accept', 'dispatch'].includes(input.action.type)
            ) {
              const request = await readInboundSnapshot(
                client,
                input.workspaceId,
                'request',
                previous.owner.requestId,
              );
              if (
                !request ||
                !['created', 'queued', 'offering', 'bridging'].includes(
                  request.state,
                )
              )
                throw new InboundPersistenceError(
                  'Caller request is no longer serviceable',
                );
            }
            const state = applyRepCapacityAction(previous, event);
            if (input.action.type === 'dispatch')
              await claimRepCapacityCommand(
                client,
                state,
                input.action.commandId,
              );
            if (
              previous?.owner &&
              (input.action.type === 'reconcile' ||
                !state.owner ||
                input.action.type === 'accept')
            )
              await settleCapacityCommands(
                client,
                input.workspaceId,
                previous.owner.assignmentId,
                input.action.type === 'reconcile' || !state.owner,
              );
            await projectRepCapacity(client, previous, state, event);
            await client.query(
              'INSERT INTO dialer_rep_capacity(workspace_id,capacity_id,rep_id,version,snapshot) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,capacity_id) DO UPDATE SET version=EXCLUDED.version,snapshot=EXCLUDED.snapshot',
              [
                input.workspaceId,
                input.capacityId,
                state.repId,
                state.version,
                JSON.stringify(state),
              ],
            );
            await client.query(
              'INSERT INTO dialer_rep_capacity_events(workspace_id,capacity_id,operation_id,version,digest,event,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',
              [
                input.workspaceId,
                input.capacityId,
                input.operationId,
                state.version,
                digest,
                JSON.stringify(event),
                JSON.stringify(state),
              ],
            );
            return { duplicate: false, state };
          } catch (cause: unknown) {
            throw new InboundPersistenceError('Capacity transaction failed', {
              cause,
            });
          }
        },
      );
    } catch (cause: unknown) {
      throw new InboundPersistenceError('Rep capacity action failed', {
        cause,
      });
    }
  };
  const read = async (
    workspaceId: string,
    capacityId: string,
  ): Promise<RepCapacityState | null> => {
    try {
      const result = await pool.query<{ snapshot: RepCapacityState }>(
        'SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1 AND capacity_id=$2',
        [workspaceId, capacityId],
      );
      return result.rows[0]?.snapshot ?? null;
    } catch (cause: unknown) {
      throw new InboundPersistenceError('Rep capacity read failed', { cause });
    }
  };
  const replay = async (workspaceId: string, capacityId: string) => {
    try {
      const result = await pool.query<{ event: RepCapacityEvent }>(
        'SELECT event FROM dialer_rep_capacity_events WHERE workspace_id=$1 AND capacity_id=$2 ORDER BY version',
        [workspaceId, capacityId],
      );
      return replayRepCapacityEvents(result.rows.map((row) => row.event));
    } catch (cause: unknown) {
      throw new InboundPersistenceError('Rep capacity replay failed', {
        cause,
      });
    }
  };
  const list = async (
    query: RepCapacityQuery,
  ): Promise<readonly RepCapacityState[]> => {
    try {
      if (
        !Number.isInteger(query.limit) ||
        query.limit < 1 ||
        query.limit > 1000
      )
        throw new InboundPersistenceError(
          'Capacity page limit must be between 1 and 1000',
        );
      const result = await pool.query<{ snapshot: RepCapacityState }>(
        `SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1
          AND ($2::text IS NULL OR capacity_id > $2)
          AND (NOT $3::boolean OR snapshot->'owner' <> 'null'::jsonb)
          ORDER BY capacity_id LIMIT $4`,
        [
          query.workspaceId,
          query.afterCapacityId ?? null,
          query.ownedOnly ?? false,
          query.limit,
        ],
      );
      return result.rows.map((row) => row.snapshot);
    } catch (cause: unknown) {
      throw new InboundPersistenceError('Rep capacity listing failed', {
        cause,
      });
    }
  };
  return { execute, read, replay, list };
};
export const createPostgresRepCapacityLayer = (pool: Pool) => {
  const service = createPostgresRepCapacity(pool);
  const attempt = <TResult>(operation: () => Promise<TResult>) =>
    Effect.tryPromise({
      try: operation,
      catch: (cause) =>
        new InboundPersistenceError('Rep capacity service failed', { cause }),
    });
  return Layer.succeed(RepCapacity, {
    list: (query) => attempt(() => service.list(query)),
    execute: (input) => attempt(() => service.execute(input)),
    read: (workspaceId, capacityId) =>
      attempt(() => service.read(workspaceId, capacityId)),
    replay: (workspaceId, capacityId) =>
      attempt(() => service.replay(workspaceId, capacityId)),
  });
};
