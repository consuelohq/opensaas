import type { Pool } from 'pg';
import type { RepCapacityState, InboundStoredCommand } from '@consuelo/dialer';
import {
  createPostgresRepCapacity,
  executeRepCapacityOnClient,
} from './rep-capacity';
import {
  createPostgresInboundJournal,
  withInboundTransaction,
  readInboundSnapshot,
} from './postgres-journal';
import {
  moveTelephonyEntity,
  readTelephonyCapacity,
  telephonyId,
  recordTelephonyFact,
} from './telephony-store';
import {
  terminalCarrierStatus,
  type InboundCarrier,
} from './telephony-contracts';
import { routingTime } from './routing-store';

type OutboundBinding = {
  workspace_id: string;
  session_id: string;
  request_id: string;
  capacity_id: string;
  assignment_id: string;
  command_id: string;
  generation: number;
  planned_calls: number;
  call_sids: string[];
  rep_sid: string | null;
  group_id: string | null;
  conference_name: string | null;
  status: 'creating' | 'succeeded' | 'unknown' | 'ended';
};
export const createOutboundCapacity = (options: {
  pool: Pool;
  carrier: InboundCarrier;
  accountSid: string;
  clock?: () => string;
}) => {
  const { pool } = options;
  const capacity = createPostgresRepCapacity(pool, { clock: options.clock });
  const journal = createPostgresInboundJournal(pool);
  const read = async (workspaceId: string, sessionId: string) =>
    (
      await pool.query<OutboundBinding>(
        'SELECT * FROM dialer_telephony_outbound WHERE workspace_id=$1 AND session_id=$2',
        [workspaceId, sessionId],
      )
    ).rows[0] ?? null;
  const begin = async (input: {
    workspaceId: string;
    userId: string;
    sessionId: string;
    plannedCalls: number;
  }) =>
    withInboundTransaction(pool, input.workspaceId, async (client) => {
      try {
        if (
          !Number.isInteger(input.plannedCalls) ||
          input.plannedCalls < 1 ||
          input.plannedCalls > 20
        )
          throw new Error('Outbound fanout exceeds authority bound');
        const existing = await client.query(
          'SELECT session_id FROM dialer_telephony_outbound WHERE workspace_id=$1 AND session_id=$2',
          [input.workspaceId, input.sessionId],
        );
        if (existing.rowCount)
          throw new Error(
            'Outbound initiation already committed; reconcile instead of redialing',
          );
        const previous = (
          await client.query<{ snapshot: RepCapacityState }>(
            'SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1 AND rep_id=$2',
            [input.workspaceId, input.userId],
          )
        ).rows[0]?.snapshot;
        const endpoint = previous?.endpoints.find(
          (item) => item.kind === 'browser' && item.healthy,
        );
        if (!previous || !endpoint)
          throw new Error(
            'Outbound rep needs a registered healthy browser capacity slot',
          );
        const requestId = telephonyId(input.sessionId, 'outbound-request');
        const assignmentId = telephonyId(
          input.sessionId,
          'outbound-assignment',
        );
        const at = await routingTime(client, options.clock);
        await moveTelephonyEntity(
          client,
          input.workspaceId,
          'request',
          requestId,
          'created',
          {
            clock: options.clock,
            identity: { kind: 'request', queueId: 'outbound', enteredAt: at },
          },
        );
        await moveTelephonyEntity(
          client,
          input.workspaceId,
          'request',
          requestId,
          'queued',
          { clock: options.clock },
        );
        let state = (
          await executeRepCapacityOnClient(
            client,
            {
              workspaceId: input.workspaceId,
              capacityId: previous.capacityId,
              expectedVersion: previous.version,
              operationId: telephonyId(assignmentId, 'reserve'),
              action: {
                type: 'offer',
                assignmentId,
                requestId,
                direction: 'outbound',
                endpointIds: [endpoint.endpointId],
              },
            },
            { clock: options.clock },
          )
        ).state;
        const command = (
          await client.query<{ command: InboundStoredCommand['command'] }>(
            "SELECT command FROM dialer_inbound_commands WHERE workspace_id=$1 AND command->>'entityId'=$2 AND command->>'type'='offer'",
            [input.workspaceId, assignmentId],
          )
        ).rows[0]!.command;
        state = (
          await executeRepCapacityOnClient(
            client,
            {
              workspaceId: input.workspaceId,
              capacityId: state.capacityId,
              expectedVersion: state.version,
              operationId: telephonyId(assignmentId, 'dispatch'),
              action: {
                type: 'dispatch',
                assignmentId,
                generation: state.generation,
                commandId: command.commandId,
              },
            },
            { clock: options.clock },
          )
        ).state;
        await executeRepCapacityOnClient(
          client,
          {
            workspaceId: input.workspaceId,
            capacityId: state.capacityId,
            expectedVersion: state.version,
            operationId: telephonyId(assignmentId, 'accept'),
            action: {
              type: 'accept',
              assignmentId,
              generation: state.generation,
              endpointId: endpoint.endpointId,
            },
          },
          { clock: options.clock },
        );
        await client.query(
          'INSERT INTO dialer_telephony_outbound(workspace_id,session_id,request_id,capacity_id,assignment_id,command_id,generation,planned_calls) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            input.workspaceId,
            input.sessionId,
            requestId,
            state.capacityId,
            assignmentId,
            command.commandId,
            state.generation,
            input.plannedCalls,
          ],
        );
      } catch (cause: unknown) {
        if (cause instanceof Error) throw cause;
        throw new Error('Async operation rejected with a non-Error cause', {
          cause,
        });
      }
    });
  const progress = async (
    workspaceId: string,
    sessionId: string,
    event: {
      groupId: string;
      conferenceName: string;
      calls: readonly { callSid: string }[];
    },
  ) =>
    withInboundTransaction(pool, workspaceId, async (client) => {
      try {
        const row = (
          await client.query<OutboundBinding>(
            'SELECT * FROM dialer_telephony_outbound WHERE workspace_id=$1 AND session_id=$2',
            [workspaceId, sessionId],
          )
        ).rows[0];
        if (
          !row ||
          row.status !== 'creating' ||
          (row.group_id && row.group_id !== event.groupId) ||
          event.calls.length > row.planned_calls
        )
          throw new Error('Stale outbound progress');
        const ids = event.calls.map((call) => call.callSid);
        if (
          new Set(ids).size !== ids.length ||
          !row.call_sids.every((sid, index) => ids[index] === sid)
        )
          throw new Error('Nonmonotonic outbound progress');
        await client.query(
          'UPDATE dialer_telephony_outbound SET group_id=$3,conference_name=$4,call_sids=$5 WHERE workspace_id=$1 AND session_id=$2',
          [workspaceId, sessionId, event.groupId, event.conferenceName, ids],
        );
        await recordTelephonyFact(
          client,
          workspaceId,
          row.request_id,
          telephonyId(sessionId, ...ids),
          'outbound_creation_progress',
        );
      } catch (cause: unknown) {
        if (cause instanceof Error) throw cause;
        throw new Error('Async operation rejected with a non-Error cause', {
          cause,
        });
      }
    });
  const settleOffer = async (
    row: OutboundBinding,
    status: 'succeeded' | 'failed',
  ) => {
    try {
      const command = (
        await pool.query<{ version: number; status: string }>(
          'SELECT version,status FROM dialer_inbound_commands WHERE workspace_id=$1 AND command_id=$2',
          [row.workspace_id, row.command_id],
        )
      ).rows[0];
      if (command && ['dispatched', 'unknown'].includes(command.status))
        await journal.updateCommand(
          row.workspace_id,
          row.command_id,
          command.version,
          status,
          command.status === 'unknown',
        );
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', {
        cause,
      });
    }
  };
  const complete = async (workspaceId: string, sessionId: string) => {
    try {
      const row = await read(workspaceId, sessionId);
      if (
        !row ||
        row.status !== 'creating' ||
        row.call_sids.length !== row.planned_calls
      )
        throw new Error('Outbound creation is incomplete');
      await pool.query(
        "UPDATE dialer_telephony_outbound SET status='succeeded' WHERE workspace_id=$1 AND session_id=$2 AND status='creating'",
        [workspaceId, sessionId],
      );
      await settleOffer(row, 'succeeded');
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', {
        cause,
      });
    }
  };
  const unknown = async (workspaceId: string, sessionId: string) =>
    withInboundTransaction(pool, workspaceId, async (client) => {
      try {
        const row = (
          await client.query<OutboundBinding>(
            'SELECT * FROM dialer_telephony_outbound WHERE workspace_id=$1 AND session_id=$2',
            [workspaceId, sessionId],
          )
        ).rows[0];
        if (!row) return;
        await client.query(
          "UPDATE dialer_telephony_outbound SET status='unknown' WHERE workspace_id=$1 AND session_id=$2 AND status<>'ended'",
          [workspaceId, sessionId],
        );
        const state = await readTelephonyCapacity(
          client,
          workspaceId,
          row.capacity_id,
        );
        if (
          state?.owner?.assignmentId === row.assignment_id &&
          state.owner.phase !== 'unknown'
        )
          await executeRepCapacityOnClient(
            client,
            {
              workspaceId,
              capacityId: state.capacityId,
              expectedVersion: state.version,
              operationId: telephonyId(row.assignment_id, 'unknown'),
              action: {
                type: 'unknown',
                assignmentId: row.assignment_id,
                generation: state.generation,
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
    });
  // Called only after carrier signature and the existing SDK's client/session ownership validation.
  const admitRep = async (
    input: {
      sessionId: string;
      clientIdentity: string;
      callSid: string;
      accountSid: string;
    },
    guardedWorkspaceIds: readonly string[],
  ) => {
    try {
      const binding = (
        await pool.query<OutboundBinding>(
          'SELECT * FROM dialer_telephony_outbound WHERE session_id=$1 OR group_id=$1',
          [input.sessionId],
        )
      ).rows;
      if (binding.length === 0) {
        const guarded = await pool.query(
          'SELECT capacity_id FROM dialer_rep_capacity WHERE workspace_id=ANY($1::text[]) AND rep_id=$2',
          [guardedWorkspaceIds, input.clientIdentity],
        );
        if (guarded.rowCount)
          throw new Error('Outbound capacity binding missing');
        return;
      }
      if (binding.length !== 1) throw new Error('Outbound binding ambiguous');
      const row = binding[0]!;
      if (input.accountSid !== options.accountSid || !input.callSid)
        throw new Error('Outbound provider identity mismatch');
      await withInboundTransaction(pool, row.workspace_id, async (client) => {
        try {
          const current = (
            await client.query<OutboundBinding>(
              'SELECT * FROM dialer_telephony_outbound WHERE workspace_id=$1 AND session_id=$2',
              [row.workspace_id, row.session_id],
            )
          ).rows[0]!;
          const state = await readTelephonyCapacity(
            client,
            row.workspace_id,
            row.capacity_id,
          );
          if (
            !state?.owner ||
            state.repId !== input.clientIdentity ||
            state.owner.assignmentId !== row.assignment_id ||
            !['connecting', 'connected'].includes(state.owner.phase) ||
            current.status !== 'succeeded' ||
            (current.rep_sid && current.rep_sid !== input.callSid)
          )
            throw new Error('Outbound endpoint no longer owns capacity');
          await client.query(
            'UPDATE dialer_telephony_outbound SET rep_sid=$3 WHERE workspace_id=$1 AND session_id=$2',
            [row.workspace_id, row.session_id, input.callSid],
          );
        } catch (cause: unknown) {
          if (cause instanceof Error) throw cause;
          throw new Error('Async operation rejected with a non-Error cause', {
            cause,
          });
        }
      });
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', {
        cause,
      });
    }
  };
  const tick = async (workspaceId: string) => {
    try {
      const rows = (
        await pool.query<OutboundBinding>(
          "SELECT * FROM dialer_telephony_outbound WHERE workspace_id=$1 AND status<>'ended' ORDER BY session_id LIMIT 1001",
          [workspaceId],
        )
      ).rows;
      if (rows.length > 1000)
        throw new Error('Outbound recovery bound exceeded');
      for (const row of rows) {
        // Missing creation evidence remains owned even when every known leg ended.
        if (row.status === 'creating') {
          const overdue = await pool.query(
            "SELECT session_id FROM dialer_telephony_outbound WHERE workspace_id=$1 AND session_id=$2 AND created_at<$3::timestamptz-interval '10 minutes'",
            [
              workspaceId,
              row.session_id,
              options.clock?.() ?? new Date().toISOString(),
            ],
          );
          if (overdue.rowCount) await unknown(workspaceId, row.session_id);
          continue;
        }
        if (row.call_sids.length !== row.planned_calls) continue;
        const calls = await Promise.all(
          [...row.call_sids, ...(row.rep_sid ? [row.rep_sid] : [])].map((sid) =>
            options.carrier.call(sid),
          ),
        );
        if (calls.some((call) => call.accountSid !== options.accountSid))
          throw new Error('Outbound carrier account mismatch');
        const customersEnded = calls
          .filter((call) => row.call_sids.includes(call.sid))
          .every((call) => terminalCarrierStatus(call.status));
        const repEnded =
          !row.rep_sid ||
          terminalCarrierStatus(
            calls.find((call) => call.sid === row.rep_sid)?.status ?? '',
          );
        if (customersEnded && !repEnded) {
          await pool.query(
            'UPDATE dialer_telephony_outbound SET end_requested_at=coalesce(end_requested_at,clock_timestamp()) WHERE workspace_id=$1 AND session_id=$2',
            [workspaceId, row.session_id],
          );
          await options.carrier.end(row.rep_sid!);
          continue;
        }
        const members = row.conference_name
          ? await options.carrier.participants(row.conference_name)
          : [];
        const present = (sid: string) =>
          members.some(
            (member) => member.callSid === sid && !member.muted && !member.hold,
          );
        const connected = Boolean(
          row.rep_sid && present(row.rep_sid) && row.call_sids.some(present),
        );
        if (!(customersEnded && repEnded) && !connected) continue;
        await settleOffer(
          row,
          row.status === 'succeeded' ? 'succeeded' : 'failed',
        );
        await withInboundTransaction(pool, workspaceId, async (client) => {
          try {
            const fresh = (
              await client.query<OutboundBinding>(
                'SELECT * FROM dialer_telephony_outbound WHERE workspace_id=$1 AND session_id=$2',
                [workspaceId, row.session_id],
              )
            ).rows[0]!;
            if (fresh.rep_sid !== row.rep_sid || fresh.status === 'ended')
              return;
            const state = await readTelephonyCapacity(
              client,
              workspaceId,
              row.capacity_id,
            );
            if (
              !state?.owner ||
              state.owner.assignmentId !== row.assignment_id ||
              state.owner.phase === 'wrap_up'
            )
              return;
            const ended = customersEnded && repEnded;
            if (!ended && state.owner.phase === 'connected') return;
            const evidenceId = telephonyId(
              row.assignment_id,
              ended ? 'ended' : 'connected',
              String(state.version),
            );
            await recordTelephonyFact(
              client,
              workspaceId,
              row.request_id,
              evidenceId,
              ended ? 'outbound_legs_ended' : 'outbound_participants_confirmed',
            );
            await executeRepCapacityOnClient(
              client,
              {
                workspaceId,
                capacityId: state.capacityId,
                expectedVersion: state.version,
                operationId: evidenceId,
                action: {
                  type: 'reconcile',
                  assignmentId: row.assignment_id,
                  generation: row.generation,
                  outcome: ended ? 'ended' : 'connected',
                  evidenceId,
                },
              },
              { clock: options.clock },
            );
            const request = await readInboundSnapshot(
              client,
              workspaceId,
              'request',
              row.request_id,
            );
            if (!ended) {
              if (request?.state === 'queued')
                await moveTelephonyEntity(
                  client,
                  workspaceId,
                  'request',
                  row.request_id,
                  'offering',
                  { clock: options.clock },
                );
              if (request?.state !== 'connected') {
                await moveTelephonyEntity(
                  client,
                  workspaceId,
                  'request',
                  row.request_id,
                  'bridging',
                  { clock: options.clock },
                );
                await moveTelephonyEntity(
                  client,
                  workspaceId,
                  'request',
                  row.request_id,
                  'connected',
                  { clock: options.clock, evidence: 'participants_confirmed' },
                );
              }
            } else if (
              request &&
              ['queued', 'offering', 'bridging', 'connected'].includes(
                request.state,
              )
            ) {
              await moveTelephonyEntity(
                client,
                workspaceId,
                'request',
                row.request_id,
                request.state === 'connected'
                  ? 'completed'
                  : 'provider_failure',
                { clock: options.clock },
              );
            }
            if (ended)
              await client.query(
                "UPDATE dialer_telephony_outbound SET status='ended' WHERE workspace_id=$1 AND session_id=$2",
                [workspaceId, row.session_id],
              );
          } catch (cause: unknown) {
            if (cause instanceof Error) throw cause;
            throw new Error('Async operation rejected with a non-Error cause', {
              cause,
            });
          }
        });
      }
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', {
        cause,
      });
    }
  };
  return { begin, progress, complete, unknown, admitRep, tick };
};
