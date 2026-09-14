import type { RepCapacityState } from '@consuelo/dialer';
import {
  readInboundSnapshot,
  withInboundTransaction,
} from './postgres-journal';
import { executeRepCapacityOnClient } from './rep-capacity';
import type { TelephonyOptions } from './telephony-admission';
import type { createTelephonyCommands } from './telephony-commands';
import {
  readTelephonyCapacity,
  readTelephonySession,
  readTelephonyEffects,
  moveTelephonyEntity,
  recordTelephonyFact,
  telephonyId,
} from './telephony-store';
import {
  terminalCarrierStatus,
  type TelephonySession,
} from './telephony-contracts';
export const createTelephonyReconciliation = (
  options: TelephonyOptions,
  commands: ReturnType<typeof createTelephonyCommands>,
) => {
  const { pool } = options;
  const reportCaller = async (session: TelephonySession, status: string) => {
    try {
      if (!terminalCarrierStatus(status)) return;
      await withInboundTransaction(
        pool,
        session.workspace_id,
        async (client) => {
          try {
            await recordTelephonyFact(
              client,
              session.workspace_id,
              session.request_id,
              session.caller_sid + ':' + status,
              'caller_ended',
            );
            const request = await readInboundSnapshot(
              client,
              session.workspace_id,
              'request',
              session.request_id,
            );
            if (
              request &&
              ['queued', 'offering', 'bridging', 'connected'].includes(
                request.state,
              )
            )
              await moveTelephonyEntity(
                client,
                session.workspace_id,
                'request',
                session.request_id,
                status === 'failed'
                  ? 'provider_failure'
                  : request.state === 'connected'
                    ? 'completed'
                    : 'abandoned',
                { clock: options.clock },
              );
            await moveTelephonyEntity(
              client,
              session.workspace_id,
              'leg',
              session.caller_sid,
              'ended',
              { clock: options.clock },
            );
            await client.query(
              "UPDATE dialer_telephony_sessions SET mode='ended' WHERE workspace_id=$1 AND request_id=$2",
              [session.workspace_id, session.request_id],
            );
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
  const reconcile = async (initial: RepCapacityState) => {
    try {
      if (
        !initial.owner ||
        initial.owner.direction !== 'inbound' ||
        initial.owner.phase === 'wrap_up'
      )
        return;
      const session = await readTelephonySession(
        pool,
        initial.workspaceId,
        initial.owner.requestId,
      );
      if (!session) return;
      const callbackFulfillment = await pool.query(
        'SELECT 1 FROM dialer_callback_obligations WHERE workspace_id=$1 AND request_id=$2 LIMIT 1',
        [initial.workspaceId, session.request_id],
      );
      if (callbackFulfillment.rowCount) return;
      const owner = initial.owner;
      const number = options.numbers.find(
        (item) => item.numberId === session.number_id,
      );
      if (!number) throw new Error('Session number unavailable');
      const effects = await readTelephonyEffects(
        pool,
        initial.workspaceId,
        owner.assignmentId,
      );
      const caller = await options.carrier.call(session.caller_sid);
      if (caller.accountSid !== number.accountSid)
        throw new Error('Caller provider account mismatch');
      await reportCaller(session, caller.status);
      const callerEnded = terminalCarrierStatus(caller.status);
      const at = options.clock?.() ?? new Date().toISOString();
      const stop =
        callerEnded ||
        session.mode !== 'waiting' ||
        owner.phase === 'unknown' ||
        (owner.phase === 'offering' && at >= owner.offerExpiresAt);
      const calls = new Map<string, string>();
      for (const effect of effects.filter(
        (item) => item.kind === 'offer' && item.call_sid,
      )) {
        const call = await options.carrier.call(effect.call_sid!);
        if (call.accountSid !== number.accountSid)
          throw new Error('Rep provider account mismatch');
        calls.set(call.sid, call.status);
        if (terminalCarrierStatus(call.status))
          await withInboundTransaction(
            pool,
            initial.workspaceId,
            async (client) => {
              try {
                await moveTelephonyEntity(
                  client,
                  initial.workspaceId,
                  'leg',
                  call.sid,
                  'ringing',
                  {
                    clock: options.clock,
                    identity: {
                      kind: 'leg',
                      requestId: session.request_id,
                      role: 'rep',
                    },
                  },
                );
                await moveTelephonyEntity(
                  client,
                  initial.workspaceId,
                  'leg',
                  call.sid,
                  'ended',
                  { clock: options.clock },
                );
              } catch (cause: unknown) {
                if (cause instanceof Error) throw cause;
                throw new Error(
                  'Async operation rejected with a non-Error cause',
                  { cause },
                );
              }
            },
          );
        if (
          !terminalCarrierStatus(call.status) &&
          (stop ||
            (owner.winnerEndpointId &&
              owner.winnerEndpointId !== effect.endpoint_id))
        )
          await withInboundTransaction(pool, initial.workspaceId, (client) =>
            commands.terminate(client, effect),
          );
      }
      const winner = effects.find(
        (effect) =>
          effect.kind === 'offer' &&
          effect.endpoint_id === owner.winnerEndpointId,
      );
      const winnerEnded = Boolean(
        winner?.call_sid &&
        terminalCarrierStatus(calls.get(winner.call_sid) ?? ''),
      );
      const bridgeEscaped = effects.some(
        (effect) =>
          ['bridge_caller', 'bridge_rep'].includes(effect.kind) &&
          effect.status !== 'pending' &&
          effect.status !== 'failed',
      );
      if (bridgeEscaped && (stop || winnerEnded) && !callerEnded) {
        const bridge = effects.find(
          (effect) => effect.kind === 'bridge_caller',
        );
        if (bridge)
          await withInboundTransaction(
            pool,
            initial.workspaceId,
            async (client) => {
              try {
                const request = await readInboundSnapshot(
                  client,
                  initial.workspaceId,
                  'request',
                  owner.requestId,
                );
                if (request && ['offering', 'bridging'].includes(request.state))
                  await moveTelephonyEntity(
                    client,
                    initial.workspaceId,
                    'request',
                    owner.requestId,
                    'provider_failure',
                    { clock: options.clock },
                  );
                await commands.terminate(client, bridge);
              } catch (cause: unknown) {
                if (cause instanceof Error) throw cause;
                throw new Error(
                  'Async operation rejected with a non-Error cause',
                  { cause },
                );
              }
            },
          );
      }
      // A lost create response without a correlated SID cannot establish absence.
      const unknownOffer = effects.some(
        (effect) =>
          effect.kind === 'offer' &&
          !effect.call_sid &&
          effect.status !== 'failed',
      );
      const allRepEnded = effects
        .filter((effect) => effect.kind === 'offer' && effect.call_sid)
        .every((effect) =>
          terminalCarrierStatus(calls.get(effect.call_sid!) ?? ''),
        );
      if (
        !unknownOffer &&
        allRepEnded &&
        (stop ||
          winnerEnded ||
          (effects.length > 0 &&
            effects
              .filter((effect) => effect.kind === 'offer')
              .every((effect) => effect.status === 'failed')))
      ) {
        if (bridgeEscaped && !callerEnded) return;
        const fenced = await withInboundTransaction(
          pool,
          initial.workspaceId,
          async (client) => {
            try {
              const state = await readTelephonyCapacity(
                client,
                initial.workspaceId,
                initial.capacityId,
              );
              const fresh = await readTelephonyEffects(
                client,
                initial.workspaceId,
                owner.assignmentId,
              );
              if (
                !state?.owner ||
                state.owner.assignmentId !== owner.assignmentId ||
                state.owner.phase === 'wrap_up'
              )
                return false;
              if (
                fresh.length !== effects.length ||
                fresh.some(
                  (effect, index) =>
                    effect.call_sid !== effects[index]?.call_sid ||
                    effect.status !== effects[index]?.status,
                )
              )
                return false;
              if (state.owner.phase !== 'unknown')
                await executeRepCapacityOnClient(
                  client,
                  {
                    workspaceId: initial.workspaceId,
                    capacityId: state.capacityId,
                    expectedVersion: state.version,
                    operationId: telephonyId(
                      owner.assignmentId,
                      'end-fence',
                      String(state.version),
                    ),
                    action: {
                      type: 'unknown',
                      assignmentId: owner.assignmentId,
                      generation: owner.generation,
                    },
                  },
                  { clock: options.clock },
                );
              await client.query(
                "UPDATE dialer_telephony_effects SET status=CASE WHEN status='pending' OR kind IN ('bridge_caller','bridge_rep') OR (kind='offer' AND call_sid IS NULL) THEN 'failed' ELSE 'succeeded' END WHERE workspace_id=$1 AND assignment_id=$2 AND status IN ('dispatched','unknown','pending')",
                [initial.workspaceId, owner.assignmentId],
              );
              return true;
            } catch (cause: unknown) {
              if (cause instanceof Error) throw cause;
              throw new Error(
                'Async operation rejected with a non-Error cause',
                { cause },
              );
            }
          },
        );
        if (!fenced) return;
        await commands.settleCommands(
          initial.workspaceId,
          owner.assignmentId,
          true,
        );
        await withInboundTransaction(
          pool,
          initial.workspaceId,
          async (client) => {
            try {
              const current = await readTelephonyCapacity(
                client,
                initial.workspaceId,
                initial.capacityId,
              );
              if (
                !current?.owner ||
                current.owner.assignmentId !== owner.assignmentId ||
                current.owner.phase === 'wrap_up'
              )
                return;
              const freshEffects = await readTelephonyEffects(
                client,
                initial.workspaceId,
                owner.assignmentId,
              );
              if (
                freshEffects.length !== effects.length ||
                freshEffects.some(
                  (effect) =>
                    effect.kind === 'offer' &&
                    effect.status !== 'failed' &&
                    (!effect.call_sid ||
                      !terminalCarrierStatus(calls.get(effect.call_sid) ?? '')),
                )
              )
                return;
              if (
                !callerEnded &&
                freshEffects.some(
                  (effect) =>
                    effect.kind === 'bridge_caller' &&
                    effect.status !== 'pending' &&
                    effect.status !== 'failed',
                )
              )
                return;
              const evidenceId = telephonyId(
                owner.assignmentId,
                'all-owned-legs-ended',
                String(current.version),
              );
              await recordTelephonyFact(
                client,
                initial.workspaceId,
                session.request_id,
                evidenceId,
                'owned_legs_ended',
              );
              await executeRepCapacityOnClient(
                client,
                {
                  workspaceId: initial.workspaceId,
                  capacityId: initial.capacityId,
                  expectedVersion: current.version,
                  operationId: evidenceId,
                  action: {
                    type: 'reconcile',
                    assignmentId: owner.assignmentId,
                    generation: owner.generation,
                    outcome: 'ended',
                    evidenceId,
                  },
                },
                { clock: options.clock },
              );
              const request = await readInboundSnapshot(
                client,
                initial.workspaceId,
                'request',
                owner.requestId,
              );
              if (
                request &&
                ['offering', 'bridging'].includes(request.state) &&
                !callerEnded &&
                session.mode === 'waiting'
              )
                await moveTelephonyEntity(
                  client,
                  initial.workspaceId,
                  'request',
                  owner.requestId,
                  'queued',
                  { clock: options.clock },
                );
              const bridgeId = telephonyId(owner.assignmentId, 'bridge');
              const bridge = await readInboundSnapshot(
                client,
                initial.workspaceId,
                'bridge',
                bridgeId,
              );
              if (
                bridge &&
                ['connecting', 'unknown', 'connected'].includes(bridge.state)
              )
                await moveTelephonyEntity(
                  client,
                  initial.workspaceId,
                  'bridge',
                  bridgeId,
                  bridge.state === 'connected' ? 'ended' : 'failed',
                  { clock: options.clock, evidence: 'reconciled_ended' },
                );
            } catch (cause: unknown) {
              if (cause instanceof Error) throw cause;
              throw new Error(
                'Async operation rejected with a non-Error cause',
                { cause },
              );
            }
          },
        );
        return;
      }
      if (
        stop ||
        !winner?.call_sid ||
        winnerEnded ||
        callerEnded ||
        !effects.some((effect) => effect.kind === 'bridge_caller')
      )
        return;
      const participants = await options.carrier.participants(
        session.conference_name,
      );
      const joined = (sid: string) =>
        participants.some(
          (participant) =>
            participant.callSid === sid &&
            !participant.muted &&
            !participant.hold,
        );
      if (!joined(session.caller_sid) || !joined(winner.call_sid)) return;
      if (
        effects.some(
          (effect) =>
            effect.kind === 'offer' &&
            effect.endpoint_id !== owner.winnerEndpointId &&
            (!effect.call_sid ||
              !terminalCarrierStatus(calls.get(effect.call_sid) ?? '')),
        )
      )
        return;
      await pool.query(
        "UPDATE dialer_telephony_effects SET status='succeeded' WHERE workspace_id=$1 AND assignment_id=$2 AND kind IN ('bridge_caller','bridge_rep') AND status IN ('dispatched','unknown')",
        [initial.workspaceId, owner.assignmentId],
      );
      await commands.settleCommands(
        initial.workspaceId,
        owner.assignmentId,
        true,
      );
      await withInboundTransaction(
        pool,
        initial.workspaceId,
        async (client) => {
          try {
            const current = await readTelephonyCapacity(
              client,
              initial.workspaceId,
              initial.capacityId,
            );
            const sessionNow = await readTelephonySession(
              client,
              initial.workspaceId,
              owner.requestId,
            );
            if (
              !current?.owner ||
              current.owner.assignmentId !== owner.assignmentId ||
              sessionNow?.mode !== 'waiting'
            )
              return;
            const evidenceId = telephonyId(
              owner.assignmentId,
              'participants',
              String(current.version),
            );
            await recordTelephonyFact(
              client,
              initial.workspaceId,
              session.request_id,
              evidenceId,
              'participants_confirmed',
            );
            if (current.owner.phase !== 'connected')
              await executeRepCapacityOnClient(
                client,
                {
                  workspaceId: initial.workspaceId,
                  capacityId: initial.capacityId,
                  expectedVersion: current.version,
                  operationId: evidenceId,
                  action: {
                    type: 'reconcile',
                    assignmentId: owner.assignmentId,
                    generation: owner.generation,
                    outcome: 'connected',
                    evidenceId,
                  },
                },
                { clock: options.clock },
              );
            for (const sid of [session.caller_sid, winner.call_sid!]) {
              const leg = await readInboundSnapshot(
                client,
                initial.workspaceId,
                'leg',
                sid,
              );
              if (leg?.state === 'ringing')
                await moveTelephonyEntity(
                  client,
                  initial.workspaceId,
                  'leg',
                  sid,
                  'answered',
                  { clock: options.clock },
                );
              await moveTelephonyEntity(
                client,
                initial.workspaceId,
                'leg',
                sid,
                'joined',
                { clock: options.clock },
              );
            }
            await moveTelephonyEntity(
              client,
              initial.workspaceId,
              'bridge',
              telephonyId(owner.assignmentId, 'bridge'),
              'connected',
              { clock: options.clock, evidence: 'participants_confirmed' },
            );
            await moveTelephonyEntity(
              client,
              initial.workspaceId,
              'request',
              owner.requestId,
              'connected',
              { clock: options.clock, evidence: 'participants_confirmed' },
            );
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
  return { reportCaller, reconcile };
};
