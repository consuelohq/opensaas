import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { RepCapacityState, InboundStoredCommand } from '@consuelo/dialer';
import {
  withInboundTransaction,
  readInboundSnapshot,
  createPostgresInboundJournal,
} from './postgres-journal';
import {
  createPostgresRepCapacity,
  executeRepCapacityOnClient,
} from './rep-capacity';
import { createPostgresInboundRouting } from './routing';
import {
  readTelephonyCapacity,
  readTelephonySession,
  readTelephonyEffects,
  insertTelephonyEffect,
  moveTelephonyEntity,
  telephonyId,
} from './telephony-store';
import { conferenceTwiml } from './telephony-twiml';
import { telephonyUrl, type TelephonyOptions } from './telephony-admission';
import {
  terminalCarrierStatus,
  type TelephonyEffect,
} from './telephony-contracts';

export const createTelephonyCommands = (options: TelephonyOptions) => {
  const { pool } = options;
  const capacity = createPostgresRepCapacity(pool, { clock: options.clock });
  const journal = createPostgresInboundJournal(pool);
  const prepare = async (original: RepCapacityState) =>
    withInboundTransaction(pool, original.workspaceId, async (client) => {
      try {
        const state = await readTelephonyCapacity(
          client,
          original.workspaceId,
          original.capacityId,
        );
        if (!state?.owner || state.owner.direction !== 'inbound') return;
        const owner = state.owner;
        const session = await readTelephonySession(
          client,
          state.workspaceId,
          owner.requestId,
        );
        if (!session || session.mode !== 'waiting') return;
        const effects = await readTelephonyEffects(
          client,
          state.workspaceId,
          owner.assignmentId,
        );
        const fence = {
          assignmentId: owner.assignmentId,
          generation: owner.generation,
        };
        if (owner.phase === 'offering' && !effects.length) {
          const command = (
            await client.query<{ command: InboundStoredCommand['command'] }>(
              "SELECT command FROM dialer_inbound_commands WHERE workspace_id=$1 AND command->>'entityId'=$2 AND command->>'type'='offer' AND status='pending'",
              [state.workspaceId, owner.assignmentId],
            )
          ).rows[0]?.command;
          if (!command) return;
          const targets = owner.endpoints.map((endpoint) =>
            options.endpoints.find(
              (target) =>
                target.workspaceId === state.workspaceId &&
                target.repId === state.repId &&
                target.endpointId === endpoint.endpointId &&
                target.kind === endpoint.kind,
            ),
          );
          if (targets.some((target) => !target))
            throw new Error('Offer endpoint configuration is incomplete');
          for (const target of targets)
            await insertTelephonyEffect(client, {
              workspace_id: state.workspaceId,
              request_id: owner.requestId,
              assignment_id: owner.assignmentId,
              command_id: command.commandId,
              effect_id: telephonyId(command.commandId, target!.endpointId),
              endpoint_id: target!.endpointId,
              kind: 'offer',
              status: 'pending',
              call_sid: null,
            });
          await executeRepCapacityOnClient(
            client,
            {
              workspaceId: state.workspaceId,
              capacityId: state.capacityId,
              expectedVersion: state.version,
              operationId: telephonyId(command.commandId, 'dispatch'),
              action: {
                type: 'dispatch',
                commandId: command.commandId,
                ...fence,
              },
            },
            { clock: options.clock },
          );
        } else if (
          owner.phase === 'connecting' &&
          owner.winnerEndpointId &&
          !effects.some((effect) => effect.kind === 'bridge_caller')
        ) {
          const winner = effects.find(
            (effect) =>
              effect.kind === 'offer' &&
              effect.endpoint_id === owner.winnerEndpointId,
          );
          if (!winner?.call_sid) return;
          await moveTelephonyEntity(
            client,
            state.workspaceId,
            'leg',
            winner.call_sid,
            'ringing',
            {
              clock: options.clock,
              identity: {
                kind: 'leg',
                requestId: owner.requestId,
                role: 'rep',
              },
            },
          );
          const bridgeId = telephonyId(owner.assignmentId, 'bridge');
          const request = await readInboundSnapshot(
            client,
            state.workspaceId,
            'request',
            owner.requestId,
          );
          if (request?.state === 'queued')
            await moveTelephonyEntity(
              client,
              state.workspaceId,
              'request',
              owner.requestId,
              'offering',
              { clock: options.clock },
            );
          await moveTelephonyEntity(
            client,
            state.workspaceId,
            'request',
            owner.requestId,
            'bridging',
            { clock: options.clock },
          );
          await moveTelephonyEntity(
            client,
            state.workspaceId,
            'bridge',
            bridgeId,
            'pending',
            {
              clock: options.clock,
              identity: {
                kind: 'bridge',
                requestId: owner.requestId,
                assignmentId: owner.assignmentId,
                callerLegId: session.caller_sid,
                repLegId: winner.call_sid,
              },
            },
          );
          await moveTelephonyEntity(
            client,
            state.workspaceId,
            'bridge',
            bridgeId,
            'connecting',
            { clock: options.clock, command: 'bridge' },
          );
          const commandId = telephonyId(bridgeId, 'bridge');
          for (const role of ['caller', 'rep'] as const)
            await insertTelephonyEffect(client, {
              workspace_id: state.workspaceId,
              request_id: owner.requestId,
              assignment_id: owner.assignmentId,
              command_id: commandId,
              effect_id: telephonyId(commandId, role),
              endpoint_id: owner.winnerEndpointId,
              kind: role === 'caller' ? 'bridge_caller' : 'bridge_rep',
              status: 'pending',
              call_sid:
                role === 'caller' ? session.caller_sid : winner.call_sid,
            });
          await executeRepCapacityOnClient(
            client,
            {
              workspaceId: state.workspaceId,
              capacityId: state.capacityId,
              expectedVersion: state.version,
              operationId: telephonyId(commandId, 'dispatch'),
              action: { type: 'dispatch', commandId, ...fence },
            },
            { clock: options.clock },
          );
        }
      } catch (cause: unknown) {
        if (cause instanceof Error) throw cause;
        throw new Error('Async operation rejected with a non-Error cause', {
          cause,
        });
      }
    });
  const settleCommands = async (
    workspaceId: string,
    assignmentId: string,
    reconciled = false,
  ) => {
    try {
      const effects = await readTelephonyEffects(
        pool,
        workspaceId,
        assignmentId,
      );
      for (const commandId of new Set(
        effects
          .filter((effect) => effect.kind !== 'terminate')
          .map((effect) => effect.command_id),
      )) {
        const relevant = effects.filter(
          (effect) =>
            effect.command_id === commandId && effect.kind !== 'terminate',
        );
        if (
          !relevant.length ||
          relevant.some(
            (effect) => !['succeeded', 'failed'].includes(effect.status),
          )
        )
          continue;
        const row = (
          await pool.query<{
            command: InboundStoredCommand['command'];
            version: number;
            status: string;
          }>(
            'SELECT command,version,status FROM dialer_inbound_commands WHERE workspace_id=$1 AND command_id=$2',
            [workspaceId, commandId],
          )
        ).rows[0];
        if (row && ['dispatched', 'unknown'].includes(row.status)) {
          await journal.updateCommand(
            workspaceId,
            commandId,
            row.version,
            relevant.every((effect) => effect.status === 'succeeded')
              ? 'succeeded'
              : 'failed',
            reconciled || row.status === 'unknown',
          );
        }
      }
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', {
        cause,
      });
    }
  };
  const execute = async (original: TelephonyEffect) => {
    try {
      const claimed = await withInboundTransaction(
        pool,
        original.workspace_id,
        async (client) => {
          try {
            const effect = (
              await client.query<TelephonyEffect>(
                'SELECT * FROM dialer_telephony_effects WHERE workspace_id=$1 AND effect_id=$2',
                [original.workspace_id, original.effect_id],
              )
            ).rows[0];
            if (!effect || effect.status !== 'pending') return null;
            const ownerRow = (
              await client.query<{ snapshot: RepCapacityState }>(
                "SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1 AND snapshot->'owner'->>'assignmentId'=$2",
                [effect.workspace_id, effect.assignment_id],
              )
            ).rows[0];
            const state = ownerRow?.snapshot;
            const session = await readTelephonySession(
              client,
              effect.workspace_id,
              effect.request_id,
            );
            if (!session || !state?.owner)
              throw new Error('Effect no longer owns capacity');
            const owner = state.owner;
            const allowed =
              effect.kind === 'terminate' ||
              (session.mode === 'waiting' &&
                (effect.kind === 'offer'
                  ? owner.phase === 'offering' &&
                    (options.clock?.() ?? new Date().toISOString()) <
                      owner.offerExpiresAt
                  : owner.phase === 'connecting' &&
                    owner.winnerEndpointId === effect.endpoint_id));
            if (!allowed) {
              await client.query(
                "UPDATE dialer_telephony_effects SET status='failed' WHERE workspace_id=$1 AND effect_id=$2",
                [effect.workspace_id, effect.effect_id],
              );
              return null;
            }
            await client.query(
              "UPDATE dialer_telephony_effects SET status='dispatched',updated_at=clock_timestamp() WHERE workspace_id=$1 AND effect_id=$2",
              [effect.workspace_id, effect.effect_id],
            );
            return { effect, state, session };
          } catch (cause: unknown) {
            if (cause instanceof Error) throw cause;
            throw new Error('Async operation rejected with a non-Error cause', {
              cause,
            });
          }
        },
      );
      if (!claimed) return;
      const { effect, state, session } = claimed;
      const number = options.numbers.find(
        (item) => item.numberId === session.number_id,
      );
      if (!number) throw new Error('Effect number configuration unavailable');
      let callSid = effect.call_sid;
      try {
        if (effect.kind === 'offer') {
          const target = options.endpoints.find(
            (item) =>
              item.workspaceId === effect.workspace_id &&
              item.repId === state.repId &&
              item.endpointId === effect.endpoint_id,
          );
          if (!target) throw new Error('Effect endpoint unavailable');
          const call = await options.carrier.offer({
            to:
              target.kind === 'browser'
                ? 'client:' + target.address
                : target.address,
            from: number.did,
            url: telephonyUrl(
              options,
              number.numberId,
              'screen',
              effect.effect_id,
            ),
            statusCallback: telephonyUrl(
              options,
              number.numberId,
              'status',
              effect.effect_id,
            ),
            timeoutSeconds: Math.max(
              1,
              Math.min(
                60,
                Math.ceil(
                  (Date.parse(state.owner!.offerExpiresAt) -
                    Date.parse(options.clock?.() ?? new Date().toISOString())) /
                    1000,
                ),
              ),
            ),
          });
          if (call.accountSid !== number.accountSid)
            throw new Error('Provider account mismatch');
          callSid = call.sid;
        } else if (effect.kind === 'terminate') {
          await options.carrier.end(effect.call_sid!);
        } else {
          await options.carrier.redirect(
            effect.call_sid!,
            conferenceTwiml(
              session.conference_name,
              telephonyUrl(
                options,
                number.numberId,
                'conference',
                session.request_id,
              ),
              effect.kind === 'bridge_caller' ? 'caller' : 'rep',
            ),
          );
        }
        const settled = await pool.query(
          "UPDATE dialer_telephony_effects SET status='succeeded',call_sid=$3,updated_at=clock_timestamp() WHERE workspace_id=$1 AND effect_id=$2 AND (call_sid IS NULL OR call_sid=$3)",
          [effect.workspace_id, effect.effect_id, callSid],
        );
        if (settled.rowCount !== 1)
          throw new Error('Conflicting provider correlation');
      } catch {
        await pool.query(
          "UPDATE dialer_telephony_effects SET status='unknown',updated_at=clock_timestamp() WHERE workspace_id=$1 AND effect_id=$2 AND status='dispatched'",
          [effect.workspace_id, effect.effect_id],
        );
        const current = await capacity.read(
          effect.workspace_id,
          state.capacityId,
        );
        if (
          current?.owner &&
          current.owner.assignmentId === effect.assignment_id &&
          current.owner.phase !== 'unknown'
        )
          await capacity.execute({
            workspaceId: effect.workspace_id,
            capacityId: state.capacityId,
            expectedVersion: current.version,
            operationId: 'tel:' + randomUUID(),
            action: {
              type: 'unknown',
              assignmentId: effect.assignment_id,
              generation: current.owner.generation,
            },
          });
      }
      await settleCommands(effect.workspace_id, effect.assignment_id);
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', {
        cause,
      });
    }
  };
  const terminate = async (client: PoolClient, effect: TelephonyEffect) => {
    try {
      if (!effect.call_sid) return;
      await insertTelephonyEffect(client, {
        ...effect,
        effect_id: telephonyId(
          effect.assignment_id,
          effect.call_sid,
          'terminate',
        ),
        kind: 'terminate',
        status: 'pending',
      });
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', {
        cause,
      });
    }
  };
  return { prepare, execute, settleCommands, terminate };
};
