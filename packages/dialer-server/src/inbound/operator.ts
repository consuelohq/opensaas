import type {
  InboundOperatorSnapshot,
  InboundOperatorActionResult,
} from '@consuelo/lead-connector/embed';
import {
  isInboundQueueOpen,
  isRepCapacityEligible,
  type InboundQueuePolicy,
  type RepCapacityState,
} from '@consuelo/dialer';
import { randomUUID } from 'node:crypto';
import type { DialerIdentity } from '../contracts';
import { executeRepCapacityOnClient } from './rep-capacity';
import {
  withInboundTransaction,
  readInboundSnapshot,
} from './postgres-journal';
import { readTelephonyCapacity, telephonyId } from './telephony-store';
import { routingTime } from './routing-store';
import type { TelephonyOptions } from './telephony-admission';
import type { createInboundTelephony } from './telephony';

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected operator input');
  return value as Record<string, unknown>;
};
const text = (value: unknown, max = 160) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error('Invalid operator input');
  return value;
};
const fence = (value: unknown) => {
  const input = object(value);
  if (
    typeof input.generation !== 'number' ||
    !Number.isSafeInteger(input.generation) ||
    input.generation < 1
  )
    throw new Error('Invalid assignment generation');
  return {
    assignmentId: text(input.assignmentId),
    generation: input.generation,
  };
};
export const createInboundOperator = (
  options: TelephonyOptions,
  telephony: ReturnType<typeof createInboundTelephony>,
) => {
  const { pool } = options;
  const state = async (identity: DialerIdentity) => {
    try {
      const row = (
        await pool.query<{ snapshot: RepCapacityState }>(
          'SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1 AND rep_id=$2',
          [identity.workspaceId, identity.userId],
        )
      ).rows[0]?.snapshot;
      if (
        !row ||
        !options.numbers.some(
          (number) => number.workspaceId === identity.workspaceId,
        )
      )
        throw new Error('Inbound operator is not provisioned');
      return row;
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', {
        cause,
      });
    }
  };
  const snapshot = async (
    identity: DialerIdentity,
  ): Promise<InboundOperatorSnapshot> => {
    try {
      const previous = await state(identity);
      return withInboundTransaction(
        pool,
        identity.workspaceId,
        async (client) => {
          try {
            const rep = (await readTelephonyCapacity(
              client,
              identity.workspaceId,
              previous.capacityId,
            ))!;
            const at = await routingTime(client, options.clock);
            const queues = (
              await client.query<{ policy: InboundQueuePolicy }>(
                'SELECT policy FROM dialer_routing_queues WHERE workspace_id=$1 ORDER BY queue_id',
                [identity.workspaceId],
              )
            ).rows;
            const policy = queues.find((row) =>
              row.policy.profiles.some(
                (profile) => profile.repId === identity.userId,
              ),
            )?.policy;
            const number = options.numbers.find(
              (number) =>
                number.workspaceId === identity.workspaceId &&
                number.queueId === policy?.queueId,
            );
            if (!policy || !number)
              throw new Error('Operator queue is not configured');
            const requests = (
              await client.query<{
                entity_id: string;
                snapshot: { identity: { enteredAt: string } };
              }>(
                "SELECT e.entity_id,e.snapshot FROM dialer_inbound_entities e JOIN dialer_routing_entries r ON r.workspace_id=e.workspace_id AND r.request_id=e.entity_id WHERE e.workspace_id=$1 AND e.kind='request' AND r.queue_id=$2 AND e.snapshot->>'state' IN ('queued','offering')",
                [identity.workspaceId, policy.queueId],
              )
            ).rows;
            const capacities = (
              await client.query<{ snapshot: RepCapacityState }>(
                'SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1',
                [identity.workspaceId],
              )
            ).rows;
            const owner = rep.owner;
            const request = owner
              ? await readInboundSnapshot(
                  client,
                  identity.workspaceId,
                  'request',
                  owner.requestId,
                )
              : null;
            const enteredAt =
              request?.identity.kind === 'request'
                ? request.identity.enteredAt
                : at;
            const assignment = owner
              ? {
                  assignmentId: owner.assignmentId,
                  requestId: owner.requestId,
                  generation: owner.generation,
                  phase: owner.phase,
                  offerExpiresAt: owner.offerExpiresAt,
                  endpointId: owner.winnerEndpointId,
                  externalStarted: owner.externalStarted,
                  connectedAt: owner.connectedAt,
                  unknownSince: owner.unknownSince,
                  wrapUpUntil: owner.wrapUpUntil,
                }
              : null;
            return {
              serverTime: at,
              rep: {
                repId: rep.repId,
                ready: rep.ready,
                presence:
                  Date.parse(at) - Date.parse(rep.presenceAt) >=
                  rep.policy.presenceMilliseconds
                    ? 'offline'
                    : rep.ready
                      ? 'online'
                      : 'away',
                capacityPhase: owner?.phase ?? null,
                assignment,
                endpoints: rep.endpoints.map((endpoint) => ({
                  ...endpoint,
                  label:
                    endpoint.kind === 'browser'
                      ? 'Browser'
                      : 'Forwarding phone',
                })),
              },
              offers:
                owner?.direction === 'inbound' && owner.phase === 'offering'
                  ? [
                      {
                        assignmentId: owner.assignmentId,
                        requestId: owner.requestId,
                        generation: owner.generation,
                        queueId: policy.queueId,
                        queueName: policy.queueId,
                        callerLabel: 'Incoming caller',
                        waitingSeconds: Math.max(
                          0,
                          Math.floor(
                            (Date.parse(at) - Date.parse(enteredAt)) / 1000,
                          ),
                        ),
                        offerExpiresAt: owner.offerExpiresAt,
                        ownerRepId: null,
                        eligibleEndpoints: owner.endpoints
                          .filter((endpoint) => endpoint.status === 'offered')
                          .map((endpoint) => endpoint.endpointId),
                      },
                    ]
                  : [],
              queue: {
                queueId: policy.queueId,
                queueName: policy.queueId,
                waitingCount: requests.length,
                oldestWaitSeconds: requests.reduce(
                  (maximum, row) =>
                    Math.max(
                      maximum,
                      Math.floor(
                        (Date.parse(at) -
                          Date.parse(row.snapshot.identity.enteredAt)) /
                          1000,
                      ),
                    ),
                  0,
                ),
                serviceableCount: capacities.filter(
                  (row) =>
                    policy.profiles.some(
                      (profile) => profile.repId === row.snapshot.repId,
                    ) && isRepCapacityEligible(row.snapshot, at),
                ).length,
                businessHours: policy.emergencyClosed
                  ? 'closed'
                  : isInboundQueueOpen(policy, at)
                    ? 'open'
                    : 'after-hours',
                overflow: 'standby',
              },
              configuration: {
                numberLabel: number.numberId,
                maskedNumber: 'Private number',
                teamName: policy.queueId,
                hoursLabel: policy.timezone,
                overflowLabel: number.voicemail
                  ? 'Callback request or voicemail'
                  : 'Callback request',
              },
            };
          } catch (cause: unknown) {
            if (cause instanceof Error) throw cause;
            throw new Error('Async operation rejected with a non-Error cause', {
              cause,
            });
          }
        },
      );
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', {
        cause,
      });
    }
  };
  const readiness = async (identity: DialerIdentity, raw: unknown) => {
    try {
      const input = object(raw);
      if (
        typeof input.ready !== 'boolean' ||
        !Array.isArray(input.endpoints) ||
        input.endpoints.length > 10
      )
        throw new Error('Invalid readiness');
      const targets = input.endpoints.map((value) => {
        const endpoint = object(value);
        if (endpoint.kind !== 'browser' && endpoint.kind !== 'phone')
          throw new Error('Invalid endpoint kind');
        return { endpointId: text(endpoint.endpointId), kind: endpoint.kind };
      });
      const previous = await state(identity);
      await withInboundTransaction(
        pool,
        identity.workspaceId,
        async (client) => {
          try {
            const rep = (await readTelephonyCapacity(
              client,
              identity.workspaceId,
              previous.capacityId,
            ))!;
            const endpoints = targets.map((endpoint) => {
              const configured = options.endpoints.find(
                (item) =>
                  item.workspaceId === identity.workspaceId &&
                  item.repId === identity.userId &&
                  item.endpointId === endpoint.endpointId &&
                  item.kind === endpoint.kind,
              );
              const known = rep.endpoints.find(
                (item) =>
                  item.endpointId === endpoint.endpointId &&
                  item.kind === endpoint.kind,
              );
              if (!configured || !known)
                throw new Error(
                  'Endpoint must be provisioned and health-checked',
                );
              return { ...known };
            });
            await executeRepCapacityOnClient(
              client,
              {
                workspaceId: identity.workspaceId,
                capacityId: rep.capacityId,
                expectedVersion: rep.version,
                operationId: 'operator:' + randomUUID(),
                action: {
                  type: 'readiness',
                  ready: input.ready as boolean,
                  endpoints,
                },
              },
              { clock: options.clock },
            );
          } catch (cause: unknown) {
            if (cause instanceof Error) throw cause;
            throw new Error('Async operation rejected with a non-Error cause', {
              cause,
            });
          }
        },
      );
      return snapshot(identity);
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', {
        cause,
      });
    }
  };
  const accept = async (
    identity: DialerIdentity,
    raw: unknown,
  ): Promise<InboundOperatorActionResult> => {
    const input = object(raw);
    const ownership = fence(raw);
    const endpointId = text(input.endpointId);
    const rep = await state(identity);
    const effect = (
      await pool.query<{ call_sid: string | null }>(
        "SELECT call_sid FROM dialer_telephony_effects WHERE workspace_id=$1 AND assignment_id=$2 AND endpoint_id=$3 AND kind='offer'",
        [identity.workspaceId, ownership.assignmentId, endpointId],
      )
    ).rows[0];
    if (!effect?.call_sid)
      return {
        accepted: false,
        status: 'rejected',
        message: 'The endpoint has not received this offer.',
      };
    try {
      await telephony.accept({
        ...identity,
        capacityId: rep.capacityId,
        ...ownership,
        endpointId,
        callSid: effect.call_sid,
      });
    } catch {
      return {
        accepted: false,
        status: 'stale',
        message:
          'This offer cannot be accepted. Phone offers require pressing 1 on that phone.',
        snapshot: await snapshot(identity),
      };
    }
    return {
      accepted: true,
      status: 'accepted',
      snapshot: await snapshot(identity),
    };
  };
  const decline = async (
    identity: DialerIdentity,
    raw: unknown,
  ): Promise<InboundOperatorActionResult> => {
    const ownership = fence(raw);
    const previous = await state(identity);
    try {
      await withInboundTransaction(
        pool,
        identity.workspaceId,
        async (client) => {
          try {
            let rep = (await readTelephonyCapacity(
              client,
              identity.workspaceId,
              previous.capacityId,
            ))!;
            if (
              rep.owner?.assignmentId !== ownership.assignmentId ||
              rep.generation !== ownership.generation ||
              rep.owner.phase !== 'offering'
            )
              throw new Error('Stale decline');
            for (const endpoint of rep.owner.endpoints.filter(
              (item) => item.status === 'offered',
            ))
              rep = (
                await executeRepCapacityOnClient(
                  client,
                  {
                    workspaceId: identity.workspaceId,
                    capacityId: rep.capacityId,
                    expectedVersion: rep.version,
                    operationId: telephonyId(
                      ownership.assignmentId,
                      endpoint.endpointId,
                      'operator-decline',
                    ),
                    action: {
                      type: 'decline',
                      ...ownership,
                      endpointId: endpoint.endpointId,
                    },
                  },
                  { clock: options.clock },
                )
              ).state;
          } catch (cause: unknown) {
            if (cause instanceof Error) throw cause;
            throw new Error('Async operation rejected with a non-Error cause', {
              cause,
            });
          }
        },
      );
    } catch {
      return {
        accepted: false,
        status: 'stale',
        snapshot: await snapshot(identity),
      };
    }
    return {
      accepted: true,
      status: 'declined',
      snapshot: await snapshot(identity),
    };
  };
  const wrapUp = async (identity: DialerIdentity, raw: unknown) => {
    try {
      const input = object(raw);
      const ownership = fence(raw);
      const disposition = text(input.disposition, 100);
      const note = input.note === undefined ? null : text(input.note, 4000);
      const previous = await state(identity);
      await withInboundTransaction(
        pool,
        identity.workspaceId,
        async (client) => {
          try {
            const rep = (await readTelephonyCapacity(
              client,
              identity.workspaceId,
              previous.capacityId,
            ))!;
            await executeRepCapacityOnClient(
              client,
              {
                workspaceId: identity.workspaceId,
                capacityId: rep.capacityId,
                expectedVersion: rep.version,
                operationId: telephonyId(
                  ownership.assignmentId,
                  'operator-wrap',
                ),
                action: { type: 'finish_wrap_up', ...ownership, manual: true },
              },
              { clock: options.clock },
            );
            await client.query(
              'INSERT INTO dialer_telephony_dispositions(workspace_id,assignment_id,rep_id,disposition,note) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
              [
                identity.workspaceId,
                ownership.assignmentId,
                identity.userId,
                disposition,
                note,
              ],
            );
          } catch (cause: unknown) {
            if (cause instanceof Error) throw cause;
            throw new Error('Async operation rejected with a non-Error cause', {
              cause,
            });
          }
        },
      );
      return snapshot(identity);
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', {
        cause,
      });
    }
  };
  return { snapshot, readiness, accept, decline, wrapUp };
};
