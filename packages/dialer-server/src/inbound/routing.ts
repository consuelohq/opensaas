import { createHash } from 'node:crypto';
import { Effect, Layer } from 'effect';
import type { Pool, PoolClient } from 'pg';
import {
  evaluateInboundRouting,
  InboundPersistenceError,
  InboundRouting,
  type InboundRoutingFrame,
  type InboundRoutingRequest,
  type InboundQueuePolicy,
  type InboundSnapshot,
  type RoutingRequestMetadata,
  type RepCapacityState,
  type RepCapacityAction,
  type RoutingTickInput,
  type RoutingTickResult,
} from '@consuelo/dialer';
import { withInboundTransaction } from './postgres-journal';
import { executeRepCapacityOnClient } from './rep-capacity';
import {
  createRoutingConfiguration,
  routingId,
  routingTime,
} from './routing-store';

const operation = (decisionId: string, suffix: string) =>
  'routing:' +
  createHash('sha256')
    .update(decisionId + ':' + suffix)
    .digest('hex');
const readCapacities = async (client: PoolClient, workspaceId: string) => {
  try {
    const rows = await client.query<{ snapshot: RepCapacityState }>(
      'SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1 ORDER BY capacity_id LIMIT 1001',
      [workspaceId],
    );
    if (rows.rows.length > 1000)
      throw new InboundPersistenceError(
        'Routing capacity limit exceeded; no truncated candidate decision',
      );
    return rows.rows.map((row) => row.snapshot);
  } catch (cause: unknown) {
    if (cause instanceof InboundPersistenceError) throw cause;
    throw new InboundPersistenceError('Routing capacity snapshot failed', {
      cause,
    });
  }
};
const maintain = async (
  client: PoolClient,
  workspaceId: string,
  decisionId: string,
  at: string,
) => {
  try {
    for (const state of await readCapacities(client, workspaceId)) {
      const owner = state.owner;
      if (!owner) continue;
      let action: RepCapacityAction | undefined;
      const fence = {
        assignmentId: owner.assignmentId,
        generation: owner.generation,
      };
      if (owner.phase === 'offering' && at >= owner.offerExpiresAt)
        action = { type: 'expire', ...fence };
      else if (
        owner.phase === 'wrap_up' &&
        owner.wrapUpUntil &&
        at >= owner.wrapUpUntil
      )
        action = { type: 'finish_wrap_up', manual: false, ...fence };
      else if (
        owner.phase === 'unknown' &&
        !owner.escalatedAt &&
        owner.unknownSince &&
        Date.parse(at) - Date.parse(owner.unknownSince) >=
          state.policy.escalationMilliseconds
      )
        action = { type: 'escalate', ...fence };
      if (action)
        await executeRepCapacityOnClient(
          client,
          {
            workspaceId,
            capacityId: state.capacityId,
            expectedVersion: state.version,
            operationId: operation(decisionId, 'maintain:' + state.capacityId),
            action,
          },
          { clock: () => at },
        );
    }
  } catch (cause: unknown) {
    if (cause instanceof InboundPersistenceError) throw cause;
    throw new InboundPersistenceError('Routing capacity maintenance failed', {
      cause,
    });
  }
};
export const createPostgresInboundRouting = (
  pool: Pool,
  options: { clock?: () => string } = {},
) => {
  const configuration = createRoutingConfiguration(pool);
  const tick = (input: RoutingTickInput): Promise<RoutingTickResult> =>
    withInboundTransaction(
      pool,
      routingId(input.workspaceId),
      async (client) => {
        try {
          routingId(input.queueId);
          routingId(input.decisionId);
          const existing = await client.query<{
            queue_id: string;
            result: RoutingTickResult;
          }>(
            'SELECT queue_id,result FROM dialer_routing_decisions WHERE workspace_id=$1 AND decision_id=$2',
            [input.workspaceId, input.decisionId],
          );
          if (existing.rows[0]) {
            if (existing.rows[0].queue_id !== input.queueId)
              throw new InboundPersistenceError(
                'Routing decision identity collision',
              );
            return { ...existing.rows[0].result, duplicate: true };
          }
          const queue = await client.query<{
            version: number;
            policy: InboundQueuePolicy;
          }>(
            'SELECT version,policy FROM dialer_routing_queues WHERE workspace_id=$1 AND queue_id=$2',
            [input.workspaceId, input.queueId],
          );
          if (!queue.rows[0])
            throw new InboundPersistenceError('Queue policy is not configured');
          const at = await routingTime(client, options.clock);
          await maintain(client, input.workspaceId, input.decisionId, at);
          const capacities = await readCapacities(client, input.workspaceId);
          const rows = await client.query<{
            snapshot: InboundSnapshot;
            metadata: RoutingRequestMetadata;
            metadata_version: number;
          }>(
            `SELECT entity.snapshot,entry.metadata,entry.version AS metadata_version FROM dialer_routing_entries entry
 JOIN dialer_inbound_entities entity ON entity.workspace_id=entry.workspace_id AND entity.kind='request' AND entity.entity_id=entry.request_id
 WHERE entry.workspace_id=$1 AND entry.queue_id=$2 AND entry.routing_state='waiting'
 AND entity.snapshot->>'state' IN ('created','queued','offering')
 ORDER BY entity.snapshot->'identity'->>'enteredAt',entry.request_id LIMIT 1001`,
            [input.workspaceId, input.queueId],
          );
          if (rows.rows.length > 1000)
            throw new InboundPersistenceError(
              'Routing request limit exceeded; no truncated queue decision',
            );
          const requestIds = rows.rows.map((row) => row.snapshot.entityId);
          const attempts = await client.query<{
            snapshot: RepCapacityState;
            at: string;
          }>(
            `SELECT snapshot,event->>'at' AS at FROM dialer_rep_capacity_events
 WHERE workspace_id=$1 AND event->'action'->>'type'='offer' AND event->'action'->>'requestId'=ANY($2::text[])
 ORDER BY event->>'at',capacity_id,version LIMIT 100001`,
            [input.workspaceId, requestIds],
          );
          if (attempts.rows.length > 100000)
            throw new InboundPersistenceError(
              'Routing attempt evidence limit exceeded',
            );
          const requests: InboundRoutingRequest[] = rows.rows.map(
            ({ snapshot, metadata }) => {
              if (
                snapshot.identity.kind !== 'request' ||
                snapshot.updatedAt > at
              )
                throw new InboundPersistenceError(
                  'Invalid routing request identity',
                );
              return {
                ...metadata,
                workspaceId: input.workspaceId,
                requestId: snapshot.entityId,
                queueId: snapshot.identity.queueId,
                state: snapshot.state,
                version: snapshot.version,
                enteredAt: snapshot.identity.enteredAt,
                attempts: attempts.rows
                  .filter(
                    (attempt) =>
                      attempt.snapshot.owner?.requestId === snapshot.entityId,
                  )
                  .map((attempt) => ({
                    capacityId: attempt.snapshot.capacityId,
                    repId: attempt.snapshot.repId,
                    offeredAt: attempt.at,
                    retryAfter: new Date(
                      Date.parse(attempt.snapshot.owner!.offerExpiresAt) +
                        queue.rows[0]!.policy.reofferMilliseconds,
                    ).toISOString(),
                  })),
              };
            },
          );
          const frame: InboundRoutingFrame = {
            policy: queue.rows[0].policy,
            at,
            requests,
            capacities,
          };
          const evaluation = evaluateInboundRouting(frame);
          let reservation: RoutingTickResult['reservation'] = null;
          if (
            evaluation.action === 'offer' &&
            evaluation.proposedCapacityId &&
            evaluation.requestId
          ) {
            const selected = capacities.find(
              (capacity) =>
                capacity.capacityId === evaluation.proposedCapacityId,
            )!;
            const accepted = await executeRepCapacityOnClient(
              client,
              {
                workspaceId: input.workspaceId,
                capacityId: selected.capacityId,
                operationId: operation(input.decisionId, 'reserve'),
                expectedVersion: selected.version,
                action: {
                  type: 'offer',
                  direction: 'inbound',
                  requestId: evaluation.requestId,
                  assignmentId: operation(input.decisionId, 'assignment'),
                  endpointIds: selected.endpoints
                    .filter((endpoint) => endpoint.healthy)
                    .map((endpoint) => endpoint.endpointId),
                },
              },
              { clock: () => at },
            );
            reservation = {
              capacityId: accepted.state.capacityId,
              capacityVersion: accepted.state.version,
              assignmentId: accepted.state.owner!.assignmentId,
              generation: accepted.state.generation,
            };
          }
          const result: RoutingTickResult = {
            workspaceId: input.workspaceId,
            queueId: input.queueId,
            decisionId: input.decisionId,
            duplicate: false,
            evaluation,
            reservation,
          };
          await client.query(
            'INSERT INTO dialer_routing_decisions(workspace_id,decision_id,queue_id,frame,result,recorded_at) VALUES($1,$2,$3,$4,$5,$6)',
            [
              input.workspaceId,
              input.decisionId,
              input.queueId,
              JSON.stringify({
                schemaVersion: 2,
                queueVersion: queue.rows[0].version,
                metadataVersions: rows.rows.map((row) => ({
                  requestId: row.snapshot.entityId,
                  version: row.metadata_version,
                })),
                candidateFormation:
                  'all_tenant_capacity_and_active_registered_queue_requests_bounded_1000',
                ...frame,
                evaluation,
              }),
              JSON.stringify(result),
              at,
            ],
          );
          if (evaluation.action === 'fallback')
            await client.query(
              "UPDATE dialer_routing_entries SET routing_state='fallback',fallback_decision_id=$3 WHERE workspace_id=$1 AND request_id=$2",
              [input.workspaceId, evaluation.requestId, input.decisionId],
            );
          return result;
        } catch (cause: unknown) {
          if (cause instanceof InboundPersistenceError) throw cause;
          throw new InboundPersistenceError('Routing transaction failed', {
            cause,
          });
        }
      },
    );
  const readDecision = async (workspaceId: string, decisionId: string) => {
    try {
      const row = await pool.query<{
        frame: unknown;
        result: RoutingTickResult;
      }>(
        'SELECT frame,result FROM dialer_routing_decisions WHERE workspace_id=$1 AND decision_id=$2',
        [routingId(workspaceId), routingId(decisionId)],
      );
      return row.rows[0] ?? null;
    } catch (cause: unknown) {
      throw new InboundPersistenceError('Routing decision read failed', {
        cause,
      });
    }
  };
  const listFallbacks = async (
    workspaceId: string,
    queueId: string,
    afterRequestId = '',
  ) => {
    try {
      const rows = await pool.query<{
        request_id: string;
        fallback_decision_id: string;
      }>(
        `SELECT entry.request_id,entry.fallback_decision_id FROM dialer_routing_entries entry
 JOIN dialer_inbound_entities entity ON entity.workspace_id=entry.workspace_id AND entity.kind='request' AND entity.entity_id=entry.request_id
 WHERE entry.workspace_id=$1 AND entry.queue_id=$2 AND entry.routing_state='fallback' AND entry.request_id>$3
 AND entity.snapshot->>'state' IN ('created','queued','offering') ORDER BY entry.request_id LIMIT 100`,
        [routingId(workspaceId), routingId(queueId), afterRequestId],
      );
      return rows.rows;
    } catch (cause: unknown) {
      throw new InboundPersistenceError('Routing fallback discovery failed', {
        cause,
      });
    }
  };
  return { ...configuration, tick, readDecision, listFallbacks };
};
export const createPostgresInboundRoutingLayer = (pool: Pool) => {
  const service = createPostgresInboundRouting(pool);
  return Layer.succeed(InboundRouting, {
    tick: (input) =>
      Effect.tryPromise({
        try: () => service.tick(input),
        catch: (cause) =>
          new InboundPersistenceError('Routing cycle failed', { cause }),
      }),
  });
};
